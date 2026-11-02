<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HX-P6-2026-11-02-model-e2e-oneworld: the model-backed E2E scenarios on the one-world build

```yaml
id:            HX-P6-2026-11-02-model-e2e-oneworld
date:          2026-11-02
hypothesis:    On the build with the one-world first answer (prompt v3 and the world-switch check),
               the model-backed scenarios skipped in HX-P6-2026-11-02-start-world-dh007 still pass:
               Phase 4 ollama, cancel-inference and stale; Phase 5 modes and rapid; Phase 6 blueprint B
               with ministral-3:8b. Contradicted by any failed assertion, a fallback on the reference
               question, or a two-world first answer executed.
git_commit:    helix-app 9efc210 plus the E2E prompt-capture fix committed with this entry (private
               repository; public copies in `journal/results/helix-app-e2e/`); helix-research packages
               pinned at c7b2385
config:        production build served by vite preview (port 5190); e2e/run.mjs
               --only=ollama,cancel-inference,stale; e2e/phase5.mjs --only=modes,rapid; e2e/phase6.mjs
               --only=blueprint-b --runs=3 --ollama-runs=3; all --tag=2026-11-02-oneworld; fade and
               camera 700 ms; screenshots to docs/reviews/oneworld-shots (the reviewed Phase 4 to 6 shots
               were left as they were)
seeds:         temperature 0; 5 reference runs, 3 cancellations, 3 blueprint B runs per planner, 1 run of
               the other cases, each in a fresh browser context
data_version:  data/curated/hbb at 6b8791e
hardware:      Apple M1 Pro, 16 GB, macOS 15.3.1; Chrome 156.0.8078.74 headless, ANGLE Metal
duration:      about 25 minutes for the three suites (not timed separately)
cost:          0
llm:
  provider:       local Ollama 0.40.6 (server already running)
  model_id:       ministral-3:8b
  call_date:      2026-11-02
  params:         temperature 0, num_ctx 8192, num_predict 1024, keep_alive 10m, plan JSON schema v2;
                  prompt helix-plan-prompt-v3
  prompts:        run 1 of the reference question and of the blueprint B follow-up, captured before the
                  question (scenarios.ollama.runs[0].prompt; scenarios.blueprint-b.ollama.rows[0].prompt)
  responses:      every plan in the result files
  attempt_count:  Phase 4 suite 5 reference + 3 cancelled + 3 after cancel + 2 stale; Phase 5 suite 1
                  modes + 1 rapid; Phase 6 suite 6 (3 first, 3 follow-up); no retries
```

## Methods

The suites of HX-P4-2026-11-02-ai-to-world-e2e, HX-P5-2026-11-02-modes-rapid and HX-P6-2026-11-02-vertical-slice-e2e, unchanged except that the prompt of run 1 is now captured before the question (the earlier suites captured it after, in the post-answer session; see HX-P6-2026-11-02-planning-time).

## Raw results + uncertainty

All three suites PASS with 0 failures and no page error:

| Scenario | Result | Phase 6 (journal HX-P6-2026-11-02-vertical-slice-e2e) |
|---|---|---|
| Reference question, ministral-3:8b (n = 5) | plan loadStructure, enterWorld protein, highlightResidue, focusCamera, one world, 5/5, 0 fallbacks; provider median 18,617 ms (18,600 to 19,033); question to highlight drawn median 19,778 ms; read-back VAL B6, D6, F6, H6 and focus H6 | provider 21,514 ms, two worlds |
| Inference cancel (n = 3) | cancel 15 to 30 ms, no structure after cancel; the next question executed from the model (18,569 to 18,578 ms) | 15 ms |
| Stale | a second question made the first stale-discarded; a residue click during inference rejected the arriving plan as stale (provider 22,651 ms) | same outcomes |
| Modes (model) | "Why is this residue important?" executed from the model: highlightResidue (selection), revealEvidence x3, one world, 21,741 ms wall | 27,987 ms (Phase 5) |
| Rapid (e) | the model's reference plan (20,581 ms) rejected as stale after the codon 1 click; codon 1 kept, no structure | 15,790 ms (Phase 5) |
| Blueprint B, model (n = 3) | first question one world (as above), provider 18,735 to 19,212 ms, wall median 20,825 ms; follow-up from the model 3/3: highlightSequenceRegion, compareVariants, provider 13,737 to 13,769 ms, wall median 14,520 ms; 0 fallbacks | wall 25,033 and 17,116 ms |
| Blueprint B, rule-based (n = 3) | first 1,822 ms, follow-up 777 ms | 1,833 and 775 ms |

The run 1 prompts carry `ANSWER: first (rule 13: actions of one world only)` for the reference question and `ANSWER: follow-up` for the blueprint B follow-up.

## Failures

None.

## Limits / confounders

- One machine, headless Chrome, few runs. The browser provider times agree with the Node harness of HX-P6-2026-11-02-one-world-first-answer (reference question 18,617 against 18,838 ms median).
- The first reference run includes a partly cached prompt (first token 545 ms against about 110 ms).

## Interpretation

Supported: the model-backed scenarios pass on the one-world build, the model's first answer is one-world in every run, and model planning on the reference question is about 2.9 s shorter than in Phase 6.

## Decision

Continue. The Phase 6 model scenarios skipped in the D-H007 regression are now covered on the shipped configuration.

## Artifacts

- `helix-app/apps/web/e2e/results/e2e-2026-11-02-oneworld-ollama+cancel-inference+stale.json`, `phase5-e2e-2026-11-02-oneworld-modes+rapid.json`, `phase6-e2e-2026-11-02-oneworld.json` (private repository; public copies in `journal/results/helix-app-e2e/`)
- `helix-app/docs/reviews/oneworld-shots/`
