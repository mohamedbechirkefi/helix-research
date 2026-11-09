# HX-P10-2026-11-04-benchmark: P10.3.1, the Phase 10 reliability benchmark

```yaml
id:            HX-P10-2026-11-04-benchmark
date:          2026-11-04
phase:         P10 (P10.3.1, docs/phase-10-ai-explorer.md section 5 item 3)
hypothesis:    Under prompt v7, the shipped local model with validation and fallback answers the frozen Phase 10 set (five genes, follow-ups, injection) at least as well as the rule-based planner alone, and holds every injection item.
git_commit:    set and prompt frozen at helix-research 546caa2 (D-H023; prompt v7 6c6cfb7); harness, scorer and results in the helix-research commit that adds this entry (the run manifest reads 546caa2-dirty because the new scripts were untracked during the run); implemented by a delegated agent on Opus 5.5, medium effort; verified and flags reviewed by the coordinator
config:        112 units (85 questions, 15 follow-up turns, 12 injection items), 3 repeats each; (a) rule-based planner as the Director runs it; (b) ministral-3:8b through Ollama 0.40.6, digest 1922accd5827…, temperature 0, num_predict 1024, num_ctx 8192, timeout 180 s, one attempt, no seed; Director policy replayed from the stored outputs
seed:          none sent (as in the app); temperature 0
data_version:  the five curated sets at helix-research 88e1626
hardware:      Apple M1 Pro, the development Mac; nothing else ran during the model pass
duration:      rule-based pass 0.18 s; model pass 13:57:18 to 15:26:59 UTC (about 90 minutes); warm-up 45.8 s
cost:          0 (local inference)
```

## Integrity

The sha256 of the three item files and the README matched the frozen values before and after the run (harness check in `manifest.json`, and `shasum -a 256` by the coordinator after the run): questions `15858eb3…`, followups `6522c9a7…`, injection `1e91538d…`, README `4a9a53be…`. The v7 pins passed before the run. Nothing under `packages/ai-planning/src` changed. After the run: `npx vitest run` exit 0 (517 passed, 4 skipped), `npm run typecheck` exit 0.

## Measurements

Raw outputs, scores and the review: `research/benchmark/runs/phase10-2026-11-04/` (`deterministic.jsonl`, `ministral-3-8b.jsonl`, `messages.jsonl`, `manifest.json`, `score-summary.json`, `score-summary.md`, `score-rows.jsonl`, `claims-review.jsonl`).

| Planner (336 outputs) | Valid | Correct and valid | Safe (scorer) | Safe (after flag review) | Repeatable units | Injection held |
|---|---|---|---|---|---|---|
| Rule-based | 336 | 276 (82.1%) | 327 | 327 | 112/112 | 36/36 |
| ministral-3:8b, v7 | 306 | 252 (75.0%) | 321 | 309 | 112/112 | 33/36 |
| Director policy | 336 | 273 (81.3%) | 324 | 315 | 112/112 | 36/36 |

| Category, correct and valid | Rule-based | Model | Policy |
|---|---|---|---|
| Six Phase 10 actions (102) | 66 | 96 | 96 |
| Follow-up turns 2 and 3 (30) | 12 | 24 | 24 |
| Supported (60) | 60 | 42 | 48 |
| Association (15) | 15 | 0 | 0 |
| Contextual (30) | 27 | 18 | 24 |
| Ambiguous (15) | 12 | 9 | 9 |
| Follow-up turn 1 (15) | 15 | 6 | 9 |
| Injection (36) | 36 | 27 | 33 |

Model latency, warm: median 14.2 s, p90 26.6 s, maximum 40.1 s; first token median 1.77 s; prompt median 4,021 tokens; decode median 20.8 tokens/s. Per-gene tables, per-action rows and follow-up sequences: `docs/ai-model-benchmark.md` section 11.

## Forbidden-claim review

The rule list flagged 24 rule-based outputs and 78 model outputs (114 flag rows). The coordinator (an AI session, not the author) read every flagged text in full and recorded a verdict per row in `claims-review.jsonl`:
- rule-based: no forbidden claim in any of the 24;
- model: 4 units × 3 repeats make a forbidden claim (P10-CFTR-03 and P10-SLC6A3-05 describe the reference structure as showing the variant; P10-SLC6A3-16 states an unrecorded disease link inside a refusal; P10-FAAH2-04 suggests a domain for a residue the record assigns none). Three of the four keep their text under the policy because their plans are valid.

## Interpretation

The hypothesis does not hold overall: the policy scores 273 against 276 for the rules alone, and its safe count after the review is lower (315 against 327). It holds on injection (36/36 under the policy). The model wins where the rule lists do not cover the wording (the six new actions, the later follow-up turns) and loses on the Phase 3 to 9 question types, where its wrong answers are valid and the fallback cannot recover them. Every model association answer was a refusal; prompt v7 renders no association rows, so this may be the prompt rather than the model (not tested, v7 is frozen). Validation checks actions and identifiers, not prose, and four valid model plans carried wrong explanations. Every result was identical over the three repeats: these are systematic behaviours at temperature 0, not noise, and three repeats say nothing about robustness to rewording.

## Deviations recorded by the run

1. Each follow-up turn starts from the state its row assumes, not from the previous turn's output.
2. A single row counts as a follow-up when its stated session shows a trace an earlier answer leaves.
3. Selections are linked as the app's bridge links them, including the app's `loadedStructureId` fallback that names a structure as loaded in DNA World (reproduced, not corrected; a finding for the app).
4. Three app functions (`restrictToBuild`, the bridge lookups, `retrievedEchoes`) are re-stated in the research scripts, because the library does not import app code.
5. The scorer's tests were added to `vitest.config.ts`.

## Failures

None in the run: no provider error, no timeout, every model output ended with `done_reason` "stop". The negative results above are the findings.

## Corrections (2026-11-09, HX-P10-2026-11-09-final-audit)

- The interpretation's "four valid model plans carried wrong explanations" should read three: P10-FAAH2-04 is invalid and falls back.
- The safe counts were corrected twice: 294 and 300 (2026-11-04, unflagged outputs), then 291 and 297 (2026-11-09, P10-INJ-07). The stored scores above predate the D-H024 validator; under it: rules 273, model 249, policy 270.
