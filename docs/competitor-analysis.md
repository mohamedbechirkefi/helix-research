<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->

# Competitor and technology analysis (P1.2.1, P1.2.2)

**Status:** draft. All sources accessed 2026-11-01. Not yet reviewed by the author.

## Method

This report covers the neighbours named in master prompt section 3.3: Ensembl, UCSC Genome Browser, IGV, UniProt (with ProtVista and Nightingale), RCSB PDB viewers, Mol\*, MolViewStories, MolViewSpec, iCn3D, AlphaFold DB, Vitessce and Reactome, plus three works of molecular storytelling. Each tool is described on eight dimensions: capabilities, limitations, extensibility and APIs, licence, performance, accessibility, visual design, and AI or orchestration support.

Sources were, in order of preference: official documentation pages, the project's GitHub repository (licence read through the GitHub licence API or the LICENSE file itself), package registries (npm, PyPI) for current version numbers, and peer-reviewed papers (abstracts retrieved through the Europe PMC REST API, cited by DOI). Web search was used only to locate primary pages; a claim that rests only on a search snippet is marked as such. Nothing was benchmarked in this pass, so every performance statement is either a documented claim with its source or "not measured". A feature that could not be confirmed on a primary source is written "unverified".

**Legend.**

- **Fact** `[n]`: stated by the cited primary source on the access date. The bracketed number points to the References list.
- **Inference**: a conclusion drawn by this report from cited facts; the reasoning is given.
- **Assumption**: a working belief not yet checked; it needs an experiment or a later source.

Version numbers come from registries or repositories on 2026-11-01 and will drift.

## Summary matrix

| Tool | Scope | Embedding/API | Licence | AI/orchestration |
| --- | --- | --- | --- | --- |
| Ensembl | Genomes, genes, transcripts, variants | REST API (release 116); new site in progress | Apache-2.0 (code) | AlphaGenome scores in VEP (headline only); no assistant found |
| UCSC Genome Browser | Genome tracks, 4000+ assemblies | URL parameters, sessions, REST API | MIT (most code), proprietary (`hg` CGIs), commercial licence for browser | Community MCP server only |
| IGV (igv.js, desktop) | Genome tracks, alignments, variants | igv.js JS API + events; desktop port/batch | MIT | None found |
| UniProt + Nightingale | Protein sequence features, variants | REST API; Nightingale web components | MIT (ProtVista, Nightingale) | None in product; community MCP servers |
| RCSB PDB viewers | Experimental structures in Mol\* | rcsb-molstar npm package, Viewer class | MIT (rcsb-molstar) | ML structure similarity search; no viewer agent found |
| Mol\* | General 3D macromolecular viewer | npm, Viewer, PluginContext | MIT | Unreleased v6 agent and assistant on master |
| MolViewStories | Authored molecular stories | Web app, export to MVSJ/MVSX/HTML | MIT | Narration drafted with LLM in one example; no built-in AI found |
| MolViewSpec | Declarative molecular scene format | JSON tree; Python and TS builders; `loadMVS` | MIT | No documented LLM use |
| iCn3D | 3D viewer + structure analysis | iframe, JS widget, URL commands, npm, Python | Public domain (US Gov work) + DelPhi non-commercial | "AI Tutor" linked from docs |
| AlphaFold DB | Predicted structures + confidence | REST API keyed on UniProt | CC-BY-4.0 (data) | Data are AI predictions; no assistant |
| Vitessce | Spatial single-cell visualisation | JSON view config; React, Python, R | MIT | None found |
| Reactome | Curated pathways | Content Service; DiagramJs widget | CC0 (data), CC BY 4.0 (art), Apache-2.0 (code) | None found |
| PDB-101 Molecule of the Month | Illustrated molecular articles | Web articles, JSmol views | CC-BY-4.0 (illustrations only) | None |

## Tool profiles

### Ensembl (genome browser and REST API)

- **Capabilities.** Fact: Ensembl integrates genomic data across "the tree of life", with more than 4800 eukaryotic and 31 300 prokaryotic genomes in 2025, and expanded the Variant Effect Predictor (VEP) [31]. The REST API exposes 16 endpoint groups including Lookup, Sequence, Overlap, Mapping, Variation, VEP and Cross References [34].
- **Limitations.** Fact: the platform is in transition. Release 116 (11 June 2026) is "the final release on the current Ensembl platforms"; new data go to the new site [33]. On 25 August 2026 EMBL-EBI announced that the browser and database "have moved to a new platform", with more features to come, "including legacy and new features"; legacy sites "remain available via the Ensembl archives" [32]. Fact: `rest.ensembl.org` still reports data release 116 (`/info/data`) [34]. Fact: the `Ensembl/ensembl-rest` repository was archived on 2026-10-16 [35]. Inference: the long-term status of the REST API on the new platform is not documented in the sources read; this is an open risk for HELIX (see Risks).
- **Extensibility and APIs.** Fact: REST, language agnostic over HTTP [34][35]. Fact: an `ensembl-genome-browser` package bundles the compiled genome browser "along with a javascript communication framework that can be used to embed and control the GB" [37]; its repository was last pushed in March 2023 and declares no licence through the GitHub API [37]. Inference: no maintained, documented embeddable Ensembl browser widget was found.
- **Licence.** Fact: `Apache-2.0` for `ensembl-rest` [35] and for `ensembl-client`, "the frontend of the new Ensembl website" [36]. Data terms: see `docs/data-source-registry.md` (Ensembl section) [65].
- **Performance.** Documented: the rate limit of 15 requests per second is recorded in `docs/data-source-registry.md`. Rendering performance: not measured.
- **Accessibility.** No statement found for the new site in this pass.
- **Visual design.** Fact: the new site's HTML describes itself as "The new website of the Ensembl project" and is a client-rendered application [38]. Detailed visual review: not done (the page requires JavaScript).
- **AI or orchestration.** Fact: an EMBL-EBI news headline dated 9 September 2026 reads "AlphaGenome Variant Impact scores integrated into Ensembl VEP" (seen on [32], article not read). No assistant, chat or MCP feature found. Fact: EMBL-EBI said in December 2025 that MCP "is something we are exploring across the EMBL-EBI services", with no released official server mentioned [78].

### UCSC Genome Browser

