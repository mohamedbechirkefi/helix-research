<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# P1.4.2: Mol* coordinated with a React Three Fiber canvas

**Status:** done, 2026-11-01. Experiment, not product code.

## What it does

- **R3F canvas:** a procedural, clearly illustrative double helix built from the real CDS of ENST00000335295.4 (`research/raw/ensembl/seq_ENST00000335295_cds.fa`, copied to `public/data` at build time). It shows codons 1 to 14 (c.1 to c.42). Each codon is one pickable group. Codon 7 (c.19 to c.21, `GAG`, where c.20 is the HbS site) is drawn in a warmer colour. The page checks at load that c.19 to c.21 = `GAG` and c.20 = `A`.
- **Mol* view:** the 2HBS model (asymmetric unit, see the P1.4.1 finding) through `createPluginUI`.
- **Shared selection store:** a 20-line store (`useSyncExternalStore`) that stands in for Helix's world state, holding `{ codon, source, phase }`. Both renderers only read from and write to the store. Neither calls the other.
- **Mapping:** codon k maps to p.k (UniProt P68871), which maps to the mature residue k-1, which is 2HBS beta chain `label_seq_id` k-1 (`src/mapping.ts`, from `research/hbs-mapping-note.md`). Codon 1 (Met) has no structure residue, and the page says so instead of guessing.
- **Accessible alternative:** a row of codon buttons (`role="toolbar"`, `aria-pressed`) drives the same store.
- **Layouts:** `?layout=side` puts R3F and Mol* side by side. `?layout=overlay` lays a transparent R3F canvas over a full-size Mol* view. `?r3f=0` and `?molstar=0` give single-canvas baselines.

## Results

Same machine and browser as P1.4.1: Apple M1 Pro, macOS 15.3.1, Chrome 156 headless with ANGLE Metal. Each layout run uses a fresh browser context. Raw data: `results/measure-headless.json` (vsync on) and `results/measure-headless-uncapped.json` (vsync off).

### Mapping check (on every load)

Codons 2 to 14 were translated and compared with the 2HBS chain H residue k-1 read from Mol*. 12 of 13 match. The only mismatch is **codon 7: `GAG` translates to GLU, while the structure has VAL**. That is the HbS substitution in this deoxy-HbS structure, which is exactly what the check should report.

### R3F to Mol* (real pointer click on codon 7 in the R3F canvas)

| Layout | Store update | Mol* read-back after sync | Store to Mol* done |
|---|---|---|---|
| side | `r3f:7` | `VAL H6` (label = auth, entity 2, 7 atoms) | 63 ms |
| overlay | `r3f:7` | `VAL H6` | 68 ms |

### Mol* to R3F (real pointer click at the Mol* canvas centre)

Before each click, the Mol* camera was pointed at chain H residue n (camera only, no selection).

| Aimed at | Picked by Mol* | Store update | Correct mapping? |
|---|---|---|---|
| H2, H3, H8 | nothing (the ray passed through the gap in the cartoon) | none | n/a |
| H5 | PRO H5 | `molstar:6` | yes |
| H6 | VAL H6 | `molstar:7` | yes |
| H10 | VAL H126 (an occluding residue in front) | `molstar:127` | yes for what was picked; outside the 14-codon DNA window, so the status line says so and the R3F camera stays put |
| H12, H13 | THR H12, ALA H13 | `molstar:13`, `molstar:14` | yes |

Every picked beta-chain residue mapped to the right codon. The misses come from the test harness, which clicks the centre of a thin cartoon, not from the bridge.

### First attempt at the overlay: double dispatch (fixed)

In the first overlay version, R3F listened on the shared parent (`eventSource`) while the Mol* canvas also received the same native click. One click on codon 7 then produced **two** store updates: `molstar:19` (whatever Mol* picked under the DNA) followed by `r3f:7`. Likewise, a click on Mol* also picked a DNA codon (`r3f:8`).

The fix is a modal pointer owner. In the DNA phase, R3F events are enabled and the Mol* container has `pointer-events: none`. In the protein phase, R3F events are disabled (`setEvents({ enabled: false })`) and Mol* receives pointer events. After the fix, each click produced exactly one store update in both directions (results above).

### WebGL contexts

Counted by wrapping `HTMLCanvasElement.prototype.getContext` before Mol* and R3F load. The bridge page runs no GPU probe, so the count is Mol* plus R3F only.

