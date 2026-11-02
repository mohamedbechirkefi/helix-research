<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HX-P5-2026-11-02-long-frame-reprobe: the Mol* spin long frame with an R3F canvas on the page

```yaml
id:            HX-P5-2026-11-02-long-frame-reprobe
date:          2026-11-02
hypothesis:    Carried from HX-P4-2026-11-02-long-frame: now that an R3F canvas shares the page with Mol*,
               the long frame at the start of a Mol* spin may return; R3F frameloop "demand" (render only
               on change) should avoid it, while "always" should reproduce it when both canvases are
               visible and frames are uncapped. Contradicted if "demand" shows long frames, or if "always"
               never does.
git_commit:    helix-app 4962491 (private repository). The first set (no ghost) ran on the same code minus
               the diagnostics-only `ghostDna` option, which defaults to off.
config:        helix-app apps/web/e2e/longframe-p5.mjs: R3F frameloop always | demand; with or without
               eight real clicks on the Mol* canvas before the spin; vsync on | off; set 1 with DNA World
               hidden in Protein World (the app's behaviour), set 2 with DNA World kept visible at 12 %
               opacity over Mol* (?ghostDna=0.12, as in the P1.4.2 overlay); two 3 s Mol* spins per page
seeds:         n/a; 2 repeats per condition, each in a fresh browser context
data_version:  data/curated/hbb at a13c1ec (2HBS revision 1.5)
hardware:      Apple M1 Pro, 16 GB, macOS 15.3.1; Chrome 156.0.8078.74 headless, ANGLE Metal
duration:      about 15 minutes in total (not recorded precisely)
cost:          0
```

## Methods

The page loads 2HBS through the reference question (Protein World on screen, DNA World behind it). Per page: optional eight camera aims, each followed by a real click on the Mol* canvas centre; then two 3 s Mol* spins 1 s apart, recording rAF intervals, frames over 50 ms, Chrome Long Animation Frame entries with script attribution, and the number of frames R3F rendered during each spin. Separately, R3F frames rendered in 2 s of idle DNA World.

## Raw results + uncertainty

**R3F frames while idle (2 s):** always 120 (vsync on) and 3,136 to 3,139 (vsync off); demand 0 in every case.

**Set 1, DNA World hidden** (`longframe-p5-2026-11-02.json`), 16 pages, 32 spins: no frame over 50 ms and no Long Animation Frame anywhere. Longest frame 16.8 ms with vsync on; 6.1 to 14.3 ms with vsync off. R3F rendered 193 to 253 frames per spin with "always" (vsync on), 867 to 1,040 (vsync off), and 0 with "demand".

**Set 2, DNA World visible at 12 %, vsync off** (`longframe-p5-2026-11-02-vsync-off-ghost0.12.json`):

| frameloop | clicks | longest frame, spin 1 and spin 2 (2 repeats) |
|---|---|---|
| always | no | 2,327.3 and 2,305.7 ms; 2,208.4 and 2,363.0 ms |
| always | yes | 1,935.6 and 2,275.8 ms; 1,944.4 and 2,234.6 ms (plus one 185 to 202 ms frame) |
| demand | no | 7.8 and 7.4 ms; 7.1 and 7.3 ms (no LoAF) |
| demand | yes | 6.4 and 7.2 ms; 6.2 and 5.9 ms (no LoAF) |

- Each long frame is one Long Animation Frame at the start of the spin (about 26 ms in), whose only script is a `FrameRequestCallback` of about the frame's length; blocking duration about 2.2 s.
- R3F rendered 1,880 to 2,718 frames per spin with "always" in this set.

**Set 2 with vsync on** (`longframe-p5-2026-11-02-vsync-on-ghost0.12.json`): no frame over 16.8 ms, no LoAF, in all 8 pages.

## Failures

- None. No Chrome trace was recorded in this probe, so the cause is not observed directly (see limits).

## Limits / confounders

- Two repeats per condition, one machine, headless Chrome; vsync off is a stress condition, not what users run.
- The ghost overlay is a diagnostics option, not an app state; in the app both canvases are visible only during a fade, where frames stayed under 25 ms (HX-P5-2026-11-02-transitions).
- Cause inferred, not traced: consistent with the GPU command-buffer back-pressure traced in Phase 4 (a much heavier R3F scene now: 4 x 628 instances against the 14-codon bridge scene), but not re-traced here.

## Interpretation

The hypothesis is supported. With R3F rendering every frame on a visible canvas and frames uncapped, the stall at Mol* spin start returns and is far longer than in Phase 1 (about 2.2 s, against 0.2 to 0.4 s), and prior clicks are no longer needed to trigger it. With frameloop "demand", R3F renders nothing while idle or while Mol* spins, and no long frame appears in any condition. Hiding the DNA layer in Protein World also avoids it, even with "always".

## Decision

**Continue with frameloop "demand"** (already the Phase 5 default) and the DNA layer hidden in Protein World; "always" is rejected. Any later continuous R3F animation over Mol* (Phase 8) must be re-probed with vsync off and a trace.

## Artifacts

- `helix-app/apps/web/e2e/longframe-p5.mjs`
- `helix-app/apps/web/e2e/results/longframe-p5-2026-11-02.json`, `longframe-p5-2026-11-02-vsync-off-ghost0.12.json`, `longframe-p5-2026-11-02-vsync-on-ghost0.12.json` (private repository)
