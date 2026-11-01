<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# Creative inspiration study (P1.6.1)

**Status:** written 2026-11-01 for roadmap task P1.6.1 (master prompt §3.3, §9).

**What this file is:** references and lessons only, so that the art-direction work of Phase 7 (P7.1.1) starts from studied precedent rather than from habit.

**Rule (master prompt §3.3):** "do not copy branding, art, or proprietary assets". Nothing here is a style to reproduce. Each entry names what the reference does, cites it, and states the **lesson** for Helix in Helix's own terms. The PDB-101 illustrations, WEHI's animations, teamLab's works and the products named below are the property of their owners; Helix uses none of them.

**Method:**

- Every link was opened on 2026-11-01 with the User-Agent `helix-research`.
- The factual line for each reference is taken from the page itself (its title or description), and quoted where possible.
- The lessons are **this project's interpretation** (Assumption), to be tested in P7 prototypes and the P11 usability sessions.

## 1. Immersive exhibition design

**teamLab: an art collective working where "art, science, technology, and the natural world" meet** [C1]

- **Lesson:** the room answers the visitor's presence, so the visitor is part of the work rather than its audience. For Helix: the scene should respond to what the user selects and asks, not play at them.
- **Counter-lesson:** spectacle without content is exactly what §9 forbids ("not ... an overdecorated neon website"). Helix's response must carry scientific meaning.

**Cooper Hewitt, Smithsonian Design Museum: the Interactive Digital Visitor Experience (2015 to 2022)** [C2]

- **What it is:** the page describes the "digitized collection on large touchscreen tables", whose resolution "allows you to zoom in on objects to see minute details", and names the visitor Pen.
- **Unverified:** that the Pen let visitors collect objects and revisit them after the visit is from general knowledge, not confirmed on the page read.
- **Lesson:** let people *keep* what they found and return to it later. For Helix this is the §9.3 "back/revisit/compare" requirement, as a collected trail of entities (gene, variant, residue, evidence) that persists through the session.

**Ars Electronica Center, Deep Space 8K** [C3]

- **What it is:** "a 16 x 9 meter wall" plus floor projection, with laser tracking.
- **Lesson:** scale itself communicates. When a molecule fills the visitor's field, its size relative to the viewer becomes the message.
- **Caution:** Helix runs on a laptop screen, so the sense of scale has to come from camera framing and composition, not from pixels.

**Science Museum London, Wonderlab** [C4]

- **What it is:** a hands-on interactive science gallery.
- **Lesson:** a phenomenon you can poke beats one you watch. For Helix, direct manipulation (select a codon, see the residue light up in the structure) is the core moment; narration supports it.

## 2. Scientific explainers

**Bartosz Ciechanowski: "Interactive articles about science and engineering"** [C5]

- **Lesson:** every figure is a working model with one or two controls, introduced in the order the reader needs them. Complexity is added one variable at a time. For Helix: progressive depth (§9.3, "progressively explorable, not overwhelming"), with each new control earning its place.

**Distill, "Research Debt"** [C6]

- **What it is:** an essay arguing that clear explanation is research work, not decoration.
- **Lesson:** the explanation layer deserves the same engineering standard as the data core. For Helix, the evidence panels and labels are part of the product's scientific quality, not a finish applied in Phase 8.

**Explorable Explanations** [C7]

- **What it is:** a hub of "learning through play" examples.
- **Lesson:** the reader changes a parameter and sees the consequence. For Helix, the Compare mode (reference against variant) is the natural explorable: toggle the allele, see the codon, the residue and the structural context change together, with the limits stated.

**RCSB PDB-101, Molecule of the Month: Hemoglobin** [C8]

- **What it is:** a short, layered explanation that ties named PDB entries (for example 2hhb, 1hho) to an illustrated story, including a sickle-cell fibre figure.
- **Lesson:** every picture names the structure it comes from. For Helix, every 3D view states its PDB entry, chains and whether it is experimental, predicted or illustrative.
- **Caution:** the site uses the legacy mature numbering, which is why Helix must show both conventions (`docs/competitor-analysis.md`, R7). The illustrations are the artist's and are never reused.

**WEHI.TV, biomedical animation** [C9]

- **What it is:** explains research "through accurate and entertaining 3D animation".
- **Lesson:** cinematic molecular animation can be both accurate and moving. The distinction between data-driven geometry and artistic interpretation must still be explicit. For Helix, the "illustrative" label (§9.3) is part of the composition, designed in from the start.

