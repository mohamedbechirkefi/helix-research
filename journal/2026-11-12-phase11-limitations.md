<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HX-P11-2026-11-12-limitations: the Phase 11 limitations document, the in-app list brought up to date

```yaml
id:            HX-P11-2026-11-12-limitations
date:          2026-11-12
phase:         P11 (plan section 9 and exit criterion 10; carried items C1 to C16 of section 5)
hypothesis:    Every limitation found in Phases 7 to 11 can be stated with its evidence and state in one document, and the lines that apply to what a visitor sees fit in the app within the bytes budget with every displayed sentence still mapped to a source.
git_commit:    helix-app 3b0e1b0 (pin: test/p11-limitations.test.tsx failing), 196efd2 (change: phase6.tsx KNOWN_LIMITATIONS), then the docs and results commit; helix-research this entry's commit (report sections 9.8 and 10, claims C161 to C164, plan section 9); research pin a6a8b44 unchanged; by a delegated agent on Opus 5.5
config:        budgets.mjs --tag=lim (start, structure, bundle; no frame files); security.mjs --bytes --tag=lim-bytes; text-inventory.mjs --tag=lim --run-a11y (S21 in Chrome) then source-map.mjs --tag=lim; nollm.mjs --tag=lim; phase10-replay.mjs --tag=lim and --mode=heldout-split --tag=lim-heldout; vite preview on port 5192
seed:          none
data_version:  the five curated sets at helix-research a6a8b44, unchanged
hardware:      Apple M1 Pro, the development Mac; Chrome 157.0.8103.52 headless; Node 22.23.3
duration:      about 2 hours of wall-clock
cost:          0 (no model call, no live API call, no network request)
```

## Method

Read the Phase 11 plan (sections 1, 5, 9), the decisions D-H029 to D-H040, every Phase 11 journal entry, the Phase 11 review pages, the security review, the QA page, the scientific audit (helix-research `docs/scientific-validation.md` section 7) and the licence audit. Each limitation became one row (area, limitation, consequence for a visitor, evidence, state) in helix-app `docs/known-limitations.md`; each carried item got an outcome with its evidence. The visitor-facing gaps of the in-app list were then pinned and changed. Developer matters (the Node checksum file, the CSP a host must serve, the HBB rebuild, the dead `one-gene` constant) were left out of the app by rule.

## Measurements

| Measurement | Value |
|---|---|
| Rows in the document, section 2, by area | scope 5, science and data 14, AI 15, performance 9, tiers 6, viewports and browsers 6, accessibility 3, usability 1 (pending), security and privacy 7, supply chain 5, licences 8, process and cost 2, desktop 1 (pending): 82 |
| Carried items | 16 with an outcome: 12 fixed (at least the part decided), 2 accepted by a decision (C2, C4), 2 recorded without an explicit decision (C10; C14 (c), (d)) |
| In-app lines | 16 to 17 on HBB: `ai` gains "Questions are limited to 500 characters."; `review` added last |
| Pin | `test/p11-limitations.test.tsx` 2 of 2 failing at 3b0e1b0, passing at 196efd2 |
| Bytes at rest | 1,974,518 on each of 3 starts (`security-bytes-lim-bytes-none.json`), +99 bytes from 1,974,419 (`security-bytes-p11lic-bytes-none.json`); 25,482 bytes under 2,000 kB |
| Budgets, start, structure, bundle | exit 0, every row ok (`budgets-lim.json`): before scene ready 721.6 kB, all assets gzip 1,981.8 kB, scene chunk 969 kB |
| Text inventory and S21 | exit 0; 9,219 distinct texts; 82 axe screens, 0 violations (`text-inventory-lim.json`, `a11y-lim.json`) |
| Source map | exit 0; 9,219 mapped (template 6,193, record 2,047, constant 232, token 696, composite 39, interface 12), 0 without a source, 504 explanation checks 0 failed, 0 mismatches; both new lines map as constants of `KNOWN_LIMITATIONS` (`source-map-lim.json`) |
| S19 nollm | exit 0, 0 failures, 0 budgets over (`nollm-lim.json`) |
| Replays | Phase 10 exit 0 (P10-CFTR-13, -19 as listed); held-out split exit 0 (P10H-BRCA1-08 as listed) |
| Unit tests and typecheck | helix-app 592 passed, typecheck 0; helix-research 547 passed, 5 skipped, typecheck 0; check:pin 0; web:build 0 |

Frames were not measured (no rendering change; the task's check list names no frame files).

## Interpretation

The hypothesis holds. The two visitor-facing gaps were the silent 500-character limit (C152's own limit) and the absence, in the app, of the D-H031 statements (AI-assisted audit only, no user testing); both fit in 99 bytes. The number 500 passes the source map's generic number check, by inference through its rule for a position within a set's sequence (CFTR is longer than 500 residues), as the 0.15 s of P11-S-07 passes through a rounded record number; its real source is `QUESTION_MAX_LENGTH`, which the pin test ties it to. Items without an explicit decision of the author: C10 and C14 (c), (d), recorded as the plan proposed. Still open for the author: P11-S-01, P11-S-04, P11-S-09, the ClinVar and RefSeq pages, the wordmark, and the open notes of the security review.

## Failures

None in the recorded runs. The coordinator-facing report of this task was sent once early by mistake with placeholder text; the full report followed.
