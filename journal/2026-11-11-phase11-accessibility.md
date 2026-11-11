# HX-P11-2026-11-11-accessibility: extended accessibility audit (S21) in Chrome, Firefox and Safari

```yaml
id:            HX-P11-2026-11-11-accessibility
date:          2026-11-10 to 2026-11-11
phase:         P11 (task P11.2.1, suite S21 of docs/phase-11-release-qa.md; question 92 answer (a), D-H030; no manual pass, D-H032)
hypothesis:    Every screen of S21 (all five curated sets, every world, a dynamic fixture, the controls added since Phase 7) has 0 axe violations and a scripted accessibility tree with every control named, in Chrome, Firefox and Safari; the Pathway and Evidence World layers no longer cover the world switcher.
git_commit:    helix-app e010967 to 1e2afe5 (pins 195536f, afaa124, ba9310b, b548f92; changes 9038ba7, fa41ad9, c5ce8d0, 40eacad, 556a3b6; results c3e4fb2; review 1e2afe5), pinned unchanged to helix-research 62d45de; built by a delegated agent on Opus 5.5, medium effort; verified by the coordinator
config:        e2e/a11y.mjs --all-sets with HELIX_BROWSER=chrome|firefox|safari; axe-core 4.14.0; Firefox through puppeteer-core over WebDriver BiDi; Safari through safaridriver over plain W3C WebDriver HTTP (e2e/webdriver.mjs, no new dependency); a new focus-not-obscured check (WCAG 2.4.11); layout.mjs fails when a layer touches the switcher; S6 to S13 rerun in Firefox and Safari
seed:          none
data_version:  the five curated sets and the dynamic fixtures at helix-research 62d45de, unchanged
hardware:      Apple M1 Pro, the development Mac; Chrome 157.0.8103.40 headless, Firefox 158.0.1 headless, Safari 18.3
duration:      the agent's pass about 13 hours of wall-clock (mostly suite runs); the coordinator's reruns about 70 minutes
cost:          0
```

## Measurements

Raw results in helix-app `apps/web/e2e/results/*p11a11y*` (comparison `a11y-compare-p11a11y.json`); the review is helix-app `docs/reviews/phase-11-accessibility-audit.md`.

| Suite | Chrome 157 | Firefox 158 | Safari 18.3 |
|---|---|---|---|
| S21 (with S14) | exit 0, 82 axe screens, 0 violations | exit 0, 82 screens, 0 violations | exit 0, 77 screens, 0 violations, 4 parts not run |
| S6, S7, S8 | earlier passes | exit 0 | exit 0 |
| S9 | earlier passes | exit 1 (loading section needs CDP) | exit 1 (same) |
| S10 | earlier passes | exit 0 | exit 1 (3 failures, wheel zoom stops early; cause not established) |
| S11 | earlier passes | exit 0 | exit 1 (4 failures, sound preference reads back null; cause not established) |
| S12 | earlier passes | exit 0 (40/40) | exit 1 at start (needs request interception) |
| S13 | earlier passes | exit 1 twice (question box missing at different points; not reproduced alone) | exit 1 after 21 scenarios (needs interception) |

Accessibility tree: 0 unnamed controls, exactly one main landmark per screen, every expected role, in each browser (Chrome through CDP; Firefox names checked against what the markup can give; Safari through WebDriver's computed role and label).

Not run in Safari: OS-level reduced motion (not emulable, the Mac's setting not changed), loading and start-failure screens and the TP53 fixture (no interception), device pixel ratio other than 2. Safari's default Tab skips buttons and links; the suite sets tabindex to emulate "Tab to every item" and keeps a default-Tab run as evidence. Performance suites (S18, S20, S22) need CDP and ran in Chrome only.

Findings fixed: P11-A-01 layers covered the switcher (they now start 64 px down, the switcher above); P11-A-02 tab stops under an open layer; P11-A-03 a world button left Evidence World open; P11-A-04 closing a layer stole focus; P11-A-05 Firefox gave the codon tape two tab stops; P11-A-11 Safari named the domain heading "Features ofP68871". Open for the author: P11-A-06 Safari select focus ring (low); P11-A-07 nothing announces an answer or refusal once it lands (moderate, WCAG 4.1.3); A-14 from Phase 7, no keyboard path to a single base (moderate); P11-A-10 world notes hidden while a layer is open (implementer's choice). The in-app limitations list gains the browser runs and the D-H036 click cost (HBB 15 to 16 lines).

## Coordinator verification

Rerun on 1e2afe5, each by exit code: npm test (566 passed), typecheck, check:pin, web:build, S21 in Chrome and in Firefox, S14 with --dir, `layout.mjs --axe=1`, nollm.mjs, both replays, budgets.mjs twice, shipped-frames at dpr 1, dpr 2 and dpr 2 low power judged by budgets.mjs --frames: all exit 0. Safari was not rerun by the coordinator. The agent's full budgets run had exited 1 (vsync-on median of the worst move 17.0 ms at dpr 2 against 16.8 ms, also 17.1 ms with the new layer CSS removed); the coordinator's run read 16.8 ms in all three conditions. Bytes at rest 1,999.3 of 2,000 kB. The coordinator's own result files were removed by exact name.

## Interpretation

The hypothesis holds for automated checks in three engines. It says nothing about what a screen reader announces (D-H032). The frame budget has no margin over the 16.7 ms vsync interval: a loaded machine reads 17.0 ms, a quiet one 16.8 ms, so the budget judges machine state as much as the app.

## Failures

The agent's full budgets run (exit 1, above). The Phase 5 and 6 suites wrote into tracked shot folders during the Firefox and Safari runs; restored with git checkout and the 5 new files deleted by name. Commit c3e4fb2's message names the wrong build hash (40eacad is meant); not amended. The coordinator first called budgets.mjs --frames-only without frame files (the script refuses; a misuse, rerun correctly).
