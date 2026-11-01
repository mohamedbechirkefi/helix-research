// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
import { describe, expect, it, vi } from "vitest";
import {
  DeterministicProvider,
  OllamaProvider,
  ProviderRegistry,
  WebLLMProvider,
  deterministicPlan,
  type PlanProvider,
  type WebLLMEngineLike,
} from "../src/index.ts";
import { hbbContext } from "./load.ts";

const ctx = hbbContext();
const planJson = JSON.stringify(deterministicPlan("Show me where the sickle-cell mutation affects hemoglobin.", ctx).plan);

function ndjsonResponse(chunks: object[]): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(JSON.stringify(ch) + "\n"));
      c.close();
    },
  });
  return new Response(body, { status: 200 });
}

function mockOllamaFetch(opts: { models?: string[]; down?: boolean } = {}) {
  const calls: { url: string; body: Record<string, unknown> | null }[] = [];
  const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null });
    if (opts.down) throw new TypeError("fetch failed");
    if (u.endsWith("/api/version")) return Response.json({ version: "0.40.6" });
    if (u.endsWith("/api/tags")) return Response.json({ models: (opts.models ?? ["qwen3.5:4b"]).map((name) => ({ name, digest: "abc" })) });
    if (u.endsWith("/api/chat")) {
      const half = Math.floor(planJson.length / 2);
      return ndjsonResponse([
        { message: { content: planJson.slice(0, half) }, done: false },
        { message: { content: planJson.slice(half) }, done: false },
        { message: { content: "" }, done: true, done_reason: "stop", eval_count: 120, eval_duration: 2e9, prompt_eval_count: 900, load_duration: 1e8 },
      ]);
    }
    return new Response("not found", { status: 404 });
  });
  return { f: f as unknown as typeof fetch, calls };
}

describe("OllamaProvider (mocked HTTP)", () => {
  it("detects the server and the model", async () => {
    const { f } = mockOllamaFetch();
    expect((await new OllamaProvider({ model: "qwen3.5:4b", fetch: f }).detect()).available).toBe(true);
    const missing = await new OllamaProvider({ model: "ministral-3:8b", fetch: f }).detect();
    expect(missing.available).toBe(false);
    expect(missing.reason).toContain("not installed");
    const down = await new OllamaProvider({ model: "x", fetch: mockOllamaFetch({ down: true }).f }).detect();
    expect(down.available).toBe(false);
  });
  it("sends the JSON schema in format, think:false, temperature, and streams the plan", async () => {
    const { f, calls } = mockOllamaFetch();
    const p = new OllamaProvider({ model: "qwen3.5:4b", fetch: f, think: false });
    const out = await p.plan({ query: "q", context: ctx, requestId: "1", temperature: 0, seed: 3 });
    expect(out.raw).toBe(planJson);
    expect(out.timings.firstTokenMs).not.toBeNull();
    expect(out.usage).toMatchObject({ completionTokens: 120, promptTokens: 900, evalMs: 2000, loadMs: 100 });
    const body = calls.find((c) => c.url.endsWith("/api/chat"))!.body!;
    expect(body.think).toBe(false);
    expect(body.stream).toBe(true);
    expect((body.format as { type: string }).type).toBe("object");
    expect(body.options).toMatchObject({ temperature: 0, seed: 3, num_ctx: 8192 });
  });
  it("omits think for models without the capability", async () => {
    const { f, calls } = mockOllamaFetch();
    await new OllamaProvider({ model: "qwen3.5:4b", fetch: f }).plan({ query: "q", context: ctx, requestId: "1" });
    expect("think" in calls.find((c) => c.url.endsWith("/api/chat"))!.body!).toBe(false);
  });
});

function mockEngine(text: string): WebLLMEngineLike & { requests: Record<string, unknown>[] } {
  const requests: Record<string, unknown>[] = [];
  return {
    requests,
    chat: {
      completions: {
        async create(req) {
          requests.push(req);
          async function* gen() {
            yield { choices: [{ delta: { content: text.slice(0, 10) } }] };
            yield { choices: [{ delta: { content: text.slice(10) } }] };
            yield { choices: [], usage: { prompt_tokens: 800, completion_tokens: 90 } };
          }
          return gen();
        },
      },
    },
  };
}

