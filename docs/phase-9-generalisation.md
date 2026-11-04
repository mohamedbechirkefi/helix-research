<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# Phase 9: multi-gene scientific personalisation, the plan

Authored 2026-11-03 when Phase 8 closed (helix D-H018). Governs ROADMAP Phase 9 (P9.1.1 to P9.4.1). The master prompt's rules that bind this phase: §4.2 (curated plus live-discovery modes), §13 (generalise with CFTR, BRCA1, SLC6A3 and at least one poorly annotated or structure-limited gene; never a separate application per gene; curated premium chapters are fine, but retrieval, entity mapping, scene planning and action execution stay reusable), the evidence rules (a database association is never causal proof; an AlphaFold model is never an experimental structure).

## 1. What must be true at the end

1. One builder produces a curated dataset for any recognised human protein-coding gene from a short gene specification; HBB is one instance of it, byte-identical to today's set except for the generator fields.
2. Five curated sets exist: HBB, CFTR, BRCA1, SLC6A3 and one structure-limited gene chosen by a capability check, not by hand.
3. Every world and chapter is chosen from the set's capabilities file; no code path tests a gene symbol.
4. Dynamic mode: a recognised gene that has no curated set gets a journey from a live retrieval through the same builder (in memory, cached), with the same capability discovery and the same labels.
5. A variation metric shows that the five journeys differ in scenes, targets and chapters, and the report says by how much.
6. No fictitious asset or claim: a gene without an experimental structure shows none; a predicted model is labelled predicted with its confidence; a pathway membership is a membership, not a mechanism; an Open Targets association is an association, never causal.
7. The science suite passes on every set; the Phase 4 to 8 suites pass on HBB unchanged.

## 2. The gene specification (the only per-gene input)

A `GeneSpec` is data, kept under `data/specs/<symbol>.json`, reviewed like any curated record:

| Field | Meaning | HBB today |
|---|---|---|
| `symbol` | HGNC symbol; resolved live to Ensembl, HGNC, UniProt | HBB |
| `variants[]` | the reference variants the journey may tell, each by dbSNP id or HGVS, with a one-line reason and the ClinVar accession to fetch | rs334 (HbS), VCV000015333 |
| `structurePreference` | how to rank experimental entries when several exist (`"variant-residue-observed"`, `"highest-resolution"`, `"largest-coverage"`) | the entry where the variant residue is observed |
| `contactsFor` | which structure and residue to compute contacts for, if any | 2HBS, HbS residue |
| `pathways` | whether to fetch Reactome memberships | not yet |
| `associations` | whether to fetch Open Targets associations (and the share-alike exclusion list) | not yet |
| `notes` | curator notes shown nowhere, kept for provenance | |

Everything else (transcript choice by the MANE rule, sequences, UniProt, SIFTS mapping, AlphaFold prediction, capability discovery) is the same code for every gene. A spec may not name a world, a chapter, a camera or a colour.

## 3. Adapters to add or extend (P9.1.x)

| Adapter | Source | Licence (registry) | What it returns | Label |
|---|---|---|---|---|
| AlphaFold (extend) | `api/prediction/{acc}`, model mmCIF, PAE JSON | CC BY 4.0, in-file disclaimer kept | per-residue pLDDT from `_ma_qa_metric_local`, the PAE matrix and its maximum, the fraction bands, the PAE and model file URLs | Predicted, class 3, with pLDDT bands and the disclaimer |
| Reactome Content Service (new) | `data/mapping/UniProt/{acc}/pathways`, `data/pathway/{stId}`, `data/participants/{stId}` | CC0 data, CC BY 4.0 diagrams | pathway memberships (stable id, name, species, top-level pathway), participants when a Pathway World needs them | Database annotation, class 2; "membership", never "mechanism" |
| Open Targets GraphQL (new) | `target(ensemblId)` with `associatedDiseases`, `knownDrugs` excluded | CC0 1.0 platform; per-source terms, share-alike sources excluded | disease associations with their overall score and the evidence datasources, each kept with its own licence tag | Database annotation, class 2; "association", never "causal"; share-alike datasources dropped at parse time |

