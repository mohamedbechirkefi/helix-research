<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# Scientific validation (P2.5.3)

**Status:** Phase 2, updated for Phase 6. **Last run:** live build of `data/curated/hbb/` started 2026-11-02T02:26:08Z from commit `4b30c60` (clean tree), Ensembl 116, UniProt 2026_03, PDB 2HBS revision 1.5 (2026-08-12), ClinVar Build261025-1250.1 (record VCV000015333.184), AlphaFold DB model v6. Journal: HX-P6-2026-11-02-hbb-rebuild. The Phase 2 run (2026-11-01T19:27:28Z, 46 checks) is HX-P2-2026-11-01-hbb-dataset-build.

> **Commit hashes after the history rewrite (note added 2026-11-02, resolved the same day).** On 2026-11-01 the public history was rewritten to remove an email address (see `paper/report.en.md`, chapter 11). The Phase 2 build recorded `0692bff` as its generator commit (and `aeb7b43` for an earlier pair of builds); both are from before the rewrite and are not on `main`, where the same commits are `3b89a9a` and `701cd57`. The Phase 6 rebuild replaced that manifest: `generator.gitCommit` is now `4b30c60`, which is on `main`. The Phase 2 hashes are kept here only to identify the earlier runs.

Every value quoted in the "Last result" column is copied from `data/curated/hbb/manifest.json` (`validation[].detail`), which the build script wrote from the live responses. Nothing in this document is typed from memory.

## 1. How validation works

- **Two layers.**
  1. The **build checks** run inside `buildSlice` (`packages/scientific-core/src/slice/build.ts`) on every build, live or offline. Their results are stored in the manifest and in the `provenance.validation` of each record they concern.
  2. The **test suite** (`npm test`) runs the 32 deterministic tests of `research/hbb-acquisition-plan.md` §7 against the frozen fixtures, plus unit, HTTP, cache, parser and dataset tests.
- **Fail closed.** Any failed error-level build check throws `ValidationFailedError`. The build script then writes nothing and exits with status 2. There is no partial dataset and no silent fallback.
- **Warnings never block.** Version drift between resources is recorded (`manifest.drift`), never fatal. HELIX compares sequences and versioned identifiers, not entry versions.
- **Raw bodies are hashed.** Every input body must hash to the sha256 recorded at retrieval before anything is parsed (`T29-raw-sha256`). Each record's provenance carries that hash.
- **Proprietary identifiers are blocked.** The build scans every curated JSON record for OMIM/MIM and HGMD identifiers and refuses to write if it finds one (author decision Q-H-LIC-1).

## 2. Build checks and their last result

All 53 checks passed in the last live run (0 failed, 0 warnings): the 46 Phase 2 checks and T33 to T39 (Phase 6, last table).

### Identity, assembly and transcript

| Check | What it verifies | Why | Last result |
|---|---|---|---|
| T01-gene-identity | The lookup returns the configured gene id and symbol | Guards against a wrong or redirected record | ENSG00000244734.6 HBB |
| assembly-grch38 | The gene and Ensembl's default coordinate system are GRCh38 | HELIX displays GRCh38 only (scientific model §1) | gene GRCh38; Ensembl default GRCh38 (GRCh38.p14) |
| T02-transcript-selection | The rule picks the single MANE Select transcript | The transcript is never inferred from length or order (pitfall 8) | mane_select: ENST00000335295.4 (only transcript with MANE[].type == MANE_Select); 19 candidates |
| transcript-lookup-matches-selection | The detailed transcript lookup is the selected id and version | Catches version drift between the gene and transcript calls | ENST00000335295.4 |
| T04-hgnc-resolution, T04-alias-* | HGNC symbol and every alias resolve to the same Ensembl gene | Alias resolution must not land on another gene | HBB -> HGNC:4827 ENSG00000244734; alias beta-globin -> ENSG00000244734; alias CD113t-C -> ENSG00000244734 |
| uniprot-accession | UniProt returns the configured, reviewed accession | | P68871 HBB_HUMAN, reviewed true |
| uniprot-mane-xref | UniProt's MANE-Select cross-reference names the same transcript, protein and RefSeq | Three resources agree on the reference | ENST00000335295.4 / ENSP00000333994.3 / NM_000518.5 |

### Coordinates and sequence

