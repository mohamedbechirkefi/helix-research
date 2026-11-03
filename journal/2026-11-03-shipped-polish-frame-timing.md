# HX-P7-2026-11-03-shipped-polish-frame-timing: the shipped DNA World with the Instrument kit, frame timings and suites on the polished build

```yaml
id:            HX-P7-2026-11-03-shipped-polish-frame-timing
date:          2026-11-03
phase:         P7 (shipped-app polish before the P7.4.1 gate)
hypothesis:    The Instrument kit as the shipped DNA World scene, the camera rig, the visitor panel and the Mol* theming keep the Phase 4, 5 and 6 contracts, 60 Hz with vsync on and 0 idle frames at rest, at device pixel ratio 1 and 2 and in low power.
git_commit:    helix-app c5570bf (polish commits 156c7ca, f3ae04e, 9a06415, cd44ea9, c5b8845, 4b67e17, 2f3e9c9, c5570bf on top of c39541d); helix-research b6fd99b (pin af104e2, consumed paths unchanged)
config:        apps/web/e2e/shipped-frames.mjs, viewport 1400x820, 3 pages per condition, vsync on and off, dpr 1 and 2, low power at dpr 2; rule-based planner; suites run.mjs, phase5.mjs, phase6.mjs --ollama-runs=0, shots-p7.mjs
seed:          n/a (timing)
data_version:  curated HBB dataset at the pinned helix-research commit
hardware:      the development Mac (M1 Pro), headless Chrome 156.0.8078.80
duration:      suites and timings 2026-11-03 about 01:25 to 02:45 local
cost:          0
```

## Method

The polish agent built the scene, rig and panel blind under a machine reservation, then ran three critique-and-fix rounds in the browser (helix-app `docs/reviews/phase-7-shipped-polish.md`, round shots under `rounds/`). The final build was measured with the Phase 5 long-frame approach: three pages per condition, each page running the 12 s tour, the camera move to codon 7, a 4 s drag and a 2 s wheel zoom, reading frame times from the R3F loop, the effect state mid-move and after, and idle frames at rest and in Protein World.

## Results (raw: `journal/results/helix-app-e2e/shipped-frames-polish-final-*.json`)

| File | vsync | Move | Median ms | p95 ms | Max ms | Frames over 33.4 ms | Frames | Pages |
|---|---|---|---|---|---|---|---|---|
| dpr1 |  | idle frames at rest / in Protein World | 0 to 0 | 0 to 0 |  |  |  | 6 |
| dpr2 |  | idle frames at rest / in Protein World | 0 to 0 | 0 to 0 |  |  |  | 6 |
| dpr2-power-low |  | idle frames at rest / in Protein World | 0 to 0 | 0 to 0 |  |  |  | 2 |

- With vsync on at both pixel ratios and in low power: every move at the 16.7 ms median, no frame over 33.4 ms in any page; 0 idle frames at rest and in Protein World (the 11 to 12 frames after the tour are the 0.2 s depth-of-field fade, then 0).
- Effects: depth of field 0 and effects at the screen ratio at rest; depth of field 1 and ratio 1.5 mid-tour (D-H012); low power renders without post-processing.
- Suites on the same build, 0 failures: Phase 4 (fallback, follow-up, unsupported, cancel-camera), Phase 5 (dna-render 628 bases with 0 mismatches, bridge, transitions, interrupts 15 to 52 ms), Phase 6 (all 9 rule-based scenarios), shot pass. Raw: `*-polish-final*.json` in the same folder.
- Model-backed scenarios were not rerun on this build; the planner, validation and read-backs are unchanged from 12025d0 (HX-P7-2026-11-03-model-e2e-adoption), only the scene behind the same DOM differs.

## Failures and negative results

- Round 3: the Phase 5 pointer-interrupt check picked base 8 instead of the aimed base, because a React capture handler interrupted the transition and re-rendered before the canvas listener ran; fixed with a window-level capture press rule (raw record of the failing run kept in helix-app c5570bf).
- The first timing run measured the dpr-2 pages at ratio 1 (R3F recomputes the ratio on render) and showed one 37 to 44 ms frame per tour from deferred buffer uploads; fixed by drawing the kit unculled and listening to the resolution media query.
- Low power: two isolated long frames (63 ms and 35 ms) in 1,731 frames, not traced.

## Interpretation

The shipped DNA World now carries the approved Instrument kit at the same frame budget as the Phase 5 scene (median 16.7 ms with vsync on; uncapped tour 2.7 to 3.9 ms at ratio 1, 5.2 to 6.0 ms at ratio 2). The contract changes needed by the new geometry are listed with reasons in the review page, section 2.

## Decision

Continue to P7.3.2 (accessibility and motion audit) and the P7.4.1 gate review with the author.

## Artifacts

helix-app `docs/reviews/phase-7-shipped-polish.md` and `phase-7-shipped-polish/` (14 final shots, rounds, suites); `apps/web/e2e/results/*polish*.json`; public copies and MANIFEST rows in `journal/results/helix-app-e2e/`.
