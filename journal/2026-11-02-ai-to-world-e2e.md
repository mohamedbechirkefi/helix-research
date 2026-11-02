<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HX-P4-2026-11-02-ai-to-world-e2e: the reference question end to end, model and fallback

```yaml
id:            HX-P4-2026-11-02-ai-to-world-e2e
date:          2026-11-02
hypothesis:    In the running app, the typed question "Show me where the sickle-cell mutation affects
               hemoglobin." causes verified resolution, the 2HBS load, a focus and highlight that Mol*'s
               own state reads back as the mapped residues, an evidence card and a sourced explanation,
               with the deterministic planner and with ministral-3:8b. Contradicted by any wrong read-back,
               an unsourced claim, a fallback to the deterministic plan on the model path, or a page error.
git_commit:    helix-app 1ce822f (private repository; public copy in `journal/results/helix-app-e2e/`); helix-research packages and data pinned at a13c1ec
config:        helix-app apps/web/e2e/run.mjs (default scenarios, --tag=2026-11-02); camera transition 700 ms
seeds:         n/a (temperature 0); 5 runs per planner, each in a fresh browser context
data_version:  data/curated/hbb at a13c1ec, every file sha256-checked against manifest.json in the page
hardware:      Apple M1 Pro, 16 GB, macOS 15.3.1; Chrome 156.0.8078.74 headless, ANGLE Metal
duration:      about 6 minutes for the whole suite (not recorded precisely)
cost:          0
software:      molstar 5.13.1, react 19.3.1, vite 8.3.4, puppeteer-core 25.14.0, Node 22.23.3
llm:
  provider:       local Ollama 0.40.6 (user-space), http://127.0.0.1:11434, /api/chat with streaming
  model_id:       ministral-3:8b (digest 1922accd5827, as recorded in Phase 3)
  call_date:      2026-11-02
  params:         temperature 0, num_ctx 8192, num_predict 1024, format = the generic plan JSON schema,
                  think not sent (the model has no thinking capability), timeout 180 s
  prompts:        helix-plan-prompt-v1 (packages/ai-planning/src/prompt.ts) over the context restricted to
                  the Phase 4 build (only the protein world available); the exact messages of run 1 are
                  stored in the result file (scenarios.ollama.runs[0].prompt)
  responses:      the validated plan of every run is stored (scenarios.*.runs[].plan); no output was rejected
  attempt_count:  5 reference calls, plus 3 after cancellations, 2 in the stale scenario and 3 cancelled
                  calls (journal HX-P4-2026-11-02-cancellation); no retries
```

## Methods

- The suite opens the built app (`vite preview`) in the system Chrome, selects the planner, types the question and clicks Ask.
- Read-back: the residues in Mol*'s selection manager and focus manager, through `StructureProperties`.
- Timings are taken in the page on `performance.now()`: question asked, plan returned, first Mol* draw after the structure loaded, first Mol* draw after the highlight was verified. The wall time is measured from the puppeteer click to the end of the request.
- DOM check: every location or record sentence, and every evidence card, must carry an evidence id whose record has an https source, and each card shows "Evidence class N: label".
- Other scenarios in the same run: a follow-up about the selection, three unsupported questions, a user click returning to free exploration, and two stale cases.

## Raw results + uncertainty

From `helix-app/apps/web/e2e/results/e2e-2026-11-02.json` (the suite passed, 0 failures):

| Measure (5 runs each) | Deterministic | ministral-3:8b |
|---|---|---|
| Plan returned (question to plan) | median 3.3 ms | median 15,516 ms (min 15,473, max 28,697) |
| Question to first draw of the loaded structure | median 235 ms | median 15,922 ms |
| Question to first draw after the verified highlight | median 1,060.9 ms (1,057.3 to 1,091.6) | median 15,922 ms (max 29,123) |
| Plan to first draw after the verified highlight | median 1,057.6 ms | median 413 ms |
| Camera transition observed | 5/5, median 668.4 ms | 5/5, median 680.5 ms |
| First token | n/a | median 95.2 ms; 13,259 ms in run 1 |
| Plans rejected by validation (fallbacks) | 0 | 0 |

