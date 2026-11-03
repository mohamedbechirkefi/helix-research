# HX-P8-2026-11-03-chrome-polish: the interface chrome polish after the Phase 8 gate (D-H017, D-H018)

```yaml
id:            HX-P8-2026-11-03-chrome-polish
date:          2026-11-03
phase:         P8 (after the gate; the author's condition "cards and menus, more premium", D-H017; approved D-H018)
hypothesis:    Giving every card and control depth through the tokens (a card one step above the panel with a lit top edge and a shade line; controls as machined keys that lift on hover and recess on press; Mol*'s own toolbar and readout in the same grammar) changes no scene code, keeps every text and background pair at AA, keeps every rule-based suite and the accessibility suite green, and removes the white question field seen in every review shot.
git_commit:    helix-app 6cebe35 (on cad8356); helix-research f55709b plus 15a5f58 (pin af104e2, consumed paths unchanged)
config:        production build served by vite preview on port 5190; shots-p7.mjs and shots-p8-protein.mjs to a scratch folder (tags chrome-polish-r1 on the first build, chrome-polish-r2 on the final one); a11y.mjs (chrome-polish-r1, chrome-polish); phase5.mjs --only=dna-render,bridge,transitions,interrupts, phase6.mjs --ollama-runs=0, run.mjs --only=fallback,follow-up,unsupported,cancel-camera (tag chrome-polish); eight headless probes of the question field (clip and full-viewport captures, computed styles, pseudo-class matches)
seed:          n/a
data_version:  curated HBB dataset at the pinned helix-research commit
hardware:      the development Mac (M1 Pro), headless Chrome 156, viewport 1400x820, pixel ratio 2 for the shots
duration:      about two hours including the probes
cost:          0 (the probes' asks ran on the local model, no paid call)
```

## What was built

Tokens (`packages/design-system/src/tokens.ts`, generated into `tokens.css`): `color.card #0c1017` and `color.cardTop #10151d` at 0.92, `elevation.card` (a 1 px shade line and a soft drop), `elevation.inset` (recessed surfaces), `elevation.edgeStrong` (a brighter top edge for a pressed key or a primary control); `alpha.well` from 0.82 to 1. CSS in the design system and the shell: cards, buttons, the primary button, the input well, selected text, the world switcher, the Sound control, suggestion chips, evidence cards, and Mol*'s viewport toolbar, hover readout and panel. Nothing in the scene, the labels, the camera or any contract. The table of changes with the rule behind each is helix-app `docs/reviews/phase-8-chrome-polish.md`.

## Measurements

| Check | Result |
|---|---|
| Contrast register (unit test) | 17 text roles on 14 surfaces plus 3 control rows: 241 pairs, all at or above 4.5:1; the three lowest ratios unchanged (base C on the washes, 4.58 to 4.63) |
| Unit tests, typecheck | 352 pass; `tsc` clean |
| Phase 7 shot set | 14 screens, 0 failures (`shots-p7-chrome-polish-r2.json`) |
| Protein World shot set | 10 screens, 0 failures; the bridge at 1100, 1400, 1600 px holds A-16 (`shots-p8-protein-chrome-polish-r2.json`) |
| Accessibility suite | 14 screens, 0 failures, 0 axe violations, first build and final build (`a11y-chrome-polish-r1.json`, `a11y-chrome-polish.json`) |
| Rule-based suites | Phase 5 dna-render, bridge, transitions, interrupts: PASS; Phase 6: 0 failures; Phase 4 fallback, follow-up, unsupported, cancel-camera: PASS (tag `chrome-polish`) |

Frame timings and budgets were not repeated: the change is CSS on DOM chrome outside the render loop. The Phase 8 budgets (HX-P8-2026-11-03-final-build) stand for the build of record; the next full sequence runs at the Phase 9 gate.

## The white question field

Every Phase 7 and Phase 8 review shot that showed the side panel after a question showed the question field as a white box with dark text, and the author saw it on the cinematic-layer page. Probes on the Phase 8 build:

| Probe | Field state | Computed background | Capture |
|---|---|---|---|
| as opened (prefilled by the welcome), cleared and blurred, script-set value | all | the dark well, `:-webkit-autofill` false | clip: dark |
| keyboard-typed, focused; then blurred | typed | the dark well | clip: dark |
| the suite's own ask flow, pixel ratio 1 and 2 | after the ask | the dark well | clip: dark |
| the same page and moment, full viewport, with and without `captureBeyondViewport` | after the ask | the dark well | **white** |
| the same again in a later run, with an autofill override, an opaque input, no backdrop filter | after the ask | the dark well | dark in all four |

The artefact is intermittent, appears only in full-viewport captures, and is not an autofill state. It coincides with a translucent input inside a backdrop-filtered card in headless Chrome 156; the root cause is not proven. With the well opaque, the 24 full-viewport shots of the final build show the field dark everywhere, including the welcome shot that had shown it white on the previous build.

## Interpretation

The polish holds every measured property of the Phase 8 build (contrast, accessibility, every suite) while changing how the chrome reads. The author approved it from the before-and-after page ("looks good go", D-H018). The white-field finding is a lesson for the review process: a review shot is a capture, and a capture can lie about a translucent layer; a computed-style probe settles it. The opaque well is a defensible design choice on its own (a recessed well reads crisper), and it makes the captures match the app.

## Failures

None in the suites. One process failure: the first attempt to run the three rule-based suites ran from the wrong working directory and produced only module-not-found errors; caught by reading the logs before recording, rerun from absolute paths.
