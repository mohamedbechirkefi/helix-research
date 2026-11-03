<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HX-P7-2026-11-03-phase7-adoption-frame-timing: frame timings of the shipped DNA World after the Phase 7 adoption, the D-H012 Instrument scene, and the E2E regression of the design-system build

```yaml
id:            HX-P7-2026-11-03-phase7-adoption-frame-timing
date:          2026-11-03
hypothesis:    (1) The shipped DNA World with the Instrument materials, studio environment and D-H012
               variant marks (P7.3.1) keeps what the Phase 5 scene had: 60 Hz with vsync on in every
               move, no frame over 50 ms, 0 R3F frames while idle at rest, after a move and in Protein
               World, and the same fade cost; contradicted by a frame budget miss or an idle frame.
               (2) The D-H012 changes to the Instrument prototype (effects at full resolution at rest,
               pixel ratio 1.5 only during the tour; coding-strand collars; partial calipers; bridge
               controls) keep 60 Hz with vsync on; the uncapped cost of an orbit rises (full-resolution
               effects) while the tour's stays; contradicted by a capped frame over 50 ms or an idle frame.
               (3) The Phase 4, 5 and 6 rule-based E2E suites pass on the design-system build with the
               bridge sequence in the shipped flow (D-H013) and the welcome headline; contradicted by any
               failed check.
git_commit:    helix-app: before = 22ec62f (last build before the design system); after = the build of
               this entry's helix-app commit (design system 3f4efc4, adoption f7bf906, D-H013 47cdeeb,
               bridge trigger narrowed and harnesses added in the commit that carries this entry);
               helix-research packages and data pinned at af104e2 (private repository; public copies of
               the result files in `journal/results/helix-app-e2e/`)
config:        helix-app apps/web/e2e/shipped-frames.mjs --repeats=3 (vsync on and off; ?journey=off;
               HELIX_BASE on a second preview of 22ec62f for "before"); apps/web/e2e/concepts.mjs --perf
               --only=instrument --repeats=3 --transit (two runs: ds, then ds2 after the harness started
               recording the effects pixel ratio); apps/web/e2e/run.mjs --only=fallback,follow-up,
               unsupported,cancel-camera; apps/web/e2e/phase5.mjs --only=dna-render,bridge,transitions,
               interrupts; apps/web/e2e/phase6.mjs --ollama-runs=0; apps/web/e2e/shots-p7.mjs; concepts.mjs
               --shots --set=instrument
seeds:         n/a; 3 fresh pages per condition for the frame timings; suites as configured above
data_version:  data/curated/hbb at af104e2
hardware:      Apple M1 Pro, 16 GB, macOS 15.3.1; Chrome 156.0.8078.80 headless, ANGLE Metal; 1400 x 820
               CSS pixels at pixel ratio 1 for the shipped-app timings (the suites' viewport), 1440 x 900 at
               pixel ratio 2 for the Instrument prototype; the machine otherwise idle (the AI timing study
               had ended)
duration:      shipped frames about 3 min per build; prototype matrix about 9 min per run; suites about 7 min
cost:          0
llm:           none in the runs of record (the rule-based planner is selected explicitly). One negative
               run is kept: shots-p7 run ds, where the shot harness had not pinned the planner and the app
               auto-selected the local Ollama model (ministral-3:8b) that had become available; its two
               failures were a harness defect (section Failures), not an app defect.
```

## Methods

- **Shipped DNA World, before and after** (`shipped-frames.mjs`): per fresh page, 2 s idle at rest; the camera move to codon 7 (a click on the codon tape), sampled until the rig settles; a 4 s pointer drag along the axis (real pointer events at 60 per second, so each event asks for one frame); 2 s of wheel zoom; then the world round trip DNA to Protein (cold, 2HBS loads) to DNA to Protein (warm) read from the stage's transition log; 2 s idle in Protein World; the Mol* read-back. The frame time is the rAF interval; R3F frames come from the rig's frame counter, so "idle frames" are frames rendered while nothing moves. "vsync on" is what a visitor sees; "vsync off" removes the frame cap and shows the per-frame cost. The "before" build (22ec62f) was built in a detached worktree with the same `node_modules` and served on a second port; the same harness and browser ran against both.
- **Instrument prototype** (`concepts.mjs --perf`): the matrix of HX-P7-2026-11-02-instrument-frame-timing (full, fx-off, reduced-motion, low-power; the 12 s tour, a scripted 4 s orbit, the bridge transition; 3 pages per condition; vsync on and off), with two additions: the harness records the post-processing pixel ratio of every frame rendered during a move and at rest, and fails if full-effects mode does not show 1.5 while the tour plays and the screen's ratio (2) at rest and during an orbit (D-H012).
- **Suites:** the rule-based scenarios of the Phase 4, 5 and 6 suites, as the coordinator asked (the Ollama-backed scenarios are a separate pass by another session). Run ds on the first design-system build; run ds2 after the bridge trigger was narrowed (below). The shipped-app shot pass (`shots-p7.mjs`) checks the welcome (one wordmark, the headline), 0 idle frames at rest, the selection, the bridge chip offered first after a DNA variant answer, the sequence's four stations from the records while it plays (progress, lit stations, live region, controls, focus on the controls, DNA World still on screen), the overlay gone before the fade starts, the Mol* read-back VAL B6/D6/F6/H6 and the Mol* toolbar and hover readout uncovered in Protein World, every station at once under reduced motion, Evidence World's key and chips, the limitations, the loading state (network throttled) and the start failure (manifest blocked).

