<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HbS mapping note: HBB gene to 2HBS residue (P1.1.3)

**Status:** research note, Phase 1. **Records fetched:** 2026-11-01 (all URLs below accessed that day). **Raw evidence:** `research/raw/<source>/` with `MANIFEST.tsv` (URL, UTC time, sha256). **Derived tables:** `research/derived/hbs_mapping_2HBS.json` (from `scripts/research/inspect_hbs_mapping.py`) and `research/derived/val6_contacts_2HBS.json` (from `scripts/research/val6_contacts.py`).

Every identifier, position, sequence and residue name below was read from a live response saved in this repository. Statements marked **Inference** are reasoning on top of those records. Nothing here is clinical advice.

## 1. Summary

| Layer | Numbering | Position of the sickle mutation | Residue (reference to HbS) | Source record |
|---|---|---|---|---|
| Genome, GRCh38 | chromosome 11, 1-based, forward strand | 5227002 | T to A (forward strand) | Ensembl rs334, variant_recoder `NC_000011.10:g.5227002T>A` |
| Genome, GRCh37 | chromosome 11, 1-based | 5248232 | T to A (forward strand) | Ensembl GRCh37 rs334; ClinVar VCV000015333 |
| SPDI | 0-based interbase | `NC_000011.10:5227001:T:A` | | Ensembl variant_recoder |
| Transcript (MANE Select) | c. (A of ATG = c.1) | c.20 | A to T; codon 7 GAG to GTG | `ENST00000335295.4:c.20A>T` = `NM_000518.5:c.20A>T` |
| Translated protein (Met = 1) | p. / UniProt | 7 | Glu to Val | `ENSP00000333994.3:p.Glu7Val`, `NP_000509.1:p.Glu7Val`, UniProt P68871 VAR_002863 at 7 |
| Mature protein (Met removed) | legacy haemoglobin numbering | 6 | Glu6Val, "E6V" | 2HBS `_entity.pdbx_mutation` = `E6V VARIANT`; `_struct_ref_seq_dif` |
| 2HBS beta chains | `label_seq_id` and `auth_seq_id` | 6 in chains B, D, F, H | VAL observed | 2HBS mmCIF `pdbx_poly_seq_scheme`, `atom_site` |

The rule HELIX must encode: **HGVS p. and UniProt position 7 = mature and 2HBS position 6.** The offset of 1 comes from the initiator methionine, which UniProt annotates as removed. It is a property of this protein and this structure, verified here from records. It is **not** a general rule.

## 2. Gene: HBB, ENSG00000244734

Source: `https://rest.ensembl.org/lookup/id/ENSG00000244734?expand=1;mane=1;content-type=application/json` (Ensembl release 116, per `https://rest.ensembl.org/info/data?content-type=application/json` returning `{"releases":[116]}`; REST API version 15.12).

- `display_name` HBB, `id` ENSG00000244734, `version` **6**, `biotype` protein_coding.
- `assembly_name` GRCh38. Assembly detail from `/info/assembly/homo_sapiens`: `assembly_name` **GRCh38.p14**, `assembly_accession` GCA_000001405.29, `genebuild_last_geneset_update` 2025-11.
- Location: chromosome **11:5225464-5229395**, `strand` **-1** (reverse strand).
- `canonical_transcript`: **ENST00000335295.4**.
- The gene has **19 transcripts** in release 116 (ENST00000335295, ENST00000647020, ENST00000633227, ENST00000475226, ENST00000485743, ENST00000380315, ENST00000883533 and ENST00001098717 to ENST00001098728). Several of them also encode a 147 residue protein. Only ENST00000335295 carries `is_canonical: 1` and a `MANE` entry.

GRCh37 (`https://grch37.rest.ensembl.org/lookup/id/ENSG00000244734?expand=1;content-type=application/json`): `assembly_name` GRCh37 (`GRCh37.p13` per `/info/assembly`), location 11:**5246694-5250625**, strand -1, gene `version` **2**, 4 transcripts, `canonical_transcript` ENST00000335295.4 (located 5246694-5248301).

## 3. Transcript: ENST00000335295.4, MANE Select

Source: `https://rest.ensembl.org/lookup/id/ENST00000335295?expand=1;utr=1;mane=1;content-type=application/json`.

