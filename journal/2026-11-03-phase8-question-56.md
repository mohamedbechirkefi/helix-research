# HX-P8-2026-11-03-question-56: the author's Phase 8 answers and the A-11 extension to the four other uppercase styles

```yaml
id:            HX-P8-2026-11-03-question-56
date:          2026-11-03
phase:         P8 (after the gate review; the author's answers 50 to 63, D-H016)
hypothesis:    Rendering the two-copy kicker text (uppercase and aria-hidden for the screen, sentence case for assistive technology) in the station world line, the codon tape head, the tour label and the known-limitations title changes no visible pixel, keeps the tour label's live region announcing once, and leaves every a11y check green.
git_commit:    helix-app cad8356 (on 5efc98f; build of record of the gate 5edeae4); helix-research f55709b (pin af104e2, consumed paths unchanged)
config:        production build served by vite preview on port 5190; a11y.mjs --tag=p8-q56 with its screenshots sent to a scratch folder (reviewed folders untouched)
seed:          n/a
data_version:  curated HBB dataset at the pinned helix-research commit
hardware:      the development Mac (M1 Pro), headless Chrome 156, viewport 1400x820 at pixel ratio 2
duration:      one a11y run, about 4 minutes
cost:          0
```

## What was decided (author, 2026-11-03; helix D-H016)

Questions 50 to 63 of the Phase 8 review were answered in one message. Thirteen keep what is built: the bridge sequence starts after execution (50), the variant reticle stays outside the helix at the overview (51), overview codon numbers every tenth (52), both labels on the variant codon (53), bowed long moves (54), Escape stops the flight and guided mode continues (55), "listed, not loaded" (57), Mol*'s focus target kept under the amber emphasis (58), no prefetch during the tour (59), two lights in low power (60), the Sound control left of the world switcher (61), the acknowledgement tick (62), journey-driven cues (63). One changes the build: 56, apply the A-11 treatment to the other uppercase styles.

## What was built

`KickerText` (design system, Panel.tsx) now renders the text of the bridge station's world line, the codon tape head, the tour label and the known-limitations title. The tour label keeps `aria-live="polite"` on the outer span; its uppercased copy is `aria-hidden`, so the live region announces the sentence-case copy once. The limitations title composes "title (count)" as one string before the split. Unit tests cover each site (352 in helix-app, 293 at the Phase 7 gate, 350 at the Phase 8 gate); the a11y suite reads the `.hx-sr` copy where it records label text.

## Measurements

| Check | Result |
|---|---|
| a11y suite, 13 screens | 0 failures, 0 axe violations (axe-core 4.14.0) |
| Tour label read-back after Space | "Tour paused" (sentence case), then "Tour playing" |
| Reduced-motion label | "Tour: cut to the end (reduced motion)" |
| Known limitations summary | "Known limitations (12)", 12 items, opens from the keyboard |
| Unit tests, typecheck | 352 pass; `tsc` clean |

Raw record: `journal/results/helix-app-e2e/a11y-p8-q56.json` (sha256 in MANIFEST.tsv, identical to the private copy).

## Interpretation

The change is accessibility-only: the computed names of four more labels now carry the author's casing while the screen keeps the Instrument style. No frame or budget measurement was repeated: the change adds two inline spans per label and no layout or scene work; the Phase 8 budgets of HX-P8-2026-11-03-final-build stand for the build of record, and the next full sequence runs at the Phase 9 gate.

## Failures

None.
