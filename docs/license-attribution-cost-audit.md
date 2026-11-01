<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# Licence, attribution and cost audit (draft, P1.3.2)

**Status:** draft. It is completed at P11.3.3 before release. **Accessed:** 2026-11-01.

This is a working audit, not legal advice. "Inference" marks our reading of a licence. Data-source details and policy quotes are in `docs/data-source-registry.md`.

## 1. Cost: $0 confirmation

As of 2026-11-01, Helix has spent **$0**.

- No paid API calls, no API keys of any kind, no paid data, assets, fonts or models, and no hosting.
- Every data call in Phase 1 went to a free public endpoint without authentication. Those calls are listed in `research/raw/*/MANIFEST.tsv`.
- Every tool used is free software installed in user space.
- Free browser inference and public APIs still cost the end user bandwidth and device resources (§8). That is not a project spend, but it is disclosed.

**Watch items that could create a cost:**

- Hosting the public demo (Phase 12): free static hosting is assumed. Not chosen yet; the G-PUBLIC decision is the author's.
- Open Targets or BigQuery bulk access: BigQuery can bill. **Rule:** never use BigQuery; use the GraphQL API or free downloads.
- An NCBI API key is free but ties requests to an account. It is not needed at current volumes.

## 2. Data sources

| Source | Licence (data) | Attribution required | Notice to show in app | Redistribute cached records | Policy URL |
|---|---|---|---|---|---|
| Ensembl | "no restrictions" (Ensembl-generated data); third-party constraints possible | Not mandatory; we attribute | "Data from Ensembl release N" | Yes (Inference), excluding third-party content | https://jun2026.archive.ensembl.org/info/about/legal/disclaimer.html |
| UniProt | CC BY 4.0 | **Yes** | Attribution + licence link + "modified (fields selected)" | Yes | https://www.uniprot.org/help/license |
| RCSB PDB / wwPDB | CC0 1.0 | Encouraged | Cite entry and primary citation | Yes | https://www.rcsb.org/pages/usage-policy |
| PDBe / SIFTS | CC0 + EMBL-EBI terms | Citation requested | Cite SIFTS papers | Yes | https://www.ebi.ac.uk/pdbe/about/public-data-access-statement |
| AlphaFold DB | CC BY 4.0 | **Yes** ("EMBL-EBI expects attribution") | Attribution + keep the in-file disclaimer + "Predicted model" label | Yes | https://alphafold.ebi.ac.uk/ (licence text on homepage; in-file `_pdbx_data_usage`) |
| NCBI ClinVar, Gene, RefSeq | Public domain (US Gov); submitter rights possible | NLM acknowledgement requested | **NCBI disclaimer and copyright notice "must be evident"** | Yes (Inference), no OMIM text | https://www.ncbi.nlm.nih.gov/home/about/policies/ |
| Reactome | CC0 (data); CC BY 4.0 (diagrams, icons) | Data: encouraged; diagrams: **yes** | Credit for any Reactome diagram or icon | Yes | https://reactome.org/license |
| Open Targets | CC0 1.0 (platform) | Citation requested | Cite latest paper | Core yes; check CC BY-SA and COSMIC-derived fields | https://platform-docs.opentargets.org/licence |
| HGNC | CC0 | Recommended | Cite HGNC | Yes | https://www.genenames.org/about/license/ |
| InterPro | CC0 (InterPro, Pfam, PRINTS, SFLD) | Recommended | Cite InterPro | InterPro yes; member DBs to check | https://interpro-documentation.readthedocs.io/en/latest/license.html |
| Gene Ontology / QuickGO | CC BY 4.0 | **Yes** | Attribution + licence + **GO release date and DOI** | Yes | https://geneontology.org/docs/go-citation-policy/ |
| EMBL-EBI services (umbrella) | Terms of use | "EMBL-EBI expects attribution" | No implied endorsement | per resource | https://www.ebi.ac.uk/about/terms-of-use |

**Content to exclude from public bundles (Decision proposal):**

- OMIM text. Identifiers appear in HGNC, ClinVar and Ensembl records; text does not, and must not be added.
- HGMD accessions and content (observed in Ensembl VEP `colocated_variants`).
- COSMIC-derived fields.
- Share-alike (CC BY-SA) fields from ChEMBL or the Human Protein Atlas inside Open Targets responses, unless the bundle can carry that licence.
- Publisher abstracts (for example from Europe PMC). This is why the 2HBS abstract used for verification is not committed.

**The raw snapshot in this repository** (`research/raw/`) holds API responses with identifiers pointing to proprietary resources (OMIM, HGMD) removed, per the author's decision Q-H-LIC-1 (2026-11-01); see `research/raw/README.md`.