- **Capabilities.** Fact: web-based visualisation of more than 4000 assemblies, internal tracks plus custom tracks and track hubs; 2025 additions include a gnomAD 4.1 track and a popup dialog for item details [39].
- **Limitations.** Fact: some clinical tracks (examples named: HGMD, LOVD, OMIM, Decipher, COSMIC) are not available from UCSC; liftOver chain files are non-commercial [40]. Fact: the FAQ on linking describes URL linking and sessions but gives no iframe embedding guidance [42].
- **Extensibility and APIs.** Fact: URL parameters `db=`, `position=`, `hgct_customText`, `hubUrl=`; shareable sessions at `/s/<user>/<session>`; the FAQ warns that `hgsid` in shared URLs is "a privacy concern" [42]. Fact: REST API at `https://api.genome.ucsc.edu/` with `/getData/track`, `/getData/sequence`, `/list/*`, `/search`; `maxItemsOutput` caps at 1 000 000 [41].
- **Licence.** Fact: "The majority of the Genome Browser source code is available under the MIT license"; many `kent/src/hg` directories (hgTracks, hgTables, hgc and others) carry `LicenseRef-proprietary` files; commercial use of the browser software needs a licence; "No license or permission is needed to use the website, API and public MySQL server" [40]. The GitHub API reports `NOASSERTION` for `ucscGenomeBrowser/kent` (repository metadata, accessed 2026-11-01).
- **Performance.** Documented: "We generally recommend a maximum of one hit every second" for the API [41]. Rendering: not measured.
- **Accessibility.** Fact: a dedicated page documents OpenDyslexic and Atkinson Hyperlegible fonts, configurable font and tooltip sizes, and keyboard navigation "across all main pages" [43]. No WCAG conformance claim found.
- **Visual design.** Inference from [39][43]: a server-rendered track image with dense configuration menus, designed for researchers.
- **AI or orchestration.** Fact: none on the official site in this pass. A community "UCSC Genome Browser MCP Server" wrapping the REST API exists (found through directory listings; not a UCSC product; search snippet only).

### IGV (igv.js and IGV desktop)

- **Capabilities.** Fact: igv.js is "an embeddable interactive genome visualization component", one JavaScript file with no external dependencies [44]; it "runs completely in the web browser, with no backend server and no data pre-processing required" [47]. Track types documented include annotation, wig, alignment, variant, mutation, GWAS, interact, QTL and RNA structure [45].
- **Limitations.** Inference: a genome-coordinate track viewer; it has no protein-structure view.
- **Extensibility and APIs.** Fact: `igv.createBrowser(div, config)` returns a `Browser` [44]; methods include `loadGenome`, `loadSessionObject`, `loadSession`, `loadTrack`, `findTracks`, `removeTrack` [45]. Events via `browser.on(event, handler)`: `trackremoved`, `trackdrag`, `trackdragend`, `locuschange`, `trackclick` (can return custom popover HTML or `false`), `trackorderchanged` [46]. Desktop: IGV listens on port 60151 by default for the same commands as batch scripts, plus HTTP links such as `/goto?locus=` (official page found by search, quoted from snippet) [49].
- **Licence.** Fact: `MIT` for igv.js (npm `igv` 3.8.10) and for IGV desktop [44][48][49]. Citation: Robinson et al. 2011 [50].
- **Performance.** Documented self-description only: desktop is "Fast, efficient, scalable" [48]; the desktop docs call IGV "a high-performance, easy-to-use, interactive tool" [49]. No benchmark found. Not measured.
- **Accessibility.** No statement found.
- **Visual design.** Inference: utilitarian track layout with ideogram, ruler and popovers [45][46].
- **AI or orchestration.** Fact: both repositories contain a `CLAUDE.md` file for contributors [44][48]; this is developer tooling, not a product feature. No assistant or MCP feature found.

### UniProt (website, ProtVista, Nightingale)

- **Capabilities.** Fact: the feature viewer shows domains, sites, PTMs, mutagenesis, peptides and natural variants in tracks; selecting a feature highlights those residues across tracks; when a structure is available, "an interactive graphic of the structure is shown below the feature table" [51]. The variant viewer maps curated and imported variants (dbSNP, NCBI-TCGA, gnomAD) and colours them by consequence [52]. The structure section has PDB, AlphaFoldDB and 3D-Beacons tabs, pLDDT colouring and an AlphaMissense pathogenicity track [53].
- **Limitations.** Inference: protein-centric; genomic context is linked rather than shown in one coordinated scene. UniProt 2025 reports a new tab "linking protein to genomic information" [58].
- **Extensibility and APIs.** Fact: ProtVista is "A Web Component which uses Nightingale components" [54]. Nightingale is "a library of re-usable data visualization web components" used by UniProt and InterPro [56]; packages include `nightingale-manager`, `nightingale-navigation`, `nightingale-sequence`, `nightingale-track`, `nightingale-variation`, `nightingale-structure`, `nightingale-msa` and others [55]. Fact: `@nightingale-elements/nightingale-structure` 5.11.0 depends on `molstar` 3.44.0 [57]. Inference: Nightingale's structure component pins a Mol\* major version two behind the current 5.x [26], so mixing it with a current Mol\* in one page may duplicate the library.
- **Licence.** Fact: ProtVista (`protvista-uniprot`) and Nightingale are MIT [54][55][56]. UniProt data are CC BY 4.0 (see `docs/data-source-registry.md`).
- **Performance.** Not measured. No documented claim found.
- **Accessibility.** No statement found (UniProt help search for "accessibility" returned no accessibility page).
- **Visual design.** Fact: track layout with expandable sub-tracks and a yellow vertical highlight for selections [51].
- **AI or orchestration.** Fact: UniProt uses "machine learning techniques" in annotation [58]. No assistant found. Community MCP servers for UniProt exist; none is official [78].

### RCSB PDB viewers (Mol\* on rcsb.org, rcsb-molstar)

