# HX-P11-2026-11-10-tiers-soak: device tiers (S20), the memory soak (S22), the bundle check

```yaml
id:            HX-P11-2026-11-10-tiers-soak
date:          2026-11-10
phase:         P11 (tasks P11.1.1 and P11.1.3; suites S20 and S22 of docs/phase-11-release-qa.md; budgets D-H034)
hypothesis:    (P11.1.1) Four tiers built from existing rendering settings, selected from browser capabilities and a short frame probe, pick the expected tier under each emulated condition, keep the reference budgets, and lose no scientific content in the low and no-3D tiers. (P11.1.3) Twenty questions and world switches on one page show no heap or GPU-resource growth within budget, one structure in memory, and no server package in the shipped bundle.
git_commit:    helix-app 2d852dd to c367193 (pins 938c13b, 7804ff2, 9655b20, db3c044; changes 4f14ae8, 95d99fb, 9365015, 821515c, c23a116; review c367193), pinned unchanged to helix-research c045aed; built by a delegated agent on Opus 5.5, medium effort; verified by the coordinator
config:        e2e/tiers.mjs: reference (1400 x 820 at ratio 1 and 2, 1024 x 768), CPU throttling 4x and 6x (Emulation.setCPUThrottlingRate), ratio 3, 4 and 2 logical processors, Save-Data, reduced motion, --use-angle=swiftshader, --disable-webgl2; 3 pages per condition; e2e/soak.mjs: 20 questions and world switches on HBB and on CFTR, heap, Chrome process tree, three.js renderer.info and Mol* resource counts through the diagnostics hook, a production build with source maps for the bundle attribution
seed:          none
data_version:  the five curated sets at helix-research c045aed, unchanged
hardware:      Apple M1 Pro, the development Mac, Chrome 157 headless; slower devices emulated only, none bought (D-H030 answer 91)
duration:      the agent's pass about 155 minutes; the coordinator's reruns about 30 minutes
cost:          0
```

## Measurements

Raw results in helix-app `apps/web/e2e/results/*p11ts*`; the review is helix-app `docs/reviews/phase-11-tiers-soak.md` (sections 2 to 5).

**Tiers.** full (the default), balanced (no depth of field, pixel ratio at most 1.5), low (`?power=low`), none (a page without 3D: welcome text, codons, chapters, Evidence World, limitations, and a notice of what is not shown). Selection in order: no WebGL2 none; Save-Data low; MAX_TEXTURE_SIZE under 4,096 low; 2 logical processors or fewer low, 4 or fewer balanced; ratio above 2 balanced; else full; then a frame probe while the welcome is open (median over 20 ms steps down; low over 20 ms becomes none). Thresholds are the agent's choice. Nothing stored or sent; a side-panel override and `?tier=`.

Selected as expected under every condition: full on the reference, 1024 x 768, CPU 4x and 6x (the probe read 16.7 ms) and reduced motion; balanced at ratio 3 and 4 processors; low at 2 processors, Save-Data and `?power=low`; none under SwiftShader (probe 317 to 333 ms at full, 133 ms at low) and without WebGL2.

| Condition, tier | Welcome interactive | DNA World ready | Worst move median | Longest frame | Frames over 33.4 ms (3 pages) |
|---|---|---|---|---|---|
| Reference, every tier | 200 to 206 ms | 345 to 440 ms | 16.7 ms | 28.9 to 33.1 ms | 0 |
| CPU 4x, full | 694 ms | 1,124 ms | 16.7 ms | 78 ms | 5 |
| CPU 6x, full | 976 ms | 1,563 ms | 16.7 ms | 111.8 ms | 6 |
| CPU 6x, low forced | 1,035 ms | 1,414 ms | 16.7 ms | 120.6 ms | 12 |

The page without WebGL2 is ready at 179 ms; SwiftShader reaches the page without 3D at 22.8 s. Under throttling the long frames come from React's commit on a click (the welcome's Skip, a codon), not from rendering, so no tier removes them. Content: low and full show identical text and accessible names on 5 HBB screens; the page without WebGL2 holds every Evidence World line, limitation, codon and chapter title on all five sets.

Two faults found and fixed, each pinned first: the page without 3D (and the narrow page of D-H030) lacked the disease-associations card on every set; a drag ending where it began counted as a click and picked a base.

**Soak** (budgets D-H034): heap growth from cycle 1 to cycle 2 0.9 % (HBB) and 1.0 % (CFTR), budget 5 %; heap at most 187.1 and 187.9 MB, budget 256 MB; no growth in three.js, Mol* or live WebGL object counts after cycle 1; exactly one Mol* structure after each of the 20 questions; Chrome process tree at the end 1,567 MB, budget 1,800 MB; in Protein World 0 DNA frames and 0 three.js render calls over 16 stretches; 2HBS and 5UAK fetched once per page, from the idle prefetch only.

**Bundle:** 86 npm packages ship, none outside the production dependency closure and none on the server-only list; body-parser is not shipped (it enters the tree through Mol*'s express dependency, which the app never imports). Bytes at rest 1,998.5 kB against the 2,000 kB budget (1,993.8 kB before the pass).

## Coordinator verification

Rerun on c367193, each by exit code: unit tests (555 passed), typecheck, check:pin, web:build, tiers.mjs (0 failures, 0 budgets over), soak.mjs (0 over; process tree at the end 1,547 MB), budgets.mjs (full), layout.mjs, a11y.mjs, nollm.mjs, the held-out split replay: all exit 0. The agent also ran the Phase 10 suite, the Phase 10 replay, hidden-canvas and the three frame conditions (exit 0). The coordinator's own result files were removed by exact name.

## Interpretation

Both hypotheses hold on this Mac under emulation. Emulation is not a slow device: throttling slows the CPU but not the GPU, and SwiftShader stands in for a machine without a usable GPU. The throttled long frames are a cost of the click's React commit; whether the reference frame budgets apply to emulated slower processors is the author's decision (review section 5). Bytes at rest leave 1.5 kB of margin.

## Failures

The two faults above (pinned, fixed). The balanced tier differs from the plan (one pixel ratio for the scene and the bloom, 1.5, because the pipeline shares it). A visitor who closes the welcome before the 23 s SwiftShader probe ends stays at full.
