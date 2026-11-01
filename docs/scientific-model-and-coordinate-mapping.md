<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# Scientific model and coordinate mapping (draft, P1.1.2)

**Status:** draft for Phase 1. All sources accessed **2026-11-01**. Worked examples come from live records saved in `research/raw/` (see `research/hbs-mapping-note.md` for the full HbS chain). "**Fact**" means stated by a cited source or read from a saved record. "**Inference**" or "**Decision proposal**" means our reasoning, to be confirmed in Phase 2.

The purpose of this document is to define the coordinate systems HELIX must keep apart, how to convert between them, and where conversions go wrong. Phase 2 (`shared-types`, P2.1.1) turns it into types and tests.

## 1. Reference assemblies: GRCh38 vs GRCh37

**Facts**

- Ensembl's main REST server (`https://rest.ensembl.org/info/assembly/homo_sapiens`) reports `assembly_name` GRCh38.p14, accession GCA_000001405.29, and `coord_system_versions` including GRCh37. GRCh37 is served by a separate host, `https://grch37.rest.ensembl.org`, which reports GRCh37.p13, GCA_000001405.14, last gene-set update 2013-09.
- The same gene has different coordinates and annotation on the two assemblies. HBB: GRCh38 11:5225464-5229395, gene version 6, 19 transcripts; GRCh37 11:5246694-5250625, gene version 2, 4 transcripts. rs334: GRCh38 11:5227002, GRCh37 11:5248232 (Ensembl and ClinVar agree on both).
- Patch level matters for some loci: GRCh38.p14 is the 14th patch release. Patches add alternate scaffolds, not changes to primary chromosome coordinates (**Inference** from GRC practice; not checked against a GRC page in this session).

**Decision proposal:** HELIX is GRCh38-only for coordinates it displays. Every `GenomicInterval` carries `assembly` (e.g. `GRCh38`), and the RefSeq chromosome accession with version (`NC_000011.10`) when it is used in HGVS. GRCh37 values may be stored as cross-references with their own assembly tag, never mixed into the same field.

## 2. Coordinate conventions and strand

