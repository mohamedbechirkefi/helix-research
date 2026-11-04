# HX-P10-2026-11-04-context-and-session: P10.1.2 contextual questions and P10.2.1 session personalisation

```yaml
id:            HX-P10-2026-11-04-context-and-session
date:          2026-11-04
phase:         P10 (P10.1.2 and P10.2.1, docs/phase-10-ai-explorer.md sections 3 and 4)
hypothesis:    A question about the current selection can be bound to the world state and answered from the records alone (never another residue's or the variant's evidence for a non-variant selection), and a session profile can change depth, offers and chapter re-offers while being inspectable, resettable, unstored and free of any inference about the person.
git_commit:    helix-app 986de4c pinned to the helix-research commit before it; implemented by a delegated agent on Opus 5.5, verified by the coordinator (gates by exit code, scans)
config:        rule-based planner; production build on vite preview; Chrome 156 headless; no network, no model run
seed:          n/a
data_version:  the five curated sets at helix-research 88e1626
hardware:      the development Mac
duration:      about 35 minutes of agent time plus verification
cost:          0
```

## Measurements

| Check | Result |
|---|---|
| HBB VAL H6 "Why is this residue important?" | the HbS residue statement, the UniProt features at position 7, ClinVar VCV000015333.184, and the five recorded contacts (ALA B70, ASP B73, THR B84, PHE B85, LEU B88) |
| HBB VAL B6 "What does this residue touch?" | the contacts record's own statement that chains B, D, F show no protein contact in the asymmetric unit; a pointer to H6; none of H6's partners cited |
| HBB codon 20 "What is this codon?" | AAC, Asn, the Chain and Globin ranges, and the statement that no site-level feature is recorded; no ClinVar or variant evidence |
| CFTR MET A498 | no contacts recorded for it; a pointer to PHE A508 |
| Depth | explanation length 501, 826 and 1,784 characters; evidence lines 1, 3 and 6 for brief, standard and detailed |
| Session card | matches the state at every step; Reset by keyboard empties it; storage empty afterwards (localStorage, sessionStorage, cookies, IndexedDB) |
| Suites | Phase 10 18 scenarios PASS; Phase 9, 6, 5, 4 PASS; accessibility 0 violations on 12 screens (`phase10-e2e-p1012-app.json`, `a11y-p1012-app.json`) |
| Unit tests, typecheck | helix-app 468, helix-research 495; clean |

## Interpretation

The hypothesis holds on the rule-based path. The model does not yet see the selection facts or the personalisation strings, because prompt v5 must stay byte-identical; prompt v7 (the next step) renders them. One defect was fixed on the way: a selected residue with no feature produced an uncited location sentence, which now cites the structure.

## Failures

None in the final runs.
