<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# Phase 11: release-grade QA, performance and accessibility, the plan

Authored 2026-11-09 when the author opened Phase 11 (helix D-H028: "pass to phase 11"; the plan comes first, and the gate's agreed test suite and quality budgets are proposed here and agreed by the author before anything is measured against them). Governs ROADMAP Phase 11 (P11.1.1 to P11.5.4 and P11.4.1) and adds the tasks this plan proposes (section 4, marked "new"). The master prompt's rules that bind this phase: section 8 (free to run: the deterministic fallback for everything, no paid inference, never pretend a local Ollama is reachable by public visitors, expose the limitation where in-browser inference is not robust), section 9.3 (reduced motion, keyboard, accessible descriptions, a lighter low-power view), section 14 (scientific, AI, scene, UX and accessibility, security and privacy, performance validation, with reference hardware and budgets), section 15 Phase 11 (device tiers, GPU and asset optimisation, WebLLM constraints, no-LLM mode, keyboard and reduced motion, scientific audits, usability testing, security and licence review; deliverable: a stable, measured release candidate; gate: the agreed test suite and quality budgets pass, limitations documented), amendment A-1 (the Tauri macOS build of the same code, ad-hoc signed, no notarisation without the author's spend decision), and the Definition of Done. Workspace invariants 2 (characterise before changing), 3 to 5 (journal every measurement, no untraceable number, keep negative results), 12 (claims register) and 14 (write as you go) apply throughout.

**How to read this plan.** Everything marked **PROPOSAL** waits for the author's agreement (section 10, questions 81 onward). A budget without a measurement reads "to be measured": no value in this file is estimated. Every measured value cites its result file and the commit that holds it. Commit ids of helix-research are those after the history rewrite of 2026-11-09 (`docs/history/commit-map-2026-11-09.tsv`).

**Build of record at the start of Phase 11:** helix-app fefa19f (Phase 10 passed), pinned to helix-research c045aed; helix-research 79d42fe. Phase 10 close evidence: helix-app `docs/reviews/phase-10-close.md` (commit 823f38f, result files tagged `p10-close`) and `docs/reviews/phase-10-final.md` (commit f33ac5f, result files tagged `p10-final`). Inspection done for this plan: journal HX-P11-2026-11-09-phase11-plan.

## 1. What must be true at the end

1. The agreed test suite (section 2) passes on one build of record, every check read by exit code, every result file committed, on a quiet machine.
2. The agreed quality budgets (section 3) pass on that build, per device tier, with every number from a result file.
3. Device tiers exist: the app chooses a rendering tier from what the device exposes, the visitor can override it, and each tier is measured.
4. The no-LLM mode is a complete product: every curated journey, gene search over the bundled records, selection and highlighting, the supported questions and evidence browsing work with no model, verified on a production-like host.
5. Accessibility is audited across every world and every curated set, with automated checks only (axe on every screen, keyboard paths, reduced motion, low power); no manual screen-reader pass (D-H032), stated as a limitation; and the findings are fixed or accepted by the author.
6. Usability is inspected, not user-tested (D-H031): a heuristic evaluation and a task walkthrough are written, each labelled as an inspection by the AI, never as user testing; their findings are fixed or recorded; the absence of sessions with real users is a stated limitation.
7. Every claim the app displays is traced to its record (the scientific audit), and the security, privacy, supply-chain, licence and $0 cost reviews are written.
8. The desktop build of amendment A-1 runs the HBB journey offline and answers a question with the user's local Ollama, measured against the web build, packaged as an ad-hoc signed DMG that is not distributed (distribution is the author's G-PUBLIC step).
9. The carried items of Phases 7 to 10 (section 5) are each fixed, or accepted by the author as a documented limitation.
10. The limitations document (section 9) is complete, shown in the app where it applies, and the report section 9.8 is drafted in English with the French copy owed by D-006 brought up to date.

## 2. The agreed test suite (PROPOSAL, question 81)

The gate passes when every row below passes on the same build of record. Commands run from the `helix-app` root (S1 to S4), from `helix-app/apps/web` (the `node e2e/...` rows, as in helix-app `docs/qa-and-performance.md` section 3) or from `helix-research` (S5, S23 to S25). Review pages cited as `phase-10-*.md` are in helix-app `docs/reviews/`; result files are in helix-app `apps/web/e2e/results/` with the app built and served (`npm run web:build && npm run web:preview`, port 5190). "Exit 0" is read as `cmd > log 2>&1; echo $?`. Rows that call the local model need Ollama with ministral-3:8b already running; the suite never starts or stops it. The **Phase 10 close** column is the last recorded state, not a Phase 11 measurement.

### 2.1 Existing suites (Phases 4 to 10)

| Id | Suite | Command | What it covers | Pass rule | Phase 10 close |
|---|---|---|---|---|---|
| S1 | helix-app unit tests | `npm test` | ai-director (split policy, claim screen, follow-up filter), ai-actions, scene-engine, journey-engine, design system, app controller and session profile | exit 0, 0 failed | 515 passed (phase-10-close.md section 4) |
| S2 | helix-app typecheck | `npm run typecheck` | both tsconfig projects | exit 0 | exit 0 (same) |
| S3 | Research pin | `npm run check:pin` | the consumed helix-research paths unchanged since the pinned commit | exit 0 | exit 0 (same) |
| S4 | Production build | `npm run web:build` | the shipped bundle, prompt ids in it | exit 0 | exit 0 (same) |
| S5 | helix-research unit tests and typecheck | `npm test`, `npm run typecheck` | scientific core (mapping, numbering, variants, structures), data adapters on recorded fixtures, ai-planning (prompts v1 to v8 pinned, validator, rule-based planner), builder, benchmark harness re-statements | exit 0; live tests skipped unless S24 | 533 passed, 4 skipped (phase-10-final.md section 1) |
| S6 | Phase 4 E2E | `node e2e/run.mjs --tag=<t>` | fallback, follow-up, unsupported, cancel-camera; model scenarios on `?prompt=v7` and their shipped-path twins (ollama-split, cancel-inference-split, stale-split) | exit 0, 0 failures, 10 scenarios | 10 scenarios, 0 failures (`e2e-p10-close.json`, 823f38f) |
| S7 | Phase 5 E2E | `node e2e/phase5.mjs --tag=<t>` | DNA render, bridge, transitions, interrupts, modes, rapid (with shipped-path twins) | exit 0, 6 scenarios | 6, 0 failures (`phase5-e2e-p10-close.json`) |
| S8 | Phase 6 E2E | `node e2e/phase6.mjs --tag=<t>` | blueprints A, B (model-first and ollama-split), E, F (unreachable Ollama), full chain, welcome, evidence and limits, D-H008 and D-H010 routing | exit 0, 9 scenarios | 9, 0 failures (`phase6-e2e-p10-close.json`) |
| S9 | Phase 7 shipped shots | `node e2e/shots-p7.mjs --tag=<t> --dir=<scratch>` | 15 shots with page checks: wordmark, hero, tour, hover, bridge, Mol* read-back VAL B6/D6/F6/H6, caption, reduced motion, dev panel hidden | exit 0 | 15 shots, 0 failures (`shots-p7-p10-close.json`) |
| S10 | Phase 8 camera | `node e2e/phase8-camera.mjs --tag=<t>` | interrupts (pointer, wheel, Escape), named scales, label layer, reduced motion | exit 0, 7 scenarios | 7, 0 failures (`phase8-camera-p10-close.json`) |
| S11 | Phase 8 audio | `node e2e/phase8-audio.mjs --tag=<t>` | opt-in, cues, off, reduced, world, a11y of the toggle | exit 0, 6 scenarios | 6, 0 failures (`phase8-audio-p10-close.json`) |
| S12 | Phase 9 E2E | `node e2e/phase9.mjs --tag=<t> --dir=<scratch>` | FAAH2, CFTR, BRCA1, SLC6A3, Pathway World, associations, coverage captions, dynamic mode on recorded fixtures, axe per set | exit 0, 40 scenarios | 40, 0 failures (`phase9-e2e-p10-close.json`) |
| S13 | Phase 10 E2E | `node e2e/phase10.mjs --tag=<t> --dir=<scratch>` | the six explorer actions and refusals, contextual questions, session profile, graceful failures, the D-H027 shipped-path scenarios | exit 0, 32 scenarios | 32, 0 failures (`phase10-e2e-p10-close.json`) |
| S14 | Accessibility audit | `node e2e/a11y.mjs --tag=<t> --dir=<scratch>` | axe-core 4.14.0 on 14 screens, keyboard passes, reduced motion (URL and OS), low power, accessibility trees | exit 0; 0 axe violations | 14 screens, 0 violations, 0 failures (`a11y-p10-close.json`, 823f38f) |
| S15 | Stored Phase 10 policy replay | `node e2e/phase10-replay.mjs --tag=<t>` | the 112 frozen-benchmark policy plans executed in the app | PROPOSAL (question 84): exit 0 with an allowlist naming P10-CFTR-13 and P10-CFTR-19 (the intended effect of D-H024 answers 71 and 73); any other difference fails | exit 1 on exactly those two (`phase10-replay-p10-close.json`) |
| S16 | Held-out split replay | `node e2e/phase10-replay.mjs --mode=heldout-split --tag=<t>` | the 58 held-out units on the shipped default page, routes and final plans against the stored rows | as S15, allowlist P10H-BRCA1-08 until item C7 of section 5 is settled | exit 1 on exactly that unit (`phase10-replay-p10-close-split.json`) |
| S17 | Prompt matrix and non-development host | `node e2e/phase10-final-checks.mjs --tag=<t>` | default and `?prompt=` selection on a development page; on a non-development host only the rule-based provider, `?prompt` and `?ollama` ignored | exit 0 | exit 0 (`phase10-final-checks-p10-final.json`, f33ac5f) |
| S18 | Frames and budgets | `shipped-frames.mjs` at dpr 1, dpr 2, dpr 2 low power, then `budgets.mjs --frames=...` and `budgets.mjs "--query=&power=low"` (helix-app `docs/qa-and-performance.md` section 3) | section 3.1 of this plan | exit 0 on both budget runs, on a quiet machine | 28 of 29 and 17 of 17 (`budgets-p10-final.json`, `budgets-p10-final-power-low.json`, f33ac5f): the one breach is the Protein World idle frame (C1) |

### 2.2 New Phase 11 suites (PROPOSAL; each is built in the task named)

| Id | Suite | Command (to be written) | What it covers | Pass rule |
|---|---|---|---|---|
| S19 | No-LLM full function (P11.1.2) | `node e2e/nollm.mjs --tag=<t>` | on a production-like host (built files on a plain static server, as S17) and on a development page with Ollama unreachable: every chapter of every curated set (HBB, FAAH2, CFTR, BRCA1, SLC6A3), every world each set declares, every supported question of each set's questions record answered by the rules and executed, gene search (curated symbols, names and aliases, an unknown symbol, a dynamic fixture), selection and highlighting, Evidence World, the limitations list, the AI status card's "no model" text | exit 0; 0 requests to any Ollama address (network log); every supported question answered and executed; 0 page or console errors |
| S20 | Device tiers (P11.1.1) | `node e2e/tiers.mjs --tag=<t>` | the tier chosen under each emulated condition (section 4, P11.1.1), the override, the per-tier frame and start budgets, the low tier's visual content (no information lost: every label, chip and plate present) | exit 0; the tier matches the expected one under each condition; the tier budgets of section 3.2 pass |
| S21 | Accessibility, extended (P11.2.1) | `node e2e/a11y.mjs --all-sets --tag=<t>` | S14 plus Pathway World, the four non-HBB sets, a dynamic fixture, the This session card, the domain panel, the explorer refusals; keyboard reachability of every new control | exit 0; 0 axe violations; every axe "incomplete" group listed and checked by eye in the audit report |
| S22 | Session and memory soak (P11.1.3) | `node e2e/soak.mjs --tag=<t>` | 20 questions and world switches across two sets on one page; heap, Chrome tree, WebGL resources (three.js `renderer.info.memory`, Mol* structures) sampled after each | exit 0; the soak budgets of section 3.2 pass |
| S23 | Science suite on every set | `npm test` (helix-research) plus the build comparison (`npm run compare:hbb`; the same comparison for the other four sets is to be written) | mapping, numbering, variants, structure entity and chain, evidence classes for all five sets; the curated sets regenerate byte-identically from the recorded raw inputs | exit 0 |
| S24 | Live retrieval, once (optional at the gate, PROPOSAL question 81) | `HELIX_LIVE=1 npm run test:live` (helix-research) and `HELIX_LIVE=1 node e2e/phase9.mjs --only=<dynamic live>` | the adapters against the public APIs today; drift reported, not failed | runs and is journaled; drift is a finding |
| S25 | Supply chain (P11.3.2) | `npm audit` in both repos and each experiment; `cargo audit` on the desktop crate; the licence scan of P11.3.3 | known advisories; licences of everything bundled | 0 high or critical advisories in anything that ships, or each accepted by the author with its reason |
| S26 | Desktop E2E (P11.5.1 to P11.5.3) | `node ../desktop/e2e/run.mjs --tag=<t>` (driving the built app; method chosen in P11.5.1, see that task) | offline HBB journey with the network blocked, the Ollama provider detected or not, one question to action with Ollama, the capability allowlist refusing an out-of-scope URL | exit 0 |
| S27 | DMG checks (P11.5.4) | `codesign --verify --deep --strict`, `hdiutil verify`, a launch from a fresh macOS user account | packaging | exit 0 on both commands; the fresh-user launch recorded with a screenshot |
| S28 | Manual passes (people, not scripts) | dropped by the author: no VoiceOver pass (D-H032), no usability sessions (D-H031); the Safari run is automated (D-H031) | what automation cannot judge | not run; the gap is a stated limitation |
| S29 | Layout (added by D-H033) | `node e2e/layout.mjs --tag=<t> --dir=<scratch>` (helix-app) | the five desktop viewports from 1024 to 1920 px over every set and enabled world, the welcome, the bridge, the side panel, a scroll scenario, a resize across 1024 px, and the narrow page at 320 to 768 px | exit 0: no element overflowing its box, no text past the viewport or clipped, no document scroll, no overlay overlap, the narrow page with no 3D and 0 axe violations |

Not in the gate suite, kept as development tools: the concept harnesses (`concepts.mjs`, `shots-p8*.mjs`), `demo-record.mjs`, `longframe*.mjs`, `analyze-trace.mjs`.

## 3. Quality budgets (PROPOSAL, questions 82, 83 and 85)

Reference: the development Mac (Apple M1 Pro, 16 GB, macOS 15.3.1), system Chrome headless 156, viewport 1400 x 820, `vite preview` on localhost (helix-app `docs/qa-and-performance.md` section 1). Values are medians unless named otherwise.

### 3.1 Current budgets (helix-app `apps/web/e2e/budgets.json`) and the measured value at the Phase 10 close

Measured on the build of record 65be05a (same rendering code as fefa19f; phase-10-close.md section 4 says the close changed no rendering), result files `budgets-p10-final.json` (default) and `budgets-p10-final-power-low.json` (low power), committed in helix-app f33ac5f. Frame rows come from `shipped-frames-p10-final-{dpr1,dpr2,dpr2-power-low}.json` (same commit).

| Budget | Value | Default | Low power | Proposal |
|---|---|---|---|---|
| Page load to scene ready | <= 1,000 ms | 185 ms | 182 ms | keep |
| Welcome interactive | <= 1,200 ms | 196 ms | 192 ms | keep |
| DNA World ready | <= 1,200 ms | 418 ms | 334 ms | keep |
| Bytes over the wire before scene ready | <= 1,000 kB gzip | 737 kB | 737 kB | keep |
| Bytes over the wire at rest | <= 2,000 kB gzip | 1,989.6 kB | 1,989.6 kB | keep; note the 10.4 kB headroom: any asset added in Phase 11 must be measured against it |
| JS heap at rest | <= 96 MB | 38 MB | 37.4 MB | keep |
| World switch to Protein World, cold | <= 2,500 ms | 1,613 ms | 1,623 ms | keep |
| World switch to Protein World, warm | <= 1,600 ms | 1,282 ms | 1,290 ms | keep |
| World switch to DNA World | <= 1,600 ms | 1,284 ms | 1,293 ms | keep |
| 2HBS fetch | <= 300 ms | 27 ms | 27 ms | keep |
| JS heap after the structure load | <= 256 MB | 80.3 MB | 79.7 MB | keep |
| Heap growth over 6 round trips | <= 10 % | 1.4 % | 1.5 % | keep |
| Chrome process tree after the round trips | <= 1,500 MB | 1,054 MB | 915 MB | keep |
| Structures in Mol* after the round trips | exactly 1 | 1 | 1 | keep |
| Vsync-on median frame, worst move | <= 16.8 ms | 16.8 (dpr 1), 16.8 (dpr 2) | 16.8 | keep |
| Frames over 33.4 ms, vsync on | 0 per page | 0 (dpr 1), 0 (dpr 2) | n/a | keep; the 63.3 ms frame of the Phase 10 gate run (`budgets-p10-gate.json`, journal HX-P10-2026-11-04-gate-evidence) did not recur at p10-final; rerun on a quiet machine in P11.0 (C2) |
| Low power: frames over 33.4 ms per 1,000 | <= 1 | n/a | 0 | keep |
| Low power: longest frame | <= 70 ms | n/a | 21.8 ms | keep |
| Uncapped tour p95 | <= 5 ms (dpr 1), <= 8 ms (dpr 2) | 3.7, 6.2 ms | n/a | keep |
| Idle frames at rest, after moves, in Protein World | 0 | 0 (dpr 1), 0 (dpr 2) | **2 (over)** | keep at 0 and fix (question 85, item C1) |
| Scene chunk (Mol*, three) gzip | <= 1,100 kB | 968.8 kB | same build | keep |
| All built assets gzip | <= 2,100 kB (raised by D-H024 answer 72) | 1,997 kB | same build | keep |
| No page errors | 0 | 0 | 0 | keep |

> **Agreed (D-H034, 2026-11-10, "agree all, b"):** every value proposed in helix-app `docs/reviews/phase-11-new-budgets.md` (measured in HX-P11-2026-11-10-new-budgets) is the budget; and the 3.1 long-frame rule becomes "at most one frame over 33.4 ms per 10 vsync-on pages, never two on one page, each listed" (option b of the P11.0 finding, HX-P11-2026-11-09-baseline). Encoded in helix-app `apps/web/e2e/budgets.json`. Device-tier and desktop rows are still to be measured.

### 3.2 New budgets (PROPOSAL: the metric and the reason are proposed now; every value is "to be measured" in P11.0 and brought back to the author in one table before the gate measures against it, question 83)

| Area | Metric | Proposed rule for the value | Reason | Measured so far |
|---|---|---|---|---|
| Device tiers | per tier (section 4, P11.1.1): vsync-on median frame, frames over 33.4 ms, welcome interactive, DNA World ready | the same frame budgets as 3.1 for every tier the app selects (a tier exists to meet them); start times to be measured | §14 asks for low-power behaviour and adaptive rendering; one machine is the stated limit of every budget so far | to be measured |
| Device tiers | the tier the app selects under each emulated condition | must match the expected tier | the selection logic is a contract | to be measured |
| Network load time | welcome interactive and DNA World ready under Chrome's own "Fast 4G" and "Slow 4G" throttling presets of the Chrome version used (recorded in the result file), cold cache | to be measured, then a budget proposed | localhost hides the 1,989.6 kB transfer; a visitor pays it | to be measured |
| Time to first journey step | from the gene chosen on the welcome to the first chapter's scene settled (tour start or skip) | to be measured | the first meaningful moment for a visitor, not the ready flag | to be measured |
| Rules answer time | from Ask to the plan executed, rule-based provider, the reference question and one explorer question | to be measured | the no-LLM mode is the public product | to be measured |
| Planning feedback | from Ask to a visible "planning" status | to be measured | the visitor must see that a model is working during a 10 to 20 s wait | to be measured |
| Model planning time (reported, not a gate budget) | median and p90 per route on the shipped split | reported only | model latency depends on the visitor's machine; the Phase 10 benchmark measured a median of 14.2 s and a p90 of 26.6 s (helix-app `docs/reviews/phase-10.md`, measured section) | reported |
| No-LLM mode | requests to any Ollama address on a non-development host | 0 | §8: a public origin never gets an Ollama provider | 0 on S17 (`phase10-final-checks-p10-final.json`); S19 extends it |
| No-LLM mode | supported questions answered and executed by the rules | all of them, per set | §8 item 3 | to be measured |
| No-LLM mode | start and structure budgets | the 3.1 values unchanged | the no-LLM mode is not a degraded build | to be measured |
| Memory, soak | heap growth over a 20-question session across two sets | to be measured, then proposed | Phase 8 measured 6 round trips only; a session is longer | to be measured |
| Memory, GPU resources | three.js geometries and textures, Mol* structure count after the soak | no growth after the first full cycle | §14 "resource cleanup"; GPU memory is unmeasured (qa-and-performance.md section 2.6) | to be measured |
| Accessibility | axe violations on every screen of S21 | 0 | the Phase 7 audit's bar (helix-app `docs/reviews/phase-7-accessibility-audit.md`) | 0 on 14 screens (S14) |
| Accessibility | axe "incomplete" colour-contrast results | each group checked by eye and recorded | axe cannot compute contrast over the WebGL canvas; `a11y-p10-close.json` lists 11 to 305 incomplete contrast nodes per screen | recorded, not judged |
| Desktop | cold launch to welcome interactive; warm launch | to be measured | A-1 adds a second platform | Phase 1 shell around the Mol* page only: load to first draw 2,740 ms cold, 256 ms warm (HX-P1-2026-11-01-tauri-shell); not the app |
| Desktop | frame budgets of 3.1 in the webview | the same values | one codebase, one bar | Phase 1 shell: spin p50 17 ms, p95 18 ms (same entry); not the app |
| Desktop | resident memory after the 6 round trips | to be measured | WKWebView differs from Chrome | to be measured |
| Desktop | `.app` and `.dmg` size | to be measured, then proposed | download cost for a user | Phase 1 shell: `.app` 8.4 MB, `.dmg` 4.5 MB (same entry); not the app |
| Desktop | network requests during the offline HBB journey | 0 | A-1 "offline curated journeys" | to be measured |
| Dynamic mode (reported) | live retrieval to DNA World ready | reported only | depends on four public APIs and the visitor's network | to be measured once in S24 |

## 4. The tasks

Each task: method, deliverable, evidence, acceptance rule, dependencies. A code change follows invariant 2 (a pin of today's behaviour first, then the change). Every measurement gets a journal entry. Task ids marked "new" are proposals to add to the ROADMAP.

### P11.0 Baseline on a quiet machine (new)
- **Method:** the whole of section 2.1 on the build of record fefa19f with nothing else running (no build, no test, no inference in parallel; Ollama left as it is), including S18 with 5 pages per frame condition at dpr 2 to rerun the Phase 10 gate's long frame (C2), with the `--trace-idle=1` flag on one extra dpr 2 low-power run (C1). Then the "to be measured" rows of 3.2 that existing harnesses can already take (network throttling through a `--network=` option added to `budgets.mjs`; time to first journey step and rules answer time as new fields).
- **Deliverable:** result files tagged `p11-baseline`; the 3.2 table with measured values and proposed budget values, for the author (question 83).
- **Evidence:** journal HX-P11-<date>-baseline.
- **Acceptance:** every row has a result file; the long frame either recurs (then attributed with Long Animation Frame entries) or does not in 5 pages (recorded as not reproduced).
- **Depends:** question 81 (which suites); no product code change.

### P11.6 Carried items (new; section 5 lists them, each with its task)
- **Method:** one small step per item, pin first, change, the suites that cover it rerun.
- **Acceptance:** each item fixed with its evidence, or accepted by the author as a limitation (section 9).
- **Depends:** P11.0 (so a fix is measured against the baseline); the author's answers where a question is asked.

### P11.1.1 Device tiers and adaptive rendering
- **Method:**
  1. Define tiers as rendering settings the app already has, so no new visual path is invented. **PROPOSAL:** *full* (today's default: post-processing, depth of field during the tour, effects at the screen's pixel ratio at rest); *balanced* (no depth of field, bloom at pixel ratio 1, the scene at pixel ratio at most 1.5); *low* (today's `?power=low`: no post-processing, ratio 1, standard materials, Mol* without occlusion); *no-WebGL* (no WebGL2 context: the welcome, the sequence, the codon strip, Evidence World and the limitations as plain page content, with a stated limitation; today there is no such path, journal HX-P11-2026-11-09-phase11-plan section 3).
  2. Selection from what the browser exposes without fingerprinting the visitor: WebGL2 availability and `MAX_TEXTURE_SIZE`, `devicePixelRatio`, `prefers-reduced-motion`, `navigator.hardwareConcurrency`, the Save-Data hint where present, and a short frame-time probe during the welcome (frames measured while the welcome is open, before the scene starts its tour). Nothing is stored or sent. The visitor can override the tier in the side panel; `?power=low` keeps working.
  3. Emulated conditions for measurement on the one Mac: CPU throttling through the DevTools protocol (`Emulation.setCPUThrottlingRate` at 4 and 6), software rendering (`--use-angle=swiftshader`) as the no-GPU floor, a 390 x 844 and a 1024 x 768 viewport, WebGL2 disabled (`--disable-webgl2`). Real devices only if the author offers their own (question 91); none are bought.
- **Deliverable:** the tier module and override in helix-app; S20; a tier section in `docs/qa-and-performance.md`.
- **Evidence:** S20 result files per condition; journal.
- **Acceptance:** under each condition the expected tier is selected, the override works, the tier's frame budgets pass; the low and no-WebGL tiers lose no scientific content (every label, chip, caption and limitation still reachable).
- **Depends:** P11.0; question 91 (viewport scope).

### P11.1.2 No-LLM full-function audit
- **Method:** S19 as described in section 2.2. Gene search is checked against the bundled records only (symbols, names, aliases of the five sets; an unknown symbol refused with the dynamic offer).
- **Deliverable:** `e2e/nollm.mjs`; a short report section in `docs/qa-and-performance.md`.
- **Evidence:** `nollm-<tag>.json` with the network log.
- **Acceptance:** S19's pass rule; every supported question in every set's questions record is answered by the rules (a question the rules cannot answer is a finding: fix the rule or remove the question from the offered list, never hide it).
- **Depends:** P11.0.

### P11.1.3 GPU, asset and memory optimisation (new, from the ROADMAP's "GPU and asset optimisation")
- **Method:** expose three.js `renderer.info` and Mol*'s structure count to the diagnostics hook; S22 soak; check that the hidden DNA canvas renders nothing while Protein World is shown (the C1 idle frame is that canvas, HX-P8-2026-11-03-idle-frame-trace); check the 2HBS and other structure files are fetched on first need only; check the bundle for packages that should not ship (for example `body-parser`, which `npm audit` flags in the tree, HX-P11-2026-11-09-phase11-plan section 1).
- **Deliverable:** fixes where the soak shows growth; the soak budgets.
- **Evidence:** `soak-<tag>.json`, bundle listing.
- **Acceptance:** soak budgets (3.2) pass; the bytes-at-rest budget still passes.
- **Depends:** P11.0.

### P11.1.4 WebLLM constraints (new, from the ROADMAP's "WebLLM constraints")
- **Facts so far:** no in-browser model engine is in the shipped build (`aiStatus()` in `apps/web/src/controller.ts`; journal HX-P11-2026-11-09-phase11-plan section 3). Phase 3 measured WebLLM with Qwen3.5-2B: 1.08 GB download, 4 of 10 correct and valid after stripping an empty think block, a 28.7 s scene freeze on the main thread, 133 ms worst frame in a worker, about 2.6 GB Chrome tree peak (HX-P3-2026-11-01-webllm-browser). WKWebView on macOS 15.3.1 exposes no WebGPU (HX-P1-2026-11-01-tauri-shell).
- **Method:** a feature probe page (no model download) recording `navigator.gpu`, the adapter's limits and WebGL2 in Chrome 156, Safari 18.3 and the Tauri webview on this Mac; Firefox if installed (question 92). Then the author's choice (question 90).
- **Deliverable:** a constraints table in `docs/ai-model-benchmark.md`; the AI status card's text checked against it.
- **Acceptance:** the table exists with a result file per browser; the app's statement about the in-browser model matches it.
- **Depends:** none.

### P11.2.1 Accessibility audit
- **Method:** S21 (automated, all sets and worlds); the keyboard map for every new control since Phase 7 (domain panel, This session card, pathway list, dynamic retrieve button, explorer refusals); reduced motion and low power on every world; the accessibility tree of every screen dumped and checked by script (names, roles, landmarks, live-region text), in Chrome and Safari; no manual VoiceOver pass (D-H032: dropped by the author; what is announced by ear is not verified, a stated limitation); zoom to 200 % and the 1024 px width.
- **Deliverable:** helix-app `docs/reviews/phase-11-accessibility-audit.md` with findings in the Phase 7 format (id, screen, finding, severity, state, evidence).
- **Acceptance:** 0 axe violations; every finding fixed or accepted by the author; the accessibility-tree check recorded with the browser versions.
- **Depends:** P11.1.1 (tiers change what is rendered); P11.6 layout items.

### P11.2.2 Usability inspection (amended by D-H031; was: usability sessions)
- **Why amended:** the author answered question 93 on 2026-11-09 that no participants are available, and that the project makes no usability claim. No session with real users runs in this phase.
- **Method:** two inspections on the release candidate, both by the AI and labelled as such wherever they are cited. (1) A heuristic evaluation against Nielsen's ten usability heuristics, screen by screen over every world and every curated set, each finding with its screen, heuristic, severity (0 to 4) and a screenshot. (2) A cognitive walkthrough of the nine tasks of the former session script (first look; find the sickle-cell variant and what it changes; ask a question; back to the DNA; open the evidence for one statement; another gene; keyboard only; reduced motion; no questionnaire), answering at each step the walkthrough's four questions (will the user try this, notice the control, link it to the goal, see progress). Each finding is fixed, scheduled for Phase 12, or recorded as a limitation.
- **What this is not:** not user testing, not evidence that real people can use the app, and not a System Usability Scale score; an inspection by the system's own builder has a known blind spot, stated in the limitations.
- **Deliverable:** `docs/reviews/phase-11-usability/` (method, heuristic table, walkthrough table, findings).
- **Acceptance:** every screen of S21 and every task inspected; each finding fixed, scheduled or recorded.
- **Depends:** a stable candidate (after P11.6, P11.1.x, P11.2.1).

### P11.3.1 Scientific audit of every displayed claim
- **Method:** a harness dumps every text the app displays per screen and per set (the accessibility tree and the DOM text of each screen of S21, the rule-based explanations of every supported question, the limitations, captions, evidence cards, chips and the dynamic banner) into an inventory; a script maps each sentence to the record field or the rule it comes from; a reader checks each against its record. Model prose (desktop and development pages only; a non-development host shows none, S17) is audited by class: the claim screen's held-out record and the model factual errors of the held-out audit (C8) are carried as limitations. No external review (D-H031, question 94: no reviewer available). To compensate in part, every displayed sentence must map mechanically to a record field or a named rule (a sentence with no source fails the script, not the reader), each record field is traced to its upstream source and release, and the report states that the claims were checked against their records by an AI-assisted audit only, with no independent domain expert.
- **Deliverable:** `docs/scientific-validation.md` section "Phase 11 audit" with the inventory, its sources and the findings.
- **Acceptance:** every displayed sentence has a source; every mismatch fixed or stated.
- **Depends:** P11.6 items C5 to C9.

### P11.3.2 Security, privacy and supply-chain review
Scope in section 7. **Deliverable:** helix-app `docs/security-review.md`. **Acceptance:** every item of section 7 answered with evidence; no high or critical advisory in anything that ships unless accepted by the author. **Depends:** P11.5.3 for the desktop part.

### P11.3.3 Final licence, attribution and cost audit
- **Method:** generate the third-party notices from the built bundle and the desktop crate graph (not from the lockfile alone: the lockfile counts 217 MIT, 5 ISC, 3 Apache-2.0, 2 BSD-3-Clause, 1 Python-2.0 and 1 0BSD non-dev entries in helix-app, HX-P11-2026-11-09-phase11-plan section 2, but the bundle is a subset); read the licence file of each bundled package (R3F ships none, `docs/license-attribution-cost-audit.md` section 6); close the open items of that doc's section 5; data attributions per source in the app and the notices (UniProt, PDB, AlphaFold DB, Ensembl, ClinVar, Reactome, Open Targets, HGNC); fonts (`apps/web/vendor/fonts/PROVENANCE.md`); the author-supplied wordmark (question 98); model licences (ministral-3:8b Apache-2.0 per `docs/ai-model-benchmark.md`; not bundled); section 8's $0 audit.
- **Deliverable:** `docs/license-attribution-cost-audit.md` final; `THIRD-PARTY-NOTICES` in the web build and the DMG.
- **Acceptance:** every shipped package, font, data source and asset has a row with its licence and attribution; $0 confirmed with evidence.
- **Depends:** P11.5.4 for the DMG contents.

### P11.3.4 Report section 9.8 and the French copy (new)
- **Method:** write report 9.8 in English as the phase advances (invariant 14), with claims rows; produce the French text of sections 9.4 to 9.7, which are still the planning stubs in `paper/report.fr.md` (the records say Phases 8 to 10 are owed; 9.4, Phase 7, is a stub too), then 9.8 at the gate, numbers and claims identical (D-006).
- **Acceptance:** the parity check (numbers and claim ids identical, every link checked) passes.
- **Depends:** each task's results.

### P11.5.1 Desktop shell (A-1)
- **Method:** `helix-app/apps/desktop` with Tauri 2 around the same `apps/web` build; native window, menus (About with the licences, the nonclinical notice), icon from `brand/marks/`; curated data bundled; the AI provider set `desktop` (`packages/ai-director/src/providers.ts`); a strict CSP; a capability file that allows only what section 7 lists. Versions pinned and at least two weeks old (D-H002). How S26 drives the app is chosen here (Tauri's WebDriver support on macOS is not established; the fallback is an in-app probe script reporting through the diagnostics hook, as in the Phase 1 experiment) and recorded.
- **Acceptance:** the HBB journey runs with the network blocked; the R3F scene renders in WKWebView (never run in the shell so far: `docs/rendering-integration-decisions.md` section 5 marks it an assumption).
- **Depends:** P11.1.1 (tiers apply in the webview); question 95.

### P11.5.2 Desktop local AI
- **Method:** the Ollama provider through a scoped Rust command or the one-URL HTTP scope (Phase 1 decision); detect, and when absent show how to install Ollama and pull the model, never download or bundle weights (question 96).
- **Acceptance:** S26's question-to-action scenario with ministral-3:8b; without Ollama, the deterministic experience with the stated reason.
- **Depends:** P11.5.1.

### P11.5.3 Desktop QA
- **Method:** the frame, start and memory budgets in the webview against the web; the security model (no remote code, CSP, capability allowlist, out-of-scope URL refused).
- **Acceptance:** the desktop rows of 3.2 pass once agreed.
- **Depends:** P11.5.2.

### P11.5.4 DMG packaging
- **Method:** ad-hoc signature, licence and third-party notices inside, an install note that says the app is not notarised and how macOS will warn; `codesign --verify --deep --strict`, `hdiutil verify`, launch from a fresh macOS user account; the quarantine behaviour of a copied DMG tested (untested in Phase 1).
- **Deliverable:** `dist/Helix-*.dmg`, not committed, not distributed (G-PUBLIC, question 97).
- **Acceptance:** S27.
- **Depends:** P11.5.3, P11.3.3.

### P11.4.1 Phase 11 gate review
- **Method:** one build of record; the whole agreed suite and the agreed budgets on a quiet machine; the limitations document final; the review page `docs/reviews/phase-11.md` with every check, its command, exit code and result file; claims rows; report 9.8 and the French copy.
- **Acceptance:** section 1 holds; the author's verdict.

## 5. Carried items

| # | Item | Origin | Task | Proposed handling |
|---|---|---|---|---|
| C1 | Protein World idle frames: 2 at dpr 2 low power (`budgets-p10-final.json`) | Phase 8 (HX-P8-2026-11-03-idle-frame-trace: the hidden DNA scene renders one frame after the switch, not reproduced under trace) | P11.0, P11.1.3 | trace with the flag in P11.0; pin, then stop the hidden canvas's frame loop while Protein World is shown; keep the budget at 0 (question 85) |
| C2 | The 63.3 ms long frame at dpr 2 in the Phase 10 gate run, under background load | Phase 10 question 72 (D-H024) | P11.0 | rerun on a quiet machine with 5 pages; attribute with Long Animation Frame entries if it recurs |
| C3 | A follow-up on the split waits for a model plan the split then discards: 18 to 22 s in the app (Phase 6 `ollama-split`, `docs/reviews/phase-10-close.md` section 6); in the stored held-out run 12 follow-up model calls, 6 discarded, median 13.7 s (HX-P11-2026-11-09-phase11-plan section 4) | Phase 10 close | P11.6 | question 86 |
| C4 | The claim screen's held-out record: 0 true hits, 7 false positives, 1 miss | D-H026 answer 76 | P11.3.1, section 9 | kept as a safety net (decided); stated wherever the screen is described; a limitation |
| C5 | Research harness re-statements differ from the app: the bridge's residue for HBB codon 7 (chain H in the app, chain B in the Phase 10 re-statement) and the personalisation topics (`interestsFor` adds "evidence" for any revealEvidence; the app's `topicsOfPlan` does not) | HX-P10-2026-11-09-heldout-run; phase-10-final.md finding C | P11.6 | question 87 |
| C6 | P10H-BRCA1-08: the rules answer a residue-61 question with `showProteinDomains` (BRCT) on 1JM7, which covers neither domain; the app paints 0 residues and says so | phase-10-final.md finding D | P11.6, P11.3.1 | pin, then the rule refuses domains the loaded structure does not cover (or answers in DNA World); a rules change is reported as a new rules version with both scores on the frozen sets, never re-scored in place |
| C7 | The S15 and S16 replay exceptions | phase-10-close.md section 5 | S15, S16 | question 84 |
| C8 | Model factual errors in the held-out audit outside the forbidden-claim list (HBB-08 binding residue; "lists 25" for 25 of 552 and of 51; FU-SLC6A3/3's reason for non-openable pathways); the "clinically relevant" and prompt-vocabulary wording on screen | HX-P10-2026-11-09-final-audit finding 6; phase-10-final.md finding F | P11.3.1, section 9 | question 88 |
| C9 | The HBB words in the rule-based planner's two clarify messages (residue number, globin ambiguity), and prompt v5's rule 13 naming HBB, beta-globin and hemoglobin as routing examples | helix-app `docs/reviews/phase-9.md` | P11.6 | question 89 |
| C10 | A visitor cannot name a dbSNP id for a dynamic set | phase-9.md; phase-9-dynamic.md | section 9 | no question: proposed as a limitation (Phase 11 adds no features); say so if you want it built |
| C11 | The two switcher notes stack over the illustrative plate on a dynamic set | phase-9-dynamic.md | P11.6 | layout fix, pinned by a shot check in S12 |
| C12 | Mol*'s in-scene emphasis label ("HbS: VAL H6") is large and overlaps the caption's row on the contact view | phase-8.md; phase-8-chrome-polish.md | P11.6 | label size through Mol*'s public label parameters or the caption moved; a shot check; if Mol* allows neither, a documented limitation |
| C13 | French copy of report sections 9.4 to 9.7 | D-006; R.5 | P11.3.4 | write them |
| C14 | Smaller Phase 8 and 9 items: the specular bloom on satin parts at the overview, the Sound control as a kit component, the partner entity named by its deposited description, no search in large participant lists | phase-8.md; phase-9.md | P11.6 or section 9 | fix the first two if the baseline frames allow; record the last two |
| C15 | `body-parser` 2.0.0 to 2.3.0 high advisory (GHSA-27r3-jxmh-p828), upgrade owed since 2026-11-05 | known-limitations.md; HX-P11-2026-11-09-phase11-plan section 1 | P11.3.2 | upgrade through an override pinned to a version at least two weeks old, or show it is not in any shipped artefact and accept |
| C16 | The local tags `p10-benchmark-frozen` and `p10-heldout-frozen` are not pushed | phase-10.md; D-H023, D-H025 | none (G-PUBLIC) | question 99 |

## 6. Order of work

1. The author answers questions 81 to 85 (suite and budgets), so nothing is measured against an unagreed bar (D-H028).
2. P11.0 baseline (read-only on the product). In parallel, document work: P11.1.4 probe table, P11.3.4 French copy of 9.4 to 9.7, the usability inspection method (D-H031).
3. P11.6 carried items C1, C6, C9, C11, C12, C15 (and C3, C5 as the author answers), each pinned first, with S1 to S18 rerun after each change set.
4. P11.1.2 no-LLM suite, then P11.1.1 tiers, then P11.1.3 optimisation and soak.
5. P11.2.1 accessibility (automated, Chrome and Safari; no manual pass, D-H032).
6. P11.3.1 scientific audit; P11.3.2 security review (web part); P11.3.3 licence scan (web part).
7. Release candidate: a build of record, S1 to S22 green, budgets green. Then P11.2.2 usability inspection on that candidate; fixes; S1 to S22 again.
8. P11.5.1 to P11.5.4 desktop, then the desktop parts of P11.3.2 and P11.3.3.
9. P11.4.1 gate: one build of record, the whole agreed suite, the budgets, the limitations, report 9.8 EN and FR.

The desktop track (step 8) depends only on P11.1.1 and can start earlier if the author prefers (question 95); the web candidate is not held for it.

## 7. Security review scope (P11.3.2)

1. **Untrusted inputs.** The visitor's question text (length limits, no HTML rendering, the claim and echo screens); URL parameters (`?gene`, `?dataset`, `?prompt`, `?ollama`, `?power`, `?motion`, `?dev`: which are honoured on a non-development host, S17); gene symbols in dynamic mode (validated before any URL is built, the library's URL builders).
2. **Retrieved text.** Public API responses (Ensembl, HGNC, UniProt, AlphaFold DB, and in curated builds RCSB, ClinVar, Reactome, Open Targets) parsed through zod schemas; retrieved text never enters a model context unmarked (split routing row 1: the model is not called when the context carries retrieved untrusted text); injection results so far (Phase 10 policy 36/36, held-out split 18/18; `docs/ai-model-benchmark.md` section 11); rendered as text, never as HTML (no `innerHTML`, `dangerouslySetInnerHTML`, `eval` or `new Function` in `apps/web/src`, HX-P11-2026-11-09-phase11-plan section 3); the hash check of every curated and dynamic file against its manifest.
3. **No generated code execution.** The model returns a typed plan validated against the action registry; actions take semantic targets only; no action takes a coordinate, a URL or code from the model. To verify: a grep for dynamic code paths in the bundle, and Mol*'s own use of `eval`-like features, under a CSP.
4. **CSP for the web build.** None today (same journal section 3). Add a CSP (`default-src 'self'`, `connect-src` limited to the APIs dynamic mode calls, `worker-src 'self' blob:` if needed, no inline script), checked by S1 to S22 running under it.
5. **Tauri capability allowlist.** Core IPC plus HTTP scoped to `http://localhost:11434/*` (the Phase 1 capability file) and the dynamic-mode API hosts only if dynamic mode is kept on desktop; no shell, no filesystem write, no process spawn; remote content never gets IPC; the CSP of the Phase 1 experiment as the starting point; an out-of-scope request refused (S26).
6. **Privacy.** No personal genomic data accepted or uploaded; no analytics, no cookies; storage limited to the sound preference (S13 asserts empty stores after a session); the dynamic manifest keeps the browser's user agent in memory only (D-H022 answer 68); no email or identifier in any request (the Phase 1 lapse rule); no visitor data reaches any server Helix runs (it runs none).
7. **Supply chain.** Lockfiles committed in both repos and every experiment; exact versions only (no `^` or `~` in any manifest, same journal section 2); every new or updated package at least two weeks old at install; `npm audit` (S25: today one high advisory, C15); `cargo audit` on the desktop crate graph (to install, free); the licence scan of P11.3.3; the CLA Assistant action pinned by SHA (D-H004); Node and Rust toolchains checksum-verified (D-H002).
8. **Deployment endpoints.** None exist; a static host is a Phase 12 decision (G-PUBLIC). The review lists what any host must serve (headers, the CSP) for Phase 12.

## 8. The $0 cost audit (P11.3.3)

Evidence to collect, each with its source: the toolchain (Node, npm, uv, Python, Rust, Tauri, Chrome) free and user-space; every npm and cargo dependency under a free licence; the data sources' terms (no paid tier, no BigQuery for Open Targets, `docs/license-attribution-cost-audit.md` section 1); the model (ministral-3:8b, Apache-2.0, run locally; no paid inference anywhere, no cloud fallback); fonts SIL OFL 1.1; the wordmark produced by the author (no purchase recorded); no Apple Developer membership (the DMG is ad-hoc signed); no hosting, no domain; usability sessions unpaid unless the author decides otherwise (G-SPEND). Bandwidth: a visitor's own (the 1,989.6 kB at rest; dynamic mode's API calls), stated in the limitations. The audit states the sum: $0, or names each exception the author approved.

## 9. Limitations (the final document)

The skeleton that stood here has been replaced by the limitations document itself, helix-app `docs/known-limitations.md` (2026-11-12, helix-app 196efd2; journal HX-P11-2026-11-12-limitations). It holds the in-app list (section 1), the whole list in thirteen areas, each row with its consequence for a visitor, its evidence and its state (section 2: scope, science and data, AI, performance and hardware, device tiers, viewports and browsers, accessibility, usability, security and privacy, supply chain, licences, process and cost, desktop), the outcome of every carried item C1 to C16 of section 5 (section 3), and the questions left to the author (section 6). The lines that apply to what a visitor sees are in the app (`KNOWN_LIMITATIONS`), and report section 10 summarises the document.

Two rows are pending and are filled by later tasks: **Usability** (P11.2.2, the AI's inspection, D-H031) and **Desktop** (P11.5.1 to P11.5.4). The gate review (P11.4.1) rereads the document on the build of record.

## 10. What needs the author

Questions continue the Helix numbering (80 was the last, D-H027). Each has options and a recommendation; nothing below is started before the answer where the answer changes the work.

81. **The agreed test suite (section 2).** (a) Agree S1 to S28 as proposed, with S24 (live retrieval) run once and journaled but not a pass condition; (b) as (a) with S24 a pass condition (drift in a public API would then block the gate); (c) drop the model-backed scenarios (S6 to S8 model parts, S26's Ollama question) from the gate so the gate does not depend on a running Ollama. **Recommendation: (a).** The model scenarios are the only test of the shipped model path; Ollama is a free local dependency already used at every gate.

82. **The current budgets (section 3.1).** (a) Keep every value as it is; (b) tighten the budgets with large headroom (start times measured at about a fifth of their budget) to catch regressions earlier. **Recommendation: (a).** They are regression guards agreed in Phase 8; tightening on one machine would make them less meaningful on others. Note the 10.4 kB headroom on bytes at rest.

83. **The new budgets (section 3.2).** (a) Agree the metrics and reasons now; the values are measured in P11.0 and brought back in one table for agreement before the gate measures against them; (b) agree fixed values now. **Recommendation: (a).** Option (b) would need values without measurements, which the rules forbid.

84. **The replay exceptions (S15, S16).** (a) An allowlist file in the harness naming each accepted unit with its reason and decision (P10-CFTR-13 and P10-CFTR-19 under D-H024; P10H-BRCA1-08 until C6 is fixed); any other difference fails, and the gate reads exit 0; (b) keep exit 1 and read the differences by hand at each gate. **Recommendation: (a).** A gate read by exit code should not need a human to know which failures are expected.

85. **The idle-frame budget (C1).** (a) Keep 0 and fix the hidden DNA canvas (pin first); (b) allow at most 1 idle frame per page in Protein World. **Recommendation: (a).** The frame is understood well enough to fix; relaxing would hide a real render.

86. **The split follow-up wait (C3).** (a) Keep as built and state the latency; (b) keep the policy and add a control during the wait, "Answer with the rules now", which cancels the model call and runs the rules' plan (what the split falls back to), so the measured policy is unchanged; (c) stop calling the model on routing row 6 unless the question carries an explorer-action cue (a new routing rule: a new study, new held-out rows written blind and your G-FREEZE before it is measured); (d) run the model in the background after showing the rules' answer and offer its plan as a chip when it uses an explorer action (changes what reaches the screen: also a new study). **Recommendation: (b)**, with (c) only if usability sessions show the wait matters.

87. **The research harness re-statements (C5).** (a) Leave `scripts/ai-benchmark/phase10-lib.ts` as it is (it reproduces the frozen Phase 10 run, which must stay reproducible), record both differences as findings of that run, and require any new harness to import the app's code as the held-out harness does; (b) fix the re-statements and re-score the Phase 10 run (a re-scoring of a frozen study, reported beside the original, never in place of it). **Recommendation: (a).**

88. **Model prose shown on desktop and development pages (C8).** (a) Keep the model's explanation sentences, labelled as the AI model's, and list the known factual errors as a limitation; (b) on desktop show only the deterministic sentences, with the model choosing actions only; (c) extend the claim screen with the new error classes (a new screen version, measured on new held-out rows). **Recommendation: (a)** for Phase 11, with the error classes in the limitations; (b) is the safer product if the usability sessions show people read the model's sentences as fact.

89. **HBB words in the clarify messages and prompt v5 (C9).** (a) Make the two clarify messages read the set's own names (pin first; a rules change reported as a new rules version with both scores), and leave prompts v5 and v8 unchanged, recording the routing examples as a limitation (v5 is reachable only on a development page); (b) also write a prompt v9 with generic routing examples (a new study with held-out rows and a freeze). **Recommendation: (a).** Phase 11 is QA; a new prompt reopens the AI benchmark.

90. **In-browser model (WebLLM) for the web demo (P11.1.4).** (a) Not shipped: the public web build is the rules-only experience, with the measured constraints stated in the AI status card and the limitations; (b) ship it as an opt-in experiment in a worker, with the download size stated before fetching, measured on the frozen held-out set first (a new planner on a frozen set: allowed, but a new run). **Recommendation: (a).** Phase 3 measured 4 of 10 correct and valid and a 1.08 GB download, and the desktop webview has no WebGPU.

91. **Device and viewport scope (P11.1.1).** (a) Laptop and desktop widths of 1024 px and more are supported; narrower viewports get a page that says so and still offers the sequence, the evidence and the limitations; (b) also lay out for tablets (768 px and more); (c) full phone support. Separately: do you have devices of your own the suites may be run on (an older Mac, an iPad, a phone)? None will be bought. **Recommendation: (a)**, and any of your own devices as a manual check.

92. **Browsers.** (a) Allow automating Safari through safaridriver (you would enable "Allow Remote Automation" in Safari's Develop settings yourself) and install Firefox user-space (free) for a run of S6 to S14; (b) manual passes only in Safari, no Firefox; (c) Chrome only, the limitation stated. **Recommendation: (a)**; Safari's engine is also the desktop webview's.

93. **Usability sessions (P11.2.2).** Who, how many, how. (a) Five participants you recruit (for example two with a biology background, two without, and if possible one who uses a keyboard or a screen reader daily), each 30 to 40 minutes, run by you with the script of section 4, notes anonymised as U1 to U5, no recording unless the participant agrees, findings reported as informal formative feedback (no quotes with names, no demographics); (b) three participants; (c) you as the only tester, the limitation stated. The AI cannot be a tester. If you want the findings in the report or the article as research results rather than as product feedback, a research-ethics check may apply; that would be your call and outside this plan. **Recommendation: (a).**

94. **External scientific review.** Report section 10 says external review of the scientific claims is planned for Phase 11. (a) One reviewer you know with a molecular biology background reads the P11.3.1 inventory and the evidence cards for the five sets; (b) none, and the report says the claims were checked against their records by the AI-assisted audit only; (c) a professor or other academic contact (that would be a G-ADMIN step if it concerns UdeM). **Recommendation: (a)**, otherwise (b) with the wording changed.

95. **Desktop timing (A-1).** (a) Build P11.5.1 to P11.5.4 in Phase 11 after the web candidate is green, as the ROADMAP says; (b) start the desktop shell in parallel now; (c) move the desktop build to after Phase 12. **Recommendation: (a).**

96. **Desktop local model.** (a) The app detects Ollama and, when absent, explains how to install it and pull ministral-3:8b (6.02 GB, Apache-2.0, the measured model); nothing is bundled; (b) bundle Ollama as a sidecar (not evaluated; size and licences to check). **Recommendation: (a).**

97. **Signing and distribution (G-SPEND, G-PUBLIC).** Notarisation needs a paid Apple Developer membership. (a) No membership; the DMG is ad-hoc signed and stays local until Phase 12, when you decide whether and where to distribute it; (b) you pay for notarisation. **Recommendation: (a).** Zero spend is the rule and no other spend is expected in Phase 11.

98. **Licences and rights (G-PUBLIC, G-RIGHTS).** (a) The DMG and any web build carry helix-app's proprietary terms (all rights reserved, as the repository), plus the third-party notices; the Tauri crates are taken under their MIT option; the author-supplied wordmark is cleared before any release by you: the OpenAI terms clause in force kept in `brand/author-supplied/PROVENANCE.md`, the prompt record, and a trademark search (decision D-H011 and question 28 left these "to settle before release"); (b) a different licence for the distributed builds (for example the helix-research non-commercial licence). **Recommendation: (a).** Nothing is published in Phase 11.

99. **Freeze tags (G-PUBLIC).** The local tags `p10-benchmark-frozen` and `p10-heldout-frozen` record the freezes D-H023 and D-H025 and are not pushed. (a) Push both tags to helix-research (after checking that they point at commits of the rewritten history); (b) keep them local and cite the commits in the report. **Recommendation: (a).**

100. **French copy timing (D-006).** (a) Write the French sections 9.4 to 9.7 now, at the start of Phase 11, and 9.8 at the gate; (b) all at the gate. **Recommendation: (a)**; the English sections are stable and the debt has carried since Phase 7.

## 11. Not in this phase

New features (a visitor-named dbSNP id for a dynamic set, search in large participant lists, new genes, new actions), new prompt versions and new benchmark studies unless the author chooses an option above that opens one, hosting and publishing (Phase 12), the demo recording and the case study (Phase 12).
