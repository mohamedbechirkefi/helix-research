<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HBB data acquisition plan (P1.8.1)

**Status:** plan for Phase 2 (P2.2–P2.4). **Identifiers verified against live APIs:** 2026-11-01 (raw responses in `research/raw/`, manifests with sha256).

- **Inputs:** `research/hbs-mapping-note.md` (facts), `docs/scientific-model-and-coordinate-mapping.md` (conventions), `docs/data-source-registry.md` (terms, limits, CORS).
- **Labels:** "Decision proposal" marks choices Phase 2 should adopt unless the author decides otherwise.

## 1. Verified identifiers (as of 2026-11-01)

| Entity | Identifier | Version / release | Verified from |
|---|---|---|---|
| Gene | ENSG00000244734 (HBB) | .6 in Ensembl 116 (.2 on GRCh37) | Ensembl `lookup/id` |
| HGNC | HGNC:4827 | lastModified 2026-10-30 | HGNC `fetch/symbol/HBB` |
| NCBI Gene | 3043 | n/a | E-utilities `esummary db=gene` |
| Assembly | GRCh38.p14, GCA_000001405.29; chromosome 11 = NC_000011.10 | | Ensembl `info/assembly`; NC_000011.10 from variant_recoder hgvsg and NCBI esummary `chraccver` |
| Gene locus | GRCh38 11:5225464-5229395, strand -1 | | Ensembl `lookup/id` |
| Transcript | ENST00000335295.4 (HBB-201), MANE Select, Ensembl canonical | | Ensembl `lookup` (`is_canonical` 1, `MANE[0].type` MANE_Select) |
| RefSeq transcript | NM_000518.5 | | Ensembl `MANE[0].refseq_match`; HGNC `mane_select`; UniProt `MANE-Select` |
| Ensembl protein | ENSP00000333994.3, 147 aa | | Ensembl `lookup` `Translation`; `sequence/id` |
| RefSeq protein | NP_000509.1 | | UniProt `MANE-Select` xref; variant_recoder hgvsp |
| UniProt | P68871 (HBB_HUMAN), Swiss-Prot | release 2026_03; entryVersion 219; sequenceVersion 2; md5 209D686939D0B8D1EA089368150140E2 | UniProt REST |
| Variant | rs334 allele A (forward strand) = NC_000011.10:g.5227002T>A | | Ensembl `variant_recoder` |
| HGVS c. / p. | NM_000518.5:c.20A>T = ENST00000335295.4:c.20A>T; NP_000509.1:p.Glu7Val = ENSP00000333994.3:p.Glu7Val | | Ensembl `variant_recoder`, `vep` |
| ClinVar | VCV000015333 (.183), Pathogenic, "criteria provided, multiple submitters, no conflicts" | ClinVar build 261025 | E-utilities `esummary db=clinvar` |
| UniProt variant | VAR_002863 (E7V, Hb S) | | UniProt features |
| Structure | PDB 2HBS, X-ray 2.05 A, revision 1.5 (2026-08-12) | | RCSB mmCIF and Data API |
| Beta entity | 2HBS entity 2, label/auth chains B, D, F, H | | mmCIF `_entity`, `_entity_poly`, `pdbx_poly_seq_scheme` |
| HbS residue in 2HBS | label_seq_id 6 = auth_seq_id 6, VAL, chains B, D, F, H | | mmCIF `pdbx_poly_seq_scheme` + `atom_site` |
| SIFTS segment | P68871 2-147 ↔ 2HBS entity 2 residues 1-146 (each beta chain) | weekly | PDBe `mappings/uniprot/2hbs` |
| Predicted model (optional) | AF-P68871-F1, model v6 | modelCreatedDate 2025-08-01 | AlphaFold DB API |
| Pathways (context, later) | 10 Reactome pathways, e.g. R-HSA-1237044 | Reactome 98 | Reactome ContentService |

## 2. Assembly and transcript choice rule (Decision proposal)

