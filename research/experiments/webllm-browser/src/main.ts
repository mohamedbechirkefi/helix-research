// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * P3.2.2: a tiny page that loads a WebLLM model and generates schema-constrained plans. It is
 * driven by scripts/measure.mjs (puppeteer-core); all prompts and schemas come from
 * @helix/ai-planning on the Node side, so the page only runs the engine.
 */
import { CreateMLCEngine, CreateWebWorkerMLCEngine, prebuiltAppConfig, type MLCEngineInterface } from "@mlc-ai/web-llm";

type Msg = { role: "system" | "user" | "assistant"; content: string };
const status = (s: string) => {
  document.getElementById("status")!.textContent = s;
};

let engine: MLCEngineInterface | null = null;

const api = {
  ready: true,
  async gpuInfo() {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<any> } }).gpu;
    if (!gpu) return { webgpu: false };
    const a = await gpu.requestAdapter();
    if (!a) return { webgpu: true, adapter: false };
    const info = a.info ?? {};
    return {
      webgpu: true,
      adapter: true,
      vendor: info.vendor,
      architecture: info.architecture,
      description: info.description,
      maxBufferSize: a.limits.maxBufferSize,
      maxStorageBufferBindingSize: a.limits.maxStorageBufferBindingSize,
      shaderF16: a.features.has("shader-f16"),
    };
  },
  modelRecord(id: string) {
    return prebuiltAppConfig.model_list.find((m) => m.model_id === id) ?? null;
  },
  async load(modelId: string, useWorker: boolean) {
    const t0 = performance.now();
    const progress: { t: number; p: number; text: string }[] = [];
    const cb = (r: { progress: number; text: string }) => {
      progress.push({ t: Math.round(performance.now() - t0), p: r.progress, text: r.text.slice(0, 140) });
      status(r.text.slice(0, 140));
    };
    engine = useWorker
      ? await CreateWebWorkerMLCEngine(new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }), modelId, { initProgressCallback: cb })
      : await CreateMLCEngine(modelId, { initProgressCallback: cb });
    status(`loaded ${modelId}`);
    return { loadMs: Math.round(performance.now() - t0), progressEvents: progress.length, progressTail: progress.slice(-4) };
  },
  async gen(messages: Msg[], schema: string | null, temperature: number, extraBody: Record<string, unknown> | null, maxTokens: number) {
    if (!engine) throw new Error("no engine");
    const t0 = performance.now();
    let first: number | null = null;
    let raw = "";
    let usage: unknown = null;
    const stream = await engine.chat.completions.create({
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
      stream_options: { include_usage: true },
      ...(schema ? { response_format: { type: "json_object", schema } } : {}),
      ...(extraBody ? { extra_body: extraBody } : {}),
    } as never);
    for await (const ch of stream as AsyncIterable<{ choices: { delta?: { content?: string | null }; finish_reason?: string | null }[]; usage?: unknown }>) {
      const c = ch.choices[0]?.delta?.content ?? "";
      if (c && first === null) first = performance.now() - t0;
      raw += c;
      if (ch.usage) usage = ch.usage;
    }
    return { raw, firstTokenMs: first, totalMs: performance.now() - t0, usage };
  },
  async cacheBytes() {
    let bytes = 0;
    let entries = 0;
    const perCache: Record<string, number> = {};
    for (const name of await caches.keys()) {
      const c = await caches.open(name);
      let b = 0;
      for (const req of await c.keys()) {
        const res = await c.match(req);
        if (res) b += (await res.blob()).size;
        entries++;
      }
      perCache[name] = b;
      bytes += b;
    }
    return { bytes, entries, perCache };
  },
  async unload() {
    await engine?.unload();
    engine = null;
  },
  addFrame(src: string) {
    return new Promise<void>((resolve) => {
      const f = document.createElement("iframe");
      f.src = src;
      f.onload = () => resolve();
      document.getElementById("frame-slot")!.appendChild(f);
    });
  },
};
(window as unknown as { __w: typeof api }).__w = api;
