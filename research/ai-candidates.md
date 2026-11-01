<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# AI candidates for Phase 3 (P1.5.1)

**Status:** researched, not benchmarked. Written 2026-11-01 for roadmap task P1.5.1. It feeds P3.2.1 (Ollama runs), P3.2.2 (browser feasibility), P3.2.4 (provider abstraction) and P3.3.1 (the choice).

**Method:**

- Model facts come from the Ollama library pages, the Hugging Face model cards and API metadata, the licence texts, the Ollama release notes, and WebLLM's and Transformers.js's sources and documentation.
- All pages were fetched on 2026-11-01 with the User-Agent `helix-research`.
- Nothing was pulled or downloaded. The only local checks were `ollama --version`, `ollama list` and `ollama show` on what is already installed.

**Labels:** **Fact** is from a cited source. **Measured** is from this project's own runs. **Assumption** is reasoning not yet tested.

## 1. What is installed (measured, 2026-11-01)

| Item | Value | Evidence |
|---|---|---|
| Ollama | 0.9.6, released 2025-07-08 [R1]. Binary at `/opt/homebrew/bin/ollama` | `ollama --version`; `GET /api/version` |
| Models | `llama3.1:latest` (8.0B, Q4_K_M, 4.9 GB, context 131072, capabilities `completion`, `tools`); `nomic-embed-text:latest` (274 MB, embeddings) | `ollama list`, `ollama show` |
| Earlier runs | Valid JSON from `llama3.1` in JSON mode, 8.4 s cold (P0.2.7). One structured-output call through the Tauri shell: 5.0 s warm, 13.1 s with model load. Its output was **schema-valid but wrong** (it proposed PDB 1BZO instead of 2HBS) | `PROGRESS.md` §B; `docs/rendering-integration-decisions.md` §5 |
| Hardware | Apple M1 Pro, 10 cores, 16 GB unified memory, macOS 15.3.1 | `PROGRESS.md` §D |

**Fact:** the current Ollama release is v0.40.13 (2026-10-28) [R1]. The installed 0.9.6 is about sixteen months older. Several candidates below need a newer Ollama (the "Min Ollama" column).

**Fact:** Homebrew is unusable on this machine (workspace note).

**Consequence for P3:** the Phase 3 agent should first install a current Ollama from the official release, user-space and checksum-verified per D-H002. It should then run every candidate on that one version, so that the runtime is not a confound.

## 2. Ollama structured outputs and tool calling

- **Fact: the `format` parameter.** Since v0.5.0 (2024-12-04), `/api/generate` and `/api/chat` accept a JSON schema object in the `format` parameter to "constrain a model's output to a specific format defined by a JSON schema" [R1, v0.5.0 notes]. `format: "json"` is the older plain JSON mode. The current documentation says the same and adds: "It is ideal to also pass the JSON schema as a string in the prompt to ground the model's response" [R2].
- **Fact: the installed 0.9.6 already has schema `format`.** The fix for large JSON schemas (v0.7.0, 2025-05-13) is also included [R1].
- **Fact: later releases fixed structured output on thinking models.** Each matters for current thinking models such as Qwen3.5 and Gemma 4 [R1]:
  - v0.12.5 (2025-10-10): thinking models support structured outputs on `/api/chat`;
  - v0.31.2 (2026-07-06): structured output fixed for thinking models when thinking is disabled;
  - v0.34.4 (2026-09-23): structured output on thinking models applies in a single pass;
  - v0.21.1: structured outputs fixed for Gemma 4 with `think=false`.
- **Fact: tool calling.** Tool calling uses the `tools` field of `/api/chat`. The Ollama library marks models whose template supports it with a `tools` tag [R3]. Gemma 3's page has no `tools` tag [R3, gemma3].
- **Fact: the cloud is out.** "Ollama's cloud currently does not support structured outputs" [R2]. Ollama's cloud is out of scope anyway (zero spend, master prompt §8).
- **Measured: a valid schema is not a correct plan.** Schema validity does not imply correctness (the 1BZO case above). The plan schema (P3.1.1) must restrict identifiers to the resolved context, and the interpreter must validate them; the model's output is never trusted (master prompt §8).
- **Assumption: plans should not use thinking.** For a planner, a JSON schema in `format` with thinking disabled is the simplest route. Tool calling is worth scoring separately because it is the shape the desktop provider may use. P3.1.3 should score both.

## 3. Ollama candidates that fit 16 GB