1. **Assembly:** GRCh38 only, from the default `rest.ensembl.org`. Record `assembly_name` from the response; fail if it is not `GRCh38`. GRCh37 coordinates are stored only as a labelled cross-reference (from ClinVar `variation_loc` or `grch37.rest.ensembl.org`), never used for rendering.
2. **Transcript:**
   - Select the transcript whose `MANE` array contains `type == "MANE_Select"`.
   - If there is none, select `is_canonical == 1` and flag `transcriptSelection = "ensembl_canonical_not_mane"`.
   - If there is neither, the gene is unsupported for transcript-level scenes.
   - Store the versioned ID (`ENST00000335295.4`) and `refseq_match` (`NM_000518.5`).
3. **Protein:**
   - Take the transcript's `Translation.id` + `version`.
   - Check that its sequence equals both the translation of the CDS and the UniProt canonical sequence of the accession cross-referenced by UniProt's `MANE-Select` entry.
   - If either check fails, stop and record a validation error. Do not fall back silently.
4. **Structure:**
   - For HBB, 2HBS is fixed by the specification (§4.3).
   - Generally, prefer experimental entries whose SIFTS mapping covers the residue of interest, then a predicted model with a "predicted" label (§4.4).
   - Pick the polymer entity by SIFTS accession match (`P68871`), never by the description string.

## 3. Endpoints to call (Phase 2 adapters)

All with User-Agent `helix-research` from scripts, plus timeouts, retries with exponential back-off, and the per-source rate limits in the registry.

| # | Purpose | Endpoint |
|---|---|---|
| E1 | Release | `GET https://rest.ensembl.org/info/data?content-type=application/json` |
| E2 | Assembly | `GET https://rest.ensembl.org/info/assembly/homo_sapiens?content-type=application/json` |
| E3 | Gene + transcripts | `GET https://rest.ensembl.org/lookup/id/ENSG00000244734?expand=1;mane=1;content-type=application/json` |
| E4 | Transcript detail | `GET https://rest.ensembl.org/lookup/id/ENST00000335295?expand=1;utr=1;mane=1;content-type=application/json` |
| E5 | CDS | `GET https://rest.ensembl.org/sequence/id/ENST00000335295?type=cds;content-type=text/x-fasta` |
| E6 | cDNA | `GET https://rest.ensembl.org/sequence/id/ENST00000335295?type=cdna;content-type=text/x-fasta` |
| E7 | Protein | `GET https://rest.ensembl.org/sequence/id/ENSP00000333994?content-type=text/x-fasta` |
| E8 | Genomic segment for the DNA view | `GET https://rest.ensembl.org/sequence/region/human/11:5226982..5227022:1?content-type=application/json` (window of ±20 around 5227002; **not yet fetched**, Phase 2 fetches and verifies) |
| E9 | Codon to genome | `GET https://rest.ensembl.org/map/cds/ENST00000335295/19..21?content-type=application/json` |
| E10 | Variant | `GET https://rest.ensembl.org/variation/human/rs334?content-type=application/json` |
| E11 | Allele-level HGVS / SPDI | `GET https://rest.ensembl.org/variant_recoder/human/rs334?fields=id,hgvsg,hgvsc,hgvsp,spdi;content-type=application/json` |
| E12 | Consequence | `GET https://rest.ensembl.org/vep/human/hgvs/ENST00000335295.4:c.20A>T?hgvs=1;mane=1;canonical=1;uniprot=1;content-type=application/json` |
| U1 | Protein | `GET https://rest.uniprot.org/uniprotkb/P68871.json` (keep the `x-uniprot-release` header) |
| P1 | Structure file | `GET https://files.rcsb.org/download/2HBS.cif` |
| P2 | Entry metadata | `GET https://data.rcsb.org/rest/v1/core/entry/2HBS` |
| P3 | Beta entity | `GET https://data.rcsb.org/rest/v1/core/polymer_entity/2HBS/2` |
| P4 | Assembly | `GET https://data.rcsb.org/rest/v1/core/assembly/2HBS/1` |
| S1 | SIFTS | `GET https://www.ebi.ac.uk/pdbe/api/mappings/uniprot/2hbs` |
| C1 | ClinVar | `GET https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=clinvar&id=15333&retmode=json&tool=helix-research&email=…` |
| H1 | HGNC (alias resolution, cross-check) | `GET https://rest.genenames.org/fetch/symbol/HBB` with `Accept: application/json` |
| A1 | Optional predicted model | `GET https://alphafold.ebi.ac.uk/api/prediction/P68871`, then its `cifUrl` |

