<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HX-P11-2026-11-13-usability: the usability inspection by the AI (P11.2.2), not user testing

```yaml
id:            HX-P11-2026-11-13-usability
date:          2026-11-13
phase:         P11 (P11.2.2, amended by D-H031; exit criterion 6)
hypothesis:    An inspection of the release candidate by the AI (Nielsen heuristic evaluation on every world of every curated set, a dynamic fixture, the page without 3D and the narrow page; a cognitive walkthrough of the nine tasks of the former session script) finds the problems a first-time visitor is most likely to meet, each with a severity and a screenshot, so that each can be fixed, scheduled or recorded. It would be contradicted if the inspection could not reach a task or a screen, or found nothing the automated suites had not already found. It cannot show that real people can use the app.
git_commit:    helix-app f14b2e2 (inspection, capture script, result file, known-limitations), on the release candidate e935abe (pin a6a8b44); helix-research e5f16da, then this entry's commit; by a delegated agent on Opus 5.5
config:        helix-app apps/web/e2e/usability-shots.mjs --tag=p11u (HELIX_BASE http://helix-usability.test:5192/, a non-development host name mapped to the local preview: platform "web", rules only); vite preview on port 5192 with __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=helix-usability.test
seed:          none (deterministic rules; the camera's moves and the shots' timing are the only variation)
data_version:  the five curated sets at helix-research a6a8b44, unchanged; TP53 from data/fixtures/dynamic/tp53/ by request interception (no live API)
hardware:      Apple M1 Pro, macOS 15.3.1, the development Mac; Chrome 157.0.8103.52 headless through puppeteer-core; Node 22.23.3
duration:      about 2.5 hours of wall-clock (the capture run itself about 4.5 minutes)
cost:          0 (no model call, no network request beyond the local server)
```

No LLM call was made by the app or the capture script. The inspection itself was written by the AI (Claude Opus 5.5) from the shots, the result file and the code; that is the method, labelled as such, not a measurement.

## Methods

Two inspections, both by the AI and labelled "an inspection by the AI (Claude Opus 5.5), not user testing" wherever they are cited (D-H031): no participants, no questionnaire, no SUS score.

1. **Heuristic evaluation.** Nielsen's ten heuristics (1994, wording of the 2020 revision) and his 0 to 4 severity scale, applied to 64 screen states: the welcome, DNA, Protein, Pathway and Evidence World and an answer for each of the five curated sets (FAAH2's Protein World disabled), the walkthrough's screens on HBB (bridge, refusals, the selection and evidence cards, the domain card, an explorer refusal), the TP53 dynamic fixture (not-curated message, retrieval screen, DNA and Evidence World, an answer), the start screen on Slow 4G, the page without 3D, the narrow page at 390 x 844 (and its length for all five sets), 1024 x 700, reduced motion (the system setting, emulated) and low power. Each finding has an id (P11-U-NN), a screen, a heuristic, a severity, a screenshot and a proposed disposition.
2. **Cognitive walkthrough.** The nine tasks of the former script: first look; the sickle-cell variant and what it changes; ask a question; back to the DNA; the evidence for one statement; another gene; keyboard only; reduced motion; no questionnaire. The four questions (try, notice, link, progress) answered per step for a stated visitor (general science education, laptop, first visit). Task 9 is dropped with D-H031: a questionnaire answered by the system's builder would be an opinion in the form of a user measurement.

Constant: the build (helix-app e935abe built into dist, exit 0), the host mode (public: rules only), the viewport (1400 x 820 at pixel ratio 1 unless named), Chrome 157. The capture script writes one JPEG per screen to helix-app `docs/reviews/phase-11-usability/shots/` (quality 46, 800 px wide; 64 files, 2,822,693 bytes) and the facts of each screen (headings and controls in view, status line, explanation, chips, side-panel length, focus, keyboard stops) to `apps/web/e2e/results/usability-p11u.json`.

## Raw results + uncertainty