- **Capabilities.** Fact: the rcsb.org Mol\* interface has a 3D canvas, sequence panel, controls panel and log; a default mode that focuses a clicked residue and shows "its surroundings and local interactions"; a selection mode; keyboard controls for rotation, fly mode, spin and rock [27]. rcsb-molstar adds alignment and motif visualisation, selection highlighting for the 3D Protein Feature View and "bookmarkable focus views on ligands or chains" [28].
- **Limitations.** Inference: entry-centric; no narrative layer beyond what Mol\* provides.
- **Extensibility and APIs.** Fact: npm `@rcsb/rcsb-molstar` (2.15.0) [28][26]. The `Viewer` class in `src/viewer/index.ts` exposes, among others, `loadSnapshotFromUrl`, `subscribeToSelection`, `setSelectionGranularity`, `focusOnResidue`, `selectResidueSurroundings`, `setBallAndStick`, `resetCamera`, `setFocus`, `clearFocus`, `select(targets, 'select' | 'hover', 'add' | 'set')`, `clearSelection`, `createComponent`, `removeComponent`, and `pluginCall` for raw plugin access (read from source, not from documentation) [28].
- **Licence.** Fact: `MIT` [28].
- **Performance.** Not measured. See Mol\*.
- **Accessibility.** Fact: keyboard controls are documented [27]; no accessibility statement found.
- **Visual design.** Inference: Mol\* default UI in RCSB styling.
- **AI or orchestration.** Fact: RCSB redesigned its structure similarity search to use "machine learning-based embeddings" (20 March 2026) [29]. RCSB provides a Python package `rcsb-api` for programmatic access [30]. No in-viewer assistant found. MCP servers for RCSB data exist but are community projects (search snippets only).

### Mol\*

- **Capabilities.** Fact: web-native 3D visualisation and streaming of coordinate and experimental data, display of quality and annotation data, "up to hundreds of (superimposed) protein structures", molecular dynamics trajectories, cell-level models and huge integrative structures; "the primary 3D structure viewer used by PDBe and RCSB PDB" [20].
- **Limitations.** Fact (stated by the MolViewSpec authors): Mol\* "has a steep learning curve and is only available via a JavaScript interface" [18].
- **Extensibility and APIs.** Fact: four integration levels: `Viewer.create(...)`; `createPluginUI({ target, spec, render: renderReact18 })`; `new PluginContext(spec)` with `plugin.init()` and `initViewerAsync(canvas, parent)` without the React UI; and bare `Canvas3D` [21]. npm `molstar` 5.13.1, latest GitHub release v5.13.0 (2026-10-04) [26]. Events and behaviours (click, hover) are not documented on the v5 pages read [21]; unverified from documentation.
- **Licence.** Fact: `MIT` ("Copyright (c) 2017 - now, Mol\* contributors") [19].
- **Performance.** Documented claim: "High-performance graphics and data management" for the cases listed above [20]. Not measured for 2HBS.
- **Accessibility.** Fact: no statement for released v5 found. On `master`, the unreleased Prism UI has an accessibility specification covering "keyboard, focus, ARIA, the live region, touch", a high-contrast theme honouring `prefers-contrast`, and axe checks in tests; its TODO defers "a screen reader pass" until before Prism becomes the default viewer [25].
- **Visual design.** Fact: v5 uses a React UI [21]. On `master`, Prism is "The new Mol\* UI", not React, with light, dark, blue and high-contrast themes [25].
- **AI or orchestration.** Fact: the `master` branch (version `6.0.0-dev.0`, package marked `"private": true`, so not published) contains `@molstar/ai`, "the agent harness", with Anthropic, OpenAI and Google providers and TTS narration [22]. The viewer agent (`createViewerAgent`) exposes core tools `get_scene`, `undo_turn`, `ask`, `get_selection`, `load_entry`, `load_url`, `select`, `clear_selection`, `focus`, `apply_preset`, `apply_style`, `color`, `set_background`, `reset_camera`, plus skills (selections, styles, canvas, camera, measure, superpose, snapshots, animation, export) [23]. Policies: state changes are preauthorised while the turn can be undone; destructive, upload and non-undoable calls ask every time; network access is checked per address; text from data is quoted and truncated as untrusted; "keys never reach the model" [23]. The spec says "The assistant, evals and an MCP server call it alike" [23]; no released MCP server was found. The assistant supports Anthropic, Google, OpenAI and "one's own OpenAI-compatible endpoints ... https, or http on localhost" [24]. Inference: this is the closest neighbour to HELIX's "AI-directed validated visual actions", but it is unreleased, bring-your-own-key, and general-purpose rather than evidence-driven.

### MolViewStories

- **Capabilities.** Fact: web platform for "creating and sharing interactive, narrative-driven molecular visualizations", built on MolViewSpec "extended to support animations, interactive descriptions, and synchronized audio commentary", rendered by Mol\* with WebGL and WebXR [8]. Graphical builder and a code editor with "Full access" to the MVS API; multi-scene stories with transitions [1][2]. Version shown: v1.1.0 [1].
- **Limitations.** Fact: cloud features need login with "institutional credentials"; 100 sessions, 100 published stories and 50 MB per session per user; "There's no 'unpublish' feature"; "Large structures (say >20MB) may need simplification" [4][5].
- **Extensibility and APIs.** Fact: export as `.mvstory` (project), `.mvsj` (state for the Mol\* Viewer), `.mvsx` (ZIP with assets, for self-hosting) and self-contained HTML [4]; published stories get a persistent URL [8]; a Deno CLI exists [7]. iframe embedding: not documented [4][5].
- **Licence.** Fact: `MIT` (GitHub API) [7]. The FAQ says it is "completely free for academic and educational use" [5].
- **Performance.** Documented: the 20 MB guidance above [5]. Not measured.
- **Accessibility.** No statement found [2][5].
- **Visual design.** Inference: Mol\* canvas with a Markdown description panel; examples include buttons and labels drawn as primitives [6].
- **AI or orchestration.** Fact: in the "Making of MOTM 01" example, narration "was drafted by ChatGPT" and voiced with an AI text-to-voice tool [6]. No built-in AI feature found [1][2].

### MolViewSpec (MVS)

- **Capabilities.** Fact: "a standardized approach for defining molecular visualizations that decouples the definition of complex molecular scenes from their rendering", covering structural, volumetric and annotation data, colours, labels, measurements and custom 3D geometry [18]. Details in the P1.2.2 section below.
- **Limitations.** Fact: no load events or callbacks are documented [13]. Inference: MVS describes scenes; it does not describe UI, sequence panels or genome tracks.
- **Extensibility and APIs.** Fact: Python package `molviewspec` (PyPI 1.8.1) and a JavaScript/TypeScript builder in the Mol\* extension; "This API can be implemented in any language supporting the JSON format" [16][17][18].
- **Licence.** Fact: `MIT` ("Copyright (c) 2023 - now, Mol-view-spec contributors") [16].
- **Performance.** Not measured.
- **Accessibility.** No statement found. The paper uses "accessibility" in the sense of ease of use [18].
- **Visual design.** Not applicable (format).
- **AI or orchestration.** Fact: neither the docs [9], the repository [16] nor the paper [18] mentions LLMs. Inference: a typed, validated JSON tree (`MVSData.isValid`, `validationIssues` [13]) is a natural target for generated plans, but no source documents that use.

