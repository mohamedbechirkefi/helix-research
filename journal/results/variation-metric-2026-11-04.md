<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# Variation metric over the five curated sets (P9.3.2)

Generated 2026-11-04T01:52:40.165Z by `helix-app apps/web/scripts/variation-metric.ts over test-support/variation.ts`; helix-app 796b0f3 (tracked files modified), helix-research c24f2f7 (the app pins 920f70b). Raw values: `research/derived/variation-metric-2026-11-04.json`. Every number below is computed by the script; none is typed.

Method (plan section 6): for each set, the bundle is assembled by the app's loader over the curated files, and the planning context, data inventory, journey plan, chapter match and start world are built with the controller's calls and arguments (BUILD_WORLDS: protein, dna, pathway). The plan's three string sets are derived per set, plus one supplementary set (journeyShape), and the metric on an axis is the mean, over the 10 pairs, of the Jaccard distance 1 - |A and B| / |A or B|.

| Axis | Status | Strings |
|---|---|---|
| scene | plan section 6 | worlds whose required data the inventory has, the start world, every data kind the inventory reports, and the targets it names (transcript, variant kind and codon, a deletion's span, structure entry, mapped residue, contacts entry, predicted model, opening pathway) |
| journey | plan section 6 | every chapter the matcher offers, as <title> [<world>] <target>, with the app's BUILD_WORLDS |
| capabilities | plan section 6 | every key of the set's capability report with its availability |
| journeyShape | supplementary | supplementary (not one of the plan's three axes): every offered chapter as <id> [<world>] <focus kind>, without the set-specific targets, so the chapter sequence itself can be compared |

## Means

| Axis | Status | Mean pairwise Jaccard distance | Min pair | Max pair |
|---|---|---:|---|---|
| scene | plan section 6 | 0.525 | HBB vs BRCA1 (0.438) | CFTR vs FAAH2 (0.621) |
| journey | plan section 6 | 1.000 | HBB vs CFTR (1.000) | SLC6A3 vs FAAH2 (1.000) |
| capabilities | plan section 6 | 0.218 | HBB vs CFTR (0.000) | SLC6A3 vs FAAH2 (0.545) |
| journeyShape | supplementary | 0.267 | HBB vs CFTR (0.000) | SLC6A3 vs FAAH2 (0.667) |

## Pairwise matrices

| scene | HBB | CFTR | BRCA1 | SLC6A3 | FAAH2 |
|---|---:|---:|---:|---:|---:|
| HBB | 0.000 | 0.500 | 0.438 | 0.438 | 0.607 |
| CFTR | 0.500 | 0.000 | 0.500 | 0.500 | 0.621 |
| BRCA1 | 0.438 | 0.500 | 0.000 | 0.438 | 0.607 |
| SLC6A3 | 0.438 | 0.500 | 0.438 | 0.000 | 0.607 |
| FAAH2 | 0.607 | 0.621 | 0.607 | 0.607 | 0.000 |

| journey | HBB | CFTR | BRCA1 | SLC6A3 | FAAH2 |
|---|---:|---:|---:|---:|---:|
| HBB | 0.000 | 1.000 | 1.000 | 1.000 | 1.000 |
| CFTR | 1.000 | 0.000 | 1.000 | 1.000 | 1.000 |
| BRCA1 | 1.000 | 1.000 | 0.000 | 1.000 | 1.000 |
| SLC6A3 | 1.000 | 1.000 | 1.000 | 0.000 | 1.000 |
| FAAH2 | 1.000 | 1.000 | 1.000 | 1.000 | 0.000 |

| capabilities | HBB | CFTR | BRCA1 | SLC6A3 | FAAH2 |
|---|---:|---:|---:|---:|---:|
| HBB | 0.000 | 0.000 | 0.000 | 0.000 | 0.545 |
| CFTR | 0.000 | 0.000 | 0.000 | 0.000 | 0.545 |
| BRCA1 | 0.000 | 0.000 | 0.000 | 0.000 | 0.545 |
| SLC6A3 | 0.000 | 0.000 | 0.000 | 0.000 | 0.545 |
| FAAH2 | 0.545 | 0.545 | 0.545 | 0.545 | 0.000 |

| journeyShape | HBB | CFTR | BRCA1 | SLC6A3 | FAAH2 |
|---|---:|---:|---:|---:|---:|
| HBB | 0.000 | 0.000 | 0.000 | 0.000 | 0.667 |
| CFTR | 0.000 | 0.000 | 0.000 | 0.000 | 0.667 |
| BRCA1 | 0.000 | 0.000 | 0.000 | 0.000 | 0.667 |
| SLC6A3 | 0.000 | 0.000 | 0.000 | 0.000 | 0.667 |
| FAAH2 | 0.667 | 0.667 | 0.667 | 0.667 | 0.000 |

## Per-set inventories

### scene

| Set | n | scene strings |
|---|---:|---|
| HBB | 25 | world:protein; world:dna; world:pathway; start-world:dna; kind:cdna-sequence; kind:cds-sequence; kind:exon-structure; kind:experimental-structure; kind:gene; kind:pathway-memberships; kind:predicted-structure; kind:protein-sequence; kind:residue-contacts; kind:residue-mapping; kind:structure-model-file; kind:transcript; kind:variant; transcript:ENST00000335295.4; variant-kind:substitution; variant-codon:7; structure:2HBS; residue:7@2HBS; contacts:2HBS; predicted-model:AF-P68871-F1; pathway-opening:R-HSA-9615710 |
| CFTR | 26 | world:protein; world:dna; world:pathway; start-world:dna; kind:cdna-sequence; kind:cds-sequence; kind:exon-structure; kind:experimental-structure; kind:gene; kind:pathway-memberships; kind:predicted-structure; kind:protein-sequence; kind:residue-contacts; kind:residue-mapping; kind:structure-model-file; kind:transcript; kind:variant; transcript:ENST00000003084.11; variant-kind:deletion; variant-codon:508; variant-span:507-508; structure:5UAK; residue:508@5UAK; contacts:5UAK; predicted-model:AF-P13569-F1; pathway-opening:R-HSA-5627083 |
| BRCA1 | 25 | world:protein; world:dna; world:pathway; start-world:dna; kind:cdna-sequence; kind:cds-sequence; kind:exon-structure; kind:experimental-structure; kind:gene; kind:pathway-memberships; kind:predicted-structure; kind:protein-sequence; kind:residue-contacts; kind:residue-mapping; kind:structure-model-file; kind:transcript; kind:variant; transcript:ENST00000357654.9; variant-kind:substitution; variant-codon:61; structure:1JM7; residue:61@1JM7; contacts:1JM7; predicted-model:AF-P38398-F1; pathway-opening:R-HSA-1221632 |
| SLC6A3 | 25 | world:protein; world:dna; world:pathway; start-world:dna; kind:cdna-sequence; kind:cds-sequence; kind:exon-structure; kind:experimental-structure; kind:gene; kind:pathway-memberships; kind:predicted-structure; kind:protein-sequence; kind:residue-contacts; kind:residue-mapping; kind:structure-model-file; kind:transcript; kind:variant; transcript:ENST00000270349.12; variant-kind:substitution; variant-codon:85; structure:8Y2C; residue:85@8Y2C; contacts:8Y2C; predicted-model:AF-Q01959-F1; pathway-opening:R-HSA-442660 |
| FAAH2 | 14 | world:dna; world:pathway; start-world:dna; kind:cdna-sequence; kind:cds-sequence; kind:exon-structure; kind:gene; kind:pathway-memberships; kind:predicted-structure; kind:protein-sequence; kind:transcript; transcript:ENST00000374900.5; predicted-model:AF-Q6GMR7-F1; pathway-opening:R-HSA-2142753 |

### journey

| Set | n | journey strings |
|---|---:|---|
| HBB | 5 | The HBB transcript [dna] transcript; Codon 7 [dna] codon 7; The mapped residue [protein] feature HbS_substitution on 2HBS; A contact in the crystal [protein] feature HbS_contact_H6_B on 2HBS; Where the protein is listed [pathway] pathway R-HSA-9615710 |
| CFTR | 5 | The CFTR transcript [dna] transcript; Codons 507 to 508 [dna] codon 508; The mapped residue [protein] feature F508del_deletion on 5UAK; A contact in the structure [protein] feature F508del_contact_A508_A on 5UAK; Where the protein is listed [pathway] pathway R-HSA-5627083 |
| BRCA1 | 5 | The BRCA1 transcript [dna] transcript; Codon 61 [dna] codon 61; The mapped residue [protein] feature C61G_substitution on 1JM7; A contact in the structure [protein] feature C61G_contact_A61_A on 1JM7; Where the protein is listed [pathway] pathway R-HSA-1221632 |
| SLC6A3 | 5 | The SLC6A3 transcript [dna] transcript; Codon 85 [dna] codon 85; The mapped residue [protein] feature R85W_substitution on 8Y2C; A contact in the structure [protein] feature R85W_contact_A85_A on 8Y2C; Where the protein is listed [pathway] pathway R-HSA-442660 |
| FAAH2 | 3 | The FAAH2 transcript [dna] transcript; The first codon [dna] codon 1; Where the protein is listed [pathway] pathway R-HSA-2142753 |

### capabilities

| Set | n | capabilities strings |
|---|---:|---|
| HBB | 8 | transcriptView:available; proteinView:available; experimentalStructure:available; predictedStructure:available; verifiedResidueMapping:available; variantHighlight:available; pathwayView:available; associationView:available |
| CFTR | 8 | transcriptView:available; proteinView:available; experimentalStructure:available; predictedStructure:available; verifiedResidueMapping:available; variantHighlight:available; pathwayView:available; associationView:available |
| BRCA1 | 8 | transcriptView:available; proteinView:available; experimentalStructure:available; predictedStructure:available; verifiedResidueMapping:available; variantHighlight:available; pathwayView:available; associationView:available |
| SLC6A3 | 8 | transcriptView:available; proteinView:available; experimentalStructure:available; predictedStructure:available; verifiedResidueMapping:available; variantHighlight:available; pathwayView:available; associationView:available |
| FAAH2 | 8 | transcriptView:available; proteinView:available; experimentalStructure:unavailable; predictedStructure:available; verifiedResidueMapping:unavailable; variantHighlight:unavailable; pathwayView:available; associationView:available |

### journeyShape

| Set | n | journeyShape strings |
|---|---:|---|
| HBB | 5 | transcript [dna] transcript; variant-codon [dna] codon; variant-residue [protein] feature; variant-contact [protein] feature; pathway-memberships [pathway] pathway |
| CFTR | 5 | transcript [dna] transcript; variant-codon [dna] codon; variant-residue [protein] feature; variant-contact [protein] feature; pathway-memberships [pathway] pathway |
| BRCA1 | 5 | transcript [dna] transcript; variant-codon [dna] codon; variant-residue [protein] feature; variant-contact [protein] feature; pathway-memberships [pathway] pathway |
| SLC6A3 | 5 | transcript [dna] transcript; variant-codon [dna] codon; variant-residue [protein] feature; variant-contact [protein] feature; pathway-memberships [pathway] pathway |
| FAAH2 | 3 | transcript [dna] transcript; first-codon [dna] codon; pathway-memberships [pathway] pathway |

## What distinguishes each set

- HBB: a substitution at codon 7; 2HBS (x-ray diffraction, coverage 99.3 %); worlds protein, dna, pathway, starting in dna; 5 chapters offered (The HBB transcript; Codon 7; The mapped residue; A contact in the crystal; Where the protein is listed), of which only this set offers "The HBB transcript", "Codon 7", "A contact in the crystal"; 7 scene, 5 journey, 0 capability and 0 journey-shape strings are its alone.
- CFTR: a deletion at codon 508 (span 507 to 508); 5UAK (electron microscopy, coverage 77.0 %); worlds protein, dna, pathway, starting in dna; 5 chapters offered (The CFTR transcript; Codons 507 to 508; The mapped residue; A contact in the structure; Where the protein is listed), of which only this set offers "The CFTR transcript", "Codons 507 to 508"; 9 scene, 5 journey, 0 capability and 0 journey-shape strings are its alone.
- BRCA1: a substitution at codon 61; 1JM7 (solution NMR, coverage 5.5 %); worlds protein, dna, pathway, starting in dna; 5 chapters offered (The BRCA1 transcript; Codon 61; The mapped residue; A contact in the structure; Where the protein is listed), of which only this set offers "The BRCA1 transcript", "Codon 61"; 7 scene, 5 journey, 0 capability and 0 journey-shape strings are its alone.
- SLC6A3: a substitution at codon 85; 8Y2C (electron microscopy, coverage 85.3 %); worlds protein, dna, pathway, starting in dna; 5 chapters offered (The SLC6A3 transcript; Codon 85; The mapped residue; A contact in the structure; Where the protein is listed), of which only this set offers "The SLC6A3 transcript", "Codon 85"; 7 scene, 5 journey, 0 capability and 0 journey-shape strings are its alone.
- FAAH2: no curated variant; no experimental structure (predicted model AF-Q6GMR7-F1 only); worlds dna, pathway, starting in dna; 3 chapters offered (The FAAH2 transcript; The first codon; Where the protein is listed), of which only this set offers "The FAAH2 transcript", "The first codon"; 3 scene, 3 journey, 3 capability and 1 journey-shape strings are its alone.

## Refused chapters

| Set | Refused (id: code) |
|---|---|
| HBB | none |
| CFTR | none |
| BRCA1 | none |
| SLC6A3 | none |
| FAAH2 | none |
