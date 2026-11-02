<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HX-P1-2026-11-01-raw-snapshot: live raw-data snapshot of the HBB records

Retrospective entry written 2026-11-01 from the recorded evidence; not contemporaneous.

```yaml
id:            HX-P1-2026-11-01-raw-snapshot
date:          2026-11-01
hypothesis:    Every record HELIX needs for the HBB / HbS slice can be fetched from free public
               endpoints without authentication, with enough provenance (URL, time, status, hash,
               release headers) to cite each value. Supported if every needed record returns
               HTTP 200 and is stored with a manifest row; contradicted if a needed record needs
               payment, a key or an account.
git_commit:    43ef20b (snapshot and manifests); 155753f (redaction of a contact address from
               request URLs, after the history rewrite described under Failures)
config:        scripts/research/fetch_raw.py (standard library only; URLs listed in the manifests)
seeds:         n/a, deterministic retrieval (responses depend on the providers' live state)
data_version:  Ensembl 116 (REST 15.12), UniProt 2026_03, PDB 2HBS revision 1.5, ClinVar
               Build261025-1250.1, AlphaFold DB model v6, Open Targets 26.09, InterPro 110.0
               (per research/raw/README.md, docs/data-source-registry.md)
hardware:      Apple M1 Pro, 10 cores, 16 GB, macOS 15.3.1 (reference Mac, ROADMAP)
duration:      retrieval times in the manifests span 2026-11-01T18:14:50Z to 18:30:30Z
cost:          0
```

## Methods

- A standard-library Python script fetched each record with a fixed User-Agent naming the project and slept between calls (`research/raw/README.md`).
- Each response was written to `research/raw/<source>/` and listed in that folder's `MANIFEST.tsv`: file, UTC retrieval time, HTTP status, sha256, size, method, URL, selected response headers and a redaction column.
- Fourteen source folders: Ensembl (GRCh38 and the GRCh37 service), UniProt, RCSB, PDBe/SIFTS, AlphaFold DB, NCBI ClinVar, NCBI Gene, HGNC, Reactome, InterPro, QuickGO, Gene Ontology and Open Targets. A fifteenth folder, `cors/`, holds a measurement, not records (entry HX-P1-2026-11-01-cors).

## Raw results + uncertainty

- **40 manifest rows**, all with HTTP status 200 (count over `research/raw/*/MANIFEST.tsv`, 2026-11-01).
- 9 of the 40 rows carry a redaction note.
- Per folder: Ensembl 15, RCSB 5, Ensembl GRCh37 3, and 1 or 2 for each other source.
- Uncertainty: not applicable. These are records, not measurements. Their content is the providers' state on the retrieval date. Later releases may differ, which is why Phase 2 re-fetches and compares (entry HX-P2-2026-11-01-hbb-dataset-build).

## Failures

1. **Two Ensembl HTTP 500 responses.** The first `variant_recoder` call (without `fields`) and an `xrefs` call returned HTML error pages. The `variant_recoder` retry with `fields` returned 200 and is kept; the two error pages were deleted as not needed (`research/raw/README.md`). During that clean-up the valid retry was deleted by mistake and then restored from git.
2. **A redaction script emptied a ClinVar JSON file.** The output file was opened for writing before it was read. Restored from git and redone. Recorded in the session history, not in a repository file.
3. **Privacy incident.** A research agent sent the session account's email address as the NCBI `email` URL parameter. The address entered the public manifests in commit 1d554d8.
   - It was redacted (`email=[redacted]` in `ncbi-clinvar/MANIFEST.tsv` and `ncbi-gene/MANIFEST.tsv`).
   - With the author's approval, the 13 commits from 1d554d8 were then rewritten and force-pushed; the new head was 155753f (`helix/PROGRESS.md`, section B).
   - GitHub may still serve the old commits by SHA until it garbage-collects them.
   - Rule adopted: no email address in any request or file. NCBI calls send `tool` only (`docs/data-core.md` §9).
4. **Proprietary identifiers present in otherwise open records.** OMIM/MIM numbers appeared in the UniProt, HGNC, NCBI Gene and ClinVar records, and HGMD accessions in the VEP `colocated_variants`. Removed by author decision Q-H-LIC-1. The affected files were re-serialised, and each manifest row keeps the sha256 of the response as originally retrieved in its redaction column (`research/raw/README.md`).

## Limits / confounders

- The redacted files are no longer byte-identical to the providers' responses. Only their original hashes are kept, so a third party can check the redacted file but cannot rebuild the original from this repository.
- Only one retrieval per record. No test of stability over time.
- A Europe PMC abstract was read to verify the 2HBS citation but is not stored (publisher copyright), so that check is only reproducible by fetching it again.

## Interpretation

Within the tested perimeter (HBB, HbS, 2HBS, on 2026-11-01), every needed record came from a free, unauthenticated public endpoint, and every stored file has a manifest row with its hash. The hypothesis is supported.

## Decision

**Continue.** The snapshot is the evidence base for the Phase 1 notes and the frozen fixtures for Phase 2. The privacy rule and the proprietary-identifier rule are now enforced in code: the data adapters' identifier guard (`docs/scientific-validation.md` §1).

## Artifacts

- `research/raw/README.md`, `research/raw/*/MANIFEST.tsv`, `research/raw/<source>/*`
- `scripts/research/fetch_raw.py`
- `docs/data-source-registry.md`, `docs/license-attribution-cost-audit.md`
