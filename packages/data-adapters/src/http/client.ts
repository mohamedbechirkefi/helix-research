// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * HTTP core (P2.2.1): per-attempt timeouts, retries with exponential back-off and jitter,
 * a token bucket per source, typed errors, and detection of malformed bodies (HTML error
 * pages served where JSON was expected, invalid JSON, empty or truncated bodies).
 *
 * Platform-agnostic (amendment A-1): uses only fetch, AbortController, TextDecoder and
 * Web Crypto, available in browsers, the Tauri webview and Node >= 22.
 *
 * Browser note (docs/data-source-registry.md): pages cannot set User-Agent, and custom
 * headers make files.rcsb.org, models.rcsb.org and HGNC fail CORS preflight. So
 * `userAgent` is only set by Node build scripts; browser callers leave it undefined and
 * send simple GETs (Ensembl content type goes in the query string).
 */
import type { SourceId } from "@helix/shared-types";
import { sha256Hex } from "../hash.ts";
import {
  AbortedError,
  HelixDataError,
  HttpStatusError,
  MalformedResponseError,
  NetworkError,
  NotFoundError,
  RateLimitedError,
  TimeoutError,
} from "./errors.ts";
import { type Clock, type RateLimit, realClock, TokenBucket } from "./rate-limiter.ts";

/**
 * Per-source limits, set below the documented ceilings (registry, consequence 3):
 * Ensembl documents 15/s, NCBI 3/s without a key, HGNC 10/s, RCSB "a handful" per second.
 */
export const DEFAULT_RATE_LIMITS: Record<SourceId, RateLimit> = {
  ensembl: { perSecond: 10, burst: 5 },
  uniprot: { perSecond: 3, burst: 3 },
  rcsb: { perSecond: 3, burst: 3 },
  "rcsb-files": { perSecond: 3, burst: 3 },
  "pdbe-sifts": { perSecond: 3, burst: 3 },
  "ncbi-clinvar": { perSecond: 2, burst: 1 },
  hgnc: { perSecond: 5, burst: 3 },
  alphafold: { perSecond: 3, burst: 3 },
  // Reactome states no numeric limit (registry section 6); kept at the same polite rate as the others.
  reactome: { perSecond: 3, burst: 3 },
};

/** Response headers worth keeping as provenance (release identifiers, rate-limit state). */
const KEPT_HEADERS = [
  "content-type",
  "x-uniprot-release",
  "x-uniprot-release-date",
  "last-modified",
  "etag",
  "x-ratelimit-limit",
  "x-ratelimit-remaining",
  "retry-after",
];

export interface FetchedResponse {
  source: SourceId;
  url: string;
  method: "GET" | "POST";
  status: number;
  body: string;
  bytes: number;
  sha256: string;
  headers: Record<string, string>;
  retrievedAt: string;
  attempts: number;
}

export type HttpEvent =
  | { type: "retry"; url: string; attempt: number; delayMs: number; error: HelixDataError }
  | { type: "response"; url: string; status: number; attempt: number; ms: number };

export interface HttpClientOptions {
  fetch?: typeof fetch;
  clock?: Clock;
  /** Only for non-browser callers (Node scripts). */
  userAgent?: string;
  timeoutMs?: number;
  maxAttempts?: number;
  backoffBaseMs?: number;
  backoffMaxMs?: number;
  /** A Retry-After longer than this is not waited for; the call fails with RateLimitedError. */
  maxRetryAfterMs?: number;
  rateLimits?: Partial<Record<SourceId, RateLimit>>;
  random?: () => number;
  onEvent?: (e: HttpEvent) => void;
}

export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  /** CORS-safelisted headers only (e.g. Accept) when the code may run in a browser. */
  headers?: Record<string, string>;
  method?: "GET" | "POST";
  body?: string;
}

