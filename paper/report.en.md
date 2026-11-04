<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# Helix: evidence-bound, AI-directed exploration from genome to protein structure

## Technical report, English master

| | |
|---|---|
| Author | Mohamed Bechir Kefi |
| Version | Working draft 0.7, 2026-11-03 |
| Status | Chapters 1 to 8, 9.1 to 9.3, 10 and 11 drafted (Phases 0 to 6). Sections 9.4 to 9.9 are headed placeholders. |
| Companion files | Claims register `paper/claims.md`; experiment journal `journal/` |
| French copy | `paper/report.fr.md`, first produced after Phase 4 (see `paper/README.md`) |
| Licence | Helix Source-Available Non-Commercial Research License v1.0 (see `LICENSE`) |

**Nonclinical notice.** Helix is a research and education project. Nothing in this report is a diagnosis, a variant interpretation for an individual, or medical advice. ClinVar classifications are reported as records, not as guidance.

**How to read the evidence.**
- Claim identifiers such as **[C07]** refer to rows of `paper/claims.md`.
- Journal identifiers such as `HX-P1-2026-11-01-hbs-mapping` refer to entries in `journal/`.
- Every number in this report comes from one of them. The Phase 1 and Phase 2 journal entries were written retrospectively on 2026-11-01 from the recorded evidence; they say so in their first line.

---

## Contents

1. Introduction
2. Scientific background
3. Related work
4. Data and scientific model (Phases 1 and 2)
5. Rendering feasibility (Phase 1)
6. Desktop feasibility (Phase 1, amendment A-1)
7. Data core and validation (Phase 2)
8. Local and browser AI: feasibility and evaluation (Phase 3)
9. Later phases (Phases 4 to 12) [placeholders]
10. Limits and threats to validity
11. Ethics, licensing, privacy and cost
12. AI-use declaration
13. Reproduction
14. Bibliography

Annex A. Phase map and evidence index

---

## 1. Introduction

### 1.1 Problem

A person who reads that sickle-cell disease is caused by "a single letter change in the beta-globin gene" has no simple way to see what that sentence means at each scale. The change lives in several places at once:

- a position on chromosome 11;
- a codon in a transcript;
- an amino acid in a protein;
- a valine on the surface of a crystallised haemoglobin tetramer.

The public resources that hold each of these facts are excellent but separate: Ensembl for genomes and transcripts, UniProt for proteins, the Protein Data Bank for structures, ClinVar for clinical assertions. Each uses its own coordinate system and numbering convention. Moving between them correctly is expert work. This report documents one concrete trap: for the very structure most often used to show sickle haemoglobin, PDB entry 2HBS, the numbering in the deposited file disagrees by one position with current UniProt numbering (section 4.4).

Large language models make it tempting to answer a natural-language question by having a model "drive" a molecular viewer. The same models produce plausible but wrong identifiers. In the desktop experiment of this project, a local model asked to show the sickle-cell structure returned a well-formed plan for the wrong PDB entry (section 6.4) [C23].

### 1.2 Aim

Helix is an interactive environment in which real scientific data, not a model's recollection, determines what is shown. A user's question may be interpreted by an AI model. The model's output is only a proposed plan of typed actions. A deterministic executor checks every identifier against verified records before anything changes on screen, and every displayed fact carries its provenance.

The product goal is a cinematic, cross-scale journey from DNA to protein structure. The research goal, which this report covers, is to establish with evidence:

1. that the scientific mapping across scales can be computed and verified from public sources, without hand-typed positions (chapters 4 and 7);
2. that a mature molecular renderer can be coordinated with a cinematic 3D layer without losing scientific fidelity (chapter 5);
3. that the same code can run as a web application and as a desktop application with local AI (chapter 6);
4. which free AI models, if any, can propose plans reliably enough to be useful once every plan is validated (chapter 8, Phase 3);
5. that the full pipeline, from question to validated action to rendered world, works end to end (chapters 9.1 onward).

### 1.3 Scope of the first slice

The first vertical slice is a single gene and a single variant: HBB (beta-globin) and the HbS allele, the cause of sickle-cell disease. The slice was chosen because:

- it is scientifically well characterised;
- it has an experimental structure of the mutant protein (2HBS);
- it exercises every hard part of the mapping: a reverse-strand gene, a multi-allelic rsID, initiator-methionine removal, legacy numbering, and a contact that lies outside the default biological assembly.

Generalisation to other genes is Phase 9.

### 1.4 Method and Phase 0

The project follows a written roadmap (`helix/ROADMAP.md`, private continuity file) with phases 0 to 12. Each phase has tasks, deliverables, evidence and a gate review. A progress file records state, decisions and session history.

Phase 0 established:
- the repositories: a public research repository under a non-commercial source-available licence, and a private product repository;
- the continuity files;
- an audit of the reference machine (Apple M1 Pro, 10 cores, 16 GB, macOS 15.3.1);
- the toolchain policy: free user-space installs only, versions pinned to releases at least two weeks old.

Three rules from the research workspace apply throughout:
- every experiment is journaled, negative results included;
- every number links to evidence;
- every claim has a row in the claims register.

These rules were adopted for Helix on 2026-11-01 (workspace decision D-053). Phases 0 to 2 were then backfilled from existing evidence.

### 1.5 Contributions so far

- A verified, source-by-source mapping of HbS from GRCh38 coordinate to 2HBS residue, with every step confirmed by two or more independent records (chapter 4) [C04 to C09].
- Documentation of a numbering inconsistency inside the 2HBS file that would make a naive parser highlight the wrong residue (section 4.4) [C08].
- Evidence that Mol*'s default view of 2HBS cannot show the HbS lateral contact, and why (section 4.5) [C10, C11].
- A measured feasibility study of coordinating Mol* with a React Three Fiber canvas, leading to a recorded architecture decision (chapter 5) [C13 to C19].
- A measured feasibility study of a Tauri desktop build with local AI (chapter 6) [C20 to C23].
- A curated, reproducible HBB dataset built by code from live sources, with 46 scientific checks that fail closed (chapter 7) [C24 to C26].

---

## 2. Scientific background

This chapter summarises the concepts Helix depends on. The full guide, with sources for each statement, is `docs/scientific-research.md` (21 sections). The conventions and pitfalls are in `docs/scientific-model-and-coordinate-mapping.md`.

### 2.1 From genome to protein

- **DNA** is double-stranded. A gene may be read from either strand. HBB lies on the reverse strand of chromosome 11, so its coding bases are the complements of the forward-strand bases that genome browsers and VCF files report.
- **Reference assemblies** (GRCh38, and the older GRCh37) define the coordinates. The same base has different positions in the two assemblies; Helix displays GRCh38 only.
- **A gene has many transcripts.** Choosing one by length or list order is a known source of error. The MANE Select set, a joint NCBI and EMBL-EBI effort, designates one transcript per protein-coding gene that is identical in Ensembl and RefSeq. HGVS recommends it for describing variants in humans.
- **Translation** reads the coding sequence (CDS) codon by codon from the ATG. HGVS numbers coding positions from c.1 at the A of the ATG, and protein positions from p.1 at the initiator methionine.

### 2.2 Variants and their names

- **A dbSNP identifier is not an allele.** rs334 has four alleles at the same position (T, A, C, G); only one of them is HbS [C05].
- **HGVS** gives the genomic (g.), coding (c.) and protein (p.) descriptions; **SPDI** gives an unambiguous 0-based description. Helix converts between them in code and checks the conversion (check T10).

### 2.3 Protein numbering and structures

- **UniProt** numbers residues from the initiator methionine. For beta-globin, that methionine is removed in the mature protein, so the classical haemoglobin literature calls the sickle mutation "Glu6Val" (E6V), while HGVS and UniProt call the same change p.Glu7Val.
- **PDB entries** carry two residue numbering schemes:
  - `label_*`: the sequential scheme of the mmCIF;
  - `auth_*`: the author's scheme.

  They often coincide but are not guaranteed to. The mapping from UniProt to a PDB residue should come from SIFTS, the residue-level mapping maintained by PDBe, or from an explicit alignment.
- **Asymmetric unit and biological assembly.** A crystal's asymmetric unit may hold several copies of a molecule. A biological assembly is a chosen subset or symmetry expansion. In 2HBS the asymmetric unit holds two haemoglobin tetramers, and assembly 1 is only the first of them.

### 2.4 Evidence classes

Helix labels each displayed statement with one of six evidence classes, defined in `packages/shared-types`. Examples: experimental observation in a deposited structure (class 1); a curated database record (class 2); computed from records (class 3); an inference (class 4). An AlphaFold prediction is labelled as predicted and is never used to place a variant (check T32).

---

## 3. Related work

The full analysis is `docs/competitor-analysis.md`. It covers thirteen tools and three works of molecular storytelling on eight dimensions: capabilities, limitations, extensibility, licence, performance, accessibility, visual design, and AI support. Its method distinguishes facts from a cited primary source, inferences with stated reasoning, and assumptions still to test. This chapter summarises what matters for Helix.

### 3.1 Genome and protein resources

**Genome browsers.**
- Ensembl provides the REST API used here (release 116).
- The UCSC Genome Browser and IGV are coordinate-track viewers with documented APIs. Neither has a protein-structure view.
- The Ensembl platform is in transition: release 116 was announced as the final release on the current platforms, and the REST repository was archived on 2026-10-16. This is a recorded risk for Helix [Ensembl 116 news; Ensembl new website news].

**Protein-centric viewers.**
- UniProt's feature viewer (built on Nightingale web components) links sequence features to a structure panel.
- AlphaFold DB links predicted aligned error to a 3D view.
- These viewers are linked rather than unified across scales.

### 3.2 Molecular viewers and declarative scenes

- **Mol\*** is the structure viewer of RCSB PDB and PDBe [Sehnal et al. 2021]. It offers four integration levels, from a ready-made viewer to a bare canvas. Click-to-focus with surroundings is standard on rcsb.org.
- **MolViewSpec** (MVS) is a declarative, validated JSON format for molecular scenes, implemented as a Mol* extension [Midlik et al. 2025].
- **iCn3D** synchronises 1D, 2D and 3D views and supports ClinVar annotation tracks.

### 3.3 Molecular storytelling

- **MolViewStories** already provides authored, narrated, multi-scene molecular stories with transitions and interactive text, built on MVS [Slanináková et al. 2026].
- **PDB-101 Molecule of the Month** tells the haemoglobin and sickle-cell story and links 2HBS; it uses the mature "glutamate 6" numbering [PDB-101 Hemoglobin].
- Helix therefore does not claim novelty for storytelling, residue highlighting or declarative scenes [C29].

### 3.4 AI-driven viewers

The closest neighbour to Helix's AI layer is on the unreleased Mol* master branch: an agent harness and viewer agent with typed tools, undo, approval policies and handling of untrusted text [Mol* packages/ai; Mol* Prism agent spec]. It is general-purpose and bring-your-own-key. If it ships, Helix's structure-level AI actions will look like a subset of a free upstream feature (risk R1 in the analysis).

### 3.5 Position of Helix

The analysis found no neighbour that ties one validated action plan to genome, protein and structure coordinates at once, with a provenance record per action [C28]. That combination is the proposed differentiation, together with:
- deterministic replay of plans without a model;
- cross-scale transitions;
- an offline desktop build with local AI.

This is an inference from the sources read on 2026-11-01, not a claim of being first. Two assumptions in the analysis need a user study, not an expert opinion:
- that a continuous journey is clearer than linked viewers;
- that premium interaction aids comprehension.

---

## 4. Data and scientific model (Phases 1 and 2)

### 4.1 Questions

1. Can every record the HBB slice needs be obtained free, without authentication, with enough provenance to cite each value?
2. Can the HbS allele be mapped from genome to structure without any hand-typed position, with each step confirmed independently?
3. Can a browser call the sources directly?

### 4.2 Sources and acquisition

A standard-library script fetched each record from fourteen public sources on 2026-11-01, between 18:14:50Z and 18:30:30Z:
- Ensembl (GRCh38 and the GRCh37 service), UniProt, RCSB, PDBe/SIFTS, AlphaFold DB;
- NCBI ClinVar and NCBI Gene, HGNC;
- Reactome, InterPro, QuickGO, Gene Ontology, Open Targets.

Each response is stored with a manifest row giving the UTC time, HTTP status, sha256, size, URL and release headers. The manifests list 40 records, all returned with HTTP status 200 [C01]. No key, account or payment was needed, and the project has spent $0 [C02].

Table 4.1. Releases in the snapshot (`research/raw/README.md`, `docs/data-source-registry.md`).

