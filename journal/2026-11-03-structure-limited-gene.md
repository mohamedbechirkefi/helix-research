# HX-P9-2026-11-03-structure-limited-gene: P9.2.4, the structure-limited gene chosen by a seeded walk and built from a specification without a structure

```yaml
id:            HX-P9-2026-11-03-structure-limited-gene
date:          2026-11-03
phase:         P9 (P9.2.4: a poorly annotated or structure-limited gene, the honest fallback; required by D-H007)
hypothesis:    A seeded walk over HGNC ids with three mechanical filters (approved protein-coding gene with one UniProt id and a MANE Select transcript; reviewed UniProt entry with no PDB cross-reference; protein-coding Ensembl gene with a MANE Select transcript) finds a real human gene without an experimental structure within a few dozen ids; the generic builder then produces an honest set from a specification that names no structure and no variant, and the set rebuilds byte-identically from recorded fixtures.
git_commit:    helix-research (this commit), on 627b699; implemented by a delegated agent from a written brief, verified by the coordinator (tests, typecheck, HBB untouched, identifier guard over every fixture and record, scans)
config:        scripts/data-preparation/find-structure-limited.ts --seed 20261103 (mulberry32 over HGNC ids 1 to 60000 without replacement; stop after three passing candidates; the first pass is the choice); then build-gene.ts --gene faah2 --record-fixtures (live) and --fixtures into a scratch folder; compare-builds.ts between the two
seed:          20261103
data_version:  Ensembl 116; UniProt 2026_03 (02-September-2026); HGNC fetch (release not exposed); AlphaFold AF-Q6GMR7-F1 v6
hardware:      the development Mac; live requests to HGNC, UniProt, Ensembl and AlphaFold DB only, user agent "helix-research", no identifier in any request
duration:      the walk 12 s (17:34:21Z to 17:34:33Z); the builds and recording a few minutes; agent time about 15 minutes plus verification
cost:          0
```

## The walk

| Visited | Passed | Skipped, by reason |
|---|---|---|
| 22 HGNC ids | 3 | unused id 5; pseudogene 4; long non-coding RNA 4; small nucleolar RNA 2; entry withdrawn 2; immunoglobulin pseudogene 1; a reviewed protein with 9 PDB cross-references (UBA1) 1 |

Chosen: **FAAH2** (fatty acid amide hydrolase 2), HGNC:26440, UniProt Q6GMR7 (reviewed, 532 aa, 0 PDB cross-references), ENSG00000165591, MANE Select ENST00000374900.5, the ninth id visited and the first to pass. Alternates in sample order: TMTC4 (HGNC:25904, Q5T4D3), WSB2 (HGNC:19222, Q9NYS7). Every id, its stage, verdict and reason: `research/derived/structure-limited-search-20261103.json`. The gene was not chosen for being interesting; it was the first to pass.

## The set

`data/specs/faah2.json` names the gene, the UniProt entry, no `pdbId` and no `variant`. `data/curated/faah2/` holds seven files: gene, transcript, sequences, protein, the AlphaFold predicted-model record, capabilities, manifest. 21 checks, 0 failed, 0 warnings; one non-fatal drift (UniProt's Ensembl gene cross-reference at version 8, Ensembl at 9). The capability file: transcriptView and proteinView available; predictedStructure available (AF-Q6GMR7-F1 v6, class 3, never shown as experimental); experimentalStructure unavailable ("no experimental structure is cross-referenced for this protein"); verifiedResidueMapping unavailable ("no experimental structure to map onto"); variantHighlight unavailable ("no reference variant selected").

## Fixtures and byte-identity

`--record-fixtures` wrote the eleven acquired inputs under `data/fixtures/faah2/` with MANIFEST rows in the record-fixtures format and an index in the HBB shape. Two bodies were redacted under Q-H-LIC-1 (one proprietary cross-reference each in the UniProt and HGNC records); their rows carry the redacted sha256 and the original in the redaction column, the recording build consumed the redacted bodies so the curated manifest cites the bytes on disk, and the identifier guard over every fixture body and curated record finds nothing (15 files; the only two "hits" were the words naming the databases in the index's description, reworded). compare-builds between the live recording build and the fixtures rebuild: 7 files, 71 allowed timestamp differences, one other difference, the generator's mode string.

## What reality changed

Check T15 (initiator methionine and chain) assumed HBB's annotation ("Initiator methionine, Removed" at position 1). FAAH2 keeps its Met and has no such feature; the first live build refused the set. The check now passes when a Chain feature exists and either no Initiator methionine feature exists or it annotates the removal at 1; the protein evidence statement says "initiator Met not annotated as removed" for such entries. The HBB output is unchanged on these fields (checked by a fixtures build). Recorded in `docs/scientific-validation.md` and `docs/data-core.md` section 11.

## Measurements

| Check | Result |
|---|---|
| Tests, typecheck | 318 pass, 4 live skipped (302 before; 14 finder tests, 2 adapter tests); typecheck clean |
| `data/curated/hbb` | 0 changes |
| Identifier guard | 0 hits over the FAAH2 fixtures and records |

## Interpretation

The hypothesis holds: the fallback gene exists in the data, chosen by rule, with an honest capability report that the app can read without any gene-specific code. What remains for P9.2.4 is the app: load the set, say in the readout why there is no Protein World, and run blueprint E end to end. One thing to keep in mind for the next sets: a UniProt entry with no "Initiator methionine" feature is common, so the T15 generalisation was overdue.

## Failures

The first live build refused FAAH2 on T15 (above); corrected and rebuilt. None in the walk.
