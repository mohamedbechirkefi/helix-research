# HX-P7-2026-11-03-accessibility-audit: accessibility and motion audit of the shipped app (P7.3.2) and D-H014

```yaml
id:            HX-P7-2026-11-03-accessibility-audit
date:          2026-11-03
phase:         P7.3.2 (accessibility and motion: reduced motion, keyboard, accessible descriptions, low power; audit), with the author's D-H014
hypothesis:    The shipped app meets the design system's accessibility rules (section 8) on every key screen: no axe violations, every control reachable and operable from the keyboard with a visible ring, no focus trap, focus returned after every layer, reduced motion without autoplay or UI motion and with the bridge's 2.8 s dwell, the low-power view without post-processing within budget, and a text equivalent of every scene state in the accessibility tree.
git_commit:    helix-app c5570bf characterised; fixes in the commits listed in the handoff; helix-research pin af104e2 unchanged
config:        apps/web/e2e/a11y.mjs (axe-core 4.14.0 MPL-2.0 injected from node_modules; WCAG 2.0/2.1/2.2 A and AA plus best practices), 1400x820 at pixel ratio 2, rule-based planner; suites run.mjs (default scenarios, Ollama runs included), phase5.mjs, phase6.mjs --ollama-runs=0, shots-p7.mjs
seed:          n/a
data_version:  curated HBB dataset at the pinned helix-research commit
hardware:      the development Mac (M1 Pro), headless Chrome 156.0.8078.80; Ollama ministral-3:8b local for the Phase 4 model scenario (no paid call)
duration:      2026-11-03 about 02:50 to 04:10 local (two harness runs of about 5 min each, suites about 25 min)
cost:          0
```

## Method

Characterise first: the harness ran on the build of record c5570bf and wrote `a11y-before-fixes.json` (kept, with its accessibility trees). Every finding was then classified (serious, moderate, low; fixed, open, accepted); only small, safe defects were fixed (names, roles, landmarks, focus management, one CSS visibility, Escape on the tour), each with a unit test; the two D-H014 changes (tour after a resolved gene choice; no variant card on the welcome) landed in the same pass; the harness ran again (`a11y-after-fixes.json`), then the rule-based suites and the shot pass on the fixed build. The audit page is helix-app `docs/reviews/phase-7-accessibility-audit.md` (findings table, keyboard maps, reduced-motion and low-power evidence, the accessibility-tree summary, the VoiceOver script, which is owed as a manual pass).

## Results (raw: `journal/results/helix-app-e2e/a11y-before-fixes.json`, `a11y-after-fixes.json`, `*-a11y-final*.json`)

- **axe-core:** before, 7 rules on 12 screens (label-content-name-mismatch x23 on every DNA screen, landmark-one-main, region, landmark-banner-is-top-level, page-has-heading-one; aria-prohibited-attr incomplete on 8 elements); after, 0 violations on all 13 screens, aria-prohibited-attr 0. color-contrast stays incomplete (axe cannot resolve translucent panels and the canvas; the token tests cover 190 pairs).
- **Keyboard:** no trap on any screen; every stop with the focus ring; welcome tab order 14 stops (was 18, four of them invisible controls behind the welcome); DNA World 19; Protein World 25 (the seven Mol* viewport controls first); Evidence World 11 inside the layer. World switcher arrows, Home and End; codon tape one stop, arrows, Home, End, Enter selects and moves the stop; ask bar Enter; chips in both axes; tour Space pause and resume and Escape pause (new); bridge: focus to Pause on open, Space, Left and Right, Tab out (no trap), Continue lands in Protein World (VAL B6, D6, F6, H6) with focus on the world switcher (was the body), Escape skips with focus back to the question; Evidence World focus in and back (was the covered toggle and the body); Mol*'s seven viewport controls now show the focus ring (Mol*'s skin had removed it).
- **Reduced motion** (URL switch and OS setting): UI durations 0 s; the tour a cut with the plate saying so and no Pause or Resume; 0 idle frames; the bridge with all four stations at full opacity, progress 1.00, not playing, held 2,824 ms (record 2,808 ms) before Protein World.
- **Low power:** effects off, canvas at ratio 1 on a ratio-2 screen, panels `rgba(9, 12, 18, 0.96)` without backdrop blur; the 12 s tour 721 frames, render median 0.8 ms, p95 1.6 ms, max 4.0 ms, 0 over 16.7 ms, 0 idle frames after.
- **Accessible descriptions:** every scene state has a text equivalent in the tree (the Selection live region with the base pair, the Variant region with the codon change, the bridge dialog with its atomic live step, the Structure group with chain and residue, the Evidence World regions); gaps: no base-level keyboard path inside the scene; uppercase kicker labels reach the tree uppercased.
- **D-H014:** after Return on Explore with HBB the tour plays 30 ms later, the journey is guided on the transcript chapter in DNA World, 0 planner questions; the variant card is absent on the welcome and present afterwards.
- **Unit suites:** 24 files, 293 tests (was 283), typecheck clean.

- **Suites on the fixed build, 0 failures each** (raw `*-a11y-final*.json` in the same folder): Phase 4 `run.mjs` (fallback 5 runs 1,886 ms median click to end, the local Ollama scenario 5 runs 19,589 ms median with provider 17,709 ms, follow-up, unsupported, cancel-camera 27 ms median, cancel-inference, stale); Phase 5 `phase5.mjs` (628 bases, 0 mismatches, 6 real clicks on the aimed bases, transitions fade 710 ms median, interrupts 20 to 40 ms); Phase 6 `phase6.mjs --ollama-runs=0` (all 9 rule-based scenarios; `blueprint-a`'s first-scene time 12,076 ms now includes the D-H014 tour); shot pass `shots-p7.mjs` (every check; 0 idle frames after the tour; the bridge 247 ms after the chip).

- **Model calls (invariant 3):** only the Phase 4 suite's `ollama` scenario called a model: provider Ollama (local, no spend), model `ministral-3:8b`, 5 calls on 2026-11-03 during the suite run, the exact prompts and responses in `e2e-a11y-final.json` (`scenarios.ollama.runs[*].prompt`, `rejectedRaw`), 0 fallbacks. The audit harness, Phase 5, Phase 6 (`--ollama-runs=0`) and the shot pass used the rule-based planner.

## Failures and negative results

- The first harness run (c5570bf) failed 27 of its checks: the 18 findings of the audit page plus harness artefacts (Puppeteer has no `Shift+Tab` key name; its `interestingOnly` tree drops dialogs and groups; Chrome keeps the sequential-focus starting point at a blurred element, so a tab walk that started after a blur skipped the Mol* controls; a programmatic `focus()` does not match `:focus-visible` unless a key was pressed). Each artefact was fixed in the harness and is noted in it.
- The first fix of the codon names (hiding the index from the name with `aria-hidden`) did not satisfy axe: `label-content-name-mismatch` reads the visible text without the screen-reader filter, as "GAG7"; the name had to start with the visible text and the letters and index had to be two words (a space node that grid layout does not draw).
- The bridge's representation column overlaps station 3 by about 20 px at 1400 px wide (visual, open for Phase 8).

## Interpretation

The design system's rules held where they were encoded in components (roles, names, arrows, live regions, reduced motion, low power); the defects were at the seams the components do not own: landmarks of the page, `aria-label` on plain elements (which Chrome silently drops), focus hand-over between layers, controls hidden by opacity only, CSS glyphs in names, and the label-in-name rule on the codon tape. All of these are now rules in design-system section 8 and checked by the harness, which P11.2.1 can rerun. The screen-reader pass remains a manual debt with a written script.
