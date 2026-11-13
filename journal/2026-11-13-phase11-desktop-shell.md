<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HX-P11-2026-11-13-desktop-shell: the desktop shell (P11.5.1) and its local AI (P11.5.2)

```yaml
id:            HX-P11-2026-11-13-desktop-shell
date:          2026-11-13
phase:         P11 (P11.5.1 desktop shell, P11.5.2 desktop local AI; amendment A-1)
hypothesis:    The unchanged apps/web build runs as a Tauri 2 macOS app in WKWebView with the R3F scene and Mol*
               rendering as in Chrome; the curated HBB journey completes with the network blocked, with no request
               leaving the app other than to the user's Ollama on localhost:11434 when the AI is used; the app's
               existing desktop hook gives the desktop provider set, through which ministral-3:8b turns one question
               into an executed action; with Ollama absent the rules answer and the app states why and how to install
               Ollama and pull the model. Contradicted if any canvas fails to render, if any request other than the
               control reaches the network, if the model path does not execute, or if a web file must change.
git_commit:    helix-app 1e42c49 (apps/desktop), 2af268e (results, review, limitations); helix-research pin e390be0
               unchanged; by a delegated agent on Opus 5.5
config:        apps/desktop: tauri 2.12.5, tauri-build 2.7.4, tauri-plugin-http 2.8.3 (default features off),
               serde_json 1.0.154, base64 0.22.1; @tauri-apps/cli 2.12.4, @tauri-apps/api 2.12.4,
               @tauri-apps/plugin-http 2.8.3; capability core:default + http:default for three URLs of
               http://localhost:11434; CSP = CSP_WEB + "ipc: http://ipc.localhost" in connect-src.
               S26: node apps/desktop/e2e/run.mjs --tag=p1152 (launch x3, offline-hbb, render, ai, ai-absent, scope,
               dynamic-offline); node apps/desktop/e2e/chrome-compare.mjs --tag=p1151
seed:          none (Ollama calls at temperature 0, the provider's defaults)
data_version:  the five curated sets at helix-research e390be0, hash-checked by apps/web prepare-data
hardware:      Apple M1 Pro, 16 GB, macOS 15.3.1 (24D70), WKWebView of that system; Chrome 157 headless for the
               comparison; load average 3.1 to 3.6 during the S26 run (not a quiet machine)
software:      Rust 1.97.0, cargo 1.97.0 (user space), Node 22.23.3, Xcode Command Line Tools; cargo-audit 0.22.2
               (installed into helix/.tools, user space)
duration:      about 2 h 30 min of wall-clock; release build 1 min 46 s from clean, about 1 min 10 s incremental; one
               S26 run about 3 min 20 s
cost:          0 (free crates and npm packages; no paid call; no Apple membership)
llm:
  provider:       the user's local Ollama 0.40.6 (already running; never started, stopped, pulled or deleted)
  model_id:       ministral-3:8b, digest 1922accd5827ebe6829e536369195db25eaf664528dc66206d646ea3bb386b71
  call_date:      2026-11-13
  params:         the app's own (prompt v8, split Director, schema-constrained decoding, temperature 0, num_ctx 8192,
                  num_predict 1024, keep_alive 60m)
  prompts:        the app's buildMessages for the HBB set (prompt v8, unchanged); exact messages reproducible with
                  __helixApp.prompt(query)
  responses:      apps/desktop/e2e/results/desktop-e2e-p1152.json (plans, routes, timings)
  attempt_count:  offline-hbb 1 model call; ai 2 model calls (the second a follow-up turn whose plan the split did not use)
```

## Methods

- **Same code.** `apps/desktop/scripts/build-web.mjs` runs apps/web's `prepare-data` and its own Vite config with `--outDir apps/desktop/web-dist`; the 108 files are byte-identical by name and sha256 to `apps/web/dist`. A `web:build` before and after gave identical sha256 for all files of `apps/web/dist` (bytes at rest unchanged, 1,975,238).
- **Desktop hook.** The shell injects `__HELIX_SHELL__ = { platform: "desktop", fetch }`, which `apps/web/src/main.tsx` already reads. `fetch` (`shell/ollama-fetch.ts`) maps the provider's three URLs on `127.0.0.1:11434` to `localhost:11434` and sends them through the Tauri HTTP plugin; anything else is refused; a failure carries the install and pull guidance.
- **Driving (S26).** Tauri's WebDriver does not support macOS, so an in-app probe (`shell/probe.ts`), injected only with `HELIX_E2E_DIR` and `HELIX_E2E_SCENARIO`, acts as a visitor and writes a report; `e2e/run.mjs` starts one app process per scenario and judges.
- **Network block and count.** Every scenario's webview uses a loopback HTTP proxy served by the runner (Tauri `proxy_url`, WKWebView's data-store proxy) that refuses and logs every request; the app process is sampled with `lsof` every 250 ms; a control request to a CSP-allowed host must fail and appear in the proxy log.
- **Ollama absent.** Simulated by pointing the shell at port 11435, which the capability refuses; the user's Ollama was not touched.
- **Comparison.** The probe's unchanged render scenario in Chrome 157 at 1400 x 792 and pixel ratio 2, on the same build served by `vite preview` on port 5192 (started and stopped by the script); canvases compared pixel by pixel.

## Raw results + uncertainty

Raw: helix-app `apps/desktop/e2e/results/desktop-e2e-p1152.json`, `desktop-chrome-compare-p1151.json`, `cargo-audit-p1151.txt`, `apps/desktop/licences/rust-crates.json`; shots in `docs/reviews/phase-11-desktop-shell/`. One run per scenario, one machine, a loaded one; no timing here is a budget.