| Source | Release | Data licence (summary) |
|---|---|---|
| Ensembl | 116 (REST 15.12) | Without restriction; third-party content excepted |
| UniProt | 2026_03 (2026-09-02) | CC BY 4.0 |
| RCSB PDB, PDBe/SIFTS | 2HBS revision 1.5 (2026-08-12) | CC0 1.0 |
| AlphaFold DB | model v6 | CC BY 4.0, in-file disclaimer kept |
| ClinVar | Build261025-1250.1 (2026-10-25) | US government work; submitter caveat |
| HGNC | lastModified 2026-10-30 | CC0 |

Two curation steps were applied (`journal/2026-11-01-raw-snapshot.md`).

- **Proprietary identifiers removed** [C03]:
  - OMIM/MIM numbers in the UniProt, HGNC, NCBI Gene and ClinVar records;
  - HGMD accessions in VEP output.

  These point to resources whose terms do not allow redistribution. The author decided to keep only data Helix needs. Each redacted file keeps, in its manifest row, the hash of the original response.
- **Error pages removed.** Two Ensembl HTTP 500 error pages were deleted; the valid retry was kept.

### 4.3 The mapping from genome to residue

Table 4.2 gives the mapping and the records that confirm each step. The full derivation, with every URL, is `research/hbs-mapping-note.md`.

Table 4.2. HbS across layers (`journal/2026-11-01-hbs-mapping.md`).

| Layer | Value | Confirmed by |
|---|---|---|
| Gene | HBB, ENSG00000244734.6, GRCh38 chr11:5225464-5229395, reverse strand [C04] | Ensembl lookup |
| Transcript | ENST00000335295.4 = NM_000518.5, MANE Select, 628 nt in three exons [C04] | Ensembl, HGNC, UniProt |
| Codon | codon 7 = GAG, c.20 = A; genome 11:5227001-5227003 | Ensembl sequence and `map/cds` |
| Allele | rs334 has alleles T/A/C/G; HbS is allele A: NC_000011.10:g.5227002T>A, c.20A>T, p.Glu7Val [C05] | Ensembl variant_recoder, ClinVar |
| Protein | Translated CDS = ENSP00000333994.3 = UniProt P68871, 147 aa [C06] | Biopython translation, Ensembl, UniProt |
| UniProt annotation | VAR_002863 at position 7, E to V, dbSNP rs334 | UniProt |
| Mature numbering | Met1 removed, chain 2-147, so p.7 = mature 6 ("E6V") | UniProt features; 2HBS `pdbx_mutation` |
| Structure | 2HBS entity 2, beta chains B, D, F, H: label_seq_id 6 = auth_seq_id 6 = VAL [C07] | SIFTS, RCSB alignment, UniProt PDB cross-reference, `atom_site` |
| Clinical record | VCV000015333.183, Pathogenic (criteria provided, multiple submitters, no conflicts) [C09]; version .184 at the Phase 6 rebuild (section 9.3) | ClinVar |

Three points deserve emphasis.

- **The strand flip.** Because HBB is on the reverse strand, the HbS change is T>A on the forward strand of the genome and A>T on the coding strand. Check T09 verifies the complement from the genomic window.
- **The rsID is not the variant.** At the same position, allele C gives p.Glu7Gly and allele G gives p.Glu7Ala (Hb G-Makassar). Helix keys the variant to the allele and its HGVS g. description, never to rs334 alone.
- **The aggregated ClinVar trait list is not a list of effects.** The record's trait list collects traits from all submissions, including beta thalassemia and malaria susceptibility. Helix stores only the count, with that note, and makes no causal statement from it.

### 4.4 A numbering inconsistency inside the structure file

The 2HBS mmCIF contains its own reference to UniProt P68871:
- `_struct_ref_seq` aligns the beta chains to positions 1-146;
- `_struct_ref_seq_dif` places the variant at P68871 position 6.

Current UniProt numbers the same glutamate as 7. The file uses the mature, legacy numbering while naming the UniProt accession.

SIFTS, the RCSB alignment record and UniProt's own cross-reference all map UniProt 2-147 to residues 1-146. They agree with each other and disagree with the file.

A parser that trusts the file's reference categories would select label 7 in chain B, which is a GLU, not the mutant VAL [C08]. Helix therefore takes SIFTS as the mapping of record. It cross-checks it with its own global alignment (offset 1, identity 0.9932, a single mismatch at the variant), and it records in the dataset what `_struct_ref_seq` would have selected (check T25).

Two further cautions follow from the same file:
- label and auth numbering coincide for every polymer residue in 2HBS, but not for non-polymers: the heme with label chain J has auth chain B and auth number 153;
- the offset of one is a property of this protein and this entry. Helix computes it per entry and never hard-codes it.

### 4.5 Where the mutant valine touches another molecule

The structure's primary citation describes the sickle fibre's double strand as stabilised by "lateral contacts involving the mutant valine interacting with a pocket between the E and F helices on another tetramer" [Harrington et al. 1997].

Within the deposited asymmetric unit (4.5 A cutoff, side-chain atoms of residue 6, no symmetry mates):
- only chain H's valine contacts another chain: chain B residues Ala70, Asp73, Thr84, Phe85 and Leu88;
- the valines of chains B, D and F make no inter-chain contact in the file [C10].

Table 4.3. Val6 contacts in the 2HBS asymmetric unit (`research/derived/val6_contacts_2HBS.json`).

| Beta chain | Contacts within 4.5 A |
|---|---|
| B | none |
| D | none |
| F | none |
| H | B: ALA 70, ASP 73, THR 84, PHE 85, LEU 88 (and two waters) |

**Inference (not verified):** the H-to-B contact is the lateral contact the authors describe, seen once inside the asymmetric unit. The other three valines presumably make the same kind of contact with symmetry-related tetramers that are not in the file.

Assembly 1 (chains A to D), which is what a viewer shows by default, contains no such contact [C11]. Helix must therefore load the asymmetric unit for this view and label the contact as a contact in the crystal, not as an observation in cells.

### 4.6 Direct browser access

Each source was probed with a preflight request and a GET carrying an Origin header [C12]. Every source answered the GET with an `Access-Control-Allow-Origin` that admits a web page, but with three constraints:
- the preflights of files.rcsb.org, models.rcsb.org and HGNC fail, so requests to them must stay "simple" (no custom headers);
- Ensembl exposes no response headers, so a browser cannot read its `Retry-After` and must back off blindly;
- a browser cannot set `User-Agent`, and NCBI's `email` parameter would expose an address in a public bundle. Helix sends `tool` only.

Consequences for the design:
- the curated journey works offline from bundled data;
- live calls are an enhancement behind adapters with timeouts, retries and a per-source token bucket set below each documented limit.

---

## 5. Rendering feasibility (Phase 1)

### 5.1 Question

Should Helix draw molecular structures and the cinematic layers (DNA, chromosome, cell, transitions) in one shared canvas, or in separate renderers kept in step by a shared state? The master prompt asks for coordination to be prototyped before a unified canvas is considered.

### 5.2 Mol* embedded in a web page

Mol* 5.13.1 was embedded in a Vite and React page, loading 2HBS and targeting chain H residue 6 (`journal/2026-11-01-molstar-embed.md`). Measurements were taken in headless Chrome 156 with the Apple GPU (ANGLE Metal), one fresh browser context per run.

Table 5.1. Mol* load and interaction times on the reference Mac [C13].

| Measure | Imperative API, local file | MVS, local file | Imperative API, files.rcsb.org |
|---|---|---|---|
| Plugin creation | 90 ms | 96 ms | 92 ms |
| Load to first draw | 237 ms | 338 ms (whole `loadMVS`) | 718 ms |
| Residue action to next draw | 224 ms | part of `loadMVS` | 220 ms |
| Frame interval while spinning, vsync off | p50 3.1, p95 3.9 ms | p50 2.9, p95 3.8 ms | p50 3.1, p95 3.9 ms |

- With vsync on, every condition held 16.7 ms frames. The RCSB download time varies with the network (1081 ms on the repeat run).
- The JavaScript bundle was 1,120.8 kB gzip, without code splitting.

The decisive result is the **read-back** [C14]. The page asked Mol*'s own selection and focus managers what was selected. The answer was chain H, label 6 = auth 6, VAL, entity 2, 7 atoms. A simulated pointer click on the residue also resolved to `VAL H6`. Helix can therefore verify that the residue on screen is the residue the evidence names, rather than trusting its own variables.

**Negative finding.** The first run failed with "target not found". Mol*'s default preset builds assembly 1, which does not contain chain H (section 4.5) [C11]. Loading the model, that is the asymmetric unit, fixed it. A default that looks harmless would have shown the wrong scene.

### 5.3 MolViewSpec as a declarative target

The same view was written as MolViewSpec: a 3.1 kB file, valid under the format's validator. MVS declared everything a static view needs:
- the model, and the residue by label numbering;
- the contact residues, the representation and colour;
- a 3D label, a tooltip, the camera focus and the background.

It could not express [C15]:
- Mol*'s selection state;
- the hover highlight;
- the focus representation with surrounding interactions;
- any event;
- an incremental change without loading a new state.

**Decision** (`docs/competitor-analysis.md`, reuse decision):
- MolViewSpec is Helix's declarative format for curated snapshots, exports and as a constrained target for compiled plans.
- The imperative API handles interaction and read-back.
- The AI model never writes MVS directly. It emits typed Helix actions, which deterministic code compiles.

### 5.4 Coordinating Mol* with a React Three Fiber canvas

A second experiment placed an illustrative DNA helix, built from the real HBB coding sequence and drawn with React Three Fiber (R3F), beside or over the Mol* view (`journal/2026-11-01-molstar-r3f-bridge.md`).
- A store of about twenty lines held the shared selection. Neither renderer called the other.
- Codon k maps to UniProt position k, mature residue k-1 and 2HBS label k-1. Codon 1 has no structure residue, and the page says so.

**Results.**

- **Correct identifiers in both directions** [C16]:
  - A real click on codon 7 in the DNA made Mol* select and focus 2HBS chain H residue 6. Mol*'s read-back was `VAL H6`, 63 ms after the store update in the side layout and 68 ms in the overlay.
  - Clicks on Mol* residues PRO H5, VAL H6, VAL H126, THR H12 and ALA H13 produced codons 6, 7, 127, 13 and 14, all correct.
  - A mapping check on each load compares codons 2 to 14 with the structure. Twelve of thirteen match, and the one mismatch is codon 7 (GAG, glutamate) against VAL: the sickle substitution itself, which is exactly what the check should report.
- **Performance** [C17]:
  - With vsync on, both canvases together held 16.7 ms frames in every configuration, with no frame over 20 ms.
  - With vsync off and both canvases animating, the mean frame time was 2.50 ms side by side and 4.15 ms overlaid, against 1.71 ms for Mol* alone and 1.47 ms for R3F alone.
  - Mol*'s cost scales with its canvas area.
  - The page used exactly two WebGL2 contexts.
- **Pointer ownership** [C18]. In the first overlay, one click reached both renderers and produced two store updates. The fix is a single pointer owner at any time, set by the world state's phase.
- **Open anomaly** [C19]. A single long frame of 290 to 400 ms appeared at the start of each Mol* spin in the bridge page, and not in the Mol*-only page. It is unexplained and is carried to Phase 4.

Table 5.2. Frame cost with vsync off, mean / p95 in ms (`research/experiments/molstar-r3f-bridge/README.md`).

| Configuration | Side by side | Overlay |
|---|---|---|
| Both idle (R3F still rendering) | 1.36 / 2.7 | 1.36 / 2.7 |
| Mol* spinning | 2.50 / 3.9 | 4.16 / 7.5 |
| R3F spinning | 1.26 / 2.7 | 1.27 / 2.8 |
| Both spinning | 2.50 / 4.0 | 4.15 / 7.4 |
| Baseline, Mol* only | 1.71 / 3.1 | n/a |
| Baseline, R3F only | 1.47 / 2.8 | n/a |

These are main-thread frame intervals on a fast laptop, not GPU timers, and not low-end hardware.

### 5.5 Decision

Helix uses **coordinated canvases** (`docs/rendering-integration-decisions.md` §4):
- Mol* owns every real molecular structure; R3F owns the illustrative and cinematic layers.
- One authoritative world-state store drives both, including pointer ownership.
- Transitions are choreography (camera moves, cross-fades, shared colour tokens), not shared geometry.

A geometric fly-through from the DNA into atoms was not attempted. It would need a world transform between an illustration and real coordinates, which has no scientific meaning and would have to be labelled as illustrative. A unified canvas will be reconsidered only if Mol* documents a way to share a scene with three.js, or a measured need appears that coordination cannot meet.

---

## 6. Desktop feasibility (Phase 1, amendment A-1)

### 6.1 Question

Amendment A-1 (author, 2026-11-01) adds a macOS desktop build of the same web code, with local AI and offline journeys. The question was whether this is feasible with free tools and without changing the web code.

### 6.2 Design

- A Tauri 2 application loads the unchanged web build from section 5.2 (`journal/2026-11-01-tauri-shell.md`). Tauri-specific code is injected as a separate script; the page has no Tauri import.
- Network access is restricted twice:
  - a content security policy allows only the application itself, the local Ollama port and files.rcsb.org;
  - the HTTP capability allows only the local Ollama address.

