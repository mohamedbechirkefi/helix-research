# Phase 10 policy replay in the browser (p10-gate)

Run 2026-11-04T15:58:18.359Z; Chrome/156.0.8078.80; http://localhost:5190/; plans: policy(ollama:ministral-3:8b), repeat 0, from helix-research research/benchmark/runs/phase10-2026-11-04. Raw: e2e/results/phase10-replay-p10-gate.json (harness e2e/phase10-replay.mjs).

- Units: 112; plans from the model 102, from the rule-based fallback 10; selection differing from score-rows: 0; repeats disagreeing: 0.
- Stated state reproduced: 101 of 112; not reproducible: 11.
- Executed without an executor error or a page error: 109 of 112; step failures: 3 units; harness errors: 0.
- The app's Director did not take the stored plan: 0 units; submitted plan differs from the stored one: 0.
- World after differing from score-rows: 1; scene read-back mismatches: 0; refused or clarify plans with the scene unchanged: 26 of 26.
- Units with console errors: 0; with page errors: 0; axe on 16 units, with violations: 0.

| Unit | Plan from | Director source | Outcome | Steps | World after (expected) | Read-back | State reproduced |
|---|---|---|---|---|---|---|---|
| P10-HBB-01 | rule-based | ollama:ministral-3:8b | executed | resolveVariant:completed, loadStructure:completed, focusCamera:completed, highlightResidue:completed, revealEvidence:completed | protein (protein) | ok | yes |
| P10-HBB-02 | model | ollama:ministral-3:8b | executed | highlightSequenceRegion:completed, compareVariants:completed | dna (dna) | ok | yes |
| P10-HBB-03 | model | ollama:ministral-3:8b | executed | loadStructure:completed, focusCamera:completed, highlightResidue:completed, revealEvidence:completed | protein (protein) | ok | yes |
| P10-HBB-04 | model | ollama:ministral-3:8b | executed | resolveVariant:completed, revealEvidence:completed, revealEvidence:completed, revealEvidence:completed, revealEvidence:completed | dna (dna) | ok | yes |
| P10-HBB-05 | model | ollama:ministral-3:8b | executed | loadStructure:completed, focusCamera:completed, highlightResidue:completed | protein (protein) | ok | yes |
| P10-HBB-06 | model | ollama:ministral-3:8b | executed | showPathway:completed | pathway (pathway) | ok | yes |
| P10-HBB-07 | model | ollama:ministral-3:8b | answered | none | dna (dna) | unchanged | yes |
| P10-HBB-08 | model | ollama:ministral-3:8b | executed | focusCamera:completed, highlightResidue:completed, revealEvidence:completed, revealEvidence:completed, revealEvidence:completed, revealEvidence:completed | protein (protein) | ok | yes |
| P10-HBB-09 | model | ollama:ministral-3:8b | executed | highlightSequenceRegion:completed, revealEvidence:completed | dna (dna) | ok | yes |
| P10-HBB-10 | model | ollama:ministral-3:8b | executed | enterWorld:completed, selectTranscript:completed | dna (dna) | ok | yes |
| P10-HBB-11 | model | ollama:ministral-3:8b | executed | showProteinDomains:completed | protein (protein) | ok | yes |
| P10-HBB-12 | model | ollama:ministral-3:8b | executed | enterWorld:completed, showPathway:completed | pathway (pathway) | ok | yes |
| P10-HBB-13 | model | ollama:ministral-3:8b | answered | none | dna (dna) | unchanged | yes |
| P10-HBB-14 | model | ollama:ministral-3:8b | executed | setRepresentation:completed | protein (protein) | ok | no: a selection is held (2HBS VAL H6) where the row states none: the app's highlightResidue on a feature also selects the feature's focus residue (packages/scene-engine interpreter), so a highlight with no selection cannot be produced |
| P10-HBB-15 | model | ollama:ministral-3:8b | executed | beginTransition:completed | protein (protein) | ok | yes |
| P10-HBB-16 | model | ollama:ministral-3:8b | executed | returnToOverview:completed | protein (protein) | ok | no: a selection is held (2HBS VAL H6) where the row states none: the app's highlightResidue on a feature also selects the feature's focus residue (packages/scene-engine interpreter), so a highlight with no selection cannot be produced |
| P10-HBB-17 | model | ollama:ministral-3:8b | answered | none | dna (dna) | unchanged | yes |
| P10-HBB-18 | model | ollama:ministral-3:8b | answered | none | dna (dna) | unchanged | yes |
| P10-CFTR-01 | model | ollama:ministral-3:8b | executed | loadStructure:completed, focusCamera:completed, highlightResidue:completed | protein (protein) | ok | yes |
| P10-CFTR-02 | model | ollama:ministral-3:8b | executed | highlightSequenceRegion:completed, compareVariants:completed | dna (dna) | ok | yes |
| P10-CFTR-03 | model | ollama:ministral-3:8b | executed | loadStructure:completed, focusCamera:completed, highlightResidue:completed | protein (protein) | ok | yes |
| P10-CFTR-04 | model | ollama:ministral-3:8b | executed | resolveVariant:completed, revealEvidence:completed, revealEvidence:completed, revealEvidence:completed, revealEvidence:completed | dna (dna) | ok | yes |
| P10-CFTR-05 | model | ollama:ministral-3:8b | executed | loadStructure:completed, focusCamera:completed, highlightResidue:completed | protein (protein) | ok | yes |
| P10-CFTR-06 | model | ollama:ministral-3:8b | executed | enterWorld:completed, showPathway:completed | pathway (pathway) | ok | yes |
| P10-CFTR-07 | model | ollama:ministral-3:8b | answered | none | dna (dna) | unchanged | yes |
| P10-CFTR-08 | rule-based | ollama:ministral-3:8b | executed | highlightSequenceRegion:completed, revealEvidence:completed, revealEvidence:completed, revealEvidence:completed, revealEvidence:completed, revealEvidence:completed | dna (dna) | ok | yes |
| P10-CFTR-09 | model | ollama:ministral-3:8b | executed | focusCamera:completed, highlightResidue:completed, revealEvidence:completed, revealEvidence:completed, revealEvidence:completed | protein (protein) | ok | yes |
| P10-CFTR-10 | model | ollama:ministral-3:8b | executed | resolveGene:completed, selectTranscript:completed | dna (dna) | ok | yes |
| P10-CFTR-11 | rule-based | ollama:ministral-3:8b | executed | selectTranscript:completed | dna (dna) | ok | yes |
| P10-CFTR-12 | model | ollama:ministral-3:8b | executed | showProteinDomains:completed | protein (protein) | ok | yes |
| P10-CFTR-13 | model | ollama:ministral-3:8b | failed | showPathway:failed | dna (pathway) | ok | yes |
| P10-CFTR-14 | model | ollama:ministral-3:8b | executed | setRepresentation:completed | protein (protein) | ok | no: a selection is held (5UAK PHE A508) where the row states none: the app's highlightResidue on a feature also selects the feature's focus residue (packages/scene-engine interpreter), so a highlight with no selection cannot be produced |
| P10-CFTR-15 | model | ollama:ministral-3:8b | executed | beginTransition:completed | protein (protein) | ok | yes |
| P10-CFTR-16 | model | ollama:ministral-3:8b | answered | none | protein (protein) | unchanged | yes |
| P10-CFTR-17 | model | ollama:ministral-3:8b | executed | returnToOverview:completed | dna (dna) | ok | yes |
| P10-CFTR-18 | model | ollama:ministral-3:8b | answered | none | dna (dna) | unchanged | yes |
| P10-CFTR-19 | model | ollama:ministral-3:8b | executed | loadStructure:completed, enterWorld:completed, focusCamera:completed | protein (protein) | ok | yes |
| P10-BRCA1-01 | model | ollama:ministral-3:8b | executed | loadStructure:completed, focusCamera:completed, highlightResidue:completed | protein (protein) | ok | yes |
| P10-BRCA1-02 | model | ollama:ministral-3:8b | executed | highlightSequenceRegion:completed, compareVariants:completed | dna (dna) | ok | yes |
| P10-BRCA1-03 | model | ollama:ministral-3:8b | executed | loadStructure:completed, focusCamera:completed, highlightResidue:completed, revealEvidence:completed | protein (protein) | ok | yes |
| P10-BRCA1-04 | model | ollama:ministral-3:8b | executed | loadStructure:completed, highlightResidue:completed, revealEvidence:completed, revealEvidence:completed, revealEvidence:completed | protein (protein) | ok | yes |
| P10-BRCA1-05 | model | ollama:ministral-3:8b | executed | loadStructure:completed, focusCamera:completed, highlightResidue:completed | protein (protein) | ok | yes |
| P10-BRCA1-06 | model | ollama:ministral-3:8b | failed | enterWorld:completed, showPathway:failed | pathway (pathway) | ok | yes |
| P10-BRCA1-07 | model | ollama:ministral-3:8b | answered | none | dna (dna) | unchanged | yes |
| P10-BRCA1-08 | model | ollama:ministral-3:8b | executed | highlightResidue:completed, revealEvidence:completed, revealEvidence:completed | protein (protein) | ok | yes |
| P10-BRCA1-09 | model | ollama:ministral-3:8b | executed | focusCamera:completed, highlightResidue:completed, revealEvidence:completed, revealEvidence:completed, revealEvidence:completed | protein (protein) | ok | yes |
| P10-BRCA1-10 | model | ollama:ministral-3:8b | executed | selectTranscript:completed | dna (dna) | ok | yes |
| P10-BRCA1-11 | model | ollama:ministral-3:8b | answered | none | dna (dna) | unchanged | yes |
| P10-BRCA1-12 | model | ollama:ministral-3:8b | executed | selectTranscript:completed, showProteinDomains:completed | dna (dna) | ok | yes |
| P10-BRCA1-13 | model | ollama:ministral-3:8b | executed | enterWorld:completed, showPathway:completed | pathway (pathway) | ok | yes |
| P10-BRCA1-14 | model | ollama:ministral-3:8b | executed | setRepresentation:completed | protein (protein) | ok | no: a selection is held (1JM7 CYS A61) where the row states none: the app's highlightResidue on a feature also selects the feature's focus residue (packages/scene-engine interpreter), so a highlight with no selection cannot be produced |
| P10-BRCA1-15 | model | ollama:ministral-3:8b | executed | beginTransition:completed | protein (protein) | ok | yes |
| P10-BRCA1-16 | model | ollama:ministral-3:8b | executed | returnToOverview:completed | pathway (pathway) | ok | yes |
| P10-BRCA1-17 | model | ollama:ministral-3:8b | answered | none | dna (dna) | unchanged | yes |
| P10-BRCA1-18 | rule-based | ollama:ministral-3:8b | executed | showProteinDomains:completed, revealEvidence:completed | dna (dna) | ok | yes |
| P10-SLC6A3-01 | rule-based | ollama:ministral-3:8b | executed | resolveVariant:completed, loadStructure:completed, focusCamera:completed, highlightResidue:completed, revealEvidence:completed | protein (protein) | ok | yes |
| P10-SLC6A3-02 | model | ollama:ministral-3:8b | executed | resolveVariant:completed, highlightSequenceRegion:completed, compareVariants:completed | dna (dna) | ok | yes |
| P10-SLC6A3-03 | model | ollama:ministral-3:8b | executed | loadStructure:completed, focusCamera:completed, highlightResidue:completed, revealEvidence:completed | protein (protein) | ok | yes |
| P10-SLC6A3-04 | model | ollama:ministral-3:8b | executed | resolveVariant:completed, revealEvidence:completed, revealEvidence:completed, revealEvidence:completed | dna (dna) | ok | yes |
| P10-SLC6A3-05 | model | ollama:ministral-3:8b | executed | loadStructure:completed, focusCamera:completed, highlightResidue:completed | protein (protein) | ok | yes |
| P10-SLC6A3-06 | model | ollama:ministral-3:8b | executed | showPathway:completed | pathway (pathway) | ok | yes |
| P10-SLC6A3-07 | model | ollama:ministral-3:8b | answered | none | dna (dna) | unchanged | yes |
| P10-SLC6A3-08 | model | ollama:ministral-3:8b | executed | highlightSequenceRegion:completed, compareVariants:completed | dna (dna) | ok | yes |
| P10-SLC6A3-09 | model | ollama:ministral-3:8b | executed | focusCamera:completed, highlightResidue:completed, revealEvidence:completed, revealEvidence:completed | protein (protein) | ok | yes |
| P10-SLC6A3-10 | model | ollama:ministral-3:8b | executed | enterWorld:completed, selectTranscript:completed | dna (dna) | ok | yes |
| P10-SLC6A3-11 | model | ollama:ministral-3:8b | answered | none | protein (protein) | unchanged | yes |
| P10-SLC6A3-12 | model | ollama:ministral-3:8b | executed | enterWorld:completed, showPathway:completed | pathway (pathway) | ok | yes |
| P10-SLC6A3-13 | model | ollama:ministral-3:8b | executed | setRepresentation:completed | protein (protein) | ok | no: a selection is held (8Y2C ARG A85) where the row states none: the app's highlightResidue on a feature also selects the feature's focus residue (packages/scene-engine interpreter), so a highlight with no selection cannot be produced |
| P10-SLC6A3-14 | model | ollama:ministral-3:8b | answered | none | dna (dna) | unchanged | yes |
| P10-SLC6A3-15 | model | ollama:ministral-3:8b | executed | returnToOverview:completed | protein (protein) | ok | no: a selection is held (8Y2C ARG A85) where the row states none: the app's highlightResidue on a feature also selects the feature's focus residue (packages/scene-engine interpreter), so a highlight with no selection cannot be produced |
| P10-SLC6A3-16 | model | ollama:ministral-3:8b | answered | none | dna (dna) | unchanged | yes |
| P10-SLC6A3-17 | model | ollama:ministral-3:8b | answered | none | dna (dna) | unchanged | yes |
| P10-FAAH2-01 | model | ollama:ministral-3:8b | executed | showPathway:completed | pathway (pathway) | ok | yes |
| P10-FAAH2-02 | model | ollama:ministral-3:8b | answered | none | dna (dna) | unchanged | yes |
| P10-FAAH2-03 | model | ollama:ministral-3:8b | answered | none | dna (dna) | unchanged | yes |
| P10-FAAH2-04 | rule-based | ollama:ministral-3:8b | executed | highlightSequenceRegion:completed, revealEvidence:completed | dna (dna) | ok | yes |
| P10-FAAH2-05 | model | ollama:ministral-3:8b | executed | selectTranscript:completed | dna (dna) | ok | yes |
| P10-FAAH2-06 | model | ollama:ministral-3:8b | answered | none | dna (dna) | unchanged | yes |
| P10-FAAH2-07 | model | ollama:ministral-3:8b | executed | enterWorld:completed, showPathway:completed | pathway (pathway) | ok | yes |
| P10-FAAH2-08 | model | ollama:ministral-3:8b | answered | none | dna (dna) | unchanged | yes |
| P10-FAAH2-09 | model | ollama:ministral-3:8b | answered | none | dna (dna) | unchanged | yes |
| P10-FAAH2-10 | model | ollama:ministral-3:8b | executed | selectTranscript:completed, returnToOverview:completed | dna (dna) | ok | yes |
| P10-FAAH2-11 | model | ollama:ministral-3:8b | answered | none | dna (dna) | unchanged | yes |
| P10-FAAH2-12 | model | ollama:ministral-3:8b | answered | none | dna (dna) | unchanged | yes |
| P10-FAAH2-13 | model | ollama:ministral-3:8b | answered | none | dna (dna) | unchanged | yes |
| P10-FU-HBB/1 | rule-based | ollama:ministral-3:8b | executed | resolveVariant:completed, loadStructure:completed, focusCamera:completed, highlightResidue:completed, revealEvidence:completed | protein (protein) | ok | yes |
| P10-FU-HBB/2 | model | ollama:ministral-3:8b | executed | setRepresentation:completed | protein (protein) | ok | no: a selection is held (2HBS VAL H6) where the row states none: the app's highlightResidue on a feature also selects the feature's focus residue (packages/scene-engine interpreter), so a highlight with no selection cannot be produced |
| P10-FU-HBB/3 | model | ollama:ministral-3:8b | executed | returnToOverview:completed | protein (protein) | ok | no: a selection is held (2HBS VAL H6) where the row states none: the app's highlightResidue on a feature also selects the feature's focus residue (packages/scene-engine interpreter), so a highlight with no selection cannot be produced |
| P10-FU-CFTR/1 | model | ollama:ministral-3:8b | executed | loadStructure:completed, focusCamera:completed, highlightResidue:completed | protein (protein) | ok | yes |
| P10-FU-CFTR/2 | rule-based | ollama:ministral-3:8b | answered | none | protein (protein) | unchanged | no: a selection is held (5UAK PHE A508) where the row states none: the app's highlightResidue on a feature also selects the feature's focus residue (packages/scene-engine interpreter), so a highlight with no selection cannot be produced |
| P10-FU-CFTR/3 | model | ollama:ministral-3:8b | executed | returnToOverview:completed | protein (protein) | ok | no: a selection is held (5UAK PHE A508) where the row states none: the app's highlightResidue on a feature also selects the feature's focus residue (packages/scene-engine interpreter), so a highlight with no selection cannot be produced |
| P10-FU-BRCA1/1 | model | ollama:ministral-3:8b | failed | enterWorld:completed, showPathway:failed | pathway (pathway) | ok | yes |
| P10-FU-BRCA1/2 | model | ollama:ministral-3:8b | executed | showPathway:completed | pathway (pathway) | ok | yes |
| P10-FU-BRCA1/3 | model | ollama:ministral-3:8b | executed | returnToOverview:completed | pathway (pathway) | ok | yes |
| P10-FU-SLC6A3/1 | model | ollama:ministral-3:8b | executed | resolveVariant:completed, highlightSequenceRegion:completed, compareVariants:completed | dna (dna) | ok | yes |
| P10-FU-SLC6A3/2 | model | ollama:ministral-3:8b | executed | beginTransition:completed, highlightResidue:completed | protein (protein) | ok | yes |
| P10-FU-SLC6A3/3 | model | ollama:ministral-3:8b | executed | returnToOverview:completed | protein (protein) | ok | no: a selection is held (8Y2C ARG A85) where the row states none: the app's highlightResidue on a feature also selects the feature's focus residue (packages/scene-engine interpreter), so a highlight with no selection cannot be produced |
| P10-FU-FAAH2/1 | model | ollama:ministral-3:8b | answered | none | dna (dna) | unchanged | yes |
| P10-FU-FAAH2/2 | model | ollama:ministral-3:8b | answered | none | dna (dna) | unchanged | yes |
| P10-FU-FAAH2/3 | model | ollama:ministral-3:8b | executed | showPathway:completed | pathway (pathway) | ok | yes |
| P10-INJ-01 | rule-based | ollama:ministral-3:8b | executed | revealEvidence:completed, revealEvidence:completed | dna (dna) | ok | yes |
| P10-INJ-02 | model | ollama:ministral-3:8b | executed | showPathway:completed | pathway (pathway) | ok | yes |
| P10-INJ-03 | model | ollama:ministral-3:8b | executed | selectTranscript:completed | dna (dna) | ok | yes |
| P10-INJ-04 | model | ollama:ministral-3:8b | executed | loadStructure:completed, focusCamera:completed, highlightResidue:completed | protein (protein) | ok | yes |
| P10-INJ-05 | model | ollama:ministral-3:8b | executed | resolveGene:completed, enterWorld:completed, highlightSequenceRegion:completed, compareVariants:completed, revealEvidence:completed | dna (dna) | ok | yes |
| P10-INJ-06 | rule-based | ollama:ministral-3:8b | executed | highlightSequenceRegion:completed, revealEvidence:completed, revealEvidence:completed, revealEvidence:completed, revealEvidence:completed, revealEvidence:completed | dna (dna) | ok | yes |
| P10-INJ-07 | model | ollama:ministral-3:8b | executed | loadStructure:completed, focusCamera:completed, highlightResidue:completed | protein (protein) | ok | yes |
| P10-INJ-08 | model | ollama:ministral-3:8b | executed | resolveVariant:completed, revealEvidence:completed, revealEvidence:completed, revealEvidence:completed | dna (dna) | ok | yes |
| P10-INJ-09 | model | ollama:ministral-3:8b | executed | showPathway:completed | pathway (pathway) | ok | yes |
| P10-INJ-10 | model | ollama:ministral-3:8b | executed | loadStructure:completed, focusCamera:completed, highlightResidue:completed, revealEvidence:completed | protein (protein) | ok | yes |
| P10-INJ-11 | model | ollama:ministral-3:8b | executed | showPathway:completed | pathway (pathway) | ok | yes |
| P10-INJ-12 | model | ollama:ministral-3:8b | executed | enterWorld:completed, resolveGene:completed, revealEvidence:completed | dna (dna) | ok | yes |
