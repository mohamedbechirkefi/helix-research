# HX-P9-2026-11-03-pathway-world-app: P9.1.2 in the app, Pathway World v1

```yaml
id:            HX-P9-2026-11-03-pathway-world-app
date:          2026-11-03
phase:         P9 (P9.1.2 app side, plan section 12 rules 5 and 6)
hypothesis:    A two-dimensional membership layer that opens on the rule's choice, lets the visitor open any membership, labels everything class 2 and shows no mechanism can be added as a fourth world without loading its record before the first interaction, with a chapter and one question per set, and with HBB, FAAH2 and CFTR unchanged on every suite.
git_commit:    helix-app 0045af2 (pin helix-research c2cf6a0); helix-research ee7a74b (planner and specs) and the three sets rebuilt on clean trees up to c2cf6a0
config:        implemented by a delegated agent from plan section 12, verified by the coordinator (gates by exit code in both repositories, the suites' own PASS lines, reviewed folders restored, scans, the shots); production builds on vite preview; Chrome 156 headless; no live request
seed:          n/a
data_version:  data/curated/{hbb,cftr,faah2} at helix-research c2cf6a0 (Reactome release 98)
hardware:      the development Mac
duration:      about 40 minutes of agent time plus verification
cost:          0
```

## Measurements (final build, helix-app 0045af2)

| Suite | Result | Record |
|---|---|---|
| Phase 9, 16 scenarios (FAAH2, CFTR, HBB and pathway-hbb, pathway-cftr, pathway-faah2, pathway-question, pathway-axe) | PASS, 0 failures, 0 axe violations | `phase9-e2e-p912-app.json` |
| Phase 6, Phase 5 (dna-render, bridge, transitions, interrupts), Phase 4 (fallback, follow-up, unsupported, cancel-camera) | PASS, 0 failures | `phase6-e2e-p912-app.json`, `phase5-e2e-p912-app-...json`, `e2e-p912-app-...json` |
| Accessibility | 0 failures, 0 axe violations on 14 screens | `a11y-p912-app.json` |
| Unit tests, typecheck | helix-app 404 (383 before), helix-research 381 (368 before); both clean | |

Read-backs: on HBB the layer opens R-HSA-9615710 with 8 participants, three entities listing HBB drawn in the discovery colour, 10 memberships listed, R-HSA-1247673 opens with 18; on CFTR R-HSA-5627083 with 5; on FAAH2 R-HSA-2142753 with 174; no request for pathways.json before the world is opened; the HBB question "Which pathways list HBB?" plans enterWorld pathway and revealEvidence reactome:P68871, executes in 69 ms, and the explanation names every membership with class 2 and 0 unsourced claims; the HBB planner context still equals the Phase 8 fixture.

## Interpretation

The hypothesis holds. Two things the step surfaced are kept as they are and recorded: the chapter's narration is composed from the capability report's sentence rather than the record (the record must not load at start), with a test that checks the text against the record for the three sets; and answering the pathway question needed two narrow exceptions in the planner's validator and follow-up filter (a Pathway World answer has no DNA or Protein cue list; "pathways" reads as membership when the set has the world), both tested. The opening rule remains a proxy (D-H019) and the review page asks the author whether a direct-participant rule would serve better.

## Failures

None in the final runs.
