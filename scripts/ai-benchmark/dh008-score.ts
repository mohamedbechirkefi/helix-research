// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * D-H008 scoring of stored benchmark runs (no model call).
 *
 *   node scripts/ai-benchmark/dh008-score.ts --run <run-dir-name> --mode app-v3|app-v4 [--questions file.jsonl]
 *
 * Scores the temperature-0 outputs of a run in the context it was run in (`--mode`, see lib.ts) and
 * writes `dh008-score.json` into the run directory:
 * - validation pass and fallback (the plan the director keeps or rejects), one-world first answers;
 * - correct and valid against the ORIGINAL oracles and against the D-H008 AMENDED oracles
 *   (research/benchmark/amendments-dh008.jsonl; the original oracles are never edited);
 * - routing correctness against the routing oracles (an item's own `expected.world`, else
 *   research/benchmark/routing-dh008-annotations.jsonl), for the model's own output and for the
 *   plan the app would execute (the model's plan if valid, else the rule-based fallback);
 * - refusals, false refusals, injections resisted, and planning time (median and p95).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deterministicPlan, percentile, planWorlds, routingCorrect, scoreItem, validatePlan, type BenchmarkItem, type ItemScore, type Plan } from "@helix/ai-planning";
import { benchmarkContext, loadHbbContext, loadQuestions, REPO_ROOT, RUNS_DIR, type ContextMode } from "./lib.ts";

const args = process.argv.slice(2);
const opt = (k: string, d?: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const run = opt("run");
const mode = opt("mode", "app-v4") as ContextMode;
if (!run) throw new Error("--run is required");
const BENCH = join(REPO_ROOT, "research", "benchmark");
const runDir = join(RUNS_DIR, run);
const summary = JSON.parse(readFileSync(join(runDir, "summary.json"), "utf8")) as { questions?: string };
const qfile = opt("questions", summary.questions ?? "questions.jsonl")!;
const items = loadQuestions(join(BENCH, qfile));
const jsonl = <T>(f: string): T[] =>
  readFileSync(join(BENCH, f), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("//"))
    .map((l) => JSON.parse(l) as T);
type Annotation = { id: string; set: string; world: "dna" | "protein" | "any" | "none"; why: string };
type Amendment = { id: string; set: string; amended: BenchmarkItem["expected"] };
const annotations = jsonl<Annotation>("routing-dh008-annotations.jsonl").filter((a) => a.set === qfile);
const amendments = jsonl<Amendment>("amendments-dh008.jsonl").filter((a) => a.set === qfile);

const base = loadHbbContext();
const rows = readFileSync(join(runDir, "raw.jsonl"), "utf8")
  .split("\n")
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l) as { item: string; temperature: number; raw: string; error: string | null; totalMs: number | null; usage: { completionTokens?: number } | null })
  .filter((r) => r.temperature === 0);

type Out = {
  id: string;
  answer: string | null;
  currentWorld: string | null;
  worldOracle: string | null;
  worlds: string[] | null;
  valid: boolean;
  issues: string[];
  fallbackWorlds: string[] | null;
  routingModel: boolean | null;
  routingExecuted: boolean | null;
  original: ItemScore | null;
  amended: ItemScore | null;
  amendedItem: boolean;
  totalMs: number | null;
  tokens: number | null;
};
const out: Out[] = [];
for (const r of rows) {
  const item = items.find((i) => i.id === r.item);
  if (!item) throw new Error(`unknown item ${r.item}`);
  const ctx = benchmarkContext(base, item, mode);
  const am = amendments.find((a) => a.id === item.id);
  const amendedItem: BenchmarkItem = am ? { ...item, expected: am.amended } : item;
  const worldOracle = item.expected.world ?? annotations.find((a) => a.id === item.id)?.world ?? null;
  const orig = r.error ? null : scoreItem(item, r.raw, ctx);
  const amd = r.error ? null : scoreItem(amendedItem, r.raw, ctx);
  const plan = orig?.validation.plan ?? null;
  // What the app would execute: the model's plan if valid, else the rule-based plan (or nothing if that is invalid too).
  let executed: Plan | null = orig?.validation.ok ? plan : null;
  let fallbackWorlds: string[] | null = null;
  if (!orig?.validation.ok) {
    const fb = deterministicPlan(item.query, ctx).plan;
    executed = validatePlan(fb, ctx, { query: item.query }).ok ? fb : null;
    fallbackWorlds = executed ? planWorlds(executed) : null;
  }
  out.push({
    id: item.id,
    answer: ctx.answer ?? null,
    currentWorld: ctx.currentWorld ?? null,
    worldOracle,
    worlds: plan ? planWorlds(plan) : null,
    valid: orig?.validation.ok ?? false,
    issues: orig?.score.issues ?? [r.error ?? "no output"],
    fallbackWorlds,
    routingModel: routingCorrect(worldOracle as never, orig?.validation.schemaValid ? plan : null, ctx),
    routingExecuted: routingCorrect(worldOracle as never, executed, ctx),
    original: orig?.score ?? null,
    amended: amd?.score ?? null,
    amendedItem: !!am,
    totalMs: r.totalMs,
    tokens: r.usage?.completionTokens ?? null,
  });
}

