<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# Phase 12: portfolio showcase and launch, the plan

Authored 2026-11-14 when the author passed the Phase 11 gate and started Phase 12 (helix D-H050: "Pass, start Phase 12"). Governs ROADMAP Phase 12 (P12.1.1 to P12.3.1) and adds the tasks this plan proposes (section 4, marked "new"). The master prompt's rules that bind this phase: section 12 (the experience blueprints a visitor must be able to walk), section 15 Phase 12 (reproducible source, static or free hosting if feasible, an excellent landing and entry journey, technical diagrams, scientific and data attributions, a demo recording and screenshots, an engineering case study and README; deliverable: a public portfolio demo where viable and a locally reproducible full experience; gate: visitors can discover, explore and witness AI-to-world actions, and reviewers can verify the engineering and the sources), section 16 (the documents, and a case study that shows the scientific research, the HBB data mapping, the AI architecture and tool safety, the scene and action interpreter, the 3D rendering techniques, the premium UX decisions, performance, tests, limitations and lessons, with a clear demo of the natural-language question changing the real interactive world), section 8 (never pretend a local Ollama is reachable by public visitors), and the Definition of Done. Workspace gate G-PUBLIC governs everything that leaves the machine: a push of the private source, any hosting, the DMG, a post, the report or the article. Workspace invariants 3 to 5, 12 and 14 apply throughout.

**How to read this plan.** Everything marked **PROPOSAL** waits for the author's answer (section 8, questions 101 onward). Nothing in this file is estimated: a value is measured, cited, or reads "to be measured". Facts about a hosting service are checked against that service's current documentation in P12.1.1 and cited with the date read; none is assumed here. The agent creates no account, signs up for nothing and publishes nothing.

**Build of record at the start of Phase 12:** helix-app 09334b1 (the Phase 11 gate, D-H050), pinned to helix-research e390be0; gate records helix-app 8f612b5 (`docs/reviews/phase-11.md`), helix-research 816b3ee (HX-P11-2026-11-14-gate). The static web build is 17 MB in 108 files (6.1 MB of code, fonts and images under `assets/`, 11 MB of curated data under `data/`), with relative paths (`base: "./"`), so it can be served from any folder of any host. Bytes at rest 1,975,305 of 2,000,000 (24,695 of room; C188).

## 1. What must be true at the end

1. **A static build of record** is made from one commit, contains only what the licence audit cleared (the concept prototypes and their four font families left out, D-H040 (4)), and carries a release version and identifier (D-H046).
2. **It is served as a visitor would get it:** on the host the author chose, or, if the author does not publish, by a local static server that sends the same headers. Either way a script checks every requirement of helix-app `docs/security-review.md` section 8 against the served URL (HTTPS where hosted, the CSP as a header, the other headers, MIME types, caching, compression), and the bytes budget is measured on that server.
3. **The Phase 11 suite and budgets pass again** on the Phase 12 build of record, read by exit code, result files committed (the regression guard for every change this phase makes).
4. **A visitor can discover, explore and witness AI-to-world actions** without a model: the landing and entry journey leads to the HBB question changing the world through the rules, the five curated genes and the live retrieval are reachable, and the page says plainly what runs where (the local model only on the desktop app, never on the public page).
5. **A reviewer can verify the engineering and the sources:** `docs/portfolio-case-study.md` with the section 16 contents and diagrams, `docs/product-vision.md`, both READMEs brought up to date, attributions on screen and in the notices, every number in the case study linked to a journal entry or result file.
6. **The demo recording** shows the critical natural-language question changing the real interactive world, made by script from the build of record, with stills.
7. **The items earlier phases left for release** (section 5) are each done, or decided by the author as a stated limitation.
8. **Report section 9.9** is drafted in English with the French copy, the final French copy of the whole report is made (ROADMAP R.5), and the article (R.6) is drafted in both languages from the frozen report. Publishing any of them is the author's decision (G-PUBLIC).
9. **Publication**, if the author chooses it (question 101), happens only after the gate review, as its own step, by the author or on the author's explicit word.