## 3. Software and tools used so far

| Tool | Version | Licence | Primary URL (accessed 2026-11-01) | Distribution role |
|---|---|---|---|---|
| CPython | 3.12.1 | PSF License v2 | https://raw.githubusercontent.com/python/cpython/main/LICENSE | Dev tool (research scripts) |
| uv | 0.13.1 | MIT or Apache-2.0 | https://raw.githubusercontent.com/astral-sh/uv/main/README.md | Dev tool |
| Biopython | 1.88 | Biopython License Agreement; some files dual-licensed with BSD 3-Clause | https://raw.githubusercontent.com/biopython/biopython/biopython-188/LICENSE.rst | Research dependency (not shipped in the app) |
| NumPy | 2.5.4 (Biopython dependency, `uv.lock`) | BSD 3-Clause (bundled sub-components not checked) | https://raw.githubusercontent.com/numpy/numpy/main/LICENSE.txt | Research dependency |
| Node.js | 22.23.3 | MIT (plus bundled third-party licences) | https://raw.githubusercontent.com/nodejs/node/main/LICENSE | Dev tool |
| npm | 10.9.9 | Artistic-2.0 | https://raw.githubusercontent.com/npm/cli/latest/LICENSE | Dev tool |
| Ollama | 0.9.6 | MIT | https://raw.githubusercontent.com/ollama/ollama/main/LICENSE | Dev tool (local AI) |
| Meta Llama 3.1 (model) | `llama3.1` via Ollama | Llama 3.1 Community License | https://raw.githubusercontent.com/meta-llama/llama-models/main/models/llama3_1/LICENSE | Dev only so far |
| nomic-embed-text (model) | v1.5 via Ollama | Apache-2.0 (model card) | https://huggingface.co/nomic-ai/nomic-embed-text-v1.5 | Dev only so far |
| git, gh | 2.42.1, 2.82.1 | GPL-2.0 (git), MIT (gh) | Not re-fetched this session (**unverified** here) | Dev tools, not distributed |

**Planned, not yet installed:**

| Tool | Licence | Primary URL |
|---|---|---|
| Mol* | MIT | https://raw.githubusercontent.com/molstar/molstar/master/LICENSE |
| MolViewSpec | MIT | https://raw.githubusercontent.com/molstar/mol-view-spec/master/LICENSE |

**Obligations that matter if anything ships:**

- **Llama 3.1**, if shipped or used in the public product:
  - "prominently display 'Built with Llama'"
  - keep the notice "Llama 3.1 is licensed under the Llama 3.1 Community License, Copyright © Meta Platforms, Inc. All Rights Reserved."
  - the 700 million monthly-active-user clause (not relevant at this scale)
  - models trained on its outputs and distributed must start their name with "Llama"
  - **Inference:** this licence is compatible with a non-commercial research portfolio but is not open source; P3 should prefer an Apache-2.0 or MIT model for the public demo where quality allows.
- **MIT / BSD / Apache:** keep the copyright and licence texts in a third-party notices file in any built bundle.
- **Biopython:** not shipped in the web app; research-only.

## 4. Fonts, assets and models for the app

None chosen yet. Every font, icon set, texture, sound and model added later gets a row here (licence, URL, attribution, cost $0) before it is committed.

## 5. Open items

1. Q-H-LIC-1, resolved 2026-11-01: the author chose to strip them and keep only the data Helix needs.
2. Verify git and gh licences from primary pages (not re-fetched).
3. GO release DOI for the attribution string (not retrieved).
4. RefSeq- and ClinVar-specific usage statements (blocked by reCAPTCHA for scripts; need a manual browser check).
5. Licences of the InterPro member databases, before any member signature text is bundled.

## 6. Rendering and desktop stack (P1.4.1, P1.4.2, P1.5.2)

**Added:** 2026-11-01. Licences were read from the installed package metadata (`package.json` `license` field, `Cargo.toml` `license` field) and, where present, from the shipped `LICENSE` file. Versions are pinned in each experiment's `package.json` or `Cargo.toml` under `research/experiments/`. All were installed in user space at $0.