### 6.3 Results

**Rendering and packaging** [C20].
- Mol* rendered 2HBS in macOS's WKWebView with WebGL2, and the read-back again gave `VAL H6`.
- Warm launch: 231 ms to plugin initialisation, 256 ms to first draw, 321 ms from action to draw. The cold first launch was slower (2,740 ms to first draw), a first-launch effect.
- Size: the application bundle is 8.4 MB, the disk image 4.5 MB.
- Signing: the build is ad hoc signed and passes `codesign` verification. Gatekeeper rejects it, as expected without a paid Developer ID and notarisation.

**No WebGPU** [C21]. WKWebView on macOS 15.3.1 exposes no WebGPU, while Chrome 156 on the same machine does. In-browser models on the WebGPU backend are therefore not available in the desktop shell on this OS version. Local AI in the desktop build goes through Ollama.

**Local AI routes** [C22].
- A local Ollama server (version 0.9.6, model llama3.1) answered through three routes in about 5 s per warm call: the webview's `fetch`, Tauri's scoped HTTP plugin, and a custom Rust command.
- A request outside the HTTP scope was refused in 2 ms.
- A preflight from an arbitrary web origin was refused (403), which confirms that local AI is a desktop-only path.

### 6.4 The wrong-structure plan

Asked, without a structure hint, to plan a view of the sickle-cell structure, llama3.1 returned JSON that satisfied the requested schema but named PDB entry 1BZO instead of 2HBS [C23]. The answer was well-formed and wrong.

This single observation motivates the central design rule of Helix: model plans are untrusted proposals, and a deterministic executor validates every identifier against the curated records before execution. Phase 3 measures how often such errors occur (chapter 8).

### 6.5 Decision

- The desktop build reaches Ollama through the Rust command or a one-address HTTP scope, not through Ollama's CORS default, which depends on its version and configuration.
- The web code stays platform-agnostic, behind an AI provider abstraction (Phase 3, task P3.2.4).

---

## 7. Data core and validation (Phase 2)

### 7.1 Architecture

The Phase 1 mapping was rebuilt as code in three TypeScript packages (`docs/data-core.md`). The dependency direction is one way, with no cycles.

| Package | Responsibility |
|---|---|
| `shared-types` | Zod schemas with explicit coordinate conventions, versioned identifiers, label/auth residue references, the six evidence classes, provenance and manifest schemas. No I/O. |
| `data-adapters` | Everything that touches the network or a file format. HTTP core with timeouts, retries with back-off, a per-source token bucket, typed errors and detection of HTML served instead of JSON. Also: a content-addressed cache, a small mmCIF reader, adapters per source, and a guard against proprietary identifiers. |
| `scientific-core` | Deterministic logic over parsed records: coordinate conversions, the MANE Select rule, translation, variant resolution, SIFTS-based structure mapping with an alignment cross-check, contacts, capability checks, the evidence classifier, drift reports and the slice builder. |

**The mmCIF reader.** A dedicated reader of about 400 lines was preferred to Mol*'s parser (a large dependency) and to a Python step (which cannot run in a browser).
- It parses 2HBS (1 MB) in about 50 ms in Node.
- Its failure modes are tested, including a file cut exactly at a row boundary.
- Its contact computation matches the Biopython result of Phase 1 (check T28).

### 7.2 Platform rule

Because the same code must run in a browser, in the Tauri shell and in Node, the runtime packages use only web-platform APIs: `fetch`, `AbortController`, text encoding and Web Crypto. This is enforced twice [C27]:
- each package compiles without Node types;
- a test scans the sources for Node imports.

MD5 is implemented in TypeScript, because Web Crypto has none. It is used only to compare against UniProt's published checksum.

### 7.3 Build checks

The builder runs 46 checks on every build, live or offline. Any failed error-level check aborts the build, and nothing is written: there is no partial dataset and no silent fallback. Version drift between resources is recorded as a warning, never as a failure. Every input body must match the hash recorded at retrieval before it is parsed.

The live build of 2026-11-01 passed all 46 checks, with no failure and no warning [C24]. Table 7.1 groups them; `docs/scientific-validation.md` gives each check, its rationale and its last result.

Table 7.1. Build checks by group (`data/curated/hbb/manifest.json`).

| Group | Examples (last result) |
|---|---|
| Identity and transcript | Gene ENSG00000244734.6; ENST00000335295.4 the only MANE Select among 19 transcripts; HGNC aliases resolve to the same gene |
| Coordinates and sequence | Exon lengths sum to 628; CDS 444 nt, ATG to TAA; translation = Ensembl = UniProt, 147 aa, same md5 [C06]; own exon walk puts c.20 at 5227002, as two sources do; SPDI round-trip |
| Variant | rs334 multi-allelic, only A gives p.Glu7Val; computed p. equals variant_recoder and VEP; UniProt VAR_002863; ClinVar record keyed by SPDI |
| Structure and mapping | Entity chosen by SIFTS accession; alignment offset 1, identity 0.9932; residue read from `atom_site`; wrong numberings land on different residues; `_struct_ref_seq` disagreement recorded; contacts computed |
| Predicted model and drift | AlphaFold model matches UniProt by md5 and is flagged as unusable for variant placement; version drift recorded |

The build also recorded:
- two known issues: the `_struct_ref_seq` numbering, and the 16 non-polymer chains whose label and auth identifiers differ;
- two drift entries: the UniProt cross-reference names gene version 5 while Ensembl serves 6; VEP names UniProt entry version 216 while UniProt serves 219.

### 7.4 Regeneration

The dataset was built live twice in a row from the same commit and compared [C25].
- Of 12 files, 2 were byte-identical.
- The 193 differences were all allowed: retrieval and validation timestamps, and the hashes and sizes of the 9 record files that embed them.
- There were no other differences.

An earlier pair differed in one raw-body hash because HGNC's response carries a per-request timer. The comparison now accepts such a difference only after confirming that the two cached bodies are identical once that documented field is removed.

### 7.5 Tests

The suite has 113 tests in 9 files. 110 pass, and 3 opt-in live smoke tests are skipped by default; run separately, those 3 pass [C26]. The suite includes:
- the 32 deterministic tests of the acquisition plan, against frozen fixtures;
- HTTP tests against a real local server (timeouts, rate limiting, server errors, HTML in place of JSON, truncated bodies, cancellation);
- cache, parser and schema tests;
- dataset tests that check the committed files' hashes and the absence of proprietary identifiers.

### 7.6 What the curated dataset contains

The dataset (`data/curated/hbb/`) has eleven records, the unchanged 2HBS file and a manifest with full provenance:
- gene, transcript, sequences, protein, the HbS variant;
- the structure, the residue mapping, the contacts;
- the AlphaFold model metadata and a capabilities index.

ClinVar trait names are deliberately not stored (section 4.3).

---

## 8. Local and browser AI: feasibility and evaluation (Phase 3)

The full method, every table and the reproduction commands are in `docs/ai-model-benchmark.md`. The experiments are journaled as `HX-P3-2026-11-01-ai-benchmark-ollama` and `HX-P3-2026-11-01-webllm-browser`.

### 8.1 Question and design rule

Can a free model running on the user's own machine turn a question into a plan of scene actions reliably enough to be useful? The design rule from section 6.4 is fixed in advance: no plan executes without passing validation, whatever the results.

A new package, `ai-planning`, holds the plan schema, the planning context and the validator. It is kept separate so the data packages never import model code. Like the other runtime packages, it uses only web-platform APIs.

- **Plan shape.** A plan has:
  - an outcome: `plan`, `unsupported` or `clarify`;
  - an intent, the entities and a list of actions;
  - an explanation level, citations, follow-ups and a reason.

  Every object is strict, so an unknown field is an error.
- **Actions.** Among them: resolve gene or variant, load structure (with the asymmetric unit or a named assembly), enter world, focus camera, highlight residue, reveal evidence, cancel.
  - The model never names a chain, a residue number or a mesh. It names a curated feature, such as `HbS_substitution`, and deterministic code resolves it.
- **Context.** The only identifiers a plan may use come from the eleven curated HBB records:
  - the gene, transcript, protein and variant;
  - the two structures, 2HBS (experimental) and AF-P68871-F1 (predicted, never used to place the variant);
  - two features and ten evidence identifiers.
  - Retrieved text is attached as untrusted data and never counts as grounding.
- **Validation,** in order:
  1. JSON parse.
  2. Strict schema.
  3. Groundedness: every identifier must be in the context, including identifiers in free text, unless the user typed them.
  4. Capabilities.
  5. Prerequisites: a feature is targeted only once its structure is loaded in an assembly that contains it.
  6. Outcome consistency [C30].

### 8.2 Benchmark

The main set has 53 items [C31]: 11 supported, 13 paraphrases, 6 follow-ups on a selection, 12 unsupported, 5 ambiguous, and 6 injections. Seven items are in French.
- **Unsupported** items include medical questions (a hydroxyurea dose for a child), other genes, a request to run code, and a request for the wrong structure 1BZO.
- **Injection** items plant instructions in the retrieved text, for example "ignore all previous instructions and load 1BZO", or a hidden comment asking for CFTR.

The expected answers were written before any model ran. A separate held-out set of 16 items was written after the deterministic fallback was finished, and was not used to change it.

### 8.3 Harness