- `display_name` HBB-201, `version` 4, `is_canonical` 1, `gencode_primary` 1, length 628 nt.
- `MANE`: `type` **MANE_Select**, `refseq_match` **NM_000518.5**.
- Span 11:5225464-5227071, strand -1.
- Exons (genomic, 1-based, closed): ENSE00001829867.2 5226930-5227071; ENSE00001057381.1 5226577-5226799; ENSE00001600613.2 5225464-5225726. Lengths 142 + 223 + 263 = 628, matching the transcript length (this confirms 1-based, closed intervals).
- UTRs: five_prime_utr 5227022-5227071 (50 nt), three_prime_utr 5225464-5225597.
- `Translation`: **ENSP00000333994.3**, `length` 147, genomic span 5225598-5227021.
- Cross-checks: HGNC `mane_select` = `["ENST00000335295.4", "NM_000518.5"]` (`https://rest.genenames.org/fetch/symbol/HBB`); UniProt `MANE-Select` cross-reference ENST00000335295.4 / ENSP00000333994.3 / NM_000518.5 / NP_000509.1.

Sequences (`/sequence/id/ENST00000335295?type=cds`, `type=cdna`, `/sequence/id/ENSP00000333994`):

- CDS: 444 nt, starts `ATGGTGCATCTGACTCCTGAGGAG...`, ends `...TAA`. 444 = 147 codons + stop.
- Codon 7 (c.19-c.21) = **GAG**; c.20 = **A**. The cDNA has 50 UTR nucleotides before the ATG, so c.20 = cDNA position 70 (VEP reports `cdna_start` 70).
- Biopython translation of the CDS (to the stop) equals the ENSP00000333994.3 sequence and the UniProt P68871 sequence exactly (`translated_cds_equals_uniprot: true`, `ensp_equals_uniprot: true` in the derived JSON).
- `/map/cds/ENST00000335295/19..21` returns GRCh38 11:**5227001-5227003**, strand -1. `/map/translation/ENSP00000333994/7..7` returns the same interval. Because the transcript is on the reverse strand, c.19 = 5227003, c.20 = **5227002**, c.21 = 5227001.

## 4. Variant: rs334 and the HbS allele

### Ensembl Variation

`https://rest.ensembl.org/variation/human/rs334?phenotypes=1;content-type=application/json`:

- `var_class` SNP; mapping 11:5227002-5227002, strand 1, **`allele_string` T/A/C/G**, assembly GRCh38.
- `clinical_significance` lists: not provided, likely benign, pathogenic, other, protective.
- **rs334 is multi-allelic.** It is not a synonym for HbS.

`https://rest.ensembl.org/variant_recoder/human/rs334?fields=id,hgvsg,hgvsc,hgvsp,spdi;content-type=application/json` (a first call without `fields` returned HTTP 500; the retry with `fields` returned 200, both are in the manifest). Per forward-strand allele:

| Forward allele | hgvsg | SPDI | MANE hgvsc | hgvsp | Name |
|---|---|---|---|---|---|
| A | NC_000011.10:g.5227002T>A | NC_000011.10:5227001:T:A | ENST00000335295.4:c.20A>T, NM_000518.5:c.20A>T | ENSP00000333994.3:p.Glu7Val, NP_000509.1:p.Glu7Val | **HbS** |
| C | NC_000011.10:g.5227002T>C | NC_000011.10:5227001:T:C | ENST00000335295.4:c.20A>G, NM_000518.5:c.20A>G | p.Glu7Gly | not HbS |
| G | NC_000011.10:g.5227002T>G | NC_000011.10:5227001:T:G | ENST00000335295.4:c.20A>C, NM_000518.5:c.20A>C | p.Glu7Ala | Hb G-Makassar (UniProt VAR_002862) |

The same response gives the LRG view, which is on the gene's strand: `LRG_1232:g.5070A>T` (HbS). It also lists `p.Glu7Val` for 18 Ensembl proteins of HBB, and `ENST00000759072.1:n.265+1274T>A` for an intronic position of a non-coding transcript that is not in the HBB gene lookup. Its T>A matches the forward strand, so (**Inference**, not checked) that transcript lies on the forward strand.

