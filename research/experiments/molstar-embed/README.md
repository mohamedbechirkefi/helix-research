<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# P1.4.1: Mol* embedded in Vite + React, 2HBS, HbS residue

**Status:** done, 2026-11-01. Experiment, not product code.

## Run

```sh
export PATH=/Users/bechir/research/helix/.tools/node/bin:$PATH
npm ci
npm run build                     # copies research/raw/rcsb/2HBS.cif into public/data (git-ignored), builds dist/
npx vite preview --port 5181 &    # or: npm run dev
node scripts/measure.mjs          # vsync-capped run, writes results/measure-headless.json and screenshots/
node scripts/measure.mjs --uncapped   # --disable-gpu-vsync --disable-frame-rate-limit
```

Page parameters: `?mode=imperative|mvs`, `?source=local|rcsb` (plain GET to `https://files.rcsb.org/download/2HBS.cif`, no custom headers), `?measure=0`.

Pinned: molstar 5.13.1, react/react-dom 19.3.1, vite 8.3.4, @vitejs/plugin-react 6.1.2, typescript 6.0.3, sass 1.105.2, puppeteer-core 25.14.0 (drives the system Google Chrome 156.0.8078.74; no browser download).

## Results

Machine: Apple M1 Pro, 16 GB, macOS 15.3.1. Chrome headless (new) with ANGLE Metal: the WebGL renderer string is `ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro)`, so the GPU was used. Each run uses a fresh browser context (cold HTTP cache). Raw numbers: `results/measure-headless.json`, `results/measure-headless-uncapped.json`.

| Measure | Imperative, local file | MVS, local file | Imperative, files.rcsb.org |
|---|---|---|---|
| `createPluginUI` | 90 ms | 96 ms | 92 ms |
| Load to first draw (download, parse, preset) | 237 ms | 338 ms (whole `loadMVS`) | 718 ms |
| Residue action to next draw | 224 ms | (part of `loadMVS`) | 220 ms |
| Frame interval while spinning, vsync on | p50 16.7, p95 16.7 ms | p50 16.7, p95 16.7 ms | p50 16.7, p95 16.8 ms |
| Frame interval while spinning, vsync off | p50 3.1, p95 3.9, max 7.1 ms | p50 2.9, p95 3.8 ms | p50 3.1, p95 3.9 ms |

The uncapped run reproduced the load numbers within about 25% (the RCSB download varies with the network: 718 ms and 1081 ms).

- **Bundle:** `dist/assets/index-*.js` 3,990.6 kB raw, 1,120.8 kB gzip; CSS 69.2 kB raw, 15.8 kB gzip. This is the full Mol* plugin UI plus the MVS extension, without code splitting.
- **Frame interval** is the `requestAnimationFrame` interval during a Mol* trackball spin. With vsync it is capped at 60 Hz, so it only shows that no frame was missed. The uncapped run shows the page's real frame cost. It is not a GPU timer.
- **Mol* draws on demand:** without the spin, `canvas3d.didDraw` fired once in 5 s.

### Read-back proves VAL 6 on chain H

The values below are read from the viewer state, not from our own variables. In imperative mode they come from `plugin.managers.structure.selection.getLoci(structure)` and `plugin.managers.structure.focus.current`. In MVS mode they come from the components that `loadMVS` created. The residue properties are read with `StructureProperties` on each location:

```json
{"label_asym_id":"H","auth_asym_id":"H","label_seq_id":6,"auth_seq_id":6,"label_comp_id":"VAL","entity_id":"2","atoms":7}
```

The chain B contact component reads back as ALA 70, ASP 73, THR 84, PHE 85 and LEU 88 (entity 2, label equal to auth). A simulated mouse click at the canvas centre, which after focusing is H:Val6, produced a `click` event whose loci resolve to `VAL H6`. That is the event path Helix needs for "user clicks a residue".

### Finding: the default preset hides chain H

`applyPreset(trajectory, 'default')` builds **assembly 1**. For 2HBS, assembly 1 contains only `asym_id` A, B, C, D and their ligands (per `research/raw/rcsb/assembly_2HBS_1.json`). The selection of `label_asym_id H` therefore returned an empty loci, and the first run failed with "target not found". The fix is `applyPreset(trajectory, 'default', { structure: { name: 'model', params: {} } })`, which loads the asymmetric unit.

**Consequence for Helix:** the HbS contact we show (H:Val6 against chain B) lies between the two tetramers of the asymmetric unit, not inside one biological assembly. The scene must load the model, not assembly 1, and the label must say that this is a contact in the crystal's asymmetric unit (the note in `research/hbs-mapping-note.md` already scopes the contact search to the asymmetric unit, model 1). MVS `modelStructure()` loads the model as well, so it was not affected.

## API calls used (imperative)

Logged by `logCall` in `src/helix-molstar.ts`. Times are from one run.

