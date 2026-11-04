# HX-P9-2026-11-04-slc6a3-generalisation: P9.2.3, SLC6A3 as the generalisation test, the variant chosen by rule

```yaml
id:            HX-P9-2026-11-04-slc6a3-generalisation
date:          2026-11-04 (the requests 2026-11-03T23:45Z to 23:52Z)
phase:         P9 (P9.2.3 SLC6A3 curated set; plan section 15 rules 1 to 4)
hypothesis:    A fifth gene comes out of the existing builder with no new record kind and runs in the app with no new app code, its variant chosen by a rule over ClinVar and its structure by the candidate check; whatever the rule and the builder cannot take is recorded as a finding, not forced.
git_commit:    helix-research 6cc33a8 plus the working tree of this session (the finder, the candidate-check library, the ClinVar adapter extension, T13 and T16 generalised, the specification, the set and its fixtures); helix-app d2e117c plus apps/web/e2e/phase9.mjs; implemented by a delegated agent from plan section 15, to be verified by the coordinator (gates by exit code, the clean-tree rebuild, the compares)
config:        find-variant.ts --gene SLC6A3 --uniprot Q01959 (live: NCBI ClinVar with the tool parameter only, UniProt, PDBe SIFTS, RCSB; user agent helix-research), then --min-stars 1 --clinvar-recorded (the recorded ClinVar responses, live structure requests); build-gene.ts --gene slc6a3 --record-fixtures (live: Ensembl, UniProt, HGNC, RCSB, PDBe SIFTS, NCBI ClinVar, AlphaFold, Reactome, Open Targets), then --offline --record-fixtures from that snapshot after two builder generalisations; fixtures rebuild and compare
seed:          n/a
data_version:  Ensembl 116, UniProt 2026_03, ClinVar Build261101-1245.1 (VCV000421417.2), PDB 8Y2C revision 1.4 (2025-07-16), AF-Q01959-F1 v6, Reactome 98, Open Targets api 26.9.0 data 26.09
hardware:      the development Mac; Chrome headless for the suites
duration:      about 90 minutes of agent time
cost:          0
```

## The variant search (plan section 15 rule 1)