**Assumption (the memory budget):** the model shares 16 GB of unified memory with macOS, a browser running Mol* (two WebGL2 contexts) and the development tools. A download of about 7 GB or less is treated as comfortable, and 7 to 10 GB as possible but likely to interfere. P3.2.1 must measure resident memory and the frame-time impact on the Mol* page.

**Sources:** sizes and context windows are as listed on the Ollama tags pages for the default tag, usually Q4_K_M [R3]. Licences come from the Hugging Face model metadata and the licence texts [R4 to R9].

| Ollama tag | Params | Download (default quant) | Context (Ollama) | Ollama capabilities | Min Ollama | Licence | Notes |
|---|---|---|---|---|---|---|---|
| `llama3.1:8b` (installed) | 8.0B | 4.9 GB (Q4_K_M) | 128K | tools | runs on 0.9.6 (measured) | Llama 3.1 Community License + AUP [R4] | Baseline |
| `llama3.2:3b` | 3B | 2.0 GB | 128K | tools | before 0.9.6 (Assumption: released 2024) | Llama 3.2 Community License + AUP [R5] | Small Llama |
| `qwen2.5:7b` | 7B | 4.7 GB | 32K | tools | Assumption: before 0.9.6 | Apache-2.0 [R6] | **Trap:** `qwen2.5:3b` is under the Qwen Research License (non-commercial), not Apache [R6] |
| `qwen3:4b-instruct` (2507) | 4.0B | 2.5 GB | 256K | tools | Assumption: runs on 0.9.6 (Qwen3 architecture supported since v0.6.7 [R1]) | Apache-2.0 [R6] | Non-thinking only [R6, card]. `qwen3:4b` now points to the *thinking* 2507 build (same digest as `qwen3:4b-thinking`) [R3] |
| `qwen3:8b` | 8B | 5.2 GB | 40K | tools, thinking | v0.6.7 [R1] | Apache-2.0 [R6] | |
| `qwen3.5:4b` | 4B | 3.3 GB (q4_K_M) | 256K | vision, tools, thinking | small sizes first listed in v0.17.5, 2026-03-02 [R1] | Apache-2.0 [R6] | Thinking by default; disable it for plans [R6, card] |
| `qwen3.5:9b` | 9B | 6.6 GB | 256K | vision, tools, thinking | v0.17.5 | Apache-2.0 [R6] | Upper end of the budget |
| `mistral:7b` (v0.3) | 7B | 4.4 GB | 32K | tools | Assumption: before 0.9.6 | Apache-2.0 [R7] | Function calling through raw mode on the Ollama page [R3] |
| `ministral-3:3b` | 3B | 3.0 GB | 256K | vision, tools | 0.13.1 [R3] | Apache-2.0 [R7] | Card: "native function calling and JSON outputting"; temperature below 0.1 recommended [R7] |
| `ministral-3:8b` | 8B | 6.0 GB | 256K | vision, tools | 0.13.1 | Apache-2.0 [R7] | As above |
| `phi4-mini:3.8b` | 3.8B | 2.5 GB | 128K | tools | 0.5.13 [R3], so runs on 0.9.6 | MIT [R8] | Function calling in the card's tool format [R8] |
| `gemma3:4b` | 4B | 3.4 GB | 128K | vision (no `tools` tag) | 0.6 [R3] | Gemma Terms of Use + Prohibited Use Policy [R9] | Schema `format` still applies (Assumption: constrained decoding does not depend on the template) |
| `gemma4:e4b` | 4.5B effective (8B with embeddings) | 6.6 GB (q4_K_M), 6.1 GB (QAT) | 128K | vision, tools, thinking, audio | v0.20.0, 2026-04-02 [R1] | Apache-2.0 [R9] | Tool calling and structured output fixes through v0.32.1 [R1] |
| `gemma4:e2b` | 2.3B effective | 4.6 GB, 4.3 GB (QAT) | 128K | as above | v0.20.0 | Apache-2.0 [R9] | |
| `granite4.1:3b`, `:8b` | 3B, 8B | 2.1 GB, 5.3 GB | 128K | tools | **unverified** | Apache-2.0 [R10] | Page: "tool use, and structured JSON output" [R3] |
| `lfm3:1.7b` | 1.7B | 1.1 GB | 256K | tools, thinking | v0.40.12, 2026-10-27 [R1] | LFM Open License v1.0 [R11] | Released days ago. Commercial use is conditioned on revenue below USD 10 million [R11] |
| `gpt-oss:20b` | 20B | 14 GB | 128K | tools, thinking | v0.11.0 [R1] | Apache-2.0 [R3] | **Excluded:** does not leave room for the browser in 16 GB (Assumption) |

### 3.1 Licence obligations (exact terms)

