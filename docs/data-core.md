<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# Data core: packages, choices and how to run (Phase 2)

**Status:** Phase 2, 2026-11-01. Covers P2.1 to P2.5. Updated 2026-11-02 for Phase 6 (§10): the ClinVar record and the full-chain residue mapping. The validation results are in `docs/scientific-validation.md`.

## 1. Layout

```
packages/
  shared-types/     Zod schemas and types: entities, coordinates, evidence, provenance, manifest
  data-adapters/    HTTP core, cache, mmCIF reader, source adapters, proprietary-identifier guard
  scientific-core/  mapping, selection, translation, variant, structure mapping, capabilities,
                    evidence rules, drift, and the slice builder (acquire -> build -> manifest)
scripts/data-preparation/
  build-gene.ts     the curated dataset build for any gene with a specification (Node)
  build-hbb.ts      thin wrapper: build-gene.ts --gene hbb
  compare-builds.ts regeneration check
  record-fixtures.ts  records live fixtures in MANIFEST.tsv format
  lib/              Node-only helpers: the build runner, fixture loader, file-system cache store, git state
data/specs/<gene>.json  the gene specification, the only per-gene input (Phase 9)
data/fixtures/hbb/  index.json (fixture name -> file), plus the records fetched in Phase 2
data/curated/hbb/   the curated dataset and manifest.json
```

Dependency direction: `shared-types` <- `data-adapters` <- `scientific-core`. No cycles.

**Why three packages and not one.** The master prompt (§11) asks to split only where a boundary is real. These three are:

- **shared-types** has no I/O and is what the app, the journey engine and the AI action layer will import. It must not pull in fetch code.
- **data-adapters** owns everything that touches the network or a file format. It is the only place where untrusted bodies are parsed.
- **scientific-core** is deterministic logic over parsed records. It knows nothing about HTTP.

Merging them would let UI code import network code by accident. The cost of the split is three `package.json` files.

**Platform rule (amendment A-1).** The three runtime packages use only `fetch`, `AbortController`, `TextEncoder`/`TextDecoder` and Web Crypto. Each package's `tsconfig.json` compiles with `lib: dom` and no Node types, so a Node import fails to typecheck. A test also scans their sources for `node:` imports, `process`, `Buffer` and `require`. Node APIs are used only under `scripts/` and in tests. MD5 is implemented in TypeScript (`md5.ts`) because Web Crypto has none; it is used only to compare against UniProt's published checksum.

## 2. Dependencies

Pinned exactly (`.npmrc` `save-exact=true`), resolved with `npm install --before=2026-10-18`, so every package and transitive dependency was published at least two weeks before 2026-11-01.

| Package | Version | Published | Use |
|---|---|---|---|
| zod | 4.6.7 | 2026-10-12 | runtime schemas (the only runtime dependency) |
| typescript | 6.0.3 | 2026-04-16 | typecheck only (`noEmit`); Node runs `.ts` by type stripping |
| vitest | 5.0.5 | 2026-10-15 | tests |
| vite | 8.3.4 | 2026-10-08 | Vitest peer dependency, pinned explicitly |
| @types/node | 22.20.5 | 2026-10-01 | types for scripts and tests |

TypeScript 7.0.2 (2026-07-08) was not chosen: it is the native-compiler line, and 6.0.3 is enough for typechecking. No build step is needed. Node 22.18+ strips types natively, and Vite and Vitest read `.ts` directly. Sources therefore use erasable syntax only (`erasableSyntaxOnly`) and import with `.ts` extensions.

## 3. mmCIF reader: why a small dedicated parser