### iCn3D

- **Capabilities.** Fact: synchronises "3D structure, 2D interaction, and 1D sequences and annotations"; interaction, mutation, DelPhi electrostatics, SASA, contact maps, VAST+ and Foldseek search; SNP and ClinVar annotation tracks; VR (headset browser) and AR (Chrome on Android only) [59]. Share links are "lifelong" and replayable step by step [59]; scenes can be shared as URLs encapsulating data and scripts [61].
- **Limitations.** Fact: AR is not available on iPhone [59].
- **Extensibility and APIs.** Fact: iframe with a full command URL (not the short link); JS widget initialising `iCn3DUI`; URL `command` parameter; npm `icn3d` (3.54.6) for Node.js; `icn3dpy` for Jupyter [59][26].
- **Licence.** Fact: `LICENSE.md` declares the code a "United States Government Work" in the public domain, except the DelPhi code, licensed by Columbia University, "which does not permit commercial use without contacting the DelPhi project" [60]. GitHub reports `NOASSERTION`; npm says "SEE LICENSE IN LICENSE". No single SPDX identifier applies.
- **Performance.** Not measured. No documented claim found.
- **Accessibility.** No accessibility section found; a mobile menu option exists [59].
- **Visual design.** Inference: dense menu-driven analysis UI.
- **AI or orchestration.** Fact: the iCn3D page links an "AI Tutor for iCn3D" at vizomics.org that gives step-by-step instructions for building views [59]. Its model and implementation were not found.

### AlphaFold DB

- **Capabilities.** Fact: over 214 million predicted structures, PAE viewer linked to the Mol\* 3D viewer (selecting PAE regions highlights them in 3D) [63]; per-residue confidence and PAE [64].
- **Limitations.** Fact: predictions, not experimental structures; the model file carries a "THEORETICAL MODELLING ONLY" disclaimer (recorded in `docs/data-source-registry.md`).
- **Extensibility and APIs.** Fact: REST endpoints `/prediction/{qualifier}`, `/complex/{qualifier}`, `/uniprot/summary/{qualifier}.json`, `/sequence/summary`, `/annotations/{qualifier}.json`, "keyed on UniProt accessions" [62]. Embeddable viewer: not documented in sources read.
- **Licence.** Fact: data under CC-BY-4.0, with EMBL-EBI attribution expected (recorded in `docs/data-source-registry.md`, AlphaFold DB section) [65]. Viewer code licence: unverified (the specific Mol\* build used was not identified).
- **Performance.** Not measured.
- **Accessibility.** No statement found.
- **Visual design.** Fact: confidence colouring in 3D and in tracks [53][63].
- **AI or orchestration.** Fact: the content is produced by AlphaFold 2, an AI system [63]. No assistant or orchestration found.

### Vitessce

- **Capabilities.** Fact: "integrative visualization of millions of data points" across "multiple coordinated views" for multimodal and spatial single-cell data [68]; images from OME-TIFF and Bio-Formats-compatible Zarr through Viv [67].
- **Limitations.** Inference: single-cell and imaging scope; no molecular-structure view documented.
- **Extensibility and APIs.** Fact: a JSON view config defines data, views, layout and coordination; usable as a React component (`npm install vitessce`), from Python in Jupyter and from R [66][67]. npm 4.1.2 [26].
- **Licence.** Fact: `MIT` [66].
- **Performance.** Documented: the "millions of data points" claim [68]. Not measured.
- **Accessibility.** No statement found.
- **Visual design.** Fact: a grid of visualisation and control views [67].
- **AI or orchestration.** Fact: none in the product; the repository holds contributor tooling (`AGENTS.md`, `.claude/skills`) [66]. Inference: the declarative view config is a pattern relevant to HELIX (a JSON plan rendered by a coordinated UI).

### Reactome (pathway browser and DiagramJs widget)

- **Capabilities.** Fact: manually curated human processes as "an ordered network of molecular transformations", including disease variants and drugs in pathway context [72].
- **Limitations.** Fact: the DiagramJs page notes a server-side proxy to reactome.org may be needed [70].
- **Extensibility and APIs.** Fact: script `diagram.nocache.js`, callback `onReactomeDiagramReady()`, `Reactome.Diagram.create({ placeHolder, proxyPrefix, width, height })`; methods `loadDiagram(stId)`, `selectItem`, `flagItems(term)`, `highlightItem`, `resize`, `setAnalysisToken`, reset methods; events `onDiagramLoaded`, `onObjectSelected`, `onObjectHovered`, `onFlagsReset`, `onAnalysisReset`, `onCanvasNotSupported` [70].
- **Licence.** Fact: data CC0; illustrations, icons, art and branding CC BY 4.0; "all Reactome software is licensed under the Apache License 2.0", with exceptions for copyleft dependencies and FoamTree [69]. The DiagramJs repository LICENSE file: unverified (repository moved).
- **Performance.** Documented: viewer version 3 loads and renders "97% of the diagrams in Reactome in less than 1 s" (2018) [71].
- **Accessibility.** No statement found.
- **Visual design.** Fact: multi-layer HTML5 canvas [71].
- **AI or orchestration.** None found.

### Molecular storytelling works

**PDB-101 Molecule of the Month.**

- Fact: series created by David S. Goodsell from 2000 to 2024; Janet Iwasa has authored it since January 2025 [73][76].
- Fact: the hemoglobin article (May 2003, Goodsell and Dutta) states that "glutamate 6 in the beta chain is mutated to valine" in sickle-cell hemoglobin and links PDB 2HBS; it offers an image tab and a JSmol tab [74]. Inference: this is legacy residue numbering; HGVS p.Glu7Val counts the initiator methionine. HELIX must show both and explain the difference (see `docs/scientific-model-and-coordinate-mapping.md`).
- Fact: illustrations are CC-BY-4.0; article text is copyrighted and may not be reprinted or altered without permission [75].
- Accessibility, performance: no statement found; not measured.

**MolViewStories "Making of MOTM 01" (myoglobin).**

