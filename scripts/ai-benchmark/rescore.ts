// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Re-scores stored raw outputs with the current scorer, without calling a model again.
 *   node scripts/ai-benchmark/rescore.ts <run-dir-name> [...]
 * Rewrites raw.jsonl (score fields only; raw text, timings and usage are kept) and summary.json
 * (run metadata, warm-up and memory are kept from the previous summary).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { contextForItem, scoreItem } from "@helix/ai-planning";
import { loadHbbContext, loadQuestions, REPO_ROOT, RUNS_DIR } from "./lib.ts";
import { summarise, type Row } from "./summarise.ts";

const ctxBase = loadHbbContext();
for (const name of process.argv.slice(2)) {
  const dir = join(RUNS_DIR, name);
  const prev = existsSync(join(dir, "summary.json")) ? (JSON.parse(readFileSync(join(dir, "summary.json"), "utf8")) as Record<string, unknown>) : {};
  const qfile = typeof prev.questions === "string" ? prev.questions : "questions.jsonl";
  const items = loadQuestions(join(REPO_ROOT, "research", "benchmark", qfile));
  const rows = readFileSync(join(dir, "raw.jsonl"), "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Row);
  for (const r of rows) {
    const it = items.find((i) => i.id === r.item);
    if (!it) throw new Error(`${name}: unknown item ${r.item}`);
    r.score = r.error ? null : scoreItem(it, r.raw, contextForItem(ctxBase, it)).score;
  }
  writeFileSync(join(dir, "raw.jsonl"), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const keep = Object.fromEntries(["run", "provider", "meta", "schemaMode", "questions", "warmup", "wallClockS", "reps", "memory", "notes"].filter((k) => k in prev).map((k) => [k, prev[k]]));
  const s = summarise(rows, items.filter((i) => rows.some((r) => r.item === i.id)), { ...keep, rescoredAt: new Date().toISOString() });
  writeFileSync(join(dir, "summary.json"), JSON.stringify(s, null, 1) + "\n");
  console.log(name, "rows", rows.length, "correct+valid T0", s.temperature0.correctAndValidPct);
}
