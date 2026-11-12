# HX-P11-2026-11-12-licence: the licence, attribution and cost audit of the web build, with notices generated from the build

```yaml
id:            HX-P11-2026-11-12-licence
date:          2026-11-12
phase:         P11 (P11.3.3, web part; the desktop part deferred to P11.5.4)
hypothesis:    The web build holds a subset of the lockfile's packages, all under free licences, and its licence texts can be generated deterministically from the build's own module graph into a notices file the page never fetches, so the bytes-at-rest budget pays only for a link to it; every data source's attribution is already on screen; and the project's spend is still $0.
git_commit:    helix-app cae6569 to 97cd609 (pin ab9a7ae, change defe711, docs and results 97cd609); helix-research 62f176f to this entry's commit; research pin a6a8b44 unchanged; by a delegated agent on Opus 5.5
config:        vite build with the notices plugins (HELIX_NOTICES_JSON for the package list), a scratch build to compare assets; budgets.mjs (start, structure, bundle); security.mjs (page checks; --bytes); text-inventory.mjs --run-a11y (S21) and source-map.mjs; nollm.mjs; both replays; shipped-frames.mjs dpr 1, dpr 2, dpr 2 low power judged by budgets.mjs --frames-only
seed:          none
data_version:  the five curated sets at helix-research a6a8b44, unchanged
hardware:      Apple M1 Pro, the development Mac; Chrome 157 headless; Node 22.23.3
duration:      about 3 hours of wall-clock
cost:          0 (no model call, no live API call, no network request for licence texts)
```

## Integrity

No curated data, no helix-research `packages/` file and nothing under `research/benchmark/phase10/` or `phase10-heldout/` was edited; the research pin did not move (`check:pin` exit 0, pinned a6a8b44). The behaviour change was pinned first: `apps/web/test/p11-licence.test.tsx` failed on cae6569 (the generator module and the Evidence World link did not exist; commit ab9a7ae). No licence was chosen or changed, and neither repository's LICENSE was touched. No live API call and no network request was made; R3F's upstream licence file was therefore not fetched (finding P11-LIC-01).

## Method

