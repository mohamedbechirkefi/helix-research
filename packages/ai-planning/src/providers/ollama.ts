// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Ollama provider: a local server only (http://127.0.0.1:11434 by default). Uses /api/chat with
 * the plan JSON Schema in `format` (constrained decoding) and streams to time the first token.
 * Works with any `fetch` (browser, Tauri webview, Node); the desktop shell should route it
 * through a scoped Rust command or HTTP plugin (docs/rendering-integration-decisions.md §5).
 * A public website cannot reach a visitor's Ollama (403 from its CORS check), so this provider
 * is never offered to web visitors.
 */
import { buildMessages } from "../prompt.ts";
import { groundedPlanJsonSchema, planJsonSchema } from "../schema.ts";
import { now, ProviderError, type PlanProvider, type PlanRequest, type ProviderCapability, type ProviderOutput } from "./types.ts";
import type { PlanningContext } from "../context.ts";

export interface OllamaConfig {
  model: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  numCtx?: number;
  /** Set false for thinking models (plans are generated without thinking). Omitted for models without the capability. */
  think?: boolean;
  keepAlive?: string;
  timeoutMs?: number;
  /** Cap on generated tokens (Ollama num_predict). Constrained JSON can otherwise run on in whitespace or repetition. */
  numPredict?: number;
}

export function contextIdLists(ctx: PlanningContext) {
  return {
    genes: ctx.genes.map((g) => g.id),
    proteins: ctx.proteins.map((p) => p.id),
    variants: ctx.variants.map((v) => v.id),
    structures: ctx.structures.map((s) => s.id),
    assemblies: [...new Set(ctx.structures.flatMap((s) => s.assemblies.map((a) => a.id)))],
    features: ctx.features.map((f) => f.id),
    evidence: ctx.evidence.map((e) => e.id),
  };
}

export function schemaFor(req: PlanRequest): Record<string, unknown> {
  return req.schemaMode === "grounded" ? groundedPlanJsonSchema(contextIdLists(req.context)) : planJsonSchema();
}

export class OllamaProvider implements PlanProvider {
  readonly id: string;
  readonly kind = "ollama" as const;
  readonly label: string;
  readonly local = true as const;
  private readonly cfg: Required<Omit<OllamaConfig, "think" | "fetch">> & { think?: boolean; fetch: typeof fetch };

  constructor(cfg: OllamaConfig) {
    this.cfg = {
      baseUrl: "http://127.0.0.1:11434",
      numCtx: 8192,
      keepAlive: "10m",
      timeoutMs: 180_000,
      numPredict: 1024,
      ...cfg,
      fetch: cfg.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a)),
    };
    this.id = `ollama:${cfg.model}`;
    this.label = `Local Ollama (${cfg.model})`;
  }

  async detect(): Promise<ProviderCapability> {
    try {
      const v = await this.cfg.fetch(`${this.cfg.baseUrl}/api/version`);
      if (!v.ok) return { available: false, reason: `Ollama answered HTTP ${v.status}` };
      const version = ((await v.json()) as { version?: string }).version ?? "unknown";
      const t = await this.cfg.fetch(`${this.cfg.baseUrl}/api/tags`);
      const tags = ((await t.json()) as { models?: { name: string; digest?: string }[] }).models ?? [];
      const want = this.cfg.model.includes(":") ? this.cfg.model : `${this.cfg.model}:latest`;
      const m = tags.find((x) => x.name === want);
      if (!m) return { available: false, reason: `Ollama ${version} is running but model ${this.cfg.model} is not installed (ollama pull ${this.cfg.model})`, details: { version } };
      return { available: true, reason: `local Ollama ${version} with ${want}`, details: { version, digest: m.digest } };
    } catch (e) {
      return { available: false, reason: `no local Ollama server reachable at ${this.cfg.baseUrl} (${(e as Error).message})` };
    }
  }

  async plan(req: PlanRequest): Promise<ProviderOutput> {
    const ctl = new AbortController();
    const onAbort = () => ctl.abort();
    req.signal?.addEventListener("abort", onAbort);
    const timer = setTimeout(() => ctl.abort(), this.cfg.timeoutMs);
    const body: Record<string, unknown> = {
      model: this.cfg.model,
      messages: buildMessages(req.query, req.context),
      format: schemaFor(req),
      stream: true,
      keep_alive: this.cfg.keepAlive,
      options: { temperature: req.temperature ?? 0, num_ctx: this.cfg.numCtx, num_predict: this.cfg.numPredict, ...(req.seed !== undefined ? { seed: req.seed } : {}) },
    };
    if (this.cfg.think !== undefined) body.think = this.cfg.think;
    const t0 = now();
    let first: number | null = null;
    let raw = "";
    let final: Record<string, unknown> = {};
    try {
      const res = await this.cfg.fetch(`${this.cfg.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: ctl.signal,
      });
      if (!res.ok || !res.body) throw new ProviderError(this.id, "http", `Ollama HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const chunk = JSON.parse(line) as { message?: { content?: string }; done?: boolean; error?: string };
          if (chunk.error) throw new ProviderError(this.id, "protocol", chunk.error);
          const c = chunk.message?.content ?? "";
          if (c.length > 0 && first === null) first = now() - t0;
          raw += c;
          if (chunk.done) final = chunk as Record<string, unknown>;
        }
      }
    } catch (e) {
      if (e instanceof ProviderError) throw e;
      if (ctl.signal.aborted) {
        const err = new ProviderError(this.id, req.signal?.aborted ? "aborted" : "timeout", req.signal?.aborted ? "cancelled" : `timed out after ${this.cfg.timeoutMs} ms`);
        err.partial = raw;
        throw err;
      }
      throw new ProviderError(this.id, "unavailable", (e as Error).message);
    } finally {
      clearTimeout(timer);
      req.signal?.removeEventListener("abort", onAbort);
    }
    const ns = (k: string) => (typeof final[k] === "number" ? (final[k] as number) / 1e6 : undefined);
    const usage: NonNullable<ProviderOutput["usage"]> = {};
    if (typeof final.prompt_eval_count === "number") usage.promptTokens = final.prompt_eval_count;
    if (typeof final.eval_count === "number") usage.completionTokens = final.eval_count;
    const loadMs = ns("load_duration");
    const evalMs = ns("eval_duration");
    const promptEvalMs = ns("prompt_eval_duration");
    if (loadMs !== undefined) usage.loadMs = loadMs;
    if (evalMs !== undefined) usage.evalMs = evalMs;
    if (promptEvalMs !== undefined) usage.promptEvalMs = promptEvalMs;
    return { raw, timings: { firstTokenMs: first, totalMs: now() - t0 }, usage, meta: { doneReason: final.done_reason ?? null } };
  }
}
