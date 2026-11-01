// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
// Re-scores stored WebLLM outputs: as returned, and after stripping a leading <think>...</think> block
// (what WebLLMProvider does). Usage: node scripts/rescore.mjs results/raw-<tag>.jsonl
import { readFileSync, writeFileSync } from "node:fs";
import { aggregate, contextForItem, scoreItem, stripThinkBlock } from "../../../../packages/ai-planning/src/index.ts";
import { loadHbbContext, loadQuestions } from "../../../../scripts/ai-benchmark/lib.ts";

const file = process.argv[2];
const ctx = loadHbbContext();
const items = loadQuestions();
const rows = readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const asIs = [], stripped = [];
const detail = [];
for (const r of rows) {
  const it = items.find((i) => i.id === r.item);
  const c = contextForItem(ctx, it);
  const a = scoreItem(it, r.raw, c).score;
  const b = scoreItem(it, stripThinkBlock(r.raw), c).score;
  asIs.push(a); stripped.push(b);
  detail.push({ item: r.item, asIs: a.correctAndValid, stripped: { schemaValid: b.schemaValid, correctAndValid: b.correctAndValid, issues: b.issues.slice(0, 4) } });
}
const out = { file, asIs: aggregate(asIs), stripped: aggregate(stripped), detail };
writeFileSync(file.replace(/raw-(.*)\.jsonl$/, "rescored-$1.json"), JSON.stringify(out, null, 1) + "\n");
console.log(JSON.stringify(out, null, 1));