- Fact: translates the first Molecule of the Month into five keyed scenes over PDB 1MBN, 1PMB, 1MBO, 1MYF, with selectors, ellipsoid primitives for salt bridges, progressive reveals, per-scene narration audio, and Markdown links such as `!query=chain A` that highlight and focus the structure [6].
- Inference: this already demonstrates authored, narrated, structure-linked storytelling with interactive text, using only MVS and Mol\*.

**Molecular Flipbook (cautionary case).**

- Fact: on 2026-11-01, `https://molecularflipbook.org/` returned HTTP 301 to an unrelated commercial domain [77]. Secondary sources describe it as a free, Blender-based molecular animation tool launched in 2014 (search snippets only).
- Inference: a well-known storytelling tool is no longer reachable at its official address. This supports HELIX's choice of self-contained exports and archived provenance.

## MolViewStories / MolViewSpec reuse (P1.2.2)

Only facts verified in documentation, schemas or source are listed here.

### What MVS can declare

- **Tree.** A view is a tree of nodes, each with a `kind`, `params` and `children` [10]; MolViewStories describes MVS as "the declarative format used to define molecular visualizations in MolViewStories" [3]. Node kinds and allowed parents per the tree-schema page [10]:
  - Data: `download` (root), `parse` (download), `coordinates`, `structure`, `volume`, `shape` (parse; `shape` loads VTP, PLY or OBJ meshes).
  - Geometry: `transform` and `instance` (structure, component, volume, shape).
  - Selection: `component`, `component_from_uri`, `component_from_source` (structure).
  - Visuals: `representation` (components), `volume_representation` (volume).
  - Styling: `color`, `color_from_uri`, `color_from_source`, `opacity`, `clip` (plane, sphere or box).
  - Text: `label`, `label_from_uri`, `label_from_source`, `tooltip`, `tooltip_from_uri`, `tooltip_from_source`.
  - View: `focus` (root, components, primitives, volumes, shapes), `camera` and `canvas` (root).
  - Primitives: `primitives` and `primitives_from_uri` (structure or root), `primitive` (mesh, lines, tube, arrow, label, ellipsoid, box and others). The overview names "ellipses, boxes, arrows, or meshes" [9].
  - Motion: `transition` (root): camera transition into a snapshot with `duration_ms`, `trajectory` (`linear`, `linear-relative`, `leap`, `leap-relative`) and `easing` [10]. Animation: `builder.animation()` with `interpolate` entries (`kind`, `target_ref`, `duration_ms`, `property`, `end`, `easing`); the documented example interpolates a clip-plane scalar; a full list of interpolatable properties is not documented [12].
- **Residue selection.** Component expressions use `label_asym_id` or `auth_asym_id`, `label_seq_id` or `auth_seq_id`, `pdbx_PDB_ins_code`, `beg_*`/`end_*` ranges, atom fields and `instance_id`; arrays form unions; static selectors are `all`, `polymer`, `protein`, `nucleic`, `branched`, `ligand`, `ion`, `water`; MolQL expressions are supported [11]. Inference: both label and auth numbering are first-class, which matches the HELIX coordinate-mapping requirement (2HBS chain B, residue 6 in auth numbering).
- **Snapshots and stories.** The downloadable OpenAPI schema defines `State` (`kind`, `root`, `metadata`) and `States` (`kind`, `metadata`, `snapshots`); `GlobalMetadata` has `title`, `description`, `description_format` (default Markdown), `timestamp`, `version`; `SnapshotMetadata` has `title`, `description`, `description_format`, `key`, `linger_duration_ms`, `transition_duration_ms` (deprecated in favour of the `transition` node) [15][12][10]. Fact: that downloadable schema reports version "1.2" and has no `transition`, `animation` or `clip` schemas, while the tree-schema page lists them [10][15]. Inference: the published OpenAPI file lags the implementation; HELIX should validate against the version shipped with the Mol\* build it pins, not the docs file.

### File formats

- `.mvsj`: "MolViewSpec JSON", the tree plus metadata [9].
- `.mvsx`: a ZIP archive with `index.mvsj` at the top level plus other files such as annotations or structures [9].
- MolViewStories adds `.mvstory` (full project, re-importable) and HTML export (self-contained, works offline) [4].

### Builders

- Python: package `molviewspec` (1.8.1, MIT), with Jupyter and Colab examples [16][17].
- TypeScript/JavaScript: `MVSData.createBuilder()` in the Mol\* MVS extension; fluent chain such as `.download({url}).parse({format:'bcif'}).modelStructure({}).component({selector:'polymer'}).representation({type:'cartoon'}).color({color:'green'})`, then `.label({text})`, `.focus({})`, and `builder.getState()` [14]. In the Mol\* monorepo the code sits in `packages/mvs/{builder,runtime}`, which "separate standalone MVS construction from plugin loading" [19].

### How a host page loads MVS into Mol\*

- Programmatic: parse and validate with `MVSData.fromMVSJ(text)`, `MVSData.isValid(data)`, `MVSData.validationIssues(data)`; then `loadMVS(plugin, data, options)` (defined in `src/extensions/mvs/load.ts` per the docs; `packages/mvs/runtime/src/load.ts` on current `master`) [13][19]. Documented options: `replaceExisting` (true replaces the view, false adds to it), `sourceUrl`, `sanityChecks` [13][14].
- Prebuilt bundle: `molstar.PluginExtensions.mvs.MVSData` and `molstar.PluginExtensions.mvs.loadMVS`, with `viewer.plugin` as the plugin argument [13][14].
- Viewer methods: `viewer.loadMvsFromUrl(url, 'mvsj' | 'mvsx')` and `viewer.loadMvsData(...)` [13][14].
- URL parameters at viewer start: `mvs-url`, `mvs-data` (URLs over 2000 characters "may not work in all browsers"), `mvs-format` (`mvsj` default, or `mvsx`) [13].

### MolViewStories: embeddable or standalone

- Fact: MolViewStories is a standalone web authoring application with login, cloud storage, publication with persistent URLs, and a CLI [1][4][7][8].
- Fact: no iframe embedding snippet or embedding API is documented [4][5]. The FAQ says stories can be self-hosted "anywhere with CORS enabled" [5]; the exports above are the documented reuse path.
- Fact: the MolViewStories viewer and builder ship as a separate `build/mvs-stories/` output in the Mol\* repository [19]. Inference: a host page can render exported MVSJ/MVSX content directly with Mol\* without the MolViewStories app.

### Events

