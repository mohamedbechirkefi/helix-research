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
  build-hbb.ts      the curated dataset build (Node)
  compare-builds.ts regeneration check
  record-fixtures.ts  records live fixtures in MANIFEST.tsv format
  lib/              Node-only helpers: fixture loader, file-system cache store, git state
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

## 7. Running

```
export PATH=/path/to/node-22/bin:$PATH
npm install                 # exact versions from package-lock.json
npm test                    # offline: unit, fixture, HTTP, plan T01-T32, dataset tests
npm run test:live           # opt-in live smoke (HELIX_LIVE=1)
npm run typecheck
npm run build:hbb           # live build -> data/curated/hbb (24 requests since Phase 6)
node scripts/data-preparation/build-hbb.ts --offline     # from the last live snapshot
node scripts/data-preparation/build-hbb.ts --fixtures --out /tmp/hbb
node scripts/data-preparation/compare-builds.ts <dirA> <dirB> --cache .cache/helix-raw
```

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

