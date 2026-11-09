# HX-P11-2026-11-09-layout: desktop layout faults fixed and the narrow-viewport page (D-H030 question 91 (a))

```yaml
id:            HX-P11-2026-11-09-layout
date:          2026-11-09
phase:         P11 (P11.1.1 viewport scope, D-H030 answer 91 (a); faults reported by the author on 2026-11-09)
hypothesis:    The faults the author saw (caption card overflow, ClinVar line overflow, document scrolling out of bounds, transcript caption over Mol*'s highlight label, broken phone layout) are layout faults, not data faults; a suite that measures them fails on the a26565d build and passes after the fix, with every earlier suite unchanged.
git_commit:    helix-app 100c92a (pin: e2e/layout.mjs, exits 1), b4a2e04 (desktop fixes), 01bdcf0 (narrow page), 3a1a680 (review docs/reviews/phase-11-layout.md); built by a delegated agent on Opus 5.5, medium effort; verified by the coordinator
config:        e2e/layout.mjs: viewports 1024x700, 1280x760, 1440x860, 1728x890, 1920x1080 over the five curated sets, every enabled world with the variant selected, the welcome, the paused bridge, the side panel after an answer, a scroll scenario (55 steps), a resize across 1024 px, and the narrow page at 320, 360, 390 and 768 px
seed:          none
data_version:  the five curated sets at helix-research c045aed, unchanged
hardware:      Apple M1 Pro, the development Mac; Chrome 156 headless
duration:      layout suite a few minutes per run; the coordinator's reruns about 25 minutes in all
cost:          0
```

## Measurements

| Measure (layout suite) | a26565d (pin) | 3a1a680 |
|---|---|---|
| Screens failing | 185 of 185 | 0 of 185 |
| Elements overflowing their own box | 448 | 0 |
| Text past the viewport | 71 | 0 |
| Text clipped | 265 | 0 |
| Wide screens where the document scrolls | 165 of 165 | 0 |
| Overlay overlaps | 130 | 0 |
| Scroll-scenario steps that scrolled the document | 35 of 55 | 0 |
| Narrow page below 1024 px | none | 20 of 20, no canvas, no WebGL, no Mol* request, axe 0 |

Ten screens are skipped in both runs (worlds the capability report disables, sets whose bridge question plays no bridge); 71 intended cases are allowed by a documented list in the suite (scroll containers and similar).

Causes (helix-app `docs/reviews/phase-11-layout.md`): visually hidden text positioned against the viewport because the side panel was not positioned, plus a 200vw welcome shade, made the document taller than the window; the caption card's implicit auto grid column took its unwrapped header width (506 px in a 320 px card); grid `auto 1fr` rows could not shrink below an unbreakable identifier; the switcher row's width rule left 104 px at 1024; the welcome's record readout was drawn over Protein World. The cut "Not yet seen this session" line was a symptom of the document scroll.

## Coordinator verification

On 3a1a680, by exit code: unit tests (529), typecheck, check:pin, `npm run web:build`, the layout suite (185 screens, 0 failing), the Phase 5 suite (PASS) and the held-out split replay with the allowlist (PASS), all 0. The agent's runs of the accessibility audit, Phase 4, 9 and 10 suites and the hidden-canvas check were also exit 0. No local path or em dash in the new commits; tracked review shots restored after the Phase 4 and 5 runs.

## Interpretation

The hypothesis holds: every reported fault was layout, the pin measured them, and the fix removed them without changing a benchmark replay. Not covered: dynamic sets (carried item C11), Mol*'s own in-scene label (C12), and the frame budgets (not a quiet machine). Crossing 1024 px reloads the page and does not carry the session, stated as a limitation.

## Failures

The pin commit exits 1 by design. The agent's Phase 4 run overwrote two untracked, never-committed shots in `docs/reviews/phase-4-shots/`; nothing tracked was lost.