| Check | What it verifies | Why | Last result |
|---|---|---|---|
| T05-exon-lengths-sum | Exon lengths sum to the transcript length | Confirms the 1-based closed convention | 628 vs 628 |
| fasta-ids-versioned | FASTA headers carry the versioned ids of the selection | Sequences belong to the selected versions | ENST00000335295.4, ENST00000335295.4, ENSP00000333994.3 |
| T06-cds-length, T06-cds-shape | CDS length equals the exon walk and (protein + stop) x 3; starts ATG, ends with a stop | Exon structure and sequence agree | CDS 444 nt; exon walk 444; starts ATG, ends TAA |
| cdna-length | cDNA length equals the transcript length | | 628 vs 628 |
| T07-translation-equals-ensembl-protein, T07-translation-equals-uniprot, T07-uniprot-md5 | Translate(CDS) equals ENSP and UniProt; the md5 computed here equals UniProt's | The protein is the transcript's product, by sequence not by name | 147 aa = 147 aa = 147 aa; md5 209D686939D0B8D1EA089368150140E2 both |
| T08-exon-walk-genomic | Own exon walk of c.20 equals the HGVS g. position and the Ensembl variation position | HELIX's coordinate code is checked against two sources | c.20 -> 5227002; hgvsg 5227002; variation 5227002 |
| T08-codon-span | Own walk of codon 7 equals Ensembl `map/cds` | Reverse-strand codon mapping | 5227001-5227003 both, strand -1 |
| T09-forward-and-coding-base | The forward-strand base in the E8 window equals the HGVS g. reference, and its complement equals the CDS base | Strand flip on a reverse-strand gene (pitfall 5) | base at 5227002 = T; c.20 = A |
| T10-spdi-roundtrip | SPDI (0-based) and HGVS g. (1-based) convert into each other | 0-based sources sit next to 1-based ones (pitfall 6) | NC_000011.10:5227001:T:A <-> NC_000011.10:g.5227002T>A |

### Variant

| Check | What it verifies | Why | Last result |
|---|---|---|---|
| T13-rsid-multiallelic | The rsID has several alleles and only the configured one gives the variant's amino acid | rs334 alone is not HbS (pitfall 4) | rs334 alleles T/A/C/G; A:p.Glu7Val, C:p.Glu7Gly, G:p.Glu7Ala |
| T11-codon-change | Applying c.20A>T to the CDS changes the codon and the amino acid | | codon 7 GAG -> GTG; E -> V |
| T12-hgvsp-agrees | The p. string computed by translation equals variant_recoder's for ENSP and NP | Own computation vs source strings | computed p.Glu7Val; ENSP00000333994.3:p.Glu7Val, NP_000509.1:p.Glu7Val |
| T12-vep-agrees | VEP protein position, CDS position, amino acids and p. agree | | protein_start 7, cds_start 20, codons gAg/gTg |
| cdna-position | c. position + 5' UTR length equals VEP's cDNA position | | 20 + 50 = 70; VEP 70 |
| T18-hgvsp-equals-uniprot-position | The UniProt residue at the p. position is the HGVS reference residue | HGVS p. and UniProt share translated numbering | p.7: UniProt E, HGVS ref E |
| T15-initiator-met-and-chain | UniProt annotates the initiator Met as removed and a processed chain | Mature numbering exists only because of this | Initiator methionine 1 "Removed"; Chain 2-147 |
| T17-mature-index | The mature index is derived from the Chain feature | "Glu6Val" is produced by a function, never typed | mature index of 7 = 6 (Glu6Val (mature numbering)) |
| T16-uniprot-natural-variant | A UniProt natural variant at the position has the same ref/alt and cites the rsID | Independent annotation of the same allele | VAR_002863 at 7: E->V; dbSNP:rs334 |
| T14-clinvar-record | The ClinVar record is a single variant (not a haplotype), its SPDI equals the allele's, and its GRCh38 position matches | ClinVar is keyed to the allele, not the rsID | VCV000015333.184 (Phase 2: .183); SPDI NC_000011.10:5227001:T:A; GRCh38 5227002; GRCh37 5248232; Pathogenic (criteria provided, multiple submitters, no conflicts) |

### Structure and mapping

