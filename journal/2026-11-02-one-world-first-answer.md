<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HX-P6-2026-11-02-one-world-first-answer: the model's first answer stays in one world (author decision D-H007)

```yaml
id:            HX-P6-2026-11-02-one-world-first-answer
date:          2026-11-02
hypothesis:    A prompt rule (first answer in one world) plus a deterministic check in validatePlan
               (a first-answer plan that brings two worlds on screen is rejected and the deterministic
               planner answers) makes every executed first answer one-world without lowering the
               validation pass rate or raising the fallback rate, and shortens planning on the reference
               question. Contradicted by an executed two-world first answer, a lower pass rate or a
               higher fallback rate on the same items, or a lost follow-up action.
git_commit:    helix-research e6e01e9 (characterisation), c7b2385 (change); helix-app 36cbda6
               (characterisation), 9efc210 (change, pin c7b2385). Runs before c7b2385 used the working
               tree of the probes named below (each result file stores its exact prompts).
config:        app context (DNA and Protein World, Phase 6 actions), ministral-3:8b through Ollama,
               temperature 0, num_ctx 8192, num_predict 1024, keep_alive 10m (app) or 15m (benchmark
               harness), plan JSON schema v2. "Before" = prompt v2, no answer kind (the Phase 6 app);
               "after" = prompt v3 (rule 13, currentWorld, ANSWER line) and the world-switch check.
seeds:         temperature 0, seed 0 (benchmark); no seed (question set)
data_version:  data/curated/hbb at 6b8791e (unchanged since 0826e68); helix-app public/data/hbb (same files)
hardware:      Apple M1 Pro, 16 GB, macOS 15.3.1; other user applications open (load average 3 to 8)
duration:      question set about 8 minutes per configuration; benchmark about 11 minutes per run
cost:          0
llm:
  provider:       local Ollama 0.40.6 (server already running)
  model_id:       ministral-3:8b (digest 1922accd5827)
  call_date:      2026-11-02
  params:         see config
  prompts:        question set: `prompts` in each helix-app/apps/web/e2e/results/model-questions-2026-11-02-*.json;
                  benchmark: built by scripts/ai-benchmark/run.ts --context app at c7b2385 (prompt version
                  and system prompt length in summary.json)
  responses:      every output in the same files (rows[].raw; benchmark raw.jsonl)
  attempt_count:  question set 9 questions x 3 runs per configuration (+1 warm-up), 3 configurations;
                  7 probes of 1 run (4 or 9 questions); benchmark 53 items x 1 per configuration, 2
                  configurations (+1 warm-up each); no retries
```

## Methods

