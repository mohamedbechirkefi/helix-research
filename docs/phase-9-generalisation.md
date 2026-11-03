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
