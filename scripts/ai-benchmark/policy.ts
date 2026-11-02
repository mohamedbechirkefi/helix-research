// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Scores the director's fallback policy from stored outputs, without calling a model:
 *   model plan if it passes validation, otherwise the deterministic plan.
 * Also scores "model only" (an invalid plan counts as a failure) for comparison.
 *   node scripts/ai-benchmark/policy.ts <run-dir-name> [...]
 * Temperature-0 rows only.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contextForItem, deterministicPlan, scoreItem } from "@helix/ai-planning";
import { loadHbbContext, loadQuestions, REPO_ROOT, RUNS_DIR } from "./lib.ts";
import type { Row } from "./summarise.ts";

const ctxBase = loadHbbContext();
console.log("| Run | n (T=0) | Model only: correct and valid % | Model plan rejected % | Director policy (model, else fallback): correct % | Of which from the fallback |");
console.log("|---|---|---|---|---|---|");
for (const name of process.argv.slice(2)) {
  const dir = join(RUNS_DIR, name);
  const summary = JSON.parse(readFileSync(join(dir, "summary.json"), "utf8")) as { questions?: string; meta?: { model?: string }; schemaMode?: string };
  const items = loadQuestions(join(REPO_ROOT, "research", "benchmark", summary.questions ?? "questions.jsonl"));
  const rows = readFileSync(join(dir, "raw.jsonl"), "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Row)
    .filter((r) => r.temperature === 0);
  let modelOk = 0;
  let rejected = 0;
  let policyOk = 0;
  let fromFallback = 0;
  for (const r of rows) {
    const it = items.find((i) => i.id === r.item)!;
    const ctx = contextForItem(ctxBase, it);
    const s = scoreItem(it, r.raw, ctx).score;
    if (s.correctAndValid) modelOk++;
    if (s.valid) {
      if (s.correctAndValid) policyOk++;
    } else {
      rejected++;
      const fb = scoreItem(it, JSON.stringify(deterministicPlan(it.query, ctx).plan), ctx).score;
      if (fb.correctAndValid) {
        policyOk++;
        fromFallback++;
      }
    }
  }
  const pct = (a: number) => ((100 * a) / rows.length).toFixed(1);
  const label = `${summary.meta?.model ?? name}${summary.schemaMode === "grounded" ? " (grounded)" : ""}${summary.questions && summary.questions !== "questions.jsonl" ? ` [${summary.questions}]` : ""}`;
  console.log(`| ${label} | ${rows.length} | ${pct(modelOk)} | ${pct(rejected)} | ${pct(policyOk)} | ${fromFallback} |`);
}