The term `SLC6A3[gene] AND ("clinsig pathogenic"[Properties] OR "clinsig likely pathogenic"[Properties]) AND "missense variant"[Molecular consequence]` returned 6 records (Entrez's translation stack shows every clause understood: gene 729, pathogenic 266,140, likely pathogenic 183,399, missense 2,604,529; nothing not found). The six summaries, ranked:

| Record | Protein change | dbSNP | Classification | Review status | Stars | Submissions | Verdict of the rule's pass (two stars) |
|---|---|---|---|---|---|---|---|
| VCV000421417.2 | p.Arg85Trp | rs1064795122 | Likely pathogenic | criteria provided, single submitter | 1 | 1 | skipped: 1 star |
| VCV002054045.4 | p.Gly386Arg | rs2126353885 | Likely pathogenic | criteria provided, single submitter | 1 | 1 | skipped: 1 star |
| VCV004969368.1 | p.Ala314Val | none | Likely pathogenic | criteria provided, single submitter | 1 | 1 | skipped: 1 star; no dbSNP id |
| VCV000016763.1 | p.Leu368Gln | rs267607068 | Pathogenic | no assertion criteria provided | 0 | 1 | skipped: 0 stars |
| VCV000016764.1 | p.Pro395Leu | rs267607069 | Pathogenic | no assertion criteria provided | 0 | 1 | skipped: 0 stars |
| VCV000097017.1 | p.Leu224Pro | rs431905515 | Pathogenic | no assertion criteria provided | 0 | 1 | skipped: 0 stars |

No candidate at two stars: the rule's own pass chose nothing (`research/derived/variant-search-SLC6A3-20261103.json`, exit 3). The plan's fallback was taken and is said loudly in the specification's notes: the one-star pass (`--min-stars 1 --clinvar-recorded`; `research/derived/variant-search-SLC6A3-20261103-min-stars-1.json`) found two eligible candidates, p.Arg85Trp ranked first by the lower accession number (tie on stars and submissions), and the structure check for residue 85 over the 17 PDB cross-references of Q01959 (all cover 85): 8VBY (cryo-EM, 3.19 Å) observes the residue but declares `pdbx_mutation` I248Y and was refused; 8Y2C (cryo-EM, 3.16 Å) observes it on chain A as ARG (label 20, auth 85), equals UniProt over the SIFTS segment 66 to 620, declares no mutation and was kept; the walk stopped there, p.Gly386Arg was not checked and fifteen entries were not fetched. ClinVar was asked once (the second pass read the recorded responses); the two responses are under `research/raw/ncbi-clinvar/` with MANIFEST rows (the esummary redacted, 7 removals).

## What the responses said

| Quantity | Value |
|---|---|
| Gene | SLC6A3, HGNC:11049, alias DAT, ENSG00000142319.21, reverse strand; MANE Select ENST00000270349.12 (NM_001044.5), CDS 1,863 nt, 620 residues |
| Variant | rs1064795122 (bi-allelic G/A), forward G>A at NC_000005.10:g.1442945, SPDI NC_000005.10:1442944:G:A, c.253C>T, codon 85 CGG to TGG, p.Arg85Trp, VEP missense; ClinVar VCV000421417.2 Likely pathogenic, criteria provided, single submitter (1 star, no conflict), 1 supporting submission, no related record at the rsID; UniProt annotates no natural variant at 85 |
| Structure | 8Y2C, electron microscopy, 3.16 Å, deposited 2024-01-25, one model; entity 1 (the transporter) on chain A; residue 85 ARG (label 20, auth 85); coverage "8Y2C covers residues 66 to 620 of 620 (529 observed positions, 85.3 %; ELECTRON MICROSCOPY, 3.16 A)"; no partner polymer entity (two N-acetylglucosamine ligands) |
| Contacts of Arg85 | 6 within 4.5 Å of its six side-chain heavy atoms, all in chain A: Tyr88, Leu89, Thr316, Gln317, Phe320, Asp476 |
| Predicted model | AF-Q01959-F1 v6, global pLDDT 86.94; bands very low 0.113, low 0.015, confident 0.123, very high 0.75 |
| Pathways | 4 Reactome memberships (2 disease, 1 without a diagram), 1 candidate; opens on R-HSA-442660 "SLC-mediated transport of neurotransmitters" (44 participants) by rule |
| Associations | 1,222 on the platform, 25 kept; top three parkinsonism-dystonia, infantile 0.795; classic dopamine transporter deficiency syndrome 0.762; attention deficit-hyperactivity disorder 0.636; `clinical_precedence` and `europepmc` dropped |
| Checks | 65, 0 failed, 0 warnings; one known issue (ligand chains label against auth), 2 drifts |
| Capability report | all eight available; experimentalStructure's reason carries the coverage sentence and the 17 cross-referenced entries |
| Compare | recording build against the fixtures rebuild: 17 files, 185 allowed differences (timestamps and dependent hashes), one other difference, the generator mode (`journal/results/compare-slc6a3-fixtures-rebuild-2026-11-04.txt`) |

## What reality changed (findings against the builder, none against the app)

- **No two-star missense record exists for SLC6A3 in ClinVar.** The rule as written selects nothing; the set carries a one-star variant under the plan's own fallback, stated in the specification, the reports and the docs, and the record's class and stars are ClinVar's.
- **T13 assumed a multi-allelic site and resolved every recoder key.** rs1064795122 is bi-allelic and the recoder lists a second key "T" placed only on the alternate scaffold NT_187547.1 (the same change seen from HSCHR5_3_CTG1); `resolveAllele` refused it for want of a chromosome-level hgvsg. The check now names such keys and does not count them, and accepts two alleles with the words "(bi-allelic)"; HBB, CFTR and BRCA1 keep their details byte for byte (their fixtures tests pin them).
- **T16 required a UniProt natural variant at the position.** Q01959 annotates six, none at 85. The check now passes with the absence stated and the variant record's UniProt evidence line says it; a feature citing the rsID with another change still fails.
- **The first live build was refused by Ensembl REST** (HTTP 500 on the gene lookup after three retries); the second acquired everything and the fixtures were recorded from its snapshot after the two generalisations, as the CFTR fixtures were.
- **The app changed nothing but its suite** (plan section 15 rule 4): the seven SLC6A3 scenarios passed on the first run against the production build, with no source change.

## Suites on the final app build

Phase 9: 36 scenarios PASS with 0 failures and 0 axe violations on the SLC6A3 screens (`phase9-e2e-p923-app.json`; the SLC6A3 scenarios alone first as `phase9-e2e-p923-app-try1.json`). Phase 6 (`--ollama-runs=0`) PASS, 0 failures (`phase6-e2e-p923-app.json`); Phase 5 `--only=dna-render,bridge,transitions,interrupts` PASS (`phase5-e2e-p923-app-dna-render+bridge+transitions+interrupts.json`); the Phase 4 runner `--only=fallback,follow-up,unsupported,cancel-camera` PASS (`e2e-p923-app-fallback+follow-up+unsupported+cancel-camera.json`); accessibility `a11y-p923-app.json`, 0 violations on 14 screens. Unit tests: helix-research 436 passed (4 live tests skipped), helix-app 425 passed; both typechecks clean; `check:pin` reports the expected mismatch (the uncommitted library changes and the untracked set) until the coordinator commits and pins.

## Interpretation

The hypothesis holds for the set and the app, and the two builder generalisations are the measured cost of the fifth gene: both were assumptions carried from HBB (a multi-allelic site, a UniProt-annotated variant) that the rule's choice exposed. The rule itself returned a one-star record, which is the honest state of ClinVar for this gene, and the set says so wherever the record is quoted.

## Failures

The Ensembl HTTP 500 and the two builder refusals above; nothing was written by any of them.
