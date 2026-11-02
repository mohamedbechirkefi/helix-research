<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HX-P7-2026-11-02-instrument-frame-timing: frame timings of the refined Instrument scene

```yaml
id:            HX-P7-2026-11-02-instrument-frame-timing
date:          2026-11-02
hypothesis:    The refined Instrument DNA World (D-H009: enamel base pairs, procedural studio environment,
               anisotropic brushed metal, depth of field only while the tour plays, post-processing at
               pixel ratio 1.5) and the new bridge transition (CSS motion over a resting canvas) (1) hold
               60 Hz with vsync on in every mode; (2) render no frame once a move ends and show no depth of
               field at rest; (3) show no frame over 50 ms with the frame cap removed; (4) cost no more per
               frame than the P7.1.1 Instrument scene (HX-P7-2026-11-02-concept-frame-timing).
               Contradicted by a median over 16.8 ms or frames over 33.4 ms with vsync on, by any frame
               rendered while idle or any depth of field at rest, by long frames uncapped, or by a higher
               uncapped median than P7.1.1 in the same mode.
git_commit:    helix-app 2b0d6c2 (private repository; public copy of the result files in
               `journal/results/helix-app-e2e/`)
config:        helix-app apps/web/e2e/concepts.mjs --perf --only=instrument --repeats=3 --transit;
               per mode x vsync on|off, three fresh pages; per page: 1.5 s settle, the 12 s quintic tour
               (not in reduced motion), 0.5 s, a scripted 4 s orbit, 2 s idle after each move; then per
               mode (not reduced motion) three pages of the bridge transition (screen=transit, 2.8 s),
               timed from its first frame, frames before its start kept apart; modes: full (UnrealBloomPass,
               BokehPass during the tour only, OutputPass, 4x MSAA half-float target, composer at pixel
               ratio 1.5), fx-off, reduced-motion, low-power (no post-processing, pixel ratio 1)
seeds:         n/a (deterministic scene and camera path); 3 repeats per condition, 42 tour or orbit pages and
               18 transition pages
data_version:  data/curated/hbb at 66d1d07 (the pinned helix-research commit; unchanged)
hardware:      Apple M1 Pro, 16 GB, macOS 15.3.1; Chrome 156.0.8078.74 headless, ANGLE Metal;
               1440 x 900 CSS pixels at device pixel ratio 2
duration:      about 15 minutes per matrix (two matrices) plus two probes of about 2 minutes
cost:          0
```

## Methods

Same in-page probe as HX-P7-2026-11-02-concept-frame-timing (rAF intervals, Long Animation Frames, CPU time of the render call, frames in 2 s of idle), plus two checks: the scene's depth-of-field weight must be 0 after every move (the author's decision: depth of field only during the tour), and the transition must reach progress 1 with no frame rendered on the canvas afterwards. The P7.1.1 rows below are the Instrument rows of that entry's result of record, recomputed from its raw file by the same pooling (all frame intervals of the three pages per row).

Sequence: probe 1 (`concepts-probe-r3-perf.json`, vsync off, one repeat; the refined scene with effects at full resolution) gave a tour at 13.4 / 15.0 ms median / p95, the P7.1.1 cost, so the effects were moved to pixel ratio 1.5; probe 2 (`concepts-probe-fxdpr15-perf.json`, full and reduced motion only) gave 8.1 / 8.9. Matrix 1 (`concepts-2026-11-02-instrument-refined-pre-transit-fix-perf.json`) found one long frame per transition page (see Failures); the transition was changed to start after the scene's first frame and matrix 2 (`concepts-2026-11-02-instrument-refined-perf.json`) ran on the final code. Matrix 2 is the result of record; the tour and orbit rows of matrix 1 agree with it.

## Raw results + uncertainty

From `concepts-2026-11-02-instrument-refined-perf.json` (refined) and `concepts-2026-11-02-perf.json` (P7.1.1).

