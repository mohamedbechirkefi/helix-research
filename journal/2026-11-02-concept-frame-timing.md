<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HX-P7-2026-11-02-concept-frame-timing: frame timings of the three Phase 7 art-direction scenes

```yaml
id:            HX-P7-2026-11-02-concept-frame-timing
date:          2026-11-02
hypothesis:    The three concept DNA World scenes (Deep Field, Instrument, Atrium; ROADMAP P7.1.1), built
               on the real 628-nt HBB cDNA with R3F frameloop "demand", (1) hold 60 Hz with vsync on in
               every mode (full effects, effects off, reduced motion, low power) while the cinematic
               tour plays and during a direct orbit; (2) render no frame once the move ends (the Phase 5
               long-frame rule); (3) show no frame over 50 ms even with the frame cap removed.
               Contradicted by a median over 16.8 ms or frames over 33.4 ms with vsync on, by any frame
               rendered while idle, or by long frames uncapped.
git_commit:    helix-app 78cbed3 (private repository; public copy of the result files in
               `journal/results/helix-app-e2e/`); the first matrix ran on the same code minus one line
               (`gl.compile` before the first frame, ConceptCanvas.tsx), see Methods
config:        helix-app apps/web/e2e/concepts.mjs --perf --repeats=3; per concept x mode x vsync on|off,
               three fresh pages; per page: 1.5 s settle, the full tour (Deep Field 14 s cubic in-out,
               Instrument 12 s quintic in-out, Atrium 16 s sine in-out; not in reduced motion), 0.5 s,
               a scripted 4 s orbit (one orbit step per rAF), then 2 s idle after each move; modes: full
               (UnrealBloomPass, BokehPass, OutputPass, 4x MSAA half-float target), fx-off (no
               post-processing), reduced-motion (full effects, no tour), low-power (no post-processing,
               no particles, pixel ratio 1, lighter geometry)
seeds:         n/a (deterministic scenes and camera paths); 3 repeats per condition, 72 pages per matrix
data_version:  data/curated/hbb at 66d1d07 (the pinned helix-research commit; unchanged)
hardware:      Apple M1 Pro, 16 GB, macOS 15.3.1; Chrome 156.0.8078.74 headless, ANGLE Metal;
               1440 x 900 CSS pixels at device pixel ratio 2
duration:      about 31 minutes per matrix (two matrices) plus two 3-minute probes
cost:          0
```

## Methods

The page is `?concept=<id>&screen=dna&tour=off[&mode]`. In the page, a rAF loop records every frame interval and a PerformanceObserver records Long Animation Frames, while either the tour plays (until it reports done) or a 4 s orbit runs. The rig renders each frame itself (useFrame priority 1) and records the CPU time of the render call. After each move the harness counts frames rendered in 2 s of idle. With vsync on the rAF interval is the visible frame time; with vsync off (`--disable-gpu-vsync --disable-frame-rate-limit`) it approximates the per-frame cost.

Sequence: matrix 1 (`concepts-2026-11-02-perf-before-precompile.json`); a reproducible Atrium stall was found, so the scene was changed to compile every material before the first frame (`gl.compile(scene, camera)`), probe A re-ran Atrium vsync off once (`concepts-probe-precompile-perf.json`), probe B did the same with an 8 s settle before the moves (`concepts-probe-settle8s-perf.json`, harness option `--settle=8000`), then matrix 2 ran on the final code (`concepts-2026-11-02-perf.json`). Matrix 2 is the result of record; matrix 1 agrees with it in every row.

## Raw results + uncertainty

From `concepts-2026-11-02-perf.json` (all frame intervals of the three pages pooled per row; frames in a tour: 715 to 962 with vsync on).