| Check | What it verifies | Why | Last result |
|---|---|---|---|
| structure-entry, structure-revision-agrees | Entry id, method and resolution; the Data API and the mmCIF report the same revision | The file and the metadata describe the same version | 2HBS X-RAY DIFFRACTION 2.05 A, rev 1.5 in both |
| T20-entity-by-sifts, T20-rcsb-entity-agrees | The entity is chosen by SIFTS accession; its chains equal the mmCIF strands; RCSB agrees | Never by description string | SIFTS P68871 -> entity 2, chains B,D,F,H; RCSB 2HBS_2 uniprot P68871 |
| T21-alignment-cross-check | A global alignment of the entity sequence to UniProt gives the same offset as SIFTS, identity >= 0.95 | Independent check of the mapping of record | offset 1, identity 0.9932, one mismatch: entity 6 V / UniProt 7 E; SIFTS offset 1 |
| T22-rcsb-align-agrees | RCSB `rcsb_polymer_entity_align` gives the same offset | Third agreeing source | ref_beg 2 <-> entity_beg 1 |
| T23-residue-from-atom-site | Every mapped chain has the residue in atom_site, and the residue name is read there | The highlight targets deposited coordinates | B, D, F, H: label 6 = auth 6, VAL; the structure carries the alternate residue |
| T24-wrong-numbering-detectable | The wrong numberings land on different residues | A mis-numbered highlight is detectable | label 7 in B is GLU (not VAL); UniProt position 6 is P (not E) |
| T25-struct-ref-seq-not-trusted | The selection follows SIFTS; what `_struct_ref_seq` would select is recorded | The file's own reference numbering is mature (pitfall 2) | SIFTS selects label 6 (VAL); `_struct_ref_seq` would select label 7 (GLU); 4 disagreements recorded as known issues |
| T19-pdbx-mutation-numbering | The numbering of `_entity.pdbx_mutation` is inferred from the sequence, not assumed | "E6V" is mature numbering | "E6V VARIANT" -> mature/legacy |
| T26-label-auth-kept | Every label chain has an auth chain id from the scheme tables | label = auth is not a rule (pitfall 3) | 24 label chains, all with an auth id; 16 non-polymer chains have label != auth (e.g. label I = auth A HEM 153) |
| T27-assemblies | The mmCIF assemblies match the RCSB assembly record | The default scene uses the assembly holding the first mapped chain | assembly 1: A,B,C,D (+ I-L, Q-T); assembly 2: E,F,G,H (+ M-P, U-X) |
| T28-contacts-computed | Inter-chain contacts of the variant side chain within 4.5 A, asymmetric unit | Shows where the variant residue touches another chain | B6: none; D6: none; F6: none; H6: B70, B73, B84, B85, B88 |

### Phase 6: ClinVar review status and the full-chain mapping

| Check | What it verifies | Why | Last result |
|---|---|---|---|
| T33-clinvar-search-covered | The esummary covers exactly the uids that esearch returned for the rsID, and esearch returned all of them | The related records are complete, not a sample | esearch rs334: 10 uids; esummary returned the same 10 |
| T34-clinvar-review-status | The review status has a star level in ClinVar's table, and the conflict status agrees with the evidence class (class 6 if conflicting) | A conflict is never shown as an agreed classification | "criteria provided, multiple submitters, no conflicts" -> 2 stars; conflicting false; class 2 |
| T35-clinvar-related-records-separate | Other records at the rsID are not the allele's record; another allele's record does not contain this allele | Haplotypes and other alleles are never merged with HbS | 9 other records: 8 haplotypes that include the HbS allele with another variant; 1 other allele (VCV000015175.3, Likely benign) |
| T36-full-chain-covers-sifts | Every SIFTS-mapped position has a row, on every mapped chain | No silent gap in the table | 146 positions (2-147); B, D, F, H 146/146 each; 0 unobserved |
| T37-full-chain-agrees-with-variant-mapping | The table row at the variant position equals the HbS mapping record | Two records from the same SIFTS data must agree | position 7: B6, D6, F6, H6 VAL in both |
| T38-full-chain-residue-names | atom_site residue names equal UniProt everywhere except at the variant position, where the structure carries the alternate residue | A shifted mapping would put many names out of step | equal at 145 of 146; differs at 7 (UniProt E, structure VAL) |
| T39-full-chain-alignment-agrees | Positions where the entity sequence differs from UniProt are those the independent alignment reports | Second, independent check of the whole table | 7 in both |

### Predicted model, drift

| Check | What it verifies | Why | Last result |
|---|---|---|---|
| T32-alphafold-labelled | The AlphaFold model matches UniProt by md5 and carries the reference residue | A prediction is never used to place the variant (§5) | AF-P68871-F1 v6; md5 match true; residue 7 in model = E (reference) |
| T31-drift-recorded | Version drift is recorded, not fatal | Same-day version lag across resources (pitfall 7) | ENSG00000244734.5 (UniProt xref) vs .6 (Ensembl); P68871.216 (VEP) vs .219 (UniProt) |

## 3. Known issues recorded by the last build

- `struct-ref-seq-numbering-2HBS-{B,D,F,H}` (warning): `_struct_ref_seq` db_align_beg..end = 1..146 for P68871, SIFTS unp_start..unp_end = 2..147. SIFTS is the mapping of record.
- `label-auth-chain-ids-differ-2HBS` (info): 16 non-polymer label chains have another auth chain id (the eight hemes I-P are auth A-H 153; the waters Q-X are auth A-H).

