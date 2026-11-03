# HX-P9-2026-11-03-generic-builder: the curated-dataset builder generic over a gene specification (plan §10 step 2)

```yaml
id:            HX-P9-2026-11-03-generic-builder
date:          2026-11-03
phase:         P9 (step 2 of docs/phase-9-generalisation.md: one builder, HBB one instance of it)
hypothesis:    The scientific core was already configuration-driven; moving the HBB selections into a gene specification file, making the experimental entry and the reference variant optional, and routing both entry points through one runner changes no byte of the HBB output except the generator fields, and a specification without a structure or a variant builds an honest set whose capability report names what is missing.
git_commit:    helix-research (this commit), on eeecc17
config:        implemented by a delegated agent from a written brief (plan §2, §9, §10), verified by the coordinator: full test suite, typecheck, git status of data/curated, scans; byte-identity by scripts/data-preparation/compare-builds.ts between a fixtures build with the old script before the change and a fixtures build with the new script after it; no live request
seed:          n/a
data_version:  the recorded HBB fixtures (data/fixtures/hbb/index.json)
hardware:      the development Mac
duration:      about 20 minutes of agent time plus verification
cost:          0
```

## What changed

- `data/specs/hbb.json`: the HBB selections as data (dataset id, description, Ensembl, HGNC and UniProt identifiers, the 2HBS entry, the HbS variant selection, the flank, the contact cutoff, AlphaFold on, a notes string).
- `packages/scientific-core/src/slice/spec.ts`: `GeneSpecSchema` (strict objects, identifier patterns), `parseGeneSpec` (rejects any key named world, worlds, chapter, chapters, camera, colour or color at any depth before the schema runs), `loadGeneSpec` to a `SliceConfig`, `specOf` as the inverse. `HBB_CONFIG` stays as the in-code mirror (the core does no file I/O) and a test proves it equals the file.
- `SliceConfig.pdbId` and `.variant` optional; `acquire.ts` skips the requests that need them; `build.ts` scopes the variant and structure sections and runs the checks that need both only when both are selected; `capabilities.ts` reports experimentalStructure, verifiedResidueMapping and variantHighlight as unavailable with reasons that name what the specification did not select.
- `scripts/data-preparation/build-gene.ts --gene <id> [--offline|--fixtures] [--out]` with the runner in `lib/build-gene.ts`; `build-hbb.ts` is a wrapper; `--fixtures` reads `data/fixtures/<gene>/index.json`.
- A lint test: no file under `packages/*/src` contains the HBB identifiers outside `slice/types.ts` and one allow-listed Phase 7 fallback-planner file (`ai-planning/src/fallback.ts`, cue regex and a clarification string); the allow-list must stay exact.

## Measurements

| Check | Result |
|---|---|
| compare-builds, old script before against new script after (fixtures) | 14 files; 158 allowed timestamp differences; 2 other differences, both generator fields (`script` name, `gitDirty` true for the uncommitted tree); record `journal/results/compare-hbb-build-gene-2026-11-03.txt` |
| compare-builds, wrapper against new script | 14 byte-identical files, 0 differences |
| HBB build checks | 53 checks, 0 failed, 0 warnings, 5 known issues, 2 drift reports (as before) |
| A specification without `pdbId` and `variant` built from the HBB fixtures (test) | 7 files only (capabilities, gene, manifest, predicted model, protein, sequences, transcript); no structure, contacts, variant, ClinVar or mapping file; sources ensembl, uniprot, hgnc, alphafold; capability reasons name the missing selections |
| Tests, typecheck | 302 pass, 4 live skipped (288 before); typecheck clean |
| `data/curated/hbb` | 0 changes |

## Interpretation

Step 2 of the plan holds. One rule the agent surfaced and I keep: with a structure selected and no variant, every mapped position is checked against the coordinates (T38), so an entry carrying an engineered mutation needs either a variant selection or a T38 refinement; the build refuses rather than relaxes. The next steps (P9.2.4, the structure-limited gene) build on the no-structure path exercised here.

## Failures

None in the runs. The agent changed one ClinVar error-message example ("such as rs334" to "rs followed by digits") so the identifier lint holds; accepted.