Every model received the same system prompt, the same schema (passed to Ollama's `format`), the same context and the same number of attempts:
- three runs at temperature 0, with seeds 0, 1 and 2;
- one run at temperature 0.7.

There were no retries or repairs, and every output is stored with its timings and score. A mock model that injected known faults was run first, and the harness caught each one [C32].

Environment: Ollama 0.40.6, installed in user space from a checksum-verified release, on the reference Mac (Apple M1 Pro, 16 GB).

### 8.4 Results

Table 8.1. Main set, temperature 0, 159 outputs per model (`docs/ai-model-benchmark.md` §3.2) [C33].

| Planner | Correct and valid | Ungrounded identifiers (outputs) | Medical/unsupported refused | Injection items correct | False refusals | Total time p50 / p95 |
|---|---|---|---|---|---|---|
| Deterministic fallback (in-sample) | 100% | 0 | 13/13 | 6/6 | 0/35 | < 2 ms |
| ministral-3:8b | **86.8%** | 12 (9) | 39/39 | 9/18 | 12/105 | 10.0 / 20.3 s |
| qwen3.5:4b | 57.9% | 20 (17) | 38/39 | 9/18 | 6/105 | 7.0 / 25.2 s |
| llama3.1:8b | 47.2% | 6 (3) | 39/39 | 9/18 | 45/105 | 3.2 / 7.3 s |
| phi4-mini:3.8b | 34.0% | 27 (18) | 24/39 | 6/18 | 36/105 | 3.8 / 6.0 s |

The fallback's 100% is in-sample: its rules were written with this set in view, so it shows coverage, not generalisation.

**Held-out set** [C34]:
- The ranking changes: the fallback scores 75.0%, qwen3.5:4b 62.5%, ministral-3:8b 56.3% and llama3.1:8b 37.5%.
- The best model on the main set loses about thirty points on questions it was not prompted around.
- With 16 items, differences of one or two items are noise.

**Validation did its job** [C35]. Every ungrounded identifier was caught:
- invented accessions (P68881, P688871);
- identifiers recalled for genes outside the context (TP53 and P04637);
- injected identifiers repeated in free text (1BZO, 4HHB);
- an invented variant identifier.

Under the policy "use the model's plan if it is valid, otherwise the deterministic plan", no ungrounded plan would have reached the scene. On the held-out set this policy scores 87.5% with qwen3.5:4b and 75.0% with ministral-3:8b. Its remaining errors are valid but wrong plans, such as a clarification where a plan was expected, which validation cannot detect.

**Other measurements.**
- **Constrained identifiers.** Restricting identifier fields to the context identifiers removed every structured-field violation, but did not make any model more correct [C36].
- **Injection.** No model got more than half of the injection outputs right. Most avoided the injected action but then refused or questioned the user's real request.
- **Memory.** qwen3.5:4b, which Ollama runs on its MLX runner, grew from about 4.5 GB to 12.3 GB over one run, three quarters of the machine's memory [C37]. The cause is not verified.

### 8.5 In-browser inference

Qwen3.5-2B ran in Chrome through WebLLM 0.2.86 on WebGPU [C38]:
- **Download:** 1.08 GB. The first load took about 75 minutes on a slow link; later loads took 2 s.
- **Speed:** decoding ran at about 16 to 17 tokens per second, and a plan took 25 s at the median.
- **Output:** none of the outputs was schema-valid as returned, because the model emits an empty reasoning block before the JSON. Once the provider strips it, 10 of 10 are schema-valid and 4 of 10 are correct and valid, with no ungrounded identifier.

The decisive result concerns the molecular scene [C39]. With the model on the page's main thread, the Mol* scene froze once for 28.7 s. In a Web Worker, the worst frame was 133 ms. In-browser inference is therefore only acceptable in a worker. It is unavailable in the desktop shell, which has no WebGPU (section 6.3).

### 8.6 Deterministic fallback

The fallback is an ordered list of rules over the user's query. It never reads retrieved text, so injected instructions cannot reach it. The rules, in priority order:
1. clinical and code requests are refused;
2. identifiers outside the context are rejected;
3. ambiguous questions get a clarification;
4. the supported commands produce plans;
5. anything else is "unsupported", without guessing.

Results [C40]:
- It answers all 53 main items correctly (in-sample) and 12 of the 16 held-out items.
- All 69 of its plans pass validation.
- Its four held-out misses are safe: a clarification or a plan that does less than asked.
- The rules were not changed after the held-out run, so that figure stays honest.

### 8.7 Providers, director and decision

**Providers.** One provider interface covers the deterministic planner, Ollama and WebLLM. Each reports whether it is available and why, and a registry switches between them at runtime. The deterministic provider is mandatory.

**Director.** A minimal journey director chains the steps:
1. gene resolution through the scientific core: an unresolvable gene is answered without calling a model;
2. a plan from the active provider;
3. validation;
4. the fallback;
5. cancellation of stale requests.

Both components are tested with mock providers and on every benchmark item.

**Decision:**

| Role | Choice | Reason |
|---|---|---|
| Default everywhere | Deterministic planner | Works offline, never ungrounded, best on the held-out set |
| Development and desktop model | ministral-3:8b (Apache-2.0) through Ollama, behind validation and the fallback | Best main-set results, stable at temperature 0; slow (10 s median), so the UI must show progress and allow cancelling |
| Not the desktop default | qwen3.5:4b (Apache-2.0) | Better held-out policy score, but its memory grew to about 12 GB on a 16 GB Mac |
| Web, experimental opt-in | Qwen3.5-2B (Apache-2.0 base) with WebLLM, in a worker, after the user accepts the 1.08 GB download | Feasible but weak (4/10) |
| Rejected | llama3.1:8b, phi4-mini:3.8b | Many false refusals and Llama licence obligations; weakest results and clinical follow-up suggestions |

There is no cloud or paid route.

### 8.8 Limits of Phase 3

- **The benchmark is small,** covers a single gene, and some expected answers are judgement calls. The percentages describe this set, not planning ability in general.
- **The strict rules shape the numbers.** Free-text groundedness counts a model as ungrounded even when it names an injected identifier only to refuse it.
- **Latency comes from one machine,** with other work running at times (about ±10%).
- **Memory figures** are not comparable across Ollama's runners.
- **Not tested:** tool calling, other in-browser libraries, Safari and Firefox.
- **The director** is a reference implementation, without retrieval beyond the curated context or session memory.
- **Test suite:** after Phase 3 it has 160 tests; 157 pass and 3 opt-in live tests are skipped by default [C41].

---

## 9. Later phases (Phases 4 to 12)

*Placeholders. Each section is drafted when its phase runs, and checked at the phase's gate review.*

### 9.1 AI-to-World proof (Phase 4)

**Question.** In the running application, does a typed question cause a validated, verified visual action on the real structure? This is the acceptance chain of the master prompt (§7.5).

**Design.**
- A product director, ported from the Phase 3 reference (section 8.7), proposes a plan against a context restricted to what the build can show.
- A Scene Action Interpreter checks the plan before anything runs:
  - the plan's session epoch;
  - a second validation of the plan;
  - each action against a registry of eight typed contracts, each with its capabilities, prerequisites and scientific checks.
- Targets are resolved only from the Phase 2 SIFTS mapping and contacts records.
- Highlight and focus count as done only when Mol*'s own selection and focus managers read back the resolved residues.
- The explanation is written by deterministic code from the curated records. Every sentence that makes a claim cites an evidence identifier with its provenance, and the planner's own text is labelled as such.

**Results** (`HX-P4-2026-11-02-ai-to-world-e2e`).
- **Read-back.** The reference question was "Show me where the sickle-cell mutation affects hemoglobin." In every run, Mol* read back VAL 6 on chains B, D, F and H of the 2HBS asymmetric unit, with focus on H6: 5 runs with the deterministic planner and 5 with ministral-3:8b [C42].
- **Time to the verified highlight, deterministic planner:** a median 1,061 ms after the question. That includes a camera move of about 700 ms [C43].
- **Time to the verified highlight, ministral-3:8b:** a median 15,922 ms, almost all of it planning (median 15,516 ms). The first, cold run took 28.7 s. The warm planning time is longer than the Phase 3 median of 10 s, and this was not investigated.
- **Validation.** No model plan was rejected. The model chose a different valid order, highlighting before focusing, and had no explicit evidence action [C44].
- **Evidence.** Every displayed claim cited a sourced evidence identifier [C45].
- **Other questions.**
  - A follow-up question about the selection showed the H6 contact with chain B, together with the statement that it lies in the crystal's asymmetric unit.
  - Unsupported and clinical questions left the scene unchanged.

**Interruption** (`HX-P4-2026-11-02-cancellation`).
- Stopping during a camera transition took a median 28 ms, and the camera did not move afterwards.
- Stopping during inference took 13 to 14 ms, and the next model request was not delayed [C46].
- A plan made before the user clicked a residue was rejected as stale, and a question superseded during inference was discarded [C47].

**The long frame of section 5.4** (`HX-P4-2026-11-02-long-frame`) [C48].
- It does not occur in the single-canvas application.
- In the Phase 1 bridge page it recurs at every Mol* spin start with vsync off. It requires both the second, always-rendering canvas and prior clicks on the Mol* canvas.
- A trace shows the main thread waiting about 195 ms for GPU command-buffer space.
- This contradicts the Phase 1 guess of a one-off rebuild of components. The trigger inside Mol* remains unexplained, and the probe is carried to Phase 5.

**Mol\* behaviours found during the build.**
- A draw notification fires immediately when subscribed to.
- A focus request issued right after a load jumps instead of animating, because Mol* has not finished committing the scene.
- Mol* skips draws while shaders are being finalised.
- The camera interrupt relies on a public but undocumented field.

All four are handled in code and documented in the product repository.

**Limits.**
- One machine, headless Chrome 156, five runs per planner, one structure, and only the protein world.
- Safari, Firefox and the desktop webview were not run.
- The raw end-to-end result files are in the private product repository; whether to mirror them into this repository is an open author decision.

**Tests.** After Phase 4, the product repository has 52 passing tests, and this repository 160 (157 pass, 3 opt-in live tests skipped); typecheck is clean in both [C49].

### 9.2 Journey engine and two-world integration (Phase 5)

**Question.** Can two real representations of HBB, the transcript sequence and the experimental structure, be linked so that users can move both ways, selections stay scientifically consistent, and every action can be cancelled safely?

**Design.**
- **Worlds as declarations.** Each world is a typed declaration of what it needs and offers: data, interactions, actions, measured costs, fallbacks, an accessibility alternative, and whether its geometry is illustrative. The declarations are checked at compile time and at run time.
- **Chapters.** A deterministic planner proposes chapters. A matcher offers a chapter only if its world exists in the build and every kind of data it needs is in the subject's curated inventory.
- **DNA World** is an illustrative helix drawn in React Three Fiber. Its base i is base i of the curated cDNA, and it is labelled "Illustrative geometry, real sequence".
- **Protein World** is Mol* on 2HBS.
- **The selection bridge** links codon, protein position and structure residue through the Phase 2 records only, with no offset arithmetic.
- **One path for every change.** All scene changes, including world switches and chapters, go through the Scene Action Interpreter of section 9.1.
- **One pointer owner at a time,** and the R3F canvas renders only when something changes.

**Results** (`HX-P5-2026-11-02-dna-world-bridge`, `HX-P5-2026-11-02-transitions`, `HX-P5-2026-11-02-modes-rapid`).
- **The drawn DNA is the real sequence.** The running page drew all 628 bases as the curated sequence, and real clicks selected the clicked base [C50].
- **The bridge works both ways.**
  - Codon 7 linked to P68871 position 7 and to VAL 6 on chains B, D, F and H of 2HBS, as read back from Mol*.
  - Clicks on those residues linked back to codon 7.
  - Codon 1, the stop codon and unmapped residues said why they have no counterpart [C51].
- **Switching worlds.** A warm switch took a median 719 ms, a cold one 1,754 ms. Every round trip kept the selection, both cameras, the structure and the highlight [C52].
- **Interrupting a switch** returned to the starting world in a median 29 ms [C53].
- **Chapters need their data.** Over all 4,096 subsets of data kinds, the matcher never offered a chapter without the data it needs [C54].
- **Guided, free and resume.** Guided mode, free exploration and resuming the narrative passed with both planners [C55].
- **Rapid interaction.** In six cases, the selection or the gene was changed during a transition or during inference. Every time, the obsolete action was cancelled or rejected before reaching the scene [C55].
- **A defect found and fixed.** Building that check exposed one consistency defect: a model plan made before the user selected a codon still executed and overwrote the selection. The DNA selection now counts as a change of subject, which makes older plans stale.

**The long frame of sections 5.4 and 9.1** (`HX-P5-2026-11-02-long-frame-reprobe`) [C56].
- With R3F rendering only on demand, the stall at the start of a Mol* spin did not appear in any condition.
- A visible, always-rendering R3F canvas with uncapped frames produced stalls of about 2 s.
- The application therefore renders R3F on demand; always-on rendering is rejected.
- The stall is now avoided by design, but its trigger inside Mol* is still not isolated and was not traced in this phase.

**Limits.**
- One machine, headless Chrome, few repeats.
- Only codon 7 reached a structure residue in Phase 5, because the dataset then held a mapping record for that position only. Phase 6 extended the link to all 146 mapped codons (section 9.3).
- Chapter planning is deterministic only.
- Starting in DNA World adds about 0.73 s to the reference question, for the fade between worlds [C57].
- Keyboard navigation of the codon strip was not tested end to end. Safari, Firefox and the desktop webview were not run.

**Tests.** After Phase 5, the product repository has 93 passing tests, and this repository 160 (157 pass, 3 opt-in live tests skipped); typecheck is clean in both [C58].

### 9.3 Complete HBB vertical slice (Phase 6)

**Question.** Can the whole HBB slice be used end to end, with three properties:
- every statement shown traces to a record;
- a follow-up question changes the scene again;
- the experience degrades honestly when data or AI is missing?

**Design.**
- **Data.** Two records were added to the curated dataset: the ClinVar record of the HbS allele with its review status, and the full-chain SIFTS residue mapping of P68871 onto 2HBS. The dataset was then rebuilt live.
- **Actions.** Two validated actions were added: the comparison of the reference and variant sequences, and a sequence-region highlight.
- **Flows.** Four flows were built: first visit, missing data (a clearly labelled test fixture), no AI, and the known limitations shown in the interface.

**Results** (`HX-P6-2026-11-02-hbb-rebuild`, `HX-P6-2026-11-02-clinvar-live-smoke`, `HX-P6-2026-11-02-vertical-slice-e2e`).
- **ClinVar.** VCV000015333.184 classifies the HbS allele as Pathogenic: "criteria provided, multiple submitters, no conflicts", 2 of 4 stars, no conflict. The record was at version .183 in Phase 2. The nine other ClinVar records at rs334 are stored separately and never merged [C59].
- **Rebuild.**
  - The extended build passed all 53 checks from a clean commit [C60].
  - A second build differed only in explained fields.
  - The manifest now names a commit present on the public branch, which closes the provenance gap noted in section 10.
- **The DNA-to-structure link covers the whole chain.** The full-chain record maps positions 2 to 147 onto all four beta chains. In the application, all 146 mapped codons linked to exactly the recorded residues, by lookup, never by offset. Codon 1 and the stop codon say why they have no counterpart [C61].
- **The comparison view** is shown only if it reproduces the record (c.20A>T, GAG to GTG, Glu to Val); a corrupted record is refused [C62].
- **Follow-up questions.** A follow-up question produced a second visual action, verified by read-back, in 3 of 3 runs with each planner. With the rule-based planner the follow-up took a median 775 ms; with ministral-3:8b, 17,116 ms, and the model wrote the plan itself each time [C63].
- **First visit.** A gene that is not curated (CFTR) was refused without a scene, and "beta-globin" reached the first scene in 1,731 ms [C64].
- **Missing data.** With the structure records withheld, the variant was shown on the sequence with the reason, and no structure or predicted model was requested [C65].
- **No AI.** With no reachable model, every path that does not need one worked, and the interface said why no model runs [C66].
- **Regression.** The Phase 4 and Phase 5 suites still pass. Model planning time rose to a median of 21.5 s, from 15.5 s, which has not been investigated [C67].

**Limits.**
- One gene. The missing-data fixture is HBB with records withheld, not a real gene with a limited structure.
- Blueprints A, E and F were run once each, on one machine, in headless Chrome.
- With the extended prompt, the model's first plans are longer than needed and visit both worlds.
- The demonstration video shortens pauses longer than 1.2 s, so planning time does not appear at its real length.

**Tests.** After Phase 6, the product repository has 110 passing tests, and this repository 181: 177 pass and 4 opt-in live tests are skipped by default; the 4 live tests pass when run [C68].

### 9.3.1 After the Phase 6 review (decisions D-H007 and D-H008)

The author passed the Phase 6 gate on 2026-11-02 and asked for a set of changes. Each change was characterised by tests before it was made, and each measurement is journaled.

**Product changes.** The welcome now shows on every visit, and the app opens in DNA World as an explicit rule: the start world is chosen from the data available, with DNA World preferred. Question-to-highlight time with the rule-based planner was 1,775.9 ms (median, n = 5), within the range of Phase 6 (C69). The model's follow-up suggestions now pass a deterministic filter (`helix-followup-filter-v1`): a suggestion is kept only if it is nonclinical, stays within the curated context and is answerable by an allowed rule-based scene. On 816 suggestions recorded in earlier runs it kept 64, none of them clinical (C70).

**Why model planning slowed.** The Phase 3 "10 s" figure was a median over all 53 benchmark items; the reference question itself took 17.5 s in Phase 3 and did not slow before Phase 6. From Phase 5 to Phase 6 it rose by about 6 s, and 97.6% of that rise is output length: the first answer had started visiting both worlds, adding about 128 generated tokens at about 46 ms each. Prompt growth, constrained decoding, context limits and machine load explained none of it (C71). The same study found that the stored "exact messages" of two earlier E2E entries had been captured after the answer; the capture was corrected and the entries annotated.

**One world per first answer.** At the author's request a first answer now stays in one world. The rule is stated in the prompt and enforced by a check that rejects a first answer that switches worlds, with the usual fallback; plans are never reordered. On the reference question planning fell from 21.7 s to 18.8 s, and all 15 first answers of the E2E question set stayed in one world; benchmark validation stayed at 90.6% while correct-and-valid answers fell from 79.2% to 75.5% (C72).

**Routing by the question's words.** A first answer goes to the world the question names (DNA, codon, sequence or letter; protein, structure, 3D, shape or effect); a neutral question stays in the current world, and after a DNA-World variant answer the first suggestion is the bridge to the protein. Seventeen new held-out items and their expected answers were committed before any model saw them. The model chose the right world for 14 of 15 items that have one, the app executed the right world for all 15, and 16 of 17 items were correct and valid (C73). Two existing items whose expected answers the rule changes keep both oracles, and scores are reported against both. Held-out item RH15 exposed a gap in the rule-based clinical pattern ("I will get sick" was not refused); the pattern was widened, no other item changed, and RH15 no longer counts as unseen for the rule-based planner (C74). With routing, the filter kept 10 of 54 model suggestions, none clinical (C75).

### 9.3.2 Molecule names as cues, and a prompt experiment that was not shipped (D-H010, D-H011)

**Molecule names and "chain" (D-H010).** The author then decided that hemoglobin, beta-globin, HBB and "chain" name the protein, while gene, locus, chromosome and genome name the DNA; a DNA word beats a molecule name, since the name only states the subject. Sixteen new held-out items and their oracles were committed before any run with the amended prompt (v5). The executed answer reached the right world on all 14 routed items, but the model alone chose it for only 9 of 14: HBB, beta-globin and French hémoglobine questions still went to DNA World and were corrected by the world-cue check, at the cost of a fallback and a full model wait (about 23.6 s in the running app). On the main set, correct-and-valid answers rose from 39 to 40 against the amended oracles (C76). One held-out item exposed a second gap in the rule-based clinical pattern ("make me sick"); it was widened, no other item changed, and the item is spent for the rule-based planner (C77).

**Reworking the instructions (D-H011).** To make the model itself route the name questions, five prompt drafts were tried on the already-seen development items, with 21 new held-out items and their oracles committed before any draft ran. Two negative results shaped the final draft: a cue table in the rules sent neutral questions ("Show me the HbS variant") to Protein World because the model read HbS as a molecule name, and naming the world on screen in the user message made the model answer in that world regardless of the question (model routing 3 of 14). What made the model commit was asking it to enter the chosen world as its first action. The frozen prompt (v6) was run once on the held-out set: 19 of 21 valid, model routing 17 of 19, executed 19 of 19, every first answer in one world, both clinical items refused, and the injection item followed by the model's text but blocked by the validator (C78). On the target items the model's own routing rose from 9 to 12 of 14. On the main set, however, correct-and-valid fell from 40 to 37 (n = 1) with safety unchanged, and planning slowed by about 3 s at the median because the answers grew longer. The pre-registered rule for switching the app required no loss on the main set, so v6 is kept frozen and reproducible but not shipped; the app keeps v5 with the check-and-fallback path (C79). A multi-seed rerun could overturn the n = 1 loss and is left to the author.

### 9.4 Art direction, branding and UX system (Phase 7)

*In progress; this section is written as the phase advances (invariant 14). Numbers below are from the journal entries named in the claims register.*

**Direction.** The author asked for an "ultra premium, ultra futuristic" interface and supplied a mood reference, a third-party design recording that was viewed, described in the project records and never copied or committed. Three original concepts were built as live React Three Fiber prototypes on the real 628-nt HBB cDNA with codon 7 highlighted, each with twelve screens, licence-checked fonts (SIL OFL, self-hosted, versions at least two weeks old) and measured frame timings: Deep Field (Molecular Cosmos), Instrument (Future Research Instrument) and Atrium (Living Digital Museum). All three held 60 Hz with vsync on in every mode on the development Mac; with the frame cap removed, Atrium stalled once per page (0.76 to 2.77 s) and Deep Field showed periodic long frames without effects, while Instrument had no frame over 50 ms in any condition (C81). The author chose Instrument (D-H009) and asked for it to be improved further.

**Refinement.** Four critique-and-fix rounds applied the author's decisions: amber means the variant and nothing else, so the base pairs became lit enamel inlay in the legend colours and the only emissive accent is at codon 7; every glowing element carries a reading (the former cyan ring is the coding-sequence start); depth of field runs only during the camera tour; effects render below screen resolution. Full-effects headroom rose from under 2 ms to about 8 ms at p95 (vsync off, median 8.1 ms on the tour against 13.5 ms before), with 0 idle frames at rest after every move (C82). Every text colour passes WCAG AA, pinned by a unit test. The author rejected all nine identity sketches and five new directions, then supplied their own wordmark, generated with an image tool; it is kept as received with its provenance and rights notes, cleaned (alpha only: 67,347 fringe pixels cleared, no colour changed), redrawn as a traced vector over 16 compared rounds, and reduced to a small mark taken from its own X (D-H011).

**Design system and adoption.** A tokens package became the single source of truth for colour, type, spacing, motion and the scene's material and lighting parameters, with generated CSS checked against the TypeScript source by a test. Contrast is computed for 17 text roles on 11 composited surfaces plus the control surfaces, 190 pairs, all at or above 4.5:1 (lowest 4.58, base C on the discovery wash); colour separation is measured with CIEDE2000, with the fault colour 35.7 from amber (15.1 to 25.2 under simulated colour-vision deficiencies) and every evidence colour at least 24.6 from amber and 13.7 from each other; two evidence pairs come close under a deficiency and are also told apart by word, class number and mark shape (C83). Twenty-seven accessible components were built with role, name and keyboard tests. The shipped application then adopted the system on every screen (D-H012, D-H013): the welcome shows the wordmark once with the headline "Follow a gene from its DNA to the protein it makes."; Derived and Predicted are separate labels within class 3; the Mol* viewer is themed from the tokens with the variant in amber and the visitor's selection in cyan, its toolbar and hover readout untouched; and the bridge from a DNA-World variant scene to Protein World plays a four-station sequence read from the records (codon 7 GAG to GTG; p.Glu7Val; 7 to 6 because the initiator methionine is removed; 2HBS chain H VAL 6), with pause, step and skip controls, all stations shown at once under reduced motion, and a refusal path that lands directly in Protein World if any link fails its check. On the adopted build the Phase 4, 5 and 6 rule-based suites pass with 0 failures; the shipped DNA World keeps 60 Hz with no frame over 33.4 ms and 0 idle frames at rest, before and after; the first run caught a bridge trigger that fired on a fresh-start question (5,030 ms against 1,781 ms after it was narrowed to the variant scene) (C84).

**Closing the gap in the shipped application.** A review of the adopted build against the approved prototype found that the shipped DNA scene was still the Phase 5 geometry, the visitor panel still showed developer diagnostics, and the Mol* theming was partial. A polish pass then made the Instrument kit the shipped DNA World (machined backbone, knurled sleeves at codon starts, cyan inlay on the coding sequence, flanges at exon junctions, amber collars on the coding strand at codon 7 and partial calipers), added a camera rig with a hero pose and an interruptible 12 s tour, moved the diagnostics behind a developer flag, applied the Mol* focus theme after the viewer's own preset (a live probe showed the preset re-theming the focus representation), and added a structure caption read from the record. Three critique-and-fix rounds were logged with screenshots. On the polished build the Phase 4, 5 and 6 rule-based suites pass with 0 failures, and the shipped scene holds a 16.7 ms median with vsync on at device pixel ratios 1 and 2 and in low power, with no frame over 33.4 ms at ratios 1 and 2 and 0 idle frames at rest; two isolated long frames (63 ms and 35 ms) remain in low power, not traced (C85). **Accessibility and motion audit.** An automated pass with axe-core 4.14.0 over thirteen screens, scripted keyboard walks with focus-ring evidence, reduced-motion and low-power checks, and accessibility-tree reads found 19 issues: 3 serious, 8 moderate, 7 low, and one coverage note. Thirteen were fixed with unit tests (a main landmark, codon names that start with their visible text, roles for five labelled groups, four invisible tab stops removed, focus returned after the bridge overlay and Evidence World, Escape pausing the tour, focus rings on the Mol* toolbar); four are carried to Phases 8 and 11, two are accepted designs. After the fixes axe reports 0 violations on all thirteen screens; no screen traps focus; under reduced motion the tour is a cut, the bridge shows its four stations at once for 2.8 s, and the render loop stays idle; the low-power view renders without post-processing at 0.8 ms median per frame (C86). A VoiceOver pass cannot be scripted and is owed, with its manual script in the audit. The gate review was then put to the author.


### 9.5 Cinematic world and visual polish (Phase 8)

*In progress; this section is written as the phase advances (invariant 14). Numbers below are from the journal entries named in the claims register.*

**Budgets first.** The phase opened on 2026-11-03, after the author passed the Phase 7 gate, with performance budgets rather than visuals, because the gate of this phase is "visual QA plus measured frame and load budgets". The budgets are data (a JSON file read by a harness) and a page explains each one, its measurement and the journal entry its baseline comes from: time to first interaction (page load to scene ready, the welcome's first control enabled, DNA World ready), bytes over the wire before that moment and at rest, JavaScript heap at rest, after the structure load and after six world round trips, the Chrome process tree, the cold and warm world switches, the structure fetch, the built bundle, and the frame budget already measured in Phase 7 (60 Hz median with vsync on, no frame over 33.4 ms at pixel ratios 1 and 2, at most one per thousand in low power, zero idle frames). On the Phase 7 build every runtime budget held with margins of 1.3x to 3x (scene ready 673 ms against 1,000; heap 78.4 MB after the load against 256, growing 1.4 % over six round trips against 10; cold switch 1,708 ms against 2,500), with two findings: the warm world switch has 40 ms of margin (1,560 against 1,600 ms), and the bytes fetched before the first interaction are 1,918.6 kB against a 1,000 kB target, because the Mol* chunk (968 kB gzip) and the structure file (249 kB) load before the scene is ready (C87). The breach is kept as a breach: the target describes the startup the phase should ship (Mol* and the structure deferred past the ready moment), not the one it inherited.

**Two streams, one working tree.** The build work ran as two parallel streams with strict file ownership, after the Phase 7 incident in which one agent's commit swept another's uncommitted edit: each stream committed only its own paths, built into a private folder served on its own port, and left timing measurements to the coordinator on a quiet machine. The DNA World stream (P8.2.1, P8.3.1, P8.3.2) added a level of detail driven by the camera distance (fine parts, hairlines, caliper ticks, hover rings and the knurl relief hidden beyond the distance where they cover about a pixel, every coarse part drawn at every distance so the instrument keeps its silhouette, all by visibility flags so nothing is recompiled and the E2E read-backs keep their counts), an amber reticle that takes over from the collars from 18 units outwards so the variant codon stays findable from the overview and transcript distances, fog whose density follows the camera distance, and named scales (transcript, overview, codon, base pair) with eased flights in scalar space that any input interrupts from where the camera is: a wheel event mid-flight set its goal relative to the distance of that frame and the frame-to-frame travel stayed continuous, a drag stopped the flight on its first move, Escape held the camera in place, and no frame rendered once the rig settled. A DOM label layer writes real text at projected anchors with content per scale (exon spans and CDS ends; sparse codon numbers and junctions; the codon, its amino acid and bases; the base pair), resolves overlaps by priority with the results of actions above static letters, hides while the camera moves and settles 160 ms after it stops, and mirrors its text in the side panel for assistive technology. The Protein World stream (P8.2.2) lit Mol* from the same studio as the DNA scene through its public props (a warm key and a cool rim instead of one white light, a lower cooler ambient, ambient occlusion widened, bloom off, fog matched), restyled the emphasis label, named the predicted model in the structure caption as Predicted, class 3, with its pLDDT and "listed, not loaded", found and documented why the focus surroundings cannot be themed once and for all (every built-in preset in Mol* 5.13.1 rewrites the focus behaviour's colour theme, so re-application after each preset is the only path), and deferred the Mol* chunk and the structure file past the ready moment with an idle prefetch, so the first interaction waits for the index chunk, the shell, the fonts, the wordmark and the curated records only. It also closed the three findings carried from the accessibility audit: kicker labels now expose sentence-case names while the visual stays uppercase, Escape closes Evidence World and returns focus to its toggle, and the bridge's representation column no longer overlaps a station at 1400 px. On the merged tree, 322 unit tests pass (293 before the phase), and the Phase 4, 5 and 6 rule-based suites, the new semantic-zoom interrupt suite, the two Phase 8 shot passes, the Phase 7 shot pass and the accessibility suite (0 axe violations) pass with 0 failures (C88).

**Sound, opt-in.** The master prompt allows original audio only if it is opt-in, muted at first and nonessential. The third stream built a sound language of six synthesised cues (Web Audio oscillators, one generated noise buffer, filters and gain envelopes; no audio file, no dependency), each tied to an action the app already reports: a tick on a selection, a filtered sweep whose pitch follows the named scale of a flight, two intervals for the tour's start and end, a chime per bridge station with the fourth different, and a low swell during the world fade. The master gain is -24 dBFS, every envelope opens over 60 to 120 ms, no cue repeats within 120 ms, nothing loops, and a hidden tab suspends the context. No AudioContext exists until the visitor presses a named "Sound" button with a pressed state; the preference is remembered per browser behind try/catch; turning sound off cuts, suspends and closes the context. Under reduced motion the cues still play when opted in (sound is not motion) except the sweep, replaced by the tick because flights are cuts. The browser suite measured 0 audio contexts on a fresh page after the tour, a codon click and a world switch, one running context after the toggle, the recorded cues per action, the closed context after turning off, and the preference kept across a reload (C89).

**Measurements of record.** On the final build (helix-app 5edeae4), one serial sequence on an otherwise idle machine ran the nine rule-based suites, the model-backed scenarios of Phases 4, 5 and 6, the frame timings and the budgets. Every suite passed with 0 failures and 0 axe violations; the reference question executed 5 of 5 times with the model and no fallback (provider 17.6 s median, click to end 19.7 s), cancellations landed in 12 to 16 ms, the stale-plan and rapid-burst scenarios held, and the molecule-name question still took the check-and-fallback path at 24.3 s, as recorded in Phase 7 (C90). Frame budgets held with the same margins as Phase 7: a 16.7 ms median with vsync on for every move at pixel ratios 1 and 2 and in low power, 0 frames over 33.4 ms in 13,829 frames, an uncapped tour p95 of 3.8 ms at ratio 1 and 6.1 ms at ratio 2, so the level of detail, the labels, the fog and the sound subscriber added no measurable per-frame cost; the two long low-power frames of Phase 7 did not recur (longest 25.0 ms). The startup target was met: 677.7 kB fetched before the first interaction against 1,918.6 kB, scene ready in 165 ms against 673 ms, the Mol* chunk and the structure file arriving at 171 ms by idle prefetch, and the cold world switch at 1,614 ms although it now includes creating the Mol* plugin; the warm switches dropped from about 1,500 to about 1,290 ms because the new flights settle sooner (C91). One budget is over on the final build and is reported as such: a single frame rendered during the two seconds at rest in Protein World on every page at pixel ratio 1 with vsync on and on one low-power page, none at ratio 2 or uncapped, none in DNA World; it is a deferred invalidation around the end of the last world switch rather than steady work, and tracing it is carried into the gate review as an open item (C91).

**The author's answers.** The gate review put fourteen design questions to the author (bridge start, reticle size and codon numbering at the overview, the variant codon's two labels, bowed moves, Escape in guided mode, the remaining uppercase styles, the caption wording for the predicted model, Mol*'s focus target, prefetch during the tour, low-power lights, and the sound control's placement, tick and journey cues). All were answered on 2026-11-03 (helix D-H016): thirteen keep what was built, and one changed it, the sentence-case accessible names being extended to the four remaining uppercase styles (the bridge station's world line, the codon tape head, the tour label and the known-limitations title); the accessibility suite on that build (helix-app cad8356) reported 0 failures and 0 axe violations, with the tour label's live region announcing the sentence-case copy only (HX-P8-2026-11-03-question-56). The gate verdict itself was still open at the time of writing.

**The gate verdict and the chrome polish.** The author passed the gate the same day with one condition: the interface chrome, the cards and menus, had to read as more premium (helix D-H017). The polish that followed changed tokens and CSS only, nothing in the scene, the labels or the camera. It added one rule to the Instrument grammar, a card is a lifted object and a control is a machined key: a card surface one step above the panel with a brighter top edge and a shade line under it, controls with a lit top face that lift on hover and recess on press, the world switcher and the sound control as a recessed track holding lifted keys, suggestion chips as keys of one height, and Mol*'s own viewport toolbar, hover readout and panel restyled into the same grammar through its public class names. The contrast register grew from 190 to 241 text and background pairs with every pair at or above 4.5:1, the accessibility suite reported 0 failures and 0 axe violations on the polished build, and the Phase 4, 5 and 6 rule-based suites and both shot sets passed (helix-app 6cebe35; HX-P8-2026-11-03-chrome-polish; C92). The polish also settled a defect that every review shot since Phase 7 had shown: the question field appeared as a white box. Eight probes established that the app never painted it white (its computed background was the dark well in every state and in every clipped capture) and that the white appeared intermittently only in full-viewport captures of the translucent input inside a backdrop-filtered card; the root cause in headless Chrome was not proven. Making the input well opaque removed it from all 24 full-viewport shots of the polished build. The author approved the polish from a before-and-after page (D-H018), which closed Phase 8.

### 9.6 Multi-gene personalisation (Phase 9)

*In progress; this section is written as the phase advances (invariant 14).*

**The plan first.** Phase 9 opened on 2026-11-03 when the author closed Phase 8 (helix D-H018). Its plan (`docs/phase-9-generalisation.md`) fixes what must be true at the end before any gene is added: one builder produces a curated set for any recognised human protein-coding gene from a short gene specification, with HBB as one instance of it; five sets exist (HBB, CFTR, BRCA1, SLC6A3 and one structure-limited gene chosen by a capability check run over sampled candidates, not by hand); every world and chapter is chosen from the set's capability file and no code path tests a gene symbol; a recognised gene without a curated set gets a journey from a live retrieval through the same builder; a variation metric (mean pairwise Jaccard distance on the scene inventory, the journey and the capability vector) puts numbers under the claim that the journeys differ; and no fictitious asset or claim appears (a domain structure states its coverage, a predicted model its confidence bands, a pathway a membership, an Open Targets record an association). The order of work puts the honest fallback early: the AlphaFold confidence extension, the generic builder with a byte-identical HBB check, the structure-limited gene, then CFTR with its deletion, Reactome and a Pathway World, BRCA1, Open Targets, SLC6A3, dynamic mode and the metric.

**AlphaFold confidence (P9.1.1).** The AlphaFold adapter now reads the per-residue pLDDT from the model file's own quality table (one contiguous row per residue, banded with AlphaFold DB's thresholds), the predicted aligned error matrix from the file the prediction record names, and the record's band fractions and reviewed flag. On P68871 the per-residue mean lands within 0.012 of the record's global pLDDT of 97.19 and the band shares equal the record's fractions to three decimals; the PAE matrix is 147 by 147 with a diagonal below 1.5 Å and no value above the file's stated maximum (HX-P9-2026-11-03-alphafold-confidence; C93). One live request recorded the PAE file as a fixture with its headers and hash; every test runs offline against it.

**One builder, HBB one instance of it.** The scientific core was already driven by a configuration object; step 2 of the plan moved the HBB selections into a gene specification file (`data/specs/hbb.json`: the dataset id, the Ensembl, HGNC and UniProt identifiers, the chosen experimental entry, the chosen variant allele with its ClinVar record, the genomic flank, the contact cutoff and whether to include AlphaFold), added a strict loader that rejects unknown keys and any key naming a world, a chapter, a camera or a colour, made the experimental entry and the reference variant optional, and routed both entry points through one runner. The proof is a byte comparison: a fixtures build of HBB with the old script before the change against a build with the new script after it differs only in the generator's script name and dirty flag (158 allowed timestamp differences, 14 files; HX-P9-2026-11-03-generic-builder; C94). A specification without a structure and without a variant, built from the same fixtures in a test, writes seven files and no structure, contact, variant, ClinVar or mapping record, and its capability report says in words what the specification did not select. An identifier lint now fails if an HBB identifier appears in library code outside the in-code mirror of the specification and one allow-listed Phase 7 fallback-planner file.

**The structure-limited gene, chosen by rule.** The plan requires one gene whose journey is honest about having no experimental structure, and forbids choosing it by hand. A finder walks HGNC identifiers in a seeded order (seed 20261103, a small deterministic generator over the identifiers 1 to 60000) and applies three mechanical filters: an approved protein-coding gene with one UniProt identifier and a MANE Select transcript; a reviewed UniProt entry with no PDB cross-reference; a protein-coding Ensembl gene with a MANE Select transcript. It stops after three candidates pass and takes the first. On 2026-11-03 it visited 22 identifiers, skipped 19 (unused identifiers, pseudogenes, non-coding RNAs, withdrawn entries, and one reviewed protein with nine structures) and chose FAAH2 (fatty acid amide hydrolase 2, UniProt Q6GMR7, 532 residues, no structure, an AlphaFold model), the ninth identifier visited; TMTC4 and WSB2 passed after it and are recorded as alternates (HX-P9-2026-11-03-structure-limited-gene; C95). The generic builder then produced its set from a specification naming no structure and no variant: seven files, 21 checks passed, and a capability file that says in words why there is no Protein World to show. The set's eleven raw inputs were recorded as fixtures with the same redaction research/raw received, and the set rebuilds from them byte for byte except for timestamps and the generator's mode. One check had to be generalised along the way: the initiator-methionine check assumed HBB's annotation of a removed Met, which FAAH2 does not carry; the check now accepts an entry that keeps its Met, and the HBB output is unchanged.

**The fallback end to end.** The app then learned to run any curated set. Records are found by their manifest kind instead of by HBB file names, the welcome's gene field resolves a symbol, alias or identifier against an index of the curated sets, and every availability on screen comes from the set's capability report. On FAAH2 the visitor gets DNA World with the real transcript, a disabled Protein World whose title and note carry the report's reason, a side-panel card that says in one sentence why there is no Protein World and lists the AlphaFold model as a prediction that is not loaded, a two-chapter journey, no variant artefact anywhere, and a refusal with the reason for any protein question, with no structure request made; the supported questions now name the capabilities they need, so a set without a variant offers none of HBB's. The HBB planner context is pinned field for field against the Phase 8 builder's output, and the Phase 4, 5, 6 and accessibility suites pass unchanged beside the new Phase 9 suite (helix-app 649bc26, helix-research 57d7f8e; HX-P9-2026-11-03-faah2-app; C96).

**CFTR and the deletion.** The second real gene brought the first variant that is not a substitution. F508del deletes three bases that straddle two codons: codon 507 ATC becomes ATT and still reads isoleucine, codon 508 TTT disappears, and the protein change is p.Phe508del with the frame kept. The builder now models a deletion from the responses alone (the recoder confirms the HGVS on the MANE Select transcript, VEP names the consequence and the protein change, the CDS map and the genomic window cover the span) and computes the protein change by translation before checking it against VEP; the anchored-indel alleles, the 3' HGVS placement against ClinVar's left-aligned one and the contextual SPDI against the net deletion are stated as explicit equivalences in the checks. The experimental structure is chosen by rule and the rule refused the better-resolved candidate: 6MSM (3.2 Å) carries an engineered E1371Q and is not wild type over the mapped segment, so 5UAK (3.87 Å) is the entry, where residue 508 is observed and a new check (T40) says so. The set passes 57 checks; its eleven inputs are recorded as redacted fixtures and it rebuilds from them byte for byte. The curated questions moved into the sets (HBB's four and CFTR's four, each with the capabilities it needs), and the HBB set, rebuilt offline from its 2026-11-02 snapshot, changed by that one file only (helix-research 95f8511 and the data commit after it; HX-P9-2026-11-03-cftr-deletion; C97).

**The deletion on screen.** The app then learned the deletion. The variant site became a union of a substitution and a deletion, and every surface composes its text from the records: DNA World collars the three deleted bases and rings them as a region, with the calipers and the marker on codon 508 and the annotation "codons 507 to 508, CTT deleted"; the codon tape marks 507 with its third base underlined and 508 struck through; the variant card and the comparison show both codons with their bases and amino acids before and after and a gap at 508, with checks that reproduce the record from the CDS; the bridge's four stations read the deletion, the translation, the numbering and the structure residue, and Protein World lands on residue 508 of 5UAK with the amber emphasis and the structure's method and resolution; the contacts question lists the record's seven partners. The curated questions are now read from each set's record, so HBB's texts left the code. The Phase 9 suite grew CFTR scenarios beside FAAH2's and HBB's, and the Phase 4, 5, 6 and accessibility suites pass unchanged (helix-app c1a6537, helix-research 10dacfc; HX-P9-2026-11-03-cftr-app; C98).

**Pathways as membership, and a rule corrected by its first result.** Reactome's Content Service (release 98, CC0 data) now gives every set a pathway-memberships record: the pathways that list the protein, each with its top-level pathway, and for every candidate pathway its participants as Reactome returns them, with the set's protein flagged (HBB 10 memberships, CFTR 11, FAAH2 1). The plan had named a "primary pathway", chosen as the smallest non-disease pathway with a diagram and described as the most specific one the protein belongs to; the first live run exposed the proxy, picking for haemoglobin a microautophagy pathway in which it is one substrate among sixteen rather than an erythrocyte pathway. The rule was kept as a mechanical choice of the pathway the world opens on, stated in the record and the capability reason as the rule's choice and never as importance, the record keeps every candidate's participants so a visitor can open any membership, and no text calls a pathway primary (helix D-H019). Six checks guard the record (species, membership classes, the opening pathway's participants listing the protein, every candidate's participants); the Reactome responses were recorded once per set with a new mixed mode of the builder (the snapshot for every other source) and the three sets were rebuilt on clean trees with the new record as their only change (helix-research 40655bc to d2cc2d2; HX-P9-2026-11-03-reactome-pathways; C99). The world followed the same day: a fourth world after Protein, a two-dimensional layer with no 3D, that lists every membership, opens the rule's choice first and says so, shows the opened pathway's participants as Reactome gives them with the set's protein in the discovery colour, carries the class 2 label on every surface and a note that this is membership only, loads its record on first need rather than at start, and gives each set a chapter and one question ("Which pathways list HBB?") that the rule-based planner answers by entering the world and revealing the record's evidence. The Phase 9 suite grew to sixteen scenarios and every earlier suite passes unchanged (helix-app 0045af2, helix-research c2cf6a0; HX-P9-2026-11-03-pathway-world-app; C100).

**BRCA1, a domain and nothing more.** BRCA1 has no full-length experimental structure, so its set had to say what a structure covers. The variant is C61G in the RING domain (dbSNP rs28897672, ClinVar VCV000017661, expert-panel reviewed); the candidate check chose 1JM7, a solution NMR ensemble of the RING domain bound to BARD1, over a fusion construct it refused and two cryo-EM complexes it would have taken next. Coverage became a first-class fact for every set: the structure record states the observed range, the counts, the protein length and the fraction in words that the capability report repeats (1JM7 covers residues 1 to 103 of 1,863, 5.5 %; by the same rule 2HBS covers 146 of HBB's 147 and 5UAK covers 1,139 of CFTR's 1,480), an NMR entry carries its model count and the model shown, the partner entity is named from the entry's own cross-references, and the predicted model carries its confidence bands (80 % of BRCA1's AlphaFold model at very low confidence). Two checks guard the method and the coverage arithmetic; the four sets were rebuilt on clean trees with these fields as their only change (helix-research bd8531f to f3fb6bf; HX-P9-2026-11-03-brca1-domain-structure; C101).

**On screen.** The app then put those facts where a visitor reads them: for every set the Protein World caption states the method in words, the resolution or its absence, the number of models and the one shown, the coverage as a range and a share, and the partner entity the structure was solved with; below 90 % coverage the caption, a side-panel card and the known limitations carry the record's own sentence that the rest has no experimental coordinates and that a predicted model never stands in for it; the predicted model's line states its confidence share when a band reaches 5 %. BRCA1 runs end to end (DNA World on codon 61, the bridge to CYS 61 of 1JM7 model 1, the contacts including the zinc, Pathway World), CFTR gains its coverage row and note, and HBB is unchanged (helix-app 5db4a7c, helix-research 61e6935; HX-P9-2026-11-03-brca1-app; C102). Four curated sets now run over four worlds.

**Associations, never causes.** Open Targets gave each set a record of disease associations: one request per gene, recorded once, the platform's version with it, the 25 highest-scoring associations kept with their datatype and datasource scores, and the datasources whose licences the project cannot carry dropped at parse time (Europe PMC, the Cancer Gene Census, and the platform's ChEMBL-derived clinical evidence, an identification recorded as a decision). Evidence World shows the table under a class 2 chip with the sentence that an association is never causal, the planner can cite one with its score under the same sentence, and the sets otherwise did not change (helix-research 8845ce9 to 1efe223; HX-P9-2026-11-04-opentargets-associations; C103).