## Raw results + uncertainty

### Shipped DNA World (`shipped-frames-2026-11-03-ds.json` after, `shipped-frames-2026-11-03-ds-before-22ec62f.json` before; 3 pages per build and vsync setting)

| Move | Build | vsync on: median / p95 / max ms (3 pages) | frames > 33.4 ms | vsync off: median / p95 / max ms | frames > 50 ms | R3F frames in the move | Idle frames after |
|---|---|---|---|---|---|---|---|
| at rest (2 s) | before | | | | | 0, 0, 0 | |
| at rest (2 s) | after | | | | | 0, 0, 0 | |
| camera to codon 7 | before | 16.7 / 17.6 to 17.8 / 17.8 to 18.4 | 0 | 0.1 / 2.3 to 2.4 / 1,702 to 1,812 | 1 per page | 98; uncapped 3,622 to 3,635 | 0 |
| camera to codon 7 | after | 16.7 / 17.6 to 18.1 / 18.1 to 32.1 | 0 | 0.1 / 2.4 / 1,319 to 1,443 | 1 per page | 98; uncapped 2,681 to 2,702 | 0 |
| 4 s drag (60 events per s) | before | 16.7 / 18.1 to 18.3 / 19.4 to 20.7 | 0 | 17.6 to 18.0 / 18.9 to 19.0 / 20.1 to 21.4 | 0 | 240 | 0 |
| 4 s drag (60 events per s) | after | 16.8 / 19.5 to 19.6 / 20.8 to 21.5 | 0 | 17.6 to 18.1 / 20.1 to 20.3 / 21.2 to 22.9 | 0 | 240 | 0 |
| 2 s wheel zoom | before | 16.6 to 16.7 / 19.4 to 19.5 / 21.2 to 22.4 | 0 | 0.2 / 2.4 / 19.5 to 23.5 | 0 | 297; uncapped 3,740 to 3,777 | 0 |
| 2 s wheel zoom | after | 16.7 / 18.7 to 19.2 / 21.2 to 24.3 | 0 | 0.3 / 2.5 / 20.4 to 22.7 | 0 | 296 to 297; uncapped 2,992 to 3,047 | 0 |
| fades (9 per build and setting) | before | 701.2 to 717.2 ms, longest frame 33.7 (one), others at most 25.1 | | 700.3 to 702.3 ms, longest frame 15.9 | | | 0 in Protein World |
| fades (9 per build and setting) | after | 709.5 to 721.8 ms, longest frame 34.9 (one), others at most 19.9 | | 700.1 to 702.0 ms, longest frame 15.8 | | | 0 in Protein World |

