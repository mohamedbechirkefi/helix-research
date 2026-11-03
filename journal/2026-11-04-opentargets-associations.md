# HX-P9-2026-11-04-opentargets-associations: P9.1.3, Open Targets associations as class 2 annotations, never causal

```yaml
id:            HX-P9-2026-11-04-opentargets-associations
date:          2026-11-04 (the requests 2026-11-03T23:05Z to 23:08Z)
phase:         P9 (P9.1.3, plan section 14, data and app in one step)
hypothesis:    One recorded Open Targets request per set gives a class 2 association record whose share-alike sources are dropped at parse time, shown in Evidence World and citable by the planner with the never-causal sentence, with every set otherwise unchanged.
git_commit:    helix-research 8845ce9 (code) and the four sets rebuilt on clean trees up to 1efe223; the app commit of 2026-11-04 pinned to 1efe223 (docs/reviews/phase-9-associations.md); implemented by a delegated agent from plan section 14, verified by the coordinator (gates by exit code in both repositories, the suites' own PASS lines, identifier guard over 69 files, scans)
config:        build-gene.ts --gene <id> --offline --live-sources=opentargets --record-fixtures=live for the four sets (one POST each, user agent helix-research, no identifier); one refused request (the plan's Boolean sort argument; the schema wants a string) and six schema and meta requests naming no entity, all filed under research/raw/opentargets with MANIFEST rows; the sets then rebuilt offline on clean trees
seed:          n/a
data_version:  Open Targets api 26.9.0, data 26.09; the sets at helix-research 1efe223
hardware:      the development Mac; Chrome 156 headless for the suites
duration:      about 40 minutes of agent time plus verification and the rebuilds
cost:          0
```

## Measurements

| Set | On the platform | Kept | Top three (score) | Dropped datasources |
|---|---|---|---|---|
| HBB | 552 | 25 | beta thalassemia 0.842; sickle cell disease 0.813; dominant beta-thalassemia 0.790 | clinical_precedence, europepmc |
| CFTR | 1,889 | 25 | cystic fibrosis 0.921; congenital bilateral aplasia of vas deferens 0.824; hereditary chronic pancreatitis 0.718 | clinical_precedence, europepmc |
| FAAH2 | 51 | 25 | hypertensive disorder 0.302; hypogonadism 0.239; type 2 diabetes mellitus 0.128 | europepmc |
| BRCA1 | 1,324 | 25 | breast cancer 0.844; hereditary breast ovarian cancer syndrome 0.828; Fanconi anemia group S 0.817 | cancer_gene_census, europepmc |

Checks after the change: HBB 65, CFTR 69, FAAH2 31, BRCA1 68, 0 failed. Suites on the final app build: Phase 9 29 scenarios PASS with 0 axe violations (`phase9-e2e-p913-app.json`), Phase 6, 5 and 4 suites PASS, accessibility 0 violations on 14 screens (`a11y-p913-app.json`); unit tests helix-app 425, helix-research 420; the HBB planner context equals the Phase 8 fixture. The association question plans revealEvidence only (80 ms) and its explanation ends with the never-causal sentence.

## Interpretation

The hypothesis holds. Two decisions are recorded rather than hidden: the exclusion list was established from the responses, with the platform's ChEMBL-derived evidence identified as `clinical_precedence` by naming rather than by a document (the platform's own datasource listing was empty on the day); and the question is askable but never offered as a Next chip, because the D-H007 follow-up filter reads "disease" as clinical, a narrow exception being the author's call.

## Failures

The first HBB request was refused with HTTP 400 on the sort argument's type; corrected from the introspected schema; no data served by the refused request.