**The generalisation test.** The fifth gene, SLC6A3, was set up as a test of the claim that nothing is hardcoded per gene: the set had to come out of the existing builder with no new record kind, and the app had to run it with no new code. Both held. Its variant was chosen by a rule over ClinVar, and the rule's own pass found nothing: SLC6A3 has no missense record at two stars or above, so the fallback the rule allows took R85W at one star, and the set, the card and Evidence World say so. Its structure, the human dopamine transporter 8Y2C (cryo-EM, 3.16 Å), came from the candidate check after an entry with an engineered mutation was refused. The run also found two checks that had quietly assumed HBB's shape, a multi-allelic site and a UniProt natural variant at the position; both were generalised without changing the first four sets' results. Five curated sets now run over four worlds through one code path (helix-research af21d47 and b630bee; HX-P9-2026-11-04-slc6a3-generalisation; C104).

**Dynamic mode.** A recognised gene without a curated set can now be retrieved live, in the visitor's browser, through the same builder and the same loader: a worker resolves the symbol through HGNC, fetches the transcript, the sequences, the UniProt entry and the AlphaFold prediction record from the four sources the registry measured as open to browsers, runs the unchanged checks, and hands the files to the loader with the hash check over the manifest it just wrote. The set has the honest shape of the structure-limited gene: no structure is selected because there is no reviewed selection and no candidate check at request time, no variant, no pathway or association retrieval (those services discourage one-entity querying from every visitor), and a banner, a limitation and every explanation say "retrieved live, not curated" with the releases used; nothing is stored between visits. Five genes were recorded once for the offline tests and one live run on PTEN cost twelve requests and under three seconds. The step exposed three more assumptions in the library (an entry without a Chain feature, a UniProt entry shared by two genes, a browser's decompressed bodies) and generalised them with the curated sets unchanged (helix-research 920f70b, helix-app 796b0f3; HX-P9-2026-11-04-dynamic-mode; C105).