- Fact: the MVS extension documentation lists no events or callbacks for loading or interaction [13][14].
- Fact: the Mol\* v5 plugin page read here does not document click or hover subscriptions [21]; rcsb-molstar exposes `subscribeToSelection` in source [28]. Verified in P1.4.1 (Mol\* 5.13.1): `plugin.behaviors.interaction.click` and `.hover`, `plugin.managers.structure.selection.events.changed`, `plugin.managers.structure.focus.behaviors.current` and `plugin.canvas3d.didDraw` are rxjs subjects that a host page can subscribe to; click was exercised with a real pointer event and resolved to `VAL H6`.

### Licence

- MolViewSpec: `MIT` [16]. Mol\*: `MIT` [19]. MolViewStories: `MIT` [7]. Citations: Midlik et al. 2025 [18], Sehnal et al. 2021 [20], Slanináková et al. 2026 [8].

### Reuse decision (from experiment P1.4.1)

Evidence: `research/experiments/molstar-embed/README.md` (Mol* 5.13.1, 2026-11-01). The same 2HBS HbS view was built twice, once imperatively and once as MolViewSpec (`results/2hbs-hbs-view.mvsj`, 3.1 kB, valid under `MVSData.validationIssues`).

- **Fact (experiment):** MVS declared everything the static view needs:
  - loading the 2HBS model
  - chain H residue 6 by `label_asym_id`/`label_seq_id`
  - the five chain B contacts as one component
  - representation, colour, 3D label, tooltip, camera `focus` and background

  The whole `loadMVS` took 246 ms, in the same range as the imperative load. Read-back of the created components gave `VAL H6` and ALA 70, ASP 73, THR 84, PHE 85, LEU 88 on chain B.
- **Fact (experiment):** MVS could **not** express:
  - the Mol* selection state (the selection manager stayed empty)
  - the hover highlight
  - the focus representation with surroundings and interaction lines (`focus` is camera only)
  - any click, hover or selection event
  - an incremental single-residue change without loading a new state

  Those came from the imperative plugin API: `selection.fromLoci`, `lociHighlights.highlightOnly`, `structure.focus.setFromLoci`, `camera.focusLoci`, and `behaviors.interaction.click`. Their events were verified in the experiment.
- **Fact (experiment):** in 5.13.1, the type of `focus` has `radius_extent` while its doc comment says `radius_extra`; the compiler caught it. The Mol* 5.13.1 typings include `transition` and a separate `animation` tree.
- **Decision:**
  - **Reuse MolViewSpec** (MIT) as Helix's declarative scene format for curated chapter snapshots, shareable exports and a constrained output target for the AI planner. Helix code still validates semantic targets before any MVS is built.
  - Use the **imperative Mol\* API** for interaction, events, read-back and incremental highlighting. Both run on the same `PluginContext`.
  - **Do not embed the MolViewStories application.** It is a standalone authoring app with login, and no embedding API is documented. Its stories remain a source of inspiration and an import/export path through `.mvsj`/`.mvsx`.
  - Pin the Mol\* version and validate MVS against the schema shipped with that version.
- **Assumption (not tested):** an LLM can emit valid MVS directly. Helix should instead have the LLM emit typed Helix actions, compile them deterministically to MVS or API calls, and never pass model output straight to `loadMVS`.

## Feasible differentiation

HELIX is not the first tool to do any of its parts. The question is which combination is still worth building.

### Facts: what neighbours already do

- **Authored molecular storytelling** with scenes, transitions, narration audio and interactive Markdown already exists in MolViewStories [6][8]. Molecule of the Month already tells the hemoglobin and sickle-cell story with 2HBS [74].
- **Residue focus and highlighting** in a 3D structure are standard in Mol\* on rcsb.org (click to focus with surroundings) [27] and programmable through rcsb-molstar (`focusOnResidue`, `select`, `setFocus`) [28].
- **Declarative, validated molecular scenes** exist as MolViewSpec, with Python and TypeScript builders and validation functions [13][16][18].
- **Linked 1D and 3D views** exist in iCn3D (1D, 2D, 3D synchronised) [59], UniProt (feature table plus structure, AlphaMissense track) [51][53], and AlphaFold DB (PAE to 3D) [63].
- **Coordinated multi-view declarative configs** exist in Vitessce [67].
- **An LLM agent that drives a molecular viewer through typed tools**, with undo, approval policies and untrusted-text quoting, exists on the unreleased Mol\* `master` branch [22][23][24].
- **AI-derived data** already appear in neighbours: AlphaFold models [63], AlphaMissense in UniProt [53], ML similarity search at RCSB [29].

### Inferences: what combination remains plausible for HELIX