| Concept | Mode | Move | vsync on: median / p95 / max ms | vsync on: frames > 33.4 ms (of all) | vsync off: median / p95 ms | vsync off: max ms, frames > 50 ms | Idle frames after the move |
|---|---|---|---|---|---|---|---|
| Deep Field | full | tour | 16.7 / 16.7 / 33.3 | 0 of 2522 | 13.3 / 14.7 | 36.4, 0 | 0 |
| Deep Field | full | 4 s orbit | 16.7 / 16.8 / 33.3 | 0 of 720 | 12.9 / 14.7 | 33.2, 0 | 0 |
| Deep Field | fx-off | tour | 16.7 / 16.7 / 16.8 | 0 of 2523 | 2.3 / 3.0 | 81.5, 2 | 0 |
| Deep Field | fx-off | 4 s orbit | 16.7 / 16.7 / 16.8 | 0 of 723 | 0.3 / 2.9 | 237.1, 21 | 0 |
| Deep Field | reduced-motion | 4 s orbit | 16.7 / 16.7 / 16.8 | 0 of 723 | 12.9 / 14.7 | 51.5, 1 | 0 |
| Deep Field | low-power | tour | 16.7 / 16.7 / 16.8 | 0 of 2526 | 0.5 / 2.7 | 6.6, 0 | 0 |
| Deep Field | low-power | 4 s orbit | 16.7 / 16.7 / 16.8 | 0 of 723 | 0.4 / 2.6 | 18.4, 0 | 0 |
| Instrument | full | tour | 16.7 / 16.8 / 33.4 | 0 of 2158 | 13.5 / 15.0 | 48.6, 0 | 0 |
| Instrument | full | 4 s orbit | 16.7 / 16.8 / 33.4 | 0 of 713 | 13.2 / 15.0 | 33.8, 0 | 0 |
| Instrument | fx-off | tour | 16.7 / 16.7 / 16.8 | 0 of 2166 | 2.5 / 3.4 | 7.5, 0 | 0 |
| Instrument | fx-off | 4 s orbit | 16.7 / 16.7 / 16.8 | 0 of 723 | 2.3 / 3.3 | 18.8, 0 | 0 |
| Instrument | reduced-motion | 4 s orbit | 16.7 / 16.8 / 33.4 | 0 of 707 | 12.9 / 15.0 | 32.9, 0 | 0 |
| Instrument | low-power | tour | 16.7 / 16.7 / 33.4 | 0 of 2165 | 1.6 / 2.8 | 4.9, 0 | 0 |
| Instrument | low-power | 4 s orbit | 16.7 / 16.7 / 16.8 | 0 of 723 | 0.5 / 2.7 | 18.6, 0 | 0 |
| Atrium | full | tour | 16.7 / 16.8 / 33.3 | 0 of 2885 | 13.3 / 14.8 | 2755.6, 3 | 0 |
| Atrium | full | 4 s orbit | 16.7 / 16.7 / 33.4 | 0 of 719 | 13.2 / 15.0 | 33.5, 0 | 0 |
| Atrium | fx-off | tour | 16.7 / 16.7 / 16.8 | 0 of 2886 | 2.4 / 3.1 | 1130.8, 3 | 0 |
| Atrium | fx-off | 4 s orbit | 16.7 / 16.7 / 33.4 | 0 of 722 | 2.3 / 3.1 | 18.7, 0 | 0 |
| Atrium | reduced-motion | 4 s orbit | 16.7 / 16.7 / 16.8 | 0 of 723 | 0.7 / 14.5 | 2767.9, 3 | 0 |
| Atrium | low-power | tour | 16.7 / 16.8 / 16.8 | 0 of 2886 | 0.4 / 2.8 | 849.0, 3 | 0 |
| Atrium | low-power | 4 s orbit | 16.7 / 16.7 / 16.8 | 0 of 723 | 0.4 / 2.6 | 18.5, 0 | 0 |

