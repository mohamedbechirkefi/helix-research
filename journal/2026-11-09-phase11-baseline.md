# HX-P11-2026-11-09-baseline: P11.0, the performance baseline on a quiet machine

```yaml
id:            HX-P11-2026-11-09-baseline
date:          2026-11-09
phase:         P11 (P11.0; carried items C1 idle frames and C2 the long frame)
hypothesis:    On a quiet machine the current build meets every budget of plan section 3.1; the single long frames of earlier runs (63.3 ms at the Phase 10 gate, 71.7 and 76.3 ms on 2026-11-09) were load from other work and do not recur.
git_commit:    build of record helix-app 3a1a680 (deviation: the plan named fefa19f, but the idle-frame and layout changes since mean a baseline of fefa19f would describe code that no longer ships); harness change and results in helix-app 5eeb83d
config:        shipped-frames.mjs at dpr 1, dpr 2 and dpr 2 low power with vsync on (5 pages each; dpr 1 and 2 also 5 uncapped pages); one dpr 2 low-power page with --trace-idle=1; budgets.mjs with the three frame files, and with &power=low; then a dpr 1 vsync-on rerun of 5 pages with the new --loaf=1 (Long Animation Frame entries over 33.4 ms with script attribution) and --trace-idle=1 (now also covering the at-rest window)
seed:          none
data_version:  the five curated sets at helix-research c045aed
hardware:      Apple M1 Pro, 16 GB, macOS 15.3.1; Chrome 156 headless; the author closed their own work and left the machine idle from 21:57 to 22:24 UTC; still running: the VS Code window hosting the coordinating session (about 27 % of one core), the author's idle preview server on port 5190, Ollama (idle), mongod (idle)
duration:      21:57:54 to 22:24:27 UTC
cost:          0
```

## Measurements

Budgets with the frame files (`budgets-p11-baseline.json`): 27 of 29 pass, exit 1. Low-power budgets (`budgets-p11-baseline-power-low-power-low.json`): 17 of 17, exit 0. Start: page load to scene ready 192 ms, welcome interactive 198 ms, DNA World ready 425 ms, bytes before scene ready 741.2 kB, bytes at rest 1,993.8 kB (budget 2,000 kB: 6.2 kB of headroom), heap at rest 38 MB. Structure: cold switch to Protein World 1,071 ms, warm 745 ms, back to DNA 742 ms, heap growth 1.5 % over 6 round trips. Bundle: all assets 2,001.2 kB gzip (budget 2,100), scene chunk 968.8 kB.

The two failures are both on page 1 of the dpr 1 vsync-on run: one 141.8 ms frame during the DNA World tour (budget: 0 frames over 33.4 ms) and one idle frame at rest (budget 0). Pages 2 to 5 at dpr 1, all 5 pages at dpr 2 and all 5 at dpr 2 low power had neither; their worst frames were 20.6 to 22.9 ms. Idle frames in Protein World: 0 on every page (C1 holds).

The Long Animation Frame rerun (`shipped-frames-p11-baseline-loaf-dpr1.json`, 5 pages): 0 frames over 33.4 ms in any budgeted move and 0 idle frames at rest on every page. The only long animation frames were outside the budgeted windows, the same on every page: at start (the main module, about 56 ms; a message handler and the first frame callback, 176 to 257 ms; the scene module's evaluation, 138 to 142 ms) and at the switch into Protein World (a click handler, 82 to 96 ms of script, then Mol*'s message handlers and frame callbacks, 83 to 126 ms per frame).

Across every vsync-on frame file since the Phase 10 gate, a single frame over 33.4 ms appears on 4 pages: page 3 of `p10-gate-dpr2` (63.3), page 1 of `p11-dpr1` (71.7), page 3 of `p11-rerun-dpr1` (76.3) and page 1 of `p11-baseline-dpr1` (141.8), each in a different move or at a different point of the tour.

## Interpretation

The hypothesis does not hold as stated: on a quiet machine one long frame recurred (1 of 15 vsync-on pages in the first pass, 0 of 5 in the attributed rerun), so load from other work does not explain it alone. Its cause is not attributed: it did not recur once the Long Animation Frame observer was on. It is rare (4 of about 45 vsync-on pages since the gate), single, and not tied to a page index or a move. The idle frame at rest is new in the record and was not reproduced either. Every other budget passes with margin, except the bytes at rest, where 6.2 kB of headroom remains. For the author: whether a budget of "0 frames over 33.4 ms per page" should hold against a rare single frame, or be restated over a number of pages, is a budget decision (question 83 brings the new values to the author anyway).

## Failures

Budgets exit 1 (above). The traced low-power page's file is ignored by the repository's ignore rules and stays local.
