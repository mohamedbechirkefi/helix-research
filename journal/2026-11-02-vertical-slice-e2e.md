<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HX-P6-2026-11-02-vertical-slice-e2e: the HBB vertical slice end to end (blueprints A, B, E, F, full-chain bridge), regression and demo recording

```yaml
id:            HX-P6-2026-11-02-vertical-slice-e2e
date:          2026-11-02
hypothesis:    On the running app, (B) a follow-up question causes a second, verified visual action with the
               rule-based planner and with ministral-3:8b; every codon 2 to 147 reaches exactly the residues
               of the full-chain mapping record; (A) a first visit can choose a gene or a question and reach a
               meaningful first scene, and an uncurated gene is refused without a scene; (E) with the
               structure withheld (labelled test fixture) the app says why and shows the variant on the
               sequence without loading any model; (F) with no reachable model every non-LLM path works; the
               Phase 4 and 5 suites still pass. Contradicted by any failed assertion of the suites.
git_commit:    helix-app a1cb0c7 (private repository; public copy in `journal/results/helix-app-e2e/`); helix-research packages and data pinned at 0826e68
config:        helix-app apps/web/e2e/phase6.mjs (--runs=3 --ollama-runs=3 --tag=2026-11-02); Phase 4 suite
               e2e/run.mjs (--runs=5 --ollama-runs=5 default, --tag=2026-11-02-p6reg); Phase 5 suite
               e2e/phase5.mjs (--tag=2026-11-02-p6reg); e2e/demo-record.mjs (provider ollama)
seeds:         n/a; 3 runs per provider for blueprint B, 1 run for the other scenarios, each in a fresh
               browser context
data_version:  data/curated/hbb at 0826e68
hardware:      Apple M1 Pro, 16 GB, macOS 15.3.1; Chrome 156.0.8078.74 headless, ANGLE Metal, vsync on
duration:      Phase 6 suite 3 min 45 s (02:49:23Z to 02:53:08Z); Phase 4 suite to 02:58:19Z; Phase 5 suite
               to 03:02:41Z; demo recording 73.5 s of flow
cost:          0
llm:           provider local Ollama 0.40.6 (server already running, not started or stopped here);
               model_id ministral-3:8b; call_date 2026-11-02; params temperature 0, num_ctx 8192,
               num_predict 1024, generic decoding schema v2 (Phase 6 contexts list compareVariants and
               highlightSequenceRegion); prompt helix-plan-prompt-v2 (RULES_V2 in
               packages/ai-planning/src/prompt.ts), the exact messages of the first blueprint B run stored
               as `prompt` in the result file; responses: every plan in the result files (rows[].first,
               rows[].second, actions); attempt count: 6 blueprint B calls, 1 blueprint A call, 2 calls in
               the demo, plus the Phase 4 suite's calls (5 reference, 3 cancelled, 3 follow-up, 2 stale) and
               the Phase 5 suite's model calls
```

## Methods

Production build served by `vite preview`; system Chrome through puppeteer-core. Expected values are read in the test from the served, hash-checked records (variant, mapping table, ClinVar record), never typed in. Visual actions are verified by read-back: Mol*'s selection and focus managers, the three.js `sequence-highlight` mesh indices, the comparison view's DOM. Blueprint F points the app at an unreachable Ollama address (`?ollama=http://127.0.0.1:9`, accepted on a development page only) instead of stopping the running server. Blueprint E uses `?fixture=structure-limited`: HBB with the structure, its model file, both residue mappings and the contacts withheld; a banner says it is a fixture.

## Raw results + uncertainty

From `helix-app/apps/web/e2e/results/phase6-e2e-2026-11-02.json` (PASS, 0 failures):

