<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HX-P5-2026-11-02-dna-world-bridge: DNA World draws the real sequence, and the codon to residue bridge

```yaml
id:            HX-P5-2026-11-02-dna-world-bridge
date:          2026-11-02
hypothesis:    (1) The DNA World helix drawn in the running app carries, at instance i, base i of the curated
               cDNA of ENST00000335295.4, and a real pointer click on a drawn base selects that base.
               (2) Through the Phase 2 records only, codon 7 links to P68871 position 7 and to 2HBS VAL 6
               on chains B, D, F and H (label = auth), read back from Mol*; a click on VAL H6 or VAL B6 in
               Mol* links back to codon 7; codon 1, the stop codon and unmapped residues say why they have
               no counterpart. Contradicted by any drawn base, colour or position differing from the
               sequence, a click selecting another base, a structure residue computed by offset, or a
               missing explanation.
git_commit:    helix-app 4962491 (private repository); helix-research packages and data pinned at a13c1ec
config:        helix-app apps/web/e2e/phase5.mjs, scenarios dna-render and bridge (--tag=2026-11-02);
               unit tests packages/scene-engine/test/bridge.test.ts, apps/web/test/dna-layout.test.ts
seeds:         n/a (deterministic); one run per E2E scenario, each in a fresh browser context
data_version:  data/curated/hbb at a13c1ec; the E2E reads sequences.json from the served bundle and
               checks its sha256 against manifest.json before comparing
hardware:      Apple M1 Pro, 16 GB, macOS 15.3.1; Chrome 156.0.8078.74 headless, ANGLE Metal
duration:      not recorded separately (the whole Phase 5 suite took about 8 minutes)
cost:          0
software:      three 0.186.1, @react-three/fiber 9.8.2, molstar 5.13.1, react 19.3.1, vite 8.3.4,
               puppeteer-core 25.14.0, Node 22.23.3
```

## Methods

- **Drawn sequence.** In the running page, the E2E reads the four instanced meshes of DNA World from the three.js scene: the sequence attached to each mesh, the colour of every instance (`getColorAt`) and its axis position (`getMatrixAt`). It compares them with the cDNA read independently from the served, hash-checked `sequences.json`: base colour of instance i against the colour of sequence[i], pair colour against its complement, one helix step (0.34) between consecutive instances. It also counts WebGL contexts and reads the on-screen label.
- **Real clicks.** After selecting codon 7, then codon 1, from the codon strip, it projects a drawn base's backbone sphere to the screen, clicks it with the pointer, and reads the selection from the store and the DOM card. Candidates are recomputed after every click, because the camera recentres on the selection.
- **Bridge.** Codon 7 from the strip, then the world switch to Protein World; read-back of Mol*'s selection and focus managers. Back from the structure: the camera is aimed at a residue and the canvas centre is clicked, as in P1.4.2. Then codon 1 and codon 148 from the strip.
- **Unit tests** (same commit): the transcript model and the bridge against the curated records, and the DNA layout for all 628 indices.

## Raw results + uncertainty

From `helix-app/apps/web/e2e/results/phase5-e2e-2026-11-02.json` (the suite passed, 0 failures):

- **Drawn sequence:** 628 instances per mesh; the coding-strand mesh carries exactly the curated cDNA and the template mesh its complement; 0 of 628 base colours and 0 of 628 pair colours differ from sequence[i] (tolerance 1 per 8-bit channel for the sRGB round trip); 0 bases out of helix order. 2 WebGL contexts (Mol* and R3F). Label: "Illustrative geometry, real sequence" with the transcript id and length.
- **Real clicks:** 6 of 6 clicks selected the clicked base: indices 76, 75, 77 (codons 9 and 10, "no curated residue mapping of record for P68871 position 9 [10]") and 43, 44, 45 (5' UTR, "not translated").
- **Codon 7:** link mapped, P68871 position 7, residues VAL 6 on B, D, F, H with label = auth; the card read "GAG (Glu) = P68871 p.Glu7; HbS (sickle haemoglobin): GAG to GTG (Val)". The world switch ran loadStructure, focusCamera, highlightResidue; Mol* read back VAL B6, D6, F6, H6 (label 6, entity 2) and focus VAL H6.
- **Back from the structure** (aimed, picked, codon): H6 -> VAL H6 -> 7; B6 -> VAL B6 -> 7; H12 -> THR H12 -> none; H5 -> PRO H5 -> none, each with "no curated residue mapping of record links ... to P68871".
- **Codon 1:** "No structure residue: codon 1 encodes the initiator Met (p.1), which P68871 records as removed; the mature chain starts at p.2, so no structure of the mature protein has a residue for it". The previous emphasis was cleared; the world switch then ran a bare loadStructure and Mol* read back nothing.
- **Codon 148:** "codon 148 (TAA) is the stop codon; it encodes no residue".
- **Unit tests:** base i = sequence[i] for all 628 indices; c.20 = A at cDNA 70, codon 7 position 2, GRCh38 chr11:5227002; codons 2 to 147 translate to UniProt residue k; only codon 7 maps to a structure residue; all four VAL 6 map back to codon 7.
- One machine; one E2E run per scenario.

## Failures

- During development, the click test first chose all its target bases before clicking; after each click the camera recentred, and a later target was then outside the view, so the click hit nothing and the previous selection remained (2 of 6 "failures", harness only). The harness now recomputes candidates after each click. Those development runs were not kept.

## Limits / confounders

- The base-to-screen projection uses the backbone sphere centre; only bases facing the camera were clicked (6 bases, two regions).
- Colour comparison is on the instance colour buffer, not on rendered pixels.
- Only codon 7 can reach a structure: the curated dataset holds a residue mapping of record for P68871 position 7 only.

## Interpretation

Supported: DNA World draws the real transcript sequence base for base, a click on a drawn base selects that base, and the bridge links codon 7, P68871 7 and 2HBS label 6 both ways without any offset arithmetic, saying in words why codon 1, the stop codon and other residues have no counterpart.

## Decision

**Continue.** Extending the bridge to every SIFTS-covered position needs a full-chain mapping record in this repository's dataset (author decision).

## Artifacts

- `helix-app/apps/web/e2e/results/phase5-e2e-2026-11-02.json` (private repository), scenarios `dna-render`, `bridge`
- `helix-app/docs/reviews/phase-5-shots/dna-transcript-overview.jpg`, `dna-codon7.jpg`, `protein-from-codon7.jpg`, `codon1-no-residue.jpg`
- `helix-app/packages/scene-engine/test/bridge.test.ts`, `helix-app/apps/web/test/dna-layout.test.ts`
