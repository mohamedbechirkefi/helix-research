# HX-P8-2026-11-03-budgets-baseline: Phase 8 performance budgets and their baseline on the Phase 7 build

```yaml
id:            HX-P8-2026-11-03-budgets-baseline
date:          2026-11-03
phase:         P8 (P8.1.1 performance budgets)
hypothesis:    The Phase 7 build of record meets proposed budgets for time to first interaction, frame times, structure loading, memory and bundle size on the reference hardware, except the bytes fetched before the first interaction, which the current startup (Mol* and the structure file loaded before the scene is ready) should put over a 1,000 kB target.
git_commit:    helix-app 19a014f plus the harness (apps/web/e2e/budgets.mjs, budgets.json, docs/qa-and-performance.md, committed after this run); helix-research 64695d7 (pin af104e2)
config:        node e2e/budgets.mjs --repeats=5 --tag=p8-baseline (frames checked from shipped-frames-polish-final-dpr1/dpr2/dpr2-power-low.json of HX-P7-2026-11-03-shipped-polish-frame-timing); then --repeats=3 "--query=&power=low"; vite preview on localhost:5190 from the production build; rule-based planner not involved (no question asked)
seed:          n/a (timing)
data_version:  curated HBB dataset at the pinned helix-research commit
hardware:      the development Mac (M1 Pro), headless Chrome 156.0.8078.80, viewport 1400x820, device pixel ratio 1 (the start and structure passes), machine otherwise idle
duration:      about 9 minutes, 2026-11-03 afternoon local
cost:          0
```

## Method