## 4. Fields to keep (curated bundle)

Keep only what the domain model uses. Everything else stays in the raw snapshot.

- **Gene (E3):** `id`, `version`, `display_name`, `description`, `biotype`, `assembly_name`, `seq_region_name`, `start`, `end`, `strand`, `canonical_transcript`.
- **Transcript (E3/E4):** `id`, `version`, `display_name`, `biotype`, `is_canonical`, `MANE[].type`, `MANE[].refseq_match`, `start`, `end`, `strand`, `length`, `Exon[].{id, version, start, end}`, `UTR[].{type, start, end}`, `Translation.{id, version, length, start, end}`.
- **Sequences (E5-E8):** sequence string and FASTA header ID with version. Store the sha256 of each sequence string.
- **Variant (E10-E12):**
  - `name`, `var_class`, `mappings[].{location, allele_string, assembly_name, strand}`
  - per allele: `hgvsg`, `spdi`, `hgvsc` and `hgvsp` for the selected transcript only
  - VEP for the selected transcript: `consequence_terms`, `codons`, `amino_acids`, `protein_start`, `cds_start`, `cdna_start`
  - **Drop** `colocated_variants` HGMD IDs and phenotype text from third parties.
- **UniProt (U1):** `primaryAccession`, `uniProtkbId`, `entryType`, `entryAudit.{entryVersion, sequenceVersion}`, `sequence.{value, length, md5, crc64}`; features of type Initiator methionine, Chain, Natural variant at the position of interest, Domain, Binding site (with `ligand`), Modified residue; each with `location`, `description`, `alternativeSequence`, `evidences`, `featureId`; cross-references `MANE-Select`, `Ensembl`, `PDB`; comments FUNCTION, SUBUNIT, TISSUE SPECIFICITY (text + evidences).
- **Structure (P1):**
  - The full mmCIF is kept as the render source (CC0); it is about 1 MB.
  - Derived index: `_entity` (id, type, description, `pdbx_mutation`), `_entity_poly` (sequence, strand ids), `_struct_asym`, `pdbx_poly_seq_scheme` (all rows), `_pdbx_struct_assembly[_gen]`, `_exptl.method`, `_refine.ls_d_res_high`, `_pdbx_audit_revision_history` (latest), primary `_citation`.
  - **Decision proposal:** evaluate BinaryCIF from models.rcsb.org in P1.4 for size; the CIF stays the reference.
- **SIFTS (S1):** per chain: `entity_id`, `chain_id`, `struct_asym_id`, `unp_start`, `unp_end`, `start/end.{residue_number, author_residue_number, author_insertion_code}`, `identity`, `coverage`.
- **ClinVar (C1):** `accession`, `accession_version`, `title`, `obj_type`, `germline_classification.{description, review_status, last_evaluated}`, `variation_set[].{cdna_change, variation_loc}`, `protein_change`, count of SCVs. Trait names are kept **with** the note that they are aggregated across submissions.

## 5. Provenance fields (every curated record)

```
provenance: {
  source: "ensembl" | "uniprot" | "rcsb" | "pdbe-sifts" | "ncbi-clinvar" | "hgnc" | "alphafold" | ...,
  url: <exact request URL>,
  method: "GET" | "POST",
  retrievedAt: <UTC ISO-8601>,
  sourceRelease: <e.g. "Ensembl 116", "UniProt 2026_03", "ClinVar Build261025-1250.1", "PDB rev 1.5 2026-08-12">,
  recordId: <accession>, recordVersion: <version>,
  assembly: <"GRCh38.p14" | null>,
  sha256: <of raw body>,
  licence: <SPDX-like id or "Ensembl-no-restrictions" | "CC-BY-4.0" | "CC0-1.0" | "NCBI-public-domain">,
  attribution: <required text>,
  transformations: [<step ids, e.g. "field-select", "translate-cds", "sifts-map">],
  validation: [{check: <test id>, result: "pass" | "fail", at: <time>}],
  evidenceCategory: 1..6   // master prompt §5
}
```

