# Licensing notice: which material is under which license

This repository contains material under two licenses. This file says which is which.

## 1. MIT: the initial commit only

The repository's initial commit, **`859ed93cbac995e5d2efc1fed821fa67092e45e9`** (1 November 2026), contained only a license file, a two-line README and a `.gitignore`. It was published under the **MIT License** ([`licenses/MIT-PRIOR.txt`](licenses/MIT-PRIOR.txt)). That grant is not revoked.

## 2. Helix Source-Available Non-Commercial Research License v1.0: everything else

All original material added after that commit, from the adoption commit `995520dc1e8b204173378e1f158df01148803be4` recorded in [`LICENSE_HISTORY.md`](LICENSE_HISTORY.md), is licensed under the [Helix Source-Available Non-Commercial Research License v1.0](LICENSE), where the Licensor is entitled to license it on those terms. This covers code, research documents, scripts, curated data products and derived annotations.

- **New files** carry the header `SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0` where the file format allows a comment.
- **Files that cannot carry a comment** (JSON data, images and similar) are covered by this notice.

## 3. Third-party material, including scientific data

Records, sequences, structures and annotations retrieved from public scientific resources are **not** relicensed here. They keep their providers' terms, and their attribution and provenance are recorded per dataset in its manifest and in `docs/data-source-registry.md`. The resources include Ensembl, UniProt, RCSB PDB, AlphaFold DB, NCBI ClinVar, Reactome and Open Targets. The same holds for software dependencies, models, fonts and any other third-party material.

## 4. Nonclinical use

Helix is a nonclinical exploration and education project. It is not a clinical diagnostic, variant classification or medical advice tool.