| Measure | Value | Source |
|---|---|---|
| Screen states inspected | 64 (one shot each), plus the narrow page's length for 5 sets | `usability-p11u.json` `screens`, `narrowLength` |
| Walkthrough | 8 tasks walked in 30 steps: 7 steps with a "no", 10 with a "partly" and no "no", 13 without either; task 9 dropped | `phase-11-usability/walkthrough.md` |
| Findings | 28: severity 4: 0, 3: 3, 2: 14, 1: 11 | `phase-11-usability/findings.md` |
| Proposed dispositions | fix now 8 (estimated +310 to +800 bytes at rest together), Phase 12 10, limitation 10 | same |
| Other-gene question on HBB ("Show me the CFTR gene.") | refused: "CFTR is not in the curated records available here; only HBB is." | `usability-p11u.json` screen u12 `status`; rule `foreign-gene`, `packages/ai-planning/src/fallback.ts` line 324 |
| Focus after Skip with Enter | the document body | `keyboard.focusAfterSkip` |
| Tab stops from there (cycle of 36) | question box 1, Ask 2, Known limitations 24, DNA World 31, Protein World 32, Evidence World 34, codon strip 36 | `keyboard.firstAt`, `keyboardCycle` 37 |
| Start screen width in a 1,400 px window | 2,388 px (Slow 4G at 3 s; TP53 retrieval screen) | screens u32, u16 `docScrollWidth` |
| Side panel after an answer | 4,604 px (HBB, 13 sections) to 5,553 px (CFTR, 14) in an 820 px window | screens u05, s-cftr-6 `panel` |
| Narrow page length at 390 x 844 | HBB 18,692 px (evidence at 2,239), CFTR 31,264 (14,691), BRCA1 35,743 (18,255), SLC6A3 20,833 (6,657), FAAH2 15,035 (5,803); 0 in-page links | `narrowLength` |

The three major findings: P11-U-01 (the false other-gene refusal above), P11-U-02 (no control to change gene once the welcome is closed; walkthrough task 6 fails without a reload), P11-U-03 (at 1024 x 700 the Protein World caption card covers the selected residue, shot u39). Severities are the AI's judgement for the stated visitor; another inspector would rate some differently. One seed, one browser, one machine.

## Failures

The first capture runs could not reach the preview: `vite preview` listens on the IPv6 loopback only, and the host map pointed at 127.0.0.1; mapping the test name to `localhost` fixed it (no result kept from those runs). An intermediate run shot the TP53 page after the retrieval had already finished (the fixtures answer in well under a second), so the retrieval screen is now shot with the processor slowed four times and as soon as the screen exists. A scroll to the "comparison" card found no such card after the welcome's answer; the step now scrolls to the Next questions. The welcome's suggested question plays no bridge (the bridge belongs to the set's bridge question), so the bridge shot was moved to that question. None of these changes the findings.

## Limits / confounders

- Not user testing: no person used the app (D-H031). Nothing here shows that real people can use it.
- The builder's blind spot: the AI that inspected the app wrote most of it, so the 28 findings are a lower bound.
- Chrome only; reduced motion and low power were looked at on HBB's welcome and DNA World only; pointer hover was not driven; the start and retrieval screens were shot at one moment of their animation.
- The byte costs of the proposed fixes are estimates, not measurements.
- The candidate's frame budget is not green (16.9 ms against 16.8 ms at dpr 2, HX-P11-2026-11-12-dh041, coordinator verification); the inspection judged no frame or load time and does not depend on it.

## Interpretation

The inspection reached every screen and task of the plan's scope and found problems the automated suites could not: a wrong statement with a valid source (the source map checks that a sentence has a source, not that a rule's claim about the build is true), a screen the layout suite does not open (the start screen), and 3D content hidden behind a card (outside the overlap check). The weakest task is changing gene (task 6). Most findings are small; three are major. Within its perimeter, the hypothesis holds; what it cannot show is how real visitors fare.

## Decision

**continue:** the findings and six questions go to the author (helix-app `docs/reviews/phase-11-usability/findings.md` section 4); no shipped code changes until the answers. The known-limitations usability rows are filled (accepted D-H031 for the absence of user testing and the blind spot; the 28 findings open for the author).

## Artifacts

- helix-app `docs/reviews/phase-11-usability/` (README.md, heuristics.md, walkthrough.md, findings.md, shots/ with 64 JPEGs), commit f14b2e2
- helix-app `apps/web/e2e/usability-shots.mjs` and `apps/web/e2e/results/usability-p11u.json`, same commit
- helix-app `docs/known-limitations.md` section 2.8 and section 6 item 7, same commit
- Checks: helix-app `npm run web:build` exit 0 (e935abe); `node e2e/usability-shots.mjs --tag=p11u` exit 0 (64 shots, 0 failed steps); `npm test` exit 0 (594 passed, 55 files); `npm run typecheck` exit 0
