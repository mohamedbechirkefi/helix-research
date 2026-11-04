# HX-P9-2026-11-04-variation-metric: P9.3.2, the variation metric over the five curated sets

```yaml
id:            HX-P9-2026-11-04-variation-metric
date:          2026-11-04
phase:         P9 (P9.3.2, plan section 6)
hypothesis:    The five curated sets differ measurably in scene inventory, journey and capabilities when the metric is computed from the app's own loader, context, inventory, planner and matcher.
git_commit:    helix-app 5a9730e (the computation and its pinning test; the only app-source change is BUILD_WORLDS moved to its own module); helix-research 12e3a16 (the results and the plan amendment); implemented by a delegated agent from plan section 6, verified by the coordinator (gates by exit code, the results file read)
config:        node apps/web/scripts/variation-metric.ts over test-support/variation.ts; no network; the bundles assembled by the app's loader over the curated files with the sha256 check
seed:          n/a
data_version:  the five sets at helix-research c24f2f7 (byte-identical to 920f70b, the app's pin)
hardware:      the development Mac
duration:      about 10 minutes of agent time plus verification
cost:          0
```

## Measurements (mean pairwise Jaccard distance, 10 pairs)

| Axis | Status | Mean | Min pair | Max pair |
|---|---|---:|---|---|
| scene | plan section 6 | 0.525 | HBB vs BRCA1 0.438 | CFTR vs FAAH2 0.621 |
| journey | plan section 6 | 1.000 | every pair | every pair |
| capabilities | plan section 6 | 0.218 | any two structure sets 0.000 | FAAH2 vs any 0.545 |
| journey shape | supplementary | 0.267 | any two structure sets 0.000 | FAAH2 vs any 0.667 |

Set sizes: scene 25, 26, 25, 25, 14 strings; journey 5, 5, 5, 5, 3; capabilities 8 each. The full matrices, the per-set inventories and one sentence per set are in `journal/results/variation-metric-2026-11-04.md` and `research/derived/variation-metric-2026-11-04.json`; a unit test in the app pins every string set and the means to three decimals.

## Interpretation

The sets differ, and the metric says where: the scene axis separates every pair by about half of their strings (the variant kind and codon, the structure entry, its method and coverage, the opening pathway, the predicted model); the capability axis separates FAAH2 (no structure, no variant) from the four structure sets and nothing else; and the journey axis as the plan defined it is uninformative, 1.000 for every pair by construction, because the transcript chapter's title names the gene and every other chapter's target is set-specific. The supplementary shape axis (chapter id, world, focus kind) shows the honest picture: the four structure sets share one journey shape and FAAH2 has another. Whether the report keeps the plan's journey axis or replaces it with the shape is the author's call (plan section 6 amended; gate question 65).

## Failures

None.
