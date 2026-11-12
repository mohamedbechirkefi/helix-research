<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# Licence, attribution and cost audit (final for the web build, P11.3.3)

**Status:** final for the web build on 2026-11-12 (task P11.3.3 of `docs/phase-11-release-qa.md`, web part). The desktop crate graph and the notices inside the DMG are **deferred to P11.5.4** (section 10). Drafted at P1.3.2 (2026-11-01); sections 2, 3 and 6 keep their Phase 1 text where nothing changed, with the P11.3.3 additions marked.

This is a working audit, not legal advice. "Inference" marks our reading of a licence. Data-source details and policy quotes are in `docs/data-source-registry.md`. Journal entry: `journal/2026-11-12-phase11-licence.md` (HX-P11-2026-11-12-licence). Raw results: helix-app `apps/web/e2e/results/*p11lic*`. Review page: helix-app `docs/reviews/phase-11-licence-audit.md`.

**Built from:** helix-app defe711 (generator and link; pin test ab9a7ae; review and results 97cd609), research pin a6a8b44 (unchanged), helix-research 62f176f.

## 1. Cost: $0 (section 8 of the Phase 11 plan)

**Verdict: $0.** As of 2026-11-12, Helix has spent nothing, and no exception has been approved or needed. Every line below has its evidence; nothing here was checked by a live call or a paid account.