| Package | Version | Licence (as read) | Where read | Role |
|---|---|---|---|---|
| Mol* (`molstar`) | 5.13.1 | MIT ("Copyright (c) 2017 - now, Mol* contributors") | `node_modules/molstar/LICENSE` and file headers | Shipped (molecular renderer, MVS extension) |
| MolViewSpec (MVS extension inside `molstar`) | as in molstar 5.13.1 | MIT (same package) | file headers in `lib/extensions/mvs/` | Shipped |
| three.js (`three`) | 0.186.1 | MIT ("Copyright © 2010-2026 three.js authors") | `node_modules/three/LICENSE` | Shipped (R3F layer) |
| React Three Fiber (`@react-three/fiber`) | 9.8.2 | MIT | `package.json` (the npm tarball has **no LICENSE file**; the repository's licence file is not re-fetched here, **unverified**) | Shipped |
| React, React DOM | 19.3.1 | MIT | `package.json` | Shipped |
| Tauri (`tauri` crate) | 2.12.4 | Apache-2.0 OR MIT | `Cargo.toml` in the cargo registry | Shipped in the desktop build |
| `tauri-build` | 2.7.3 | Apache-2.0 OR MIT | `Cargo.toml` | Build tool |
| `wry` (WebView layer used by Tauri) | 0.57.1 | Apache-2.0 OR MIT | `Cargo.toml` | Shipped in the desktop build |
| `tauri-plugin-http` | 2.8.3 | Apache-2.0 OR MIT | `Cargo.toml` | Shipped in the desktop build |
| `@tauri-apps/cli` | 2.12.3 | Apache-2.0 OR MIT | `package.json` | Build tool |
| `@tauri-apps/api`, `@tauri-apps/plugin-http` | 2.12.4, 2.8.3 | Apache-2.0 OR MIT | `package.json` | Shipped (desktop glue) |
| Vite, `@vitejs/plugin-react` | 8.3.4, 6.1.2 | MIT | `package.json` | Build tool |
| TypeScript | 6.0.3 | Apache-2.0 | `package.json` | Build tool |
| sass | 1.105.2 | MIT | `package.json` | Build tool (compiles the Mol* skin) |
| puppeteer-core | 25.14.0 | Apache-2.0 | `package.json` | Test tool, drives the system Chrome; not shipped |
| Rust toolchain | 1.97.0 | Apache-2.0 OR MIT | not re-fetched (**unverified** here) | Build tool |

**Transitive dependencies (counted, not individually reviewed):**

- **npm tree of `molstar-embed`:** 223 MIT, 10 ISC, 9 Apache-2.0, 3 BSD-3-Clause (`devtools-protocol`, `qs`, `source-map-js`), 2 MPL-2.0 (`lightningcss`, build-time only), 1 0BSD (`tslib`), 1 Python-2.0 (`argparse`, pulled by molstar's CLI dependencies, not in the browser bundle; **Inference** from its use as a CLI parser).
  - Mol*'s package also declares server-side dependencies (`express`, `swagger-ui-dist`, `h264-mp4-encoder`, `@google-cloud/storage` as a peer). They are installed but are not imported by the browser bundle (**Inference**: tree-shaken; not audited file by file).
- **Cargo tree of `tauri-shell`:** 308 crates for aarch64-apple-darwin, almost all MIT and/or Apache-2.0. Notable exceptions:
  - 18 Unicode-3.0 (ICU data crates)
  - 5 MPL-2.0 (`cssparser`, `cssparser-macros`, `dtoa-short`, `option-ext`, `selectors`). MPL-2.0 is file-level copyleft: unmodified use in a binary is fine, but the source of those files must stay available; **Inference**.
  - 1 CDLA-Permissive-2.0 (`webpki-roots`, the Mozilla CA list)
  - a few Zlib, BSD-3-Clause, ISC and BSL-1.0 options

**Obligations if the web or desktop build ships:**

- Ship a third-party notices file that carries the MIT, Apache-2.0, BSD, ISC, Unicode-3.0 and MPL-2.0 texts. Generate it from the lockfiles at build time (P11.3.3), rather than by hand.
- Apache-2.0 option for Tauri crates: if Helix takes the Apache-2.0 branch, keep any NOTICE files. The MIT branch avoids that; **Inference**.
- Mol* asks for a citation of Sehnal et al. 2021 (NAR, doi:10.1093/nar/gkab314) when used in publications, and MolViewSpec asks for Midlik et al. 2025. These are courtesy requests, not licence conditions, and the references are in `competitor-analysis.md`.
- None of these licences restricts non-commercial or commercial use, so they are compatible with the Helix NC research licence of Helix's own code. The NC licence applies only to Helix's own files, not to these dependencies.

**Cost watch items:**

- Apple Developer Program for Developer ID signing and notarisation is **paid**. It is not used: the DMG is ad hoc signed. Any change is the author's decision.
- An Ollama sidecar shipped inside the app has not been evaluated. Model weights carry their own licences (Llama 3.1 obligations above).