- **Llama 3.1 and 3.2 (Meta community licences)** [R4][R5]. If Helix distributes or makes available the model, or "a product or service ... that contains" it, it must:
  - provide a copy of the agreement;
  - "prominently display 'Built with Llama' on a related website, user interface, blogpost, about page, or product documentation";
  - keep this notice in a "Notice" text file: "Llama 3.1 is licensed under the Llama 3.1 Community License, Copyright © Meta Platforms, Inc. All Rights Reserved." (3.2: the same with "3.2").

  Use must follow the Acceptable Use Policy, which among other things forbids "the unauthorized or unlicensed practice of any profession including ... medical/health" and inferring health information about individuals without consent [R4]. Helix is nonclinical and collects no personal data, so this fits (Assumption, not legal advice). Models trained on Llama outputs and distributed must start their name with "Llama". A licence from Meta is needed above 700 million monthly active users (not relevant).

  **Inference:** a desktop build that only *calls* a user-installed Ollama does not distribute the weights. A web build that downloads Llama weights for the visitor does make them available, so the attribution applies.
- **Gemma 3 (Gemma Terms of Use)** [R9]. Distribution must carry the use restrictions, give notice that "Gemma is provided under and subject to the Gemma Terms of Use found at ai.google.dev/gemma/terms", and follow the Gemma Prohibited Use Policy.
- **Gemma 4.** Apache-2.0, per Google's Gemma 4 licence page and the model metadata [R9]. This is a change from Gemma 3.
- **Apache-2.0** (Qwen2.5 7B, Qwen3, Qwen3.5, Mistral 7B, Ministral 3, Gemma 4, Granite 4.1): keep the licence and any NOTICE file when redistributing.
- **MIT** (Phi-4-mini): keep the copyright and licence notice.
- **LFM Open License v1.0** [R11]: free for non-commercial research. Commercial use is allowed only below a USD 10 million annual revenue threshold. Not OSI.

## 4. In-browser options (web build)

### 4.1 Where WebGPU exists

- **Measured: not in the Tauri desktop shell.** WebGPU is absent in WKWebView on macOS 15.3.1 (`navigator.gpu` undefined), while Chrome on the same machine has a Metal adapter (`docs/rendering-integration-decisions.md` §5). In-browser WebGPU models will not run in the desktop shell on this OS.
- **Fact: browser support (caniuse data)** [R12]:
  - Chrome and Edge 113 or later have WebGPU; on Linux it depends on hardware and drivers.
  - Safari has partial support: "only enabled by default on macOS 26 Tahoe or later".
  - iOS Safari has it from 26.0.
  - Firefox 141 or later has it "only ... on Windows as well as macOS 26 Tahoe or later on Apple Silicon".
  - Chrome for Android has it (version 156 listed).
- **Fact: global coverage.** The Transformers.js guide puts global WebGPU support at "around 85%" as of March 2026 [R14].
- **Inference: the study machine.** On macOS 15.3.1, only Chromium browsers can run WebGPU models. Safari and Firefox cannot.

### 4.2 WebLLM

- **Fact: the package.** `@mlc-ai/web-llm` 0.2.87 (2026-10-30), Apache-2.0 [R13]. "Everything runs inside the browser with no server support and is accelerated with WebGPU" [R13, README].
- **Fact: structured output and function calling.** `response_format` supports `json_object` with a JSON `schema` string, and an EBNF `grammar` [R13, `chat_completion.ts`]. Function calling (`tools`) is "WIP" and listed only for Hermes-2-Pro and Hermes-3 models (`functionCallingModelIds`) [R13, `config.ts`].
- **Fact: the prebuilt list.** Selected entries from `prebuiltAppConfig` in `src/config.ts` at commit 6897fadc2b [R13]. `vram_required_MB` is WebLLM's own estimate. The download size is not listed, and P3.2.2 must measure it.