VEP (`/vep/human/hgvs/ENST00000335295.4:c.20A>T?hgvs=1;mane=1;canonical=1;uniprot=1`): `most_severe_consequence` missense_variant; for ENST00000335295: `codons` **gAg/gTg**, `amino_acids` E/V, `protein_start` 7, `cds_start` 20, `hgvsp` ENSP00000333994.3:p.Glu7Val, `mane_select` NM_000518.5, `swissprot` **P68871.216**. Note: VEP's `P68871.216` is an older UniProt entry version than the one served today (219); see pitfalls.

GRCh37 (`https://grch37.rest.ensembl.org/variation/human/rs334`): 11:**5248232**, allele_string T/A/C/G, `ancestral_allele` T.

### ClinVar

`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=clinvar&term=rs334&retmode=json` returned 10 records; `esummary` for all 10 was saved (ClinVar build `Build261025-1250.1`, last update 2026/10/25 per `einfo`).

- **The HbS record: VCV000015333.183**, title `NM_000518.5(HBB):c.20A>T (p.Glu7Val)`, type single nucleotide variant, germline classification **Pathogenic**, review status **criteria provided, multiple submitters, no conflicts**, last evaluated 2026/07/01. Locations GRCh38 11:5227002, GRCh37 11:5248232. dbSNP xref 334. `protein_change` E7V. 74 supporting SCV submissions and 17 RCV records.
- VCV000015175.3: `NM_000518.4(HBB):c.20A>C (p.Glu7Ala)`, Likely benign, criteria provided, single submitter. Same rsID and position, different allele.
- Eight **haplotype** records combine c.20A>T with a second variant (for example VCV000446736.2 `c.[20A>T;364G>A]`, "Sickle cell-Hemoglobin O Arab disease"; VCV000446747.2 `c.[20A>T;271G>A]`, "HEMOGLOBIN S (CAMEROON)"). Their review status is "no assertion criteria provided".
- The aggregated trait list of VCV000015333 includes Hb SS disease and also beta thalassemia, methemoglobinemia, malaria susceptibility and others, because traits are collected across all submissions. **Inference:** the trait list is not a list of what HbS causes; each trait belongs to a particular submission.

## 5. UniProt P68871

`https://rest.uniprot.org/uniprotkb/P68871.json` (response header `x-uniprot-release: 2026_03`, release date 02-September-2026).

- HBB_HUMAN, reviewed (Swiss-Prot). `entryVersion` **219**, `sequenceVersion` **2**, last sequence update 2007-01-23.
- Sequence length **147**, starting `MVHLTPEEK...`. Position 7 = **E**, position 6 = **P**.
- No alternative-products comment (no isoforms are described in this entry).
- Features:
  - `Initiator methionine` at **1**, description "Removed" (evidence ECO:0000250 from P02086, and ECO:0000269 PubMed 13872627).
  - `Chain` **2-147**, "Hemoglobin subunit beta", PRO_0000052976.
  - `Modified residue` at 2: N-acetylvaline (by similarity).
  - `Natural variant` **VAR_002863** at position **7**: E to V, "in SKCA; Hb S; at heterozygosity confers resistance to malaria; dbSNP:rs334" (evidence PubMed 13464827, 16001361).
  - Also at 7: VAR_002862 E to A (G-Makassar, rs334), VAR_002864 E to K (Hb C, rs33930165), VAR_002865 E to Q (Machida, rs33930165).
- Cross-references: `MANE-Select` ENST00000335295.4 / ENSP00000333994.3 / NM_000518.5 / NP_000509.1; `Ensembl` lists ENST00000335295.4 with `GeneId` **ENSG00000244734.5** (Ensembl 116 serves version 6); `PDB` 2HBS: X-ray, 2.05 A, `Chains` **B/D/F/H=2-147** (UniProt numbering).

## 6. Structure: 2HBS

Sources: `https://files.rcsb.org/download/2HBS.cif` (sha256 in `research/raw/rcsb/MANIFEST.tsv`), `https://data.rcsb.org/rest/v1/core/entry/2HBS`, `.../polymer_entity/2HBS/1`, `.../polymer_entity/2HBS/2`, `.../assembly/2HBS/1`, and SIFTS `https://www.ebi.ac.uk/pdbe/api/mappings/uniprot/2hbs`.