- Both layouts: **2 WebGL2 contexts** (Mol* first at about 330 ms, R3F at about 620 ms).
- Baselines: 1 each.
- Browsers cap live WebGL contexts per page (about 16 in Chrome from our prior knowledge; unverified and not measured here), so two is far from the limit. Each context holds its own GPU resources, and geometry cannot be shared between them.

### Frame times with both canvases active

`requestAnimationFrame` interval over 4 s. Mol* spin = trackball spin. R3F spin = the DNA group rotates. R3F renders every frame regardless (`frameloop="always"`), while Mol* draws only on demand.

With vsync on, every configuration stayed at 16.7 ms (p95 16.8 ms, no frame over 20 ms). Both canvases together hold 60 Hz on this machine.

With vsync off (`--disable-gpu-vsync --disable-frame-rate-limit`), the mean is computed as 4000 ms divided by frames:

| Configuration | side: mean / p95 | overlay: mean / p95 |
|---|---|---|
| both idle (R3F still rendering) | 1.36 / 2.7 ms | 1.36 / 2.7 ms |
| Mol* spinning | 2.50 / 3.9 ms | 4.16 / 7.5 ms |
| R3F spinning | 1.26 / 2.7 ms | 1.27 / 2.8 ms |
| **both spinning** | **2.50 / 4.0 ms** | **4.15 / 7.4 ms** |
| baseline, Mol* only (`r3f=0`, side page) | 1.71 / 3.1 ms | n/a |
| baseline, R3F only (`molstar=0`) | 1.47 / 2.8 ms | n/a |

- Mol* dominates the cost, and its cost scales with its canvas area. In the overlay, Mol* is full width, about twice the pixels of the side layout, and the frame cost was about 1.7 times higher. The small R3F scene adds little.
- With both canvases spinning, there was **one long frame of 290 to 400 ms** at the start of each Mol* spin in the bridge page. The Mol*-only page, which had no prior selection or focus, had none. **Unexplained:** it may be a one-off shader or representation rebuild of the focus or contact components on the first spin. To investigate before the product (P4).
- These are main-thread frame intervals on a fast laptop, not GPU timers and not low-end hardware.

### Camera hand-off and transition idea (tested in the overlay)

1. The user clicks codon 7 in the DNA (or presses the codon 7 button).
2. The R3F camera dollies into the codon. A frame-rate-independent lerp is used, which can be interrupted because the next click retargets it.
3. At the same time, the R3F canvas fades to 12% opacity (a 600 ms CSS transition), and Mol* runs `camera.focusLoci(H:6, { durationMs: 700 })` underneath.
4. Pointer ownership switches to Mol*.
5. "Back to DNA" reverses the steps.

The screenshot `screenshots/overlay-codon7.jpg` shows the result: the Mol* close-up of H:Val6 and its chain B contacts, with the DNA faded on top. No shared camera or scene graph is needed. The hand-off is choreography over two cameras that are both driven from the store.

Not attempted: matching the projection of the R3F camera to the Mol* camera for a seamless "fly-through". Mol*'s camera state (`position`, `target`, `up`, `fov`) is readable and settable through `canvas3d.camera.setState`, so it is possible (inference), but it needs a shared world transform between an illustrative DNA and real atomic coordinates. That transform is scientifically meaningless and would have to be labelled as illustrative.

## Bundle

`dist/assets/index-*.js`: 4,909 kB raw, 1,366 kB gzip. That is 919 kB raw and 245 kB gzip more than the Mol*-only page, which corresponds to three.js plus R3F.

## Screenshots

- `screenshots/side-overview.jpg`, `side-codon7.jpg`, `side-molstar-click.jpg`
- `screenshots/overlay-overview.jpg`, `overlay-codon7.jpg` (hand-off state), `overlay-molstar-click.jpg`

## Run

```sh
export PATH=/Users/bechir/research/helix/.tools/node/bin:$PATH
npm ci && npm run build
npx vite preview --port 5182 &
node scripts/measure.mjs && node scripts/measure.mjs --uncapped
```

Pinned: molstar 5.13.1, three 0.186.1, @react-three/fiber 9.8.2, react/react-dom 19.3.1, vite 8.3.4, @types/three 0.186.0, puppeteer-core 25.14.0. `src/helix-molstar.ts` is a copy of the P1.4.1 module, so that each experiment stays self-contained.