| WebLLM model id | vram_required_MB | low_resource | Context |
|---|---|---|---|
| Qwen3.5-0.8B-q4f16_1-MLC | 1629 | yes | 4096 |
| Qwen3.5-2B-q4f16_1-MLC | 2245 | no | 4096 |
| Qwen3.5-4B-q4f16_1-MLC | 3868 | no | 4096 |
| Qwen3-1.7B-q4f16_1-MLC | 2037 | yes | 4096 |
| Qwen3-4B-q4f16_1-MLC | 3432 | yes | 4096 |
| Phi-4-mini-instruct-q4f16_1-MLC | 3438 | no | 4096 |
| Ministral-3-3B-Instruct-2512-BF16-q4f16_1-MLC | 2864 | yes | 4096 |
| gemma-4-E2B-it-q4f16_1-MLC | 3387 | no | 4096 |
| Llama-3.2-1B-Instruct-q4f16_1-MLC | 879 | yes | 4096 |
| Llama-3.2-3B-Instruct-q4f16_1-MLC | 2264 | yes | 4096 |
| Llama-3.1-8B-Instruct-q4f16_1-MLC | 5001 | no | 4096 |
| Hermes-3-Llama-3.1-8B-q4f16_1-MLC (function calling) | 4876 | no | 4096 |
| SmolLM2-1.7B-Instruct-q4f16_1-MLC | 1774 | yes | 4096 |

**Assumption:** the 4096-token context of the prebuilt builds is enough for a plan prompt that holds the resolved HBB context, the action schema and the question. P3.1.1 should keep the prompt well under it.

### 4.3 Transformers.js

- **Fact: the package.** `@huggingface/transformers` 4.3.2 (2026-10-27), Apache-2.0 [R14].
- **Fact: the default backend is the CPU.** "By default, when running in the browser, the model will be run on your CPU (via WASM)". WebGPU is opt-in with `device: 'webgpu'` [R14].
- **Fact: quantisation.** Quantisation is selected with `dtype`, for example `fp32`, `fp16`, `q8` or `q4`, depending on what the model repository provides [R14].
- **Unverified:** no JSON-schema-constrained generation was found in the pages read. Plans would rely on validation and retry.
- **Assumption: the WASM path.** The WASM backend should run in WKWebView, since it needs no WebGPU. It is the only in-webview model route on macOS 15.3.1, but its speed for a 1 to 2B model is unmeasured and likely too slow for interactive planning. In the desktop app, Ollama is the AI route.

## 5. Recommendation for Phase 3

**Prerequisite:** install a current Ollama, user-space and checksum-verified, before P3.2.1 (section 1).

### 5.1 Ollama, to benchmark in P3.2.1

| # | Model | Licence | Why |
|---|---|---|---|
| 1 | `llama3.1:8b` (installed) | Llama 3.1 Community License: "Built with Llama", the Notice file, the AUP | Baseline: already measured once (fast enough, but chose the wrong PDB). Not the preferred shipping model, because of the attribution and non-OSI terms |
| 2 | `qwen3.5:4b` | Apache-2.0 | Primary candidate: 3.3 GB, 256K context, tools. The same family exists in WebLLM (Qwen3.5-2B and 4B), so one prompt and schema could serve the desktop and web providers. Run with thinking disabled. Needs Ollama 0.17.5 or later |
| 3 | `phi4-mini:3.8b` | MIT | Smallest permissive candidate with tools (2.5 GB, 128K). Runs on the installed 0.9.6. Also in WebLLM |
| 4 | `ministral-3:8b` | Apache-2.0 | A different lineage whose card claims native function calling and JSON output. 6.0 GB, at the edge of the budget. Needs Ollama 0.13.1 or later. If memory interferes with Mol*, use `ministral-3:3b` (3.0 GB) |

**Reserves if one fails to run or to fit:** `gemma4:e4b` (Apache-2.0, 6.6 GB) and `qwen3:4b-instruct` (Apache-2.0, 2.5 GB, non-thinking).

### 5.2 Browser, to test in P3.2.2

- **Models:** WebLLM with Qwen3.5-2B-q4f16_1 (about 2.2 GB estimated VRAM) and Qwen3-1.7B-q4f16_1 (low-resource build), using `response_format` with the plan schema. Phi-4-mini is a heavier comparison.
- **What to measure:** download size, first-load time, tokens per second and memory, all with the Mol* page open and animating. The frame-time cost is the gating number.

### 5.3 Scoring

Use the master prompt §8 list in P3.1.3:

- schema compliance;
- identifiers only from context;
- correct world and action;
- tool-call correctness;
- refusal of unsupported questions;
- injection resistance;
- latency and memory.

Every run is reported, including the rejected ones.

## 6. Public-device strategy (honest version)