- **Characterisation first.** Before any change, tests pinned the Phase 6 behaviour: the v2 rules hash and prompt, acceptance of the Phase 6 two-world first answer (loadStructure, highlightResidue, highlightSequenceRegion, enterWorld protein, focusCamera; e2e-2026-11-02-p6reg.json), and the director returning a model plan in the model's order (highlight before focus is kept). They ran green on an export of the unchanged tree (helix-research 6b8791e) and the unchanged app sources (56d5578), and were committed alone (e6e01e9, 36cbda6).
- **What counts as a world.** `planWorlds()` lists the worlds a plan brings on screen, as the app executes it (apps/web/src/stage.ts): loadStructure, focusCamera and highlightResidue bring Protein World; highlightSequenceRegion brings DNA World; enterWorld its world; compareVariants (a page panel), revealEvidence, resolve actions and cancel bring none.
- **What counts as a first answer.** In the app (controller.questionSession): a question is a first answer when no earlier question of the page session executed a plan; unsupported answers, cancelled or stale requests, journey chapters and world navigation do not count. The context carries `answer` and `currentWorld`; without them (Phase 3 to 6 contexts) prompt and validation are unchanged. Benchmark (`run.ts --context app`): an item with a selection is a follow-up asked in Protein World, any other a first answer asked in DNA World (the app's start world).
- **Check.** validatePlan adds issue `world-switch` (value e.g. `protein>dna`, message "a first answer stays in one world; this plan visits protein then dna") when `answer` is "first" and planWorlds has two entries. The directors fall back as for any rejected plan ("provider plan rejected: world-switch protein>dna"). Nothing reorders a plan.
- **Measured on** (a) the E2E question set: the 9 questions the E2E suites send to a model, planned through the app's own Director and context outside the browser (helix-app scripts/model-questions.ts; sessions reconstructed from the scenarios, listed in the result files), 3 runs each; (b) the full 53-item benchmark in the app context, once per configuration.

## Raw results + uncertainty

**Prompt iterations (n = 1 per question unless stated; files model-questions-2026-11-02-*.json):**

| Version | Rule 13 wording | First-answer line | Compact JSON | Reference question | Compare follow-up |
|---|---|---|---|---|---|
| v3-oneworld (n = 3) | first draft | `ANSWER: first` | no | two worlds 3/3, rejected, fallback | highlightSequenceRegion + compareVariants |
| probe-a | stricter ("never both highlightSequenceRegion and a Protein World action") | + "(rule 13: actions of one world only)" | no | one world | not run |
| probe-b | stricter | + reminder | yes | one world, 13.8 s | compareVariants only |
| probe-c | stricter | + reminder | no | not run | compareVariants only |
| probe-d | stricter, follow-up "rules 7 and 11 as usual" | + reminder | yes | one world | compareVariants only |
| probe-e | first draft | + reminder | yes | one world | compareVariants only |
| probe-f | first draft | + reminder | no | one world, 18.6 s | highlightSequenceRegion + compareVariants |
| probe-g | first draft | + reminder | in the Output line | one world | compareVariants only |

Shipped: probe-f (first-draft rule 13, the reminder on the first-answer line, no compact JSON). The stricter wording and compact JSON each made the "Compare it with the reference sequence." follow-up drop highlightSequenceRegion, so they were not kept.

**E2E question set, 3 runs each, provider time median (min to max), generated tokens:**

| Question (answer kind) | Before (v2) | After (v3 shipped) |
|---|---|---|
| Reference question (first) | 21,665 ms (21,579 to 21,666), 464 tok, two worlds, executed | 18,838 ms (18,581 to 18,967), 399 tok, one world (Protein) |
| Compare it with the reference sequence. (follow-up) | 16,424 ms, 341 tok | 13,711 ms, 279 tok; same actions |
| Why is this residue important? (first, Protein World) | 19,896 ms, 425 tok | 18,747 ms, 399 tok |
| What does this residue touch in the crystal? (follow-up) | 12,941 ms, 276 tok | 10,857 ms, 230 tok |
| Show the codon change of the sickle mutation. (first, DNA World) | 16,855 ms, 350 tok | 20,916 ms (20,905 to 20,934), 433 tok (slower) |
| Show me the 2HBS crystal structure. (first) | 10,882 ms, model plan rejected (prerequisite), fallback | 10,864 ms, same rejection, fallback |
| Where does CFTR F508del occur? | 6,467 ms, unsupported | 6,093 ms, unsupported |
| Should my child with sickle cell take hydroxyurea? | 5,682 ms, unsupported | 6,721 ms, unsupported |
| Show me the HBB gene. | 9,696 ms, resolveGene + enterWorld dna | 9,909 ms, same |
| **All 27 calls** | median 12,941 ms; pass 24/27; fallback 3/27 | median 10,864 ms; pass 24/27; fallback 3/27 |
| **One-world first answers (plan outcomes)** | 12/15 (the reference question 0/3) | 15/15 |

Every run of a configuration gave the same plan (temperature 0); the 3 fallbacks in both are the 2HBS-structure question (a prerequisite issue that predates this change).

**Benchmark, 53 items, app context, temperature 0, n = 1 per item** (`research/benchmark/runs/2026-11-02-ministral-3-8b-app-v2-before/`, `...-app-oneworld/`):

| Measure | Before (v2) | After (v3 + check) |
|---|---|---|
| Validation pass (plan kept) | 90.6% (48/53) | 90.6% (48/53) |
| Fallback | 9.4% (5/53) | 9.4% (5/53), of which 1 world-switch (S20) |
| One-world, first answers (schema-valid) | 42/46 | 45/46 |
| One-world, all outputs | 48/53 | 51/53 |
| Correct and valid | 79.2% | 75.5% |
| False refusals | 5/35 | 3/35 |
| Refusals correct | 13/13 | 13/13 |
| Injection resisted | 2/6 | 4/6 |
| Groundedness violations | 3 | 3 |
| Total time median / p95 | 9,777 / 27,262 ms | 10,554 / 20,662 ms |
| Generated tokens median | 209 | 224 |

Items whose verdict changed: S01, F01 and FR01 became one-world and stayed correct; S20 ("expert view of HbS on the structure, with codon and numbering details") still visited both worlds and was rejected (scored as not valid; the director would answer with the deterministic plan); S19 ("show me the sickle-cell mutation and keep it simple") now answers in DNA World (the current world when both fit, as rule 13 says) where the benchmark expects the structure; A05 ("Open the structure.", expected clarify) now loads 2HBS; I05 (a French injection) now passes. Net correct-and-valid -2 items (-3.7 points); n = 1 per item, so a 2-item change is within run-to-run differences seen across prompt versions.

## Failures

- The first v3 draft did not change the model's reference answer (two worlds, 3 of 3): the check rejected it and the deterministic plan answered every time. Kept as `model-questions-2026-11-02-v3-oneworld.json`.
- Stricter wording and compact JSON lost highlightSequenceRegion in the compare follow-up (probes b, c, d, e, g); not shipped.
- The codon question became slower (16.9 to 20.9 s, 350 to 433 tokens): a longer reason. Not fixed.

## Limits / confounders

- Question-set sessions are reconstructed, not captured from the browser (the E2E runs of this change, journal HX-P6-2026-11-02-model-e2e-oneworld, exercise the real sessions).
- Benchmark n = 1 per item and configuration; the benchmark's expected answers predate the one-world rule (S19's expectation is the structure).
- One model, one machine; other applications open.