## 2. The suites (PROPOSAL, question 107)

The gate suite of Phase 11 (S1 to S27 and S29 as agreed in D-H029, D-H033 and D-H047, `phase-11-release-qa.md` section 2) is rerun on the Phase 12 build of record, with the same commands and pass rules. Two suites are added:

- **S30, host check** (new, `apps/web/e2e/host-check.mjs`): fetches the served build at a given URL and checks each requirement of `security-review.md` section 8, one line per requirement, exit 0 only if every one holds; then runs S6, S19 and S21 against that URL. Run against the local static server always, and against the public URL if one exists.
- **S31, release contents** (new): the build contains no concept prototype, no font family outside the notices, no source map, no development switch reachable (`?dev`, `?diagnostics` stay as accepted under P11-SEC-02 unless question 106 changes that), and the version and identifier set in question 105.

## 3. Budgets

Unchanged from Phase 11 (`apps/web/e2e/budgets.json`, D-H034, D-H047). The bytes budget is additionally measured on the S30 server, since the host's compression decides what a visitor downloads (`security-review.md` section 8 item 6). Every product change of this phase states its byte cost; the 24,695 bytes of room is the constraint on question 104.

## 4. The tasks

### P12.0 Plan (new)

This document, its journal entry (HX-P12-2026-11-14-phase12-plan) and the questions of section 8.

### P12.1.1 Static build and hosting assessment

A release build script (`npm run release:build`) that leaves out the concept prototypes, sets the version and identifier and writes a manifest of every file with its sha256. A local static server that sends the section 8 headers (`apps/web/e2e/static-host.mjs`, no new dependency), and S30 against it. The hosting assessment: each candidate host the author names, or the free static hosts the assessment finds, read against section 8 from the host's own current documentation (can it send a CSP header and the other headers, HTTPS and HSTS, MIME types, cache rules, compression, log policy, terms of the free tier, whether the source repository must be public), cited with the date read. No account is created; the result is a table for the author.

### P12.1.2 Landing and entry journey

What a first-time visitor meets, judged against blueprint A and the usability findings already decided for this phase (question 104). Each change pinned first, its byte cost stated, S21 and the layout suite rerun.

### P12.1.3 Release items (new)

The section 5 items: the zod `eval` report (question 106), the version and identifier, the release contents; the author's own items (the wordmark clearance, the ClinVar and RefSeq usage pages, D6) listed with their state at the gate.

### P12.2.1 Diagrams, attributions, case study, READMEs

`docs/portfolio-case-study.md` (helix-app) with every section 16 heading, written from the journal and the reviews, every number cited; diagrams as SVG drawn from the code's real structure (the data path from the public sources to the curated sets, the AI path from question to validated action plan to the scene, the world and journey engine, the desktop shell); `docs/product-vision.md`; both READMEs rewritten to the current state (helix-app's still reads Phase 7, helix-research's Phase 2), with how to build, test and run locally from a clean clone. The case study states the limitations plainly: no user testing, no independent domain expert, one reference machine, AI-assisted audits.

### P12.2.2 Demo recording