1. **Deterministic first, everywhere.** Curated journeys, gene search over bundled records, direct selection and highlighting, rule-based supported commands and evidence browsing work with no model (master prompt §8, item 3; P3.2.3). This is the default for every visitor.
2. **Web build: an opt-in in-browser model, only where WebGPU exists.** It is offered only after capability detection (`navigator.gpu` and an adapter), with the download size stated before anything is fetched, and never downloaded automatically. Today that means desktop Chrome and Edge; Safari only on macOS 26 or later; Firefox only on Windows and on macOS 26 on Apple Silicon [R12]. Phones and low-memory devices get the deterministic path (Assumption: a 2 GB or larger download is unreasonable on mobile data).
3. **Desktop build: the user's own Ollama.** The app detects a local server through the scoped Rust or HTTP route measured in P1.5.2. If none is found, it explains how to install Ollama and pull a free model; it never bundles weights silently. No WebGPU in WKWebView on macOS 15.3.1, so no in-webview model.
4. **Never a public Ollama, never a paid fallback.** A local Ollama refuses arbitrary web origins (403, measured in P1.5.2), and §8 forbids pretending otherwise. No cloud inference.
5. **Say so in the UI.** The interface states which provider is active and what is unavailable on this device. The model only proposes; the interpreter validates every identifier against the resolved records.

## 7. Unverified and open

- The minimum Ollama version for Granite 4.1, and whether `qwen3:4b-instruct` (2507) runs on 0.9.6.
- Actual WebLLM download sizes and load times, and the memory and frame-time interference with Mol* (P3.2.2).
- Whether Transformers.js offers schema-constrained decoding.
- Llama 3.2's EU clause for multimodal models: not read here. It is not relevant to the text-only 1B and 3B models (Assumption).
- Model quality for Helix plans: entirely unmeasured. Nothing in this file ranks models by accuracy.

## References

All accessed 2026-11-01.

- [R1] Ollama releases (GitHub API), including the notes for v0.5.0, v0.7.0, v0.9.6, v0.11.0, v0.12.5, v0.13.1, v0.17.5, v0.20.0, v0.21.1, v0.31.2, v0.34.4, v0.40.12 and v0.40.13. https://github.com/ollama/ollama/releases
- [R2] Ollama documentation, Structured Outputs. https://docs.ollama.com/capabilities/structured-outputs
- [R3] Ollama library pages and tags: https://ollama.com/library/llama3.1/tags, /llama3.2/tags, /qwen2.5, /qwen3/tags, /qwen3.5/tags, /mistral, /ministral-3, /phi4-mini, /gemma3, /gemma4/tags, /granite4.1/tags, /lfm3, /gpt-oss (all under https://ollama.com/library/)
- [R4] Llama 3.1 Community License and Acceptable Use Policy, as shipped with the installed model (`ollama show llama3.1`), and https://www.llama.com/llama3_1/use-policy/. Model metadata: https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct
- [R5] Llama 3.2 Community License. https://www.llama.com/llama3_2/license/ ; https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct
- [R6] Qwen model cards and licences: https://huggingface.co/Qwen/Qwen2.5-7B-Instruct , https://huggingface.co/Qwen/Qwen2.5-3B-Instruct (qwen-research), https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507 , https://huggingface.co/Qwen/Qwen3-8B , https://huggingface.co/Qwen/Qwen3.5-4B , https://huggingface.co/Qwen/Qwen3.5-9B
- [R7] Mistral cards: https://huggingface.co/mistralai/Mistral-7B-Instruct-v0.3 , https://huggingface.co/mistralai/Ministral-3-8B-Instruct-2512 , https://huggingface.co/mistralai/Ministral-3-3B-Instruct-2512
- [R8] Phi-4-mini-instruct card (MIT). https://huggingface.co/microsoft/Phi-4-mini-instruct
- [R9] Gemma Terms of Use, https://ai.google.dev/gemma/terms ; Gemma 4 licence (Apache 2.0), https://ai.google.dev/gemma/docs/gemma_4_license ; cards https://huggingface.co/google/gemma-3-4b-it and https://huggingface.co/google/gemma-4-E4B-it
- [R10] Granite 4.1 metadata (Apache-2.0). https://huggingface.co/ibm-granite/granite-4.1-8b
- [R11] LFM Open License v1.0. https://huggingface.co/LiquidAI/LFM3-1.7B/raw/main/LICENSE
- [R12] caniuse WebGPU data. https://raw.githubusercontent.com/Fyrd/caniuse/main/features-json/webgpu.json
- [R13] WebLLM: https://github.com/mlc-ai/web-llm (README; `src/config.ts` at commit 6897fadc2b; `src/openai_api_protocols/chat_completion.ts`); npm https://www.npmjs.com/package/@mlc-ai/web-llm
- [R14] Transformers.js documentation: https://huggingface.co/docs/transformers.js/index , https://huggingface.co/docs/transformers.js/guides/webgpu , https://huggingface.co/docs/transformers.js/guides/dtypes ; npm https://www.npmjs.com/package/@huggingface/transformers
