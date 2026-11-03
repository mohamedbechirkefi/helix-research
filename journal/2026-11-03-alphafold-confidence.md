# HX-P9-2026-11-03-alphafold-confidence: P9.1.1, AlphaFold per-residue confidence and the PAE matrix

```yaml
id:            HX-P9-2026-11-03-alphafold-confidence
date:          2026-11-03
phase:         P9 (P9.1.1 AlphaFold DB adapter: predicted, pLDDT and PAE, labelled)
hypothesis:    The model file AlphaFold DB serves already carries the per-residue pLDDT (its _ma_qa_metric_local table), so no extra request is needed for it; the PAE file the prediction record names parses to a square matrix whose diagonal is near zero and whose values stay within the stated maximum; the per-residue mean reproduces the record's global pLDDT and the band shares reproduce its fractions.
git_commit:    helix-research (this commit); fixtures research/raw/alphafold at their MANIFEST rows
config:        one live GET of the PAE file through the adapter's HttpClient (user agent "helix-research", no identifier), recorded with its headers and sha256 by scripts/data-preparation/record-alphafold-pae.ts; every test runs on the recorded fixtures
seed:          n/a
data_version:  AF-P68871-F1 model v6 (modelCreatedDate 2025-08-01), prediction record of 2026-11-01, PAE file of 2026-11-03
hardware:      the development Mac
duration:      about 25 minutes
cost:          0 (AlphaFold DB is free; EMBL-EBI terms, CC BY 4.0 with the in-file disclaimer kept)
```

## Measurements (P68871, 147 residues)

| Quantity | Value |
|---|---|
| PAE file | 44,028 bytes, HTTP 200, sha256 bcfda9ca…76c051 (MANIFEST row) |
| PAE matrix | 147 by 147; diagonal maximum below 1.5 Å; largest value at or below the file's stated maximum |
| Per-residue pLDDT rows | 147, contiguous from 1; residue 1 MET 61.09 (band low) |
| Mean of per-residue pLDDT against the record's global 97.19 | difference 0.012 (the record rounds its own computation; the test allows 0.05) |
| Band shares against the record's fractions (very low, low, confident, very high) | 0, 0.007, 0.02, 0.973: equal to three decimals |
| Tests | helix-research 292 (287 pass, 4 live skipped, 1 skipped file); typecheck clean |

## Interpretation

The hypothesis holds: one file already on record gives the per-residue confidence, and the PAE file adds the pairwise error at the cost of one more request per model. Both stay labelled as prediction data (class 3) wherever a consumer shows them; the plan (docs/phase-9-generalisation.md) uses the bands to say where a predicted model is trustworthy enough to show at all (BRCA1's full-length model, for instance, will carry long low-confidence stretches).

## Failures

Two during development, both caught by the tests: the mmCIF parser stores category names without the leading underscore (the first lookup found nothing), and the per-residue mean differs from the record's rounded global value by more than the 0.01 first assumed.
