// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * D-H011 prompt drafts: builds research/benchmark/prompt-drafts-dh011/<id>.json from RULES_V5 with
 * rule 13 replaced by the text of <id>.rule13.txt (and the answer hint of <id>.hint.txt, if present).
 *
 *   node scripts/ai-benchmark/make-draft.ts d1
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { RULES_V5 } from "@helix/ai-planning";
import { REPO_ROOT } from "./lib.ts";

const id = process.argv[2];
if (!id) throw new Error("usage: make-draft.ts <id>");
const dir = join(REPO_ROOT, "research", "benchmark", "prompt-drafts-dh011");
const rule13 = readFileSync(join(dir, `${id}.rule13.txt`), "utf8").trimEnd();
const v5Rule13 = RULES_V5.split("\n").find((l) => l.startsWith("13. "))!;
const rules = RULES_V5.replace(v5Rule13, rule13);
const hintFile = join(dir, `${id}.hint.txt`);
const answerHint = existsSync(hintFile) ? readFileSync(hintFile, "utf8").replace(/\n$/, "") : undefined;
const out = { id, base: "helix-plan-prompt-v5", rules, ...(answerHint !== undefined ? { answerHint } : {}) };
writeFileSync(join(dir, `${id}.json`), JSON.stringify(out, null, 1) + "\n");
console.log(id, "rules chars", rules.length, "(v5", RULES_V5.length + ")", "sha256", createHash("sha256").update(rules).digest("hex"));