- **Read-back, every run:** the selection was VAL 6 on chains B, D, F and H (label = auth, entity 2); the focus was VAL H6; the structure was 2HBS as the asymmetric unit with chain H; the in-scene label read "HbS: VAL H6".
- **Plans differ.** The deterministic plan is resolveVariant, loadStructure, focusCamera, highlightResidue, revealEvidence. ministral's plan, the same in all 5 runs, is loadStructure, highlightResidue, focusCamera, with the same three citations and no revealEvidence. Its highlight therefore comes before the camera move, which is why its "plan to highlight drawn" (413 ms) is shorter than the deterministic one (1,058 ms, which includes the 700 ms camera move). The two "highlight drawn" figures do not measure the same point of the sequence.
- **Run 1 of ministral was a cold start:** the first token took 13,259 ms, against about 95 ms in runs 2 to 5.
- **Follow-up** ("What does this residue touch in the crystal?"): read-back H6 plus chain B ALA 70, ASP 73, THR 84, PHE 85, LEU 88; the asymmetric-unit scope sentence was shown; all claims sourced. A later real click on the canvas set the session selection to HEM B153 (the residue Mol* picked).
- **Unsupported** (CFTR F508del, a hydroxyurea question, "Show me the HBB gene."): all answered `unsupported`, scene unchanged.
- **Stale:** a second question during inference made the first one `stale-discarded` and the second executed; a residue click (GLN G54) during inference moved the session epoch from 1 to 2, and the arriving plan was rejected as stale with no highlight.
- No page error in any scenario.
- Uncertainty: 5 runs per planner on one machine, one Ollama version; no interval computed.

## Failures

- During development (before the stored run), three defects were found and fixed; the runs that showed them were not stored as result files, so no numbers are given:
  - `canvas3d.didDraw` is a BehaviorSubject; the next-draw helper threw a ReferenceError on its synchronous replay (page errors).
  - The camera wait resolved before Mol* had started the transition, and then hung when Mol* skipped draws while shaders finalized.
  - A focus requested right after the load was applied instantly (zero duration), because Mol* had not finished committing the new scene.
- The P1 experiment pages use the same next-draw pattern; by reading the code, their promise resolved on the following real draw, so their timings stand (inference, not re-measured).

## Limits / confounders

- Headless Chrome on a fast laptop; Safari, Firefox and WKWebView not run.
- The model latency (median 15.5 s warm) is higher than the Phase 3 median of 10 s; the prompt context differs (restricted worlds) and the plan wording differs. Not investigated.
- The first-draw timings are main-thread timestamps of Mol*'s `didDraw`, not presentation times.

## Interpretation

Supported on this machine: the §7.5 chain holds on the running app with both planners, and every displayed claim is sourced. The model adds about 15 s of planning; the scene work after the plan is under 1.1 s.

## Decision

**Continue.** The Phase 4 gate can be reviewed. The model's plan order (highlight before focus) is valid; whether the UI should reorder it is a Phase 5 question.

## Artifacts

- `helix-app/apps/web/e2e/results/e2e-2026-11-02.json` (private repository; public copy in `journal/results/helix-app-e2e/`)
- `helix-app/docs/reviews/phase-4-shots/fallback-reference.jpg`, `ollama-reference.jpg`, `follow-up-contacts.jpg`, `unsupported.jpg`, `stale-rejected.jpg`, `after-cancel-recovered.jpg`
- earlier development run: `helix-app/apps/web/e2e/results/e2e-dev-fallback+follow-up+unsupported+cancel-camera.json`

## Correction (2026-11-02, HX-P6-2026-11-02-planning-time)

The stored "exact messages" were captured after the model answered, so their context shows the state after the plan ran (VAL H6 selected, 2HBS loaded), not the context the model saw. Replayed with the context of the real call, they reproduce the measured planning times within 0.7%. The capture now happens before the question (helix-app 871699e). Timings and outcomes in this entry are unaffected; only the description of the stored prompt was wrong.