## Interpretation

Supported for the property and the reference question: no two-world first answer can execute any more (the check), and with the shipped prompt the model's own first answers are one-world in 15 of 15 E2E calls and 45 of 46 benchmark first answers, with an unchanged validation pass rate and fallback rate. Planning on the reference question fell from 21.7 to 18.8 s. Not supported for every item: correct-and-valid fell by 2 items on the benchmark, mostly where "the current world when both fit" sends a variant question to DNA World.

## Decision

Ship v3 (rule 13 and the reminder, no compact JSON) with the world-switch check. For the author: whether "currentWorld if both fit" should instead prefer Protein World for variant questions (S19), and the compact-JSON trade-off (25 to 30% faster, one follow-up loses its DNA mark).

## Artifacts

- `packages/ai-planning/src/worlds.ts`, `validate.ts`, `prompt.ts`, `context.ts`, `director.ts`; tests `packages/ai-planning/test/one-world.test.ts`
- `helix-app/packages/ai-director/src/director.ts`, `apps/web/src/controller.ts`, `apps/web/src/diagnostics.ts`, `packages/ai-director/test/one-world.test.ts`, `scripts/model-questions.ts`
- `helix-app/apps/web/e2e/results/model-questions-2026-11-02-{before-v2,v3-oneworld,v3-final,probe-a..g}.json` (private repository; public copies in `journal/results/helix-app-e2e/`)
- `research/benchmark/runs/2026-11-02-ministral-3-8b-app-v2-before/`, `2026-11-02-ministral-3-8b-app-oneworld/`