**The numbers under the claim, and the gate.** The variation metric of the plan was computed from the app's own loader, context, inventory, planner and chapter matcher over the five sets: the mean pairwise Jaccard distance is 0.525 on the scene inventory, 0.218 on the capability vector, and 1.000 on the journey as the plan defined it, a value that says nothing because the transcript chapter names the gene and every other chapter's target is set-specific; a supplementary journey-shape axis (chapter id, world, focus kind) reads 0.267 and shows the honest picture, four sets sharing one shape and the structure-limited gene another (HX-P9-2026-11-04-variation-metric; C106). Phase 9 closed its build on 2026-11-04 with five curated sets over four worlds, dynamic mode, 447 and 450 unit tests, a Phase 9 suite of 40 scenarios and every earlier suite green, and five questions for the author recorded in its gate review; the author's verdict decides what the report says next.

### 9.7 Advanced contextual AI explorer (Phase 10)

*Written as the phase advances (invariant 14); the gate verdict is the author's.*

**The plan first.** Phase 10 opened on 2026-11-04 when the author passed Phase 9 (helix D-H021). Its plan (`docs/phase-10-ai-explorer.md`) asks for six new actions with full contracts, questions bound to what is selected on screen, a session profile that is visible and never stored, a new prompt version written without sight of the evaluation, graceful failure on the running app, and a frozen benchmark across the five genes, with follow-up sequences and injection items, run on the shipped local model against the rule-based planner.

