<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HX-P1-2026-11-01-molstar-embed: Mol* in Vite and React, 2HBS, HbS residue

Retrospective entry written 2026-11-01 from the recorded evidence; not contemporaneous.

```yaml
id:            HX-P1-2026-11-01-molstar-embed
date:          2026-11-01
hypothesis:    Mol* 5.13.1, embedded in a Vite + React page, can load 2HBS, select chain H residue 6,
               and let the host page read back from the viewer state which residue is shown, both
               through the imperative plugin API and through MolViewSpec. Contradicted if the
               read-back disagrees with the target or a needed interaction cannot be programmed.
git_commit:    19b31ba
config:        research/experiments/molstar-embed/ (package.json pins; page parameters
               ?mode=imperative|mvs, ?source=local|rcsb); measurement scripts/measure.mjs,
               vsync-capped and --uncapped
seeds:         n/a; one run per condition, plus one uncapped repeat
data_version:  2HBS.cif from research/raw/rcsb/ (revision 1.5)
hardware:      Apple M1 Pro, 16 GB, macOS 15.3.1; Chrome 156.0.8078.74 headless with ANGLE Metal
               (renderer string "ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro)")
duration:      not recorded
cost:          0
software:      molstar 5.13.1, react 19.3.1, vite 8.3.4, typescript 6.0.3, puppeteer-core 25.14.0
```

## Methods

- Three conditions: imperative API with the local file; MolViewSpec with the local file; imperative API with a plain GET to files.rcsb.org.
- Each run uses a fresh browser context, so the HTTP cache is cold.
- Frame intervals are `requestAnimationFrame` intervals during a trackball spin, with vsync on and off.
- The read-back comes from Mol*'s selection and focus managers, not from page variables.

## Raw results + uncertainty

From `research/experiments/molstar-embed/README.md` and `results/measure-headless*.json`:

| Measure | Imperative, local | MVS, local | Imperative, RCSB |
|---|---|---|---|
| `createPluginUI` | 90 ms | 96 ms | 92 ms |
| Load to first draw | 237 ms | 338 ms (whole `loadMVS`) | 718 ms |
| Residue action to next draw | 224 ms | part of `loadMVS` | 220 ms |
| Frame interval, vsync on | p50 16.7, p95 16.7 ms | p50 16.7, p95 16.7 ms | p50 16.7, p95 16.8 ms |
| Frame interval, vsync off | p50 3.1, p95 3.9, max 7.1 ms | p50 2.9, p95 3.8 ms | p50 3.1, p95 3.9 ms |

- Read-back: `label_asym_id H, auth_asym_id H, label_seq_id 6, auth_seq_id 6, VAL, entity 2, 7 atoms`.
- The chain B contacts read back as ALA 70, ASP 73, THR 84, PHE 85, LEU 88.
- A simulated click at the canvas centre resolved to `VAL H6`.
- Bundle: 3,990.6 kB raw, 1,120.8 kB gzip (JavaScript).
- The MVS view file is 3.1 kB and passed `MVSData.validationIssues`.
- Uncertainty: single runs. The uncapped repeat reproduced the load numbers within about 25%. The RCSB download varied with the network: 718 ms and 1081 ms.

## Failures

- **Negative finding: Mol*'s default preset hides the HbS contact.** `applyPreset(trajectory, 'default')` builds assembly 1, which for 2HBS contains chains A to D only. Selecting chain H returned an empty loci, and the first run failed with "target not found". The fix is to load the model (the asymmetric unit).
- A spin without an `axis` parameter produced no motion (1 draw in 5 s).
- Type and documentation disagree: in 5.13.1, the MVS `focus` type has `radius_extent` while its comment says `radius_extra`. Caught by the compiler.

## Limits / confounders

- These are main-thread frame intervals on a fast laptop, not GPU timers.
- With vsync on, the result only shows that no frame was missed.
- One machine, one browser.

## Interpretation

Supported. The imperative API gives the selection, highlight, focus, events and read-back Helix needs. MVS declares the static view but cannot express the selection state, the hover highlight, the focus representation or events.

## Decision

**Continue.** Reuse MolViewSpec as the declarative snapshot format and the imperative API for interaction (`docs/competitor-analysis.md`, reuse decision). Scenes must load the model whenever the evidence is in the asymmetric unit.

## Artifacts

- `research/experiments/molstar-embed/README.md`
- `results/measure-headless.json`, `results/measure-headless-uncapped.json`, `results/2hbs-hbs-view.mvsj`
- `screenshots/imperative-local.jpg`, `mvs-local.jpg`, `imperative-rcsb.jpg`
