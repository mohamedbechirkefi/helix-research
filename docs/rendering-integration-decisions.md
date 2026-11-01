<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# Rendering integration decisions (P1.4.3, P1.5.2)

**Status:** decision proposed, 2026-11-01. It rests on three experiments run that day:

- `research/experiments/molstar-embed/` (P1.4.1)
- `research/experiments/molstar-r3f-bridge/` (P1.4.2)
- `research/experiments/tauri-shell/` (P1.5.2)

Every number below comes from those folders' `results/*.json`. The test machine was an Apple M1 Pro with 16 GB, running macOS 15.3.1. The browser was Chrome 156 headless with ANGLE Metal, and the desktop shell used WKWebView. **Assumption** marks reasoning that the experiments did not test.

## 1. Question

Master prompt §11 asks whether Mol* and React Three Fiber should share one canvas, scene graph and GPU context (**unified**), or run as separate renderers that a shared state keeps in step (**coordinated**). §11 also says to prototype coordination, camera bridging and transitions before committing to a unified canvas, and to keep scientific fidelity.

## 2. Options

| | A. Coordinated canvases (side by side or overlaid) | B. Unified canvas |
|---|---|---|
| How | Mol* in its own canvas and WebGL context; R3F in another. A shared world-state store drives both. Transitions are choreographed: camera moves, opacity, pointer ownership. | One WebGL context. Either Mol* geometry is exported into the three.js scene, or three.js objects are drawn into Mol*'s `canvas3d`, or a custom molecular renderer is written in three.js. |
| Molecular fidelity | Full Mol*: cartoon, focus representation with interactions, labels, MVS, selection, picking, mmCIF/BinaryCIF, assemblies, label/auth numbering. | Mol* has no supported API to render into a foreign three.js scene or to host arbitrary three.js objects. Re-implementing cartoons, picking and interactions in three.js loses fidelity or costs months (Assumption, based on the size of Mol*'s `mol-repr` and `mol-gl`). |
| Effort | Small. The bridge experiment took one file of about 300 lines. | Large and fragile across Mol* releases (Mol* v6 is in development; see `competitor-analysis.md`). |
| Visual consistency | Two lighting and post-processing pipelines. Mol* has its own SSAO, outlines and fog. Matching needs restraint and shared colour tokens. | One pipeline: shared bloom, fog and depth across scales. |
| GPU cost | 2 WebGL2 contexts; no shared buffers. | 1 context. |
| Interaction | Two pickers. Pointer ownership must be explicit (finding below). | One picker. |

## 3. Evidence

1. **Coordination works in both directions with correct identifiers.** In both layouts:
   - A real click on codon 7 in R3F updated the store (`r3f:7`). Mol* then selected, highlighted and focused 2HBS chain H residue 6. Reading the selection back from Mol* gave `VAL H6`, label = auth, entity 2.
   - A real click on Mol* residues PRO H5, VAL H6, VAL H126, THR H12 and ALA H13 produced codons 6, 7, 127, 13 and 14, each the correct value.
   - Store to Mol* took 63 to 68 ms (152 ms in the uncapped run).
   - On every load, a mapping check compared codons 2 to 14 against the structure. 12 of 13 match, and the one mismatch is codon 7, `GAG` (Glu) against VAL, which is the HbS substitution itself.
2. **Performance is not a reason to unify at this scale.**
   - With vsync on, every combination held 16.7 ms frames (no frame over 20 ms), including both canvases animating.
   - With vsync off, the mean frame time with both canvases animating was 2.5 ms side by side and 4.15 ms overlaid, against 1.7 ms for Mol* alone and 1.5 ms for R3F alone.
   - Mol*'s cost scales with its canvas area; the small R3F scene adds little.
   - Limits: main-thread rAF intervals on a fast laptop. Not GPU timers, and not low-end hardware.
3. **Two contexts, not more.** The page creates exactly 2 WebGL2 contexts (counted by wrapping `getContext`). Browser context caps are far away (Assumption: about 16 in Chrome, not measured).
4. **Overlay needs one pointer owner at a time.**
   - With R3F listening on the shared parent and Mol* receiving the same click, one click produced two store updates (`molstar:19` then `r3f:7`).
   - The fix is a modal owner. In the DNA phase, R3F events are on and Mol* has `pointer-events: none`. In the protein phase, R3F events are off and Mol* gets the pointer. After the fix, each click produced exactly one update in both directions.
5. **A camera hand-off is possible without a shared camera.**
   - The R3F camera dollies into the codon while R3F fades to 12% and Mol* runs `focusLoci(..., { durationMs: 700 })` underneath.
   - Both cameras follow the store, and the user can interrupt by retargeting.
   - A geometric fly-through from the DNA into atoms would need a shared world transform between illustrative DNA and real coordinates. That transform is scientifically meaningless and would have to be labelled as illustrative. It was not attempted.
6. **The Mol* default would have shown the wrong thing.**
   - `applyPreset(..., 'default')` builds assembly 1, which for 2HBS holds chains A to D only, so chain H did not exist in the scene.
   - The HbS contact H:Val6 to chain B is between the two tetramers of the asymmetric unit, so Helix must load the model and label the contact as an asymmetric-unit (crystal) contact.
   - This is an example of the scientific detail that a mature renderer exposes. A homemade three.js renderer would have to re-implement it correctly.
7. **One unexplained long frame (290 to 400 ms) at the start of a Mol* spin**, in the bridge page only. To investigate in P4 (Assumption: a one-off rebuild of the focus or contact representations).

## 4. Decision (recommended)

**Use coordinated canvases (option A).** Mol* owns every real molecular structure; R3F owns the illustrative and cinematic layers (DNA, chromosome, cell, transitions). One authoritative world-state store, the §7.4 shared world state, drives both. The renderers never call each other.

- **Default layout: a full-bleed stage with a modal pointer owner.**
  - Mol* stays mounted, hidden or shown.
  - An R3F layer is placed above it with `alpha`, and the store's `phase` decides which layer receives pointer events.
  - A side-by-side split remains available for "compare" views (sequence, DNA and structure at once) and for the low-power or reduced-motion mode.
- **Transitions are choreography, not shared geometry:** camera dolly, cross-fade, shared colour tokens (amber = variant, teal = context), and a labelled "illustrative" cue on R3F content. Both cameras must be interruptible.
- **Mol* integration surface:** the imperative plugin API for selection, highlight, focus, click and hover events, and read-back. MolViewSpec for declarative scene snapshots (curated chapters, exports, a constrained AI output target). See the reuse decision in `competitor-analysis.md`.
- **Load the model (asymmetric unit) when the evidence is in the asymmetric unit.** Assembly choice is part of the typed action (`loadStructure` must carry `assembly: 'model' | id`).
- **Revisit option B only if** a future Mol* release documents a way to draw into or from a three.js scene, or a measured need appears that coordination cannot meet (for example a continuous camera through scales with real data at both ends).

Consequences for the roadmap:

- P4.2.1 builds the Mol* viewer component with the API set logged in `molstar-embed/README.md`.
- The scene-action interpreter (§7.3) targets the store, not the renderers.
- Pointer ownership is part of the world state.
- Bundle: Mol* plus MVS is about 1.12 MB gzip, and three.js plus R3F adds about 0.25 MB gzip. Code splitting (lazy-loading Mol* when entering Protein World) is a P4 task.

## 5. Tauri desktop feasibility (P1.5.2, amendment A-1)

Experiment: `research/experiments/tauri-shell/`. A Tauri 2.12.4 app (CLI 2.12.3) loads the unchanged P1.4.1 build at `tauri://localhost`, with a probe script injected through `initialization_script`.

| Question | Result |
|---|---|
| Tauri 2 licence | `Apache-2.0 OR MIT` (`tauri`, `tauri-build`, `wry`, `tauri-plugin-http`, `@tauri-apps/cli`, `@tauri-apps/api`). See the licence audit. |
| Toolchain install | Rust 1.97 already present; the CLI comes from npm. No sudo, no Homebrew, no payment. |
| Mol* renders 2HBS in WKWebView (macOS 15.3.1) | **Yes.** In-webview screenshot; read-back `VAL H6`. Warm run: load to first draw 256 ms, action 321 ms. Cold first launch: 2.7 s and 2.3 s. Spin frames at a p50 of 17 ms. |
| WebGL2 in WKWebView | **Yes** (`Apple GPU`, WebGL 2.0, max texture 16384). |
| WebGPU in WKWebView | **No.** `navigator.gpu` is undefined on macOS 15.3.1; Chrome on the same machine has a Metal adapter. In-browser LLMs that need WebGPU (WebLLM, the WebGPU backend of Transformers.js) are unavailable in the desktop shell on this OS. Re-test on newer macOS (Assumption: WebKit may enable it later). |
| R3F in WKWebView | Not run in the shell (the shell wraps P1.4.1 only). Assumption: works, since three.js needs only WebGL2, which is present. To verify in P11.5. |
| Local Ollama from the shell | **Yes, by three routes, all measured.** (1) Direct webview `fetch`: Ollama 0.9.6 allows the `tauri://localhost` origin by default, but this depends on the version and on `OLLAMA_ORIGINS`. (2) `tauri-plugin-http` with a capability scoped to `http://localhost:11434/*`: outside URLs are refused. (3) A custom Rust command using reqwest. One structured-output call to llama3.1 took 5.0 s warm and 13.1 s with model load. |
| Recommended route | A Rust command, or the HTTP plugin with a one-URL scope. CSP `connect-src` lists `http://localhost:11434` explicitly. The webview never holds arbitrary network rights. |
| Model output | Schema-valid but wrong: it proposed PDB `1BZO`, not 2HBS. This confirms that the deterministic interpreter must validate every plan. |
| Bundled data | Yes. `data/2HBS.cif` is served from the app bundle at `tauri://localhost/data/2HBS.cif`, so offline loading works for bundled files. Live GET to files.rcsb.org also works (200) under the CSP. |
| Ollama for public web visitors | **No.** An arbitrary web origin got 403 from Ollama's CORS check. Local AI stays a desktop-only provider, as §8 and A-1 require. |
| Bundling Ollama inside the app | Not tested. Assumption: possible as a Tauri sidecar binary, but the Ollama binary and model weights are large and carry their own licences. Calling a user-installed server is the zero-spend default. |
| Packaging | `.app` 8.4 MB (arm64), `.dmg` 4.5 MB. Ad hoc signed (`codesign`: `Signature=adhoc`, valid). Gatekeeper (`spctl`) **rejects** it. Not notarised; notarisation needs a paid Apple Developer account, which is the author's decision. |
| Build cost | 2 min 19 s first release build, 1 min 13 s incremental, 1.1 GB `target/`. |

**Verdict:** the Tauri macOS build is feasible for the same web code, with Mol* unchanged. It gives a strong local-AI path through Ollama. It does **not** give WebGPU on macOS 15.3.1, so the AI provider abstraction must offer, in the desktop build: Ollama (via Rust), then the deterministic fallback. In-browser WebGPU models apply to the web build on WebGPU-capable browsers only.

Open items for P11.5:

- WebGPU on newer macOS.
- R3F inside the shell.
- A universal binary.
- Quarantine behaviour of a downloaded DMG.
- Whether to ship an Ollama sidecar.