describe("WebLLMProvider (mock engine)", () => {
  it("is unavailable without WebGPU (e.g. WKWebView on macOS 15)", async () => {
    const p = new WebLLMProvider({ modelId: "Qwen3-1.7B-q4f16_1-MLC", engineFactory: async () => mockEngine(planJson), gpu: () => undefined });
    expect((await p.detect()).available).toBe(false);
  });
  it("requires an adapter and the user's opt-in", async () => {
    const noAdapter = new WebLLMProvider({ modelId: "m", engineFactory: async () => mockEngine(""), gpu: () => ({ requestAdapter: async () => null }) });
    expect((await noAdapter.detect()).reason).toContain("no GPU adapter");
    let opted = false;
    const p = new WebLLMProvider({ modelId: "m", downloadBytes: 1.1e9, engineFactory: async () => mockEngine(planJson), gpu: () => ({ requestAdapter: async () => ({}) }), optedIn: () => opted });
    const before = await p.detect();
    expect(before.available).toBe(false);
    expect(before.reason).toContain("1100 MB");
    opted = true;
    expect((await p.detect()).available).toBe(true);
  });
  it("passes the schema as response_format and streams the output", async () => {
    const eng = mockEngine(planJson);
    const factory = vi.fn(async () => eng);
    const p = new WebLLMProvider({ modelId: "m", engineFactory: factory, gpu: () => ({ requestAdapter: async () => ({}) }) });
    const out = await p.plan({ query: "q", context: ctx, requestId: "1" });
    await p.plan({ query: "q", context: ctx, requestId: "2" });
    expect(factory).toHaveBeenCalledTimes(1); // engine created once, lazily
    expect(out.raw).toBe(planJson);
    expect(out.usage).toEqual({ promptTokens: 800, completionTokens: 90 });
    const rf = eng.requests[0]!.response_format as { type: string; schema: string };
    expect(rf.type).toBe("json_object");
    expect(JSON.parse(rf.schema).additionalProperties).toBe(false);
  });
});

class FakeProvider implements PlanProvider {
  readonly kind = "mock" as const;
  readonly local = true as const;
  readonly label: string;
  readonly id: string;
  available: boolean;
  constructor(id: string, available: boolean) {
    this.id = id;
    this.label = id;
    this.available = available;
  }
  async detect() {
    return { available: this.available, reason: this.available ? "ok" : "down" };
  }
  async plan() {
    return { raw: planJson, timings: { firstTokenMs: 1, totalMs: 1 } };
  }
}

describe("ProviderRegistry: capability detection and runtime switching", () => {
  it("requires a deterministic provider", () => {
    expect(() => new ProviderRegistry([new FakeProvider("a", true)])).toThrow(/deterministic/);
  });
  it("selects the preferred available provider and lists every status", async () => {
    const ollama = new FakeProvider("ollama", false);
    const web = new FakeProvider("webllm", true);
    const r = new ProviderRegistry([new DeterministicProvider(), ollama, web], ["ollama", "webllm", "deterministic"]);
    expect((await r.selectBest()).id).toBe("webllm");
    const st = r.statuses();
    expect(st.map((s) => [s.id, s.available, s.active])).toEqual([
      ["deterministic", true, false],
      ["ollama", false, false],
      ["webllm", true, true],
    ]);
    ollama.available = true;
    expect((await r.selectBest()).id).toBe("ollama");
  });
  it("switches at runtime, refuses unavailable providers, and notifies listeners", async () => {
    const r = new ProviderRegistry([new DeterministicProvider(), new FakeProvider("ollama", true), new FakeProvider("webllm", false)]);
    await r.detectAll();
    const seen: string[] = [];
    r.onChange((a) => seen.push(a));
    r.setActive("ollama");
    expect(r.active.id).toBe("ollama");
    expect(() => r.setActive("webllm")).toThrow(/not available/);
    expect(() => r.setActive("nope")).toThrow(/unknown/);
    r.setActive("deterministic");
    expect(seen).toEqual(["ollama", "deterministic"]);
  });
  it("falls back to deterministic when the active provider disappears", async () => {
    const o = new FakeProvider("ollama", true);
    const r = new ProviderRegistry([new DeterministicProvider(), o], ["ollama"]);
    await r.selectBest();
    expect(r.active.id).toBe("ollama");
    r.markUnavailable("ollama", "connection refused");
    expect(r.active.id).toBe("deterministic");
    o.available = false;
    await r.detectAll();
    expect(r.active.id).toBe("deterministic");
  });
});
