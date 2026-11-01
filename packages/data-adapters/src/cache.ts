// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Local record cache (P2.3.1).
 *
 * - Content-addressed: bodies are stored once under their sha256; an index maps a
 *   record key (source + record id + version) to a body hash and its fetch metadata.
 * - Keyed by version: a new source version is a different key, so it is a miss, never a
 *   stale hit.
 * - Integrity: a body whose hash no longer matches its address is dropped and reported
 *   as a miss.
 * - Never a bulk mirror: the index holds at most `maxEntries` records; the oldest are
 *   evicted first, and unreferenced bodies are deleted with them.
 *
 * Storage is behind a tiny async key-value interface so the same cache runs on an
 * in-memory map (tests, browser session), the file system (Node build scripts) or,
 * later, IndexedDB / the Tauri file system.
 */
import type { SourceId } from "@helix/shared-types";
import { sha256Hex } from "./hash.ts";
import type { FetchedResponse, HttpClient, RequestOptions } from "./http/client.ts";

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  keys(prefix: string): Promise<string[]>;
}

export class MemoryStore implements KeyValueStore {
  readonly map = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.map.get(key) ?? null;
  }
  async set(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }
  async keys(prefix: string): Promise<string[]> {
    return [...this.map.keys()].filter((k) => k.startsWith(prefix)).sort();
  }
}

export interface CacheKey {
  source: SourceId;
  /** The record identifier, e.g. "ENSG00000244734" or "2HBS". */
  recordId: string;
  /** Source version or release the record belongs to, e.g. "Ensembl 116"; "unversioned" if none. */
  version: string;
  /** Distinguishes several requests about the same record (e.g. "lookup", "cds"). */
  variant?: string;
}

export function cacheKeyString(k: CacheKey): string {
  const part = (s: string): string => encodeURIComponent(s);
  return `${part(k.source)}/${part(k.recordId)}/${part(k.version)}/${part(k.variant ?? "default")}`;
}

type IndexEntry = Omit<FetchedResponse, "body">;

export type CacheLookup = { hit: true; response: FetchedResponse } | { hit: false; reason: "absent" | "corrupt" };

export class RecordCache {
  private readonly store: KeyValueStore;
  readonly maxEntries: number;

  constructor(store: KeyValueStore, options: { maxEntries?: number } = {}) {
    this.store = store;
    this.maxEntries = options.maxEntries ?? 500;
  }

  async lookup(key: CacheKey): Promise<CacheLookup> {
    const raw = await this.store.get(`index/${cacheKeyString(key)}`);
    if (raw === null) return { hit: false, reason: "absent" };
    const entry = JSON.parse(raw) as IndexEntry;
    const body = await this.store.get(`blob/${entry.sha256}`);
    if (body === null || (await sha256Hex(body)) !== entry.sha256) {
      await this.invalidate(key);
      return { hit: false, reason: "corrupt" };
    }
    return { hit: true, response: { ...entry, body } };
  }

  async put(key: CacheKey, response: FetchedResponse): Promise<void> {
    // The address is the hash of the body as stored (decoded text); for UTF-8 sources it
    // equals the hash of the bytes received, which the response already carries.
    const sha = await sha256Hex(response.body);
    if (sha !== response.sha256) throw new Error(`cache: body hash mismatch for ${response.url}`);
    await this.store.set(`blob/${sha}`, response.body);
    const { body: _body, ...entry } = response;
    await this.store.set(`index/${cacheKeyString(key)}`, JSON.stringify(entry));
    await this.evict();
  }

  async invalidate(key: CacheKey): Promise<void> {
    await this.store.delete(`index/${cacheKeyString(key)}`);
    await this.collectGarbage();
  }

  /** Drop every record of a source (e.g. after a release change was detected). */
  async invalidateSource(source: SourceId): Promise<number> {
    const keys = await this.store.keys(`index/${encodeURIComponent(source)}/`);
    for (const k of keys) await this.store.delete(k);
    await this.collectGarbage();
    return keys.length;
  }

  async size(): Promise<number> {
    return (await this.store.keys("index/")).length;
  }

  private async evict(): Promise<void> {
    const keys = await this.store.keys("index/");
    if (keys.length <= this.maxEntries) return;
    const entries: { k: string; at: string }[] = [];
    for (const k of keys) {
      const raw = await this.store.get(k);
      if (raw !== null) entries.push({ k, at: (JSON.parse(raw) as IndexEntry).retrievedAt });
    }
    entries.sort((a, b) => a.at.localeCompare(b.at) || a.k.localeCompare(b.k));
    for (const e of entries.slice(0, entries.length - this.maxEntries)) await this.store.delete(e.k);
    await this.collectGarbage();
  }

  private async collectGarbage(): Promise<void> {
    const live = new Set<string>();
    for (const k of await this.store.keys("index/")) {
      const raw = await this.store.get(k);
      if (raw !== null) live.add((JSON.parse(raw) as IndexEntry).sha256);
    }
    for (const b of await this.store.keys("blob/")) {
      if (!live.has(b.slice("blob/".length))) await this.store.delete(b);
    }
  }
}

/** Return the cached response for `key`, or fetch, store and return it. */
export async function cachedGet(
  client: HttpClient,
  cache: RecordCache,
  key: CacheKey,
  url: string,
  ro: RequestOptions = {},
): Promise<{ response: FetchedResponse; fromCache: boolean }> {
  const hit = await cache.lookup(key);
  if (hit.hit) return { response: hit.response, fromCache: true };
  const response = await client.request(key.source, url, ro);
  await cache.put(key, response);
  return { response, fromCache: false };
}
