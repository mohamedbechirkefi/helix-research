<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HX-P1-2026-11-01-molstar-r3f-bridge: Mol* coordinated with a React Three Fiber canvas

Retrospective entry written 2026-11-01 from the recorded evidence; not contemporaneous.

```yaml
id:            HX-P1-2026-11-01-molstar-r3f-bridge
date:          2026-11-01
hypothesis:    Two separate renderers (Mol* for the structure, R3F for an illustrative DNA helix),
               kept in step only through a shared store, can exchange a selection in both directions
               with correct scientific identifiers and hold 60 Hz together. Contradicted if a
               selection maps to the wrong residue or codon, or if frames are dropped with vsync on.
git_commit:    19b31ba
config:        research/experiments/molstar-r3f-bridge/; ?layout=side|overlay, ?r3f=0, ?molstar=0;
               scripts/measure.mjs, vsync on and --uncapped
seeds:         n/a; one run per layout and configuration
data_version:  2HBS.cif (revision 1.5); CDS research/raw/ensembl/seq_ENST00000335295_cds.fa
hardware:      Apple M1 Pro, macOS 15.3.1, Chrome 156 headless with ANGLE Metal
duration:      not recorded
cost:          0
software:      molstar 5.13.1, three 0.186.1, @react-three/fiber 9.8.2, react 19.3.1, vite 8.3.4
```

## Methods

- An R3F helix of codons 1 to 14 is built from the real CDS.
- A store of about 20 lines holds `{ codon, source, phase }`. Both renderers only read from and write to it.
- Mapping rule: codon k maps to p.k, then to mature k-1, then to 2HBS beta `label_seq_id` k-1. Codon 1 has no structure residue.
- Real pointer clicks were sent in both directions, in two layouts.
- WebGL contexts were counted by wrapping `getContext`.

## Raw results + uncertainty

From `research/experiments/molstar-r3f-bridge/README.md` and `results/measure-headless*.json`:

- **Mapping check on load:** codons 2 to 14 against chain H residues 1 to 13: 12 of 13 match. The one mismatch is codon 7, `GAG` (Glu) against VAL, which is the HbS substitution itself.
- **R3F to Mol*:**
  - Side layout: click on codon 7, Mol* read-back `VAL H6`, store to Mol* 63 ms.
  - Overlay layout: same read-back, 68 ms.
  - Uncapped run: 152 ms (per `docs/rendering-integration-decisions.md` §3).
- **Mol* to R3F:** PRO H5, VAL H6, VAL H126, THR H12 and ALA H13 gave codons 6, 7, 127, 13 and 14, all correct. Aiming at H2, H3 and H8 picked nothing, because the click passed through the gap in the cartoon.
- **WebGL:** 2 WebGL2 contexts in both layouts; 1 in each single-canvas baseline.
- **Frames, vsync on:** 16.7 ms in every configuration, p95 16.8 ms, no frame over 20 ms.
- **Frames, vsync off, both canvases spinning:** mean 2.50 ms (side) and 4.15 ms (overlay); p95 4.0 and 7.4 ms. Baselines: Mol* only 1.71 ms, R3F only 1.47 ms.
- **Bundle:** 4,909 kB raw, 1,366 kB gzip, that is 919 kB raw and 245 kB gzip more than Mol* alone.
- Uncertainty: single runs on one machine.

## Failures

- **Double dispatch in the first overlay.** R3F listened on the shared parent while Mol* received the same click, so one click produced two store updates (`molstar:19`, then `r3f:7`). Fixed with a modal pointer owner: one layer receives pointer events at a time. After the fix, each click produced exactly one update.
- **Unexplained long frame.** One frame of 290 to 400 ms appeared at the start of each Mol* spin in the bridge page only. Not reproduced on the Mol*-only page. Left open for Phase 4.
- The harness misses on thin cartoons are a test artifact, not a bridge failure.

## Limits / confounders

- Main-thread `requestAnimationFrame` intervals on a fast laptop, not GPU timers.
- The per-page WebGL context cap (about 16 in Chrome) is prior knowledge, not measured.
- A geometric fly-through from DNA into atoms was not attempted. It would need a world transform that has no scientific meaning.

## Interpretation

Supported for the HBB slice on this machine. Coordination through a store is correct in both directions. Its cost is dominated by Mol*'s canvas area.

## Decision

**Continue.** Adopt coordinated canvases with a modal pointer owner (option A in `docs/rendering-integration-decisions.md` §4). Investigate the long frame in Phase 4.

## Artifacts

- `research/experiments/molstar-r3f-bridge/README.md`
- `results/measure-headless.json`, `results/measure-headless-uncapped.json`
- `screenshots/side-*.jpg`, `screenshots/overlay-*.jpg`