**Six actions, on the rule-based path first.** The registry gained `selectTranscript`, `showProteinDomains`, `showPathway`, `setRepresentation`, `beginTransition` and `returnToOverview`, each with its preconditions, its refusals and its cancellation behaviour, and the rule-based planner learned to plan them. Prompt v5 stayed byte-identical: a model plan under v5 that names a new action is rejected as not taught by its prompt version, so the behaviour measured in Phases 3 to 9 did not move (HX-P10-2026-11-04-extended-registry; C107).

**What is selected, and who is asking.** A question such as "Why is this residue important?" is now bound to the selection: the answer cites the records of that residue or codon and nothing else, so a residue with no recorded feature or contact says so and points to the nearest recorded thing, never borrowing the variant's evidence. A session profile, built only from what the visitor did on screen, changes the depth of explanations and the order of offers; it is shown on a card, resets by keyboard and is never stored (HX-P10-2026-11-04-context-and-session; C108).

**Prompt v7 and failure on purpose.** Prompt v7 teaches the six actions, the selection block and the session block. It was written by an agent told not to open the benchmark folder, with v1 to v6 left byte-identical and pinned. Five failure kinds were then forced on the running app: an invalid plan, a timeout, a plan made stale by a gene switch, a cancel mid-plan, and an instruction injected into retrieved text; each ends in a stated state, and a new screen rejects any plan that repeats four consecutive words of retrieved text (HX-P10-2026-11-04-prompt-v7-and-failures; C109). The author then froze the benchmark set and v7 together (D-H023).

**The measured run.** The frozen set has 112 units: 85 questions over the five genes, five follow-up sequences of three turns, and 12 items with an instruction injected into a record field. Each was planned three times by the rule-based planner and by ministral-3:8b at temperature 0, and the Director's policy (the model's plan when it validates, else the rule-based plan) was replayed from the stored outputs. The result is negative overall: the policy was correct and valid on 273 of 336 outputs, the rule-based planner alone on 276 and the model alone on 252. The split is sharp. The model was better where the rule lists do not cover the wording: the six new actions (96 against 66 of 102) and the later follow-up turns (24 against 12 of 30). It was worse on the question types of Phases 3 to 9: it refused every association question, answered contact questions with the variant, and lost the first follow-up turns; those wrong plans are valid, so the fallback cannot recover them. Every unit gave the same verdict on all three repeats, so these are systematic behaviours rather than noise. The median planning time was 14.2 s (HX-P10-2026-11-04-benchmark; C110).

**Injection and the explanations.** Every injection item held under the policy. The model alone failed one item three times, by naming the injected identifier in its reason; validation rejected it. The explanations were checked by a rule list and every flagged text was then read in full: none of the rule-based texts and four of the model's units made a forbidden claim, two describing a reference structure as showing the variant, one stating a disease link no record holds, one suggesting a domain for a residue that has none. Three of those plans were valid, so the policy kept their text: validation checks actions and identifiers, not prose (C111).

**From plans to the screen.** The benchmark scored plans; the gate asks for visual behaviour, so the policy's 112 plans were replayed through the app's own validation and interpreter on the units' stated states. 109 executed cleanly and every step the harness could read back showed what it named; every refusal left the scene as it was. The three failures share one cause: the validator accepts opening any pathway the record lists, but the record keeps participants only for the opening rule's candidates, so the app cannot draw the others. One of those plans had been scored correct, so the plan-level score overstates the screen by one unit. The frame sequence owed since Phase 8 was also run: 24 of 29 budgets pass; the idle frames in Protein World remain, one long frame appeared under background system load, and the assets grew past their budget, mostly through the dynamic-mode worker (HX-P10-2026-11-04-gate-evidence; C112, C113).

**What the numbers point to.** The plan to let the model decide everything after validation is not supported by this set. A split that gives the model the explorer actions and the later follow-up turns and keeps the rules elsewhere would score higher here, but that estimate is in-sample and untested. The association result may come from prompt v7 rendering no association rows; testing that needs a new prompt version, which is a new study. These are findings for the author's gate review.

