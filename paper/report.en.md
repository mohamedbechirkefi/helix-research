<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# Helix: evidence-bound, AI-directed exploration from genome to protein structure

## Technical report, English master

| | |
|---|---|
| Author | Mohamed Bechir Kefi |
| Version | Working draft 0.4, 2026-11-02 |
| Status | Chapters 1 to 8, 9.1, 9.2, 10 and 11 drafted (Phases 0 to 5). Sections 9.3 to 9.9 are headed placeholders. |
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
| Clinical record | VCV000015333.183, Pathogenic (criteria provided, multiple submitters, no conflicts) [C09] | ClinVar |

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
- Only codon 7 reaches a structure residue, because the dataset holds a mapping record for that position only.
- Chapter planning is deterministic only.
- Starting in DNA World adds about 0.73 s to the reference question, for the fade between worlds [C57].
- Keyboard navigation of the codon strip was not tested end to end. Safari, Firefox and the desktop webview were not run.

**Tests.** After Phase 5, the product repository has 93 passing tests, and this repository 160 (157 pass, 3 opt-in live tests skipped); typecheck is clean in both [C58].

### 9.3 Complete HBB vertical slice (Phase 6)

The complete HBB journey. To report: scientific correctness of every displayed statement against the dataset, and the results of the author's review. **Milestone:** second French copy.

### 9.4 Art direction, branding and UX system (Phase 7)

The visual system and its rationale. To report: design decisions with rejected alternatives, and accessibility constraints adopted.

### 9.5 Cinematic world and visual polish (Phase 8)

The cinematic layer. To report: performance budgets and measurements, and the labelling of illustrative content.

### 9.6 Multi-gene personalisation (Phase 9)

Generalisation beyond HBB. To report: which genes, which checks generalised and which failed, and the variation metric across genes.

### 9.7 Advanced contextual AI explorer (Phase 10)

The extended AI layer. To report: the extended benchmark (multiple genes, follow-ups, injection) and a reliability report.

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
- The dataset manifest names its generating commit by a hash from before the history rewrite of 2026-11-01. The equivalent commit on the public branch is 3b89a9a (`journal/2026-11-01-hbb-dataset-build.md`).
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

All URLs accessed 2026-11-01. The complete reference lists are in `docs/competitor-analysis.md`, `docs/scientific-research.md` and `docs/data-source-registry.md`. Links marked † were added while drafting and must be checked before publication.

**Primary scientific literature**

- Harrington, D. J., Adachi, K. and Royer, W. E. (1997). The high resolution crystal structure of deoxyhemoglobin S. *Journal of Molecular Biology*, 272, 398-407. [doi:10.1006/jmbi.1997.1253](https://doi.org/10.1006/jmbi.1997.1253). PubMed [9325099](https://pubmed.ncbi.nlm.nih.gov/9325099/) †.
- Sehnal, D. et al. (2021). Mol* Viewer: modern web app for 3D visualization and analysis of large biomolecular structures. *Nucleic Acids Research*. [doi:10.1093/nar/gkab314](https://doi.org/10.1093/nar/gkab314).
- Midlik, A. et al. (2025). MolViewSpec: a Mol* extension for describing and sharing molecular visualizations. *Nucleic Acids Research*. [doi:10.1093/nar/gkaf370](https://doi.org/10.1093/nar/gkaf370).
- Slanináková, T. et al. (2026). MolViewStories: Interactive molecular storytelling. *Protein Science*. [doi:10.1002/pro.70540](https://doi.org/10.1002/pro.70540).
- Varadi, M. et al. (2024). AlphaFold Protein Structure Database in 2024. *Nucleic Acids Research*. [doi:10.1093/nar/gkad1011](https://doi.org/10.1093/nar/gkad1011).

**Data resources and records**

- Ensembl REST API, release 116. [rest.ensembl.org](https://rest.ensembl.org/)
- HBB gene record ENSG00000244734. [Ensembl lookup](https://rest.ensembl.org/lookup/id/ENSG00000244734?expand=1;mane=1;content-type=application/json)
- UniProt P68871 (HBB_HUMAN), release 2026_03. [uniprot.org/uniprotkb/P68871](https://www.uniprot.org/uniprotkb/P68871/entry) †
- PDB entry 2HBS. [rcsb.org/structure/2HBS](https://www.rcsb.org/structure/2HBS) †
- SIFTS residue-level mapping, PDBe. [ebi.ac.uk/pdbe/docs/sifts](https://www.ebi.ac.uk/pdbe/docs/sifts/)
- ClinVar VCV000015333. [ncbi.nlm.nih.gov/clinvar/variation/15333](https://www.ncbi.nlm.nih.gov/clinvar/variation/15333/) †
- AlphaFold DB entry AF-P68871-F1. [alphafold.ebi.ac.uk/entry/P68871](https://alphafold.ebi.ac.uk/entry/P68871) †
- HGNC, HBB. [genenames.org](https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/HGNC:4827) †

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
- Tauri 2. [v2.tauri.app](https://v2.tauri.app/) †
- React Three Fiber. [r3f.docs.pmnd.rs](https://r3f.docs.pmnd.rs/) †

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
| 6 to 12 | 9.3 to 9.9 | to be written as runs happen | not started |