`apps/web/e2e/demo-record.mjs` (Phase 6, Chrome's screencast and MediaRecorder, no new tool) extended to a scripted take on the build of record: the welcome, the question "Show me where the sickle-cell mutation affects hemoglobin" answered by the rules and changing the world, a follow-up, a second gene, the evidence. Optionally a desktop segment with the local model, labelled as the desktop app (question 103). Stills from the same run. Captions are on-screen text, no voice.

### P12.2.3 Report, final French copy, article (new)

Report section 9.9 (this phase) EN and FR; the final French copy of the whole report with the parity check (R.5); the article EN and FR from the frozen report, its claims a subset of the register (R.6).

### P12.3.1 Phase 12 gate review

`docs/reviews/phase-12.md`: the build of record, the Phase 11 suite and S30, S31 by exit code, the host check, the case study and recording, section 1 criterion by criterion, the release items' state. The verdict is the author's. Publication (question 101) follows the verdict, never precedes it.

## 5. Items left for this phase by earlier phases

From the limitations document, the security review, the licence audit and the decisions (inventory for this plan, HX-P12-2026-11-14-phase12-plan).

**Before anything is hosted (kind 1):**

| Item | What | Decision | Task |
|---|---|---|---|
| P11-SEC-04 and section 8 | The host serves the CSP as a header (as a meta element it exceeds the bytes budget) and every other section 8 requirement | to choose the host (102) | P12.1.1, S30 |
| P11-SEC-06 | zod's feature probe makes one refused `script-src 'eval'` report per page load | D-H039 (2): "with the host in Phase 12"; question 106 | P12.1.3 |
| P11-LIC-10 | Concept prototypes and their four font families out of the build | D-H040 (4) | P12.1.1, S31 |
| D-H046 | Release version (now 0.0.0) and desktop identifier (now `local.helix.desktop`) | question 105 | P12.1.3 |
| P11-LIC-08 | Wordmark clearance: the terms clause, the prompt record, a trademark search | D-H011, D-H030 (98): the author's action | author |
| P11-LIC-07 | One browser visit to the ClinVar data-use page and the RefSeq FAQ (reCAPTCHA blocks scripts) | D-H040: the author's action | author |
| D6 | The private app consumes the non-commercial research packages because the author owns both; confirm before release | open | author (question 103) |
| D-H030 (97) | The ad-hoc signed DMG stays local until this phase decides | question 103 | author |
| Q-1 | Whether the built demo is published, and where | question 101, 102 | author |

**Proposed product work (kind 2):** the ten usability findings dispositioned to Phase 12 under D-H043 (P11-U-09 the welcome opens again after a gene switch; U-10 reference numbers are not links; U-11 the side panel runs to 13 or 14 sections and repeats the supported questions; U-13 no help or glossary; U-14 the narrow page has no in-page links; U-15 the explorer's refusal lists Reactome ids, not pathway names; U-19 "Replay" for a tour never played; U-20 the Mol* label repeats itself; U-21 the features card title wraps one word per line; U-27 the welcome kicker leaves out Pathway World), the glossary considered under D-H043 (4) (U-12), curated genes typed in lower case, as aliases or full names (D-H045 (2), a rules change: a new rules version with both frozen scores), and the desktop tour's long first frame and the extra drawing after start (D-H047 (1)).

**Stated, mentioning Phase 12 (kind 3):** P11-SEC-13 (the Rust installer checksum, recordable at a reinstall), P11-SEC-14 (accepted, D-H047 (3)), Safari S10 and S11 and Firefox S10 and S13 (causes not established; question 108), and the open notes kept by D-H050.

## 6. Order of work

1. P12.0 and the author's answers.
2. P12.1.1 release build, static server, S30, S31, the hosting table.
3. P12.1.2 and P12.1.3, each change pinned first, with the byte cost.
4. The Phase 12 build of record; the Phase 11 suite, S30 and S31 on it.
5. P12.2.2 recording from that build; P12.2.1 case study, diagrams, READMEs (written alongside from step 2, finished on the build of record's numbers).
6. P12.2.3 report 9.9, final French copy, article.
7. P12.3.1 gate; then, only on the author's word, publication.

## 7. Not in this phase

New genes, new actions, new prompt versions or benchmark studies, a public in-browser model (D-H030 answer 90), notarisation (G-SPEND, D-H030 answer 97), analytics or any data about visitors, phone layouts (D-H030 answer 91), and any account, sign-up or publication by the agent.

## 8. What needs the author

Questions continue the Helix numbering (100 was the last, D-H030). Each has options and a recommendation.

**Answered (D-H051, 2026-11-14): every recommendation.** 101 (a), 102 (a), 103 (a) (you confirmed D6 by choosing it), 104 (a), 105 (a), 106 (a), 107 (a), 108 (b), 109 (a), 110 (a). The PROPOSAL marks in sections 2 and 4 are agreed as written. **Host (D-H052, 2026-11-14):** Cloudflare, Workers static assets (`docs/phase-12-hosting.md`).

101. **Publish the demo (Q-1, G-PUBLIC).** (a) Build and check everything locally, including against a local server that behaves as the host would; decide at the gate whether to publish; (b) decide now to publish a public demo at the end of the phase; (c) never publish: the deliverable is the locally reproducible experience, the case study and the recording. **Recommendation: (a).** The decision is better made on the finished build and the host table.

102. **The host.** (a) The agent assesses free static hosts against `security-review.md` section 8 from their current documentation and brings back a table; you choose, and you create any account yourself; (b) you name a host now. A host that cannot send a CSP header fails requirement 2, since the meta element exceeds the bytes budget. **Recommendation: (a).**

103. **What is public besides the demo.** helix-research is public; helix-app is private with all rights reserved. (a) Keep helix-app private; the case study, the diagrams and the recording go into helix-research (public) and the build carries its notices; the DMG stays local; you confirm D6 (the private app may use the non-commercial research packages, as you own both); (b) make helix-app source-available under the helix-research licence, so reviewers can read the product code (a licence choice: G-PUBLIC); (c) as (a), and attach the DMG to a release with the Gatekeeper warning explained. **Recommendation: (a).** It matches the licensing pattern of your other repositories (research source-available, product proprietary); the case study is how reviewers check the engineering, and the cost is that they cannot read the app's code without your invitation.

104. **The usability items for this phase (section 5, kind 2).** (a) Fix the ten minor findings and the lower-case, alias and full-name recognition (rules version 7, both frozen scores reported); the glossary stays a stated limitation; each change pinned first and within the bytes budget; (b) as (a) with a glossary view; (c) none: all stay as stated limitations. **Recommendation: (a).** They are small, already found and dispositioned; a glossary is new content to write and check scientifically, and the 24,695 bytes of room may not hold it.

105. **Version and identifier (D-H046).** (a) Version 1.0.0 for the web build and the desktop app; desktop identifier `io.github.mohamedbechirkefi.helix` (your public account's domain, so nothing private); (b) version 0.9.0 (a preview), same identifier; (c) values you name. **Recommendation: (a).**

106. **zod's `eval` probe (P11-SEC-06).** (a) Configure zod not to probe (its jitless setting, set once before first use; pin first: a test that the probe makes no report under the CSP), so the CSP report count is 0; (b) keep it accepted as now. **Recommendation: (a)**, D-H039 (2) placed it here.

107. **The suites (section 2).** (a) Rerun the Phase 11 suite on the Phase 12 build of record and add S30 and S31; (b) also add a manual pass in Firefox and Safari against the served build. **Recommendation: (a)**; the Firefox and Safari automated runs (D-H030 answer 92) are repeated as in Phase 11, as a record.

108. **The open browser faults.** Safari's wheel zoom stops short of the base-pair scale (S10) and its sound preference reads back null (S11); Firefox's S10 and S13 are intermittent. (a) Leave them stated; (b) one diagnosis pass of at most a working session on the two Safari faults, which a public visitor on Safari would meet; a fix only if the cause is in the app, pinned first; the Firefox faults stay stated. **Recommendation: (b).**

109. **Report and article (R.5, R.6).** (a) In this phase: report 9.9 EN and FR, the final French copy, the article EN and FR from the frozen report; none published without your word; (b) the article after Phase 12. **Recommendation: (a).**

110. **The recording (P12.2.2).** (a) The scripted web take on the rules, plus a short desktop segment with the local model, labelled as the desktop app; captions on screen, no voice; (b) web take only; (c) you record it yourself. **Recommendation: (a)**: the public page has no model, and the desktop segment shows the local model path without implying a visitor has it.
