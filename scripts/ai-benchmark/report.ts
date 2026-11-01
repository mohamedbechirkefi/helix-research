// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Prints markdown tables from research/benchmark/runs/<run>/summary.json.
 *   node scripts/ai-benchmark/report.ts [run-dir-name ...]
 * Without arguments, every run directory is included.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { RUNS_DIR } from "./lib.ts";

const names = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(RUNS_DIR).filter((d) => existsSync(join(RUNS_DIR, d, "summary.json"))).sort();
type S = Record<string, any>;
const runs: S[] = names.map((n) => JSON.parse(readFileSync(join(RUNS_DIR, n, "summary.json"), "utf8")));

const f = (x: number | null | undefined, d = 0) => (x === null || x === undefined ? "n/a" : x.toFixed(d));
const frac = (o: { correct?: number; resisted?: number; count?: number; n: number }) => `${o.correct ?? o.resisted ?? o.count}/${o.n}`;
const label = (r: S) => (r.meta?.model ? `${r.meta.model}${r.schemaMode === "grounded" ? " (grounded schema)" : ""}` : r.provider) + (r.questions && r.questions !== "questions.jsonl" ? ` [${r.questions}]` : "");

console.log("| Run | n | Schema-valid % | Fully valid % | Action correct % | Correct and valid % | Groundedness violations (outputs) | Refusal | Clarify | Injection resisted | Follow-up | False refusals | Latency first token p50/p95 (s) | Total p50/p95 (s) | Decode tok/s p50 | Peak runner RSS (MiB) | /api/ps size (MiB) |");
console.log("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const r of runs) {
  const t = r.temperature0;
  const ps = r.memory?.ollamaPsEnd?.[0] ?? r.memory?.ollamaPsAfterWarmup?.[0];
  console.log(
    `| ${label(r)} | ${t.n} | ${f(t.schemaValidPct, 1)} | ${f(t.validPct, 1)} | ${f(t.actionCorrectPct, 1)} | ${f(t.correctAndValidPct, 1)} | ${t.groundednessViolations} (${t.outputsWithViolations}) | ${frac(t.refusal)} | ${frac(t.clarify)} | ${frac(t.injection)} | ${frac(t.followUp)} | ${frac(t.falseRefusals)} | ${f(t.latencyMs.firstToken.p50 / 1000, 2)} / ${f(t.latencyMs.firstToken.p95 / 1000, 2)} | ${f(t.latencyMs.total.p50 / 1000, 2)} / ${f(t.latencyMs.total.p95 / 1000, 2)} | ${f(t.decodeTokensPerSecP50, 1)} | ${f(r.memory?.peakRunnerRssMiB)} | ${ps ? `${Math.round(ps.size / 1048576)} (VRAM ${Math.round(ps.size_vram / 1048576)})` : "n/a"} |`,
  );
}

console.log("\n| Run | Repeatability: identical outputs over 3 runs at T=0 | Same verdict | T=0.7: schema-valid % | T=0.7: correct and valid % | T=0.7: groundedness violations | Errors (T=0) | Warm-up (cold load) s | Wall clock min |");
console.log("|---|---|---|---|---|---|---|---|---|");
for (const r of runs) {
  const t = r.temperature0;
  const h = r.temperature07;
  console.log(
    `| ${label(r)} | ${t.repeatability.identicalOutputs}/${t.repeatability.items} | ${t.repeatability.sameVerdict}/${t.repeatability.items} | ${h ? f(h.schemaValidPct, 1) : "n/a"} | ${h ? f(h.correctAndValidPct, 1) : "n/a"} | ${h ? h.groundednessViolations : "n/a"} | ${t.errors} | ${r.warmup ? f(r.warmup.wallMs / 1000, 1) : "n/a"} | ${f(r.wallClockS / 60, 1)} |`,
  );
}

console.log("\nCorrect and valid % by category (T=0):\n");
const cats = ["supported", "paraphrase", "followup", "unsupported", "ambiguous", "injection"];
console.log(`| Run | ${cats.join(" | ")} |`);
console.log(`|---|${cats.map(() => "---").join("|")}|`);
for (const r of runs) {
  const b = r.temperature0.byCategory ?? {};
  console.log(`| ${label(r)} | ${cats.map((c) => (b[c] ? `${f(b[c].correctAndValidPct, 0)} (n=${b[c].n})` : "n/a")).join(" | ")} |`);
}

console.log("\nModels:\n");
console.log("| Model | Digest | Size (GB) | Params / quant | Capabilities | Ollama | think | Licence (first line of the model's licence file) |");
console.log("|---|---|---|---|---|---|---|---|");
for (const r of runs.filter((x) => x.meta?.model)) {
  const m = r.meta;
  console.log(`| ${m.model} | ${m.digest?.slice(0, 12)} | ${f(m.sizeBytes / 1e9, 2)} | ${m.details?.parameter_size ?? "?"} / ${m.details?.quantization_level ?? "?"} | ${m.capabilities.join(", ")} | ${m.ollamaVersion} | ${m.think} | ${m.licenceFirstLine ?? "none in model"} |`);
}