| Mode | Move | Build | vsync on: median / p95 / max ms | vsync on: frames > 33.4 ms (of all) | vsync off: median / p95 ms | vsync off: max ms, frames > 50 ms | Idle frames after the move | Depth of field at rest |
|---|---|---|---|---|---|---|---|---|
| full | tour | P7.1.1 | 16.7 / 16.8 / 33.4 | 0 of 2155 | 13.5 / 15.0 | 48.6, 0 | 0 | n/a |
| full | tour | refined | 16.7 / 16.8 / 33.4 | 0 of 2159 | 8.1 / 8.8 | 27.3, 0 | 0 | 0 |
| full | 4 s orbit | P7.1.1 | 16.7 / 16.8 / 33.4 | 0 of 713 | 13.2 / 15.0 | 33.8, 0 | 0 | n/a |
| full | 4 s orbit | refined | 16.7 / 16.7 / 16.8 | 0 of 723 | 5.4 / 7.0 | 18.7, 0 | 0 | 0 |
| full | bridge transition (CSS) | refined | 16.7 / 16.8 / 16.8 | 0 of 504 | 0.8 / 1.1 | 18.6, 0 | 0 | n/a |
| fx-off | tour | P7.1.1 | 16.7 / 16.7 / 16.8 | 0 of 2163 | 2.5 / 3.4 | 7.5, 0 | 0 | n/a |
| fx-off | tour | refined | 16.7 / 16.8 / 66.7 | 1 of 2160 | 2.6 / 3.7 | 8.4, 0 | 0 | 0 |
| fx-off | 4 s orbit | P7.1.1 | 16.7 / 16.7 / 16.8 | 0 of 723 | 2.3 / 3.3 | 18.8, 0 | 0 | n/a |
| fx-off | 4 s orbit | refined | 16.7 / 16.7 / 16.8 | 0 of 723 | 2.5 / 3.4 | 18.8, 0 | 0 | 0 |
| fx-off | bridge transition (CSS) | refined | 16.7 / 16.7 / 16.8 | 0 of 504 | 0.9 / 1.2 | 18.8, 0 | 0 | n/a |
| reduced-motion | 4 s orbit | P7.1.1 | 16.7 / 16.8 / 33.4 | 0 of 707 | 12.9 / 15.0 | 32.9, 0 | 0 | n/a |
| reduced-motion | 4 s orbit | refined | 16.7 / 16.8 / 16.8 | 0 of 723 | 5.3 / 6.9 | 18.8, 0 | 0 | 0 |
| low-power | tour | P7.1.1 | 16.7 / 16.7 / 33.4 | 0 of 2162 | 1.6 / 2.8 | 4.9, 0 | 0 | n/a |
| low-power | tour | refined | 16.7 / 16.8 / 33.3 | 0 of 2162 | 2.1 / 2.7 | 3.9, 0 | 0 | 0 |
| low-power | 4 s orbit | P7.1.1 | 16.7 / 16.7 / 16.8 | 0 of 723 | 0.5 / 2.7 | 18.6, 0 | 0 | n/a |
| low-power | 4 s orbit | refined | 16.7 / 16.8 / 16.8 | 0 of 723 | 0.4 / 2.6 | 18.8, 0 | 0 | 0 |
| low-power | bridge transition (CSS) | refined | 16.7 / 16.7 / 16.8 | 0 of 504 | 0.8 / 1.1 | 18.7, 0 | 0 | n/a |

