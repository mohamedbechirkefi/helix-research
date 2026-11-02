<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# Raw records (Phase 1 research snapshot)

Live API responses fetched on 2026-11-01 for Phase 1 tasks P1.1.3, P1.3.1 and P1.8.1. They are the evidence behind every identifier, position and sequence quoted in `research/hbs-mapping-note.md` and `research/hbb-acquisition-plan.md`.

- **How they were fetched:** `scripts/research/fetch_raw.py` (standard library only), User-Agent `helix-research` followed by the author's name in parentheses at the time (the scripts now send `helix-research` only), sleeps between calls.
- **Manifest:** each `<source>/MANIFEST.tsv` lists file, UTC retrieval time, HTTP status, sha256, size, method, URL and selected response headers (release headers, rate-limit headers).
- **Do not edit these files.** They are a frozen snapshot. Phase 2 adapters re-fetch and compare.
- **`cors/cors-results.txt`** is our own measurement (preflight and Origin-header tests), not a provider record.
- **Derived files** live in `research/derived/` and are produced from these files by `scripts/research/inspect_hbs_mapping.py` and `scripts/research/val6_contacts.py`, with no network access.

## Licences and attribution of the records in this folder

These records are third-party data. They are **not** relicensed by this repository (see `NOTICE.md`). Full terms and policy URLs are in `docs/data-source-registry.md`.

| Folder | Provider | Terms (summary; see registry) |
|---|---|---|
| `ensembl/`, `ensembl-grch37/` | Ensembl (EMBL-EBI), release 116 / GRCh37 archive service | Ensembl data "available without restriction"; third-party content keeps its owners' terms |
| `uniprot/` | UniProt Consortium, release 2026_03 | CC BY 4.0, attribution required |
| `rcsb/` | RCSB PDB / wwPDB | CC0 1.0 |
| `pdbe/` | PDBe / SIFTS | CC0, EMBL-EBI terms of use |
| `alphafold/` | AlphaFold DB (Google DeepMind and EMBL-EBI) | CC BY 4.0 |
| `ncbi-clinvar/`, `ncbi-gene/` | NCBI / NLM | Public domain (US government work) with NLM acknowledgement requested; submitter data may carry rights |
| `hgnc/` | HGNC | CC0 |
| `reactome/` | Reactome | CC0 (data) |
| `interpro/` | InterPro (EMBL-EBI) | CC0 for InterPro data; member databases may differ |
| `quickgo/`, `geneontology/` | GO Consortium / GOA via QuickGO | CC BY 4.0 |
| `opentargets/` | Open Targets Platform 26.09 | CC0 |

Identifiers that point to proprietary resources have been **removed** (author's decision Q-H-LIC-1, 2026-11-01: keep only the data Helix needs). This covers OMIM/MIM numbers in the UniProt, HGNC, NCBI Gene and ClinVar records, and HGMD accessions in Ensembl VEP `colocated_variants`. The affected files are re-serialised JSON. Each `MANIFEST.tsv` row gives the new sha256 and, in the `redaction` column, the sha256 of the response as originally retrieved.

Files not needed by Helix were deleted:
- ClinVar einfo
- HGNC service info
- an Open Targets query echo
- two Ensembl HTTP 500 HTML error pages (the first variant_recoder attempt, and xrefs)

The valid variant_recoder retry is kept. `geneontology/release-date.json` is kept as retrieved; the GO endpoint serves it as non-JSON text.

A Europe PMC abstract was fetched to verify the 2HBS primary citation but is **not** stored here, because abstract text is the publisher's copyright.