Each adapter: URL builders that validate parameters, a zod schema for the raw record, a parse function tested on recorded fixtures (`research/raw/<source>/` with MANIFEST rows), a live test behind `HELIX_LIVE=1`, and a row in `docs/data-source-registry.md` with the release seen.

## 4. The five genes

| Gene | Why it is in §13 | What the capability check will find | The honest shape of its journey |
|---|---|---|---|
| HBB | the vertical slice | everything available (today's set) | unchanged |
| CFTR | a deletion, not a substitution: F508del, c.1521_1523del | experimental structures of the full channel (cryo-EM, 5UAK and later) where residue 508 is observed; the variant is three deleted bases | the reference structure shows the position of the residue that is missing in F508del; the mutant effect is not shown, the caption says so |
| BRCA1 | no full-length structure | experimental structures of domains only (RING, BRCT); UniProt regions; pathways (homologous recombination) | Protein World on a domain with the coverage stated; no fabricated full-length model; the AlphaFold model, if shown, labelled with its low-confidence regions |
| SLC6A3 | a transporter, structures where available | the dopamine transporter has experimental structures (human DAT, 2024 onwards) and a predicted model | Protein World on the transporter; the variant set is small and must be chosen from ClinVar with care |
| the structure-limited gene | the honest fallback (D-H007: required; replaces the HBB withheld-records fixture) | chosen by running the capability check over candidates: protein-coding, MANE transcript, UniProt entry, no experimental structure, few or no ClinVar pathogenic variants, no Reactome pathway | DNA World only, the readout says why there is no Protein World; blueprint E end to end |

The structure-limited gene is chosen by a script (`scripts/data-preparation/find-structure-limited.ts`) that runs the capability check over a candidate list drawn from Ensembl (protein-coding genes with a MANE Select transcript, sampled by a fixed seed) and reports the first that has a UniProt entry and no experimental structure; the choice, the seed and the rejected candidates are journaled. The gene is not chosen for being interesting.

## 5. Dynamic mode (P9.3.1)

The builder already separates "fetch the inputs" from "derive the records". Dynamic mode runs the same derive step over inputs fetched at request time, through the existing HTTP cache, for a gene the visitor names that has no curated set; the result is a dataset in memory with a `generatedAt` of now and a `generator.mode` of `"dynamic"`. The app shows the same worlds from the same capabilities file, with one extra line in the caption ("retrieved live at <time>, not curated") and one extra limitation. What it does not do: compute contacts (no curated structure choice), tell a variant (no reviewed variant list; the visitor may name a dbSNP id, which is fetched and labelled), or show a Pathway World. Tests: at least five non-curated genes end to end against recorded fixtures, plus one live run journaled.

## 6. Variation metric (P9.3.2)

For each gene: the scene inventory (which worlds, which representations, which targets exist), the journey (chapter titles, their worlds, their targets), and the capability vector. The metric is the mean pairwise Jaccard distance between the five sets on each axis, reported in a table with the per-gene inventories, so the claim "the journeys differ" has numbers under it. A unit test pins the inventories; a change in any set shows up in review.

## 7. What the app must change

- A gene chooser that lists the curated sets and accepts a symbol for dynamic mode (the welcome already takes a symbol).
- The bridge chain and the variant card driven by the set's variant records, including a deletion (three bases, no single changed base: the DNA World marks a span; the codon tape marks three codons).
- Protein World for a domain structure: the caption states the coverage; the bridge's numbering station handles an offset.
- Pathway World v1 (P9.1.2): a labelled, two-dimensional membership view (the gene's product among the pathway's participants), class 2, never a mechanism animation.
- The AI planner's capability discovery already reads the capabilities file; it gains the new worlds and the dynamic flag.

## 8. Tests and evidence (the gate, P9.4.1)

- Science suite per set: identifiers, transcript rule, sequence equality, variant normalisation (including the deletion), residue mapping, structure entity and chain, numbering, labels, provenance.
- The Phase 4 to 8 suites on HBB: unchanged results.
- The variation report with its numbers; the structure-limited gene's blueprint E end to end; the dynamic mode on five genes.
- Journals for every live retrieval; manifests with sources, releases, hashes and licences; the registry updated.

## 9. Risks and how they are handled

| Risk | Handling |
|---|---|
| Hardcoding per gene creeping in | the spec is data; a lint test fails on any gene symbol in `src/` outside the spec loader and the HBB fixtures |
| BRCA1 full-length structure | none exists; the domain coverage is stated; the predicted model carries its low-confidence bands |
| CFTR deletion mapping | the variant model gains a deletion kind; the DNA and codon views mark spans; tests on c.1521_1523del |
| Open Targets share-alike sources | dropped at parse time by datasource id; the kept list is in the registry |
| Rate limits | the HTTP cache and the recorded fixtures; live runs journaled and spaced |
| Scope | the order is P9.1.1 and P9.2.4 first (the fallback is required), then CFTR, then BRCA1 and SLC6A3, then dynamic mode, then the metric |

## 10. Order of work

1. P9.1.1 AlphaFold extension (per-residue pLDDT, PAE), fixtures recorded, tests.
2. The generic builder from `build-hbb.ts` with the HBB spec; byte-identical output check (`compare-builds.ts`).
3. P9.2.4 the structure-limited gene: the finder script, the set, blueprint E.
4. P9.2.1 CFTR with the deletion model; P9.1.2 Reactome and Pathway World v1; P9.2.2 BRCA1; P9.1.3 Open Targets; P9.2.3 SLC6A3.
5. P9.3.1 dynamic mode; P9.3.2 the metric; P9.4.1 the gate review.

## 11. P9.2.1 CFTR: the deletion, decided before the code (added 2026-11-03 after P9.2.4)

The reference variant is F508del, dbSNP rs113993960, HGVS c.1521_1523del on the MANE Select transcript (ENST00000003084), ClinVar VCV000007105. The deleted bases are the third base of codon 507 (ATC, Ile) and the first two of codon 508 (TTT, Phe): after the deletion codon 507 reads ATT (still Ile) and codon 508 is gone, so the protein change is p.Phe508del and the frame is kept. Every number above is a selection to be read back from the responses (Ensembl variation and variant recoder, VEP on the HGVS, the CDS map of c.1521 to c.1523), never typed into a record.

Rules:

1. **The specification.** `variant` gains `kind: "substitution" | "deletion"` (default substitution, so hbb.json is unchanged) and, for a deletion, `hgvsC` (the transcript-level HGVS the recoder must confirm) instead of `forwardAllele`; `rsId`, `clinvarUid`, `slug`, `commonName` stay. A deletion whose length is not a multiple of three is refused by the builder (a frameshift is out of scope for this phase; the refusal says so).
2. **The variant record.** Gains `kind`, `deletedSpan` (cDNA start and end, 1-based, closed), `affectedCodons` (every codon the span touches, with its reference bases, its bases after the deletion or null when it disappears, and its amino acid before and after), `proteinChange` in HGVS three-letter form computed by translating the codons, and `residue` (the deleted residue's UniProt position; for F508del 508). The substitution fields keep their names and meaning; a substitution record carries `kind: "substitution"`.
3. **Checks.** T23, T24 and T25 get a deletion branch: the reference codons translate to the reference residues at the affected positions in the UniProt sequence; the post-deletion codons translate to the residues VEP reports; the protein change equals VEP's HGVSp after normalisation; the deleted span length is a multiple of three. The genomic window (E8) is centred on the deleted span. The codon map (E9) covers the span.
4. **The structure.** The specification names `pdbId` as a selection, as for HBB, and `structurePreference: "variant-residue-observed"` as the recorded reason; the builder refuses the set if the selected entry does not observe the deleted residue in the mapped chain (a new check, T40: the variant residue is observed in atom_site through the verified SIFTS mapping). Candidates for CFTR are the human cryo-EM entries; the curator checks 6MSM first and 5UAK second and records in `notes` which was taken and why, with the resolution. The caption and the bridge say what the reference structure shows: the position of the residue that F508del deletes, not the mutant.
5. **Contacts.** Computed for the deleted residue in the selected entry with the usual cutoff; the record's text names the residue as "deleted in F508del".
6. **Questions in the set.** The specification gains `questions: [{ text, requires: [capability keys] }]`, written to a curated record `questions.json` (record kind `questions`), and `bridgeQuestion` (the question offered first after a DNA World variant answer). hbb.json gets today's four questions and the bridge question, so `questions.ts` in the app becomes a reader of the record and its HBB texts leave the code. CFTR's questions follow the same patterns the rule-based planner recognises (show where the variant affects the protein, how the DNA changes, what the residue touches, show the evidence) with CFTR's words.
7. **What the app shows.** DNA World marks the deleted span across the two codons (a region, not a single changed base); the codon tape marks codons 507 and 508; the variant card reads "c.1521_1523del: codon 507 ATC becomes ATT (Ile, unchanged), codon 508 TTT is deleted, p.Phe508del"; the comparison table shows the reference and the variant codons with the gap; the bridge's stations read codon 507 to 508 (CTT deleted), p.Phe508del, numbering 508 to the structure's residue, the structure's residue label; Protein World focuses the residue the deletion removes. The Phase 5 and 6 contracts for HBB stay byte-identical.
8. **Order.** Data side first (specification, builder, checks, the set, fixtures, tests, the questions record for HBB and CFTR with a byte-identical check of every other HBB file), then the app (the deletion in DNA World, the tape, the card, the bridge, the questions read from the record, the Phase 9 suite extended with CFTR scenarios), each verified before commit.

## 12. P9.1.2 Reactome and Pathway World v1, decided before the code (added 2026-11-03 after P9.2.1)

Pathway membership is a database annotation (class 2): it says that a protein takes part in a curated pathway, never how, and never that the variant changes the pathway. Pathway World v1 shows memberships and nothing more.

Rules:

1. **Adapter.** Reactome Content Service, species 9606 only: `data/mapping/UniProt/{accession}/pathways?species=9606` for the memberships (stable id, display name, whether it is a disease pathway, whether it has a diagram, the species), `data/pathway/{stId}/containedEvents` is not used in v1, `data/event/{stId}/ancestors` once per membership to find its top-level pathway, and `data/participants/{stId}/participatingPhysicalEntities` for the one pathway the record names as the primary (rule 3), keeping only the UniProt accessions of human proteins and their display names. Registry row with the release seen (`data/database/version`); licence CC0 for the data (diagrams and icons CC BY 4.0, not used in v1). URL builders validate the accession and the stable id form `R-HSA-\d+`.
2. **Specification and record.** `pathways: true | false` in the specification (hbb and cftr true, faah2 false unless its UniProt entry has memberships, which the builder reports either way); the record `pathways.json` (kind `pathway-memberships`): the accession, the Reactome release, the memberships sorted by stable id with their top-level pathway, and for the primary pathway its participants (accessions and names, the set's own protein flagged); provenance rows for every request; `derivedFrom` the protein record. A protein with no membership writes the record with an empty list and the capability says so.
3. **The opening pathway** (amended 2026-11-03 after the first live run; the first wording called it "the primary pathway" and claimed it was the most specific one). The rule stays mechanical, the membership with the fewest participants among the non-disease pathways that have a diagram, ties by stable id number, but it is only the pathway the world opens on, stated as the rule's choice and never as importance: on HBB it picks a microautophagy pathway in which haemoglobin is one substrate among sixteen, not an erythrocyte pathway. So the record keeps the participants of every candidate membership (they are fetched for the count anyway), the world lets the visitor open any membership, and no text calls one pathway primary. The specification may not name a pathway.
4. **Capability.** `pathwayView`: available when at least one membership qualifies for the opening rule, class 2, reason naming the membership count and the opening pathway as the rule's choice; unavailable with "no Reactome pathway lists this protein" (or the rule's sentence when memberships exist but none qualifies) otherwise.
5. **Pathway World v1 in the app.** A third world beside DNA and Protein (the switcher already lists three with Evidence; Pathway World takes the slot the capability report opens): a two-dimensional Instrument plate, no 3D, showing the opened pathway's name, its stable id, its top-level pathway and the release, and its participants as a field of named entities with the set's protein in the discovery colour; the memberships as a list the visitor can open, the rule's choice opened first and labelled as such; every label "Database annotation · class 2 · membership". No arrows, no reactions, no mechanism, no variant effect; the limitation line says so. Reduced motion and low power apply; axe 0.
6. **Journey and AI.** A chapter "Where the protein is listed" offered after the Protein World chapters when `pathwayView` is available; the planner context gains a `pathways` entry (memberships by stable id and name) so an explanation may cite a membership with its evidence class; one question per set with pathways in the questions record ("Which pathways list CFTR?"), requiring `pathwayView`; no new AI action in v1 (the world opens through the switcher, the chapter, or the existing world-switch action).
7. **Order.** Data side first (adapter, fixtures recorded live once, specification flag, record, capability, tests, HBB byte-identical except the new record and capability line), then the app (world, chapter, context entry, question, Phase 9 suite scenarios), each verified before commit.

## 13. P9.2.2 BRCA1: a domain structure, decided before the code (added 2026-11-03 after P9.1.2)

BRCA1 (UniProt P38398, 1,863 residues) has no full-length experimental structure; it has domain structures (the RING domain with BARD1, the BRCT repeats) and an AlphaFold model with long low-confidence stretches. The set must say exactly what the structure covers and never let a predicted model stand in for the rest.

Rules:

1. **The variant** is a substitution whose residue lies inside an experimentally observed domain, so that the residue can be shown: the candidate is C61G (dbSNP rs28897672, the RING domain), ClinVar record confirmed live. A frameshift such as 185delAG is out of scope (plan section 11 rule 1) and is not selected. Every number is read from the responses as for HBB.
2. **The structure** is selected by the candidate check of section 11 rule 4: 1JM7 (the RING domain heterodimer with BARD1, solution NMR) first, then any other entry that observes the residue, wild type over the mapped segment; `structurePreference: "variant-residue-observed"`; T40 applies. The entry's method may be NMR: the structure record then carries `resolution: null`, the number of models in the ensemble, and states that model 1 is the one shown; the mmCIF reader must accept an entry without `_refine` and without `_em_3d_reconstruction`.
3. **Coverage is a first-class fact.** The structure record gains `coverage` for the mapped chain: the UniProt range observed (first and last mapped position, the count of observed positions), the protein's length, and the fraction, from SIFTS and the atom records. The capability `experimentalStructure` reason names it ("1JM7 covers residues 1 to 109 of 1,863 (RING domain, solution NMR); no full-length experimental structure"); the app's caption, the Protein World card and the known limitations state it in words; the bridge's numbering station is unchanged (the offset comes from the mapping as always).
4. **The partner chain** (BARD1 in 1JM7) is a second entity: the structure record names it with its UniProt accession from the entry's own cross-references, the contacts of residue 61 may list its residues as inter-chain contacts, and the Protein World caption names the partner as "with BARD1 (chain B)"; nothing claims a mechanism.
5. **The predicted model** record carries the pLDDT band fractions from the prediction record (P9.1.1), and the caption's predicted line states the share of very-low and low confidence ("AlphaFold model listed, not loaded; 47 % of residues at very low confidence"); the number is read from the record, never typed.
6. **Pathways and questions** as for the other sets: `pathways: true`, four questions in BRCA1's words (show where C61G affects the protein, how the DNA changes, what the residue touches, show the evidence) plus the pathway question and the bridge question.
7. **Checks.** T40 (residue observed); a new T47: the selected entry's method is one of X-ray diffraction, electron microscopy or solution NMR, and an NMR entry has at least one model and no resolution; T48: the coverage fraction equals the count of mapped observed positions over the protein length and the record's words match the numbers.
8. **Order.** Data side (spec, candidate check live, builder changes, set, fixtures, tests, HBB and CFTR byte-identical except the new coverage field in their structure records if the field is added for every set, which it is, and the predicted record's fractions), then the app (the caption's method, models and coverage rows, the predicted line, the partner name, the limitation line, Phase 9 suite scenarios for BRCA1), each verified before commit.

## 14. P9.1.3 Open Targets, decided before the code (added 2026-11-03 after P9.2.2)

An Open Targets association is a database annotation (class 2) that scores the evidence linking a target to a disease; it is never a causal statement and never a diagnosis. The set carries the associations so that Evidence World can show them and an explanation can cite them; no world and no AI action is built on them.

Rules:

1. **Adapter.** One POST per gene to `https://api.platform.opentargets.org/api/v4/graphql` with a query that fetches `meta { apiVersion { x y z } dataVersion { year month } }` and `target(ensemblId) { id approvedSymbol associatedDiseases(page: { index: 0, size: 25 }, orderByScore: true) { count rows { disease { id name therapeuticAreas { id name } } score datatypeScores { id score } datasourceScores { id score } } } }`; the terms discourage one-entity querying, so the builder asks once per set and records the response, and dynamic mode (P9.3.1) will not call it. The licence table of the registry decides which datasources may be kept: `datasourceScores` entries from share-alike or restricted sources (ChEMBL, Human Protein Atlas, Cancer Gene Census, Europe PMC as the registry lists them) are dropped at parse time and the record names the dropped ids; the overall score is kept as the platform computes it and the record says it includes dropped sources. Registry row with apiVersion and dataVersion seen; licence CC0 1.0 for the platform.
2. **Specification and record.** `associations: true | false` in the specification (true for the four sets); the record `associations.json` (kind `disease-associations`): the Ensembl id, the platform's api and data versions, the count, the rows kept in score order with disease id (EFO or equivalent), name, therapeutic areas, overall score, datatype scores, the kept datasource scores and the dropped datasource ids; a sentence "association, never causal; a score aggregates evidence, it does not state that the gene causes the disease"; provenance rows; `derivedFrom` the gene record. A set with zero associations writes the record with an empty list.
3. **Capability.** `associationView`: available when at least one association is kept, class 2, reason naming the count and the top association's name and score; unavailable with "no Open Targets association for this gene" otherwise.
4. **In the app.** Evidence World gains a section "Disease associations (Open Targets)" listing the kept rows with their scores as a plain table, the class 2 chip, the platform version and the never-causal sentence, and the dropped datasources named; the side panel does not show associations; the planner context gains an `associations` entry (disease id, name, score) with the class 2 evidence so an explanation may cite one with its score and never as a cause; a question per set ("What diseases are associated with CFTR?") requiring `associationView`, answered by revealing the record's evidence (no world switch); the known limitations gain one line for the never-causal rule when the set has the record.
5. **Checks.** T49: every kept row has a disease id, a name and a score between 0 and 1; T50: the rows are in descending score order and no dropped datasource id remains in the kept scores; T51: the record's versions equal the meta of the same response.
6. **Order.** Data and app in one step (small), each repository verified before commit; HBB, CFTR, FAAH2 and BRCA1 change only by the new record, the capability line, the question and the limitation.

## 15. P9.2.3 SLC6A3, decided before the code (added 2026-11-04 after P9.1.3)

SLC6A3 (the dopamine transporter, UniProt Q01959, 620 residues) is the generalisation test: a transporter with recent human structures and a small set of pathogenic variants (dopamine transporter deficiency syndrome, recessive). The set must come out of the existing builder with no new record kind and the app must run it with no new app code; only rules, data and suite scenarios are added.

Rules:

1. **The variant is chosen by rule, not by hand**, as the structure and the structure-limited gene were: a finder (`scripts/data-preparation/find-variant.ts --gene <symbol>`) asks ClinVar once for the gene's missense variants classified Pathogenic or Likely pathogenic with review status of at least "criteria provided, multiple submitters, no conflicts" (two stars), reads their summaries once, ranks them by review status, then by number of supporting submissions, then by ClinVar accession number, and takes the first whose protein position is observed in the structure the candidate check selects (rule 2). The report (every candidate with its verdict) goes to `research/derived/variant-search-<symbol>-<date>.json`; the specification's `notes` names the rule and the report. The chosen variant must be a substitution (plan section 11 rule 1 applies to any deletion); a frameshift or nonsense candidate is skipped with its reason.
2. **The structure** is selected by the candidate check over the UniProt entry's PDB cross-references that cover the candidate residue, wild type over the mapped segment, residue observed (T40); human DAT entries are expected to be cryo-EM; the check records which were refused and why.
3. **Everything else is the builder as it is:** pathways and associations on, four questions in SLC6A3's words plus the pathway and association questions and the bridge question, fixtures recorded with redaction, the set rebuilt from them byte-identically, coverage stated, the predicted model's bands recorded.
4. **The app changes nothing but its suite:** a Phase 9 scenario set for SLC6A3 (welcome, DNA World with the variant card, the bridge to the structure residue, the contacts, Pathway World, Evidence World with the associations, axe). If any app code has to change for SLC6A3 to run, that is a finding against the generalisation and is recorded as such in the journal with the exact change.
5. **Dynamic mode (P9.3.1) and the metric (P9.3.2) follow**, with five sets to measure.

Amendment to section 15 (2026-11-04, after the run): ClinVar holds no missense record for SLC6A3 at two stars or above (six records: three at one star, three at none), so rule 1's own pass chose nothing and the one-star fallback the rule allows took R85W (VCV000421417.2, Likely pathogenic, single submitter), stated in the specification's notes, the two search reports and the record (`reviewStars: 1`). The app runs the set with no source change; two builder checks carried HBB-shaped assumptions and were generalised (T13 assumed a multi-allelic site; T16 required a UniProt natural variant at the position), recorded as findings in `docs/scientific-validation.md`.

## 16. P9.3.1 dynamic mode, decided before the code (added 2026-11-04 after P9.2.3)

Dynamic mode gives a recognised human protein-coding gene that has no curated set an honest, smaller journey built at request time from live retrievals, through the same builder and the same capability discovery. It never pretends to be curated.

Rules:

1. **Scope of a dynamic set.** The gene (HGNC by symbol or alias, then Ensembl), the MANE Select transcript by the existing rule, the sequences, the UniProt entry, the AlphaFold prediction record, the capability report. No experimental structure is selected (there is no reviewed selection and no candidate check at request time), so `experimentalStructure` is unavailable with the reason "no experimental structure selected in dynamic mode; N entries cross-referenced" when the UniProt entry cites entries, and the Protein World card says so; no variant (a visitor may later name a dbSNP id, a later step); pathways and associations off (the Reactome and Open Targets terms discourage one-entity querying from every visitor's browser, and the curated path records them once). So a dynamic set has FAAH2's shape: DNA World, the transcript and codon chapters, the protein record, the predicted model listed, Evidence World with the live sources and their retrieval times.
2. **Where it runs.** In the visitor's browser, in a worker: the scientific core and the HTTP client are platform-agnostic; the requests go to Ensembl REST, HGNC, UniProt and AlphaFold DB (all CORS-open as the registry measured), with the client's rate limits and retries, no identifier added to any request (the browser's own user agent applies). The built files stay in memory; the loader takes them through the same path as a copied set, with the hash check replaced by the in-memory manifest the builder just wrote. `generator.mode` is `"dynamic"`, `generatedAt` is now, and every source row carries its retrieval time.
3. **What the visitor sees.** On the welcome, a symbol that resolves to no curated set offers "Retrieve live" beside the existing not-curated message: the loading gauge (the Phase 7 component) shows each request as it completes and is verified by its schema; failure is the existing error state with the failing source named; success opens the set under `?gene=<symbol>&mode=dynamic` with a banner "Retrieved live at <time>, not curated" that stays on screen, one extra limitation line, and the caption line of plan section 5. Nothing is stored between visits.
4. **Checks.** The same validation runs (every check that applies to a set without a structure and without a variant); a failing check refuses the set as it refuses a curated build, and the error names the check.
5. **Tests.** The builder's dynamic path against recorded fixtures for five non-curated genes (chosen once, recorded once by a script in `scripts/data-preparation/record-dynamic-fixtures.ts`: TP53, EGFR, INS, APOE, HBA1; they are test inputs, not curated sets, and their fixtures live under `data/fixtures/dynamic/<symbol>/`); the app's dynamic flow against those fixtures through the e2e fetch interception (no network in the suite) for at least two of them, plus one live run behind `HELIX_LIVE=1`, journaled with its timings. The capability report of each must say experimentalStructure unavailable with the dynamic reason, predictedStructure as found, pathwayView and associationView unavailable with "not requested in dynamic mode".
6. **Limits stated.** The known limitations of a dynamic set say: not curated, no reviewed structure or variant selection, no pathway or association retrieval, built in this browser at this time from these releases. The AI planner's context for a dynamic set carries `mode: "dynamic"` and the same sentence, so an explanation says it.
