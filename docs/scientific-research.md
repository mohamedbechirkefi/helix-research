<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# Scientific research: biological foundations (P1.1.1)

**Status:** Phase 1 research. **All URLs accessed 2026-11-01.**

This is a working guide for HELIX, not a textbook. For each §3.1 concept of `master_prompt.md` it records:

- **Known:** what is measured or known.
- **Records:** the source records and identifiers HELIX can rely on.
- **Show:** a valid visual representation.
- **Uncertainty.**
- **Do not:** the visually tempting but wrong interpretations HELIX must not produce.

Statements are **facts** (cited to a primary source, or read from a live record saved under `research/raw/`) unless marked **Inference** or **Design rule** (our proposal). HBB examples come from `research/hbs-mapping-note.md`; coordinate and numbering details are in `docs/scientific-model-and-coordinate-mapping.md`.

**Literature identifiers checked through the Europe PMC REST API on 2026-11-01:**

| Key | Reference | DOI |
|---|---|---|
| [WC53] | Watson and Crick, Nature 1953 | 10.1038/171737a0 |
| [S17] | Schneider et al., Genome Res 2017, GRCh38 evaluation | 10.1101/gr.213611.116 |
| [M22] | Morales et al., Nature 2022, MANE | 10.1038/s41586-022-04558-8 |
| [dD16] | den Dunnen et al., Hum Mutat 2016, HGVS | 10.1002/humu.22981 |
| [J21] | Jumper et al., Nature 2021, AlphaFold | 10.1038/s41586-021-03819-2 |
| [V22] | Varadi et al., NAR 2022, AlphaFold DB | 10.1093/nar/gkab1061 |
| [D19] | Dana et al., NAR 2019, SIFTS | 10.1093/nar/gky1114 |
| [PI49] | Pauling and Itano, Science 1949 | 10.1126/science.110.2865.543 |
| [I57] | Ingram, Nature 1957 | 10.1038/180326a0 |
| [H97] | Harrington, Adachi and Royer, J Mol Biol 1997, 2HBS | 10.1006/jmbi.1997.1253 |

Only titles and metadata were checked for these papers. The full texts were not read in this session, so they are cited only for their headline content, as indexed.

---

## 1. DNA base pairing

- **Known:** double-stranded DNA pairs A with T and G with C on antiparallel strands [WC53, title "Molecular structure of nucleic acids; a structure for deoxyribose nucleic acid"]. Databases store one strand. Ensembl reports a feature's `strand` as 1 or -1 relative to the forward strand of the assembly.
- **Records:** genomic sequence from Ensembl `/sequence/region` or `/sequence/id?type=genomic`, always with assembly and strand.
- **Show:** a double helix whose bases come from the fetched sequence, with the complementary strand computed (and labelled as such). The reference strand is marked.
- **Uncertainty:** none for complementarity. Real DNA in cells is packaged (chromatin) and not a free B-form helix.
- **Do not:**
  - Draw the gene's coding strand as if it were the forward strand. HBB is on strand -1, so the HbS change is T>A on the forward strand and A>T on the coding strand.
  - Present a stylised helix with invented bases as "the HBB sequence".

## 2. Chromosomes

- **Known:** the human reference has chromosomes 1-22, X, Y and MT. Ensembl `/info/assembly/homo_sapiens` returns `karyotype` 1-22, X, Y, MT, and `top_level_region` gives chromosome 11 a length of 135,086,622 bp. HBB is on chromosome 11.
- **Records:** `/info/assembly/homo_sapiens` (GRCh38.p14, GCA_000001405.29).
- **Show:** an ideogram at true relative scale, with the locus marker at its real coordinate.
- **Uncertainty:** none for lengths; banding patterns come from separate cytogenetic data (not fetched).
- **Do not:**
  - Zoom continuously from a chromosome to atoms as if it were one physical object at one scale.
  - Show the X-shaped mitotic chromosome as "where the gene is" in an interphase cell.

## 3. Genomic reference assemblies

- **Known:** a reference assembly is a versioned coordinate frame. GRCh38 remains the high-quality human reference [S17, title]. The same locus has different coordinates in GRCh37 and GRCh38: HBB is at 11:5225464-5229395 (GRCh38) and 11:5246694-5250625 (GRCh37), and rs334 at 11:5227002 and 11:5248232.
- **Records:** assembly name and accession from `/info/assembly`; chromosome accession with version in HGVS (`NC_000011.10`).
- **Show:** an assembly badge on every coordinate.
- **Uncertainty:** the reference is a composite, not one person's genome. It may carry minor alleles at some positions. This is not checked here; rs334's reference T is the common allele.
- **Do not:**
  - Present the reference as "the normal human genome".
  - Mix coordinates from two assemblies in one view.