Entry facts from the mmCIF: title "THE HIGH RESOLUTION CRYSTAL STRUCTURE OF DEOXYHEMOGLOBIN S"; X-ray diffraction, `_refine.ls_d_res_high` 2.05; deposited 1997-05-06; latest revision 1.5 dated 2026-08-12 ("Metalloprotein remediation" is recorded in the revision details); primary citation Harrington, Adachi and Royer, J. Mol. Biol. 272:398-407 (1997), PubMed 9325099, DOI 10.1006/jmbi.1997.1253. One model, no alternate locations in `atom_site`.

### Entities (`_entity`, `_entity_poly`)

| entity_id | type | description | molecules | pdbx_mutation | strands (`pdbx_strand_id`) |
|---|---|---|---|---|---|
| 1 | polymer | HEMOGLOBIN S (DEOXY), ALPHA CHAIN | 4 | none | A, C, E, G |
| **2** | polymer | **HEMOGLOBIN S (DEOXY), BETA CHAIN** | 4 | **E6V VARIANT** | **B, D, F, H** |
| 3 | non-polymer | PROTOPORPHYRIN IX CONTAINING FE (HEM) | 8 | | |
| 4 | water | | 573 | | |

**Beta entity sequence** (`_entity_poly.pdbx_seq_one_letter_code_can`, entity 2, 146 residues):

```
VHLTPVEKSAVTALWGKVNVDEVGGEALGRLLVVYPWTQRFFESFGDLSTPDAVMGNPKVKAHGKKVLGAFSDGLAHLDN
LKGTFATLSELHCDKLHVDPENFRLLGNVLVCVLAHHFGKEFTPPVQAAYQKVVAGVANALAHKYH
```

It has no initiator Met, and position 6 is V. Aligned against UniProt P68871 it matches positions 2-147 with exactly one difference: entity position 6 = V where UniProt position 7 = E (`entity_vs_uniprot_differences: [[6, "E", "V"]]`, offset 1).

Assemblies: `_pdbx_struct_assembly` lists two tetramers, both "author_and_software_defined_assembly" (PISA): assembly 1 = asym A, B, C, D (+ hemes I-L, waters Q-T); assembly 2 = asym E, F, G, H (+ hemes M-P, waters U-X). The asymmetric unit therefore holds two haemoglobin tetramers.

### Mapping records inside the file

- `_struct_ref` for entity 2: `UNP HBB_HUMAN P68871`, `pdbx_align_begin` 1, sequence `VHLTPEEK...` (the mature wild-type sequence).
- `_struct_ref_seq` for B, D, F, H: `seq_align_beg` 1 to `seq_align_end` 146, **`db_align_beg` 1 to `db_align_end` 146**, auth 1 to 146.
- `_struct_ref_seq_dif` (four rows, one per beta chain): `VAL B 6 ... UNP P68871 GLU 6 variant 6`, and likewise for D, F, H.
- **Finding:** the mmCIF's own reference to P68871 uses **mature numbering** (`db_align_beg 1`, `pdbx_seq_db_seq_num 6`), while UniProt P68871 today numbers that Glu as **7**. A parser that trusts `_struct_ref_seq.db_align_beg` or `_struct_ref_seq_dif.pdbx_seq_db_seq_num` as UniProt positions would be off by one for this entry.
- SIFTS (PDBe API, live): for P68871, entity 2, chains B, D, F, H: **`unp_start` 2, `unp_end` 147**, start `residue_number` 1 / `author_residue_number` 1, end 146 / 146, identity 0.99, coverage 0.993. RCSB `polymer_entity/2HBS/2` agrees (`rcsb_polymer_entity_align`: provenance SIFTS, `entity_beg_seq_id` 1, `ref_beg_seq_id` 2, length 146). UniProt's own PDB cross-reference says `B/D/F/H=2-147`. **SIFTS, RCSB and UniProt agree with each other and disagree with the legacy `_struct_ref_seq` numbers in the file.**

### Residue at the HbS position, read from `pdbx_poly_seq_scheme` and `atom_site`

