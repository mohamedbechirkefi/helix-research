# HX-P11-2026-11-10-new-budgets: the new budget metrics of plan section 3.2 measured, with proposed values

```yaml
id:            HX-P11-2026-11-10-new-budgets
date:          2026-11-09 to 2026-11-10
phase:         P11 (plan section 3.2; author decision D-H029 answer 83: values measured, then brought back for agreement)
hypothesis:    None to confirm; a measurement. Expected: every 3.2 row that does not need tiers or the desktop build can be measured with harness changes only.
git_commit:    helix-app d8b667f and 90db176 (harnesses: budgets.mjs --network and --host-map, firstJourneyStep; p11-new-budgets.mjs; layout.mjs --axe=1), 5204ec1 (review docs/reviews/phase-11-new-budgets.md and 8 result files tagged p11-newbudgets); product code at 3a1a680, unchanged; delegated agent on Opus 5.5, medium effort; checked by the coordinator
config:        Puppeteer PredefinedNetworkConditions (puppeteer-core 25.14.0) Fast 4G and Slow 4G, cold cache, 5 pages; rules answers 5 repeats; model planning ministral-3:8b on the split default, 3 questions per route, 3 repeats (28 real calls); no-LLM on a non-development host name; soak HBB then CFTR, 2 cycles of 5 questions per set with world switches; axe on the 71 wide S29 screens
seed:          none (temperature 0 for the model)
data_version:  the five curated sets at helix-research c045aed
hardware:      Apple M1 Pro; system Chrome now 157.0.8103.40 (auto-updated from the 156 named as reference in plan section 3; recorded in every result file); a macOS CacheDelete process used about 70 % of a core at the start of the Fast 4G run (throttled pages agree within 2 %)
duration:      about 57 minutes
cost:          0 (local inference)
```

## Measurements

| Metric | Measured | Proposed budget |
|---|---|---|
| Welcome interactive, Fast 4G | 2,462 ms (2,438 to 2,474, n 5) | <= 3,000 ms |
| DNA World ready, Fast 4G | 2,679 ms | <= 3,200 ms |
| Welcome interactive, Slow 4G | 9,173 ms | <= 10,000 ms |
| DNA World ready, Slow 4G | 9,403 ms | <= 10,500 ms |
| Network idle, Fast / Slow 4G | 3,969 / 17,038 ms | reported only |
| First journey step (Explore to first chapter settled) | 11.9 ms localhost, 30 ms throttled | <= 100 ms |
| Rules answer, reference question, first answer (structure load, no bridge) | 1,935 ms (max 1,958) | <= 2,500 ms |
| Rules answer, reference question, with the bridge | 4,788 ms (max 4,804) | <= 5,500 ms |
| Rules answer, explorer question | 31 ms | <= 200 ms |
| Planning feedback, rules | max 82 ms | <= 100 ms |
| Planning feedback, local model | 14.5 ms (max 16.4, n 27) | <= 100 ms |
| Model planning time, split (reported) | explorer-rule 12.9 s (p90 16.9); no-rule 9.1 s (p90 10.9); follow-up 25.1 s (p90 28.7); cold load 29.2 s | reported only |
| No-LLM, requests to an Ollama address | 0 of 182, 5 sets | = 0 |
| No-LLM, supported questions executed by the rules | 26 of 26, bridge questions 4 of 4 | all, per set |
| No-LLM, 3.1 start and structure budgets | all pass | 3.1 unchanged |
| Soak heap growth, cycle 1 to 2 | 0.9 % per set | <= 5 % per set |
| Soak heap maximum | 187.2 MB | <= 256 MB |
| Soak GPU resources, Mol* structures | equal at every cycle end; 1 | no growth after cycle 1; exactly 1 |
| Soak Chrome process tree at the end | 1,498 MB | <= 1,800 MB |
| Axe violations, 71 wide S29 screens | 15 | 0 (fails today) |
| Axe incomplete colour contrast | 7,131 nodes in 44 groups | each group recorded |

Raw: helix-app `apps/web/e2e/results/*p11-newbudgets*`; definitions (journey step "settled", model questions, soak questions, three.js counts through `__THREE_DEVTOOLS__`) in `docs/reviews/phase-11-new-budgets.md`.

## Coordinator check

`npm test` (529) and `npm run typecheck` exit 0 on 5204ec1; spot-checked against the raw files: Slow 4G welcome 9,173 ms (first page), Chrome 157.0.8103.40, axe 15 violations on 71 screens, the no-LLM section on host helix-web.test with no failures; no local path or em dash in the new commits.

## Findings

1. **15 axe violations** (`label-content-name-mismatch`, serious, WCAG 2.5.3), each on one codon-tape button at the tape's scrolled edge, on non-HBB sets at 1024 and 1440 px; earlier audits ran axe on HBB only. A Phase 11 accessibility fix (P11.2.1); the edge cause is the agent's reading, not verified.
2. **Slow 4G**: about 4.9 s of the 9.2 s welcome is seven sequential rounds of record fetches at 562 ms latency each; fetching in parallel would cut it (product work, not done).
3. **Split model plans mostly unused**: on the no-rule and follow-up routes the split used 0 of 18 model plans after waits of 6.5 to 28.7 s; on the explorer-rule route 6 of 9. Consistent with carried item C3 and the "Answer with the rules now" control (D-H029 answer 86).
4. **Soak process memory** ends at 1,498 MB, at the 3.1 limit of 1,500 MB set for 6 round trips; a longer session costs more.
5. **Colour contrast** to look at first (AI reading of screenshots, not a person's check): the translucent protein caption and the welcome over the structure, the dim bridge stations, the codon tape's small coloured letters.
6. **Chrome changed** to 157 under the measurements; earlier 3.1 numbers were on 156.

## Interpretation

Every measurable row now has a value. The proposed budgets are the agent's (measured value plus a margin, or a round value), not yet agreed by the author. Two rows fail today and are work, not budgets: the axe violations, and nothing else; Slow 4G passes its proposed value only because the value was set above the measurement.
