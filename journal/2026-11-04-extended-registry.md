# HX-P10-2026-11-04-extended-registry: P10.1.1, six new actions with full contracts

```yaml
id:            HX-P10-2026-11-04-extended-registry
date:          2026-11-04
phase:         P10 (P10.1.1, docs/phase-10-ai-explorer.md section 2)
hypothesis:    The six actions the roadmap names can be added with the full section 7 contract, executed deterministically in DNA, Protein and Pathway Worlds and planned by the rule-based planner, without changing the measured prompt v5 or the HBB planner context.
git_commit:    helix-research 1st commit of P10.1.1 (planner); helix-app 42e7db8 pinned to it; implemented by a delegated agent on Opus 5.5 (medium effort, at the author's request after the first run stopped on a usage limit with no edits), verified by the coordinator (gates by exit code, scans)
config:        rule-based planner only; production build on vite preview; Chrome 156 headless; no network, no model run
seed:          n/a
data_version:  the five curated sets at helix-research 88e1626
hardware:      the development Mac
duration:      about 40 minutes of agent time plus verification
cost:          0
```

## Measurements

| Check | Result |
|---|---|
| Phase 10 suite (13 scenarios: one per action on HBB and FAAH2, five refusals, two cancellations) | PASS, 0 failures, 0 axe violations with the domain panel open (`phase10-e2e-p1011-app.json`) |
| Phase 9, 6, 5, 4 suites; accessibility | PASS; 0 violations on 12 states |
| Unit tests, typecheck | helix-app 458 (447 before), helix-research 480 (450 before); clean |
| showProteinDomains on HBB | 145 codon bands; 580 residues overpainted on chains B, D, F, H (2 to 146) with the VAL 6 emphasis kept |
| setRepresentation surface | Mol* molecular-surface built and read back |
| beginTransition | the four bridge stations; cancelled mid-way it leaves DNA World with no structure loaded |
| Prompt v5 and the HBB context | v1 and v2 decoding schemas' sha256 unchanged and pinned; the HBB Phase 8 fixture equal |

## Interpretation

The hypothesis holds. A model plan under prompt v5 that names a new action is rejected as not taught by its prompt version and the rule-based planner answers, so the measured behaviour of Phases 3 to 9 is unchanged until prompt v7. Recorded deviations: the gene record lists no transcript candidate ids, so candidates are the MANE selection plus the protein record's Ensembl cross-references of the same gene; beginTransition loads the bundled structure when none is loaded; Mol*'s atomic-detail preset needed a representation update to give ball-and-stick on 2HBS; the HBB Globin domain covers almost the whole chain, so its overpaint is subtle.

## Failures

The first run stopped on the usage limit before any edit; relaunched. None in the final runs.