- 60 Hz with vsync on in every move of both builds; 0 R3F frames at rest, after every move and in Protein World in all 12 pages; the read-back is VAL B6, D6, F6, H6 in all 12 pages; no page error.
- The longest capped frame moved from 18.4 to 32.1 ms in the codon move (one frame in one page of three; the first frame after the click, when the selection halo and the codon tape's scroll are drawn) and stays under 33.4 ms. The Protein to DNA fade had one 33.7 ms frame before and one 34.9 ms frame after (the first frame of DNA World reappearing), in one of nine fades each; Phase 5 recorded 25.0 ms as the worst fade frame over 15 fades.
- **Uncapped cost** of the scene itself: the wheel move's median rAF interval is 0.2 ms before and 0.3 ms after, p95 2.4 and 2.5 ms, maximum 19.5 to 23.5 and 20.4 to 22.7 ms. The drag is paced by the pointer events (one frame per event), so its 17.6 to 18.1 ms median measures the event rate, not the render. The Instrument materials (clearcoat enamel, environment-mapped metal, three lights) therefore add about 0.1 ms per frame at pixel ratio 1.
- **Pre-existing, not a regression:** with vsync off, the codon move starts with one 1.3 to 1.8 s gap in every page of both builds (3 of 3 before: 1,702 to 1,812 ms; 3 of 3 after: 1,319 to 1,443 ms); nothing of the kind with vsync on (maximum 32.1 ms). It is tied to the start of continuous uncapped rendering after a click, the same class as the Atrium stall of HX-P7-2026-11-02-concept-frame-timing; not traced.
- The cold load wall time with vsync off was 2,402 to 2,437 ms before and 1,847 to 1,905 ms after; with vsync on 1,822 to 1,857 before and 1,864 to 1,890 after. The two builds ran from two preview servers, so the uncapped difference is not attributed to the scene.

### Instrument prototype after D-H012 (`concepts-2026-11-03-ds2-perf.json`, the run of record; `concepts-2026-11-03-ds-perf.json`, the same code before the harness recorded the pixel ratio)

| Mode | Move | Build | vsync on: median / p95 / max ms | vsync on: frames > 33.4 ms (of all) | vsync off: median / p95 ms | vsync off: max ms, frames > 50 ms | Idle frames after the move | Depth of field at rest |
|---|---|---|---|---|---|---|---|---|
| full | tour | refined (2026-11-02) | 16.7 / 16.8 / 33.4 | 0 of 2159 | 8.1 / 8.8 | 27.3, 0 | 0 | 0 |
| full | tour | D-H012 | 16.7 / 16.7 / 50.0 | 1 of 2160 | 8.1 / 8.7 | 27.1, 0 | 0 | 0 |
| full | 4 s orbit | refined | 16.7 / 16.7 / 16.8 | 0 of 723 | 5.4 / 7.0 | 18.7, 0 | 0 | 0 |
| full | 4 s orbit | D-H012 | 16.7 / 16.7 / 33.4 | 0 of 722 | 9.1 / 10.8 | 28.4, 0 | 0 | 0 |
| full | bridge transition (CSS) | refined | 16.7 / 16.8 / 16.8 | 0 of 504 | 0.8 / 1.1 | 18.6, 0 | 0 | n/a |
| full | bridge transition (CSS) | D-H012 | 16.7 / 16.7 / 16.8 | 0 of 504 | 0.9 / 1.2 | 86.5, 1 | 0 | n/a |
| fx-off | tour | refined | 16.7 / 16.8 / 66.7 | 1 of 2160 | 2.6 / 3.7 | 8.4, 0 | 0 | 0 |
| fx-off | tour | D-H012 | 16.7 / 16.8 / 16.8 | 0 of 2162 | 2.6 / 3.7 | 8.4, 0 | 0 | 0 |
| fx-off | 4 s orbit | refined | 16.7 / 16.7 / 16.8 | 0 of 723 | 2.5 / 3.4 | 18.8, 0 | 0 | 0 |
| fx-off | 4 s orbit | D-H012 | 16.7 / 16.7 / 16.8 | 0 of 723 | 2.4 / 3.5 | 18.9, 0 | 0 | 0 |
| fx-off | bridge transition (CSS) | D-H012 | 16.7 / 16.7 / 16.8 | 0 of 504 | 0.9 / 1.2 | 33.3, 0 | 0 | n/a |
| reduced-motion | 4 s orbit | refined | 16.7 / 16.8 / 16.8 | 0 of 723 | 5.3 / 6.9 | 18.8, 0 | 0 | 0 |
| reduced-motion | 4 s orbit | D-H012 | 16.7 / 16.7 / 16.8 | 0 of 723 | 8.1 / 10.7 | 28.2, 0 | 0 | 0 |
| low-power | tour | refined | 16.7 / 16.8 / 33.3 | 0 of 2162 | 2.1 / 2.7 | 3.9, 0 | 0 | 0 |
| low-power | tour | D-H012 | 16.7 / 16.7 / 16.8 | 0 of 2163 | 2.1 / 2.7 | 3.9, 0 | 0 | 0 |
| low-power | 4 s orbit | refined | 16.7 / 16.8 / 16.8 | 0 of 723 | 0.4 / 2.6 | 18.8, 0 | 0 | 0 |
| low-power | 4 s orbit | D-H012 | 16.7 / 16.7 / 16.8 | 0 of 723 | 0.4 / 2.6 | 18.8, 0 | 0 | 0 |
| low-power | bridge transition (CSS) | D-H012 | 16.7 / 16.7 / 16.8 | 0 of 504 | 0.9 / 1.2 | 17.8, 0 | 0 | n/a |

- **Effects pixel ratio (D-H012):** in full-effects mode every page recorded 1.5 while the tour played, 2 (the screen's ratio) at rest and 2 for every frame of the orbit; the harness check passed in 6 of 6 full-mode pages. Depth of field 0 at rest after every move.
- **What changed:** the orbit (not a tour) now renders its effects at full resolution, so its uncapped cost rose from 5.4 / 7.0 to 9.1 / 10.8 ms (median / p95) and the reduced-motion orbit from 5.3 / 6.9 to 8.1 / 10.7 ms; the tour (still at 1.5) is unchanged at 8.1 / 8.7 ms. With vsync on every mode holds 60 Hz: one 50.0 ms frame in one of three full-mode tours (1 of 2,160 frames) and one 33.4 ms frame in the orbit; the earlier run (ds) had instead one 100.1 ms frame in one reduced-motion orbit and none in the tour. These isolated frames are of the kind recorded on 2026-11-02 (one 66.7 ms frame) and are not traced.
- **Bridge transition:** 0.9 / 1.2 ms uncapped, 0 idle frames; one 86.5 ms uncapped frame in one full-mode page (1 of about 1,500 uncapped transition frames across the three modes), none with vsync on.
- The first run (ds): full tour 7.5 / 9.0, orbit 8.6 / 11.0 ms uncapped, every check passed; kept as a second sample of the same code.

### Suites and shots

| Run | Build | Suite | Result | File |
|---|---|---|---|---|
| ds | first design-system build (bridge trigger: plan entity or variant scene) | Phase 4 (fallback, follow-up, unsupported, cancel-camera) | passed, 0 failures; reference question wall 5,030 to 5,117 ms (n = 5) | `e2e-2026-11-03-ds-fallback+follow-up+unsupported+cancel-camera.json` |
| ds | same | Phase 5 (dna-render, bridge, transitions, interrupts) | passed, 0 failures | `phase5-e2e-2026-11-03-ds-dna-render+bridge+transitions+interrupts.json` |
| ds | same | Phase 6 (all rule-based scenarios, `--ollama-runs=0`) | passed, 0 failures | `phase6-e2e-2026-11-03-ds.json` |
| ds2 | final build (trigger: variant scene only) | Phase 4 | passed, 0 failures; reference question wall 1,781 to 1,905 ms (n = 5) | `e2e-2026-11-03-ds2-fallback+follow-up+unsupported+cancel-camera.json` |
| ds2 | final | Phase 5 | passed, 0 failures; cold run 1,766 ms median (1,751 to 1,772), fade 710.8 ms median, longest fade frame 20.0 ms, interrupt latency 21 to 48 ms (n = 9) | `phase5-e2e-2026-11-03-ds2-dna-render+bridge+transitions+interrupts.json` |
| ds2 | final | Phase 6 | passed, 0 failures; the bridge chip (dh008 neutral runs) 5,081 to 5,141 ms wall with the sequence (n = 3); blueprint A's next branch 5,168 ms | `phase6-e2e-2026-11-03-ds2.json` |
| ds | prototype (unchanged by the trigger) | Instrument shot set with page checks (17 pages) | passed, 0 failures | `concepts-2026-11-03-ds-shots.json` |
| ds | first build | shipped shots | **2 failures, harness defect** (planner not pinned; see Failures) | `shots-p7-2026-11-03-ds.json` |
| ds2 | final | shipped shots | passed, 0 failures (bridge overlay with the chain grid overflowing at the right, fixed after) | `shots-p7-2026-11-03-ds2.json` |
| ds3 | final + the grid fix (CSS only) | shipped shots | passed, 0 failures; the sequence appears 266 ms after the chip click, the bridge lands in Protein World 5,173 ms after it (sequence 3,226 ms including the hold); reduced motion 4,646 ms | `shots-p7-2026-11-03-ds3.json` |

- Run ds showed that the first design-system build played the bridge sequence on the Phase 4 reference question from a fresh start (the plan carries the variant entity), which raised that question's wall time from about 1.8 s (Phase 5) to about 5.1 s. The author's decision (D-H013) names "a plan that moves from a DNA-World variant scene to Protein World": the trigger was narrowed to the scene on screen (the session's variant, a comparison, a sequence mark or the variant codon selected), and run ds2 shows the reference question back at 1,781 to 1,905 ms while the bridge chip after a DNA variant answer still plays the sequence (5.1 s).

## Failures

- `shots-p7-2026-11-03-ds.json` (kept): two checks failed because the shot harness had not selected the rule-based planner and the app auto-selected the local model that had become available again; the DNA question then took 19.4 s to plan and the model's bridge plan targeted the selection, so the Mol* read-back was VAL H6 alone rather than the four chains. The suites select the planner explicitly and were unaffected. The harness now pins the planner; ds2 and ds3 pass.
- `shots-p7-2026-11-03-ds2.json` passed its checks, but the bridge overlay's station grid overflowed the stage on the right (the chips' `white-space: nowrap` made the `1fr` columns wider than their share): a layout defect found on the screenshot, not by a check; fixed with `minmax(0, 1fr)` columns and wrapping chips; ds3 is the shot of record.
- Isolated long frames with vsync on: one 50.0 ms frame in one full-mode tour; none in the shipped scene. Not traced (as on 2026-11-02).

## Limits / confounders

- One machine, headless Chrome; the shipped-app timings at pixel ratio 1 (the suites' viewport), the prototype at pixel ratio 2; no GPU timer queries (the uncapped rAF interval stands in for the GPU cost).
- The "before" build was served from a second preview server built in a worktree sharing the current `node_modules` (the workspace packages at their current commits); the DNA World scene code is entirely in `apps/web`, so the comparison isolates the scene, not the packages.
- The drag move is paced by synthetic pointer events (60 per second) and measures the event rate under vsync off.
- The bridge sequence's wall time (about 3.2 s with the hold) is part of every bridge wall time in the suites from this build on; the Phase 5 and Phase 6 baselines for the bridge chip (about 1.8 s) are superseded by design.
- Safari, Firefox and the desktop webview were not run.

## Interpretation

Hypothesis (1) is supported: the shipped DNA World with the Instrument materials holds 60 Hz in every move with vsync on, renders 0 frames while idle in every condition, costs about 0.1 ms more per uncapped frame than the Phase 5 scene, and its fades are unchanged; the one uncapped stall at the start of a move exists in both builds. Hypothesis (2) is supported with the expected trade: at rest and during an orbit the effects now render at the screen's resolution (verified frame by frame), which raises the orbit's uncapped cost by about 3.7 ms median while leaving about 6 ms of headroom at 60 Hz, and the tour keeps its 1.5 ratio and cost. Hypothesis (3) is supported on the final build (ds2 and ds3), after the one finding of run ds (the sequence firing on a fresh-start question) was traced to the trigger's definition and narrowed to the author's wording.

## Decision

- The design-system build with the narrowed bridge trigger is the build of record for Phase 7 (P7.2.2, P7.3.1, D-H013). The Ollama-backed scenarios of the Phase 4, 5 and 6 suites are owed on the same build by the separate model pass.
- Remaining for Phase 8 (unchanged from `helix-app/docs/design-system.md` section 7): the full machined kit and post-processing in the shipped DNA World (needs the E2E adapted), Mol*'s own focus representation (its surroundings keep Mol*'s default carbon colours; the cartoon is in the token tones), visual tuning on screenshots, a screen-reader pass, other browsers.

## Artifacts

- `helix-app/apps/web/e2e/shipped-frames.mjs` (new harness), `helix-app/apps/web/e2e/shots-p7.mjs` (new shot pass with checks), `helix-app/apps/web/e2e/concepts.mjs` (records the effects pixel ratio and checks it in full-effects mode)
- `helix-app/apps/web/e2e/results/`: `shipped-frames-2026-11-03-ds.json`, `shipped-frames-2026-11-03-ds-before-22ec62f.json`, `concepts-2026-11-03-ds2-perf.json` (of record), `concepts-2026-11-03-ds-perf.json`, `concepts-2026-11-03-ds-shots.json`, `e2e-2026-11-03-ds-...json`, `phase5-e2e-2026-11-03-ds-...json`, `phase6-e2e-2026-11-03-ds.json`, the `ds2` counterparts, `shots-p7-2026-11-03-ds.json` (negative), `-ds2.json`, `-ds3.json` (of record) (private repository; public copies in `journal/results/helix-app-e2e/`, `MANIFEST.tsv`)
- `helix-app/docs/reviews/phase-7-shipped/` (the shipped-app shots and the review page), `helix-app/docs/reviews/phase-7-instrument/` (the Instrument shot set re-taken after D-H012), `helix-app/docs/reviews/phase-7-shipped/suites/` (the suites' screenshots of this build)
- `helix-app/docs/design-system.md` (tokens, components, adoption, what remains)