export class HttpClient {
  private readonly fetchImpl: typeof fetch;
  private readonly clock: Clock;
  private readonly opts: Required<Pick<HttpClientOptions, "timeoutMs" | "maxAttempts" | "backoffBaseMs" | "backoffMaxMs" | "maxRetryAfterMs">> &
    HttpClientOptions;
  private readonly buckets = new Map<SourceId, TokenBucket>();
  private readonly random: () => number;

  constructor(options: HttpClientOptions = {}) {
    const f = options.fetch ?? globalThis.fetch;
    if (typeof f !== "function") throw new Error("No fetch implementation available");
    this.fetchImpl = f.bind(globalThis);
    this.clock = options.clock ?? realClock;
    this.random = options.random ?? Math.random;
    this.opts = {
      timeoutMs: 30_000,
      maxAttempts: 4,
      backoffBaseMs: 500,
      backoffMaxMs: 8_000,
      maxRetryAfterMs: 60_000,
      ...options,
    };
  }

  private bucket(source: SourceId): TokenBucket {
    let b = this.buckets.get(source);
    if (!b) {
      b = new TokenBucket(this.opts.rateLimits?.[source] ?? DEFAULT_RATE_LIMITS[source], this.clock);
      this.buckets.set(source, b);
    }
    return b;
  }

  /** Back-off delay for attempt n (1-based), with jitter in [0.5, 1.0) of the nominal delay. */
  backoffDelay(attempt: number): number {
    const nominal = Math.min(this.opts.backoffMaxMs, this.opts.backoffBaseMs * 2 ** (attempt - 1));
    return Math.round(nominal * (0.5 + this.random() * 0.5));
  }

  /** Fetch with retries. Resolves only with a 2xx response whose body is complete. */
  async request(source: SourceId, url: string, ro: RequestOptions = {}): Promise<FetchedResponse> {
    let lastError: HelixDataError | null = null;
    for (let attempt = 1; attempt <= this.opts.maxAttempts; attempt++) {
      if (ro.signal?.aborted) throw new AbortedError(url);
      try {
        await this.bucket(source).acquire(ro.signal);
      } catch {
        throw new AbortedError(url);
      }
      try {
        return await this.once(source, url, ro, attempt);
      } catch (e) {
        const err = e instanceof HelixDataError ? e : new NetworkError(url, e);
        lastError = err;
        if (!err.retryable || attempt === this.opts.maxAttempts) throw err;
        let delay = this.backoffDelay(attempt);
        if (err instanceof RateLimitedError && err.retryAfterSeconds !== null) {
          const ra = err.retryAfterSeconds * 1000;
          if (ra > this.opts.maxRetryAfterMs) throw err;
          delay = Math.max(delay, ra);
          this.bucket(source).pause(ra);
        }
        this.opts.onEvent?.({ type: "retry", url, attempt, delayMs: delay, error: err });
        try {
          await this.clock.sleep(delay, ro.signal);
        } catch {
          throw new AbortedError(url);
        }
      }
    }
    throw lastError ?? new NetworkError(url, "no attempt made");
  }

