<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HX-P1-2026-11-01-tauri-shell: Tauri 2 macOS shell around the unchanged Mol* page

Retrospective entry written 2026-11-01 from the recorded evidence; not contemporaneous.

```yaml
id:            HX-P1-2026-11-01-tauri-shell
date:          2026-11-01
hypothesis:    The unchanged web build from HX-P1-2026-11-01-molstar-embed runs inside a Tauri 2
               macOS app (WKWebView) with WebGL2, live data access under a strict CSP, and access to
               a local Ollama server, built with free user-space tools only. Contradicted if Mol*
               fails to render, if the CSP blocks it, or if a paid tool is required.
git_commit:    19b31ba
config:        research/experiments/tauri-shell/ (tauri.conf.json CSP; capabilities/default.json
               allow-list http://localhost:11434/*); Ollama call: format = JSON schema,
               temperature 0, seed 7
seeds:         Ollama seed 7; one call per route
data_version:  2HBS.cif bundled as data/2HBS.cif (revision 1.5)
hardware:      Apple M1 Pro, macOS 15.3.1, WKWebView
duration:      first release build 2 min 19 s; incremental rebuild 1 min 13 s; experiment
               wall-clock otherwise not recorded
cost:          0 (no Apple Developer account; ad hoc signature)
software:      tauri 2.12.4, @tauri-apps/cli 2.12.3, tauri-plugin-http 2.8.3, Rust 1.97.0
llm:
  provider:       local Ollama server, version 0.9.6
  model_id:       llama3.1 (tag as installed; digest not recorded)
  call_date:      2026-11-01
  params:         format = JSON schema, temperature 0, seed 7
  prompts:        not recorded in a versioned file (the README states only that the prompt
                  gave no structure hint)
  responses:      results/run1-cold-webview-report.json, results/run2-warm-webview-report.json
  attempt_count:  not recorded per route; at least one call per route (3 routes)
```

## Methods

- The window loads the P1.4.1 build at `tauri://localhost`, with a probe script injected through `initialization_script`. The page itself has no Tauri import.
- Two runs: a cold first launch and a warm launch.
- Three routes to Ollama: webview `fetch`, the scoped HTTP plugin, and a custom Rust command. One request outside the HTTP scope was sent as a control.

## Raw results + uncertainty

From `research/experiments/tauri-shell/README.md` and `results/run*-webview-report.json`:

- **Mol* renders 2HBS** in WKWebView. The read-back gives selection = focus = `VAL H6`.
- **WebGL2:** yes (renderer `Apple GPU`, max texture 16384). **WebGPU:** no; `navigator.gpu` is undefined. Chrome 156 on the same machine exposes an adapter.
- **Timings:**

  | Run | Plugin init | Load to first draw | Action to draw |
  |---|---|---|---|
  | warm | 231 ms | 256 ms | 321 ms |
  | cold | 113 ms | 2,740 ms | 2,276 ms |

- **Frames while spinning:** p50 17 ms, p95 18 ms; 2 of about 290 frames over 20 ms.
- **Sizes:** `.app` 8.4 MB, `.dmg` 4.5 MB, `target/` 1.1 GB.
- **Signature:** ad hoc, valid under `codesign --verify --deep --strict`. Gatekeeper (`spctl`): rejected, as expected without notarisation.
- **Ollama:**
  - Webview `fetch`: 13.1 s cold (model load), 5.2 s warm.
  - HTTP plugin: 5.0 s.
  - Rust command: 5.0 s.
  - Out-of-scope URL: refused in 2 ms.
  - From an arbitrary web origin, the Ollama preflight got 403.
- Uncertainty: one run per condition. The cold numbers are a first-launch effect and are not analysed further.

## Failures

- **Negative result: the model's plan was schema-valid but scientifically wrong.** Asked without a structure hint, llama3.1 requested PDB `1BZO` instead of 2HBS. This is the failure the master prompt (§7.2) anticipates. Model plans are untrusted, and the deterministic interpreter must reject or correct them.
- **Negative result: no WebGPU in WKWebView** on macOS 15.3.1. In-browser models on the WebGPU backend are therefore unavailable in this shell on this OS version.
- **Supply-chain hygiene lapse:** during this experiment, an agent once sent an email address in a crates.io User-Agent (`helix/PROGRESS.md`, section B). The rule since then is no email in any request.

## Limits / confounders

- Quarantine behaviour for a downloaded copy was not tested.
- arm64 only; a universal build was not tried.
- A single Ollama prompt; a single model.
- Ollama's CORS default depends on the Ollama version and on the user's `OLLAMA_ORIGINS`.

## Interpretation

Supported. The same web code runs in a Tauri shell under a strict CSP, with live data and local AI, using free tools. Local AI is a desktop-only path, since a web origin cannot reach a visitor's Ollama by default.

## Decision

**Continue** with amendment A-1. The desktop build talks to Ollama through the Rust command or the one-URL HTTP scope, not through Ollama's CORS default. Every model plan is validated before execution.

## Artifacts

- `research/experiments/tauri-shell/README.md`
- `results/run1-cold-webview-report.json`, `results/run2-warm-webview-report.json`
- `screenshots/wkwebview-molstar-2hbs.jpg`
- `docs/rendering-integration-decisions.md` §5
