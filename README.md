# Helix: research

Helix is a nonclinical, research-grounded exploration of genes, variants and proteins, in which real public scientific data drives an interactive environment. This repository is its public research core:

- **data preparation:** gene specifications, a generic builder and the curated datasets it writes, each with a provenance manifest;
- **data adapters** for the public resources (Ensembl, UniProt, RCSB PDB, PDBe SIFTS, NCBI ClinVar, HGNC, AlphaFold DB, Reactome, Open Targets);
- **the scientific core:** identifier, coordinate and residue mapping, validation checks, shared typed entities;
- **AI planning:** the typed action-plan schema, the prompts, the rule-based planner and the model providers, and the benchmarks that evaluated free models for grounded action plans;
- **the technical report** in English and French, with its claims register and the experiment journal.

The product (the web application and the macOS desktop shell) is the separate, private helix-app repository. It consumes this repository's packages and curated data at a pinned commit (see [Use by helix-app](#use-by-helix-app)).

**Not medical:** Helix is not a clinical diagnostic, variant classification or medical advice tool, and it never collects personal genetic or health data.

**Zero spend:** everything here runs on free software, free public data and free models.

## Status

**Phase 12, portfolio showcase** ([`docs/phase-12-showcase.md`](docs/phase-12-showcase.md)). The app's build of record (helix-app e37efee) consumes this repository at the research pin 829a207, with every judged check passing, research tests and typecheck included (helix-app `docs/reviews/phase-12-bor.md`, check S5). Static hosting of the app was assessed in [`docs/phase-12-hosting.md`](docs/phase-12-hosting.md) and is not deployed; publication waits for the author's verdict at the Phase 12 gate.

The phase history and the current task are in the workspace's `ROADMAP.md` and `PROGRESS.md`, one folder above this repository.

## Repository layout

```
packages/
  shared-types/        typed scientific entities (Zod)
  data-adapters/       HTTP core with per-source rate limits, one adapter per public resource, the mmCIF reader, redaction
  scientific-core/     identifier, coordinate and residue mapping, gene specifications, the slice builder, validation checks
  ai-planning/         action-plan schema and validation, prompts, routing, the rule-based planner, model providers
scripts/
  data-preparation/    build-gene.ts (and the build-hbb.ts wrapper), compare-builds.ts, fixture recording, finders
  ai-benchmark/        benchmark runs, scoring and reports
  report/              French parity and link checks for the report (Python)
  research/            research scripts (Python): raw captures and cross-checks
data/
  specs/               one gene specification per curated set
  curated/             the curated sets: brca1, cftr, faah2, hbb, slc6a3
  fixtures/            the recorded inputs of each set, for offline rebuilds and tests
docs/                  research, data core, validation, benchmark, registry and phase plans
paper/                 report.en.md, report.fr.md, claims.md
journal/               the experiment journal and its raw result files
research/              Phase 1 notes, raw captures, benchmark material, risk register
licenses/              the MIT text of the initial commit
```

## Prerequisites