The budgets are written in helix-app `apps/web/e2e/budgets.json` and explained in `docs/qa-and-performance.md` (reference hardware, each metric, where its baseline comes from). The harness `budgets.mjs` measures, per fresh browser context: the page load to `__helixApp.ready`, the welcome's Explore control enabled, `__helixDna.ready`; the resources whose response ended before the ready moment and all resources 1.2 s later (gzip bytes over the wire from `transferSize`); the JavaScript heap after a forced garbage collection (DevTools `HeapProfiler.collectGarbage`, then `performance.memory.usedJSHeapSize`); the Chrome process tree's resident set from `ps`. Then, from a page with the welcome off: the cold world switch to Protein World (first Mol* use and 2HBS), six DNA/Protein round trips with the heap after each, the number of structures in Mol*'s hierarchy at the end. The built assets are sized with Node's zlib. Frame results of `shipped-frames.mjs` are checked against the frame budget (median with vsync on, frames over 33.4 ms, uncapped tour p95, idle frames; the tour's 0.2 s depth-of-field fade is reported and not budgeted). Each check prints ok, OVER or n/a; the run exits non-zero on a breach unless `--no-fail`.

## Results (raw: `journal/results/helix-app-e2e/budgets-p8-baseline.json`, `budgets-p8-baseline-power-low.json`)

| Metric | Budget | Baseline, default | Baseline, low power |
|---|---|---|---|
| Page load to scene ready | <= 1,000 ms | 673 ms (665 to 679, n = 5) | 560 ms (559 to 584, n = 3) |
| Welcome interactive | <= 1,200 ms | 681 ms (673 to 688) | 571 ms (571 to 596) |
| DNA World ready | <= 1,200 ms | 682 ms (674 to 689) | 581 ms (580 to 605) |
| Bytes over the wire before scene ready | <= 1,000 kB | **1,918.6 kB, over** (28 of 29 resources) | **1,918.6 kB, over** |
| Bytes over the wire at rest | <= 2,000 kB | 1,918.6 kB | 1,918.6 kB |
| JS heap at rest | <= 96 MB | 42.6 MB | 42.1 MB |
| World switch to Protein, cold | <= 2,500 ms | 1,708 ms (1,699 to 1,727) | 1,713 ms (1,706 to 1,723) |
| 2HBS fetch during the cold switch | <= 300 ms | n/a: the file is fetched at start (248.8 kB gzip, 25 ms) | n/a |
| World switch to Protein, warm | <= 1,600 ms | 1,560 ms (1,534 to 1,568, 30 switches) | 1,549 ms (1,533 to 1,564, 18) |
| World switch to DNA | <= 1,600 ms | 1,484 ms (1,474 to 1,505) | 1,490 ms (1,474 to 1,507) |
| JS heap after the load | <= 256 MB | 78.4 MB | 77.9 MB |
| Heap growth over 6 round trips | <= 10 % | 1.4 % (78.4 to 79.5 MB, identical in every repeat) | 1.4 % |
| Chrome process tree after the round trips | <= 1,500 MB | 1,156 MB (1,145 to 1,184) | 1,141 MB (1,134 to 1,161) |
| Structures in Mol* after the round trips | 1 | 1 in every repeat | 1 |
| Scene chunk gzip | <= 1,100 kB | 967.5 kB | same build |
| All assets gzip | <= 1,900 kB | 1,852 kB | same build |
| Frames (from the polish timing files) | section 2.2 of the budgets page | all ok: 16.7 / 16.8 ms worst median at ratio 1 / 2, 0 over 33.4 ms, tour p95 3.9 / 6.0 ms uncapped, 0 idle frames | 0.63 over 33.4 ms per 1,000, longest 63.3 ms, 0 idle |
| Page errors | 0 | 0 | 0 |

- What loads before the scene is ready: the index chunk (385.8 kB gzip), the shell chunk (67.9 kB), the scene chunk with Mol* and three.js (967.8 kB, requested at 203 ms and received in 68 ms), the colour chunk, two stylesheets, five font files, the wordmark (38.4 kB), the eleven curated records and `2HBS.cif` (248.8 kB, requested at 128 ms). The provider detection calls (`version`, `tags`) come after.
- The low-power start is about 110 ms faster than the default start (560 against 673 ms): no post-processing chain and no procedural textures to build.
- The warm world switch (1,560 ms) sits 40 ms under its budget: 700 ms fade plus Mol*'s camera and the stage's settle; Phase 8 camera work must not add to it, or the budget is revisited with a reason.

## Failures and negative results

- One budget is over at the baseline, as expected: the bytes before the first interaction. The Mol* scene is created at startup (the controller's `attachScene` runs before `ready`, so that the capability list and the diagnostics hook have it) and the structure file is bundled with the curated records, so the first interaction waits for 1.9 MB over the wire. On localhost this costs nothing visible (673 ms to ready); over a network it would. Phase 8 P8.2.2 (asset optimisation) moves the Mol* chunk and the structure file after the ready moment; the budget stays at 1,000 kB.
- The 2HBS fetch budget cannot be measured until the file stops loading at start (n/a in both passes).
- A first harness draft counted the tour's depth-of-field fade (about 11 frames with vsync on, about 90 uncapped) as idle frames and reported 303 and 169 over budget; the fade is by design (0.2 s), so the check now excludes the frames after the tour and reports them separately. The harness also tried puppeteer's `waitUntil: "commit"`, which this puppeteer-core (25.14.0) does not accept; `domcontentloaded` is used, and the ready time is taken from the navigation start in any case.

## Interpretation

Every runtime budget holds on the Phase 7 build with margins of 1.3x to 3x, except the warm world switch (40 ms of margin) and the first-interaction bytes, which the current startup design puts at 1.9x the target. The harness is the Phase 8 regression guard: the gate (P8.5.1) reruns it with fresh frame files on the build of record.

## Decision

Budgets adopted as written in `budgets.json` (P8.1.1 done). The bytes-before-ready breach becomes a Phase 8 task in the Protein World stream (defer Mol* and the structure file past `ready`, idle prefetch, cold switch still within 2,500 ms). Frame files for the gate must be re-measured on the final build (the baseline reused the polish files because the build was the same).

## Artifacts

helix-app `apps/web/e2e/budgets.mjs`, `budgets.json`, `docs/qa-and-performance.md`, `apps/web/e2e/results/budgets-p8-baseline*.json`; public copies with MANIFEST rows in `journal/results/helix-app-e2e/`.