`packages/data-adapters/src/mmcif/` is about 400 lines: a CIF 1.1 tokenizer (data blocks, `loop_`, both quote styles with CIF's "quote closes only before whitespace" rule, `;` text fields, comments) and a typed view of the categories HELIX uses: `entry`, `struct`, `exptl`, `refine`, `pdbx_audit_revision_history`, `citation`, `entity`, `entity_poly`, `struct_asym`, `pdbx_poly_seq_scheme`, `pdbx_nonpoly_scheme`, `pdbx_struct_assembly(_gen)`, `struct_ref_seq`, `atom_site` and `pdbx_data_usage`.

Options considered:

- **Mol*'s CIF parser.** Mature and fast, but it is part of the Mol* package, a large dependency that the app will load for rendering anyway. Its integration is being evaluated by another agent (P1.4), so Phase 2 does not take a dependency on it. The structure index the reader produces is plain data, so Mol* can still load the same `2HBS.cif` unchanged.
- **Python preprocessing (Biopython or gemmi).** Biopython 1.88 is locked in `uv.lock` and was used in Phase 1. A Python step cannot run in the browser or the Tauri shell for dynamic mode, so the runtime path cannot depend on it. It remains an independent cross-check: T28 compares the TypeScript contact computation with the Biopython-derived `research/derived/val6_contacts_2HBS.json`, and they match.
- **Dedicated reader (chosen).** It has no dependency, runs everywhere, and parses 2HBS (1 MB) in about 50 ms in Node. Its failure modes are explicit and tested: an unterminated value, a loop whose value count is not a multiple of its columns, a dangling `loop_`, missing required categories, and residues the scheme marks as observed but which have no atoms. That last check catches a file cut exactly at a row boundary.

Limits: one data block, no save frames (model files have none), text form only (no BinaryCIF).

## 4. HTTP core

`packages/data-adapters/src/http/client.ts`:

- **Timeouts:** per attempt, `AbortController`. The default is 30 s; mmCIF and model files get 60 s.
- **Retries:** up to 4 attempts on network errors, timeouts, 429, 500, 502, 503 and 504, and on bodies cut short. Back-off is exponential with jitter: 500 ms x 2^(n-1), capped at 8 s.
- **Retry-After:** honoured when the header is readable, up to 60 s; a longer request fails with `RateLimitedError`. Browsers cannot read Ensembl's headers (none are exposed), so back-off there is blind, as the registry notes.
- **Rate limits:** one token bucket per source, below the documented ceilings. Ensembl 10/s (documented 15/s), NCBI 2/s (documented 3/s), HGNC 5/s (documented 10/s), the others 3/s.
- **Typed errors** (`errors.ts`), each with `code` and `retryable`: `TimeoutError`, `NetworkError`, `AbortedError` (caller cancelled, never retried), `HttpStatusError`, `NotFoundError`, `RateLimitedError`, `MalformedResponseError` (`html-instead-of-json`, `invalid-json`, `empty-body`, `truncated`), `InvalidParameterError`, `ParseError`, `ValidationFailedError`, `ProprietaryContentError`.
- **Malformed bodies:** a body starting with `<` where JSON, FASTA or mmCIF was expected is rejected even with status 200. This covers the HTML error page seen from Ensembl `variant_recoder`. Invalid JSON (the GO `release-date.json` case) is rejected, never repaired.
- **User-Agent:** set only by Node scripts (`helix-research`). Browsers forbid it, and custom headers break the CORS preflight of files.rcsb.org and HGNC, so browser callers send simple GETs. Ensembl's content type goes in the query string.
- **Parameters** are validated before any request (stable-id, rsID, accession and PDB-id patterns; a 10 kb cap on genomic windows).

## 5. Cache

`packages/data-adapters/src/cache.ts`: content-addressed (bodies stored once under their sha256), indexed by source + record id + version (+ request variant). A new version is a new key, so it is a miss, never a stale hit. A body whose hash no longer matches is dropped and reported as a miss. The index holds at most `maxEntries` records (default 500, 200 in the build), evicting the oldest, so it cannot become a bulk mirror. Storage sits behind a 4-method async key-value interface: in memory (tests, browser session) or on the file system (`scripts/data-preparation/lib/node-env.ts`, under `.cache/helix-raw`, git-ignored). IndexedDB and the Tauri file system can implement the same interface later.

The live build stores every raw body there and writes a snapshot (`snapshots/hbb-latest.json`). `--offline` rebuilds from it without network. Raw bodies can contain third-party identifiers (OMIM, HGMD), which is why the cache is local-only and never committed.

## 6. Fixtures

`data/fixtures/hbb/index.json` maps each slice input to a file. Most point at the frozen, redacted Phase 1 snapshot in `research/raw/`, so nothing is duplicated. Two records were fetched live in Phase 2 by `record-fixtures.ts`:

- the E8 genomic window, at the position variant_recoder reports, +/- 20;
- an Ensembl lookup of HBBP1, a pseudogene with no protein, for the capability tests.

The loader takes each file's URL, retrieval time and headers from its folder's `MANIFEST.tsv` and refuses a file whose sha256 matches no manifest row.

`data/fixtures/faah2/` (Phase 9, P9.2.4) is the first set recorded by the builder itself: `build-gene.ts --gene faah2 --record-fixtures` wrote every input of the live build, redacted under Q-H-LIC-1 (`lib/fixture-recorder.ts`: objects and keys naming OMIM/MIM or HGMD removed, the body re-serialised with indent 1 as the Phase 1 snapshot was, the MANIFEST row carrying the new sha256 and the original one in its `redaction` column; a body in which an identifier remains after that fails the recording). The build that records consumes the redacted records, so the curated manifest cites the bytes on disk and a `--fixtures` rebuild differs from it only in timestamps and the generator mode. Two of its eleven records were changed by the redaction: the UniProt entry (one MIM cross-reference) and the HGNC record (`omim_id`).

## 7. Running

```
export PATH=/path/to/node-22/bin:$PATH
npm install                 # exact versions from package-lock.json
npm test                    # offline: unit, fixture, HTTP, plan T01-T32, dataset tests
npm run test:live           # opt-in live smoke (HELIX_LIVE=1)
npm run typecheck
npm run build:hbb           # live build -> data/curated/hbb (24 requests since Phase 6)
node scripts/data-preparation/build-gene.ts --gene hbb --offline     # from the last live snapshot
node scripts/data-preparation/build-gene.ts --gene hbb --fixtures --out /tmp/hbb
node scripts/data-preparation/build-hbb.ts --offline     # the same, through the wrapper
node scripts/data-preparation/build-hbb.ts --fixtures --out /tmp/hbb
node scripts/data-preparation/compare-builds.ts <dirA> <dirB> --cache .cache/helix-raw
node scripts/data-preparation/find-structure-limited.ts [--seed 20261103] [--max-candidates 60] [--min-passing 3]
                                                          # P9.2.4: seeded walk over HGNC ids; report in research/derived/
node scripts/data-preparation/build-gene.ts --gene faah2 --record-fixtures   # live build that also records data/fixtures/faah2/
node scripts/data-preparation/build-gene.ts --gene faah2 --fixtures --out /tmp/faah2
```

The finder makes live requests to HGNC, UniProt and Ensembl REST only, spaced by the HTTP core's per-source limits, with the repository's User-Agent and no other header or identifier; it stops at the first pass once three candidates have passed, or after `--max-candidates` HGNC fetches, and the first pass in sample order is the choice (the others are alternates). `--record-fixtures` is a live-mode option; combined with `--offline` or `--fixtures` it is refused.

On failure the build prints the typed error (code, URL, message), writes nothing (the output is written to a temporary directory and swapped in only at the end) and exits with status 2.

## 8. Curated dataset contents

| File | Record | Main evidence class |
|---|---|---|
| `gene.json` | Gene, interval, HGNC id and aliases, transcript selection record | 2 |
| `transcript.json` | Selected transcript: exons (ranked), UTRs, translation | 2 |
| `sequences.json` | CDS, cDNA, Ensembl protein, forward-strand genomic window, each with sha256 | 2 |
| `protein-P68871.json` | UniProt sequence, versions, md5/crc64, processed chain, kept features, MANE/Ensembl/PDB xrefs, FUNCTION/SUBUNIT/TISSUE SPECIFICITY comments | 2 |
| `variant-hbs.json` | HbS keyed by `NC_000011.10:g.5227002T>A`, all rs334 alleles, HGVS g./c./p., SPDI, codon, translated and mature numbering, VEP consequence, ClinVar summary | 2 (ClinVar), with class 2, 3 and 3 claims for UniProt, the translation and VEP |
| `clinvar-hbs.json` (Phase 6) | The ClinVar record of the HbS allele: version, build, classification, review status, ClinVar's star level, conflict status with its basis, submission count, last evaluated, somatic classifications (none), and the other ClinVar records at rs334 kept separate (haplotypes, another allele) | 2, or 6 when ClinVar reports a conflict |
| `structure-2HBS.json` | Entities (mutation numbering tagged), label/auth chains, assemblies, default assembly, citation, model file hash | 1 |
| `2HBS.cif` | The deposited file, unchanged (CC0), as the render source | |
| `residue-mapping-hbs-2HBS.json` | UniProt 7 -> 2HBS residues with label and auth ids, residue names from atom_site, three cross-checks | 1 |
| `residue-mapping-P68871-2HBS.json` (Phase 6) | Full-chain mapping of record: every SIFTS-mapped position (2 to 147) -> residues on B, D, F, H with label and auth ids, unobserved chains, residue-name agreement with UniProt, four cross-checks | 2 (SIFTS), 1 (atom_site names) |
| `contacts-hbs-2HBS.json` | Inter-chain contacts of the variant side chain (4.5 A, asymmetric unit) | 1, plus a class 4 inference |
| `predicted-model-AF-P68871-F1.json` | AlphaFold model metadata, disclaimer kept, `usableForVariantPlacement: false` | 3 |
| `capabilities.json` | What can be shown, and why (a derived index; it names its source records) | |
| `manifest.json` | Sources with full provenance, file hashes, all validation results, known issues, drift, attribution, nonclinical notice | |

**The structure-limited set, `data/curated/faah2/` (Phase 9, P9.2.4).** FAAH2 (fatty acid amide hydrolase 2, HGNC:26440, ENSG00000165591, MANE Select ENST00000374900.5, UniProt Q6GMR7, 532 aa), chosen by `find-structure-limited.ts` with seed 20261103 (the first pass among 22 sampled HGNC ids; report `research/derived/structure-limited-search-20261103.json`). It contains `gene.json`, `transcript.json`, `sequences.json` (CDS, cDNA, Ensembl protein; no genomic window), `protein-Q6GMR7.json` (no PDB cross-reference, no natural variant kept, initiator Met not annotated as removed, chain 1 to 532), `predicted-model-AF-Q6GMR7-F1.json` (AlphaFold v6, class 3, `usableForVariantPlacement: false`), `capabilities.json` and `manifest.json` (eleven sources from Ensembl, UniProt, HGNC and AlphaFold DB; 21 checks, none failed; one non-fatal drift, UniProt's Ensembl gene cross-reference at version 8 against Ensembl's 9). It lacks, with the capability report's reasons: an experimental structure ("no experimental structure is cross-referenced for this protein"), a verified residue mapping ("no experimental structure to map onto") and a variant highlight ("no reference variant selected"); `transcriptView` and `proteinView` are available, `predictedStructure` is available as a prediction. No structure, mmCIF, residue-mapping, contacts, variant or ClinVar file exists for it, and none is shown.

ClinVar trait names are deliberately not stored. ClinVar aggregates them across submissions, so they are not a list of effects of the variant, and some carry proprietary identifiers. Only the trait count is kept, with that note.

## 9. Deviations from the acquisition plan

- **NCBI `email` parameter:** not sent. The plan lists `tool` and `email`; only `tool=helix-research` is sent, so no personal address ends up in URLs, logs or a browser bundle.
- **ClinVar trait names:** dropped (see §8).
- **UniProt natural variants:** only those at the variant position are kept, plus all Initiator methionine, Chain, Domain, Binding site and Modified residue features.
- **UniProt PDB cross-references:** only the selected entry is kept in the protein record. The capability check counts all of them before filtering.
- **E10 variation** is fetched without `phenotypes=1`. Phenotype text is third-party content and is not used.
- **HGNC** is used for alias resolution (conditional source), as the plan's H1 says. PDBe SIFTS is the mapping of record (conditional source), as the plan's S1 says. See `docs/data-source-registry.md`, "Phase 2 use of conditional sources".

## 10. Phase 6 additions (2026-11-02)

- **ClinVar (P6.1.1).** `ClinvarAdapter.esearchRs(rsId)` (esearch, `term` restricted to an rsID, `tool=helix-research` only) runs before esummary, so the build sees every ClinVar record that cites the rsID. `clinvarReviewStars` (`packages/scientific-core/src/clinvar.ts`) encodes ClinVar's published review-status-to-stars table and returns null for a status it does not know; `clinvarConflicts` reads the conflict status from ClinVar's own words and quotes them. A conflicting status makes the claim class 6 (`classifyClinvarReview`, unchanged). The other records at the rsID are listed with their own classification and review status and are never merged with the allele's record; a haplotype that contains the allele is flagged as such. Trait names stay out.
- **Full-chain mapping.** `mapUniprotChain` (`structure-mapping.ts`) runs the steps of `mapUniprotPosition` for every position SIFTS covers, and records a residue without coordinates as unobserved on its chain instead of failing. The record is a lookup table: consumers (the app's selection bridge) read a row, they never add an offset.
- **Checks T33 to T39** (see `scientific-validation.md` §2): esearch covered by esummary; star level known and conflict status consistent with the evidence class; related records separate; the table covers every SIFTS position on every chain; it equals the HbS record at position 7; residue names equal UniProt except at the variant position; the entity sequence differs from UniProt only where the independent alignment says.
- **Plan vocabulary (ai-planning).** `highlightSequenceRegion` and a one-variant `compareVariants` are in the schema; the v2 prompt and decoding schema are used only by contexts that execute them, and the Phase 3 prompt and default schema are byte-identical (hash test in `packages/ai-planning/test/phase6.test.ts`). The deterministic fallback's Phase 6 rules are gated on the same condition, so the Phase 3 benchmark results stand.
- **Fixtures.** `clinvarSearch` points at the frozen `research/raw/ncbi-clinvar/esearch_rs334.json`; the frozen esummary already held all ten rs334 uids, so the fixture build and the live build now summarise the same set.


## 11. Phase 9 additions (2026-11-03)

- **AlphaFold confidence (P9.1.1).** `parseAlphafoldPrediction` keeps the record's PAE file and image URLs, its pLDDT band fractions, the reviewed flag and the chain id. `alphafoldLocalPlddt(cifText)` reads the per-residue pLDDT from the model file's own `_ma_qa_metric_local` table (the metric named pLDDT in local mode; one contiguous row per residue of model 1) and bands each value with AlphaFold DB's thresholds (`plddtBand`: very high above 90, confident 70 to 90, low 50 to 70, very low below 50). `parseAlphafoldPae` reads the PAE file (one object, a square matrix in model order, its maximum) and refuses a ragged matrix. `AlphafoldAdapter.modelFile` now returns the disclaimer and the local pLDDT together; `AlphafoldAdapter.pae(url)` fetches the PAE file, and both URL guards (`alphafoldUrls.isModelFile`, `isPaeFile`) keep a caller on the two file shapes the prediction record names. Tests: the per-residue mean lands within 0.05 of the record's global value and the band shares equal the record's fractions on P68871; the PAE diagonal is below 1.5 Å and no value exceeds the stated maximum.
- **Fixture.** `research/raw/alphafold/AF-P68871-F1-predicted_aligned_error_v6.json`, recorded by `scripts/data-preparation/record-alphafold-pae.ts` (which reads the PAE URL from the recorded prediction, so the file matches the model on record), with its MANIFEST row; `data/fixtures/hbb/index.json` lists it under `extra.alphafoldPae`.
- **Plan.** `docs/phase-9-generalisation.md` is the Phase 9 plan: the gene specification as the only per-gene input, the adapters to add (Reactome, Open Targets), the five genes, dynamic mode, the variation metric and the order of work.
- **Phase 9: gene specifications and the generic builder (step 2 of the plan).** A gene is now described by a specification, `data/specs/<gene>.json`, validated by `GeneSpecSchema` (`packages/scientific-core/src/slice/spec.ts`): a dataset id and description, the identifiers (Ensembl gene, HGNC symbol, UniProt accession), an optional `pdbId` (the experimental entry selected, absent when none is), an optional `variant` (slug, common name, dbSNP id, forward allele, ClinVar uid; absent when no reference variant is selected), the genomic window flank, the contact cutoff, the AlphaFold switch and optional curator `notes`. The schema is strict (an unknown key is an error) and `parseGeneSpec` refuses any key named world, worlds, chapter, chapters, camera, colour or color at any depth: a specification holds selections, never presentation. `loadGeneSpec` turns it into the builder's `SliceConfig`, in which `pdbId` and `variant` are optional; `HBB_CONFIG` stays exported as the in-code mirror of `data/specs/hbb.json` and a test keeps the two equal. `acquireSlice` makes the variant requests (E8 to E12, C0, C1) only when a variant is selected and the structure requests (P1 to P4, S1) only when an entry is selected; `buildSlice` writes only the records those selections allow (without a structure: no structure, mmCIF, residue mapping or contacts file; without a variant: no variant, ClinVar or genomic-window record, and the protein record keeps no natural variant), and the checks that need both run only when both are selected. The capability report then says what is missing in the specification's terms: `experimentalStructure` and `verifiedResidueMapping` read "no experimental structure selected in the gene specification" (UniProt cross-references are counted but never shown), `variantHighlight` reads "no reference variant selected". A selected structure whose coordinates differ from UniProt at a position no selected variant explains fails T38 and the build is refused. `scripts/data-preparation/build-gene.ts --gene <name> [--offline|--fixtures] [--out <dir>]` is the entry point (`lib/build-gene.ts` holds the runner; `build-hbb.ts` is a wrapper that passes `--gene hbb`); `--fixtures` reads `data/fixtures/<name>/index.json` and the manifest's `generator.script` names `build-gene.ts` whichever entry point ran. Evidence: HBB built from the fixtures before and after the change differs only in timestamps and the generator fields (`compare-builds.ts`, journaled); a test builds a specification without `pdbId` and `variant` from the HBB fixtures and checks the files written and the capability reasons; a lint test fails on any HBB identifier in code under `packages/*/src` outside the in-code mirror and the Phase 7 fallback planner (whose cue tables are generalised with the app in P9.3).
- **Phase 9: the structure-limited gene (P9.2.4).** `scripts/data-preparation/find-structure-limited.ts` (logic in `lib/structure-limited.ts`) samples HGNC ids uniformly in 1..60000 without replacement with a seeded mulberry32 generator (default seed 20261103) and walks them in that order: HGNC fetch by id (`HgncAdapter.hgncId(n)`, new, with `locus_type` now parsed as `locusType`; an unused id is an empty array, not an error), kept only if approved, `locus_type` "gene with protein product", exactly one UniProt id, a non-empty `mane_select` and an Ensembl gene id; then the UniProt entry, kept only if reviewed with no PDB cross-reference; then the Ensembl gene lookup, kept only if `protein_coding` with a MANE Select transcript under `selectTranscript`. The first pass in sample order is the choice; the walk stops at the first pass once three have passed or after 60 HGNC fetches. The report (`research/derived/structure-limited-search-<seed>.json`) lists every id visited with its stage, verdict and reason, the choice, the alternates, the counts by reason, the date and the releases the responses expose (Ensembl `info/data`, UniProt release headers; HGNC exposes none). Run on 2026-11-03: 22 ids visited, 3 passed, 19 skipped (5 unused ids, 4 pseudogenes, 4 long non-coding RNAs, 2 small nucleolar RNAs, 1 immunoglobulin pseudogene, 2 withdrawn entries, 1 gene with 9 PDB cross-references, UBA1); chosen FAAH2, alternates TMTC4 and WSB2. `data/specs/faah2.json` is its specification (no `pdbId`, no `variant`, AlphaFold on; the notes say how and when it was chosen). Tests: the sampler is deterministic (the default seed's first ten ids are pinned), the three verdicts and the walk (stop rule, first pass chosen, no request before the previous stage passed, budget) run on hand-made records with fake adapters; the set builds from its fixtures and its capability file carries the reasons above.
- **Fixture recording for any gene.** `build-gene.ts --record-fixtures` (`lib/fixture-recorder.ts`) writes the live inputs as `data/fixtures/<datasetId>/<source>/<file>` (names from the request URL's path and query, `.json`, `.fa` or `.cif`), one `MANIFEST.tsv` per source in the `record-fixtures.ts` format, and `index.json` in the shape of the HBB index (inputs only, `extra` empty), after the Q-H-LIC-1 redaction (`redactProprietaryIdentifiers` in `packages/data-adapters/src/redaction.ts`: objects whose database field names MIM/OMIM/HGMD, and keys named for them, removed; the scan `findProprietaryIdentifiers` then runs and a remaining hit fails the recording). The sha256 in each row is that of the bytes written; the loader verifies it. Evidence: `data/curated/faah2` (live, recording) against a `--fixtures` rebuild: 7 files compared, 71 allowed differences (timestamps and dependent hashes), one other difference, `manifest.json $.generator.script` live against fixtures.
- **T15 generalised.** `T15-initiator-met-and-chain` assumed an "Initiator methionine, Removed" feature at position 1, which HBB has and FAAH2 (like most entries) does not. The check now passes when a Chain feature exists and either the entry has no Initiator methionine feature (the Met is kept; translated numbering is then the processed numbering) or it annotates the removal at position 1; the detail and the protein record's evidence statement are unchanged for HBB and say "no Initiator methionine feature" and "initiator Met not annotated as removed" for an entry without one.
