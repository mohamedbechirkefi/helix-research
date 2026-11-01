// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * WebLLM provider (web build only). The engine is injected, so this package does not import
 * @mlc-ai/web-llm and stays testable: the app passes `() => CreateMLCEngine(modelId, ...)`.
 * Capability detection requires WebGPU (navigator.gpu with an adapter). It is never offered in
 * the Tauri shell on macOS 15 (no WebGPU in WKWebView, measured in P1.5.2), and the model is
 * downloaded only after the user opts in.
 */
import { buildMessages } from "../prompt.ts";
import { now, ProviderError, type PlanProvider, type PlanRequest, type ProviderCapability, type ProviderOutput } from "./types.ts";
import { schemaFor } from "./ollama.ts";

/** The subset of WebLLM's OpenAI-style engine used here. */
export interface WebLLMEngineLike {
  chat: {
    completions: {
      create(req: Record<string, unknown>): Promise<AsyncIterable<{ choices: { delta?: { content?: string | null } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } | null }>>;
    };
  };
  interruptGenerate?(): void;
}

export interface GpuLike {
  requestAdapter(): Promise<unknown | null>;
}

export interface WebLLMConfig {
  modelId: string;
  /** Approximate download, stated to the user before opting in. */
  downloadBytes?: number;
  engineFactory: () => Promise<WebLLMEngineLike>;
  /** Defaults to globalThis.navigator.gpu. */
  gpu?: () => GpuLike | undefined;
  /** The user has opted in to the download. */
  optedIn?: () => boolean;
  /** Passed as `extra_body`, e.g. { enable_thinking: false } for Qwen3 and Qwen3.5. */
  extraBody?: Record<string, unknown>;
}

/**
 * Qwen3 and Qwen3.5 chat templates emit an empty `<think>...</think>` block as content even with
 * enable_thinking false (measured in P3.2.2). It is removed deterministically before validation.
 */
export function stripThinkBlock(raw: string): string {
  return raw.replace(/^\s*<think>[\s\S]*?<\/think>\s*/, "");
}

export class WebLLMProvider implements PlanProvider {
  readonly id: string;
  readonly kind = "webllm" as const;
  readonly label: string;
  readonly local = true as const;
  private engine: Promise<WebLLMEngineLike> | null = null;
  private readonly cfg: WebLLMConfig;
  constructor(cfg: WebLLMConfig) {
    this.cfg = cfg;
    this.id = `webllm:${cfg.modelId}`;
    this.label = `In-browser model (${cfg.modelId})`;
  }

  async detect(): Promise<ProviderCapability> {
    const gpu = this.cfg.gpu ? this.cfg.gpu() : (globalThis as { navigator?: { gpu?: GpuLike } }).navigator?.gpu;
    if (!gpu) return { available: false, reason: "WebGPU is not available in this browser or webview" };
    let adapter: unknown = null;
    try {
      adapter = await gpu.requestAdapter();
    } catch {
      adapter = null;
    }
    if (!adapter) return { available: false, reason: "WebGPU is present but no GPU adapter was granted" };
    if (this.cfg.optedIn && !this.cfg.optedIn()) {
      return { available: false, reason: `WebGPU available; the model download${this.cfg.downloadBytes ? ` (about ${Math.round(this.cfg.downloadBytes / 1e6)} MB)` : ""} needs the user's opt-in`, details: { needsOptIn: true } };
    }
    return { available: true, reason: `WebGPU adapter available; model ${this.cfg.modelId}` };
  }

  async plan(req: PlanRequest): Promise<ProviderOutput> {
    if (!this.engine) this.engine = this.cfg.engineFactory();
    const engine = await this.engine;
    const t0 = now();
    let first: number | null = null;
    let raw = "";
    let usage: ProviderOutput["usage"] = {};
    const onAbort = () => engine.interruptGenerate?.();
    req.signal?.addEventListener("abort", onAbort);
    try {
      const stream = await engine.chat.completions.create({
        messages: buildMessages(req.query, req.context),
        temperature: req.temperature ?? 0,
        ...(req.seed !== undefined ? { seed: req.seed } : {}),
        stream: true,
        stream_options: { include_usage: true },
        response_format: { type: "json_object", schema: JSON.stringify(schemaFor(req)) },
        ...(this.cfg.extraBody ? { extra_body: this.cfg.extraBody } : {}),
      });
      for await (const chunk of stream) {
        const c = chunk.choices[0]?.delta?.content ?? "";
        if (c && first === null) first = now() - t0;
        raw += c;
        if (chunk.usage) {
          const u: NonNullable<ProviderOutput["usage"]> = {};
          if (chunk.usage.prompt_tokens !== undefined) u.promptTokens = chunk.usage.prompt_tokens;
          if (chunk.usage.completion_tokens !== undefined) u.completionTokens = chunk.usage.completion_tokens;
          usage = u;
        }
      }
    } catch (e) {
      if (req.signal?.aborted) throw new ProviderError(this.id, "aborted", "cancelled");
      throw new ProviderError(this.id, "protocol", (e as Error).message);
    } finally {
      req.signal?.removeEventListener("abort", onAbort);
    }
    if (req.signal?.aborted) throw new ProviderError(this.id, "aborted", "cancelled");
    return { raw: stripThinkBlock(raw), timings: { firstTokenMs: first, totalMs: now() - t0 }, usage, meta: { rawLength: raw.length } };
  }
}