- **Node.js 22.18 or later** (`engines` in `package.json`). The clean-clone check below used Node 22.23.3 and npm 10.9.9.
- **git**, and network access to the npm registry for the first install.
- Optional: [uv](https://docs.astral.sh/uv/) for the Python research and report scripts, which run in the environment locked by `uv.lock`.
- Optional: network access to the public APIs, for the live tests and the live rebuilds.

## Build and test from a clean clone

These are the commands of the clean-clone check made for P12.2.1 (2026-11-15), run from a fresh `git clone`; each exited 0. They run offline after the install.

```
git clone <helix-research repository URL> helix-research
cd helix-research
npm ci
npm test                  # unit and scientific validation tests from the fixtures: 578 passed, 5 skipped
npm run typecheck         # tsc over every package and the scripts
npm run build:gene -- --gene hbb --fixtures --out <scratch folder>/hbb   # rebuilds the HBB set from its recorded fixtures
```

The five skipped tests are the live tests; the test counts are the same as at the app's build of record (S5 in helix-app `docs/reviews/phase-12-bor.md`).

Commands that use the network, not run in the clean-clone check:

```
npm run test:live         # HELIX_LIVE=1: the live API tests
npm run build:hbb         # live rebuild of data/curated/hbb (a wrapper around build-gene.ts --gene hbb)
npm run build:gene -- --gene <name>   # live build of any gene with a data/specs/<name>.json
npm run bench:ai -- --provider ollama --model <model>   # AI benchmark run against a local Ollama (--provider deterministic needs no model)
```

`npm run compare:hbb -- <dirA> <dirB>` (`scripts/data-preparation/compare-builds.ts`) compares two builds of a set and reports every difference. How to run each builder and what it checks is in [`docs/data-core.md`](docs/data-core.md).

## The data

- **Curated sets.** Five genes are curated under `data/curated/`: BRCA1, CFTR, FAAH2, HBB and SLC6A3. Each set is built by script from its specification in `data/specs/` and is never edited by hand. Its `manifest.json` lists every file with its sha256 and records the source, identifier and version, retrieval date and transformations behind each record. The app verifies each file against that sha256 before using it.
- **Fixtures.** `data/fixtures/` holds the recorded inputs of each set, so a set can be rebuilt and tested offline. Identifiers from sources Helix may not redistribute (for example OMIM or HGMD) are removed from fixtures and curated data when they are recorded.
- **Validation.** Every scientific check and its last result is in [`docs/scientific-validation.md`](docs/scientific-validation.md); the coordinate and residue mapping model is in [`docs/scientific-model-and-coordinate-mapping.md`](docs/scientific-model-and-coordinate-mapping.md).
- **Data-source registry.** [`docs/data-source-registry.md`](docs/data-source-registry.md) records, for each public resource, the release seen, the documented rate limit, the measured browser CORS behaviour and the data licence. Licence, attribution and cost for every dependency and data source are in [`docs/license-attribution-cost-audit.md`](docs/license-attribution-cost-audit.md).

## The report

- [`paper/report.en.md`](paper/report.en.md): the detailed technical report, English master, drafted as the work happened. Its header table gives the version and which sections are drafted.
- [`paper/report.fr.md`](paper/report.fr.md): the full French copy, with the same numbers and claims.
- [`paper/claims.md`](paper/claims.md): the claims register. Every claim in the report has a row with its evidence (C01 to C198 as of 2026-11-15).
- `journal/`: the experiment journal that the report and the register cite.

The rules (no claim without a row, no untraceable number, negative results reported, bilingual parity) are in [`paper/README.md`](paper/README.md). Publishing the report or an article is the author's decision.

## Use by helix-app

helix-app links `@helix/shared-types`, `@helix/data-adapters`, `@helix/scientific-core` and `@helix/ai-planning` as local `file:` dependencies on a checkout of this repository in a sibling folder named `helix-research`, and copies the curated sets from `data/curated/` into its web build. It records the pinned commit of this repository and checks, before a build of record, that `packages/` and `data/curated/` have not changed since that commit. Scientific fixes are made here, under these tests, and reach the app when it moves its pin.

For the app, run `npm ci` here before installing or building helix-app: the linked packages resolve their imports of each other through this repository's `node_modules`.

The runtime packages use only web APIs (`fetch`, Web Crypto and similar), so the same code runs in Node, in the browser and in the desktop webview ([`docs/data-core.md`](docs/data-core.md)).

## Documentation

| Document | What |
|---|---|
| [`docs/scientific-research.md`](docs/scientific-research.md) | Phase 1 scientific research |
| [`docs/competitor-analysis.md`](docs/competitor-analysis.md) | Existing tools compared |
| [`docs/rendering-integration-decisions.md`](docs/rendering-integration-decisions.md) | Rendering and platform decisions, AI feasibility per platform |
| [`docs/data-core.md`](docs/data-core.md) | Data core: layout, choices, how to run |
| [`docs/scientific-validation.md`](docs/scientific-validation.md) | Every scientific check and its last result |
| [`docs/ai-model-benchmark.md`](docs/ai-model-benchmark.md) | Free-model benchmark for grounded action plans |
| [`docs/phase-9-generalisation.md`](docs/phase-9-generalisation.md), [`docs/phase-10-ai-explorer.md`](docs/phase-10-ai-explorer.md), [`docs/phase-11-release-qa.md`](docs/phase-11-release-qa.md), [`docs/phase-12-showcase.md`](docs/phase-12-showcase.md) | Phase plans from Phase 9 on |
| [`docs/phase-12-hosting.md`](docs/phase-12-hosting.md) | The static hosting assessment (not deployed) |
| [`docs/data-source-registry.md`](docs/data-source-registry.md), [`docs/license-attribution-cost-audit.md`](docs/license-attribution-cost-audit.md) | Data sources, licences, attribution and cost |

## License

Source-available for non-commercial research under the [Helix Source-Available Non-Commercial Research License v1.0](LICENSE). This is a custom license, not OSI open source. In short, and the LICENSE text governs: you may access, download, reproduce, compile, run, test, benchmark, analyse and locally modify the licensed material for non-commercial research use, and publish your own findings and measurements without reproducing substantial protected code. Commercial use, incorporation into other products, and publishing, mirroring or redistributing copies or modified versions are not permitted without separate written authorization.

The repository's initial commit (859ed93) was published under the MIT License, and that grant is not revoked. [NOTICE.md](NOTICE.md) says which material is under which license, and [LICENSE_HISTORY.md](LICENSE_HISTORY.md) gives the history. Data from public scientific resources keep their providers' terms and are not relicensed here.

Contributions are welcome under the [CLA](CLA.md); see [CONTRIBUTING.md](CONTRIBUTING.md).
