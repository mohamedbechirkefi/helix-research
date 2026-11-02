<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HX-P3-2026-11-01-ai-benchmark-ollama: local models as plan proposers, with validation and a deterministic fallback

Entry written 2026-11-02, at the end of Phase 3, from the stored run outputs and `docs/ai-model-benchmark.md`. The runs were recorded as they happened (`raw.jsonl`, `summary.json` per run); this entry summarises them.

```yaml
id:            HX-P3-2026-11-01-ai-benchmark-ollama
date:          2026-11-01 to 2026-11-02
hypothesis:    At least one free, licence-compatible local model proposes plans that are both
               correct and valid on most of a 53-item HBB benchmark, and validation catches every
               ungrounded identifier. Contradicted if no model exceeds the deterministic fallback,
               or if any ungrounded identifier passes validation.
git_commit:    0154d67 (harness, schema, fallback), d3b048b (token cap), 4912d80 (last runs)
config:        scripts/ai-benchmark/run.ts flags as listed in docs/ai-model-benchmark.md §10;
               Ollama /api/chat, schema in `format` (3,949 chars), num_ctx 8192, num_predict 1024,
               think false for qwen3.5:4b; one identical system prompt per run (6.4-6.7k chars)
seeds:         temperature 0 with seeds 0, 1, 2; temperature 0.7 with seed 100
data_version:  data/curated/hbb (Phase 2 build); research/benchmark/questions.jsonl (53 items),
               heldout.jsonl (16 items, written after the fallback was frozen)
hardware:      Apple M1 Pro, 10 cores, 16 GB, macOS 15.3.1
duration:      not recorded per run as wall-clock; per-call latencies in each raw.jsonl
cost:          0
llm:
  provider:       local Ollama 0.40.6 (user-space, sha256-verified tarball)
  model_id:       llama3.1:8b 46e0c10c039e; qwen3.5:4b 7f3251fa6878; phi4-mini:3.8b 78fad5d182a7;
                  ministral-3:8b 1922accd5827
  call_date:      2026-11-01 and 2026-11-02
  params:         see config
  prompts:        stored with each run (prompt version and schema hash in summary.json)
  responses:      research/benchmark/runs/<run>/raw.jsonl, every output including failures
  attempt_count:  4 calls per item per model (3 at T=0, 1 at T=0.7) plus one warm-up call;
                  no retries or repairs
```

## Methods
Same prompt, schema, context, items and attempt count for every model (fair comparison). Scores per output: schema-valid, fully valid (`validatePlan`: schema, groundedness, capabilities, prerequisites, outcome consistency), action correct, correct and valid, refusal, clarification, injection resistance, follow-up, false refusals, latency, memory. Expected answers were written before any model ran. A mock model with injected faults was run first (`runs/2026-11-01-mock-dryrun`): every fault was caught. Controls: the deterministic fallback on both sets; a grounded-schema variant (identifier fields as enums).

## Raw results + uncertainty
Main set, 159 outputs per model at T=0 (`docs/ai-model-benchmark.md` §3.2):

| Model | Correct and valid | Groundedness violations (outputs) | Refusals | Injection resisted | False refusals | Total p50 / p95 |
|---|---|---|---|---|---|---|
| fallback (in-sample) | 100% | 0 | 13/13 | 6/6 | 0/35 | < 2 ms |
| llama3.1:8b | 47.2% | 6 (3) | 39/39 | 9/18 | 45/105 | 3.2 / 7.3 s |
| qwen3.5:4b | 57.9% | 20 (17) | 38/39 | 9/18 | 6/105 | 7.0 / 25.2 s |
| phi4-mini:3.8b | 34.0% | 27 (18) | 24/39 | 6/18 | 36/105 | 3.8 / 6.0 s |
| ministral-3:8b | 86.8% | 12 (9) | 39/39 | 9/18 | 12/105 | 10.0 / 20.3 s |

Held-out set (16 items, 48 outputs per model): fallback 75.0% (12/16), qwen3.5:4b 62.5%, ministral-3:8b 56.3%, llama3.1:8b 37.5% (phi4-mini not run).
Policy "model if valid, else fallback", replayed from stored outputs: ministral-3:8b 92.5% main / 75.0% held-out; qwen3.5:4b 81.8% / 87.5%. Main-set policy figures are inflated by the in-sample fallback.
Grounded schema: structured-field violations fall to 0 for every model; correct and valid unchanged (47.2→49.1, 57.9→57.9, 86.8→86.8).
Memory: qwen3.5:4b (MLX runner) grew from about 4.5 to 12.3 GB over 159 calls; llama.cpp figures exclude mmapped weights (§3.6).
Uncertainty: no interval computed; one benchmark, one gene. Repeatability at T=0: identical outputs 53/53, 21/53, 51/53, 51/53 (llama, qwen, phi, ministral).

## Failures
- `runs/2026-11-01-qwen3.5-4b-aborted-no-token-cap`: qwen3.5 generated until the 180 s timeout because constrained decoding did not enforce string `maxLength`; kept, and the token cap (1024) added in d3b048b.
- No run was excluded for a bad score.

## Limits / confounders
- 53 + 16 items, single gene; some expected answers are judgement calls made when the set was written.
- Strict free-text groundedness penalises models that name an injected id while refusing it.
- Other processes (the WebLLM download, unit tests, another session's file writes) overlapped some runs; treat latencies as about ±10%.
- One Ollama version; qwen3.5 results depend on the MLX runner.

## Interpretation
Supported in part. ministral-3:8b is correct and valid on most of the main set, but not on the held-out set, where the rule-based fallback beats every model. Validation caught every ungrounded identifier (invented accessions, recalled ids for other genes, injected ids), so no ungrounded plan would have executed. The safety property comes from validation, not from the model.

## Decision
**Continue.** Development and desktop default: ministral-3:8b behind validation and the deterministic fallback; qwen3.5:4b not the default because of memory growth; llama3.1 and phi4-mini rejected. Workspace record: helix PROGRESS (Phase 3 gate).

## Artifacts
`research/benchmark/questions.jsonl`, `heldout.jsonl`; `research/benchmark/runs/*/{raw.jsonl,summary.json}`; `research/benchmark/memory/`; `packages/ai-planning/`; `scripts/ai-benchmark/`; `docs/ai-model-benchmark.md`.
