// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/** HTTP core against a real local server (node:http): timeout, 429, 5xx, 404, malformed bodies, abort. */
import { type IncomingMessage, type Server, type ServerResponse, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AbortedError,
  type Clock,
  HttpClient,
  HttpStatusError,
  MalformedResponseError,
  NotFoundError,
  RateLimitedError,
  TimeoutError,
  TokenBucket,
  parseRetryAfter,
} from "../src/index.ts";

type Handler = (req: IncomingMessage, res: ServerResponse, hit: number) => void;
const routes = new Map<string, Handler>();
const hits = new Map<string, number>();
const seenHeaders = new Map<string, IncomingMessage["headers"]>();
let server: Server;
let base: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0]!;
    const n = (hits.get(path) ?? 0) + 1;
    hits.set(path, n);
    seenHeaders.set(path, req.headers);
    const h = routes.get(path);
    if (!h) {
      res.writeHead(404).end("not found");
      return;
    }
    h(req, res, n);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  routes.set("/ok", (_q, s) => s.writeHead(200, { "content-type": "application/json", "x-uniprot-release": "2026_03" }).end('{"releases":[116]}'));
  routes.set("/slow", (_q, s) => setTimeout(() => s.writeHead(200).end("{}"), 400));
  routes.set("/429-then-ok", (_q, s, n) => (n === 1 ? s.writeHead(429, { "retry-after": "1" }).end("slow down") : s.writeHead(200).end('{"ok":true}')));
  routes.set("/429-long", (_q, s) => s.writeHead(429, { "retry-after": "3600" }).end("go away"));
  routes.set("/500-then-ok", (_q, s, n) => (n < 3 ? s.writeHead(500, { "content-type": "text/html" }).end("<!DOCTYPE html><html><body>Internal Server Error</body></html>") : s.writeHead(200).end('{"ok":true}')));
  routes.set("/503-always", (_q, s) => s.writeHead(503).end("<html>unavailable</html>"));
  routes.set("/400", (_q, s) => s.writeHead(400).end('{"error":"bad"}'));
  routes.set("/html-200", (_q, s) => s.writeHead(200, { "content-type": "text/html" }).end("<!DOCTYPE html><html><body>Maintenance</body></html>"));
  routes.set("/bad-json", (_q, s) => s.writeHead(200, { "content-type": "application/json" }).end("{date: 2026-08-05}"));
  routes.set("/empty", (_q, s) => s.writeHead(200).end(""));
  routes.set("/short", (_q, s) => {
    s.writeHead(200, { "content-length": "1000" });
    s.write('{"partial":');
    setTimeout(() => s.destroy(), 20);
  });
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

/** Fast client: real fetch and real server, but back-off sleeps shortened. */
function client(extra: ConstructorParameters<typeof HttpClient>[0] = {}): { http: HttpClient; sleeps: number[] } {
  const sleeps: number[] = [];
  const clock: Clock = { now: () => Date.now(), sleep: async (ms) => void sleeps.push(ms) };
  return { http: new HttpClient({ clock, random: () => 0.5, timeoutMs: 2000, ...extra }), sleeps };
}