The plan asks for the notices from the built bundle, not the lockfile. A first scratch build with a probe plugin listed every module of every output chunk (Rolldown's `chunk.modules`) for the page build and the worker build: 1,656 modules. The committed generator, helix-app `apps/web/third-party-notices.ts`, does the same in the real build: two Vite plugins (page and worker; the worker is bundled while the page transforms, so its modules are known before the page's bundle is written) attribute each module to the last `node_modules` package on its path, the three bundler helpers to Vite and Rolldown, and Helix's own code to no package; anything else stops the build. Each package's licence text comes from its own licence file (Vite's without the Node-side dependency list; R3F has none, so its package.json licence and the gap are stated). Comment blocks with a third-party copyright or licence line are copied from the bundled source files, because the minifier drops every comment. Emitted fonts and images are attributed by their source path (any other file stops the build), and the data sources come from the curated manifests copied into the build, each licence id with its URL. The file is written at the build's root as `THIRD-PARTY-NOTICES.txt`; Evidence World's datasets section links to it.

## Measurements

Raw results in helix-app `apps/web/e2e/results/*p11lic*`; the audit is `docs/license-attribution-cost-audit.md` (sections 1 to 10).

**Packages.** 89 in the build (87 runtime packages, plus Vite's preload helper and module-preload polyfill and Rolldown's runtime), against 229 non-development lockfile entries: 86 MIT, 1 ISC (`@ungap/structured-clone`), 1 Apache-2.0 (`rxjs`), 1 0BSD (`tslib`). By chunk: scene 76 packages (Mol* with its markdown and rxjs dependencies), index 9 (React DOM, R3F and its helpers, three, zustand, Vite's module-preload polyfill), preload-helper 4 (React, scheduler, zod, Vite's preload helper), rolldown-runtime 1 (Rolldown), colour 1 (Mol*), the concept prototypes' main chunk 1 (three), the worker 1 (zod). 88 ship a licence file; R3F 9.8.2 ships none, and no other copy exists on the machine (two installed copies and the npm cache hold the same tarball). No server-side package is in the build. `third-party-packages-p11lic.json` holds each licence text's sha256 and size.

**Embedded notices.** 53 comment blocks: Mol* 45 (three.js, gl-matrix, Jam3, chroma.js under BSD, ColorBrewer under Apache-2.0, an IHME shader under BSD 3-Clause in full, Photopea UZIP, Alipay's rc-slider, Math.NET, NGL, netcdfjs, io-buffer, Parsimmon, distinct-colors under ISC, three icon sets licensed by URL, AMD FidelityFX, and `normalizeWheel` from a Stack Overflow answer under CC BY-SA 3.0), R3F 3 (React's reconciler, embedded in its dist, Meta, MIT), three 2, immutable 1, vfile 2 (its browser shims of Node.js `path` and `process`; one block names the MIT and Joyent notices, the other is only a remark). Only three of these blocks survive in the built scripts, inside Mol*'s GLSL shader strings.

**The notices.** 188,350 bytes (17,667 gzip), sha256 f65e0315... ; a scratch build outside the app folder and the served build give the same file byte for byte, and adding the plugins changed none of the 27 files of `assets/` (sha256 compared). Contents: 89 packages with full texts, the 53 blocks, 6 font families (15 files) with each `OFL.txt`, the brand statement, 10 data sources with licence URL, releases, sets and attribution, and a note that no model is included.

| Build | Bytes at rest (3 starts) | All assets gzip | Notices |
|---|---|---|---|
| cae6569 (D-H039 final, b6df6b9 build) | 1,974,186 | 1,981.4 kB | none |
| defe711 (generator and link) | 1,974,419 (+233) | 1,981.7 kB | 188,350 bytes at the build root, not fetched |

The link adds 265 bytes raw and 233 gzip to the index chunk; the scene and main chunks change only in the index chunk's name they import (scene gzip identical). Room at rest: 25,581 bytes under 2,000 kB; all assets gzip: 118.3 kB under 2,100 kB (`budgets.mjs` counts `dist/assets/` only; counting the notices too would give 1,999.4 kB). The 32 resources of every start page do not include the notices. No budget value was changed.

**Data attribution.** In the S21 text inventory (`text-inventory-p11lic.json`, 9,217 texts, 80 screens; 9,215 at p11sci plus the two texts of the link), the attribution string of each of the ten manifest sources appears in Evidence World on every set that has the source (and the narrow page). UniProt and AlphaFold DB name "CC BY 4.0" with no link; ClinVar's says "See the NCBI disclaimer and copyright notice" with no link; both URLs are in the notices' section 5. The source map maps all 9,217 texts (0 without a source, 0 mismatches), including the link's two texts as constants of `phase6.tsx`.

**Fonts and assets.** 15 font files (Geist Sans 3 and Geist Mono 2 fetched at rest; Instrument Sans, Instrument Serif, JetBrains Mono and Sora only for the concept prototypes), each byte-identical to the sha256 in `vendor/fonts/PROVENANCE.md`, all OFL 1.1; the PROVENANCE paragraph said the shipped app loads none of them and was corrected. Images: the wordmark SVG and the 180 px mark (16 and 32 px inlined), the author's brand files, rights to be cleared by the author before any release (answer 98 (a)). No audio, 3D model, texture or icon-font file. Data: 79 files, among them four wwPDB mmCIF files (CC0).

**$0.** 79 journal entries carry a `cost:` field and every one is 0 (66 plain, the others with a reason); none mentions a purchase, invoice or subscription. Toolchain: Node 22.23.3 and npm 10.9.9 in `helix/.tools`, uv 0.13.1, Python 3.12.1, Chrome 157, Firefox 158.0.1 in `helix/.tools/firefox`, Safari 18.3, Rust 1.97.0 in user space; git 2.42.1 (GPL-2.0, `COPYING`) and gh 2.82.1 (MIT, `LICENSE`) read from the installed copies (open item 2 closed). The model ministral-3:8b (Apache-2.0) runs locally and is not bundled. No hosting, domain or Apple membership. One GitHub workflow (CLA Assistant) in the public research repository; its cost is inferred, not checked live.

## Checks

| Check | Exit | Result |
|---|---|---|
| helix-app `npm test` | 0 | 590 passed (580 before; the 10 of `p11-licence.test.tsx`) |
| helix-app `npm run typecheck` | 0 | |
| `npm run check:pin` | 0 | pinned a6a8b44, consumed paths unchanged |
| `npm run web:build` | 0 | `dist/THIRD-PARTY-NOTICES.txt` 188,350 bytes; identical to a scratch build's; the 27 asset files of a build with the plugins and without the link identical to the pre-change build |
| helix-research `npm test`, `npm run typecheck` | 0, 0 | 547 passed, 5 skipped |
| `budgets.mjs --tag=p11lic` (start, structure, bundle) | 0 | bytes at rest 1,974.4 kB, before scene ready 721.5 kB, all assets gzip 1,981.7 kB, scene chunk 969 kB; every row ok |
| `security.mjs --bytes --tag=p11lic-bytes` | 0 | 1,974,419 bytes at rest on each of 3 starts (+233) |
| `security.mjs --tag=p11lic` | 0 | 0 failures (headers, markup, long question, privacy, one zod copy in the page's scripts) |
| S21: `text-inventory.mjs --tag=p11lic --run-a11y` (runs `a11y.mjs --all-sets --texts`) | 0 | 82 screens, 0 axe violations; 9,217 texts |
| `source-map.mjs --tag=p11lic` | 0 | 9,217 of 9,217 mapped, 0 without a source, 0 mismatches |
| `nollm.mjs --tag=p11lic` | 0 | 0 failures, 0 budgets over |
| Phase 10 replay; held-out split replay | 0, 0 | only the allowlisted units differ (P10-CFTR-13, P10-CFTR-19; P10H-BRCA1-08) |
| frames alone: dpr 1, dpr 2, dpr 2 low power, judged by `budgets.mjs --frames-only` | 1 | vsync-on median 17.2 ms (dpr 1) and 16.9 ms (low power) over 16.8; dpr 2 16.8 ms ok; every other frame row ok |
| D-H038 rerun of the two breached files | 0 | 16.8 ms and 16.8 ms: within budget |
| frames A/B, dpr 1, the pre-change build (cae6569) | 1 | 16.9 ms: the build before this pass also misses the budget, so the frame budget has no margin on this machine |

## Interpretation

The hypothesis holds for the web build. The build carries far fewer packages than the lockfile lists, every one under a permissive licence, and the notices can be generated by the build itself at no cost to the page's start: the link costs 233 bytes and the file itself is never fetched. The audit found one real gap that the plan did not name: no build until now carried any licence text, and the notices of code that Mol* took from other projects existed only in comments that the build removes. Every data source is attributed on screen; two licence conditions (the Creative Commons licence link and the NCBI notice) are met through the notices rather than in the cards, which is a reading, not a certainty, and is put to the author. The spend is still zero.

## Failures

The first scratch build failed twice while the generator was written: the worker script is an emitted file of the page build with no source path (now recognised as the observed worker build), and a variable was out of scope. The first notices listed 20 font files instead of 15 (two stylesheets reference the Geist files; deduplicated) and took code such as `(c)` for a copyright mark (narrowed to "(c)" before a year or a name). Section 5 item 4 (ClinVar's own data-use statement) could not be closed without a browser. R3F's upstream copyright line could not be checked without a network request.

The frame files measured alone missed the 16.8 ms vsync-on median on the first run at dpr 1 (17.2 ms) and at low power (16.9 ms); each passed on its D-H038 rerun (16.8 ms, 16.8 ms), and the build from before this pass, served from a scratch folder, measured 16.9 ms on the same dpr 1 check. The breach is the budget's lack of margin on this machine, as at D-H039 (C155), not the link. The pin commit's message (ab9a7ae) names the base as 7272f2b, which is the workspace repository's commit; helix-app's base is cae6569 (corrected in the test docstring in 97cd609).