| Step | Call | ms |
|---|---|---|
| Create viewer | `createPluginUI({ target, render: renderReact18, spec })`, with `DefaultPluginUISpec()` plus `PluginSpec.Behavior(MolViewSpec)` | 90 |
| Download | `plugin.builders.data.download({ url, isBinary: false })` | 37 |
| Parse | `plugin.builders.structure.parseTrajectory(data, 'mmcif')` | 30 |
| Build model + default representations | `plugin.builders.structure.hierarchy.applyPreset(traj, 'default', { structure: { name: 'model' } })` | 89 |
| Resolve target | `MS.struct.generator.atomGroups({ 'chain-test': eq(label_asym_id, 'H'), 'residue-test': set.has([6], label_seq_id) })`, then `Script.getStructureSelection`, then `StructureSelection.toLociWithSourceUnits` | under 1 |
| Select | `plugin.managers.structure.selection.fromLoci('set', loci)` | 0.8 |
| Highlight | `plugin.managers.interactivity.lociHighlights.highlightOnly({ loci })` | 0.7 |
| Focus representation (residue plus surroundings and interactions) | `plugin.managers.structure.focus.setFromLoci(loci)` | 1.1 |
| Camera | `plugin.managers.camera.focusLoci(loci, { durationMs: 600, extraRadius: 4 })` | 0.7 |
| Persistent colour | `plugin.builders.structure.tryCreateComponentFromExpression(ref, expr, key, { label })`, then `representation.addRepresentation(comp, { type: 'ball-and-stick', color: 'uniform', colorParams: { value } })` | 21 + 17 |
| Contacts | same, for chain B 70, 73, 84, 85, 88 | 0.2 + 8 |
| 3D label | `plugin.managers.structure.measurement.addLabel(loci, { labelParams: { customText } })` | 108 |
| Read-back | `selection.getLoci(structure)`, `focus.current.loci`, `StructureElement.Loci.forEachLocation` with `StructureProperties.{chain,residue,atom,entity}` | under 1 |
| Frame probe | `canvas3d.didDraw` (rxjs), `canvas3d.setProps({ trackball: { animate: { name: 'spin', params: { speed, axis } } } })` | n/a |

Spin pitfall: `animate: { name: 'spin', params: { speed } }` without `axis` produced no motion (1 draw in 5 s). The axis is required.

### Events available

- `plugin.behaviors.interaction.click` and `.hover` (rxjs `BehaviorSubject`, the payload has `current.loci`, `button`, `modifiers`). Verified for click.
- `plugin.managers.structure.selection.events.changed` (selection added, removed or cleared). Verified.
- `plugin.managers.structure.focus.behaviors.current` (focus changes, including Mol*'s own click to focus). Verified.
- `plugin.canvas3d.didDraw` (draw timestamps). Verified.
- `plugin.managers.camera` has no change event of its own. Camera state is readable at `plugin.canvas3d.camera.state` (we read `target` and `radius`). For continuous sync, `canvas3d.didDraw` is the practical hook (inference, not tested).

## MolViewSpec (declarative) comparison

The same view built with `MVSData.createBuilder()` (`buildMvs` in `src/helix-molstar.ts`, saved as `results/2hbs-hbs-view.mvsj`, 3.1 kB). It passed `MVSData.validationIssues` and was loaded with `loadMVS(plugin, data, { sanityChecks: true, sourceUrl })`.

| Need | MVS (declarative) | Imperative API needed? |
|---|---|---|
| Load the 2HBS model (asymmetric unit) | `download`, `parse`, `modelStructure` | no |
| Select chain H residue 6 by label numbering | `component({ selector: { label_asym_id: 'H', label_seq_id: 6 } })` | no |
| Colour and representation | `representation({ type: 'ball_and_stick' })` and `color({ color })` | no |
| 3D text label | `label({ text })` | no |
| Hover tooltip | `tooltip({ text })` | no |
| Camera focus on a component | `focus({ radius_extent })` | no |
| Exact camera, transitions between states | `camera`, `transition` (duration, trajectory, easing), multi-state `States` | no |
| Background colour | `canvas({ background_color })` | no |
| Mol* **selection** state | not declarable: after `loadMVS` the selection manager was empty | yes |
| Hover-style **highlight** | not declarable | yes |
| Focus representation (surroundings, interaction lines) | not declarable: MVS `focus` is camera only | yes |
| Click, hover and selection events | none in MVS | yes (`plugin.behaviors.interaction.*`) |
| Read back what is shown | no API in MVS; we read the created components from the state tree | yes |
| Incremental change (one residue) without rebuilding the scene | whole-state load (`replaceExisting`) | yes, or reload a new state |

Notes:

- In 5.13.1 the TypeScript type of `focus` has `radius_extent`, while its doc comment says `radius_extra`. The compiler caught it.
- Load cost: `loadMVS` for the whole view took 246 ms, in the same range as the imperative load plus action. The MVS view in the screenshot has no focus representation and no selection outline.

Verdict for Helix: MVS is a good **output format** for a validated scene state, such as a curated chapter or an export for sharing, and a good constrained target for an AI plan. Interaction, read-back and incremental highlighting need the imperative plugin API in any case. The two can coexist in one plugin, since `loadMVS` runs on the same `PluginContext`.

## Screenshots

- `screenshots/imperative-local.jpg`: imperative path; amber Val6 with the highlight outline, teal chain B contacts, focus interactions, label; side panel shows the read-back.
- `screenshots/mvs-local.jpg`: MVS path; same residues, declared colours and label; no selection or interaction lines.
- `screenshots/imperative-rcsb.jpg`: same as the first, loaded with a plain GET from files.rcsb.org.