## 4. Regeneration evidence (P2.5.1; repeated for Phase 6)

**Phase 6 (2026-11-02, HX-P6-2026-11-02-hbb-rebuild).** Build 1 from `4b30c60`, committed as `0826e68`; build 2 from `0826e68` (same build code; only a dataset test differs) two minutes later, compared with `compare-builds.ts --cache .cache/helix-raw`: 14 files compared; 2 byte-identical (`2HBS.cif`, `capabilities.json`); 219 allowed differences (timestamps and the hashes that depend on them, one raw-body hash explained by HGNC's `responseHeader.QTime`); 1 other difference, `generator.gitCommit` (the two commits differ by a test file only; the script exits 1 on it). Against the Phase 2 build, every Phase 2 record is identical in content except the ClinVar version (.183 -> .184) and supporting-submission count (74 -> 75) in `variant-hbs.json`; seven Ensembl raw bodies changed bytes, and the two compared field by field parse to identical JSON.

**Phase 2 (2026-11-01).** The dataset was built live twice in a row from the same commit (`0692bff`) and compared with `scripts/data-preparation/compare-builds.ts --cache .cache/helix-raw`:

- 12 files compared; 2 byte-identical (`2HBS.cif`, `capabilities.json`).
- 193 differences, all allowed: retrieval and validation timestamps, and the manifest hashes and sizes of the 9 record files that embed those timestamps.
- 0 other differences.
- An earlier pair of live builds (commit `aeb7b43`) differed in one raw-body hash: HGNC's Solr response carries a per-request timer, `responseHeader.QTime` (1 vs 0). The comparison script now accepts such a difference only after loading both cached bodies and finding them identical once that documented field is removed.

## 5. Test suite (last run)

`npm test` (2026-11-02, after the D-H007 follow-up filter): 15 test files (14 run, 1 opt-in live file skipped), 221 tests. 217 pass, and 4 are skipped: the opt-in live smoke tests. (Phase 6 build: 14 files, 181 tests, 177 pass.) `npm run test:live` ran them on 2026-11-02T02:49:27Z: 4 of 4 passed, including the new ClinVar rs334 test (HX-P6-2026-11-02-clinvar-live-smoke). (Phase 2: 9 files, 113 tests, 110 pass, 3 live skipped and passed on 2026-11-01; Phase 3 added the ai-planning files, Phase 6 `packages/ai-planning/test/phase6.test.ts`, D-H007 `packages/ai-planning/test/followups.test.ts`: 40 tests of the follow-up suggestion filter on suggestions recorded in earlier runs, including the clinical one of Phase 5.)

| File | What |
|---|---|
| `packages/shared-types/test/schemas.test.ts` | Schema round-trips and rejections (coordinates, versions, provenance, ResidueRef, manifest) |
| `packages/data-adapters/test/http.test.ts` | Real local HTTP server: timeout, 429 with Retry-After, 5xx back-off, 404, HTML instead of JSON, invalid JSON, empty and cut bodies, cancellation; token bucket |
| `packages/data-adapters/test/cache.test.ts` | Cache hit, miss, version invalidation, source invalidation, corruption, eviction |
| `packages/data-adapters/test/mmcif.test.ts` | CIF syntax, truncation at three points, 2HBS categories |
| `packages/data-adapters/test/adapters.test.ts` | Each adapter against recorded fixtures through HttpClient; parameter validation; proprietary-identifier guard |
| `packages/data-adapters/test/live.test.ts` | Opt-in live smoke: ENSG00000244734, P68871, 2HBS + SIFTS |
| `packages/scientific-core/test/hbb-plan.test.ts` | T01-T32 of the acquisition plan |
| `packages/scientific-core/test/core.test.ts` | Evidence classes, capabilities (including HBBP1, a pseudogene with no protein and no structure), acquisition orchestration and graceful errors, no Node APIs in runtime packages, SPDX headers |
| `scripts/data-preparation/test/dataset.test.ts` | Build determinism; committed dataset hashes, schemas, absence of proprietary identifiers, the HbS mapping table; Phase 6: the ClinVar record and the full-chain table of the committed dataset, generator commit and clean tree |

## 6. Not verified here

- Symmetry-mate contacts of the Val6 residues in chains B, D and F. Only the asymmetric unit is used. The contacts record labels the possibility as class 4 (inference).
- Behaviour of CORS on error responses (429, 5xx) in a real browser. The HTTP core is tested in Node only.
- Whether Mol* selects by label or auth ids by default (P1.4.1, another agent).
- The HGVS normaliser for indels: not written. Only substitutions are resolved (scientific model §5).