  private async once(source: SourceId, url: string, ro: RequestOptions, attempt: number): Promise<FetchedResponse> {
    const timeoutMs = ro.timeoutMs ?? this.opts.timeoutMs;
    const ctrl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      ctrl.abort();
    }, timeoutMs);
    const onOuterAbort = (): void => ctrl.abort();
    ro.signal?.addEventListener("abort", onOuterAbort, { once: true });
    const headers: Record<string, string> = { ...(ro.headers ?? {}) };
    if (this.opts.userAgent) headers["User-Agent"] = this.opts.userAgent;
    const started = this.clock.now();
    try {
      let res: Response;
      try {
        const init: RequestInit = { method: ro.method ?? "GET", headers, signal: ctrl.signal, redirect: "follow" };
        if (ro.body !== undefined) init.body = ro.body;
        res = await this.fetchImpl(url, init);
      } catch (e) {
        if (timedOut) throw new TimeoutError(url, timeoutMs);
        if (ro.signal?.aborted) throw new AbortedError(url);
        throw new NetworkError(url, e);
      }
      let buf: ArrayBuffer;
      try {
        buf = await res.arrayBuffer();
      } catch (e) {
        if (timedOut) throw new TimeoutError(url, timeoutMs);
        if (ro.signal?.aborted) throw new AbortedError(url);
        throw new MalformedResponseError(url, "truncated", "", true, `body read failed: ${e instanceof Error ? e.message : String(e)}`);
      }
      const body = new TextDecoder("utf-8").decode(buf);
      const snippet = body.slice(0, 200);
      this.opts.onEvent?.({ type: "response", url, status: res.status, attempt, ms: this.clock.now() - started });
      if (res.status === 404) throw new NotFoundError(url, snippet);
      if (res.status === 429) throw new RateLimitedError(url, parseRetryAfter(res.headers.get("retry-after"), this.clock.now()));
      if (res.status < 200 || res.status >= 300) {
        throw new HttpStatusError(url, res.status, snippet);
      }
      const declared = res.headers.get("content-length");
      if (declared !== null && !res.headers.get("content-encoding") && Number(declared) !== buf.byteLength) {
        throw new MalformedResponseError(url, "truncated", "", true, `declared ${declared} bytes, received ${buf.byteLength}`);
      }
      const kept: Record<string, string> = {};
      for (const h of KEPT_HEADERS) {
        const v = res.headers.get(h);
        if (v !== null) kept[h] = v;
      }
      return {
        source,
        url,
        method: ro.method ?? "GET",
        status: res.status,
        body,
        bytes: buf.byteLength,
        sha256: await sha256Hex(new Uint8Array(buf)),
        headers: kept,
        retrievedAt: new Date(this.clock.now()).toISOString().replace(/\.\d{3}Z$/, "Z"),
        attempts: attempt,
      };
    } finally {
      clearTimeout(timer);
      ro.signal?.removeEventListener("abort", onOuterAbort);
    }
  }

  /** Fetch and parse JSON. HTML error pages and invalid JSON become MalformedResponseError. */
  async getJson(source: SourceId, url: string, ro: RequestOptions = {}): Promise<{ response: FetchedResponse; json: unknown }> {
    const response = await this.request(source, url, ro);
    return { response, json: parseJsonBody(response.body, url) };
  }

  async getText(source: SourceId, url: string, ro: RequestOptions = {}): Promise<FetchedResponse> {
    const response = await this.request(source, url, ro);
    if (response.body.trim().length === 0) throw new MalformedResponseError(url, "empty-body", "");
    if (looksLikeHtml(response.body)) throw new MalformedResponseError(url, "html-instead-of-json", response.body.slice(0, 200));
    return response;
  }
}

export function looksLikeHtml(body: string): boolean {
  // JSON, FASTA (">") and mmCIF ("data_") never start with "<"; HTML and XML error pages do.
  return body.trimStart().startsWith("<");
}

/** Strict JSON parse of a response body; never returns a partial value. */
export function parseJsonBody(body: string, url: string | null = null): unknown {
  if (body.trim().length === 0) throw new MalformedResponseError(url, "empty-body", "");
  if (looksLikeHtml(body)) throw new MalformedResponseError(url, "html-instead-of-json", body.slice(0, 200));
  try {
    return JSON.parse(body);
  } catch {
    throw new MalformedResponseError(url, "invalid-json", body.slice(0, 200));
  }
}

/** Retry-After is either delta-seconds or an HTTP date. Returns seconds, or null if absent/unreadable. */
export function parseRetryAfter(v: string | null, nowMs: number): number | null {
  if (v === null || v.trim() === "") return null;
  if (/^\d+$/.test(v.trim())) return Number(v.trim());
  const t = Date.parse(v);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.ceil((t - nowMs) / 1000));
}