**Genetic Science Learning Center (University of Utah), "Cell Size and Scale"** [C10]

- **What it is:** an interactive comparison of cell and molecule sizes with familiar objects, with text on magnification ("A magnifying glass can help you to see them more clearly"). The interactive itself was not inspected (Assumption: a single scale control).
- **Lesson:** one axis (scale), always anchored to something familiar. For Helix, semantic zoom between worlds needs a visible scale reference at every step.

## 3. Cinematic interactive web

**The New York Times, "Snow Fall: The Avalanche at Tunnel Creek" (2012)** [C11]

- **Lesson:** pacing. Text, motion and media are sequenced so that each arrives when the reader is ready for it.
- **Counter-lesson:** a fixed linear path is what §9.2 forbids ("not force users to watch an unskippable video"). Helix's guided path must be interruptible at every beat.

**Mike Bostock, "How To Scroll" (2014)** [C12]

- **What it is:** five rules for scroll-driven storytelling, starting with "Prefer scrolling to clicking", and the warning that scrolling "is surprisingly nuanced and easy to break".
- **Lesson:** a familiar input with predictable behaviour beats a clever one. For Helix, chapter navigation should use ordinary controls (scroll, keys, a visible chapter list) and never hijack them.

**NASA's Eyes** [C13]

- **What it is:** "3D visualization applications that allows everyone to explore and understand real NASA data", run in a regular web browser.
- **Lesson:** this is the closest precedent for Helix's promise. Real data drives a cinematic 3D scene; the user can fly freely or follow an event, and labels and time controls stay legible. For Helix: real records drive the scene, and free exploration and guided chapters share one state.

**Charles and Ray Eames, "Powers of Ten"** [C14]

- **What it is:** two short documentary films that move by factors of ten from the cosmic to the atomic.
- **Lesson:** a scale transition is meaningful when its rule is stated. For Helix, transitions between Chromosome, DNA and Protein worlds should state the scale change (and that the DNA geometry is illustrative), rather than imply a continuous physical fly-through (`docs/rendering-integration-decisions.md` §3.5 explains why that would be scientifically meaningless).

**The Scale of the Universe 2** [C15]

- **What it is:** an interactive scale explorer; only the title was confirmed in the page read.
- **Lesson (Assumption, from general knowledge of the piece, not from the page):** same as C10, from the entertainment side. A single dominant control keeps a cross-scale piece navigable.

**Experiments with Google** [C16]

- **What it is:** a gallery of browser experiments.
- **Lesson:** each experiment states its one idea in a sentence. For Helix, each world and each action should be explainable in one sentence, which is also what the world capability declarations (§10) need.

## 4. Premium instruments and desktop products

**Dieter Rams, "Good design" (Vitsœ)** [C17]

- **What it is:** the ten principles, summarised by Vitsœ as "innovative, honest, long-lasting – and as little design as possible".
- **Lesson:** "honest" is the principle Helix cannot break. A visual must not suggest more certainty than the data has. "As little design as possible" matches §9's "precision and restraint".

**teenage engineering, OP-1 field** [C18]

- **What it is:** an all-in-one portable synthesizer and sampler with a tape workflow.
- **Lesson:** a dense instrument stays approachable when every control has one clear job and immediate feedback. For Helix's "Future Research Instrument" direction: few controls, each precise, each answering at once.

**Linear, "Linear Method"** [C19]

- **What it is:** the company's stated practices for building.
- **Lesson:** speed and keyboard access are part of perceived quality. For Helix, every action reachable by keyboard (§9.3), with search and selection that answer immediately.

**Apple Human Interface Guidelines, Motion** [C20]

- **What it is:** motion should convey "status, providing feedback and instruction".
- **Lesson:** motion is information, and reduced-motion settings must be honoured. This directly serves the Tauri macOS build.

**ZEISS ZEN microscopy software** [C21]

- **What it is:** "the universal user interface you will see on every imaging system from ZEISS". The page highlights that users "smoothly zoom in and out with a simple mouse scroll, just like using a map application".
- **Lesson:** in a real instrument the data view dominates and the controls recede, while acquisition parameters and provenance stay one step away. For Helix, the evidence and provenance layer should always be one action from any view.

**Things (Cultured Code)** [C22]

