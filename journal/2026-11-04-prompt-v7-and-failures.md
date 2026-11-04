# HX-P10-2026-11-04-prompt-v7-and-failures: prompt v7 written blind to the benchmark; graceful failure on the running app

```yaml
id:            HX-P10-2026-11-04-prompt-v7-and-failures
date:          2026-11-04
phase:         P10 (plan section 5 item 2 and section 6)
hypothesis:    A prompt that teaches the six Phase 10 actions and the selection and session blocks can be written from the plan and the contracts alone, without the evaluation items, leaving v1 to v6 byte-identical; and the five failure kinds of the plan each end in a stated state on the running app.
git_commit:    helix-research 6c6cfb7 (v7, schema v3, pins); helix-app 1e222b5 pinned to it (v7 on a dev page, the failure scenarios, the echo screen, the gene-switch discard rule); implemented by a delegated agent on Opus 5.5 instructed not to open the benchmark folder, verified by the coordinator (gates by exit code; the benchmark folder unchanged since 577cbd2)
config:        three hand-written smoke questions on HBB under v7 (ministral-3:8b, temperature 0; not a benchmark); failure scenarios against a stub of the Ollama API started by the suite
seed:          n/a
data_version:  the five curated sets at helix-research 88e1626
hardware:      the development Mac
duration:      about 35 minutes of agent time plus verification
cost:          0
```

## Measurements

| Check | Result |
|---|---|
| v7 hashes | RULES_V7 7ce934f6…; HBB v7 system message 73ca3716…; schema v3 8e97fea5… (pinned in prompt-v7.test.ts) |
| v1 to v6 and schemas v1, v2 | byte-identical; existing pins pass |
| Smoke, three questions | all three validate (beginTransition; setRepresentation; a selection explanation with focus, highlight and two evidence reveals) |
| Invalid plan | rejected on schema; the rule-based plan executes; the rejected output kept in the ask record |
| Timeout (3 s) | fallback explanation shown, the provider stays available |
| Stale after a gene switch | outcome stale-discarded, nothing executed, the store history logs the discard |
| Cancel mid-plan (beginTransition, focusCamera, highlightResidue) | completed, cancelled, cancelled; Protein World with 2HBS, no highlight, camera still after Stop, no bridge left |
| Injected instruction in a retrieved ClinVar title | an ungrounded id rejected; an echo of the instruction rejected by the new screen; the words appear nowhere on the page |
| Suites | Phase 10, 9, 6, 5, 4 PASS; accessibility 0 violations (`phase10-e2e-p1031-app.json`, `a11y-p1031-app.json`) |
| Unit tests, typecheck | helix-app 470, helix-research 503; clean |

## Interpretation

Both hold. v7 is not shipped and not declared frozen: freezing it, with the benchmark set, is the author's G-FREEZE call before the measured run. Two decisions recorded: an invalid model plan falls back to the rule-based answer with the reason in the diagnostics rather than an on-screen refusal (the policy since Phase 4); and a new app-side echo screen rejects a model plan that repeats four consecutive words of retrieved text found in neither the trusted context nor the question.

## Failures

None in the final runs.