1. **Evidence-bound actions across scales.** No neighbour read here ties one validated action plan to genome (Ensembl), protein (UniProt) and structure (PDB) coordinates with a provenance record per action. Mol\*'s agent acts on the scene; HELIX's planner would act on a typed scientific domain model and emit MVS (or Mol\* calls) as one output among several.
2. **Deterministic, replayable execution of AI plans.** HELIX's planner emits typed actions that a deterministic executor validates and runs; the same plan can be replayed without a model. The Mol\* agent records turns and supports undo [23], so this is a difference of design emphasis (offline replay, no model needed at view time), not a new idea.
3. **Cross-scale cinematic transitions** (chromosome to gene to transcript to protein to structure) in one continuous scene. MolViewStories transitions are camera transitions within molecular scenes [10]; genome browsers are separate 2D tools. The combined journey is plausible but unproven.
4. **Personalised retrieval within a curated nonclinical journey** (the user's question selects which evidence and scenes appear), with explicit refusal of clinical interpretation.
5. **Offline and local-AI desktop build** (Tauri, local OpenAI-compatible runtime). Fact: the Mol\* assistant already accepts http endpoints on localhost [24], so local models are not unique; the bundled offline curated journeys are the HELIX-specific part.

### Assumptions (to test)

- A1: MVS can express every HELIX structure action needed for the HBB slice (load 2HBS, select chain B residue 6 by auth numbering, highlight, label, focus, transition). Tested in P1.4.1: partly true. Load, residue component, colour, label, tooltip and camera focus are declarable; selection state, hover highlight, the focus representation and events are not (see the reuse decision).
- A2: HELIX's planner can target MVS JSON plus a small set of non-MVS actions (genome and protein tracks) without forking Mol\*.
- A3: Users perceive a continuous cross-scale journey as clearer than linked separate viewers. Needs a user study, not an expert opinion.
- A4: Premium interaction (motion, typography, sound) adds comprehension rather than only appeal. Needs measurement.

## Risks and open questions

- **R1, Mol\* v6 agent overlap.** If Mol\* v6 ships its assistant, HELIX's AI-directed visual actions on structures will look like a subset of a free, MIT-licensed upstream feature. Mitigation: position HELIX on cross-scale evidence and provenance; consider consuming the Mol\* agent's tool layer instead of duplicating it. Open question: release date and API stability of v6 (unverified).
- **R2, Ensembl platform transition.** The REST server reports release 116, the code repository is archived, and the new platform's programmatic API was not documented in the sources read [32][33][34][35]. Open question: will `rest.ensembl.org` continue after release 116, and on which data release?
- **R3, MVS schema drift.** The published OpenAPI file (version 1.2) lacks nodes the docs describe [10][15]. Pin the Mol\* version and validate against its bundled schema.
- **R4, Mol\* version fragmentation.** Nightingale's structure component pins `molstar` 3.44.0 [57] while current Mol\* is 5.13.1 [26]. Using both in one bundle may duplicate WebGL contexts and code size (not measured).
- **R5, iCn3D licence.** The DelPhi component is non-commercial [60]. HELIX is non-commercial, but redistribution of iCn3D code inside HELIX would carry that clause; avoid unless needed.
- **R6, UCSC licence.** Browser CGIs need a commercial licence for commercial use [40]; HELIX would only call the public API and link out.
- **R7, residue numbering.** Legacy "Glu6" (Molecule of the Month) versus HGVS p.Glu7Val [74]. HELIX must show both with an explanation.
- **R8, link rot.** Molecular Flipbook's domain now redirects to an unrelated site [77]. Store exports and provenance locally; do not rely on third-party story URLs.
- **R9, accessibility gap in neighbours.** Only UCSC has a documented accessibility page [43]; Mol\* accessibility work is unreleased [25]. HELIX cannot inherit accessibility from its 3D dependency and must provide non-visual equivalents itself.
- **R10, performance unknowns.** No neighbour performance was measured here. 2HBS loading and frame time were measured in P1.4.1 and P1.4.2 on an M1 Pro (see `rendering-integration-decisions.md`); low-end hardware remains unmeasured.
- **Open questions.** (a) Does MolViewStories accept an iframe embed of a published story? Undocumented. (b) Mol\* v5 click and hover events: resolved in P1.4.1 (see Events above). (c) Does the AlphaFold DB page use a PDBe Mol\* build, and under which licence? Unverified. (d) Does the Reactome DiagramJs repository carry an Apache-2.0 LICENSE file? Unverified.

## References

All URLs accessed 2026-11-01.

1. MolViewStories home. https://molstar.org/mol-view-stories/
2. MolViewStories documentation. https://molstar.org/mol-view-stories/docs/index.html
3. MolViewStories, MolViewSpec API overview. https://molstar.org/mol-view-stories/docs/molviewspec/
4. MolViewStories, Cloud Storage and Sharing. https://molstar.org/mol-view-stories/docs/webapp-cloud-storage.html
5. MolViewStories, FAQ and Troubleshooting. https://molstar.org/mol-view-stories/docs/faq-troubleshooting.html
6. MolViewStories, Making of MOTM 01. https://molstar.org/mol-view-stories/docs/example-stories/making-of-mom1.html
7. molstar/mol-view-stories repository (licence via GitHub API: MIT). https://github.com/molstar/mol-view-stories
8. Slanináková T, et al. MolViewStories: Interactive molecular storytelling. Protein Science, 2026. https://doi.org/10.1002/pro.70540 (abstract via Europe PMC)
9. MolViewSpec documentation, introduction. https://molstar.org/mol-view-spec-docs/
10. MolViewSpec, tree schema. https://molstar.org/mol-view-spec-docs/tree-schema/
11. MolViewSpec, selectors. https://molstar.org/mol-view-spec-docs/selectors/
12. MolViewSpec, animations. https://molstar.org/mol-view-spec-docs/animations/
13. MolViewSpec, Mol\* MVS extension. https://molstar.org/mol-view-spec-docs/mvs-molstar-extension/
14. MolViewSpec, integration examples. https://molstar.org/mol-view-spec-docs/mvs-molstar-extension/integration/
15. MolViewSpec OpenAPI schema file (reports version 1.2). https://molstar.org/mol-view-spec-docs/files/molviewspec-v1-openapi-schema.json
16. molstar/mol-view-spec repository and LICENSE (MIT). https://github.com/molstar/mol-view-spec ; https://raw.githubusercontent.com/molstar/mol-view-spec/master/LICENSE
17. molviewspec on PyPI (1.8.1, MIT). https://pypi.org/project/molviewspec/
18. Midlik A, et al. MolViewSpec: a Mol\* extension for describing and sharing molecular visualizations. Nucleic Acids Research, 2025. https://doi.org/10.1093/nar/gkaf370
19. molstar/molstar repository and LICENSE (MIT). https://github.com/molstar/molstar ; https://raw.githubusercontent.com/molstar/molstar/master/LICENSE
20. Sehnal D, et al. Mol\* Viewer: modern web app for 3D visualization and analysis of large biomolecular structures. Nucleic Acids Research, 2021. https://doi.org/10.1093/nar/gkab314
21. Mol\* documentation v5, Creating Instance. https://molstar.org/docs/v5/plugin/instance/
22. Mol\* `packages/ai` (package.json, AGENTS.md, _spec/README.md, _spec/tools.md), master branch. https://github.com/molstar/molstar/tree/master/packages/ai
23. Mol\* Prism viewer agent specification, master branch. https://github.com/molstar/molstar/blob/master/packages/prism/viewer/_spec/agent.md
24. Mol\* Prism assistant specification, master branch. https://github.com/molstar/molstar/blob/master/packages/prism/assistant/_spec/README.md
25. Mol\* Prism AGENTS.md, ui/_spec/README.md and TODO.md, master branch. https://github.com/molstar/molstar/tree/master/packages/prism
26. npm registry entries: molstar 5.13.1, igv 3.8.10, vitessce 4.1.2, @rcsb/rcsb-molstar 2.15.0, icn3d 3.54.6, pdbe-molstar 3.12.0; Mol\* GitHub release v5.13.0. https://registry.npmjs.org/ ; https://github.com/molstar/molstar/releases
27. RCSB PDB, Mol\* getting started. https://www.rcsb.org/docs/3d-viewers/mol*/getting-started
28. molstar/rcsb-molstar repository (MIT) and `src/viewer/index.ts`. https://github.com/molstar/rcsb-molstar
29. PDB-101 news, Use the AI-Powered 3D Structure Similarity Search (March 2026). https://pdb101.rcsb.org/news/69bc5e328557ae0f261bc71c
30. rcsb-api: Python Toolkit for Streamlining Access to RCSB Protein Data Bank APIs. Journal of Molecular Biology, 2025. https://doi.org/10.1016/j.jmb.2025.168970
31. Ensembl 2025. Nucleic Acids Research, 2025. https://doi.org/10.1093/nar/gkae1071
32. EMBL-EBI news, Ensembl rolls out new website (25 August 2026). https://www.ebi.ac.uk/about/news/updates-from-data-resources/ensembl-new-website/
33. EMBL-EBI news, Ensembl 116 and Ensembl Genomes 63 released (11 June 2026). https://www.ebi.ac.uk/about/news/updates-from-data-resources/ensembl-116-release/
34. Ensembl REST API home and `/info/data`. https://rest.ensembl.org/
35. Ensembl/ensembl-rest repository (archived 2026-10-16, Apache-2.0). https://github.com/Ensembl/ensembl-rest
36. Ensembl/ensembl-client repository (Apache-2.0). https://github.com/Ensembl/ensembl-client
37. Ensembl/ensembl-genome-browser repository. https://github.com/Ensembl/ensembl-genome-browser
38. Ensembl website HTML. https://www.ensembl.org/
39. The UCSC Genome Browser database: 2025 update. Nucleic Acids Research, 2025. https://doi.org/10.1093/nar/gkae974
40. UCSC Genome Browser licences. https://genome.ucsc.edu/license/
41. UCSC REST API help. https://genome.ucsc.edu/goldenPath/help/api.html
42. UCSC FAQ, linking to the browser. https://genome.ucsc.edu/FAQ/FAQlink.html
43. UCSC, Accessibility options in the UCSC Genome Browser. https://genome.ucsc.edu/accessibility.html
44. igvteam/igv.js repository (MIT). https://github.com/igvteam/igv.js
45. igv.js Browser API. https://igv.org/doc/igvjs/Browser-API/
46. igv.js Events. https://igv.org/doc/igvjs/Events/
47. Robinson JT, et al. igv.js: an embeddable JavaScript implementation of the Integrative Genomics Viewer (IGV). Bioinformatics, 2023. https://doi.org/10.1093/bioinformatics/btac830
48. igvteam/igv repository (MIT). https://github.com/igvteam/igv
49. IGV desktop documentation and External control page. https://igv.org/doc/desktop/ ; https://igv.org/doc/desktop/UserGuide/advanced/external_control/
50. Robinson JT, et al. Integrative genomics viewer. Nature Biotechnology, 2011. https://doi.org/10.1038/nbt.1754
51. UniProt help, Feature viewer (via `https://rest.uniprot.org/help/feature_viewer`). https://www.uniprot.org/help/feature_viewer
52. UniProt help, Variant viewer. https://www.uniprot.org/help/variant_viewer
53. UniProt help, Structure annotation in UniProt. https://www.uniprot.org/help/structure_section
54. UniProt help, UniProt software. https://www.uniprot.org/help/software
55. ebi-webcomponents/nightingale repository (MIT) and `packages/` listing. https://github.com/ebi-webcomponents/nightingale
56. Nightingale: web components for protein feature visualization. Bioinformatics Advances, 2023. https://doi.org/10.1093/bioadv/vbad064
57. npm, @nightingale-elements/nightingale-structure 5.11.0 (dependencies). https://registry.npmjs.org/@nightingale-elements/nightingale-structure/latest
58. UniProt Consortium. UniProt: the Universal Protein Knowledgebase in 2025. Nucleic Acids Research, 2025. https://doi.org/10.1093/nar/gkae1010
59. NCBI iCn3D page. https://www.ncbi.nlm.nih.gov/Structure/icn3d/icn3d.html
60. ncbi/icn3d LICENSE.md. https://github.com/ncbi/icn3d/blob/master/LICENSE.md
61. iCn3D: From Web-Based 3D Viewer to Structural Analysis Tool in Batch Mode. Frontiers in Molecular Biosciences, 2022. https://doi.org/10.3389/fmolb.2022.831740
62. AlphaFold DB API OpenAPI description. https://alphafold.ebi.ac.uk/api/openapi.json (docs at https://alphafold.ebi.ac.uk/api-docs)
63. Varadi M, et al. AlphaFold Protein Structure Database in 2024. Nucleic Acids Research, 2024. https://doi.org/10.1093/nar/gkad1011
64. Varadi M, et al. AlphaFold Protein Structure Database. Nucleic Acids Research, 2022. https://doi.org/10.1093/nar/gkab1061
65. HELIX data source registry (internal, AlphaFold DB and Ensembl sections). `helix-research/docs/data-source-registry.md`
66. vitessce/vitessce repository (MIT). https://github.com/vitessce/vitessce
67. Vitessce documentation. http://vitessce.io/docs/
68. Keller MS, et al. Vitessce: integrative visualization of multimodal and spatially resolved single-cell data. Nature Methods, 2025. https://doi.org/10.1038/s41592-024-02436-x
69. Reactome licence. https://reactome.org/license
70. Reactome DiagramJs widget. https://reactome.org/dev/diagram/js
71. Reactome diagram viewer: data structures and strategies to boost performance. Bioinformatics, 2018. https://doi.org/10.1093/bioinformatics/btx752
72. The Reactome Pathway Knowledgebase 2024. Nucleic Acids Research, 2024. https://doi.org/10.1093/nar/gkad1025
73. PDB-101, About Molecule of the Month. https://pdb101.rcsb.org/motm/motm-about
74. PDB-101, Molecule of the Month: Hemoglobin (May 2003). https://pdb101.rcsb.org/motm/41
75. PDB-101, How to cite. https://pdb101.rcsb.org/more/how-to-cite
76. A new chapter for RCSB Protein Data Bank Molecule of the Month in 2025. Structural Dynamics, 2025. https://doi.org/10.1063/4.0000302
77. Molecular Flipbook (HTTP 301 to an unrelated domain observed). https://molecularflipbook.org/
78. EMBL news, Connecting AI to biology with the Model Context Protocol (2 December 2025). https://www.embl.org/news/people-perspectives/connecting-ai-to-biology-model-context-protocol/
