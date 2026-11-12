# HX-P11-2026-11-12-scientific-audit: every displayed claim against its record and its upstream release (P11.3.1)

```yaml
id:            HX-P11-2026-11-12-scientific-audit
date:          2026-11-12
phase:         P11 (P11.3.1, scientific audit of every displayed claim)
hypothesis:    Every text the app displays on the rules' path maps mechanically to a record field or a named rule of the code, every displayed fact agrees with its record, and every displayed record field agrees with the raw body of its upstream source and release.
git_commit:    helix-app 1bf3ada to the review commit (pin 67464a2; change 10fb938; harness 06e2c87, 58a4244; results and the review page in the review commit), pinned unchanged to helix-research 62d45de; helix-research 8b8bb60, f62b1f8 (scripts/data-preparation/trace-records.ts), docs and results in the commit of this entry; by a delegated agent on Opus 5.5
config:        helix-app e2e/text-inventory.mjs --run-a11y (S21 a11y.mjs --all-sets --texts, then the questions at three depths and the TP53 fixture), e2e/source-map.mjs; helix-research trace-records.ts, build-gene.ts --fixtures and compare-builds.ts for each set
seed:          none
data_version:  the five curated sets at helix-research 62d45de, unchanged; the TP53 dynamic fixtures of data/fixtures/dynamic/tp53
hardware:      Apple M1 Pro, the development Mac; Chrome 157 headless
duration:      about 6 hours of wall-clock for the pass (S21 with the dumps about 25 minutes per run)
cost:          0 (no live call, no model call)
```

## Measurements

Raw results: helix-app `apps/web/e2e/results/text-inventory-p11sci.json`, `source-map-p11sci.json`, `source-map-p11sci-pin-uniprot.json` (the run before P11-S-10 was stated, exit 1), `a11y-p11sci.json` (S21, run by the inventory with `--texts`), `budgets-p11sci.json`, `nollm-p11sci.json`, the two replay files; helix-research `journal/results/trace-records-p11sci.json`, `compare-<set>-committed-vs-fixtures-rebuild-p11sci.txt` (five sets), `build-hbb-offline-p11sci.log`. Method, tables and findings: `docs/scientific-validation.md` section 7; review: helix-app `docs/reviews/phase-11-scientific-audit.md`.

| Measurement | Value |
|---|---|
| Distinct displayed texts | 9,215 (80 S21 screens; 31 supported and bridge questions at three depths, 93 explanations; the TP53 fixture's explorer question) |
| Texts without a source | 0 (source map exit 0); by class: template 6,192, record 2,047, token 695, constant 230, composite 39, interface (allowlist) 12 |
| Codon texts against the CDS | 4,909, 0 differ |
| Selection-card lines recomputed | 13, 0 differ |
| Explanation sentences, checks by kind | 322 sentences, 504 checks, 0 failed |
| Sentences naming UniProt against the UniProt body | 6, 5 differ (P11-S-10, stated) |
| Manifest source rows | 199: 188 bodies in the public fixtures, 9 in the local snapshot cache only, 2 not found (HBB, P11-S-01) |
| Record fields against the raw upstream bodies | 159, 159 agree |
| Rebuild from the committed fixtures | CFTR, BRCA1, SLC6A3, FAAH2: generator fields only; HBB: 58 other differences |
| Bytes at rest after the fix | 1,999,973 (3 starts, exact `transferSize` sum), 2,000 kB budget; 1,999,977 before |

Findings P11-S-01 to P11-S-10: three fixed (two limitation lines in the app, pin 67464a2 then change 10fb938; one plan reference), four open for the author (HBB provenance, Mol*'s label-first numbering, a dead 171-byte text, the UniProt refusal wording), three notes.

## Interpretation

The mechanical part holds: no displayed text is without a source, no displayed fact differs from its record, and no displayed record field differs from the raw body it was read from. Three faults were found, all in sentences about Helix or its sources rather than in record values: two limitation lines that had not followed D-H029 (88) and the associations record's own limitation (fixed within the bytes budget), and a refusal that names UniProt for a property of Helix's reduced copy of it (P11-S-10, open: a rules wording or a data change). The one open data item is provenance, not content: the HBB set cannot be rebuilt from public inputs as committed (P11-S-01). All of this was checked by an AI agent with scripts it wrote; no domain expert read the inventory (D-H031), and a record's agreement with its upstream body says nothing about whether the upstream database is right.

## Failures

Four runs of the source map were stopped by me while it was being written (one template regex backtracked on long texts; fixed by keeping templates with little fixed text to short texts). The first inventory run read texts without the spaces between inline elements and without the content of closed `<details>`; both were fixed and the inventory rerun. The source map's first version mapped some app texts to the art-direction prototypes' templates; the prototypes are now left out. `npm run typecheck` in helix-app failed once (the pin test was a `.ts` file importing `phase6.tsx`, which the root tsconfig cannot resolve); renamed `.tsx`.