## 6. Mapping chain (implemented in Phase 2, each arrow tested)

```
Gene ENSG00000244734 (GRCh38)
 └─ select MANE Select ─▶ ENST00000335295.4 ⇄ NM_000518.5
     ├─ exons + strand ─▶ genome ⇄ c. (1-based, reverse strand)
     │    c.20 ⇄ 11:5227002;  codon 7 ⇄ 11:5227001-5227003
     ├─ CDS translate ─▶ ENSP00000333994.3 == UniProt P68871 (sequence equality)
     │    c.20A>T ⇒ codon GAG→GTG ⇒ p.Glu7Val (translated numbering, Met=1)
     └─ UniProt features: InitMet 1 removed; Chain 2-147 ⇒ mature index = pos - 1 ⇒ Glu6Val
P68871 pos 7 ─ SIFTS (unp_start 2 ↔ residue_number 1) ─▶ 2HBS entity 2 label_seq_id 6
     └─ pdbx_poly_seq_scheme ─▶ auth_asym_id B|D|F|H, auth_seq_id 6, mon_id VAL
          └─ atom_site ─▶ coordinates of VAL 6 (CA, CG1, CG2...) for the highlight
```

The SIFTS step is the authority. The alignment of `_entity_poly` sequence against UniProt is an independent cross-check. `_struct_ref_seq` numbering in the file is **not** used (it is in mature numbering for this entry).

## 7. Deterministic tests Phase 2 must implement

All tests run offline against the frozen fixtures (`data/fixtures/hbb/`, copied from `research/raw/` with manifests). A separate opt-in "live drift" job re-fetches and reports changes without failing the build on version bumps.

**Identity and selection**

- T01: Gene lookup returns `ENSG00000244734`, `display_name` HBB, `assembly_name` GRCh38, `seq_region_name` 11, `strand` -1.
- T02: The transcript-selection rule picks `ENST00000335295` version 4. It is the only transcript with `MANE_Select`, and `refseq_match` = `NM_000518.5`.
- T03: The selection rule fails loudly on a fixture with the MANE entry removed and falls back to `is_canonical` with the flag set.
- T04: HGNC `HGNC:4827` resolves symbol HBB and alias `beta-globin` to ENSG00000244734 (alias resolution).

**Coordinates and sequence**

- T05: Exon lengths sum to the transcript length (628) under the 1-based closed convention.
- T06: The CDS length is 444, divisible by 3, starts `ATG`, ends with a stop codon (`TAA`).
- T07: Translate(CDS, to_stop) == ENSP00000333994.3 sequence == UniProt P68871 sequence (147 aa); UniProt md5 matches.
- T08: Own exon walk maps c.20 to GRCh38 11:5227002 and codon 7 to 11:5227001-5227003, equal to the Ensembl `map/cds` fixture.
- T09: The reverse-strand complement: the forward-strand base at 11:5227002 is T, and the coding-strand base at c.20 is A. Both are read from fixtures; E8 must be fetched first for the genomic base.
- T10: 0-based/1-based converters: SPDI `NC_000011.10:5227001:T:A` ⇄ `g.5227002T>A` round-trips; NCBI esummary 5225463/5227070 ⇄ Ensembl 5225464-5227071.

**Variant**

- T11: Codon 7 is `GAG`; applying c.20A>T gives `GTG`; translate gives E→V.
- T12: The computed p. string for c.20A>T on the selected transcript is `p.Glu7Val`. It equals the VEP and variant_recoder `hgvsp` for ENSP00000333994.3 and NP_000509.1.
- T13: rs334 is multi-allelic (`T/A/C/G`). Only allele A maps to Glu7Val. C maps to Glu7Gly and G to Glu7Ala. A lookup by rsID alone must not return "HbS".
- T14: ClinVar VCV000015333: classification `Pathogenic`, review status string kept verbatim, GRCh38 location 5227002 and GRCh37 5248232 stored with assembly labels. Haplotype VCVs are not merged into it.