| Scenario | Result |
|---|---|
| Blueprint B, rule-based (n = 3) | question to end median 1,833 ms (1,828 to 1,885); follow-up median 775 ms (775 to 779); follow-up plan enterWorld, highlightSequenceRegion, compareVariants, revealEvidence |
| Blueprint B, ministral-3:8b (n = 3) | question to end median 25,033 ms (24,926 to 25,067), provider about 21.7 to 21.8 s; follow-up median 17,116 ms (17,088 to 17,130), provider 16.3 to 16.4 s; follow-up plan from the model in 3 of 3 (highlightSequenceRegion, compareVariants), 0 fallbacks |
| Second visual action (all 6 runs) | DNA World on screen; mesh marks cDNA 68, 69, 70 (6 instances); codon strip marks codon 7; comparison GAG -> GTG, changed base T, Glu -> Val, facts with ENST00000335295.4:c.20A>T, NC_000011.10:g.5227002T>A, reverse strand; every claim sourced |
| Full-chain bridge | 146 of 146 codons equal the table, 0 mismatches; codon 1 initiator-met-removed, 148 stop-codon; codon 21 to Protein World (loadStructure, focusCamera, highlightResidue) read back B20 VAL label 20, 1,807 ms |
| Blueprint A | welcome shown, journey waiting; CFTR refused, 0 navigations, 0 structures; "beta-globin" -> chapter 1 in 1,731 ms; codon 7 click -> free mode, mapped; next branch executed (ministral-3:8b, 27,919 ms); welcome question executed in 1,794 ms with read-back VAL B6, D6, F6, H6 |
| Blueprint E | offered transcript, variant-codon; refused variant-residue (missing experimental-structure, structure-model-file, residue-mapping); Protein World disabled with the reason; question answered with the sequence plan in 68 ms and the reason; 0 structures, 0 requests for a model file or AlphaFold |
| Blueprint F | Ollama unavailable with its reason; AI status: no model; WebGPU present but no in-browser engine in this build; four chapters completed; supported questions 846, 1,315, 1,584 and 19 ms, follow-up 771 ms, all rule-based and executed; 0 requests to port 11434; 0 page errors |
| Evidence World and limitations | VCV000015333.184, 2 stars, conflicting false, 9 related records; 23 record-version rows; 12 limitations |

Regression: Phase 4 suite (`e2e-2026-11-02-p6reg.json`) PASS: rule-based question to verified highlight drawn median 1,810.1 ms (n = 5; Phase 5 1,791.1 ms); ministral-3:8b provider median 21,513.8 ms (n = 5; Phase 5 15,527.5 ms), 0 fallbacks; camera cancel median 28 ms (n = 6), inference cancel median 15 ms (n = 3). Phase 5 suite (`phase5-e2e-2026-11-02-p6reg.json`) PASS: warm switch 718.5 ms, cold 1,758.3 ms (n = 5), fade frames at most 23.6 ms; structure picks H12 THR -> codon 13 (table), A12 ALA -> unmapped.

Demo (`demo-recording-2026-11-02.json`): 575 frames over 73.5 s; WebM VP9 1400 x 820, 30.1 s after shortening idle gaps to 1.2 s, 2,759,707 bytes; both model plans from ministral-3:8b (planning 24,954 and 15,927 ms).

Unit tests: helix-app 110 pass (11 files); helix-research 177 pass, 4 live skipped; typecheck clean in both.

## Failures

- A development run showed the sequence mark's read-back indices reset after verification: R3F re-applies a JSX `userData` prop on every render. The drawn spheres were right; the metadata was not. Fixed before the stored runs (indices set only by the drawing effect).
- A development run of blueprint E offered no refused chapter, so the UI did not list why the residue chapter was missing: the planner proposed it only when the feature existed. Fixed (the chapter is proposed and refused with the missing data).
- The Phase 5 suite's expectation that a beta-chain residue other than VAL 6 is unmapped no longer holds with the full-chain table; changed to read the expected codon from the table and to require alpha-chain residues to stay unmapped. One Phase 5 pick aimed at C30 landed on A12 (pick harness), which still tested an alpha-chain residue.

## Limits / confounders

- One machine, headless Chrome, few runs (n = 1 for A, E, F); Safari, Firefox and WKWebView not run.
- Model times depend on the model being warm; the first blueprint B run of each page includes no cold model load (the server had served earlier calls).
- With the v2 prompt the model's first-question plans are longer and include sequence actions (highlight before focus); planning is about 6 s slower than in Phase 5. Not investigated.
- Blueprint E is a fixture made by withholding records of a well-covered gene, not a real structure-limited gene.
- The demo video shortens idle gaps; it is not a timing record.

## Interpretation

Supported on this machine: a follow-up question causes a second, verified visual action with both planners; the bridge reaches every SIFTS-mapped codon through the record; the first-visit, missing-data and no-model flows work end to end; the earlier suites still pass.

## Decision

**Continue** to the author's Phase 6 gate review (P6.4.1). Planning policy for the model's first answer is an author question.

## Artifacts

- `helix-app/apps/web/e2e/results/phase6-e2e-2026-11-02.json`, `e2e-2026-11-02-p6reg.json`, `phase5-e2e-2026-11-02-p6reg.json`, `demo-recording-2026-11-02.json` (private repository; public copy in `journal/results/helix-app-e2e/`)
- `helix-app/docs/reviews/phase-6.md`, `phase-6-shots/`, `phase-6-demo/helix-phase6-demo.webm`

## Correction (2026-11-02, HX-P6-2026-11-02-planning-time)

The stored "exact messages" were captured after the model answered, so their context shows the state after the plan ran (VAL H6 selected, 2HBS loaded), not the context the model saw. Replayed with the context of the real call, they reproduce the measured planning times within 0.7%. The capture now happens before the question (helix-app 871699e). Timings and outcomes in this entry are unaffected; only the description of the stored prompt was wrong.