| Item | Cost | Evidence |
|---|---|---|
| Node.js 22.23.3 and npm 10.9.9 | $0, user space | `helix/.tools/node-v22.23.3-darwin-arm64` (D-H002: free user-space installs under `helix/.tools/`, checksum-verified); licences MIT (Node, `LICENSE` in that folder) and Artistic-2.0 (npm, `lib/node_modules/npm/LICENSE`) |
| uv 0.13.1, CPython 3.12.1 | $0, user space | `uv --version` 0.13.1 (2026-10-13 build, the workspace's user-space copy); `python3 --version` 3.12.1; licences in section 3 |
| Google Chrome 157.0.8103.52 | $0 (free download, installed by the author) | `--version`; used headless by every browser suite |
| Firefox 158.0.1 | $0, user space | `helix/.tools/firefox/firefox/mac_arm-stable_158.0.1`, installed through `@puppeteer/browsers` (D-H031); MPL-2.0 |
| Safari 18.3 | $0 (part of macOS) | `Info.plist` CFBundleShortVersionString 18.3; Remote Automation enabled by the author (D-H031) |
| Rust and Tauri | $0, user space | `~/.cargo/bin/cargo` 1.97.0; Tauri crates under Apache-2.0 OR MIT (section 6); the desktop build is checked in P11.5.4 (section 10) |
| git 2.42.1, gh 2.82.1 | $0 | GPL-2.0 (`COPYING`) and MIT (`LICENSE`, "Copyright (c) 2019 GitHub Inc.") read from the installed copies (section 5 item 2); development tools, not distributed |
| npm dependencies in the web build | $0, all free licences | 89 packages: 86 MIT, 1 ISC, 1 Apache-2.0, 1 0BSD (section 7); none is paid, none needs a key or an account |
| Data sources | $0, no key, no paid tier | section 2: every source is a free public endpoint used without authentication; Open Targets through its GraphQL API or downloads, never BigQuery (section 1 rule); the calls are listed in `research/raw/*/MANIFEST.tsv` |
| APIs called in dynamic mode | $0, no key | the four origins of helix-app `apps/web/csp-policy.ts:17` (`DYNAMIC_API_ORIGINS`: rest.ensembl.org, rest.genenames.org, rest.uniprot.org, alphafold.ebi.ac.uk), called from the visitor's browser without credentials; the privacy run of `security.mjs` finds no host outside them and no added header (helix-app `docs/security-review.md` section 6) |
| Language model | $0, local | ministral-3:8b, Apache-2.0, run through the local Ollama (`docs/ai-model-benchmark.md` section 3.1 row `ministral-3:8b` and the decision table, "Development model" and "Desktop default"); not bundled (section 4.3); no cloud fallback, no paid inference anywhere |
| Fonts | $0 | SIL OFL 1.1, from the free npm registry (section 4.1) |
| Wordmark | $0 recorded | produced by the author with ChatGPT image generation (helix-app `brand/author-supplied/PROVENANCE.md`); no purchase recorded; rights to be cleared by the author before any release (section 4.2) |
| Hosting and domain | none | nothing is published in Phase 11 (question 98 (a), D-H030); the Phase 12 host is the author's G-PUBLIC decision |
| Apple Developer Program | none | the DMG is ad hoc signed (question 97 (a), D-H030); the one journal entry about signing records `cost: 0 (no Apple Developer account; ad hoc signature)` |
| CI and GitHub | $0 recorded | helix-research has one workflow, `.github/workflows/cla.yml` (CLA Assistant, pinned by SHA, D-H004), on a GitHub-hosted `ubuntu-latest` runner, triggered only by pull-request events; helix-app has no workflow. Inference: Actions minutes on a public repository and a private repository without workflows cost nothing; not checked live |
| Usability sessions and expert review | none | replaced by an AI inspection and an AI-assisted audit (D-H031); no participant was paid |
| Journals | 0 in every entry | `grep "^cost:" journal/*.md`: 79 entries carry a `cost:` field, every one starts with `0` (66 plain `0`, the others `0` with a reason such as "local inference" or "no model call, no live API call"); a search for "purchas", "invoice", "subscription" and dollar amounts finds nothing |

**What a visitor pays.** A visitor's own bandwidth and device: 1,974,419 bytes at rest on the default page (helix-app `apps/web/e2e/results/security-bytes-p11lic-bytes-none.json`, three starts), and in dynamic mode the visitor's browser calls the four public APIs. This is disclosed in the limitations, not counted as project spend.

**Watch items that could still create a cost** (unchanged from Phase 1): free static hosting for Phase 12 is assumed and not chosen; never BigQuery for Open Targets; an NCBI API key is free but ties requests to an account and is not needed.

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

### 2.1 Attribution in the web build (P11.3.3)

**What ships.** The web build carries the five curated sets (`dist/data/<set>/`, 79 files: JSON records, 4 PDB mmCIF files and each set's `manifest.json`). Every source a curated manifest names is one of the ten rows below; InterPro and Gene Ontology are not used by any shipped set. Each record carries its sources with `licence` and `attribution` fields, written by the research build (`data/curated/<set>/manifest.json` `sources[]` and `attribution[]`; the generator is `scripts/data-preparation/build-gene.ts`).

**Where the app shows it.** Evidence World's evidence index (helix-app `apps/web/src/phase6.tsx:517`, the "Evidence in this journey" section) renders one card per evidence entry; each card's provenance lists every source of its record as "<source link> <release>, retrieved <date>, <licence>. <attribution>" (`apps/web/src/ui/EvidenceCard.tsx:44`). The same Evidence World is the narrow page's evidence section (`apps/web/src/ui/NarrowPage.tsx:206`). Its "Datasets and record versions" section (`phase6.tsx:548`) lists every source row of the manifest and, since defe711, links to the build's `THIRD-PARTY-NOTICES.txt` (`phase6.tsx:579` to `:585`), whose section 5 gives each data licence's URL.

**Evidence that each attribution is on screen:** the S21 text inventory (`apps/web/e2e/results/text-inventory-p11sci.json`, screens of `a11y.mjs --all-sets --texts`), every text unit found by its attribution string; rerun at p11lic with the same counts (section 9).

| Source (manifest id) | Licence, where recorded | Sets | Attribution in the app (inventory unit; screens) | Required, and met? |
|---|---|---|---|---|
| UniProt (`uniprot`) | CC BY 4.0: manifests `licence` "CC-BY-4.0"; registry section 3 | all five and the dynamic set | "UniProt Consortium, UniProtKB, https://www.uniprot.org, CC BY 4.0. Fields were selected and restructured by HELIX." (T4039; every set's evidence screen, the narrow page, protein and pathway screens) | Attribution, modification note: shown. Licence link: the card names "CC BY 4.0" without a link; the URI is in the notices linked from the same Evidence World section. **Met by Inference** (CC BY 4.0 section 3(a)(2) allows a URI to a resource with the required information); P11-LIC-06 |
| AlphaFold DB (`alphafold`) | CC BY 4.0: manifests; registry | all five and the dynamic set | "AlphaFold DB (Google DeepMind and EMBL-EBI), CC BY 4.0. Predicted model; the in-file disclaimer is kept." (T4072; evidence screens, narrow page). The curated sets list the model, never load it (limitation `predicted-model`); in dynamic mode the model file is fetched and handed to Mol* unmodified, so its in-file `_pdbx_data_usage` stays | Attribution and "Predicted model": shown. Licence link: as UniProt (P11-LIC-06) |
| RCSB PDB Data API (`rcsb`) and wwPDB files (`rcsb-files`) | CC0 1.0: manifests; registry | brca1, cftr, hbb, slc6a3 | "RCSB PDB (rcsb.org) Data API, CC0 1.0. ..." (T4055) and "wwPDB archive file served by RCSB PDB (files.rcsb.org), CC0 1.0. ..." (T4053) | Not required (CC0). Shown. The entries' primary citations are not displayed (encouraged only; P11-LIC-09) |
| SIFTS via PDBe (`pdbe-sifts`) | CC0 + EMBL-EBI terms: manifests; registry | brca1, cftr, hbb, slc6a3 | "SIFTS via the PDBe API (EMBL-EBI), CC0. Cite Dana et al., NAR 2019 and Velankar et al., NAR 2013." (T4057) | Citation requested: shown |
| Ensembl (`ensembl`) | no restrictions: manifests "Ensembl-no-restrictions"; registry | all five and the dynamic set | "Ensembl (EMBL-EBI), https://www.ensembl.org. Ensembl imposes no restrictions on use of its data; ..." (T4033) | Not required; shown |
| NCBI ClinVar (`ncbi-clinvar`) | public domain with submitter caveat: manifests "NCBI-public-domain"; registry section 5 | brca1, cftr, hbb, slc6a3 | "NCBI ClinVar via E-utilities. NCBI places no restrictions on use of the data; submitters may claim rights in their submissions. See the NCBI disclaimer and copyright notice." (T4044; evidence, protein, pathway, bridge and narrow screens) | The NCBI policy asks that its disclaimer and copyright notice be evident: the app points to it in words, with no link; the policies URL is in the notices. **Partly met**; P11-LIC-07. The ClinVar-specific statement is still unread (section 5 item 4) |
| HGNC (`hgnc`) | CC0: manifests; registry | all five and the dynamic set | "HUGO Gene Nomenclature Committee (HGNC), https://www.genenames.org, CC0. Seal et al., NAR 2023." (T4035; evidence screens, narrow page) | Citation recommended: shown |
| Reactome (`reactome`) | CC0 data (diagrams CC BY 4.0, not used): manifests; registry | all five | "Reactome Content Service, https://reactome.org, data CC0 (attribution encouraged). ... diagrams and icons (CC BY 4.0) are not used." (T4079; evidence screens, explanations) | Not required for data; no diagram or icon is shipped (Pathway World draws its own); shown |
| Open Targets (`opentargets`) | CC0 1.0 platform: manifests; registry section 7 | all five | "Open Targets Platform, https://platform.opentargets.org, CC0 1.0 for the platform. Association scores and identifiers only; ..." (T4086; evidence screens, narrow page, explanations) | Citation requested: the platform is named, the paper is not cited (P11-LIC-09); the share-alike and restricted datasource scores are dropped at parse time (record field `droppedDatasources`, shown at `phase6.tsx:672`) |

No source is shipped without its attribution on screen. The two partial points (licence URI for CC BY 4.0 and the NCBI notice) are reachable from the same section through the notices; whether to put them in each card is question Q2.

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
| git, gh | 2.42.1, 2.82.1 | GPL-2.0 (git), MIT (gh) | **Verified 2026-11-12** from the installed copies: `/opt/homebrew/Cellar/git/2.42.1/COPYING` (GPL v2 only) and `/opt/homebrew/Cellar/gh/2.82.1/LICENSE` (MIT, "Copyright (c) 2019 GitHub Inc.") | Dev tools, not distributed |

**Planned, not yet installed** (Phase 1 text; both now installed and shipped, section 6 and section 7):

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
  - **P11.3.3:** Llama 3.1 is not shipped and not the product's model (ministral-3:8b, Apache-2.0, was chosen in Phase 3); none of these obligations applies to the web build.
- **MIT / BSD / Apache:** keep the copyright and licence texts in a third-party notices file in any built bundle. **P11.3.3:** done for the web build (section 7).
- **Biopython:** not shipped in the web app; research-only.

## 4. Fonts, assets and models in the web build (P11.3.3)

The web build (`apps/web/dist`, 108 files) holds: 7 scripts and 3 stylesheets (the packages of section 7 and Helix's own code), 15 font files, 2 image files (plus 2 small images inlined in the scripts), `index.html`, `THIRD-PARTY-NOTICES.txt`, and the 79 data files of section 2.1. There is no audio file (the sounds are synthesised at run time by the Web Audio API), no 3D model file, no texture and no icon font. Every emitted file is attributed by the notices generator, which stops the build on any emitted or inlined file it has no row for (helix-app `apps/web/third-party-notices.ts`, `FONT` and `BRAND` patterns).

### 4.1 Fonts

All 15 font files are byte-identical to the sha256 listed in helix-app `apps/web/vendor/fonts/PROVENANCE.md` (checked 2026-11-12, file by file), and each family's `OFL.txt` matches its listed sha256. Source: Fontsource npm packages `@fontsource/<family>@5.3.0`, free registry, unmodified subsets.

| Family | Files in the build | Licence | Copyright (from `OFL.txt`) | Loaded by |
|---|---|---|---|---|
| Geist Sans | latin 300, 400, 500 | SIL OFL 1.1 | 2023 Vercel, with basement.studio | the shipped app (`apps/web/src/ui/fonts.css`); fetched at rest |
| Geist Mono | latin 400, 500 | SIL OFL 1.1 | 2024 The Geist Project Authors | the shipped app; fetched at rest |
| Instrument Sans | latin 400, 500, 600 | SIL OFL 1.1 | 2022 The Instrument Sans Project Authors | concept prototypes only (`?concept=`) |
| Instrument Serif | latin 400 normal and italic | SIL OFL 1.1 | 2022 The Instrument Serif Project Authors | concept prototypes only |
| JetBrains Mono | latin 400, 500 | SIL OFL 1.1 | 2020 The JetBrains Mono Project Authors | concept prototypes only |
| Sora | latin 300, 400, 600 | SIL OFL 1.1 | 2019 The Sora Project Authors | concept prototypes only |

OFL 1.1 allows bundling and redistribution with software; the condition that matters here is that the licence and copyright travel with the fonts, which the notices now do (section 3 of `THIRD-PARTY-NOTICES.txt`). No Reserved Font Name is affected (files unmodified and not renamed). The PROVENANCE file said "the shipped app does not load them", untrue since P7.3.1 (helix-app 8a454d5, 2026-11-02); corrected (P11-LIC-05).

### 4.2 Images and the wordmark

| File in the build | Source | Licence or status |
|---|---|---|
| `assets/helix-wordmark-*.svg` (fetched at rest, 38.4 kB) | `packages/design-system/src/assets/helix-wordmark.svg` (and the identical concepts copy), the vector redraw of the author-supplied wordmark (`brand/README.md`) | The author's brand file, not third-party. **Rights not yet cleared** (below) |
| `assets/mark-x-tile-180-*.png`; `mark-x-tile-16.png` and `-32.png` inlined as data URIs | `brand/marks/png/`, derived from the wordmark by `brand/tools/` | As above |

**Wordmark status (question 98 (a), D-H030; D-H011):** the original was generated by the author with ChatGPT (OpenAI image generation) on or before 2026-11-02 (`brand/author-supplied/PROVENANCE.md`). Before any release the author records the OpenAI terms clause in force, keeps the prompt record if available, and runs a trademark search for "Helix". **This is an author action and is open**; nothing is published in Phase 11. The notices say the files are the author's brand files, not covered by any third-party licence, and that their rights record is to be completed before any release (P11-LIC-08).

### 4.3 Models

No model and no model weights are in the build, and no in-browser inference library is bundled (the package list of section 7 has none; WebLLM was evaluated in Phase 3 and not adopted). The product's model is **ministral-3:8b, Apache-2.0** (licence shipped with the model, checked against the Hugging Face card `mistralai/Ministral-3-8B-Instruct-2512`; `docs/ai-model-benchmark.md` section 3.1 and the role table), run by the visitor's or developer's own Ollama, never bundled (question 96 (a), D-H030). Llama 3.1, nomic-embed-text, qwen3.5:4b and phi4-mini were used in development only.

### 4.4 Data files

The 79 files of `dist/data/` are copied from the pinned helix-research `data/curated/<set>/`, each checked against its manifest's sha256 at build time (helix-app `apps/web/scripts/copy-data.mjs`). Licences and attribution per source: section 2.1. The four mmCIF files (1JM7, 5UAK, 2HBS, 8Y2C) are wwPDB archive files under CC0 1.0.

## 5. Open items (closed at P11.3.3 unless stated)

1. **Q-H-LIC-1:** resolved 2026-11-01 (the author chose to strip the proprietary identifiers and keep only the data Helix needs). Closed.
2. **git and gh licences:** closed. Read from the installed copies, not a web page: git 2.42.1 `COPYING` is GPL v2 only; gh 2.82.1 `LICENSE` is MIT, "Copyright (c) 2019 GitHub Inc." Both are development tools, never distributed (section 3).
3. **GO release DOI:** closed as not applicable. No shipped set uses Gene Ontology or QuickGO (no manifest source; section 2.1). If GO terms are ever added, the attribution string needs the GO release date and DOI before they ship.
4. **RefSeq- and ClinVar-specific usage statements:** **stays open.** The ClinVar data-use and programmatic-access pages and the RefSeq FAQ are behind reCAPTCHA for scripts (`docs/data-source-registry.md` section 5 and its list of unfetchable pages); this pass made no live call. The general NCBI policy is recorded and attributed (section 2.1); RefSeq data are not shipped as a separate source (RefSeq accessions appear inside Ensembl and ClinVar records). Closing it needs one manual browser check by the author (free).
5. **Licences of the InterPro member databases:** closed as not applicable. No shipped set uses InterPro (the protein records keep UniProt Domain features only; D-H039 item 4). If InterPro signatures are ever bundled, the member databases' licences are checked first.

New items from this pass are in section 8 (findings) and section 9 (questions).

## 6. Rendering and desktop stack (P1.4.1, P1.4.2, P1.5.2)

**Added:** 2026-11-01. Licences were read from the installed package metadata (`package.json` `license` field, `Cargo.toml` `license` field) and, where present, from the shipped `LICENSE` file. Versions are pinned in each experiment's `package.json` or `Cargo.toml` under `research/experiments/`. All were installed in user space at $0.

| Package | Version | Licence (as read) | Where read | Role |
|---|---|---|---|---|
| Mol* (`molstar`) | 5.13.1 | MIT ("Copyright (c) 2017 - now, Mol* contributors") | `node_modules/molstar/LICENSE` and file headers | Shipped (molecular renderer, MVS extension) |
| MolViewSpec (MVS extension inside `molstar`) | as in molstar 5.13.1 | MIT (same package) | file headers in `lib/extensions/mvs/` | Shipped |
| three.js (`three`) | 0.186.1 | MIT ("Copyright © 2010-2026 three.js authors") | `node_modules/three/LICENSE` | Shipped (R3F layer) |
| React Three Fiber (`@react-three/fiber`) | 9.8.2 | MIT | `package.json` (the npm tarball has **no LICENSE file**; no other copy of the repository's licence file exists on this machine, including the npm cache, checked 2026-11-12; P11-LIC-01) | Shipped |
| React, React DOM | 19.3.1 | MIT | `package.json`, and `LICENSE` in each package (read at P11.3.3) | Shipped |
| Tauri (`tauri` crate) | 2.12.4 | Apache-2.0 OR MIT | `Cargo.toml` in the cargo registry | Shipped in the desktop build |
| `tauri-build` | 2.7.3 | Apache-2.0 OR MIT | `Cargo.toml` | Build tool |
| `wry` (WebView layer used by Tauri) | 0.57.1 | Apache-2.0 OR MIT | `Cargo.toml` | Shipped in the desktop build |
| `tauri-plugin-http` | 2.8.3 | Apache-2.0 OR MIT | `Cargo.toml` | Shipped in the desktop build |
| `@tauri-apps/cli` | 2.12.3 | Apache-2.0 OR MIT | `package.json` | Build tool |
| `@tauri-apps/api`, `@tauri-apps/plugin-http` | 2.12.4, 2.8.3 | Apache-2.0 OR MIT | `package.json` | Shipped (desktop glue) |
| Vite, `@vitejs/plugin-react` | 8.3.4, 6.1.2 | MIT | `package.json` | Build tool (Vite's preload helper and module-preload polyfill, and Rolldown's runtime, are also in the web build: section 7) |
| TypeScript | 6.0.3 | Apache-2.0 | `package.json` | Build tool |
| sass | 1.105.2 | MIT | `package.json` | Build tool (compiles the Mol* skin) |
| puppeteer-core | 25.14.0 | Apache-2.0 | `package.json` | Test tool, drives the system Chrome; not shipped |
| Rust toolchain | 1.97.0 | Apache-2.0 OR MIT | not re-fetched (**unverified** here) | Build tool |

**Transitive dependencies (counted, not individually reviewed):**

- **npm tree of `molstar-embed`:** 223 MIT, 10 ISC, 9 Apache-2.0, 3 BSD-3-Clause (`devtools-protocol`, `qs`, `source-map-js`), 2 MPL-2.0 (`lightningcss`, build-time only), 1 0BSD (`tslib`), 1 Python-2.0 (`argparse`, pulled by molstar's CLI dependencies, not in the browser bundle; **Inference** from its use as a CLI parser).
  - Mol*'s package also declares server-side dependencies (`express`, `swagger-ui-dist`, `h264-mp4-encoder`, `@google-cloud/storage` as a peer). They are installed but are not imported by the browser bundle (**Inference**: tree-shaken; not audited file by file). **P11.3.3:** confirmed for helix-app's web build: none of them is in the build's module graph (section 7), and neither is `argparse`.
- **Cargo tree of `tauri-shell`:** 308 crates for aarch64-apple-darwin, almost all MIT and/or Apache-2.0. Notable exceptions:
  - 18 Unicode-3.0 (ICU data crates)
  - 5 MPL-2.0 (`cssparser`, `cssparser-macros`, `dtoa-short`, `option-ext`, `selectors`). MPL-2.0 is file-level copyleft: unmodified use in a binary is fine, but the source of those files must stay available; **Inference**.
  - 1 CDLA-Permissive-2.0 (`webpki-roots`, the Mozilla CA list)
  - a few Zlib, BSD-3-Clause, ISC and BSL-1.0 options

**Obligations if the web or desktop build ships:**

- Ship a third-party notices file that carries the MIT, Apache-2.0, BSD, ISC, Unicode-3.0 and MPL-2.0 texts. ~~Generate it from the lockfiles at build time (P11.3.3), rather than by hand.~~ **P11.3.3:** the web build's notices are generated from the build's module graph, not the lockfile (section 7); the desktop's from the crate graph at P11.5.4 (section 10).
- Apache-2.0 option for Tauri crates: if Helix takes the Apache-2.0 branch, keep any NOTICE files. The MIT branch avoids that; **Inference**. Question 98 (a) takes the Tauri crates under their MIT option (D-H030).
- Mol* asks for a citation of Sehnal et al. 2021 (NAR, doi:10.1093/nar/gkab314) when used in publications, and MolViewSpec asks for Midlik et al. 2025. These are courtesy requests, not licence conditions, and the references are in `competitor-analysis.md`.
- None of these licences restricts non-commercial or commercial use, so they are compatible with the Helix NC research licence of Helix's own code. The NC licence applies only to Helix's own files, not to these dependencies.

**Cost watch items:**

- Apple Developer Program for Developer ID signing and notarisation is **paid**. It is not used: the DMG is ad hoc signed. Any change is the author's decision.
- An Ollama sidecar shipped inside the app has not been evaluated. Model weights carry their own licences (Llama 3.1 obligations above). Question 96 (a): nothing is bundled.

## 7. The web build's third-party packages and notices (P11.3.3)

**Method.** The notices are generated by the build itself (helix-app `apps/web/third-party-notices.ts`, wired in `apps/web/vite.config.ts`; pinned by `apps/web/test/p11-licence.test.tsx`). One Vite plugin observes the page build and one the dynamic-mode worker build; in `generateBundle` every module of every output chunk (the page's scripts, the lazy scene and colour chunks, the concept prototypes' chunk and the worker) is attributed to its package by its path in `node_modules`, the bundler's own helpers to Vite and Rolldown, and Helix's own code (helix-app and the pinned helix-research packages) is first-party. A module from anywhere else, or an unknown virtual module, stops the build. Each package's licence text is read from its own licence file in `node_modules`. The build is deterministic: the scratch build and the served build give the same notices byte for byte (sha256 `f65e0315...`), and adding the plugins changed no asset (all 27 files of `assets/` identical before the link was added).

**Result.** 89 packages in the build, against 229 non-development entries in helix-app's lockfile (Phase 11 plan, P11.3.3): 87 runtime packages plus Vite (3 helper modules) and Rolldown (its runtime). Licences: **86 MIT, 1 ISC (`@ungap/structured-clone`), 1 Apache-2.0 (`rxjs`), 1 0BSD (`tslib`)**. 88 ship a licence file; R3F ships none (P11-LIC-01). None of `express`, `swagger-ui-dist`, `h264-mp4-encoder`, `@google-cloud/storage`, `argparse`, `body-parser` or any other server-side package is in the build. Raw list: helix-app `apps/web/e2e/results/third-party-packages-p11lic.json` (each licence text's sha256 and size; no text).

**`THIRD-PARTY-NOTICES.txt`.** At the root of the build, next to `index.html`; 188,350 bytes (17,667 bytes gzip). Sections: 1 the 89 packages, each with version, licence, repository, the chunks it is in and its full licence text (for Vite, its own MIT terms without the list of the dependencies bundled in its Node.js code); 2 the 53 comment blocks with a third-party copyright or licence line copied from bundled source files (the minifier removes every JavaScript comment; the only notices left in the built scripts are three comment blocks inside Mol*'s GLSL shader source strings, P11-LIC-02); 3 the 6 font families with each `OFL.txt`; 4 the wordmark statement; 5 the 10 data sources with licence URL, releases, sets and the attribution strings of the manifests; 6 what is not included (no model, no inference library).

**Bytes.** The page never fetches the notices: the start pages load 32 resources, none of them the notices (`budgets-p11lic.json`, `security-bytes-p11lic-bytes-none.json`). Bytes at rest 1,974,419 (+233 over 1,974,186 at D-H039, the link in the index chunk: +265 bytes raw, +233 gzip), 25,581 bytes of room under 2,000 kB. All assets gzip 1,981.7 kB (`budgets.mjs` counts `dist/assets/` only, where the notices are not), 118.3 kB of room under 2,100 kB; if the notices were counted, 1,999.4 kB, still inside. No budget value was changed.

**Reaching it.** Evidence World's "Datasets and record versions" section ends with "Licences of the software, fonts and data in this build: third-party notices." linking `./THIRD-PARTY-NOTICES.txt` (new tab), on the wide page and the narrow page.

### 7.1 Packages in the build

| Package | Version | Licence | Licence file read | Chunks |
|---|---|---|---|---|
| @react-three/fiber | 9.8.2 | MIT | none shipped (finding P11-LIC-01) | index |
| @ungap/structured-clone | 1.4.0 | ISC | `LICENSE` | scene |
| bail | 2.0.2 | MIT | `license` | scene |
| ccount | 2.0.1 | MIT | `license` | scene |
| comma-separated-tokens | 2.0.3 | MIT | `license` | scene |
| decode-named-character-reference | 1.3.0 | MIT | `license` | scene |
| devlop | 1.1.0 | MIT | `license` | scene |
| escape-string-regexp | 5.0.0 | MIT | `license` | scene |
| estree-util-is-identifier-name | 3.0.0 | MIT | `license` | scene |
| extend | 3.0.2 | MIT | `LICENSE` | scene |
| hast-util-to-jsx-runtime | 2.3.6 | MIT | `license` | scene |
| hast-util-whitespace | 3.0.0 | MIT | `license` | scene |
| html-url-attributes | 3.0.1 | MIT | `license` | scene |
| immutable | 5.1.9 | MIT | `LICENSE` | scene |
| inline-style-parser | 0.2.7 | MIT | `LICENSE` | scene |
| is-plain-obj | 4.1.0 | MIT | `license` | scene |
| its-fine | 2.1.1 | MIT | `LICENSE` | index |
| longest-streak | 3.1.0 | MIT | `license` | scene |
| markdown-table | 3.0.4 | MIT | `license` | scene |
| mdast-util-find-and-replace | 3.0.3 | MIT | `license` | scene |
| mdast-util-from-markdown | 2.1.0 | MIT | `license` | scene |
| mdast-util-gfm | 3.1.0 | MIT | `license` | scene |
| mdast-util-gfm-autolink-literal | 2.0.1 | MIT | `license` | scene |
| mdast-util-gfm-footnote | 2.1.0 | MIT | `license` | scene |
| mdast-util-gfm-strikethrough | 2.0.1 | MIT | `license` | scene |
| mdast-util-gfm-table | 2.0.0 | MIT | `license` | scene |
| mdast-util-gfm-task-list-item | 2.0.0 | MIT | `license` | scene |
| mdast-util-phrasing | 4.1.0 | MIT | `license` | scene |
| mdast-util-to-hast | 13.2.1 | MIT | `license` | scene |
| mdast-util-to-markdown | 2.2.0 | MIT | `license` | scene |
| mdast-util-to-string | 4.0.0 | MIT | `license` | scene |
| micromark | 4.0.3 | MIT | `license` | scene |
| micromark-core-commonmark | 2.0.4 | MIT | `license` | scene |
| micromark-extension-gfm | 3.0.0 | MIT | `license` | scene |
| micromark-extension-gfm-autolink-literal | 2.1.0 | MIT | `license` | scene |
| micromark-extension-gfm-footnote | 2.1.0 | MIT | `license` | scene |
| micromark-extension-gfm-strikethrough | 2.1.0 | MIT | `license` | scene |
| micromark-extension-gfm-table | 2.1.2 | MIT | `license` | scene |
| micromark-extension-gfm-task-list-item | 2.1.0 | MIT | `license` | scene |
| micromark-factory-destination | 2.0.1 | MIT | `license` | scene |
| micromark-factory-label | 2.0.1 | MIT | `license` | scene |
| micromark-factory-space | 2.1.0 | MIT | `license` | scene |
| micromark-factory-title | 2.0.1 | MIT | `license` | scene |
| micromark-factory-whitespace | 2.0.1 | MIT | `license` | scene |
| micromark-util-character | 2.1.1 | MIT | `license` | scene |
| micromark-util-chunked | 2.0.1 | MIT | `license` | scene |
| micromark-util-classify-character | 2.0.1 | MIT | `license` | scene |
| micromark-util-combine-extensions | 2.0.1 | MIT | `license` | scene |
| micromark-util-decode-numeric-character-reference | 2.0.2 | MIT | `license` | scene |
| micromark-util-decode-string | 2.0.1 | MIT | `license` | scene |
| micromark-util-edit-map | 1.0.0 | MIT | `license` | scene |
| micromark-util-html-tag-name | 2.0.1 | MIT | `license` | scene |
| micromark-util-normalize-identifier | 2.0.1 | MIT | `license` | scene |
| micromark-util-resolve-all | 2.0.1 | MIT | `license` | scene |
| micromark-util-sanitize-uri | 2.0.1 | MIT | `license` | scene |
| micromark-util-subtokenize | 2.1.0 | MIT | `license` | scene |
| molstar | 5.13.1 | MIT | `LICENSE` | color, scene |
| mutative | 1.3.0 | MIT | `LICENSE` | scene |
| property-information | 7.2.0 | MIT | `license` | scene |
| react | 19.3.1 | MIT | `LICENSE` | preload-helper |
| react-dom | 19.3.1 | MIT | `LICENSE` | index |
| react-markdown | 10.1.0 | MIT | `license` | scene |
| react-use-measure | 2.1.7 | MIT | `LICENSE` | index |
| remark-gfm | 4.0.1 | MIT | `license` | scene |
| remark-parse | 11.0.0 | MIT | `license` | scene |
| remark-rehype | 11.1.2 | MIT | `license` | scene |
| rolldown | 1.2.14 | MIT | `LICENSE` | rolldown-runtime |
| rxjs | 7.8.2 | Apache-2.0 | `LICENSE.txt` | scene |
| scheduler | 0.28.0 | MIT | `LICENSE` | preload-helper |
| space-separated-tokens | 2.0.2 | MIT | `license` | scene |
| style-to-js | 1.1.21 | MIT | `LICENSE` | scene |
| style-to-object | 1.0.14 | MIT | `LICENSE` | scene |
| suspend-react | 0.1.3 | MIT | `LICENSE` | index |
| three | 0.186.1 | MIT | `LICENSE` | index, main |
| trim-lines | 3.0.1 | MIT | `license` | scene |
| trough | 2.2.0 | MIT | `license` | scene |
| tslib | 2.8.1 | 0BSD | `LICENSE.txt` | scene |
| unified | 11.0.5 | MIT | `license` | scene |
| unist-util-is | 6.0.1 | MIT | `license` | scene |
| unist-util-position | 5.0.0 | MIT | `license` | scene |
| unist-util-stringify-position | 4.0.0 | MIT | `license` | scene |
| unist-util-visit | 5.1.0 | MIT | `license` | scene |
| unist-util-visit-parents | 6.0.2 | MIT | `license` | scene |
| use-sync-external-store | 1.7.0 | MIT | `LICENSE` | index |
| vfile | 6.0.3 | MIT | `license` | scene |
| vfile-message | 4.0.3 | MIT | `license` | scene |
| vite | 8.3.4 | MIT | `LICENSE.md` | index, preload-helper |
| zod | 4.6.7 | MIT | `LICENSE` | preload-helper, worker (dynamic-mode worker) |
| zustand | 5.0.15 | MIT | `LICENSE` | index |

### 7.2 Notices inside bundled source files

Mol*, R3F, three.js, immutable and vfile carry code taken from other projects, with the original copyright line in a comment. The comment blocks are copied into section 2 of the notices; this table lists their notice lines (an e-mail address masked).

| Package | File | Notice lines |
|---|---|---|
| @react-three/fiber | `dist/events-e51d7528.esm.js` | Copyright (c) Meta Platforms, Inc. and affiliates. |
| @react-three/fiber | `dist/events-e51d7528.esm.js` | Copyright (c) Meta Platforms, Inc. and affiliates. |
| @react-three/fiber | `dist/events-e51d7528.esm.js` | Copyright (c) Meta Platforms, Inc. and affiliates. |
| immutable | `dist/immutable.es.js` | MIT License ; Copyright (c) 2014-present, Lee Byron and other contributors. |
| molstar | `lib/mol-canvas3d/camera/stereo.js` | Adapted from three.js, The MIT License, Copyright © 2010-2020 three.js authors |
| molstar | `lib/mol-canvas3d/controls/trackball.js` | copyright (c) 2010-2018 three.js authors. MIT License |
| molstar | `lib/mol-canvas3d/passes/bloom.js` | Partially adapted from three.js, The MIT License, Copyright © 2010-2024 three.js authors |
| molstar | `lib/mol-canvas3d/passes/dpoit.js` | Adapted from https://github.com/tsherif/webgl2examples, The MIT License, Copyright © 2017 Tarek Sherif, Shuai Shao |
| molstar | `lib/mol-canvas3d/passes/hi-z.js` | Specialization by Arseny Kapoulkine, MIT License Copyright (c) 2018 |
| molstar | `lib/mol-geo/primitive/cylinder.js` | adapted from three.js, MIT License Copyright 2010-2018 three.js authors |
| molstar | `lib/mol-geo/primitive/polyhedron.js` | adapted from three.js, MIT License Copyright 2010-2018 three.js authors |
| molstar | `lib/mol-gl/shader/cas.frag.js` | MIT Open License |
| molstar | `lib/mol-gl/shader/chunks/apply-light-color.glsl.js` | which under the MIT License, Copyright © 2010-2021 three.js authors |
| molstar | `lib/mol-gl/shader/chunks/dpoit-write.glsl.js` | The MIT License, Copyright 2017 Tarek Sherif, Shuai Shao |
| molstar | `lib/mol-gl/shader/chunks/float-to-rgba.glsl.js` | MIT License, Copyright (c) 2020 Equinor |
| molstar | `lib/mol-gl/shader/chunks/light-frag-params.glsl.js` | which under the MIT License, Copyright © 2010-2021 three.js authors |
| molstar | `lib/mol-gl/shader/chunks/rgba-to-float.glsl.js` | BSD 3-Clause License ; Copyright (c) 2019, Institute for Health Metrics and Evaluation All rights reserved. |
| molstar | `lib/mol-gl/shader/cylinders.frag.js` | The MIT License, Copyright 2016 Inigo Quilez |
| molstar | `lib/mol-gl/shader/fxaa.frag.js` | MIT License Copyright (c) 2017 Simon Rodriguez |
| molstar | `lib/mol-gl/shader/smaa/blend.frag.js` | MIT License Copyright (c) 2010-2020 three.js authors |
| molstar | `lib/mol-gl/shader/spheres.vert.js` | Specialization by Arseny Kapoulkine, MIT License Copyright (c) 2018 |
| molstar | `lib/mol-io/common/binary-cif/decoder.js` | by Alexander Rose <<address>>, MIT License, Copyright (c) 2016 |
| molstar | `lib/mol-io/common/io-buffer.js` | MIT License, Copyright (c) 2015 Michaël Zasso |
| molstar | `lib/mol-io/common/netcdf/reader.js` | MIT License, Copyright (c) 2016 cheminfo |
| molstar | `lib/mol-math/approx.js` | which is ported from https://code.google.com/archive/p/fastapprox/ (BSD licensed) |
| molstar | `lib/mol-math/geometry/molecular-surface.js` | ported from NGL (https://github.com/arose/ngl), licensed under MIT |
| molstar | `lib/mol-math/geometry/primitives/frustum3d.js` | copyright (c) 2010-2022 three.js authors. MIT License |
| molstar | `lib/mol-math/geometry/primitives/plane3d.js` | copyright (c) 2010-2022 three.js authors. MIT License |
| molstar | `lib/mol-math/linear-algebra/3d.js` | copyright (c) 2015, Brandon Jones, Colin MacKenzie IV. |
| molstar | `lib/mol-math/linear-algebra/3d/euler.js` | copyright (c) 2010-2023 three.js authors. MIT License |
| molstar | `lib/mol-math/linear-algebra/3d/mat4.js` | copyright (c) 2015, Brandon Jones, Colin MacKenzie IV. |
| molstar | `lib/mol-math/linear-algebra/3d/quat.js` | copyright (c) 2015, Brandon Jones, Colin MacKenzie IV. ; copyright (c) 2015 Jam3. MIT License |
| molstar | `lib/mol-math/linear-algebra/matrix/evd.js` | The EVD code has been adapted from Math.NET, MIT license, Copyright (c) 2002-2015 Math.NET |
| molstar | `lib/mol-plugin-ui/controls/icons.js` | licensed with https://github.com/Templarian/MaterialDesign/blob/master/LICENSE |
| molstar | `lib/mol-plugin-ui/controls/icons.js` | licensed with https://github.com/mui-org/material-ui/blob/master/LICENSE |
| molstar | `lib/mol-plugin-ui/controls/icons.js` | licensed with https://github.com/twbs/bootstrap/blob/main/LICENSE |
| molstar | `lib/mol-plugin-ui/controls/slider.js` | The MIT License (MIT) ; Copyright (c) 2015-present Alipay.com, https://www.alipay.com/ |
| molstar | `lib/mol-plugin-ui/toast.js` | Adapted from LiteMol (c) David Sehnal |
| molstar | `lib/mol-util/color/distinct.js` | adapted from https://github.com/internalfx/distinct-colors (ISC License Copyright (c) 2015, InternalFX Inc.) |
| molstar | `lib/mol-util/color/lists.js` | Copyright (c) 2002 Cynthia Brewer, Mark Harrower, and The Pennsylvania State University. |
| molstar | `lib/mol-util/color/spaces/hcl.js` | Copyright (c) 2011-2018, Gregor Aisch, BSD license |
| molstar | `lib/mol-util/color/spaces/hsl.js` | Copyright (c) 2011-2018, Gregor Aisch, BSD license |
| molstar | `lib/mol-util/fibonacci-heap.js` | Adapted from https://github.com/gwtw/ts-fibonacci-heap, Copyright (c) 2014 Daniel Imms, MIT |
| molstar | `lib/mol-util/input/input-observer.js` | License: https://creativecommons.org/licenses/by-sa/3.0/ |
| molstar | `lib/mol-util/monadic-parser.js` | Copyright (c) 2011-present J. Adkisson (http://jneen.net). |
| molstar | `lib/mol-util/number-conversion.js` | copyright (c) 2010-2024 three.js authors. MIT License |
| molstar | `lib/mol-util/zip/bin.js` | MIT License, Copyright (c) 2018 Photopea |
| molstar | `lib/mol-util/zip/deflate.js` | MIT License, Copyright (c) 2018 Photopea |
| molstar | `lib/mol-util/zip/zip.js` | MIT License, Copyright (c) 2018 Photopea |
| three | `build/three.core.js` | Copyright 2010-2026 Three.js Authors ; SPDX-License-Identifier: MIT |
| three | `build/three.core.js` | published by Morgan Kaufmann Publishers, (c) 2005 Elsevier Inc., ; under the accompanying license; see chapter 5.1.5 for detailed explanation. |
| vfile | `lib/minpath.browser.js` | Which is licensed: ; MIT License ; Copyright (c) 2013 James Halliday ; Which is licensed: ; Copyright Joyent, Inc. and other Node contributors. |
| vfile | `lib/minproc.browser.js` | "But I don’t think one tiny line of code can be copyrighted." (an author's remark on a one-line excerpt; no licence is named) |

Of note: R3F's `dist/events-*.esm.js` embeds React's reconciler ("@license React", Meta, MIT; covered by the same text as React's own `LICENSE`, also in the notices); Mol*'s colour lists carry ColorBrewer under Apache-2.0 (the full Apache-2.0 text is in the notices through `rxjs/LICENSE.txt`), its GLSL `rgba-to-float` carries a BSD 3-Clause text in full, its icon sets point to the Material Design Icons, MUI and Bootstrap licences by URL only, and `normalizeWheel` in `mol-util/input/input-observer.js` is adapted from a Stack Overflow answer under CC BY-SA 3.0 (P11-LIC-03).

## 8. Findings (P11.3.3)

| Id | Finding | State |
|---|---|---|
| P11-LIC-01 | `@react-three/fiber` 9.8.2 ships no licence file, and no copy of the upstream `LICENSE` exists on this machine (both installed copies and the npm cache hold the same 9.8.2 tarball). The notices carry the standard MIT text with the package.json author and repository, and say the copyright line is to be checked | open for the author (Q1) |
| P11-LIC-02 | Before this pass the web build carried no licence text: no notices file, and the minifier removes every JavaScript comment (the only notices left in the 7 built scripts are three comment blocks inside Mol*'s GLSL shader strings, which survive because they are string content). The MIT, ISC, BSD and Apache conditions on copies were not met by any build that would have been distributed (none was) | fixed: ab9a7ae pin, defe711 change |
| P11-LIC-03 | Mol* 5.13.1 embeds third-party code whose notices exist only in source comments, lost in the bundle: three.js, gl-matrix, chroma.js (BSD), ColorBrewer (Apache-2.0), IHME (BSD 3-Clause), Photopea UZIP, rc-slider (Alipay), Math.NET, NGL, netcdfjs and others; three icon sets licensed by URL only; and a CC BY-SA 3.0 snippet (Stack Overflow answer 30134826). Now copied into the notices. Inference: unmodified redistribution with the attribution and the licence URL meets CC BY-SA 3.0's conditions for that snippet; share-alike would bind an adaptation of it, and Helix does not adapt it | fixed for attribution; the CC BY-SA point is Q3 |
| P11-LIC-04 | The research packages (helix-research, Helix NC research licence) are bundled into the proprietary web build (scientific-core, data-adapters, shared-types, ai-planning). Inference: the author holds the copyright of both and may license the build on other terms (question 98 (a)); no third party's code is in those packages (CLA, `NOTICE.md`) | note |
| P11-LIC-05 | `vendor/fonts/PROVENANCE.md` said the shipped app does not load the vendored fonts; it loads Geist Sans and Geist Mono at rest, and all 15 files are in the build | fixed (doc) |
| P11-LIC-06 | The CC BY 4.0 attributions (UniProt, AlphaFold DB) name the licence without a link to it; the URI is now one click away in the notices | met by Inference; Q2 |
| P11-LIC-07 | The ClinVar attribution says "See the NCBI disclaimer and copyright notice" with no link; the URL is now in the notices. The ClinVar-specific statement is still unread (section 5 item 4) | partly met; Q2; item 4 open |
| P11-LIC-08 | The wordmark's rights are not cleared (answer 98 (a)) | open, author action |
| P11-LIC-09 | Requested citations not displayed: the PDB entries' primary citations and the Open Targets paper (both CC0 sources; courtesy requests, not conditions) | note |
| P11-LIC-10 | The concept prototypes ship in the build with four font families (10 files, 182,324 bytes) that the default page never fetches | note; Q4 |

## 9. Questions for the author

1. **R3F's copyright line (P11-LIC-01).** (a) one free request for the upstream `LICENSE` of pmndrs/react-three-fiber at the 9.8.2 tag before any release, and the generator given that text; (b) accept the standard MIT text with the stated gap. Recommendation: (a), at release time.
2. **Licence links in the cards (P11-LIC-06, -07).** (a) keep as built: the notices, linked from the same Evidence World section, carry the CC BY 4.0 URI and the NCBI policies URL (0 more bytes); (b) render each card's licence id as a link to its licence URL and add the NCBI policies link to the ClinVar attribution (shipped code; bytes to measure against the 25,581 left; S21 and the source map rerun). Recommendation: (a) for Phase 11; (b) if a reviewer reads CC BY 4.0 strictly.
3. **The CC BY-SA 3.0 snippet inside Mol* (P11-LIC-03).** (a) accept: Helix redistributes it unmodified, with the attribution and the licence URL in the notices; (b) raise it with Mol* upstream. Recommendation: (a).
4. **Concept prototypes in public builds (P11-LIC-10).** (a) keep them (they are licensed and attributed; not fetched at rest); (b) leave them out of the Phase 12 build, which removes four font families and a script chunk from the shipped files. Recommendation: decide at Phase 12; no licence issue either way.
5. **Section 5 item 4.** One manual browser visit to the ClinVar data-use page and the RefSeq FAQ to record their statements (free; no script can pass the reCAPTCHA).

The wordmark clearance (answer 98 (a)) is already owed by the author and is not asked again.

## 10. Deferred to P11.5.4 (desktop)

Not built in this pass (P11.5.1 to P11.5.4 come after the web candidate, question 95 (a)). That pass will:

- generate the desktop notices from the crate graph of the built `tauri-shell` (`cargo metadata` of the release build for aarch64-apple-darwin, each crate's licence file from the cargo registry), taking the Tauri crates under their MIT option (98 (a)), and carry the Unicode-3.0, MPL-2.0 (with where the source of those files is available), CDLA-Permissive-2.0, Zlib, BSD-3-Clause, ISC and BSL-1.0 texts of section 6;
- put `THIRD-PARTY-NOTICES` (the web notices of this pass plus the crate notices) and helix-app's licence inside the DMG, and check them in the mounted image;
- confirm the desktop bundles no model (question 96 (a)), the Rust toolchain's licence from the installed toolchain, and $0 for the desktop build (ad hoc signature, question 97 (a)).
