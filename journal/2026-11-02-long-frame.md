<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HX-P4-2026-11-02-long-frame: the long frame at the start of a Mol* spin (claim C19)

```yaml
id:            HX-P4-2026-11-02-long-frame
date:          2026-11-02
hypothesis:    The single 290 to 400 ms frame at the start of a Mol* spin in the P1.4.2 bridge page is a
               one-off shader or representation rebuild of the focus or contact components (the P1 guess).
               Supported if it occurs once per page and disappears without those components; contradicted
               if it recurs at every spin or depends on something else.
git_commit:    helix-app 1ce822f (probes); bridge page = the existing build of
               research/experiments/molstar-r3f-bridge (19b31ba), served read-only, unchanged
config:        helix-app apps/web/e2e/longframe.mjs (the Phase 4 app) and e2e/longframe-bridge.mjs (the
               bridge page); spins of 3 to 4 s; vsync on and off (--disable-gpu-vsync
               --disable-frame-rate-limit); Chrome Long Animation Frame entries; one Chrome trace
seeds:         n/a; 1 or 2 repeats per condition, each in a fresh browser context
data_version:  2HBS.cif (revision 1.5)
hardware:      Apple M1 Pro, 16 GB, macOS 15.3.1; Chrome 156.0.8078.74 headless, ANGLE Metal
duration:      about 20 minutes in total (not recorded precisely)
cost:          0
```

## Methods

1. **The Phase 4 app (one Mol* canvas):** conditions load-only, reference (selection, focus representation, components, label), reference then cleared, reference then 5 s idle, and three with the pointer resting over the canvas (with and without a prior click). Two spins per page.
2. **The bridge page (Mol* and an always-rendering R3F canvas), vsync off:** its original harness steps (an R3F click on codon 7; eight Mol* camera aims, each followed by a real click on the Mol* canvas) were run in subsets before its own four frame measurements (idle, Mol* spin, R3F spin, both).
3. A Chrome trace of the Mol* spin after the original sequence, summarised by `e2e/analyze-trace.mjs` (the 350 MB raw trace is not committed).

## Raw results + uncertainty

**Phase 4 app:** no frame over 50 ms and no Long Animation Frame entry in any condition: maximum 16.8 ms with vsync on (4 conditions), 8.2 ms with vsync off (4 conditions x 2 repeats) and 7.5 ms in the 3 pointer conditions (x 2). Files: `longframe-2026-11-02.json`, `longframe-2026-11-02-uncapped.json`, `longframe-2026-11-02-uncapped-load-only-pointer-over+reference-pointer-over+reference-clicked-pointer-over.json`.

**Bridge page, vsync off, longest frame of the Mol* spin (M) and of the spin of both (MR), 2 repeats each** (`longframe-bridge-2026-11-02.json` and the two files with variant suffixes):

| Variant | M | MR |
|---|---|---|
| original sequence (R3F click and Mol* clicks) | 277.3 and 179.5 ms (the second run traced) | 305.3 and 294.9 ms |
| no clicks | 36.5, 36.5 ms | 37.0, 37.8 ms |
| R3F click only | 71.4, 69.7 ms | 72.3, 55.9 ms |
| Mol* clicks only | 287.1, 271.4 ms | 300.6, 301.2 ms |
| Mol* clicks, pointer moved away | 288.8, 277.1 ms | 305.0, 293.7 ms |
| Mol* close-up camera, no click | 5.0, 6.1 ms | 5.2, 4.9 ms |
| Mol* clicks, then camera reset | 295.9, 305.6 ms | 296.1, 292.0 ms |
| Mol* clicks, then focus, selection and highlight cleared | 230.9, 232.8 ms | 272.4, 269.7 ms |
| Mol* clicks, no R3F canvas (`?r3f=0`) | 5.8, 5.6 ms | 5.1, 5.8 ms |
| close-up, no R3F canvas | 5.4, 5.4 ms | 5.4, 5.5 ms |

- The long frame occurs in **both** spin measurements of each page (M, then MR after an R3F-only spin), so it is not a one-off.
- Each long frame is one Long Animation Frame whose only script is a `FrameRequestCallback` (Mol*'s render loop) of about the frame's length.
- **Trace** (`longframe-bridge-trace-summary.json`): the longest animation frame lasted 195.6 ms (the next longest 7.4 ms). Inside it, the renderer main thread spent 194.7 ms in `CommandBufferHelper::WaitForAvailableEntries` / `CommandBufferProxyImpl::WaitForGetOffset`, starting 0.2 ms into the frame: it was waiting for space in the GPU command buffer, not running JavaScript. The GPU process main thread ran 3,565 short tasks in that window, the longest 0.29 ms; no long GPU-process task was recorded.
- With vsync on, neither page showed it (P1 results and the app's vsync-on run).

## Failures

- The first trace (from the first two-variant run) was overwritten by the second run; only the second is summarised.

## Limits / confounders

- Two repeats per variant, one machine, headless Chrome, vsync off only for the bridge.
- What the Mol* clicks leave behind that matters was not isolated: clearing focus, selection and highlight did not remove it. Hypothesis (unverified): after real clicks Mol*'s picking state makes it render its pick passes when the camera starts moving, and with a second WebGL context rendering every frame uncapped, the Mol* command stream backs up.

## Interpretation

The P1 guess is **contradicted**: the long frame is not a one-off rebuild of the focus or contact components. It is a main-thread stall waiting for GPU command-buffer space, at the start of every Mol* spin, and it needs both a second always-rendering WebGL canvas and prior real clicks on the Mol* canvas, with vsync off. It does not occur in the Phase 4 app, which has a single canvas. The exact Mol* state that triggers it is still unexplained.

## Decision

**Continue, with a carried task.** Phase 5, when an R3F layer joins the page, must re-run this probe (and try R3F `frameloop="demand"` while Mol* is active) before accepting the two-canvas layout's frame budget.

## Artifacts

- `helix-app/apps/web/e2e/longframe.mjs`, `longframe-bridge.mjs`, `analyze-trace.mjs` (private repository; public copy in `journal/results/helix-app-e2e/`)
- `helix-app/apps/web/e2e/results/longframe-*.json`, `longframe-bridge-trace-summary.json`
