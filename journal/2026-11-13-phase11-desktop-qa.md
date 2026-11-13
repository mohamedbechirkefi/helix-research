<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HX-P11-2026-11-13-desktop-qa: desktop QA (P11.5.3), the DMG (P11.5.4), and the desktop parts of P11.3.2 and P11.3.3

```yaml
id:            HX-P11-2026-11-13-desktop-qa
date:          2026-11-13
phase:         P11 (P11.5.3 desktop QA, P11.5.4 DMG packaging; desktop parts of P11.3.2 and P11.3.3; D-H046)
hypothesis:    (1) A scoped opener can send links to the data sources the app cites to the system browser while the
               webview keeps no opener permission and every other URL is refused. (2) In WKWebView the app meets the
               web's 3.1 frame values and has start and memory figures that can carry a desktop budget. (3) The CSP,
               the capability allowlist and the navigation guard hold in the running app. (4) An ad-hoc signed DMG
               with the licence, both notices and an install note passes codesign and hdiutil verify, and Gatekeeper's
               verdict on a quarantined copy can be read without changing a setting. (5) Every Rust crate can carry a
               licence text. Contradicted by: a refused URL reaching the browser or a cited one not; a frame value over
               the web's; a CSP probe that runs or reaches the network; a failing S27 command; a crate left without a
               text.
git_commit:    helix-app 231cb26 (pin), 1a31b52 (opener), 6bd423a and 92db4d9 (harness), 3f0053d (licences),
               40efa8c (pin), 76762fe (browsers line), 617f710 (packaging, results), 26a5d70 (review, limitations);
               research pin e390be0 unchanged; by a delegated agent on Opus 5.5
config:        apps/desktop: tauri 2.12.5, tauri-plugin-http 2.8.3, tauri-plugin-opener 2.7.2 (default features off;
               open_url called from Rust, plugin not registered); opener-origins.json (10 origins); capability
               unchanged (core:default + 3 Ollama URLs). Measurements: node e2e/run.mjs --tag=p1153-measure
               --only=launch,frames,memory (3 launches; 3 frame pages default and 3 low power, each with its D-H038
               rerun; 3 memory runs); diagnostic --tag=p1153-framewarm --frame-warm=1; S26 --tag=p1153; chrome-compare
               --tag=p1153; web: shipped-frames.mjs --dpr=2 --vsync=on --repeats=3 (p1153-web-dpr2 and -rerun),
               budgets.mjs --tag=p1153, text-inventory/source-map/layout --axe=1/nollm (p1153), security.mjs --bytes
seed:          none (deterministic page scenarios; Ollama at temperature 0 in S26's ai scenarios)
data_version:  the five curated sets at helix-research e390be0, hash-checked by apps/web prepare-data
hardware:      Apple M1 Pro, 16 GB, macOS 15.3.1 (24D70), built-in Retina display (devicePixelRatio 2); WKWebView of that
               system; Chrome 157.0.8103.52 headless for the web runs
load:          one-minute load average 1.5 to 4.8 across the session (each app run records start and end values in its
               result file); measure run 2.0 to 4.6 for the frame pages; web frame runs 2.5 to 1.5; not a quiet machine
software:      Rust 1.97.0, cargo-audit 0.22.2, Node 22.23.3, Xcode Command Line Tools; macOS hdiutil, codesign, spctl,
               syspolicy_check
duration:      about 1 h 25 min of wall-clock (17:38 to 19:05 CET); a release build about 1 min 30 s; the measure run
               9 min; S26 about 5 min
cost:          0 (free crates; free GETs of crates.io metadata and public licence files; no Apple ID, no notarisation,
               no paid tool)
llm:
  provider:       the user's local Ollama 0.40.6 (running; never started, stopped, pulled or deleted)
  model_id:       ministral-3:8b, digest 1922accd5827ebe6829e536369195db25eaf664528dc66206d646ea3bb386b71
  call_date:      2026-11-13
  params:         the app's own (prompt v8, split Director, temperature 0)
  prompts:        the app's buildMessages for the HBB set, unchanged (reproducible with __helixApp.prompt(query))
  responses:      helix-app apps/desktop/e2e/results/desktop-e2e-p1153.json (plans, routes, timings)
  attempt_count:  S26 final run: offline-hbb 1 model call, ai 2 model calls; development runs made none
```

