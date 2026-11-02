<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HX-P4-2026-11-02-cancellation: interrupting the camera transition and the inference

```yaml
id:            HX-P4-2026-11-02-cancellation
date:          2026-11-02
hypothesis:    A user can stop a running request during the camera transition (Stop button or a pointer
               press on the viewer) and during model inference; the camera stops where it is, no
               unverified highlight remains, the scene is unchanged when inference is cancelled, and the
               next request works. Contradicted if the camera keeps moving, a highlight remains, or the next
               request fails or waits behind the cancelled generation.
git_commit:    helix-app 1ce822f (private repository; public copy in `journal/results/helix-app-e2e/`); helix-research a13c1ec
config:        helix-app apps/web/e2e/run.mjs, scenarios cancel-camera (camera 3,000 ms, ?cameraMs=3000)
               and cancel-inference; same run as HX-P4-2026-11-02-ai-to-world-e2e
seeds:         n/a; 6 camera runs (3 Stop, 3 pointer), 3 inference runs
data_version:  data/curated/hbb at a13c1ec
hardware:      Apple M1 Pro, 16 GB, macOS 15.3.1; Chrome 156.0.8078.74 headless
duration:      not recorded separately
cost:          0
llm:
  provider:       local Ollama 0.40.6
  model_id:       ministral-3:8b
  call_date:      2026-11-02
  params:         as in HX-P4-2026-11-02-ai-to-world-e2e
  prompts:        the reference question, helix-plan-prompt-v1
  responses:      the cancelled calls returned no plan; the follow-up calls' outcomes are stored
  attempt_count:  3 cancelled calls and 3 follow-up calls
```

## Methods

- **Camera:** the reference question with the deterministic planner and a 3 s transition. The script waits until the focus action is executing and the camera is in transition, waits 800 ms more, then clicks Stop or presses the mouse on the viewer. It measures the time until the request reads `cancelled`, and the camera position change over the next second.
- **Inference:** the reference question with ministral-3:8b; Stop is clicked 1.5 s after it becomes enabled. Then the same question is asked again, to see whether the server is free.
- **Recovery:** in one page, a cancelled request is followed by a normal one.

## Raw results + uncertainty

From `helix-app/apps/web/e2e/results/e2e-2026-11-02.json`:

- **Camera, 6 runs:** cancel latency median 28 ms (12 to 34 ms). Camera displacement in the second after the cancel: 0 Å in all 6 runs, transition flag false. Statuses: focusCamera, highlightResidue and revealEvidence cancelled; resolveVariant and loadStructure completed. No highlight in the store or in Mol*'s selection.
- **Inference, 3 runs:** cancel latency 13, 14 and 13 ms. Outcome `inference-cancelled`, no structure loaded. The next question completed (executed) with a plan time of 15,497, 15,540 and 15,566 ms, in line with the warm reference runs (median 15,516 ms), so the cancelled generation did not hold the server.
- **Recovery:** after a cancelled request, the next one completed every action, with the mapped read-back.
- Single machine; small n.

## Failures

None in the stored run.

## Limits / confounders

- The camera interrupt sets a public but undocumented Mol* field (`camera.transition.inTransition`).
- Whether Ollama stops generating on the server at once was inferred from the next request's timing, not observed in the server.
- "Cancel latency" includes the 5 ms polling of the test script.

## Interpretation

Supported: both interruptions are prompt and leave no inconsistent state on this machine.

## Decision

**Continue.**

## Artifacts

- `helix-app/apps/web/e2e/results/e2e-2026-11-02.json` (scenarios `cancel-camera`, `cancel-inference`)
- `helix-app/docs/reviews/phase-4-shots/after-cancel-recovered.jpg`