- **CPU time of the render call:** at most 2.4 ms p95 with vsync on in every row; with vsync off it follows the frame time (12.3 to 13.3 ms median with full effects), which indicates the render call blocks on the GPU (back-pressure) rather than spending CPU.
- **Cost of post-processing (vsync off, tours):** 13.3 to 13.5 ms median with effects against 2.3 to 2.5 ms without, at 2880 x 1800 pixels; p95 with effects 14.7 to 15.0 ms, about 2 ms under a 60 Hz frame.
- **Idle:** 0 frames after each of the 126 moves (54 tours, 72 orbits).
- **Atrium stall (vsync off only):** exactly one per page in all 12 uncapped Atrium pages: at 2,599 to 2,613 ms into the tour, or 2,023 to 2,062 ms into the orbit in reduced motion (where it is the first move); 2,751 to 2,756 ms long with effects, 1,062 to 1,131 ms without, 759 to 849 ms in low power, 2,746 to 2,768 ms in reduced motion; one LoAF each with a blocking duration of about the frame's length. Matrix 1 shows the same values (2,761 to 2,794 ms with effects).
- **Probe A (materials compiled before the first frame):** stall unchanged (2,743 ms full, 1,112 ms fx-off, 2,775 ms reduced motion, 857 ms low power).
- **Probe B (8 s settle before the moves):** stall unchanged and at the same offset from the move's start (2,598 ms into the tour full; 2,031 ms into the orbit in reduced motion), so it is not tied to time since load.
- **Deep Field without effects, vsync off:** 21 frames of 122 to 237 ms during the orbits (about every 0.3 to 0.6 s), 2 frames of 54 and 82 ms in the tours; matrix 1: 22 and 2. With effects: one 51.5 ms frame in one reduced-motion orbit (none in matrix 1); none in low power.
- **Instrument:** no frame over 50 ms in either matrix.

## Failures

- No harness check failed (72 of 72 pages in both matrices: no page error, idle frames 0).
- The precompile change did not remove the Atrium stall; it is kept (harmless, and it removes a possible first-sight compile) but it is not a fix.

## Limits / confounders

- One machine, headless Chrome, three repeats, pixel ratio 2 only; vsync off is a stress condition, not what users run.
- No GPU timer queries and no Chrome trace: the cause of the stalls is inferred, not observed.
- The Mol* canvas is not on the page during these runs; a concept scene animating beside Mol* is not measured.
- The orbit is scripted (one step per rAF), not real pointer input.

## Interpretation

Hypotheses (1) and (2) are supported for all three concepts: with vsync on, every mode holds 60 Hz with no frame over 33.4 ms, and the canvas returns to zero frames as soon as a move ends. Hypothesis (3) is supported for Instrument only. Atrium has a reproducible multi-second stall about 2 to 2.6 s after continuous uncapped rendering starts, whatever the mode; its length scales with the per-frame GPU cost, which fits the GPU command-buffer back-pressure traced in HX-P4-2026-11-02-long-frame and seen in HX-P5-2026-11-02-long-frame-reprobe, but it is specific to the Atrium scene (porcelain physical materials with sheen and clearcoat, a spot light) and was not traced. Full post-processing costs about 80 % of the frame and leaves about 2 ms of p95 headroom at pixel ratio 2 on this Mac.

## Decision

- Record the three concepts as meeting the 60 Hz bar with vsync on, in every mode; recorded in helix-app `docs/art-direction.md` §6 for the author's choice (P7.1.2).
- If Atrium is chosen, a Chrome trace of the stall is a precondition of Phase 8 (Phase 5 rule: continuous R3F animation must be re-probed uncapped with a trace).
- Phase 8 budget: post-processing resolution should be capped or scaled (open question 7 in `docs/art-direction.md`), since the effects use most of the frame at pixel ratio 2.

## Artifacts

- `helix-app/apps/web/e2e/concepts.mjs` (harness), `helix-app/apps/web/src/concepts/` (scenes and rig)
- `helix-app/apps/web/e2e/results/concepts-2026-11-02-perf.json` (result of record), `concepts-2026-11-02-perf-before-precompile.json`, `concepts-probe-precompile-perf.json`, `concepts-probe-settle8s-perf.json`, `concepts-2026-11-02-shots.json` (screenshot pass with page checks) (private repository; public copy in `journal/results/helix-app-e2e/`)
- `helix-app/docs/art-direction.md`, `helix-app/docs/reviews/phase-7-concepts.md`
- Regression on the same build, rule-based planner, all passed: `e2e-2026-11-02-p7reg-fallback+follow-up+unsupported+cancel-camera.json`, `phase5-e2e-2026-11-02-p7reg.json`, `phase6-e2e-2026-11-02-p7reg.json` (Phase 4, 5 and 6 suites)