describe("HttpClient", () => {
  it("returns body, sha256, kept headers and attempt count", async () => {
    const { http } = client();
    const { response, json } = await http.getJson("uniprot", `${base}/ok`);
    expect(json).toEqual({ releases: [116] });
    expect(response.status).toBe(200);
    expect(response.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(response.headers["x-uniprot-release"]).toBe("2026_03");
    expect(response.attempts).toBe(1);
  });

  it("sends User-Agent only when configured (Node scripts), never by default", async () => {
    await client({ userAgent: "helix-research" }).http.getJson("ensembl", `${base}/ok`);
    expect(seenHeaders.get("/ok")?.["user-agent"]).toBe("helix-research");
  });

  it("times out each attempt and gives up with TimeoutError after the retries", async () => {
    const { http, sleeps } = client({ timeoutMs: 100, maxAttempts: 2 });
    const before = hits.get("/slow") ?? 0;
    await expect(http.request("ensembl", `${base}/slow`)).rejects.toBeInstanceOf(TimeoutError);
    expect((hits.get("/slow") ?? 0) - before).toBe(2);
    expect(sleeps).toHaveLength(1);
  });

  it("honours Retry-After on 429 and then succeeds", async () => {
    const { http, sleeps } = client();
    const { json, response } = await http.getJson("rcsb", `${base}/429-then-ok`);
    expect(json).toEqual({ ok: true });
    expect(response.attempts).toBe(2);
    expect(sleeps[0]).toBeGreaterThanOrEqual(1000);
  });

  it("does not wait for an unreasonable Retry-After: RateLimitedError", async () => {
    const { http } = client({ maxRetryAfterMs: 10_000 });
    const err = await http.request("rcsb", `${base}/429-long`).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RateLimitedError);
    expect((err as RateLimitedError).retryAfterSeconds).toBe(3600);
  });

  it("retries 5xx with exponential back-off, then succeeds", async () => {
    const { http, sleeps } = client({ backoffBaseMs: 100 });
    const { response } = await http.getJson("ensembl", `${base}/500-then-ok`);
    expect(response.attempts).toBe(3);
    // jitter fixed at 0.5 -> 0.75 x nominal: 100 * 2^0, 100 * 2^1
    expect(sleeps).toEqual([75, 150]);
  });

  it("gives up on persistent 5xx with HttpStatusError, body never parsed", async () => {
    const { http } = client({ maxAttempts: 3 });
    const err = await http.getJson("ensembl", `${base}/503-always`).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpStatusError);
    expect((err as HttpStatusError).status).toBe(503);
    expect((err as HttpStatusError).retryable).toBe(true);
  });

  it("does not retry 4xx; 404 is NotFoundError", async () => {
    const { http, sleeps } = client();
    const e400 = await http.request("ensembl", `${base}/400`).catch((e: unknown) => e);
    expect(e400).toBeInstanceOf(HttpStatusError);
    expect((e400 as HttpStatusError).retryable).toBe(false);
    await expect(http.request("ensembl", `${base}/missing`)).rejects.toBeInstanceOf(NotFoundError);
    expect(sleeps).toHaveLength(0);
  });

  it("rejects an HTML page served with 200 where JSON was expected", async () => {
    const err = await client().http.getJson("ensembl", `${base}/html-200`).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MalformedResponseError);
    expect((err as MalformedResponseError).kind).toBe("html-instead-of-json");
  });

  it("rejects invalid JSON (the GO release-date.json case) and empty bodies", async () => {
    const e1 = await client().http.getJson("ensembl", `${base}/bad-json`).catch((e: unknown) => e);
    expect((e1 as MalformedResponseError).kind).toBe("invalid-json");
    const e2 = await client().http.getJson("ensembl", `${base}/empty`).catch((e: unknown) => e);
    expect((e2 as MalformedResponseError).kind).toBe("empty-body");
  });

  it("treats a connection cut mid-body as a retryable failure, never a partial record", async () => {
    const err = await client({ maxAttempts: 2 }).http.getJson("ensembl", `${base}/short`).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MalformedResponseError);
    expect((err as MalformedResponseError).kind).toBe("truncated");
  });

  it("caller cancellation is AbortedError and is not retried", async () => {
    const { http } = client({ timeoutMs: 5000 });
    const ctrl = new AbortController();
    const p = http.request("ensembl", `${base}/slow`, { signal: ctrl.signal });
    setTimeout(() => ctrl.abort(), 50);
    await expect(p).rejects.toBeInstanceOf(AbortedError);
  });
});

describe("TokenBucket", () => {
  it("allows a burst, then spaces requests at the sustained rate", async () => {
    let t = 0;
    const waits: number[] = [];
    const clock: Clock = { now: () => t, sleep: async (ms) => { waits.push(ms); t += ms; } };
    const b = new TokenBucket({ perSecond: 10, burst: 2 }, clock);
    for (let i = 0; i < 5; i++) await b.acquire();
    expect(waits).toEqual([100, 100, 100]);
    expect(t).toBe(300);
  });
  it("pause() blocks the bucket for a server-requested period", async () => {
    let t = 0;
    const clock: Clock = { now: () => t, sleep: async (ms) => { t += ms; } };
    const b = new TokenBucket({ perSecond: 2, burst: 2 }, clock);
    b.pause(1000);
    await b.acquire();
    expect(t).toBeGreaterThanOrEqual(1000);
  });
  it("per-source limits are below the documented ceilings", async () => {
    const { DEFAULT_RATE_LIMITS } = await import("../src/index.ts");
    expect(DEFAULT_RATE_LIMITS.ensembl.perSecond).toBeLessThan(15); // Ensembl: 55,000/hour, ~15/s
    expect(DEFAULT_RATE_LIMITS["ncbi-clinvar"].perSecond).toBeLessThan(3); // NCBI: 3/s without a key
    expect(DEFAULT_RATE_LIMITS.hgnc.perSecond).toBeLessThan(10); // HGNC: 10/s
  });
});

describe("parseRetryAfter", () => {
  it("reads seconds and HTTP dates", () => {
    expect(parseRetryAfter("7", 0)).toBe(7);
    expect(parseRetryAfter(new Date(10_000).toUTCString(), 0)).toBe(10);
    expect(parseRetryAfter(null, 0)).toBeNull();
    expect(parseRetryAfter("soon", 0)).toBeNull();
  });
});