| System | Base | Interval | Source |
|---|---|---|---|
| Ensembl REST (`lookup`, `map`, `variation`) | 1 | closed `[start, end]` | **Fact (measured):** HBB-201 exons 5226930-5227071, 5226577-5226799, 5225464-5225726 give 142 + 223 + 263 = 628, the reported transcript length. |
| HGVS g./c./n./p. | 1 | positions; no 0 (c.-1 is followed by c.1) | HGVS numbering: "there is no nucleotide c.0" (https://hgvs-nomenclature.org/stable/background/numbering/) |
| SPDI (NCBI) | 0 | interbase position before the deleted sequence | "P = Position, a 0-based coordinate for where the Deleted Sequence starts" (https://www.ncbi.nlm.nih.gov/variation/notation/). **Measured:** `NC_000011.10:5227001:T:A` = `NC_000011.10:g.5227002T>A`. |
| UCSC browser display / UCSC tables and BED | 1-start fully closed / 0-start half-open | | "'1-start, fully-closed' = coordinates positioned within the web-based UCSC Genome Browser. '0-start, half-open' = coordinates stored in database tables." (https://genome-blog.gi.ucsc.edu/blog/2016/12/12/the-ucsc-genome-browser-coordinate-counting-systems/) |
| NCBI Gene esummary `genomicinfo` | appears 0-based | `chrstart` > `chrstop` for minus-strand genes | **Measured:** HBB (GeneID 3043) `chrstart` 5227070, `chrstop` 5225463, while Ensembl gives 5225464-5227071. The values are Ensembl's minus 1, listed 5' to 3' on the gene strand. **Inference:** 0-based; the E-utilities manual could not be fetched (reCAPTCHA), so this is **unverified** from documentation. |
| mmCIF `label_seq_id` | 1 | index into `entity_poly_seq` | see section 7 |

Strand:

- Ensembl reports `strand` 1 or -1. Genomic coordinates always count on the forward strand, whatever the gene's strand.
- HBB is on strand -1. So **c. numbering runs toward decreasing genomic coordinates**: `/map/cds/ENST00000335295/19..21` returns 11:5227001-5227003, so c.19 = 5227003, c.20 = 5227002 and c.21 = 5227001.
- Alleles flip too. The forward-strand T>A at 11:5227002 is the coding-strand A>T at c.20 (`NC_000011.10:g.5227002T>A` = `NM_000518.5:c.20A>T`).
- An LRG reference is on the gene's strand: `LRG_1232:g.5070A>T` describes the same variant (variant_recoder, live).

**Decision proposal:** one internal genomic convention, **1-based closed, forward strand**, with an explicit `strand` on features. Converters to and from 0-based (SPDI, BED, NCBI esummary) live in one module, each with a round-trip test.

## 3. Transcripts: Ensembl canonical and MANE Select

**Facts**

- Ensembl: "The Ensembl Canonical transcript is a single, representative transcript identified at every locus." It also says: "If approved jointly by manual curators at both groups, the Ensembl Canonical is designated as the MANE Select transcript at that locus. The approved Ensembl Canonical must also perfectly align to the GRCh38 assembly and be identical to the corresponding RefSeq transcript (CDS and both UTRs)." (https://www.ensembl.org/info/genome/genebuild/canonical.html, which redirected to `jun2026.archive.ensembl.org`.)
- HGVS: "for human, the recommended transcript to be used to describe variants in a gene is the transcript recommended by the MANE project" (https://hgvs-nomenclature.org/stable/background/refseq/).
- The REST `lookup` endpoint exposes `is_canonical`, and with `mane=1` a `MANE` array giving `type` (MANE_Select) and `refseq_match`. HBB: `ENST00000335295.4` ↔ `NM_000518.5`, MANE_Select. HGNC (`mane_select`) and UniProt (`MANE-Select` cross-reference) give the same pair.
- Transcript versions matter: ClinVar still titles some HbS haplotype records with `NM_000518.4` while the current MANE match is `NM_000518.5`.

**Decision proposal**, the transcript selection rule:

1. Use the MANE Select transcript if the lookup returns one.
2. Otherwise use the Ensembl canonical transcript, flagged `selection: ensembl_canonical_not_mane`.
3. Otherwise report the gene as unsupported for transcript-level views.

Always store the **versioned** ID, and refuse to compare HGVS strings whose transcript versions differ without re-mapping. Some genes have MANE Plus Clinical transcripts too. HELIX shows them only as alternatives, never as the default (**Inference**; no such gene was examined in this session).

## 4. CDS to protein translation

**Facts**

- HGVS c. numbering "starts with c.1 at the A of the ATG translation initiation (start) codon and ends with the last nucleotide of the translation termination (stop) codon" (https://hgvs-nomenclature.org/stable/background/numbering/).
- Protein numbering: "amino acid numbering is p.1, p.2, p.3, ..., etc., from the first to the last amino acid of the reference sequence" (same page). The initiator Met is therefore p.1.
- Measured for HBB: the CDS is 444 nt (147 codons + TAA). Biopython `Seq.translate(to_stop=True)` of the Ensembl CDS equals ENSP00000333994.3 and UniProt P68871 (147 aa) exactly.

Conversions (for a CDS position `c` ≥ 1): codon `= ceil(c / 3)`, position in codon `= ((c - 1) mod 3) + 1`. c.20 gives codon 7, position 2. Ensembl's `/map/cds/` and `/map/translation/` endpoints give the genomic span of a codon without reimplementing exon walking; HELIX should test its own exon walk against them.

## 5. HGVS g./c./p. and normalisation

**Facts**

- Variants must be described "in relation to an accepted reference sequence", and reference sequence identifiers must be versioned and stable (https://hgvs-nomenclature.org/stable/recommendations/general/, https://hgvs-nomenclature.org/stable/background/refseq/).
- Three-letter amino acid code "is preferred". Predicted protein consequences go in parentheses: "descriptions should make clear whether the change was experimentally determined or theoretically deduced by giving predicted consequences in parentheses" (general recommendations page).
  - So a protein change predicted from DNA is written `NP_000509.1:p.(Glu7Val)`.
  - Ensembl VEP and ClinVar titles print it without parentheses (`p.Glu7Val`).
  - HELIX must preserve the source's string and not "correct" it silently.
- 3' rule: "for all descriptions, the most 3' position possible of the reference sequence is arbitrarily assigned to have been changed ... the 3'rule applies to ALL descriptions (genome, gene, transcript, and protein) of a given variant". The page also gives an exception for deletions and duplications around exon/exon junctions in c./r. descriptions (general recommendations page).
- Consequence for minus-strand genes: 3' on the transcript is 5' on the genome. The same indel in a repeat can therefore be shifted to different genomic positions in g. (forward-strand 3') and in c. (transcript 3'). **Inference** from the rule above. HbS is a substitution, so no shifting applies to it.
- VCF and SPDI use different normalisations: VCF left-aligns indels, SPDI uses a full-ambiguity representation. These were **not verified** against their specifications in this session. Phase 2 must check them before implementing indels.

**Decision proposal:** HELIX does not write its own HGVS normaliser in Phase 2.

- It stores the source-provided strings (Ensembl variant_recoder, VEP, ClinVar) with provenance.
- It checks that the g., c. and p. strings are consistent through its own coordinate code, for substitutions only.
- It marks indels as "displayed as provided; not re-normalised" until a validated normaliser (or Ensembl variant_recoder) is wired in.

## 6. UniProt canonical vs isoforms; processing features

**Facts**

- "For each UniProtKB/Swiss-Prot entry, we choose a canonical (or representative) sequence". One of the criteria is being "identical to consensus sequences chosen by other resources and genome curation efforts such as CCDS and MANE". Isoforms are described in the same entry where possible (https://rest.uniprot.org/help/canonical_and_isoforms, the source of https://www.uniprot.org/help/canonical_and_isoforms).
- Initiator methionine: "This subsection ... indicates that the initiator methionine is cleaved from the mature protein ... only present when cleavage has been experimentally proven or when it can be propagated 'By similarity'" (https://rest.uniprot.org/help/init_met).
- Feature positions refer to the canonical sequence including Met 1. P68871 has `Initiator methionine` 1 "Removed", `Chain` 2-147, and the HbS natural variant VAR_002863 at **7**.
- Versions: UniProt `entryVersion` (219) changes with annotation; `sequenceVersion` (2) changes only when the sequence changes. VEP reported `P68871.216` on the same day. This is a stale entry version, so HELIX must compare **sequence** versions or sequence checksums, not entry versions.
- Isoform accessions use a suffix (`P12345-2`). Features in the entry refer to the canonical isoform unless stated (**Inference** from the canonical help text; P68871 has no isoforms to test this).

**Decision proposal:** the `Protein` type carries `accession`, `isoform` (canonical or `-n`), `sequenceVersion`, `md5`/`crc64` (UniProt returns both), and `numbering: "translated"`. The `ProcessedChain` type carries the `Chain` feature range. "Mature numbering" is a **derived** label, `matureIndex = uniprotPos - chainStart + 1`, available only when a `Chain` feature exists and starts after 1.

## 7. PDB: entities, chains and residue numbering

**Facts (PDBx/mmCIF dictionary, https://mmcif.wwpdb.org/dictionaries/mmcif_pdbx_v50.dic/)**

- `_atom_site.label_seq_id`: "a pointer to _entity_poly_seq.num in the ENTITY_POLY_SEQ category" (Items/_atom_site.label_seq_id.html). It indexes the entity's full sequence, including residues not modelled.
- `_atom_site.auth_seq_id`: "An alternative identifier for _atom_site.label_seq_id that may be provided by an author ... this is not necessarily a number, that the values do not have to be positive, and that the value does not have to correspond to the value of _atom_site.label_seq_id ... The author may assign values to _atom_site.auth_seq_id in any desired way" (Items/_atom_site.auth_seq_id.html). Insertion codes (`pdbx_PDB_ins_code`) complete it.
- `_atom_site.label_asym_id` points to `_struct_asym.id`. `_atom_site.auth_asym_id` is "An alternative identifier for _atom_site.label_asym_id that may be provided by an author" (Items/_atom_site.label_asym_id.html, Items/_atom_site.auth_asym_id.html).
- `pdbx_poly_seq_scheme` "provides residue level nomenclature mapping for polymer entities" (Categories/pdbx_poly_seq_scheme.html). It lists every entity residue per asym with `seq_id`, `auth_seq_num`, `pdb_strand_id` and `pdb_ins_code`, including unobserved residues.
- An **entity** is a chemically distinct molecule. Each copy in the deposited coordinates is an **asym** (label chain). Measured in 2HBS: entity 2 (beta) has 4 copies, label asyms B, D, F, H.
- **Measured in 2HBS:**
  - For polymers, label and auth chain IDs and sequence numbers coincide.
  - For non-polymers they do not. The heme in label asym **J** has auth chain **B**, auth_seq_id **153**, and label_seq_id `.`.
  - Mol* and most viewers select by auth IDs by default. **Inference:** we have not checked this in Mol*; P1.4.1 must verify it.

**SIFTS** provides "residue-level mapping between UniProt and PDB entries ... updated and released every week" (https://www.ebi.ac.uk/pdbe/docs/sifts/). The PDBe API `mappings/uniprot/{pdb}` returns per chain `unp_start`/`unp_end` and start/end as both `residue_number` (= label_seq_id) and `author_residue_number`. 2HBS beta: UniProt 2-147 ↔ residue 1-146.

**Measured trap:** the 2HBS file's own `_struct_ref_seq.db_align_beg` is 1, and `_struct_ref_seq_dif.pdbx_seq_db_seq_num` is 6, for P68871. These are mature numbering, contradicting current UniProt positions (2 and 7). **SIFTS, not `_struct_ref_seq`, is the mapping of record.**

**Decision proposal:** the `ResidueRef` type is `{entryId, assemblyId?, entityId, labelAsymId, labelSeqId, authAsymId, authSeqId, insCode, compId}`, and every viewer command is generated from it.

- Mapping from UniProt goes through SIFTS segments (or an alignment, section 8) to `labelSeqId`.
- `authSeqId` is then read from `pdbx_poly_seq_scheme`.
- It is never computed by adding an offset.

## 8. Alignment-based mapping

Use alignment when SIFTS has no mapping, for example for a new entry, a non-UniProt sequence, or an AlphaFold model (which uses the full UniProt sequence; measured, `AF-P68871-F1` covers `uniprotStart` 1 to `uniprotEnd` 147).

- Global (Needleman-Wunsch) alignment of the entity sequence (`_entity_poly.pdbx_seq_one_letter_code_can`) against the UniProt canonical sequence, with Biopython `PairwiseAligner` (Biopython 1.88 is pinned in `uv.lock`).
- Accept the mapping only if identity over the aligned region is at least a threshold. **Decision proposal:** 0.95 for "same protein". Lower values are labelled "homologous structure".
- Record every mismatch. The 2HBS beta entity versus P68871 gives exactly one mismatch (entity 6 V vs UniProt 7 E), which is the HbS substitution itself.
- Check that the alignment result equals SIFTS where both exist. This is a test.

## 9. Concrete pitfalls (each observed or sourced)

1. **E6V vs p.Glu7Val.** The legacy mature numbering (2HBS `pdbx_mutation` "E6V VARIANT") and HGVS/UniProt numbering (`p.Glu7Val`, VAR_002863 at 7) differ by the removed initiator Met. Using the HGVS position 7 directly in 2HBS selects label/auth 7, which is GLU (the wrong residue). Using the legacy 6 directly in UniProt selects position 6, which is P.
2. **The mmCIF's own UniProt alignment uses mature numbering** (`_struct_ref_seq.db_align_beg 1`, `_struct_ref_seq_dif ... GLU 6`). Use SIFTS.
3. **label = auth in 2HBS polymers is a coincidence.** It already fails for 2HBS hemes (label J, auth B 153).
4. **rs334 is multi-allelic** (T/A/C/G). rs334 alone does not mean HbS. Key on the allele (`NC_000011.10:g.5227002T>A`) or on ClinVar VCV000015333.
5. **Reverse strand.** On HBB, g. alleles are the complement of c. alleles, and c. positions decrease along the genome.
6. **0-based sources:** SPDI (5227001), NCBI esummary genomicinfo (5225463/5227070) and BED all sit next to 1-based Ensembl and HGVS.
7. **Version drift across resources on the same day:** UniProt records ENSG00000244734.5 while Ensembl serves .6; VEP cites P68871.216 while UniProt serves 219; ClinVar haplotype titles use NM_000518.4 while MANE is NM_000518.5.
8. **Many protein-coding transcripts.** HBB has 19 transcripts in Ensembl 116, several encoding 147 aa. "Canonical" must be read from `is_canonical`/`MANE`, never inferred from length or order.
9. **Two tetramers in the 2HBS asymmetric unit** (assemblies 1 and 2), with the lateral Val6 contact visible only between chain H and chain B. Loading only the biological assembly 1 hides it.
10. **Aggregated ClinVar traits.** The VCV000015333 trait list includes conditions that individual submissions attach. It is not a list of effects of HbS.
11. **Malformed metadata.** `https://current.geneontology.org/metadata/release-date.json` returned `{date: 2026-08-05}`, which is not valid JSON. Adapters must tolerate and report this.
12. **Transient server errors.** Ensembl `variant_recoder` returned HTTP 500 with an HTML body on the first call and 200 on a retry. Adapters must not parse error HTML as data.
