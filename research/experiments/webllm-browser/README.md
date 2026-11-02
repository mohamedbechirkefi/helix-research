<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# P3.2.2: WebLLM in the browser, with Mol* running

**Status:** experiment, 2026-11-01. Not product code.

## Run

```sh
export PATH=<helix-workspace>/.tools/node/bin:$PATH
npm ci
npx vite build && npx vite preview --port 5182 --strictPort &        # this page
(cd ../molstar-embed && npm run build && npx vite preview --port 5181 --strictPort &)   # Mol* page (P1.4.1)
node scripts/measure.mjs --model Qwen3.5-2B-q4f16_1-MLC --load-only  # cold: fresh profile, downloads the weights
node scripts/measure.mjs --model Qwen3.5-2B-q4f16_1-MLC --warm       # warm: cached weights; frames, generation, memory
```

Pinned: `@mlc-ai/web-llm` 0.2.86 (published 2026-10-11, Apache-2.0), vite 8.3.4, puppeteer-core 25.14.0, installed with `npm install --before=2026-10-18`. The driver uses the system Google Chrome 156 (headless, `--use-angle=metal`); nothing is downloaded for the browser. The Chrome profile (and so the model cache) lives in `helix/.tools/chrome-webllm-profile`, outside the repository; model weights are never committed.

## What the driver does

1. Reads the WebGPU adapter (`navigator.gpu.requestAdapter()`).
2. Embeds the P1.4.1 Mol* page (2HBS, imperative mode, local file) in an iframe, starts a trackball spin, and samples `requestAnimationFrame` intervals inside the iframe in four phases: baseline (no model), during model load, model resident and idle, and during generation.
3. Loads the model with `CreateMLCEngine` on the page's main thread (`--worker` uses `CreateWebWorkerMLCEngine` instead). Cold = a fresh profile, so the time includes the download on this network; warm = weights already in Cache Storage.
4. Download size = the bytes stored in Cache Storage after load.
5. Generates plans for a 10-item benchmark subset (S01, S09, S11, S14, F01, U01, U03, A01, I01, FR01) at temperature 0 with `response_format: { type: "json_object", schema }`, the same prompt and plan schema as the Ollama runs (`@helix/ai-planning`), `extra_body: { enable_thinking: false }` for Qwen models, `max_tokens` 700. Each output is scored with the same scorer.
6. Samples the resident memory of the Chrome process tree every 500 ms.

## Results (measured 2026-11-01, Apple M1 Pro, 16 GB, macOS 15.3.1, Chrome 156 headless)

Raw files: `results/measure-*.json` (one per run) and `results/raw-*.jsonl` (each generation with its usage and score); `results/rescored-*.json` (scores after the think-block strip).

### WebGPU and download