## 4. Coordinate systems

- **Known:** Ensembl and HGVS are 1-based. SPDI is 0-based ("P = Position, a 0-based coordinate", https://www.ncbi.nlm.nih.gov/variation/notation/). UCSC uses 1-start fully closed for display and 0-start half-open in tables and BED (https://genome-blog.gi.ucsc.edu/blog/2016/12/12/the-ucsc-genome-browser-coordinate-counting-systems/). HbS: `NC_000011.10:g.5227002T>A` = SPDI `NC_000011.10:5227001:T:A`.
- **Records:** see the coordinate-mapping document, section 2.
- **Show:** coordinates with an explicit system label in inspectors (e.g. "GRCh38 chr11:5,227,002 (1-based)").
- **Uncertainty:** none, but off-by-one errors are the commonest silent failure.
- **Do not:** show a ruler without assembly, strand and base.

## 5. Genes, transcripts, splicing, exons and introns

- **Known:**
  - A gene (ENSG) has one or more transcripts (ENST), each a set of exons; introns are spliced out.
  - HBB has 19 transcripts in Ensembl 116. The MANE Select transcript ENST00000335295.4 (= NM_000518.5) has 3 exons, 628 nt.
  - MANE is "a joint NCBI and EMBL-EBI transcript set" [M22, title]. Ensembl: "The approved Ensembl Canonical must also perfectly align to the GRCh38 assembly and be identical to the corresponding RefSeq transcript (CDS and both UTRs)" (https://www.ensembl.org/info/genome/genebuild/canonical.html, served from the jun2026 archive).
- **Records:** `/lookup/id/{ENSG}?expand=1;mane=1`, giving `Transcript[]`, `Exon[]`, `Translation`, `is_canonical` and `MANE`.
- **Show:** an exon/intron track at genomic scale (exons as blocks, introns as lines), with the selected transcript named and the others available on request.
- **Uncertainty:**
  - Transcript models are annotations: they change between releases, and HBB gained transcripts in recent releases (GRCh37 shows 4).
  - Expression of each isoform in a given tissue is not in these records.
- **Do not:**
  - Imply the MANE transcript is the only one made.
  - Draw splicing as a single fixed movie.
  - Treat transcript count as biological importance.

## 6. Coding and non-coding regions

- **Known:** within a transcript, UTRs flank the CDS. ENST00000335295.4: 5' UTR 50 nt, CDS 444 nt, the rest 3' UTR. Genes can be non-coding (biotypes such as `lncRNA`), and HBB has `retained_intron` and `nonsense_mediated_decay` transcripts.
- **Records:** `/lookup?utr=1`, `/sequence/id?type=cds|cdna|utr5|utr3`.
- **Show:** UTRs thinner than CDS (the genome-browser convention), with the biotype labelled.
- **Uncertainty:** biotype labels are annotation categories, not proof of function.
- **Do not:** call non-coding sequence "junk", or call a `nonsense_mediated_decay` transcript a protein.

## 7. Transcription and translation

- **Known:** DNA is transcribed to RNA, and the CDS is translated codon by codon from the ATG. HGVS: "c.1 at the A of the ATG translation initiation (start) codon" (https://hgvs-nomenclature.org/stable/background/numbering/). Measured: the HBB CDS translates to the 147 aa sequence identical to ENSP00000333994.3 and UniProt P68871.
- **Records:** CDS FASTA plus a deterministic translation (Biopython); protein FASTA from Ensembl and UniProt as cross-checks.
- **Show:** codon-by-codon translation of the real CDS, explicitly labelled **conceptual animation** (§5 category 5) for the machinery (polymerase, ribosome).
- **Uncertainty:**
  - Rates and regulation are not in these records.
  - Post-translational processing (Met removal, acetylation) is annotated separately (UniProt features).
- **Do not:** present a ribosome animation as molecular-dynamics evidence or as real timing.

## 8. Codons and amino acids

- **Known:** HbS changes codon 7 from GAG to GTG: VEP `codons` "gAg/gTg", `amino_acids` E/V. Glu to Val (Ingram identified the chemical difference between normal and sickle haemoglobin [I57, title]).
- **Records:** the CDS sequence plus the standard genetic code (NCBI translation table 1; using Biopython's default table is an implementation fact, not a fetched record).
- **Show:** a three-base codon block with the changed base highlighted and the amino-acid change labelled with its numbering scheme.
- **Uncertainty:** none for the code itself.
- **Do not:** show the change as "one letter changed the whole protein shape". The 2HBS fold is that of haemoglobin; the effect is on intermolecular contacts (section 16).

## 9. Variants and indels

- **Known:** substitutions, deletions, insertions, duplications and delins are distinct HGVS types. HGVS gives the priority "(1) substitution, (2) deletion, (3) inversion, (4) duplication, ..." (https://hgvs-nomenclature.org/stable/recommendations/general/). Indels in repeats have several equivalent positions (section 11).
- **Records:** Ensembl `variation`, `variant_recoder`, `vep`; ClinVar VCV records.
- **Show:** reference and alternative sequence aligned, with the changed span highlighted.
- **Uncertainty:** the position of an indel in a repeat is a convention, not a measurement.
- **Do not:** pin an indel to one base as if its location were unambiguous.

## 10. Reference and alternative alleles

- **Known:** rs334 has `allele_string` T/A/C/G (forward strand). T is the reference; A is HbS (`c.20A>T`); G gives Glu7Ala (Hb G-Makassar, UniProt VAR_002862; ClinVar VCV000015175 Likely benign); C gives Glu7Gly.
- **Records:** Ensembl variation, variant_recoder (per-allele HGVS and SPDI).
- **Show:** the allele explicitly (rs334 **A**), never the rsID alone.
- **Uncertainty:** reference does not mean ancestral or healthy. Ensembl reports `ancestral_allele` T on GRCh37 and none on GRCh38.
- **Do not:** use "reference" and "normal" or "healthy" as synonyms, or treat the rsID as a single variant.

## 11. HGVS notation and normalisation

- **Known:**
  - "the most 3' position possible of the reference sequence is arbitrarily assigned to have been changed ... the 3'rule applies to ALL descriptions (genome, gene, transcript, and protein)" (https://hgvs-nomenclature.org/stable/recommendations/general/).
  - Predicted protein consequences should be in parentheses (same page).
  - The recommended human transcript is MANE (https://hgvs-nomenclature.org/stable/background/refseq/).
  - HGVS 2016 update [dD16].
- **Records:** HbS on the MANE transcript: `NM_000518.5:c.20A>T`, `ENST00000335295.4:c.20A>T`, `NP_000509.1:p.Glu7Val`, `ENSP00000333994.3:p.Glu7Val`, `NC_000011.10:g.5227002T>A`.
- **Show:** the HGVS strings in the inspector, each with its reference sequence and version, and a tooltip explaining g./c./p.
- **Uncertainty:** different tools print p. with or without parentheses.
- **Do not:**
  - Write "p.E6V". That mixes HGVS syntax with legacy numbering.
  - Drop reference-sequence versions.

## 12. Transcript-specific consequences

- **Known:** the consequence is computed per transcript. For rs334-A, VEP gives `missense_variant` on ENST00000335295, and variant_recoder lists p.Glu7Val on 18 Ensembl proteins plus an intronic `n.` description on a non-coding transcript (`ENST00000759072.1:n.265+1274T>A`).
- **Records:** VEP `transcript_consequences[]` with `transcript_id`, `consequence_terms`, `mane_select`.
- **Show:** the MANE consequence by default, with "consequences on N other transcripts" expandable.
- **Uncertainty:** VEP consequences and SIFT predictions are computational (§5 category 3). VEP's `sift_prediction` for HbS is "deleterious_low_confidence".
- **Do not:** present a SIFT or other predictor label as a clinical classification.

## 13. Protein isoforms

- **Known:** UniProt picks one canonical sequence per entry and describes isoforms in the same entry where possible (https://rest.uniprot.org/help/canonical_and_isoforms). P68871 has no alternative-products comment. Ensembl lists several HBB proteins of other lengths (for example 111, 90 and 162 aa), which are transcript models, not UniProt isoforms.
- **Records:** UniProt `comments[ALTERNATIVE PRODUCTS]`, isoform accessions `ACC-n`; Ensembl `Translation`.
- **Show:** the canonical sequence with an isoform switcher only when the entry lists isoforms.
- **Uncertainty:** many annotated transcripts lack protein-level evidence.
- **Do not:** show an Ensembl-only protein model as a confirmed UniProt isoform.

## 14. Functional domains and sites

- **Known:** P68871 has `Domain` Globin 3-147 (evidence ECO:0000255, a rule-based or automatic assertion), and `Binding site` features:
  - heme b at 64 ("distal binding residue") and 93 ("proximal binding residue")
  - 2,3-bisphosphoglycerate at 2, 3, 83 and 144
  - all in translated numbering
  
  In 2HBS chain B the residues at label/auth 63 and 92 are both HIS, which is consistent with UniProt 64 and 93 minus the Met offset. InterPro reports 12 entries for P68871 (counter in the saved response).
- **Records:** UniProt `features` with `evidences`; InterPro `/protein/uniprot/{acc}`.
- **Show:** domain bars on the sequence track, projected onto the structure through the residue mapping, with evidence codes visible.
- **Uncertainty:** many domain boundaries are predicted (ECO:0000255). Member-database boundaries differ.
- **Do not:** draw domains as separable physical objects, or show predicted boundaries as experimental.

## 15. Biological assemblies

- **Known:** UniProt (SUBUNIT): "Heterotetramer of two alpha chains and two beta chains in adult hemoglobin A (HbA)". 2HBS holds two tetramers in the asymmetric unit, and `_pdbx_struct_assembly` defines assembly 1 (A, B, C, D) and assembly 2 (E, F, G, H), both "author_and_software_defined_assembly" (PISA).
- **Records:** mmCIF `_pdbx_struct_assembly`, `_pdbx_struct_assembly_gen`; RCSB `core/assembly/{id}/{n}`.
- **Show:** the biological assembly by default (one α2β2 tetramer); the asymmetric unit or crystal packing only on request, labelled as such.
- **Uncertainty:** assemblies are partly software-inferred (PISA), and crystal contacts may not exist in solution.
- **Do not:**
  - Present the asymmetric unit (8 chains) as "the haemoglobin molecule".
  - Present one tetramer as "the sickle fibre".

## 16. Molecular interactions

- **Known:** the 2HBS paper abstract states the double strand of tetramers "is stabilized by lateral contacts involving the mutant valine interacting with a pocket between the E and F helices on another tetramer" [H97, abstract read through Europe PMC]. Pauling and Itano described sickle cell anaemia as "a molecular disease" [PI49, title].
- **Measured** in the 2HBS coordinates (4.5 A, heavy atoms, asymmetric unit only): beta Val6 of chain H lies near chain B Ala70, Asp73, Thr84, Phe85 and Leu88; the other three Val6 residues have no inter-chain contact inside the asymmetric unit.
- **Records:** mmCIF coordinates; our derived `research/derived/val6_contacts_2HBS.json`.
- **Show:** the Val6 residue and the acceptor pocket on the neighbouring tetramer, with distances measured from the file.
- **Uncertainty:**
  - A crystal contact is a model of the fibre contact, supported by the authors' cited evidence; it is not a direct fibre observation.
  - Contacts with symmetry mates are not computed yet.
- **Do not:**
  - Animate polymerisation as if derived from these coordinates (that would be §5 category 5, a conceptual illustration).
  - Claim the mutation changes the fold of the beta chain.

## 17. Experimentally determined vs predicted structures

- **Known:** 2HBS is X-ray, 2.05 A, deposited 1997. AlphaFold DB `AF-P68871-F1` is a prediction:
  - `toolUsed` "AlphaFold Monomer v2.0 pipeline", `latestVersion` 6
  - `globalMetricValue` 97.19 in the API; `_ma_qa_metric_global` pLDDT 97.18 in the model file (a rounding difference between two records of the same model)
  - the file states "THE INFORMATION PROVIDED IS THEORETICAL MODELLING ONLY AND CAUTION SHOULD BE EXERCISED IN ITS USE"
  
  AlphaFold method [J21]; database [V22].
- **Records:** RCSB entry (`exptl.method`, resolution); AlphaFold `/api/prediction/{acc}` and the model mmCIF.
- **Show:**
  - Experimental structures with method and resolution.
  - Predicted models with a persistent "Predicted model" badge and per-residue confidence colouring taken from the file's local pLDDT.
- **Uncertainty:**
  - AF-P68871-F1 is a single chain with the full 147 aa including Met 1, and has no heme, no partner chains and no HbS valine.
  - X-ray models have their own uncertainty (resolution, B-factors, crystal packing).
- **Do not:**
  - Show an AlphaFold model as "the structure".
  - Show it as a sickle variant model.
  - Show high pLDDT as proof of the biological assembly.

## 18. Residue mapping

- **Known:** SIFTS provides "residue-level mapping between UniProt and PDB entries" (https://www.ebi.ac.uk/pdbe/docs/sifts/; [D19]). For 2HBS beta, UniProt 2-147 map to label/auth 1-146. The legacy `_struct_ref_seq` in the file says 1-146 against P68871, and is wrong by current UniProt numbering.
- **Records:** PDBe `/api/mappings/uniprot/{pdb}`; RCSB `rcsb_polymer_entity_align`; mmCIF `pdbx_poly_seq_scheme`.
- **Show:** linked selection between the sequence track and the structure, with the inspector printing all numberings for the selected residue (UniProt 7 / mature 6 / label B:6 / auth B:6).
- **Uncertainty:** mappings are updated weekly with the PDB; unobserved residues have a `label_seq_id` but no coordinates.
- **Do not:** highlight by "residue number" without saying which numbering.

## 19. Cellular localisation

- **Known:**
  - The UniProt P68871 entry fetched today has **no** SUBCELLULAR LOCATION comment. It has TISSUE SPECIFICITY "Red blood cells".
  - 2HBS `_entity_src_nat` records the source as red blood cells, cellular location "CYTOPLASM".
  - The first 25 QuickGO annotations returned for P68871 were all molecular_function. The response has 93 hits, and paging was not done, so cellular-component GO terms are **unverified**.
- **Records:** UniProt SUBCELLULAR LOCATION comments; GO cellular_component annotations (QuickGO) with evidence codes.
- **Show:** a cell-scale scene only with a cited localisation record; otherwise show "localisation not recorded in the fetched source" (§5 category 6).
- **Uncertainty:** GO annotations vary in evidence (experimental vs electronic).
- **Do not:** place a protein in an organelle because it looks good.

## 20. Mechanisms and pathways

- **Known:** Reactome (version 98) maps P68871 to pathways including R-HSA-1237044 "Erythrocytes take up carbon dioxide and release oxygen", R-HSA-1247673 "Erythrocytes take up oxygen and release carbon dioxide" and R-HSA-2168880 "Scavenging of heme from plasma". The mapping returns 10 pathways, all with `isInferred` false.
- **Records:** Reactome `/data/mapping/UniProt/{acc}/pathways`, then `/data/query/{stId}` for participants and reactions.
- **Show:** a pathway graph with curated reactions as nodes and edges, styled as a diagram, never as spatial reality.
- **Uncertainty:** pathways are curated abstractions. Inferred (orthology) events are labelled `isInferred`.
- **Do not:** turn a pathway diagram into a 3D cell where arrows look like physical trajectories.

## 21. Uncertainty and provenance

- **Known:** each source carries its own evidence vocabulary:
  - ClinVar review status, e.g. VCV000015333 "criteria provided, multiple submitters, no conflicts"; haplotype records "no assertion criteria provided"
  - UniProt ECO evidence codes (ECO:0000269 experimental, ECO:0000250 by similarity, ECO:0000255 rule-based)
  - AlphaFold pLDDT
  - X-ray resolution
  - Reactome `isInferred`
- **Records:** provenance fields per record (source, URL, release, retrieval date, sha256), as in `research/raw/*/MANIFEST.tsv`.
- **Show:** an always-available evidence panel mapping each statement to one of the six §5 categories, with source links.
- **Uncertainty:** cross-resource version drift on a single day: UniProt references ENSG00000244734.5 while Ensembl serves .6; VEP cites P68871.216 while UniProt serves 219.
- **Do not:**
  - Turn a database association (a ClinVar trait list, an Open Targets score) into causation.
  - Show "pathogenic" without its review status.
  - Present ClinVar classifications as advice. HELIX is nonclinical (§1, §5).

---

## Open questions for later phases

1. Symmetry-mate contacts of Val6 in chains B, D and F of 2HBS (needs crystal symmetry expansion). This is needed for an honest "fibre contact" scene.
2. Cellular-component GO terms for P68871 (QuickGO paging).
3. Whether Mol* default selections use auth or label IDs (P1.4.1).
4. ClinVar documentation pages (review-status definitions) could not be fetched by script (reCAPTCHA). The review-status strings above are from live records only.
