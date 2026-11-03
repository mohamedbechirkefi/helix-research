# HX-P9-2026-11-03-brca1-domain-structure: P9.2.2 data side, BRCA1 on a domain structure with coverage stated

```yaml
id:            HX-P9-2026-11-03-brca1-domain-structure
date:          2026-11-03
phase:         P9 (P9.2.2 BRCA1 curated set; plan section 13 rules 1 to 7, data part)
hypothesis:    A gene with no full-length structure can be curated honestly: a substitution inside an experimentally observed domain, the entry chosen by the candidate check (NMR allowed), coverage computed and stated in words for every set, the partner chain named from the entry, the predicted model's confidence bands recorded; HBB, CFTR and FAAH2 change only by the fields section 13 adds to every set.
git_commit:    helix-research bd8531f (code, specification, BRCA1 set and fixtures), then f8c1ed2, 3fe6783, 715116b with bd8531f (the four sets rebuilt on clean trees), HEAD f3fb6bf; implemented by a delegated agent from plan section 13, verified by the coordinator (gates by exit code, identifier guard over 83 files, scans, the compares)
config:        check-structure-candidates.ts --uniprot P38398 --residue 61 --entries 1JM7,7JZV,7LYB,8GRQ (live); build-gene.ts --gene brca1 --record-fixtures (live: Ensembl, UniProt, HGNC, RCSB, PDBe SIFTS, NCBI ClinVar with the tool parameter only, AlphaFold, Reactome; user agent helix-research); fixtures rebuild and compare; the four sets rebuilt offline on clean trees
seed:          n/a
data_version:  Ensembl 116, UniProt 2026_03, ClinVar VCV000017661.165, PDB 1JM7 revision 1.4, AF-P38398-F1 v6, Reactome 98
hardware:      the development Mac
duration:      about 30 minutes of agent time plus verification and the rebuilds
cost:          0
```

## What the responses said

| Quantity | Value |
|---|---|
| Variant | rs28897672, forward A>C at NC_000017.11:g.43106487, c.181T>G on ENST00000357654.9 (NM_007294.4), codon 61 TGT to GGT, p.Cys61Gly; VEP missense; ClinVar VCV000017661.165 Pathogenic, reviewed by expert panel, 77 submissions (the two other uids of the esearch are p.Cys61Ser and p.Cys61Arg, kept separate); UniProt VAR_007757 |
| Candidate check | 1JM7 solution NMR, 14 models submitted of 25 calculated (representative conformer 2), covers 1 to 103, residue 61 observed as CYS on chain A, wild type over the SIFTS segment, two cloning-artifact residues outside it (111, 112) explained by the entry: chosen. 7JZV refused (fusion construct, engineered mutation). 7LYB and 8GRQ (cryo-EM complexes) would be next |
| Coverage | 1JM7 covers residues 1 to 103 of 1,863 (103 observed positions, 5.5 %; solution NMR, 14 models, model 1 shown) |
| Partner | entity 2, BRCA1-associated RING domain protein 1, chain B, Q99728 from the entry's own cross-references, SIFTS agreeing |
| Contacts of Cys61 | 7 within 4.5 Å of its SG atom in model 1, heavy atoms only: 6 BRCA1 residues and a zinc; no BARD1 residue within the cutoff |
| Predicted model | AF-P38398-F1 v6, global pLDDT 41.6; bands very low 0.804, low 0.022, confident 0.063, very high 0.111 |
| Pathways | 28 Reactome memberships (7 disease, 12 without diagram), 9 candidates, opens on Meiotic synapsis R-HSA-1221632 by rule |
| Checks | 64, 0 failed, 0 warnings; one known issue (zinc chains label against auth), 2 drifts |
| Capability report | all seven available; experimentalStructure's reason carries the coverage sentence and the 33 cross-referenced entries |

## What every set gained

The structure record now carries `coverage` (first and last observed position, observed and mapped counts, the protein length, the fraction and the sentence), `modelCount` and `modelShown`, the NMR ensemble when there is one, the mapped entity and the partners from the entry's cross-references, and per-entity sequence differences with the depositors' explanation; the predicted-model record carries the pLDDT band fractions; the capability reason names the coverage (HBB: 2HBS covers 2 to 147 of 147, 99.3 %, X-ray 2.05 Å; CFTR: 5UAK covers 5 to 1436 of 1,480, 77.0 %, electron microscopy 3.87 Å). Compares of the fixtures builds before and after list exactly these fields and the two new check rows (`journal/results/compare-{hbb,cftr,faah2}-coverage-fields-2026-11-03.txt`); the BRCA1 recording build against its fixtures rebuild differs by the generator mode only.

## What reality changed

- T39 and the candidate script compared the whole entity against UniProt and would have refused 1JM7 for two cloning-artifact residues outside the mapped segment; both now compare at the mapped positions and report the rest with the entry's own explanation.
- Two live-build refusals changed code before any record was written: the recoder needed a longer attempt budget for this variant, and VEP's HGMD marker in a colocated allele string had to be covered by the redaction.
- The depositors' representative conformer of 1JM7 is model 2; model 1 is the one mapped, measured and shown, and the record states both.

## Interpretation

The hypothesis holds. The honest shape for a domain-only gene is now data: the set says it shows 103 residues of 1,863, names the partner it was solved with, records that four fifths of the predicted model are at very low confidence, and the app's next step shows those three facts in the caption, the card and the limitations.

## Failures

None in the final runs; the refusals above were caught by the checks and the guard before anything was recorded.