| Item | Value |
|---|---|
| WebGPU in Chrome 156 headless | **Yes**: adapter vendor `apple`, architecture `metal-3`, `shader-f16`, maxBufferSize 4 GiB |
| WebGPU in the Tauri shell (WKWebView, macOS 15.3.1) | **No** (P1.5.2), so this provider is web-only |
| Model | `Qwen3.5-2B-q4f16_1-MLC` (WebLLM's estimate `vram_required_MB` 2245, context window 4096) |
| Download (Cache Storage after load) | **1,079,474,163 bytes**: weights 1,072,295,654 (31 shards; the manifest lists 1,059 MB of tensors), WASM library 7,176,151, config 2,358 |
| Cold load on this network | Not a clean number. The first attempt hit the 30 min Puppeteer protocol timeout with 204 MB cached; the resumed load finished after 2,697 s. About **75 min in total for 1.08 GB**, entirely bound by this session's link (0.2 to 1 MB/s). On a fast link the download dominates in the same way; it must be opt-in with the size stated first |
| Warm load (weights cached) | **1,988 ms** to a ready engine (including 1 s of shader compilation) |

### Generation (10-item subset, temperature 0, schema-constrained)

| Measure | Value |
|---|---|
| Time to first token p50 / p95 | 9.0 s / 30.7 s (prefill of about 2,100 tokens at about 235 tokens/s; the first call took 30.7 s) |
| Total p50 / p95 | 24.9 s / 56.9 s |
| Decode | 16.1 to 17.0 tokens/s (p50 16.7) |
| Schema-valid as returned | **0/10**: every output starts with `<think>\n\n</think>\n\n` (the Qwen template's empty think block, emitted as content even with `enable_thinking: false`), so none parses |
| After stripping a leading think block (now done by `WebLLMProvider`) | **10/10 schema-valid, 8/10 fully valid, 4/10 correct and valid, 0 groundedness violations** |
| Correct (after strip) | S11 load 2HBS, U01 clinical refusal, U03 CFTR unsupported, A01 clarify |
| Wrong (after strip) | S01, F01, I01, FR01 answered `clarify` instead of a plan; S09 `clarify` with an action (consistency error); S14 used `enterWorld pathway` (unavailable world) |
| `maxLength` | Not enforced by the constrained decoder: S01's reason lists "B32, B33, B34, ..." until the token budget, as with Ollama |

### Interference with a running Mol* scene (frame intervals in the Mol* iframe, vsync on)

| Phase | Frames | p50 ms | p95 ms | p99 ms | max ms | > 20 ms | > 50 ms |
|---|---|---|---|---|---|---|---|
| Baseline, no model | 357 | 16.7 | 16.7 | 16.8 | 16.8 | 0 | 0 |
| During warm load | 69 | 16.7 | 16.8 | 799.9 | 799.9 | 1 | 1 |
| Model resident, idle | 237 | 16.7 | 16.8 | 16.8 | 16.8 | 0 | 0 |
| During 10 generations | 15,919 | 16.7 | 16.7 | 16.8 | **28,698.8** | 18 | 3 |

Main-thread engine: one **28.7 s freeze** of the Mol* scene during generation and one 0.8 s frame during load; outside those, frames stay at the 60 Hz cap. The freeze coincides with the first prefill (first token at 30.7 s).

### Memory (Chrome process tree, RSS)

| Phase | Peak MiB |
|---|---|
| Page and Mol* | 1,317 |
| Load | 2,639 |
| Resident idle | 2,222 |
| Generation | 2,860 |

RSS does not include all GPU memory on Apple unified memory, so these are lower bounds for the model's footprint.

### Other observations

- The page logged `ReferenceError: Cannot access 'n' before initialization` twice and a 404 for one resource. Mol* rendered and the iframe reported no error, so it did not affect the measurement. Not investigated.
- Frame intervals are `requestAnimationFrame` intervals, capped by vsync; they show missed frames, not GPU cost.

### Engine in a Web Worker (`--worker`, `CreateWebWorkerMLCEngine`)

Same model, cache, prompts and subset (`results/measure-Qwen3.5-2B-q4f16_1-MLC-warm-worker.json`):

| Phase | Frames | p50 ms | p95 ms | p99 ms | max ms | > 20 ms | > 50 ms |
|---|---|---|---|---|---|---|---|
| Baseline | 357 | 16.7 | 16.7 | 16.8 | 16.8 | 0 | 0 |
| During warm load (2,293 ms) | 273 | 16.7 | 16.7 | 16.8 | 16.8 | 0 | 0 |
| Resident, idle | 237 | 16.7 | 16.7 | 16.8 | 16.8 | 0 | 0 |
| During 10 generations | 17,800 | 16.7 | 16.7 | 16.8 | **133.3** | 13 | 1 |

- **The 28.7 s freeze is gone.** It came from the main thread (the iframe shares the page's renderer process), not from GPU contention. The remaining cost of running a 2B model beside Mol* on this GPU is 13 frames over 20 ms in about 5 minutes of generation.
- Generation is unchanged: first token p50 9.0 s (p95 29.9 s), total p50 25.2 s (p95 55.7 s), decode 16.2 to 16.8 tokens/s, and the same 4/10 correct and valid after the think strip (S11, U01, U03, A01), with 0 groundedness violations.
- Peak RSS of the Chrome tree: 2,551 MiB at load, 2,556 MiB during generation.

## Verdict

- **Feasible:** WebLLM runs in Chrome on this Mac with WebGPU, loads a cached 2B model in about 2 s, and holds the plan schema once the think block is stripped.
- **Engineering rule:** run the engine in a Web Worker; on the main thread it froze the 3D scene for 28.7 s.
- **Not good enough as a planner:** 4/10 correct, 25 s median per plan, and a 1.08 GB download.
- **What it can be:** an opt-in extra on WebGPU desktop browsers. The validated deterministic planner stays the default on the web.
- **Not measured:** other models (Qwen3-1.7B was not run), Safari or Firefox (no WebGPU on macOS 15), other devices, and GPU memory (only RSS).