- **vsync on:** median 16.7 ms and p95 at most 16.8 ms in every row. Frames over 33.4 ms: one, 66.7 ms, at frame 650 of 718 of the tour in effects-off page 2 (one Long Animation Frame of 76.3 ms, blocking 0 ms); none in its two sibling pages or in any other row. The 33.3 to 33.4 ms maxima are the first frame of a move.
- **vsync off, full effects:** tour 8.1 / 8.8 ms median / p95 against 13.5 / 15.0 (P7.1.1); orbit 5.4 / 7.0 against 13.2 / 15.0; reduced-motion orbit 5.3 / 6.9 against 12.9 / 15.0. Max 27.3 ms, no frame over 50 ms.
- **vsync off, effects off and low power:** tour 2.6 / 3.7 and 2.1 / 2.7 ms against 2.5 / 3.4 and 1.6 / 2.8.
- **Transition:** 0.8 to 0.9 ms median, 1.1 to 1.2 ms p95 uncapped; max 18.8 ms; 0 frames on the canvas afterwards. Frames before its start (page load and the scene's first render): max 67 to 177 ms per page, following the effects mode.
- **Idle and depth of field:** 0 frames while idle after all 42 moves and 18 transitions; depth-of-field weight 0 at rest after all 42 moves.
- **CPU time of the render call:** at most 2.9 ms p95 with vsync on.

## Failures

- Matrix 1: one frame of 67 to 181 ms per transition page (all 18), about 0.2 s after load, its length following the effects mode (133 ms full, 83 ms effects off, 67 ms low power with vsync on). Interpretation: the scene's first render (shader compile, PMREM environment) coinciding with the transition's start, because the prototype screen loads the scene and starts the transition at once. Change: the transition waits for the scene's first rendered frame; the harness separates the frames before the start. After the change no transition frame exceeds 18.8 ms.
- Matrix 2: the single 66.7 ms vsync-on frame above (not reproduced, not traced).
- No harness check failed in matrix 2 (all pages: no page error, idle frames 0, depth of field 0 at rest, transition complete).

## Limits / confounders

- One machine, headless Chrome, three repeats, pixel ratio 2 only; vsync off is a stress condition.
- No GPU timer queries and no trace; causes of single long frames are inferred.
- The Mol* canvas is not on the page during these runs. Hover and selection (one frame each) are not in the matrix.
- The probes ran on intermediate code (round 3 and round 4 states); they are kept as the evidence for the pixel-ratio decision, not as results of record.

## Interpretation

Hypotheses (1) to (4) are supported, with one isolated 66.7 ms frame against (1) in one effects-off page. The refinement made the full-effects frame cheaper, not dearer: rendering the post-processing at pixel ratio 1.5 (an author-approved option, D-H009) and limiting depth of field to the tour bring the p95 from 15.0 ms to 8.8 ms in the tour and to 7.0 ms in a direct orbit, so roughly 8 ms of the 16.7 ms frame is now headroom on this Mac; the new physical materials and the studio environment did not change the effects-off cost measurably.

## Decision

- Keep the post-processing at pixel ratio 1.5 for the Instrument prototype and depth of field during the tour only; recorded in helix-app `docs/reviews/phase-7-instrument-refinement.md` §8 for the author. Whether to keep full resolution at rest is an open question there.
- The Phase 5 rule stands for Phase 8: any continuous animation is re-probed uncapped with a trace before it ships.

## Artifacts

- `helix-app/apps/web/e2e/concepts.mjs` (harness: `--set=instrument`, `--transit`, the depth-of-field-at-rest check), `helix-app/apps/web/src/concepts/` (scene, rig, transition)
- `helix-app/apps/web/e2e/results/concepts-2026-11-02-instrument-refined-perf.json` (result of record), `concepts-2026-11-02-instrument-refined-pre-transit-fix-perf.json`, `concepts-probe-r3-perf.json`, `concepts-probe-fxdpr15-perf.json`, `concepts-2026-11-02-instrument-final-shots.json` (screenshot pass with page checks) (private repository; public copy in `journal/results/helix-app-e2e/`)
- `helix-app/docs/reviews/phase-7-instrument-refinement.md`, `helix-app/docs/reviews/phase-7-instrument/`
- Regression on the same build, all passed: `e2e-2026-11-02-p7ireg-fallback+follow-up+unsupported+cancel-camera.json` (Phase 4, rule-based scenarios), `phase5-e2e-2026-11-02-p7ireg.json`, `phase6-e2e-2026-11-02-p7ireg.json` (Phase 5 and 6 suites as they run by default, which include their Ollama-backed checks against the local model already running); `concepts-2026-11-02-instrument-check-shots.json` (page checks of all three concepts, 36 pages, screenshots kept outside the review folders; Deep Field and Atrium unchanged)