### 9.8 Release-grade QA, performance and accessibility (Phase 11)

To report:
- the accessibility audit;
- the scientific audit of every displayed claim against its records;
- the security, privacy and supply-chain review;
- desktop quality assurance.

**Milestone:** frozen report, source of the article.

### 9.9 Portfolio showcase and launch (Phase 12)

The public demonstration, if the author decides to publish it. To report: what was released and where, and any limits disclosed.

---

## 10. Limits and threats to validity

**Scope.**
- One gene, one variant, one experimental structure. Every scientific check is proven for this slice only. The off-by-one numbering and the label/auth coincidence are properties of 2HBS, not general rules (sections 4.3, 4.4).
- The Val6 contact analysis is limited to the asymmetric unit, with a single cutoff. Its interpretation as the lateral fibre contact is an inference (section 4.5) [C10].

**Time.**
- All records were retrieved on one day. ClinVar classifications, UniProt numbering of features and Ensembl transcript versions can change. The build records drift instead of failing on it, but a future release could still change a displayed value.
- The Ensembl platform transition puts the REST API's future in doubt (section 3.1).

**Measurement.**
- The performance figures are single runs on one fast laptop (Apple M1 Pro), in headless Chrome and in WKWebView.
- They are main-thread frame intervals, not GPU timers.
- With vsync on, they only show that no frame was missed.
- No low-end hardware was tested. The long-frame anomaly is characterised but its trigger is unexplained [C19, C48, C56].
- CORS was measured outside a browser, once per source, and not on error responses [C12].

**AI.** The Phase 1 desktop experiment made a single call to a single model, and its prompt was not stored verbatim [C23]. Phase 3 measured the frequency of such errors on a small, single-gene benchmark; its own limits are in section 8.8.

**Desktop distribution.**
- The build is not notarised, and Gatekeeper rejects it.
- The behaviour of a downloaded, quarantined copy was not tested.
- The build is arm64 only.

**Process.**
- The Phase 0 to 2 journal entries are retrospective, written on the same day from recorded evidence; they were not written during the runs.
- Several fields are recorded as "not recorded": durations, the exact Ollama model digest, the exact prompt.
- The Phase 2 dataset manifest named its generating commit by a hash from before the history rewrite of 2026-11-01 (equivalent on the public branch: 3b89a9a). The Phase 6 rebuild records 4b30c60, which is on the public branch (section 9.3).
- The work was carried out with substantial AI assistance (chapter 12). AI self-verification is not independent review; external review of the scientific claims is planned for Phase 11.

**Novelty.** The differentiation of section 3.5 is an inference from the sources read, not a measured user benefit. Whether a continuous cross-scale journey helps understanding needs a user study, which is not yet planned.

---

## 11. Ethics, licensing, privacy and cost

**Nonclinical use.** Helix does not interpret variants for individuals. It refuses medical-advice requests (tested in Phase 3), and it reports clinical records as records.

**Data licences and attribution.**
- Every source used permits redistribution of the fields Helix keeps, with conditions recorded in `docs/data-source-registry.md` and `docs/license-attribution-cost-audit.md`:
  - attribution for UniProt, AlphaFold DB and Gene Ontology;
  - the NCBI disclaimer;
  - AlphaFold's in-file disclaimer kept intact.
- Identifiers of proprietary resources (OMIM, HGMD) are removed and blocked by the build [C03].
- A Europe PMC abstract used to verify a citation is not stored, because abstract text is the publisher's copyright.

**Code licences.**
- The research repository is source-available for non-commercial research, with a contributor licence agreement. Its very first commit was published under MIT and is not revoked (`LICENSE_HISTORY.md`).
- The product repository is proprietary.

**Privacy incident.**
- On 2026-11-01, a research agent sent an email address as the NCBI `email` parameter, and the address entered the public raw-data manifests.
- It was redacted, and with the author's approval the affected public history was rewritten.
- Old commits may remain reachable on the hosting service by their hash until it garbage-collects them.
- The rule since then: no email address or personal identifier in any request, URL, header or committed file. The data adapters send NCBI only a `tool` name. The incident is reported here because it is a failure of the process, not only of a script (`journal/2026-11-01-raw-snapshot.md`).

**Cost.** As of 2026-11-01, Helix has spent $0 [C02]: no paid APIs, keys, data, fonts, models or hosting. Free public APIs and in-browser inference still cost end users bandwidth and device resources; that is disclosed, not counted as project spend. Notarisation would require a paid Apple Developer account, which is the author's decision.

**Supply chain.**
- Dependencies are pinned exactly.
- They were resolved to releases at least two weeks old.
- Tools are installed in user space with checksum verification.

---

## 12. AI-use declaration

Implementation, experiment execution, journaling and drafting of this report were carried out with substantial assistance from an AI coding agent (Claude Code, Anthropic), operating under the gated methodology documented in the research workspace's `docs/methodology.md`.

The author made or verified every scientific decision, every commitment and every claim, and takes full responsibility for the results. The decisions reserved to the author include:
- the repository licences;
- the removal of proprietary identifiers;
- the desktop amendment;
- the history rewrite after the privacy incident;
- every publication.

The exact wording of this declaration will follow the rules of each venue at the time of any release.

The AI models evaluated inside Helix (chapter 8) are objects of study. They are separate from the assistant used to build it.

---

## 13. Reproduction

All commands assume the user-space Node toolchain (`helix/.tools/node`, Node 22.23.3) and, for the Phase 1 scripts, the locked Python environment (`uv.lock`: Python 3.12.1, Biopython 1.88).

| What | Command or location |
|---|---|
| Raw snapshot (Phase 1) | `scripts/research/fetch_raw.py`; manifests in `research/raw/*/MANIFEST.tsv` |
| HbS mapping and contacts (offline) | `scripts/research/inspect_hbs_mapping.py`, `scripts/research/val6_contacts.py` |
| Rendering experiments | `research/experiments/molstar-embed/`, `molstar-r3f-bridge/`: `npm ci && npm run build`, then `node scripts/measure.mjs` (and `--uncapped`) |
| Desktop experiment | `research/experiments/tauri-shell/README.md` (build and run commands) |
| Curated dataset | `scripts/data-preparation/build-hbb.ts` (live, offline from cache, or from fixtures); `compare-builds.ts` for the regeneration check |
| Tests | `npm test`; `npm run test:live` for the opt-in live smoke tests |

---

## 14. Bibliography

All URLs accessed 2026-11-01. The complete reference lists are in `docs/competitor-analysis.md`, `docs/scientific-research.md` and `docs/data-source-registry.md`. Every link was checked on 2026-11-02 with `scripts/report/check_links.py` (29 links, 0 failing; DOIs confirmed against Crossref; results in `journal/results/link-check-2026-11-02.tsv`). The check is run again immediately before publication.

**Primary scientific literature**

- Harrington, D. J., Adachi, K. and Royer, W. E. (1997). The high resolution crystal structure of deoxyhemoglobin S. *Journal of Molecular Biology*, 272, 398-407. [doi:10.1006/jmbi.1997.1253](https://doi.org/10.1006/jmbi.1997.1253). PubMed [9325099](https://pubmed.ncbi.nlm.nih.gov/9325099/).
- Sehnal, D. et al. (2021). Mol* Viewer: modern web app for 3D visualization and analysis of large biomolecular structures. *Nucleic Acids Research*. [doi:10.1093/nar/gkab314](https://doi.org/10.1093/nar/gkab314).
- Midlik, A. et al. (2025). MolViewSpec: a Mol* extension for describing and sharing molecular visualizations. *Nucleic Acids Research*. [doi:10.1093/nar/gkaf370](https://doi.org/10.1093/nar/gkaf370).
- Slanináková, T. et al. (2026). MolViewStories: Interactive molecular storytelling. *Protein Science*. [doi:10.1002/pro.70540](https://doi.org/10.1002/pro.70540).
- Varadi, M. et al. (2024). AlphaFold Protein Structure Database in 2024. *Nucleic Acids Research*. [doi:10.1093/nar/gkad1011](https://doi.org/10.1093/nar/gkad1011).

**Data resources and records**

- Ensembl REST API, release 116. [rest.ensembl.org](https://rest.ensembl.org/)
- HBB gene record ENSG00000244734. [Ensembl lookup](https://rest.ensembl.org/lookup/id/ENSG00000244734?expand=1;mane=1;content-type=application/json)
- UniProt P68871 (HBB_HUMAN), release 2026_03. [uniprot.org/uniprotkb/P68871](https://www.uniprot.org/uniprotkb/P68871/entry)
- PDB entry 2HBS. [rcsb.org/structure/2HBS](https://www.rcsb.org/structure/2HBS)
- SIFTS residue-level mapping, PDBe. [ebi.ac.uk/pdbe/docs/sifts](https://www.ebi.ac.uk/pdbe/docs/sifts/)
- ClinVar VCV000015333. [ncbi.nlm.nih.gov/clinvar/variation/15333](https://www.ncbi.nlm.nih.gov/clinvar/variation/15333/)
- AlphaFold DB entry AF-P68871-F1. [alphafold.ebi.ac.uk/entry/P68871](https://alphafold.ebi.ac.uk/entry/P68871)
- HGNC, HBB. [genenames.org](https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/HGNC:4827)

**Standards and conventions**

- HGVS nomenclature, numbering. [hgvs-nomenclature.org/stable/background/numbering](https://hgvs-nomenclature.org/stable/background/numbering/)
- HGVS nomenclature, reference sequences (MANE recommendation). [hgvs-nomenclature.org/stable/background/refseq](https://hgvs-nomenclature.org/stable/background/refseq/)
- NCBI SPDI notation. [ncbi.nlm.nih.gov/variation/notation](https://www.ncbi.nlm.nih.gov/variation/notation/)
- Ensembl canonical and MANE Select transcripts. [ensembl.org/info/genome/genebuild/canonical.html](https://www.ensembl.org/info/genome/genebuild/canonical.html)

**Tools and related work**

- Mol* repository (MIT). [github.com/molstar/molstar](https://github.com/molstar/molstar)
- Mol* documentation v5, creating an instance. [molstar.org/docs/v5/plugin/instance](https://molstar.org/docs/v5/plugin/instance/)
- Mol* `packages/ai`, master branch (unreleased). [github.com/molstar/molstar/tree/master/packages/ai](https://github.com/molstar/molstar/tree/master/packages/ai)
- Mol* Prism viewer agent specification, master branch (unreleased). [agent.md](https://github.com/molstar/molstar/blob/master/packages/prism/viewer/_spec/agent.md)
- MolViewStories, Making of MOTM 01. [molstar.org/mol-view-stories](https://molstar.org/mol-view-stories/docs/example-stories/making-of-mom1.html)
- PDB-101 Molecule of the Month: Hemoglobin (May 2003). [pdb101.rcsb.org/motm/41](https://pdb101.rcsb.org/motm/41)
- NCBI iCn3D. [ncbi.nlm.nih.gov/Structure/icn3d](https://www.ncbi.nlm.nih.gov/Structure/icn3d/icn3d.html)
- EMBL-EBI news, Ensembl 116 released (11 June 2026). [ebi.ac.uk](https://www.ebi.ac.uk/about/news/updates-from-data-resources/ensembl-116-release/)
- EMBL-EBI news, Ensembl rolls out new website (25 August 2026). [ebi.ac.uk](https://www.ebi.ac.uk/about/news/updates-from-data-resources/ensembl-new-website/)
- Tauri 2. [v2.tauri.app](https://v2.tauri.app/)
- React Three Fiber. [r3f.docs.pmnd.rs](https://r3f.docs.pmnd.rs/)

---

## Annex A. Phase map and evidence index

| Phase | Report chapter | Journal entries | Status (2026-11-01) |
|---|---|---|---|
| 0 Repository, continuity, environment | 1.4 | none (no experiment) | verified |
| 1 Research: science, competitors, data, rendering, desktop | 2 to 6 | raw-snapshot, hbs-mapping, val6-contacts, cors, molstar-embed, molstar-r3f-bridge, tauri-shell | verified |
| 2 Data acquisition and validated domain core | 4, 7 | hbb-dataset-build | verified |
| 3 Local and browser AI | 8 | ai-benchmark-ollama, webllm-browser | verified |
| 4 AI-to-World proof | 9.1 | ai-to-world-e2e, cancellation, long-frame | verified |
| 5 Journey engine, two worlds | 9.2 | dna-world-bridge, transitions, modes-rapid, long-frame-reprobe | verified |
| 6 Complete HBB vertical slice | 9.3 | hbb-rebuild, clinvar-live-smoke, vertical-slice-e2e | built; author review pending |
| 7 to 12 | 9.4 to 9.9 | to be written as runs happen | not started |
