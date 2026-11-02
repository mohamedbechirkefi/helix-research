<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HX-P5-2026-11-02-transitions: DNA <-> Protein transitions, their cost, interruption and state

```yaml
id:            HX-P5-2026-11-02-transitions
date:          2026-11-02
hypothesis:    A world switch between DNA World (R3F) and Protein World (Mol*) completes in about the fade
               time when nothing must load, keeps each world's state (selection, DNA camera, loaded
               structure, highlight, Mol* camera) across a round trip, holds the 60 Hz frame budget during
               the fade, never lets both layers take the pointer, and can be interrupted by Stop, Escape or
               a pointer press, returning at once to the world it started from with nothing lost.
               Contradicted by a lost or changed state, a frame over 50 ms in a fade, two pointer owners,
               an interrupted transition that ends in the target world, or a cancelled load that leaves a
               structure.
git_commit:    helix-app 4962491 (private repository); helix-research packages and data pinned at a13c1ec
config:        helix-app apps/web/e2e/phase5.mjs scenarios transitions (--runs=5, fade 700 ms, camera
               700 ms) and interrupts (?fadeMs=3000); Phase 4 suite apps/web/e2e/run.mjs as regression
               (--runs=5 --ollama-runs=3 --tag=2026-11-02-p5reg)
seeds:         n/a; 5 transition runs and 9 interrupt runs, each in a fresh browser context
data_version:  data/curated/hbb at a13c1ec
hardware:      Apple M1 Pro, 16 GB, macOS 15.3.1; Chrome 156.0.8078.74 headless, ANGLE Metal, vsync on
duration:      not recorded separately
cost:          0
llm:           (regression suite only) local Ollama 0.40.6, ministral-3:8b, 2026-11-02, the Phase 4
               parameters and prompt (HX-P4-2026-11-02-ai-to-world-e2e); 3 reference calls, 3 cancelled and
               3 follow-up calls, 2 calls in the stale scenario; plans stored in the result file
```

## Methods

- **Round trip** (5 runs): select codon 7, switch to Protein World (cold: 2HBS not loaded), back to DNA World, then to Protein World again (warm). Each navigation's run time is taken in the page from the plan submission to its end; the fade time and the longest rAF interval during the fade come from the stage's transition log. State is compared before and after: DNA camera goal, selection, Mol*'s selection read-back, structure count in Mol*'s hierarchy, Mol* camera position, layer opacity, visibility and pointer-events.
- **Interrupts** (9 runs): a 3,000 ms fade; 700 ms after it starts, Stop, Escape or a pointer press on the stage; three cases each: cold DNA -> Protein (load in progress), warm DNA -> Protein, Protein -> DNA. Latency is from the input to the transition record reading "interrupted". Then the same navigation again (recovery).
- **Pointer owner**: on every animation frame of every page, a sampler records whether both layers have `pointer-events: auto`, or either has it while a transition runs.

## Raw results + uncertainty

From `helix-app/apps/web/e2e/results/phase5-e2e-2026-11-02.json` (passed, 0 failures):

| Navigation (n = 5) | Plan | Run time median (min to max) |
|---|---|---|
| DNA -> Protein, cold | loadStructure, focusCamera, highlightResidue | 1,754.3 ms (1,737.5 to 1,778.2) |
| Protein -> DNA | enterWorld | 715.4 ms (703.7 to 723.1) |
| DNA -> Protein, warm | enterWorld | 719.1 ms (717.4 to 721.7) |

- Fade duration median 712.7 ms (700.8 to 717.7, n = 15); longest frame during a fade median 19.5 ms, maximum 25.0 ms.
- Every round trip kept the codon 7 selection, the DNA camera goal (equal to before the dolly), the 2HBS structure in the hidden Mol* viewer, the read-back VAL B6, D6, F6, H6, and the Mol* camera (moved 0 A in 5 of 5 runs). In Protein World the DNA layer was hidden with `pointer-events: none`, and the reverse in DNA World.
- **Interrupts:** 9 of 9 cancelled the navigation and ended in the starting world with that world's pointer owner and layers; latency median 29 ms (8 to 40 ms): Stop 35, 36, 40 ms; Escape 16, 13, 8 ms; pointer 35, 29, 19 ms. The fade was mid-way (DNA opacity about 0.89 or 0.11) at the interrupt. Selection kept in 9 of 9; the cold cases left no structure (store and Mol* hierarchy both empty); the warm and Protein -> DNA cases kept 2HBS, the highlight and the Mol* camera. Recovery completed in 9 of 9.
- **Pointer owner:** 0 frames with two owners and 0 frames with an owner during a transition, in every page of the suite.
- **Phase 4 regression** (`e2e-2026-11-02-p5reg.json`, passed, 0 failures): the reference question now starts in DNA World, so its plan crosses the transition: question to the first draw after the verified highlight, deterministic planner, median 1,791.1 ms (1,757.2 to 1,808.9, n = 5), against 1,060.9 ms in Phase 4; ministral-3:8b planning median 15,527.5 ms (n = 3). Camera cancel median 27 ms (n = 6), inference cancel 12 to 28 ms (n = 3); stale and follow-up cases unchanged.

## Failures

- None in the stored runs. A development run of the rapid-interaction scenario (HX-P5-2026-11-02-modes-rapid) found a consistency defect fixed before these runs.

## Limits / confounders

- Run times are page timestamps from plan submission to the end of the run; the cold case includes the 2HBS load, a 700 ms fade and a 700 ms camera move.
- Headless Chrome at 60 Hz on one fast laptop; Safari, Firefox and WKWebView not run; no low-end hardware.
- The longest-frame figures are rAF intervals in the fade loop, not GPU timings.

## Interpretation

Supported on this machine: a warm world switch costs the fade (about 0.72 s), a cold one about 1.75 s; both directions keep every world's state; an interrupt returns to the starting world in at most 40 ms with nothing lost, and a load cancelled mid-transition leaves no structure. Starting in DNA World adds about 0.73 s to the Phase 4 reference question.

## Decision

**Continue.** Fade length (700 ms) is a tuning value for Phase 7/8.

## Artifacts

- `helix-app/apps/web/e2e/results/phase5-e2e-2026-11-02.json` (scenarios `transitions`, `interrupts`), `e2e-2026-11-02-p5reg.json` (private repository)
- `helix-app/docs/reviews/phase-5-shots/protein-after-round-trip.jpg`, `transition-mid-fade.jpg`, `transition-interrupted.jpg`, `phase4-regression/*.jpg`
