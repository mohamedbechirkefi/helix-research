// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Builds the conditions of the planning-time investigation (journal HX-P6-2026-11-02-planning-time)
 * for timing.ts. Same model, same question, same decoding options; only the prompt of each phase
 * differs, taken from where it was recorded:
 *
 * - p3-ref: the Phase 3 benchmark prompt of item S01 (the reference question), rebuilt from commit
 *   4912d80 by dump-prompts.ts (research/benchmark/timing/prompts/p3-4912d80-prompts.json);
 * - p4-ref, p5-ref, p6-ref: the exact messages stored by the helix-app E2E suites (run 1 of the
 *   reference question; public copies in journal/results/helix-app-e2e/): Phase 4
 *   (e2e-2026-11-02.json), Phase 5 regression (e2e-2026-11-02-p5reg.json), Phase 6 regression
 *   (e2e-2026-11-02-p6reg.json);
 * - diagnostic variants of p6-ref named in the conditions' labels.
 *
 *   node scripts/ai-benchmark/timing-conditions.ts <out.json>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { planJsonSchema } from "@helix/ai-planning";
import { REPO_ROOT } from "./lib.ts";

const out = process.argv[2];
if (!out) throw new Error("usage: timing-conditions.ts <out.json>");
const MODEL = "ministral-3:8b";
const OPTIONS = { temperature: 0, num_ctx: 8192, num_predict: 1024 };
type Msg = { role: string; content: string };

const p3 = JSON.parse(readFileSync(join(REPO_ROOT, "research/benchmark/timing/prompts/p3-4912d80-prompts.json"), "utf8")) as { items: { item: string; messages: Msg[] }[] };
const stored = (f: string): Msg[] => {
  const j = JSON.parse(readFileSync(join(REPO_ROOT, "journal/results/helix-app-e2e", f), "utf8")) as { scenarios: { ollama: { runs: { prompt?: Msg[] }[] } } };
  const p = j.scenarios.ollama.runs[0]?.prompt;
  if (!p) throw new Error(`no stored prompt in ${f}`);
  return p;
};
const v1 = planJsonSchema("v1");
const v2 = planJsonSchema("v2");
const p6 = stored("e2e-2026-11-02-p6reg.json");

/**
 * The E2E suites stored the messages with window.__helixApp.prompt() AFTER the reference run, so
 * the stored context carries the session after the answer (VAL H6 selected, 2HBS loaded). The
 * measured call was made before: nothing selected or loaded. "-asked" conditions put back that
 * session; Phase 6 builds also passed sequenceSelection null (rendered since 4b30c60), which the
 * diagnostic hook did not. The Phase 6 reconstruction is checked against the app's own context in
 * helix-app scripts/model-questions.ts (--mode phase6, question ref-first).
 */
const AFTER = `"selection":{"structureId":"2HBS","chainId":"H","residueNumber":6,"compId":"VAL","numbering":"auth","featureId":"HbS_substitution"},"loadedStructureId":"2HBS"}`;
const asked = (m: Msg[], phase6: boolean): Msg[] => {
  if (!m[0]!.content.endsWith(AFTER)) throw new Error("stored prompt does not end with the post-answer session");
  return [{ role: "system", content: m[0]!.content.slice(0, -AFTER.length) + `"selection":null,"loadedStructureId":null${phase6 ? `,"sequenceSelection":null` : ""}}` }, m[1]!];
};

const RULE12 = "12. If no structure has variantPlacement true, a variant can still be shown on the sequence (rule 11); say so in reason and never use a predicted model instead.";
const COMPACT = "13. Write the JSON object on one line, with no line breaks or indentation.";
if (!p6[0]!.content.includes(RULE12)) throw new Error("rule 12 not found");

const conditions = [
  { id: "p3-ref", label: "Phase 3 benchmark prompt, item S01 (commit 4912d80), schema v1", model: MODEL, messages: p3.items.find((i) => i.item === "S01")!.messages, format: v1, options: OPTIONS },
  { id: "p4-ref", label: "Phase 4 app prompt as stored (e2e-2026-11-02.json run 1; post-answer session), schema v1", model: MODEL, messages: stored("e2e-2026-11-02.json"), format: v1, options: OPTIONS },
  { id: "p5-ref", label: "Phase 5 app prompt as stored (e2e-2026-11-02-p5reg.json run 1; post-answer session), schema v1", model: MODEL, messages: stored("e2e-2026-11-02-p5reg.json"), format: v1, options: OPTIONS },
  { id: "p6-ref", label: "Phase 6 app prompt as stored (e2e-2026-11-02-p6reg.json run 1; post-answer session), schema v2", model: MODEL, messages: p6, format: v2, options: OPTIONS },
  { id: "p4-ref-asked", label: "Phase 4 app prompt with the session of the measured call (nothing selected or loaded), schema v1", model: MODEL, messages: asked(stored("e2e-2026-11-02.json"), false), format: v1, options: OPTIONS },
  { id: "p5-ref-asked", label: "Phase 5 app prompt with the session of the measured call, schema v1", model: MODEL, messages: asked(stored("e2e-2026-11-02-p5reg.json"), false), format: v1, options: OPTIONS },
  { id: "p6-ref-asked", label: "Phase 6 app prompt with the session of the measured call (sequenceSelection null), schema v2", model: MODEL, messages: asked(p6, true), format: v2, options: OPTIONS },
  {
    id: "p6-ref-asked-compact",
    label: "Diagnostic: p6-ref-asked with one added rule after rule 12 (\"13. Write the JSON object on one line, with no line breaks or indentation.\")",
    model: MODEL,
    messages: ((m: Msg[]) => [{ role: "system", content: m[0]!.content.replace(RULE12, `${RULE12}\n${COMPACT}`) }, m[1]!])(asked(p6, true)),
    format: v2,
    options: OPTIONS,
  },
  { id: "p6-ref-noformat", label: "Diagnostic: p6-ref without the JSON schema in format (no constrained decoding)", model: MODEL, messages: p6, format: undefined, options: OPTIONS },
];
writeFileSync(out, JSON.stringify({ conditions }, null, 1));
console.log(conditions.map((c) => `${c.id} system ${c.messages[0]!.content.length} chars`).join("\n"));
