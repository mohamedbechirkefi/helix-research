// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * AI plan benchmark harness (P3.1.3).
 *
 *   node scripts/ai-benchmark/run.ts --provider mock|deterministic|ollama [--model qwen3.5:4b]
 *        [--reps0 3] [--reps07 1] [--limit N] [--only S01,F01] [--schema generic|grounded] [--tag x]
 *
 * Each item runs `reps0` times at temperature 0 (seeds 0..) and `reps07` times at 0.7. Every raw
 * output is stored (raw.jsonl), with its validation issues and score; summary.json aggregates.
 */
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  contextForItem,
  deterministicPlan,
  DeterministicProvider,
  OllamaProvider,
  scoreItem,
  type BenchmarkItem,
  type PlanProvider,
  type PlanRequest,
  type ProviderOutput,
} from "@helix/ai-planning";
import { loadHbbContext, loadQuestions, runnerRssKiB, REPO_ROOT, RUNS_DIR } from "./lib.ts";
import { summarise, type Row } from "./summarise.ts";

const args = process.argv.slice(2);
const opt = (k: string, d?: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const providerKind = opt("provider", "mock")!;
const model = opt("model", "");
const reps0 = Number(opt("reps0", "3"));
const reps07 = Number(opt("reps07", "1"));
const limit = Number(opt("limit", "0"));
const only = opt("only")?.split(",");
const schemaMode = (opt("schema", "generic") as "generic" | "grounded");
const tag = opt("tag", "");
const baseUrl = opt("base-url", "http://127.0.0.1:11434")!;
const questionsFile = opt("questions");

/** Dry-run mock: answers with the deterministic plan, but injects known failure modes so the scorer is exercised. */
class MockProvider implements PlanProvider {
  readonly id = "mock";
  readonly kind = "mock" as const;
  readonly label = "Mock model (dry run)";
  readonly local = true as const;
  private n = 0;
  async detect() {
    return { available: true, reason: "mock" };
  }
  async plan(req: PlanRequest): Promise<ProviderOutput> {
    this.n++;
    const { plan } = deterministicPlan(req.query, req.context);
    let raw = JSON.stringify(plan);
    if (this.n % 7 === 0) raw = raw.slice(0, 20); // truncated JSON
    else if (this.n % 11 === 0) raw = JSON.stringify({ ...plan, script: "alert(1)" }); // unknown field
    else if (this.n % 5 === 0 && plan.outcome === "plan") raw = JSON.stringify({ ...plan, actions: [{ type: "loadStructure", structureId: "1BZO", assembly: "1" }, ...plan.actions] }); // the 1BZO case
    else if (this.n % 13 === 0) raw = JSON.stringify({ ...plan, actions: [{ type: "runScript", code: "x" }] }); // unknown action
    return { raw, timings: { firstTokenMs: 1, totalMs: 2 } };
  }
}

async function ollamaMeta(m: string) {
  const v = (await (await fetch(`${baseUrl}/api/version`)).json()) as { version: string };
  const show = (await (await fetch(`${baseUrl}/api/show`, { method: "POST", body: JSON.stringify({ model: m }) })).json()) as Record<string, unknown>;
  const tags = (await (await fetch(`${baseUrl}/api/tags`)).json()) as { models: { name: string; digest: string; size: number; details: Record<string, unknown> }[] };
  const want = m.includes(":") ? m : `${m}:latest`;
  const t = tags.models.find((x) => x.name === want);
  const licence = typeof show.license === "string" ? show.license : "";
  return {
    ollamaVersion: v.version,
    model: want,
    digest: t?.digest ?? null,
    sizeBytes: t?.size ?? null,
    details: show.details ?? null,
    capabilities: (show.capabilities as string[] | undefined) ?? [],
    licenceFirstLine: licence.split("\n").find((l) => l.trim().length > 0)?.trim().slice(0, 200) ?? null,
    licenceSha256: licence ? createHash("sha256").update(licence).digest("hex") : null,
  };
}

async function ollamaPs() {
  try {
    return ((await (await fetch(`${baseUrl}/api/ps`)).json()) as { models: { name: string; size: number; size_vram: number; context_length?: number }[] }).models;
  } catch {
    return [];
  }
}

const ctxBase = loadHbbContext();
let items: BenchmarkItem[] = loadQuestions(questionsFile ? join(REPO_ROOT, "research", "benchmark", questionsFile) : undefined);
if (only) items = items.filter((i) => only.includes(i.id));
if (limit > 0) items = items.slice(0, limit);

let provider: PlanProvider;
let meta: Record<string, unknown> = {};
if (providerKind === "mock") provider = new MockProvider();
else if (providerKind === "deterministic") provider = new DeterministicProvider();
else if (providerKind === "ollama") {
  if (!model) throw new Error("--model is required for ollama");
  meta = await ollamaMeta(model);
  const think = (meta.capabilities as string[]).includes("thinking") ? false : undefined;
  provider = new OllamaProvider({ model, baseUrl, ...(think !== undefined ? { think } : {}), numCtx: 8192, keepAlive: "15m" });
  meta.think = think ?? "not sent (model has no thinking capability)";
  meta.numCtx = 8192;
  meta.numPredict = 1024;
  meta.timeoutMs = 180000;
} else throw new Error(`unknown provider ${providerKind}`);

const date = new Date().toISOString().slice(0, 10);
const slug = `${date}-${(model || providerKind).replace(/[^A-Za-z0-9.]+/g, "-")}${schemaMode === "grounded" ? "-grounded" : ""}${tag ? `-${tag}` : ""}`;
const outDir = join(RUNS_DIR, slug);
mkdirSync(outDir, { recursive: true });
const rawPath = join(outDir, "raw.jsonl");
writeFileSync(rawPath, "");

// Memory sampling (Ollama runner processes), every 500 ms.
let peakRssKiB = 0;
let rssSamples = 0;
const sampler =
  providerKind === "ollama"
    ? setInterval(() => {
        try {
          const r = runnerRssKiB();
          rssSamples++;
          if (r.rssKiB > peakRssKiB) peakRssKiB = r.rssKiB;
        } catch {
          /* ignore */
        }
      }, 500)
    : null;

// Warm-up (unscored): records the cold load.
let warmup: Record<string, unknown> | null = null;
if (providerKind === "ollama") {
  const it = items[0]!;
  const t = Date.now();
  const o = await provider.plan({ query: it.query, context: contextForItem(ctxBase, it), requestId: "warmup", temperature: 0, schemaMode });
  warmup = { wallMs: Date.now() - t, loadMs: o.usage?.loadMs ?? null, firstTokenMs: o.timings.firstTokenMs };
  console.log("warm-up", JSON.stringify(warmup));
}
const psAfterWarmup = providerKind === "ollama" ? await ollamaPs() : [];

const rows: Row[] = [];
const started = Date.now();
for (const item of items) {
  const ctx = contextForItem(ctxBase, item);
  const plan: { rep: number; temperature: number; seed: number }[] = [
    ...Array.from({ length: reps0 }, (_, i) => ({ rep: i, temperature: 0, seed: i })),
    ...Array.from({ length: reps07 }, (_, i) => ({ rep: reps0 + i, temperature: 0.7, seed: 100 + i })),
  ];
  for (const p of plan) {
    let out: ProviderOutput | null = null;
    let error: string | null = null;
    try {
      out = await provider.plan({ query: item.query, context: ctx, requestId: `${item.id}-${p.rep}`, temperature: p.temperature, seed: p.seed, schemaMode });
    } catch (e) {
      error = (e as Error).message;
      const partial = (e as { partial?: string }).partial;
      if (partial) error += ` | partial(${partial.length} chars): ${partial.slice(0, 300)} ... ${partial.slice(-200)}`;
    }
    const raw = out?.raw ?? "";
    const score = out ? scoreItem(item, raw, ctx).score : null;
    const row: Row = {
      item: item.id,
      category: item.category,
      lang: item.lang,
      rep: p.rep,
      temperature: p.temperature,
      seed: p.seed,
      raw,
      error,
      firstTokenMs: out?.timings.firstTokenMs ?? null,
      totalMs: out?.timings.totalMs ?? null,
      usage: out?.usage ?? null,
      score,
    };
    rows.push(row);
    appendFileSync(rawPath, JSON.stringify(row) + "\n");
    process.stdout.write(`${item.id}#${p.rep}@${p.temperature} ${score ? (score.correctAndValid ? "OK " : score.valid ? "val" : "BAD") : "ERR"} ${Math.round(out?.timings.totalMs ?? 0)}ms ${score?.issues.slice(0, 2).join(" ") ?? error ?? ""}\n`);
  }
}
if (sampler) clearInterval(sampler);
const psEnd = providerKind === "ollama" ? await ollamaPs() : [];

const summary = summarise(rows, items, {
  run: slug,
  provider: providerKind,
  meta,
  schemaMode,
  questions: questionsFile ?? "questions.jsonl",
  warmup,
  wallClockS: Math.round((Date.now() - started) / 1000),
  reps: { temperature0: reps0, temperature07: reps07 },
  memory: {
    peakRunnerRssMiB: providerKind === "ollama" ? Math.round(peakRssKiB / 1024) : null,
    rssSamples,
    ollamaPsAfterWarmup: psAfterWarmup,
    ollamaPsEnd: psEnd,
    note: "Runner RSS from ps; on Apple unified memory, GPU buffers may not be counted in RSS, so /api/ps size and size_vram are reported too.",
  },
});
writeFileSync(join(outDir, "summary.json"), JSON.stringify(summary, null, 1) + "\n");
console.log(`\nwrote ${outDir}`);
console.log(JSON.stringify({ t0: { ...summary.temperature0, byCategory: undefined }, t07: summary.temperature07 }, null, 0));
