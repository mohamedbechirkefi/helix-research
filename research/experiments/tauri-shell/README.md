<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# P1.5.2: Tauri 2 shell around the P1.4.1 Mol* page

**Status:** done, 2026-11-01. Experiment for amendment A-1, not the product's desktop app (P11.5.1).

## Design

- The window loads the **unchanged** P1.4.1 build (`frontendDist: ../../molstar-embed/dist`, served at `tauri://localhost`). The mmCIF is bundled as `data/2HBS.cif`.
- The Tauri-specific glue lives in `src/shell.ts`. It is built to one IIFE (`dist-shell/shell.js`), which Rust injects with `WebviewWindowBuilder::initialization_script`. The page itself has no Tauri import.
- Rust (`src-tauri/src/lib.rs`) has three commands:
  - `save_file` writes the report and screenshot into `$HELIX_REPORT_DIR`. It accepts a bare file name only.
  - `ollama_chat` POSTs to `http://localhost:11434/api/chat` with the reqwest that `tauri-plugin-http` re-exports.
  - `done` quits the app when `HELIX_AUTOQUIT=1`.
- Capability (`src-tauri/capabilities/default.json`): `core:default` plus `http:default` with an allow-list of `http://localhost:11434/*` only.
- CSP (`tauri.conf.json`): `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; worker-src 'self' blob:; connect-src 'self' ipc: http://ipc.localhost http://localhost:11434 https://files.rcsb.org`. Mol* ran under it with no CSP error. `style-src 'unsafe-inline'` is needed because the React and Mol* UI use inline styles.

## Toolchain (all user space, free)

- Rust 1.97.0 and cargo were already installed in `~/.cargo`. The Xcode Command Line Tools were already present; full Xcode is not needed.
- `@tauri-apps/cli` 2.12.3 from npm (a prebuilt binary, no global install). Crates: `tauri` 2.12.4, `tauri-build` 2.7.3, `tauri-plugin-http` 2.8.3, `serde_json` 1.0.154, `base64` 0.22.1. JS: `@tauri-apps/api` 2.12.4, `@tauri-apps/plugin-http` 2.8.3, vite 8.3.4.
- Nothing needed sudo, Homebrew or payment.

## Build

```sh
export PATH=<helix-workspace>/.tools/node/bin:$HOME/.cargo/bin:$PATH
npm ci
npm run build          # builds ../molstar-embed, the shell script, then `tauri build --bundles app`
CI=true npx --prefix . tauri build --bundles dmg   # optional DMG; CI=true skips the Finder layout AppleScript
HELIX_REPORT_DIR=$PWD/results/run HELIX_AUTOQUIT=1 "src-tauri/target/release/bundle/macos/Helix Shell Experiment.app/Contents/MacOS/helix-tauri-shell"
```

| Measure | Value |
|---|---|
| First release build (clean, about 300 crates) | 2 min 19 s wall |
| Incremental rebuild after a shell.ts change | 1 min 13 s (release, LTO) |
| `target/` directory | 1.1 GB (git-ignored) |
| `.app` | 8.4 MB (one arm64 Mach-O of 8.7 MB, which embeds the 4.8 MB web build compressed) |
| `.dmg` | 4.5 MB |
| Signature | `codesign -dv`: `Signature=adhoc`, `flags=0x10002(adhoc,runtime)`, `TeamIdentifier=not set`; `codesign --verify --deep --strict`: valid |
| Gatekeeper | `spctl -a -vv`: **rejected** (expected without a Developer ID and notarisation) |

Limits:

- The build is ad hoc signed and not notarised.
- A downloaded copy will be quarantined. On macOS 15 the user must allow it in System Settings > Privacy & Security ("Open Anyway"), or remove the quarantine attribute. This is from Apple's documented behaviour as we understand it; it was **not tested** with a downloaded copy.
- Notarisation needs a paid Apple Developer account, which is the author's decision (zero-spend rule).
- The build is arm64 only. A universal build needs `--target universal-apple-darwin` and the x86_64 Rust target (not tried).

## Results in WKWebView (macOS 15.3.1, M1 Pro)

Raw reports: `results/run1-cold-webview-report.json` (first launch after build) and `results/run2-warm-webview-report.json`. Screenshot: `screenshots/wkwebview-molstar-2hbs.jpg`. It was captured **inside** the webview with `plugin.helpers.viewportScreenshot.getImageDataUri()`, then compressed to JPEG.

- **Mol* renders 2HBS:** yes. The read-back gives selection = focus = `VAL H6` (label = auth, entity 2), the same as in Chrome.
- **WebGL2:** yes. Renderer `Apple GPU`, vendor `Apple Inc.`, `WebGL 2.0`, max texture 16384; `canvas3d.webgl.isWebGL2` true.
- **WebGPU:** **no.** `navigator.gpu` is `undefined` in WKWebView on macOS 15.3.1, while Chrome 156 on the same machine exposes an adapter (`apple`, `metal-3`, `shader-f16`). Consequences:
  - WebLLM, and Transformers.js on the WebGPU backend, are not available in this shell on this OS version.
  - Inference, unverified: a newer macOS or Safari may enable WebGPU in WKWebView. Re-test on the release target.
- **Timings:**

  | Run | Plugin init | Load to first draw | Action to draw |
  |---|---|---|---|
  | warm | 231 ms | 256 ms | 321 ms |
  | cold first launch | 113 ms | 2,740 ms | 2,276 ms |

  The cold numbers are a first-launch effect (WebKit process and caches) and are not explained in detail.
- **Frame interval while spinning:** p50 17 ms, p95 18 ms, 2 of about 290 frames over 20 ms. The display is capped at 60 Hz, and WebKit reports `performance.now()` at 1 ms resolution.
- **Network from `tauri://localhost`:** a plain GET to `https://files.rcsb.org/header/2HBS.cif` returned 200, so live data access works under the CSP above.

### Local Ollama (server 0.9.6, model llama3.1, one structured-output call)

All three routes worked. The request used `format` = a JSON schema, `temperature 0` and `seed 7`.

| Route | Result | Wall time |
|---|---|---|
| Webview `fetch` straight to `http://localhost:11434` | OK. Ollama's default CORS allows `tauri://localhost`: the preflight answered `Access-Control-Allow-Origin: tauri://localhost` (checked with curl). An arbitrary web origin (`https://helix.example`) got **403**. | 13.1 s cold (model load), 5.2 s warm |
| `tauri-plugin-http` `fetch` (Rust side, scoped) | OK | 5.0 s |
| Custom Rust command `ollama_chat` | OK | 5.0 s |
| `tauri-plugin-http` to `https://example.org/` (outside the scope) | refused: "url not allowed on the configured scope" | 2 ms |

The model returned schema-valid JSON, but it was **scientifically wrong**: it asked to load PDB `1BZO` instead of 2HBS. This is the case §7.2 anticipates. The plan is untrusted, and the deterministic interpreter must reject or correct it. The prompt deliberately gave no structure hint.

**Recommendation for the desktop build:** use the **Rust command**, or the HTTP plugin with a one-URL scope. Do not rely on Ollama's CORS default:

- The CORS default depends on the Ollama version and the user's `OLLAMA_ORIGINS`.
- The Rust route keeps the URL and the model choice out of the webview.
- It lets the shell add timeouts and cancellation.

A web visitor's browser cannot reach their own Ollama by default (403 above), which confirms §8: local AI is a desktop-only path.