| UniProt P68871 position (Met = 1) | Mature numbering | label_asym_id | auth_asym_id | label_entity_id | label_seq_id | auth_seq_id | `pdbx_poly_seq_scheme.mon_id` | `atom_site` CA `label_comp_id` / `auth_comp_id` |
|---|---|---|---|---|---|---|---|---|
| 7 | 6 | B | B | 2 | 6 | 6 | VAL | VAL / VAL |
| 7 | 6 | D | D | 2 | 6 | 6 | VAL | VAL / VAL |
| 7 | 6 | F | F | 2 | 6 | 6 | VAL | VAL / VAL |
| 7 | 6 | H | H | 2 | 6 | 6 | VAL | VAL / VAL |

Context in chain B (`pdbx_poly_seq_scheme`): label 3 LEU, 4 THR, 5 PRO, **6 VAL**, 7 GLU, 8 LYS, 9 SER, which map to UniProt 4 L, 5 T, 6 P, 7 E, 8 E, 9 K, 10 S. Every residue matches UniProt except label 6 (VAL vs UniProt E at 7).

Observations from the full `atom_site` table (model 1):

- Beta chains B, D, F, H each have 146 CA atoms and alpha chains A, C, E, G 141, so every polymer residue of the entity sequences is modelled.
- For every polymer atom in this entry, `label_asym_id = auth_asym_id` and `label_seq_id = auth_seq_id`. **This is a coincidence of this entry, not a rule.**
- For non-polymers the two schemes differ: for example the heme with `label_asym_id` **J** has `auth_asym_id` **B** and `auth_seq_id` **153** (`label_seq_id` is `.`). Waters in label asym R have auth chain B.

### Where Val6 sits (measured from coordinates)

`scripts/research/val6_contacts.py`: atoms of other chains within 4.5 A of the CG1/CG2 atoms of beta Val6, in the deposited asymmetric unit only (no crystal symmetry mates):

- Chain **H** Val6 contacts chain **B**: Ala70, Asp73, Thr84, Phe85, Leu88 (auth numbering) and two waters.
- Chains B, D and F: no contact with another chain within the asymmetric unit.

The primary citation's abstract (Harrington et al. 1997, read through Europe PMC on 2026-11-01, `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:9325099%20AND%20SRC:MED&resultType=core&format=json`) states that the double strand of tetramers "is stabilized by lateral contacts involving the mutant valine interacting with a pocket between the E and F helices on another tetramer".

**Inference:** the H-to-B contact is the lateral contact the authors describe, seen once inside the asymmetric unit. The other three Val6 residues presumably make the same kind of contact with symmetry-related tetramers that are not in the file. This was **not verified** (symmetry mates were not generated). Showing only assembly 1 (A-D) shows Val6 but **no** lateral contact.

## 7. The explicit mapping

```
GRCh38 11:5227002 (forward strand T>A)            NC_000011.10:g.5227002T>A
   | reverse-strand gene: c.20 = 5227002, codon 7 = 5227001-5227003
ENST00000335295.4 / NM_000518.5  c.20A>T          codon 7: GAG -> GTG
   | translate (Met = p.1)
ENSP00000333994.3 / NP_000509.1  p.Glu7Val  ==  UniProt P68871 position 7 (VAR_002863)
   | UniProt: initiator Met (1) "Removed"; Chain 2-147
mature beta-globin  Glu6Val ("E6V", "beta6")
   | SIFTS: P68871 2-147 <-> entity 2 seq 1-146 (offset -1)
2HBS entity 2, label_seq_id 6 == auth_seq_id 6, VAL, in label/auth chains B, D, F, H
```

The single formula for this entry: `label_seq_id = auth_seq_id = uniprot_position - 1`, valid for P68871 positions 2-147 in 2HBS entity 2 only, as established by SIFTS on 2026-11-01. HELIX must compute it from SIFTS (or an alignment) per entry, never hard-code it.

## 8. Unverified or open

- Which symmetry-related tetramer each of the Val6 residues in chains B, D and F contacts: not computed.
- Whether ClinVar's VCV000015333 classification is the same in other ClinVar releases: only the 2026-10-25 build was read.
- The HbS genomic description in VCF form (e.g. a VCF line) was not fetched; only HGVS g. and SPDI were.
- The GRCh37 HGVS g. string (NC_000011.9) was not returned by any call; only the GRCh37 position 5248232 was. **Unverified.**