**Numbering: E6V vs p.Glu7Val (the core test set)**

- T15: UniProt `Initiator methionine` feature at 1 with description "Removed"; `Chain` 2-147.
- T16: The UniProt natural variant `VAR_002863` is at position **7**, E→V, and cites rs334.
- T17: `matureIndex(uniprotPos=7) == 6`, and the label "Glu6Val (mature numbering)" is produced only through this function, never typed in.
- T18: `hgvsProteinPosition == uniprotPosition == 7` for P68871 canonical. Asserting `== 6` must fail (negative test).
- T19: The 2HBS `_entity.pdbx_mutation` for entity 2 is `E6V VARIANT`; the parser tags it `numbering: "mature/legacy"`.

**Structure**

- T20: 2HBS has 2 polymer entities. The entity whose SIFTS accession is P68871 is entity 2, with strands B, D, F, H. The test must not use the description string to choose it.
- T21: Entity 2 sequence (146 aa) aligned to P68871 gives offset 1 and exactly one mismatch, (entity 6 V, UniProt 7 E).
- T22: SIFTS maps P68871 7 → `residue_number` 6 / `author_residue_number` 6 for each of B, D, F, H. This agrees with RCSB `rcsb_polymer_entity_align` (ref_beg 2 ↔ entity_beg 1).
- T23: For each beta chain, `pdbx_poly_seq_scheme` row `seq_id` 6 has `mon_id` VAL and `auth_seq_num` 6. `atom_site` has a CA atom with `label_comp_id` VAL and `auth_comp_id` VAL there.
- T24: Negative: the residue at label/auth 7 in chain B is GLU, and UniProt position 6 is P. A highlight resolved from the wrong numbering is detectable.
- T25: `_struct_ref_seq.db_align_beg` (1) disagrees with SIFTS `unp_start` (2). The pipeline uses SIFTS and logs the discrepancy as a known-issue record.
- T26: label ≠ auth handling: heme `label_asym_id` J ↔ `auth_asym_id` B, `auth_seq_id` 153. `ResidueRef` keeps both.
- T27: Assemblies: assembly 1 = A, B, C, D and assembly 2 = E, F, G, H. The default scene uses assembly 1.
- T28: Val6 contacts (4.5 A, asymmetric unit): chain H Val6 has contacts with chain B residues 70, 73, 84, 85, 88; B, D and F have none. Regression of the derived JSON.

**Provenance and failure handling**

- T29: Every curated record has all provenance fields, and its sha256 matches the stored raw body.
- T30: Malformed inputs:
  - HTML error body with HTTP 500 (the variant_recoder case)
  - GO `release-date.json` that is not JSON
  - truncated mmCIF
  
  Each produces a typed error, not a partial record.
- T31: Version drift is reported, not fatal: UniProt xref `ENSG00000244734.5` vs Ensembl `.6`; VEP `P68871.216` vs UniProt 219.
- T32: The AlphaFold record, if loaded, is labelled `evidenceCategory 3` (prediction), with model version 6 and its disclaimer kept. It is never used to place Val6 (the model has Glu at 7).

## 8. Open points before Phase 2

- E8 (genomic window) and the GRCh37 HGVS g. string are not fetched yet.
- Symmetry-mate contacts for chains B, D and F are not computed.
- Q-H-LIC-1 resolved 2026-11-01: OMIM and HGMD identifiers are stripped from the snapshot and must not enter curated data.
- Whether Mol* selects by auth or label IDs by default: P1.4.1.

**Phase 2 status (2026-11-01):** E8 was fetched (live, `data/fixtures/hbb/ensembl/`, and in every live build); the 32 tests above are implemented in `packages/scientific-core/test/hbb-plan.test.ts`; results are in `docs/scientific-validation.md`. The GRCh37 HGVS g. string and the symmetry-mate contacts remain open. Deviations from this plan are listed in `docs/data-core.md` §9.
