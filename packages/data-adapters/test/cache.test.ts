// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
import { describe, expect, it, vi } from "vitest";
import { type FetchedResponse, HttpClient, MemoryStore, RecordCache, cachedGet, sha256Hex } from "../src/index.ts";

async function resp(body: string, at = "2026-11-01T00:00:00Z", url = "https://rest.uniprot.org/uniprotkb/P68871.json"): Promise<FetchedResponse> {
  return { source: "uniprot", url, method: "GET", status: 200, body, bytes: body.length, sha256: await sha256Hex(body), headers: {}, retrievedAt: at, attempts: 1 };
}
const key = { source: "uniprot" as const, recordId: "P68871", version: "UniProt 2026_03" };

describe("RecordCache", () => {
  it("miss, then hit with the identical body", async () => {
    const c = new RecordCache(new MemoryStore());
    expect(await c.lookup(key)).toEqual({ hit: false, reason: "absent" });
    await c.put(key, await resp('{"a":1}'));
    const h = await c.lookup(key);
    expect(h.hit && h.response.body).toBe('{"a":1}');
  });

  it("is content-addressed: two keys with the same body share one blob", async () => {
    const store = new MemoryStore();
    const c = new RecordCache(store);
    await c.put(key, await resp("same"));
    await c.put({ ...key, recordId: "P69905" }, await resp("same"));
    expect((await store.keys("blob/")).length).toBe(1);
    expect(await c.size()).toBe(2);
  });

  it("a new source version is a different key: miss, never a stale hit", async () => {
    const c = new RecordCache(new MemoryStore());
    await c.put(key, await resp("old"));
    expect((await c.lookup({ ...key, version: "UniProt 2026_04" })).hit).toBe(false);
  });

  it("invalidate() and invalidateSource() remove entries and their unreferenced blobs", async () => {
    const store = new MemoryStore();
    const c = new RecordCache(store);
    await c.put(key, await resp("x"));
    await c.invalidate(key);
    expect((await c.lookup(key)).hit).toBe(false);
    expect(await store.keys("blob/")).toEqual([]);
    await c.put(key, await resp("y"));
    await c.put({ ...key, source: "ensembl" }, { ...(await resp("z")), source: "ensembl" });
    expect(await c.invalidateSource("uniprot")).toBe(1);
    expect(await c.size()).toBe(1);
  });

  it("a corrupted blob is reported as a miss and dropped", async () => {
    const store = new MemoryStore();
    const c = new RecordCache(store);
    await c.put(key, await resp("good"));
    const [blob] = await store.keys("blob/");
    await store.set(blob!, "tampered");
    expect(await c.lookup(key)).toEqual({ hit: false, reason: "corrupt" });
  });

  it("never grows into a bulk mirror: oldest entries are evicted past maxEntries", async () => {
    const c = new RecordCache(new MemoryStore(), { maxEntries: 2 });
    await c.put({ ...key, recordId: "A" }, await resp("a", "2026-11-01T00:00:01Z"));
    await c.put({ ...key, recordId: "B" }, await resp("b", "2026-11-01T00:00:02Z"));
    await c.put({ ...key, recordId: "C" }, await resp("c", "2026-11-01T00:00:03Z"));
    expect(await c.size()).toBe(2);
    expect((await c.lookup({ ...key, recordId: "A" })).hit).toBe(false);
    expect((await c.lookup({ ...key, recordId: "C" })).hit).toBe(true);
  });

  it("refuses a response whose body does not hash to its sha256", async () => {
    const c = new RecordCache(new MemoryStore());
    await expect(c.put(key, { ...(await resp("x")), sha256: "0".repeat(64) })).rejects.toThrow(/hash mismatch/);
  });

  it("cachedGet fetches once, then serves from the cache", async () => {
    const fetchMock = vi.fn(async () => new Response('{"v":1}', { status: 200 }));
    const http = new HttpClient({ fetch: fetchMock as unknown as typeof fetch });
    const c = new RecordCache(new MemoryStore());
    const a = await cachedGet(http, c, key, "https://rest.uniprot.org/uniprotkb/P68871.json");
    const b = await cachedGet(http, c, key, "https://rest.uniprot.org/uniprotkb/P68871.json");
    expect([a.fromCache, b.fromCache]).toEqual([false, true]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(b.response.sha256).toBe(a.response.sha256);
  });
});