| Scenario | Result |
|---|---|
| offline-hbb | five chapters visited in order (DNA, DNA, Protein, Protein, Pathway); Protein World with 2HBS from the bundle; Evidence World 13 cards; the reference question by the rules (VAL B6, D6, F6, H6); "Carry me over from the DNA to the protein." by ministral-3:8b (route explorer-rule, callModel true), executed, 26.9 s, first token 10.2 s. Webview requests other than the control: **0**; proxy log: 1 entry, the control CONNECT rest.ensembl.org:443, which failed. App process remote endpoints: 127.0.0.1:11434 only. Shell requests: 3, all to localhost:11434 (version, tags, chat). |
| render | R3F and Mol* render in WKWebView (WebGL 2, "Apple GPU"); captures 2000 x 1584 (19.1 % non-background) and 1996 x 1580 (32.3 %); three.js 19 geometries, 19 textures, 34 programs; Mol* 79 programs, 1 structure; contexts 1 then 2; spin 181 frames, mean 16.61 ms, p95 18, longest 38 |
| ai | Ollama provider available and active; the transition question by the model, executed in 11.4 s (first token 1.7 s), world Protein; the reference question next, as a follow-up turn, went to the model and its plan was not used ("split policy (follow-up, accepts explorer-only)"), the rules answered |
| ai-absent | rules active; the card's local-model line carries the guidance ("... run "ollama pull ministral-3:8b" in Terminal (about 6 GB). Helix never downloads or bundles a model ..."); six supported-question chips; both questions executed by the rules (5.6 s, 4.9 s); no connection from the app process |
| scope | in-scope Ollama version 200; example.org, /api/pull, port 11435 and the 127.0.0.1 spelling refused by the scope; plugin:fs refused by the ACL; navigation and new window refused and logged; the three Help texts present |
| dynamic-offline | the dynamic-mode error page (resolve, hgnc, network); 4 refused CONNECTs to rest.genenames.org:443 |
| launch | process start to welcome interactive 1,349 ms (first after the build), 480, 492 ms; to DNA World ready 1,521, 632, 643 ms |
| size, signature | `.app` 9,628 kB, binary 9,430,928 bytes; ad-hoc signature, `codesign --verify --deep --strict` exit 0 |
| Chrome comparison | DNA World canvas: mean absolute difference 0.024 of 255, no pixel over 24; Protein World: 0.07 % of pixels differ, all in Mol*'s label glyphs; Chrome spin 180 frames, mean 16.67, longest 16.8 ms; WebGPU exposed in Chrome only |
| supply chain | `cargo audit`: 0 vulnerabilities in 416 entries (advisory database 2026-11-13, 1,509 advisories), 2 warnings on Linux-only crates; every crate released by 2026-10-30 (`log` held at 0.4.34) |
| checks | helix-app `npm test` 0 (626 tests), `npm run typecheck` 0, `npm run check:pin` 0, `npm run web:build` 0; `cargo test` 0 (4), `cargo clippy -D warnings` 0 |

## Failures

- Three scenarios first hung for five minutes with no report, a watchdog timer included: the app window was behind other windows and WebKit paused the page. S26 now keeps its own app window in front. Negative result kept: a hidden desktop window pauses.
- The AI status card was read while the welcome was open (the side panel appears after it closes); one failed S26 run (`ai-absent: AI status card null`) before the probe read it after Skip. That run's result file was not kept; the review names it.
- WebKit lists no resource-timing entries for `tauri://` loads, so the page-side request count is empty on desktop; the proxy log and `lsof` are the counts of record.
- `log` 0.4.35 was 13 days old in the seeded lock; held at 0.4.34.
- The first `cargo install` of cargo-audit failed (zsh expanded `=0.22.2`); quoted.

## Limits / confounders

- One machine and one macOS version; a loaded machine (load about 3); one run per scenario. Frames, memory and start budgets are P11.5.3's.
- The captures are canvas read-backs with `preserveDrawingBuffer` forced by the probe in the render scenario only; the HTML panels are not in them (a window screenshot needs the screen-recording permission, not touched).
- The first launch is the first after a rebuild, with WebKit's caches warm from earlier launches: not a cold boot.
- The model's timing includes a model already loaded or not by earlier calls (keep_alive 60m), so 26.9 s and 11.4 s are not comparable runs.

## Interpretation

Supported. The same web build runs in WKWebView with the R3F scene and Mol* rendering as in Chrome (the one visible difference is the rasterisation of Mol*'s label text); the HBB journey completes offline with no request leaving the app except to the user's Ollama; the desktop provider set lets ministral-3:8b choose an executed action, and without Ollama the rules answer with the stated reason and guidance. No web file changed.

## Decision

Continue to P11.5.3 (desktop QA on a quiet machine) and P11.5.4 (DMG). For the author (helix-app `docs/reviews/phase-11-desktop-shell.md` section 8): dynamic mode kept on desktop through the CSP (recommended keep); external links (recommended a scoped opener in P11.5.3); version 0.0.0 and identifier `local.helix.desktop` until Phase 12; the in-app browsers line after P11.5.3; the capability narrowed to three URLs (recommended: amend plan section 7 item 5).

## Artifacts

- helix-app `apps/desktop/` (README, `src-tauri/`, `shell/`, `e2e/run.mjs`, `e2e/chrome-compare.mjs`, `licences/rust-crates.json`)
- helix-app `apps/desktop/e2e/results/desktop-e2e-p1152.json`, `desktop-chrome-compare-p1151.json`, `cargo-audit-p1151.txt`
- helix-app `docs/reviews/phase-11-desktop-shell.md` and `docs/reviews/phase-11-desktop-shell/` (5 JPEG shots)
- helix-app `docs/known-limitations.md` section 2.13