- **What it is:** a to-do app for Mac and iOS.
- **Lesson:** calm desktop polish (quiet transitions, generous spacing, native behaviour) reads as premium without effects. A useful benchmark for the desktop shell's menus and windows.

## 5. Relation to the three art directions (§9)

| Direction (§9) | Strongest references | What Helix takes | What Helix avoids |
|---|---|---|---|
| **Molecular Cosmos**: monumental forms, dark space, selective light | Deep Space 8K [C3], NASA's Eyes [C13], Powers of Ten [C14], WEHI.TV [C9] | Scale through framing; real data driving the scene; a stated rule for each scale change; light used to select, not to decorate | Continuous fake fly-throughs between unrelated coordinate systems; glow as filler; unlabelled artistic geometry |
| **Future Research Instrument**: contextual UI, engineered controls, clear data hierarchy | ZEISS ZEN [C21], OP-1 [C18], Linear [C19], Rams [C17], Apple HIG Motion [C20] | Data first; few precise controls with immediate feedback; keyboard everywhere; motion as status; honesty about certainty | Dashboard clutter; controls without a single clear job; motion that does not inform |
| **Living Digital Museum**: editorial pacing, large type, curated exhibits | Cooper Hewitt [C2], PDB-101 [C8], Snow Fall [C11], Ciechanowski [C5], Wonderlab [C4] | Pacing; a collected trail of findings; every image naming its source; one variable at a time; hands-on moments | Linear, unskippable sequences; scroll hijacking; reused illustration styles |

**Assumption: a coherent combination.** An Instrument interaction model (controls, keyboard, evidence one step away), Museum pacing for guided Discover journeys, and Cosmos lighting and scale reserved for the moments where a structure is the subject. P7.1.1 must prototype the three directions separately before any combination (§9: "Combine them only where coherent").

## References

All accessed 2026-11-01.

- [C1] teamLab. https://www.teamlab.art/
- [C2] Cooper Hewitt, The Interactive Digital Visitor Experience (2015 to 2022). https://www.cooperhewitt.org/new-experience/
- [C3] Ars Electronica Center, Deep Space 8K. https://ars.electronica.art/center/en/deepspace/
- [C4] Science Museum, Wonderlab. https://www.sciencemuseum.org.uk/see-and-do/wonderlab-equinor-gallery
- [C5] Bartosz Ciechanowski. https://ciechanow.ski/
- [C6] Distill, "Research Debt" (2017). https://distill.pub/2017/research-debt/
- [C7] Explorable Explanations. https://explorabl.es/
- [C8] RCSB PDB-101, Molecule of the Month: Hemoglobin. https://pdb101.rcsb.org/motm/41
- [C9] WEHI.TV. https://www.wehi.edu.au/wehi-tv/
- [C10] Genetic Science Learning Center, Cell Size and Scale. https://learn.genetics.utah.edu/content/cells/scale/
- [C11] The New York Times, "Snow Fall: The Avalanche at Tunnel Creek" (2012). https://www.nytimes.com/projects/2012/snow-fall/index.html
- [C12] Mike Bostock, "How To Scroll" (3 November 2014). https://bost.ocks.org/mike/scroll/
- [C13] NASA's Eyes. https://eyes.nasa.gov/
- [C14] "Powers of Ten (film series)", Wikipedia summary used because the Eames Office page returned a bot challenge (HTTP 403). https://en.wikipedia.org/wiki/Powers_of_Ten_(film)
- [C15] The Scale of the Universe 2. https://htwins.net/scale2/
- [C16] Experiments with Google. https://experiments.withgoogle.com/
- [C17] Vitsœ, "Good design" (Dieter Rams's ten principles). https://www.vitsoe.com/us/about/good-design
- [C18] teenage engineering, OP-1 field. https://teenage.engineering/products/op-1
- [C19] Linear, "Linear Method". https://linear.app/method
- [C20] Apple Human Interface Guidelines, Motion. https://developer.apple.com/design/human-interface-guidelines/motion
- [C21] ZEISS ZEN microscopy software. https://www.zeiss.com/microscopy/en/products/software/zeiss-zen.html
- [C22] Cultured Code, Things. https://www.culturedcode.com/things/

**Not reachable on 2026-11-01** (HTTP 403 bot challenge), so not cited: exploratorium.edu, eamesoffice.com, biointeractive.org.
