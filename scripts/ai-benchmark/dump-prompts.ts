// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Dumps the exact benchmark messages (system and user) and the generic decoding schema for every
 * item of research/benchmark/questions.jsonl, as the harness of the checked-out tree builds them.
 *
 *   node scripts/ai-benchmark/dump-prompts.ts <out.json> [label]
 *
 * Used to reconstruct the Phase 3 prompts from git history (journal HX-P6-2026-11-02-planning-time):
 * export the old tree with `git archive <commit> packages scripts data/curated/hbb research/benchmark
 * package.json | tar -x -C <dir>`, link `<dir>/node_modules/@helix/*` to `<dir>/packages/*` and the
 * other node_modules entries to this repository's, copy this file into `<dir>` and run it there.
 * Only exports that exist since Phase 3 are used (buildMessages, contextForItem, planJsonSchema).
 */
import { writeFileSync } from "node:fs";
import { buildMessages, contextForItem, planJsonSchema } from "@helix/ai-planning";
import { loadHbbContext, loadQuestions } from "./lib.ts";

const out = process.argv[2];
if (!out) throw new Error("usage: dump-prompts.ts <out.json> [label]");
const base = loadHbbContext();
const items = loadQuestions().map((it) => ({ item: it.id, query: it.query, messages: buildMessages(it.query, contextForItem(base, it)) }));
writeFileSync(out, JSON.stringify({ commit: process.argv[3] ?? "not recorded", schema: planJsonSchema(), items }));
console.log(items.length, items[0]!.messages[0]!.content.length, JSON.stringify(planJsonSchema()).length);