const n = out.length;
const cnt = (f: (o: Out) => boolean) => out.filter(f).length;
const frac = (a: number, b: number) => ({ count: a, n: b, pct: b === 0 ? null : Math.round((1000 * a) / b) / 10 });
const tri = (f: (o: Out) => boolean | null) => {
  const xs = out.map(f).filter((x): x is boolean => x !== null);
  return frac(xs.filter(Boolean).length, xs.length);
};
const scores = (k: "original" | "amended") => ({
  correctAndValid: tri((o) => o[k]?.correctAndValid ?? false),
  falseRefusals: tri((o) => o[k]?.falseRefusal ?? null),
  refusalsCorrect: tri((o) => o[k]?.refusalCorrect ?? null),
  clarifyCorrect: tri((o) => o[k]?.clarifyCorrect ?? null),
  injectionResisted: tri((o) => o[k]?.injectionResisted ?? null),
});
const times = out.map((o) => o.totalMs).filter((x): x is number => typeof x === "number");
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? null : s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
};
const firstValid = out.filter((o) => o.answer === "first" && o.worlds !== null);
const result = {
  run,
  mode,
  questions: qfile,
  scoredAt: new Date().toISOString(),
  n,
  validationPass: frac(cnt((o) => o.valid), n),
  fallback: frac(cnt((o) => !o.valid), n),
  rejectedFor: {
    worldSwitch: cnt((o) => o.issues.some((i) => i.startsWith("world-switch"))),
    worldCue: cnt((o) => o.issues.some((i) => i.startsWith("world-cue"))),
  },
  oneWorldFirstAnswers: frac(firstValid.filter((o) => o.worlds!.length <= 1).length, firstValid.length),
  routingModel: tri((o) => o.routingModel),
  routingExecuted: tri((o) => o.routingExecuted),
  original: scores("original"),
  amended: scores("amended"),
  amendedItems: out.filter((o) => o.amendedItem).map((o) => o.id),
  totalMs: { median: median(times), p95: percentile(times, 95) },
  tokensMedian: median(out.map((o) => o.tokens).filter((x): x is number => typeof x === "number")),
  items: out.map((o) => ({
    id: o.id,
    answer: o.answer,
    currentWorld: o.currentWorld,
    worldOracle: o.worldOracle,
    worlds: o.worlds,
    valid: o.valid,
    issues: o.issues,
    fallbackWorlds: o.fallbackWorlds,
    routingModel: o.routingModel,
    routingExecuted: o.routingExecuted,
    correctAndValidOriginal: o.original?.correctAndValid ?? false,
    correctAndValidAmended: o.amended?.correctAndValid ?? false,
    totalMs: o.totalMs,
  })),
};
writeFileSync(join(runDir, "dh008-score.json"), JSON.stringify(result, null, 1) + "\n");
const { items: _i, ...head } = result;
console.log(JSON.stringify(head, null, 1));