## Methods

- **Opener.** Pin first (231cb26: `new_window_action` with the old behaviour, two Rust tests failing), then the change. The origin list is derived by a unit test from the provenance URLs of every curated record, the four dynamic-mode APIs and Reactome's pathway page. Under S26 the hand-off records the URL instead of opening the browser; the user's browser was never opened.
- **Frames.** One page of `shipped-frames.mjs` per app launch in the webview (the page's own pointer and wheel events), vsync on, pixel ratio 2, 3 pages per set, default and low power; judged with `apps/web/e2e/budgets.json`; a breached worst-move median gets one automatic rerun of the same pages (D-H038). Nothing else from this task ran during a frame or memory measurement. The same day, Chrome at dpr 2 (3 pages) with one rerun on its breach.
- **Start.** Process spawn to the welcome's Explore enabled; "cold" is the first launch after a build (no `purge`, which needs sudo).
- **Memory.** `ps` RSS of the app plus the WebKit processes that appeared after its spawn and were gone after its exit, at markers the probe writes (rest, after the cold load, after 6 round trips).
- **Security.** S26 `scope` (as P11.5.1), `opener` and the new `csp` scenario under the refusing loopback proxy; `cargo audit`.
- **DMG.** `npm run dmg` (hdiutil UDZO); `codesign --verify --deep --strict`; `hdiutil verify`; a copy given a browser's quarantine attribute with `xattr -w`, then `spctl --assess` and `syspolicy_check`. No account created, no setting changed, no app opened under quarantine.
- **Licences.** For each crate without a licence file, its publishing commit from `.cargo_vcs_info.json` and one GET of the upstream file; SPDX's texts where the repository has none.
- **Browsers line.** Pin (40efa8c) then change (76762fe); the web suites on that build.

## Raw results + uncertainty

Raw: helix-app `apps/desktop/e2e/results/desktop-e2e-p1153-measure.json`, `desktop-e2e-p1153.json`, `desktop-e2e-p1153-framewarm.json`, `desktop-e2e-p1153-dev1.json` to `-dev4.json`, `desktop-chrome-compare-p1153.json`, `cargo-audit-p1153.txt`; `apps/web/e2e/results/shipped-frames-p1153-web-dpr2-dpr2.json`, `-rerun-dpr2.json`, `budgets-p1153.json`, `security-bytes-p1153-bytes-none.json`, `text-inventory-p1153.json`, `source-map-p1153.json`, `layout-p1153.json`, `nollm-p1153.json`. Three pages or runs per measurement on one loaded machine; no interval is computed; per-page values are in the files.

| Measure | Desktop (WKWebView) | Web (Chrome, same day) |
|---|---|---|
| Worst-move median, default, run / rerun | 17 / 17 ms (means 16.7 to 17.1) | 16.8 / 16.8 ms |
| Frames over 33.4 ms, 3 pages, default | 8 / 10, all the first frame of a move (36 to 64 ms) | 2 / 0 |
| Low power: median; over 33.4 per 1,000; longest | 17 ms; 0.85, 0.85; 46, 47 ms | not run today |
| Idle frames counted | 71 / 75 default, 56 / 64 low power, all in the first 0.3 to 0.46 s of the rest window; 0 after moves (tour fade apart) and in Protein World | 0 / 0 |
| Diagnostic, rAF loop kept running | tour's first frame still 35 to 62 ms on 6 of 6 pages; codon's on 3 of 6 | |
| Spawn to welcome interactive | cold 855 and 1,157 ms; warm 460 to 471 ms | page load to welcome 196 ms (desktop page-relative 192 to 199) |
| RSS after 6 round trips | 453.9 MB median (446.9 to 472.8) | Chrome tree 999 MB |
| World switches cold / warm / to DNA | 1,242 / 743 / 722 ms | 1,073 / 747 / 742 ms |
| .app / DMG | 10,524 kB / 6,617,097 bytes | |

Opener: 3 URLs handed over, 4 refused, opener command refused by the ACL, notices window opened. CSP: 6 of 6 probes refused with reports, 0 proxy entries. S26: 11 app runs, 0 failures. DMG sha256 `4f7d6cbad3561e254274685fd4a70fa7bb0e94fba05671ca34e5e674d63d80b8`; codesign exit 0 (app and app in the image); hdiutil verify exit 0; quarantined copy: `spctl` rejected (open, install, execute; exit 3), `syspolicy_check distribution` "Notary Ticket Missing" (exit 70). cargo audit: 0 vulnerabilities in 457 entries, 5 Linux-only warnings. Rust crates: 276 (262 linked), 15 vendored texts, 5 MPL-2.0. Web bytes at rest 1,975,238 to 1,975,311 (+73).

## Failures

- The first opener run failed (dev1): the link click arrived as a navigation and was refused; navigation requests to a cited source now go to the opener. WebKit's CONNECT to the clicked host is kept as an observation.
- The desktop frame values breach the web's on both runs of both sets (D-H038 rerun done; not rerun until it passes). The median breach is the 1 ms clock; the long first frames and the frames after start are real.
- The web's first same-day frame run breached its own long-frame rule (2 frames over 33.4 ms); its rerun passed.
- S27's fresh-account launch was not run (no account may be created by the agent).
- clippy (`iter().any`), a zsh variable named `path`, and three too-new crates were fixed on the way.

## Limits / confounders

One Mac, loaded (load 2 to 4.6 during the frame pages); three pages per set; the desktop drives moves with the page's own events, the web with puppeteer's; "cold" launch is not a cold file cache; the frames after start are not attributed; the quarantine propagation that Finder applies when a user opens a quarantined image was not reproduced by the command-line mount; the hand-off to the browser and the Gatekeeper dialog were not exercised.

## Coordinator verification

On helix-app 26a5d70 and helix-research 88fa4d2 (tag v50) the coordinator reran, each read by its exit code: every web suite; the frame files alone (dpr 1 and dpr 2 first runs 17 ms, reruns 16.7 ms; low power 16.7 ms), within the web budget after the D-H038 rerun; the unit tests (630 in helix-app, 564 in helix-research); `cargo test` and `cargo clippy`; the desktop build; S26 (`node e2e/run.mjs`, 0 failures); `chrome-compare.mjs`. All exited 0. The one-minute load average was 3.4 to 4.7. The coordinator removed its own result files by exact name.

## D-H047 and the desktop judgement

**The decision (author, 2026-11-13).** (1) Desktop frame rule (b): worst-move median at most 17 ms on WebKit's whole-millisecond clock, mean reported; frames over 33.4 ms allowed only as the first frame of a move, each at most 70 ms; 0 idle frames after moves and in Protein World; the extra drawing in the first part of the rest window after start is reported, not judged, and is a Phase 12 item with the tour's long first frame; one automatic rerun on a breach (D-H038). (2) Cold launch 2,500 ms, warm launch 1,200 ms, resident memory 800 MB after the 6 round trips with at most 10 % growth, world switches at the web values, `.app` 15 MB, DMG 10 MB. (3) P11-SEC-14 accepted as a limitation. (4) S27's fresh-account launch not run; it and the real hand-off of a link to the browser are untested limitations; S27 reduced to what was automated, the plan's S27 row amended.

**Encoding.** helix-app 89d7595 (pin: the judge moved unchanged from `apps/desktop/e2e/run.mjs` to `e2e/desktop-budgets.ts`, same verdicts on `desktop-e2e-p1153-measure.json`; 12 tests stating D-H047, all failing), 85c1088 (change: `apps/web/e2e/budgets.json` `desktop` section; the judge; `run.mjs` prints the rule, judges launch when named, frames, memory and a new `size` measurement, reruns a breached frame set once, exits 1 on any breach; 642 tests pass), 0c606f6 (results and documents). Implementer's choices, stated in helix-app `docs/reviews/phase-11-desktop-qa.md` section 11: low power keeps the web's per-1,000 and longest-frame rows with the 17 ms median and the idle rule (the plan says only "the same values"); "first frame" is interval index 0 of the `performance.now` intervals; warm launch is the median of the later launches; memory, growth and switches are medians of the runs; sizes in MB of 2^20 bytes, and a missing DMG or one older than the app fails; any breached frame row (not only the median) triggers the rerun.

**The run.** `npm run build` and `npm run dmg` (both exit 0), then `node e2e/run.mjs --tag=dh047-measure --only=launch,frames,memory,size`, nothing else from this task running, 20:17 to 20:22 CET. One-minute load average 4.48 at the start (just after the build), 2.2 to 2.9 during the frame pages, 2.28 at the end. **Exit 0; every row within budget; no rerun was triggered.**

| Row | Measured | Budget |
|---|---|---|
| Cold launch (first after the build) | 822 ms | 2,500 ms |
| Warm launch (median of 2) | 458 ms | 1,200 ms |
| Default frames: worst-move median (worst mean) | 17 ms (17.08 ms) | 17 ms |
| Default frames: over 33.4 ms not a move's first; longest first frame | 0 (10 long frames, all at index 0, 35 to 67 ms); 67 ms (tour) | 0; 70 ms |
| Low power: median; per 1,000; longest | 17 ms; 0.85; 44 ms | 17 ms; 1; 70 ms |
| Idle frames after moves and in Protein World (both sets) | 0 | 0 |
| Idle frames at rest, reported | 73 default, 63 low power; drawing ends 309 to 465 ms into the rest window | not judged |
| RSS after 6 round trips (median of 3); growth | 470.4 MB (444.6 to 480.0); -0.1 % (-3.6 to +3.1) | 800 MB; 10 % |
| Switches cold / warm / to DNA (medians) | 1,240 / 730 / 722 ms | 2,500 / 1,600 / 1,600 ms |
| `.app`; DMG | 10.28 MB (10,524 kB); 6.31 MB (6,617,111 bytes, sha256 b51dfda8fe8e88a820e7b6eae0f36d322aa23514f2cbd4a3a66da4fcbe9c2ef8) | 15 MB; 10 MB |

The tour's first frame came within 3 ms of its 70 ms ceiling. S26 after the runner change: `node e2e/run.mjs --tag=dh047` exit 0, 11 app runs, 0 failures (load 2.1 to 6.0, the model scenarios raising it). Raw: helix-app `apps/desktop/e2e/results/desktop-e2e-dh047-measure.json`, `desktop-e2e-dh047.json`. Three pages or runs per set on one machine that was not quiet; no interval computed. One run is a pass on the rule as agreed, not evidence that the margin of the first frame holds on another machine or under more load.

## Interpretation

(1) Supported. (2) Contradicted for frames as written: the webview holds the display's rate, but the 16.8 ms median is not measurable on WebKit's clock and a camera move's first frame is long; start and memory are within proposed desktop budgets. (3) Supported. (4) Supported for the two commands; Gatekeeper rejects a quarantined copy for lack of notarisation, as expected for an ad-hoc signature. (5) Supported.

## Decision

Continue to the gate. Proposed desktop budgets go to the author (helix-app `docs/reviews/phase-11-desktop-qa.md` sections 3.5 and 10): recommended a desktop reading of the frame bar (median <= 17 ms on the 1 ms clock, long frames only as a move's first frame, each <= 70 ms), cold launch 2,500 ms, warm 1,200 ms, memory 800 MB with 10 % growth, `.app` 15 MB, DMG 10 MB; the fresh-account launch with its screenshot is the author's.

## Artifacts

- helix-app `docs/reviews/phase-11-desktop-qa.md`; `docs/known-limitations.md` 2.13; `docs/security-review.md` section 5; `docs/reviews/phase-11-licence-audit.md`
- helix-app `apps/desktop/` (`src-tauri/opener-origins.json`, `src/lib.rs`, `shell/probe.ts`, `e2e/run.mjs`, `scripts/dmg.mjs`, `scripts/rust-notices.mjs`, `licences/vendor/`, `licences/rust-crates.json`) and the result files listed above
- the DMG: helix-app `dist/Helix-0.0.0-arm64.dmg` (git-ignored, not committed, not distributed)
- helix-research `docs/license-attribution-cost-audit.md` section 10; `paper/report.en.md` 9.8 and 10; `paper/claims.md` C180 to C185
- D-H047: helix-app `apps/desktop/e2e/desktop-budgets.ts`, `apps/desktop/test/desktop-budgets.test.ts`, `apps/web/e2e/budgets.json` (`desktop`), `apps/desktop/e2e/results/desktop-e2e-dh047-measure.json` and `desktop-e2e-dh047.json`; `docs/reviews/phase-11-desktop-qa.md` section 11; helix-research `docs/phase-11-release-qa.md` Desktop rows and S27; `paper/claims.md` C186
