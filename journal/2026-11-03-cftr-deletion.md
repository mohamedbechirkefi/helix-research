# HX-P9-2026-11-03-cftr-deletion: P9.2.1 data side, CFTR F508del as a deletion the builder understands

```yaml
id:            HX-P9-2026-11-03-cftr-deletion
date:          2026-11-03
phase:         P9 (P9.2.1 CFTR curated set and the F508del mapping; plan section 11 rules 1 to 6)
hypothesis:    A three-base deletion that straddles two codons can be modelled from the responses alone (recoder, VEP, the CDS map, the genomic window) with the frame kept, the protein change computed by translation and checked against VEP, and the deleted residue located in a wild-type experimental structure chosen by rule; the HBB output stays identical apart from the new questions record.
git_commit:    helix-research 95f8511 (code, specification, CFTR set and fixtures) and the following data commit (the HBB set rebuilt offline with questions.json); implemented by a delegated agent from plan section 11, verified by the coordinator (tests, typecheck, HBB and FAAH2 sets untouched before the rebuild, identifier guard over 41 files, scans, the capability verdicts)
config:        build-gene.ts --gene cftr --record-fixtures (live: Ensembl, UniProt, HGNC, RCSB, PDBe SIFTS, NCBI ClinVar with the tool parameter only, AlphaFold; user agent helix-research), then --fixtures into a scratch folder and compare-builds; check-structure-candidates.ts --uniprot P13569 --residue 508 --entries 6MSM,5UAK (live); the HBB set rebuilt with --offline from the 2026-11-02 snapshot on the clean tree after the code commit
seed:          n/a
data_version:  Ensembl 116, UniProt 2026_03, ClinVar VCV000007105.214, PDB 5UAK revision 1.4, AF-P13569-F1 v6
hardware:      the development Mac
duration:      about 40 minutes of agent time plus verification and the HBB rebuild
cost:          0
```

## What the responses said, and what the model does with it

| Quantity | Value |
|---|---|
| rs113993960 in Ensembl | an anchored indel, alleles TCTT/T/TCTTCTT; the recoder keys the deletion as "T"; SPDI NC_000007.14:117559590:TCTT:T |
| HGVS | c.1521_1523del on ENST00000003084.11 (NM_000492.4); g.117559592_117559594del (the 3' form; ClinVar's left-aligned 117559591-117559593 is the same allele); p.Phe508del on ENSP00000003084.6 and NP_000483.3 |
| Deleted span | cDNA 1521 to 1523, length 3, 7:117559592-117559594 (GRCh38.p14) |
| Affected codons | 507 ATC to ATT (Ile, unchanged); 508 TTT deleted (Phe) |
| Protein change, computed by translation | p.Phe508del; VEP consequence inframe_deletion, codons atCTTt/att |
| ClinVar | VCV000007105.214, Pathogenic, practice guideline (4 stars), 102 supporting submissions; uid 7105 confirmed from the live esearch (634837 is a haplotype including the allele, kept separate) |
| Structure | 5UAK, electron microscopy, 3.87 Å, chain A, SIFTS 1 to 1480 at offset 0; residue 508 observed as PHE (T40 pass); 6MSM (3.2 Å) rejected because its entity declares the engineered mutation E1371Q, which the coordinate check refuses |
| Contacts of residue 508 in 5UAK | 7, all within chain A (one mapped chain, so the residue's own chain beyond its covalent neighbours is included; scope stated in the record) |
| Checks | 57, 0 failed, 0 warnings, 0 known issues, 3 drift reports (UniProt's Ensembl xref version, VEP's Swiss-Prot release, ClinVar's transcript version) |
| Capability report | all six available (experimentalStructure: 58 entries cross-referenced; verifiedResidueMapping and variantHighlight through 5UAK) |

## Byte-identity

HBB fixtures build before the change against after: 15 files, the usual 158 timestamp differences, and three other differences, all explained: the dirty-tree flag, the manifest's file count (13 to 14) and the new questions.json (`journal/results/compare-hbb-questions-record-2026-11-03.txt`). CFTR recording build against its fixtures rebuild: 14 byte-identical files, one difference, the generator's mode string (`compare-cftr-recording-vs-fixtures-2026-11-03.txt`). The committed HBB set, a live build of 2026-11-02, was not regressed to the fixtures (that would have changed ClinVar's record version and the retrieval dates); it was rebuilt offline from the 2026-11-02 snapshot on the clean tree after the code commit: every record's content unchanged, questions.json added, the generator fields and one HGNC query-timer hash different (`compare-hbb-committed-vs-offline-rebuild-2026-11-03.txt` and the compare run at commit time).

## What reality changed

- The plan's check ids T23 to T25 for the deletion branch collided with the structure checks of those names; the deletion semantics live as branches of T08, T09, T11, T12, T13, T14, T16 and T18, plus T40. Rows in `docs/scientific-validation.md`.
- The redactor did not cover ClinVar's esummary cross-reference sources and einfo field lists that name proprietary databases; the first live build was refused by the guard, the redactor was extended, and the fixtures were recorded from the snapshot (`--offline --record-fixtures`, added for this) so the sources were asked once.
- Three equivalences had to be made explicit before the checks passed: the anchored indel's alleles against the deleted span, the 3' HGVS g. against ClinVar's left-aligned placement, the contextual SPDI against the net deletion.

## Interpretation

The hypothesis holds. The first set with a deletion exists, with every number read back from the responses and the mutant never shown: the reference structure shows the position of the residue F508del removes. The structure choice by rule did its job in the direction one would want: the better-resolved entry was refused because it is not wild type over the mapped segment. Next: the app side (plan section 11 rule 7): the deleted span in DNA World, the two marked codons, the variant card and comparison with the gap, the bridge stations, Protein World on residue 508, and the questions read from the set.

## Failures

Three first attempts of checks failed on the equivalences above and one live build was refused by the identifier guard; each corrected and rerun. None in the final runs.
