<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HX-P3-2026-11-01-webllm-browser: an in-browser model beside a live Mol* scene

Entry written 2026-11-02, at the end of Phase 3, from `research/experiments/webllm-browser/` (results recorded during the runs).

```yaml
id:            HX-P3-2026-11-01-webllm-browser
date:          2026-11-01 to 2026-11-02
hypothesis:    A small model running in the browser through WebGPU can propose schema-valid plans
               without disturbing a Mol* scene on the same page. Contradicted if WebGPU is missing,
               if plans are not schema-valid, or if the 3D scene freezes.
git_commit:    702bc9f (experiment), 4912d80 (worker run)
config:        research/experiments/webllm-browser/ (Puppeteer driver; response_format = plan schema)
seeds:         not recorded separately; 10 items per condition
data_version:  10 items from research/benchmark/questions.jsonl; data/curated/hbb
hardware:      Apple M1 Pro, 16 GB, macOS 15.3.1; Chrome 156.0.8078.74 headless, Apple metal-3 adapter
duration:      cold load about 75 min (network-bound, 0.2 to 1 MB/s); warm load 2.0 s main thread,
               2.3 s worker
cost:          0
llm:
  provider:       @mlc-ai/web-llm 0.2.86, in page
  model_id:       Qwen3.5-2B-q4f16_1-MLC
  call_date:      2026-11-01 and 2026-11-02
  params:         response_format with the plan schema; enable_thinking false
  prompts:        same system prompt as the Ollama harness
  responses:      results/raw-Qwen3.5-2B-q4f16_1-MLC-warm.jsonl, raw-...-warm-worker.jsonl
  attempt_count:  1 per item per condition
```

## Methods
Two conditions with the same items: engine on the main thread, engine in a Web Worker. Mol* frame intervals recorded with vsync on during load and generation.

## Raw results + uncertainty
- WebGPU available in Chrome; absent in the Tauri WKWebView (HX-P1-2026-11-01-tauri-shell).
- Download 1.08 GB (31 shards plus a 7.2 MB WASM library).
- Decode 16.1 to 17.0 tokens/s; first token p50 9.0 s; total p50 25 s, p95 56 s.
- Schema: 0/10 valid as returned (an empty `<think>` block precedes the JSON); after stripping it, 10/10 schema-valid, 4/10 correct and valid, 0 groundedness violations (`results/rescored-*.json`).
- Mol* interference: main thread, one 28.7 s freeze; worker, max frame 133 ms, 13 frames over 20 ms in about 5 min of generation.
- Memory: Chrome tree RSS about 2.6 GB peak, against 1.3 GB with Mol* alone (lower bound; GPU memory not measured).
Single run per condition; no interval.

## Failures
`results/measure-...-cold-loadonly-timeout.json`: the first cold load timed out on the slow link; resumed in `measure-...-resume-download.json`. Kept.

## Limits / confounders
10 items only; one model; headless Chrome on one fast Mac; Safari, Firefox, Qwen3-1.7B and Transformers.js not tested.

## Interpretation
Feasible but weak, and only in a worker: on the main thread the model freezes the 3D scene.

## Decision
**Continue**, as an experimental opt-in on the web only: worker required, download size stated before fetching, validation and fallback as for every provider.

## Artifacts
`research/experiments/webllm-browser/README.md`, `results/`.
