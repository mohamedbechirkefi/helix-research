<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HX-P2-2026-11-01-hbb-dataset-build: curated HBB dataset, live build and regeneration check

Retrospective entry written 2026-11-01 from the recorded evidence; not contemporaneous.

```yaml
id:            HX-P2-2026-11-01-hbb-dataset-build
date:          2026-11-01
hypothesis:    The Phase 1 mapping can be rebuilt as code, from live sources, into a curated dataset
               that passes every scientific check, fails closed when a check fails, and regenerates
               identically apart from timestamps. Contradicted if a check fails on the live data or
               two builds differ in content.
git_commit:    dataset committed in c75bf40, rebuilt in b06cd8f. The manifest's generator.gitCommit is
               0692bff, a pre-rewrite SHA: after the history rewrite of 2026-11-01 the same commit
               is 3b89a9a on main (same subject line; 0692bff survives only on the local branch
               backup-before-email-rewrite).
config:        scripts/data-preparation/build-hbb.ts (live); compare-builds.ts --cache .cache/helix-raw
seeds:         n/a, deterministic
data_version:  Ensembl 116, UniProt 2026_03, PDB 2HBS revision 1.5 (2026-08-12), ClinVar
               Build261025-1250.1, AlphaFold DB model v6; build started 2026-11-01T19:27:28Z
hardware:      Apple M1 Pro, 10 cores, 16 GB, macOS 15.3.1 (reference Mac, ROADMAP)
duration:      not recorded
cost:          0
software:      Node v22.23.3, TypeScript 6.0.3, Zod 4.6.7, Vitest 5.0.5 (docs/data-core.md §2)
```

## Methods

- The three runtime packages (`shared-types`, `data-adapters`, `scientific-core`) acquire the records and run the build checks inside `buildSlice`. They then write 11 records, the unchanged `2HBS.cif` and `manifest.json` to `data/curated/hbb/`.
- Any failed error-level check throws, and nothing is written.
- Regeneration: two live builds in a row from the same commit, compared with `compare-builds.ts`.
- The test suite runs the 32 deterministic tests of `research/hbb-acquisition-plan.md` §7 against frozen fixtures, plus unit, HTTP, cache, parser and dataset tests.

## Raw results + uncertainty

From `data/curated/hbb/manifest.json` and `docs/scientific-validation.md`:

- **Build checks:** 46 of 46 pass, 0 failed, 0 warnings.
- **Manifest contents:** 22 provenance source entries, 11 file entries, 5 known issues, 2 drift entries.
- **Key check results:**

  | Check | Result |
  |---|---|
  | T02 | ENST00000335295.4 is the only MANE Select transcript among 19 candidates |
  | T06 | CDS 444 nt, ATG to TAA |
  | T07 | translation = ENSP = UniProt, 147 aa; md5 209D686939D0B8D1EA089368150140E2 |
  | T08 | own exon walk: c.20 maps to 5227002, equal to HGVS g. and to Ensembl variation |
  | T13 | rs334 alleles: A gives p.Glu7Val, C gives p.Glu7Gly, G gives p.Glu7Ala |
  | T14 | VCV000015333.183, Pathogenic |
  | T21 | alignment offset 1, identity 0.9932, one mismatch: entity 6 V against UniProt 7 E |
  | T25 | SIFTS selects label 6 (VAL); `_struct_ref_seq` would select label 7 (GLU) |
  | T28 | contacts: H6 touches B70, B73, B84, B85, B88; B6, D6 and F6 touch nothing |
  | T32 | AlphaFold model has the reference E at 7 and is not used for variant placement |

- **Regeneration:**
  - 12 files compared; 2 byte-identical (`2HBS.cif`, `capabilities.json`).
  - 193 differences, all allowed: timestamps, and the hashes and sizes of the 9 record files that embed them.
  - 0 other differences.
- **Tests:**
  - `npm test`: 9 files, 113 tests, of which 110 pass and 3 are skipped. The skipped ones are the opt-in live smoke tests.
  - `npm run test:live`: 3 of 3 pass.
- Uncertainty: not applicable. The build is deterministic, and the comparison is exact.

## Failures

- **Earlier regeneration pair differed in one raw-body hash** (pre-rewrite commit aeb7b43). HGNC's Solr response carries a per-request timer, `responseHeader.QTime` (1 against 0). The comparison now accepts such a difference only after loading both cached bodies and finding them identical once that documented field is removed.
- **T25 and T26 revised before the final build.** T25 now records what `_struct_ref_seq` would have selected, and T26 checks every label chain for an auth id. The dataset was rebuilt live after the revision (b06cd8f).
- **Known issues recorded by the build:** `_struct_ref_seq` numbering for B, D, F and H (warning); 16 non-polymer chains with label differing from auth (info).
- **Drift recorded:** ENSG00000244734.5 (UniProt cross-reference) against .6 (Ensembl); P68871.216 (VEP) against 219 (UniProt).

## Limits / confounders

- One gene and one variant. The checks prove this slice, not generalisation (Phase 9).
- Only substitutions are resolved; no HGVS normaliser for indels.
- Symmetry-mate contacts were not computed.
- The live build depends on the providers' state on the build date.

## Interpretation

Supported for the HBB slice. The mapping of Phase 1 is now produced by code and checked against two or three independent sources at each step. The build fails closed, and it regenerates identically apart from documented volatile fields.

## Decision

**Continue.** The curated dataset is the data source of the offline journey and of later phases.

## Artifacts

- `data/curated/hbb/` (records, `2HBS.cif`, `manifest.json`)
- `docs/scientific-validation.md`, `docs/data-core.md`, `research/hbb-acquisition-plan.md`
- `scripts/data-preparation/build-hbb.ts`, `compare-builds.ts`, `record-fixtures.ts`
- `packages/*/test/`, `scripts/data-preparation/test/dataset.test.ts`
