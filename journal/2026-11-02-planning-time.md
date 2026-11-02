<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HX-P6-2026-11-02-planning-time: why ministral-3:8b planning time rose from Phase 3 to Phase 6

```yaml
id:            HX-P6-2026-11-02-planning-time
date:          2026-11-02
hypothesis:    The warm planning time of ministral-3:8b on the reference question rose from about 10 s
               (Phase 3) to 15.5 s (Phase 4 and 5) and 21.5 s (Phase 6) because of one or more of:
               prompt growth, output growth, context truncation or KV reload, decoding options (format
               schema, num_predict, keep_alive), cold loads, thermal or background load. Each cause is
               supported only if replaying the recorded prompts of each phase, same model and options,
               reproduces the times and Ollama's own timing fields attribute the difference to it.
git_commit:    helix-research c7b2385 (scripts/ai-benchmark/timing.ts, timing-conditions.ts,
               dump-prompts.ts, token-count.ts; the runs used these files before they were committed,
               with the same content except that conditions were added to timing-conditions.ts
               between runs and the token counter's baseline was fixed, see Failures)
config:        Ollama /api/chat, stream true, temperature 0, num_ctx 8192, num_predict 1024,
               keep_alive 10m, format = plan JSON schema v1 (3,949 chars) or v2 (4,639 chars) as each
               phase sent it; think not sent. Blocked order: per condition one warm-up call, then 5
               calls back to back (as the app asks); --cold-first unloads the model before the warm-up.
seeds:         none sent (temperature 0); every condition gave 1 distinct output over its 5 calls
data_version:  the prompts carry the curated HBB context of each phase (P3: dataset at 4912d80;
               P4, P5: a13c1ec; P6: 0826e68)
hardware:      Apple M1 Pro, 10 cores, 16 GB, macOS 15.3.1. Load average 2.7 to 8.0 during the runs
               (other user applications open; recorded per call); pmset reported no thermal or
               performance warning in any call.
duration:      phases-blocked 2026-11-02 about 13:50 to 14:05 UTC+1; phases-asked about 14:20; the
               compact probe about 14:30 (wall clock in each summary.json)
cost:          0
llm:
  provider:       local Ollama 0.40.6 (server already running; not started or stopped here)
  model_id:       ministral-3:8b (digest 1922accd5827)
  call_date:      2026-11-02
  params:         see config
  prompts:        research/benchmark/timing/prompts/conditions-phases.json (exact messages and schema
                  of every condition); Phase 3 prompts rebuilt from 4912d80 in
                  research/benchmark/timing/prompts/p3-4912d80-prompts.json
  responses:      research/benchmark/timing/<run>/raw.jsonl (every output, warm-ups included)
  attempt_count:  phases-blocked 30 calls (5 cold warm-ups + 25), phases-asked 18 (3 warm-ups + 15),
                  compact-probe 4 (1 warm-up + 3), token counting about 60 one-token calls; no retries
```

## Methods

1. **Same question, each phase's prompt.** The reference question ("Show me where the sickle-cell mutation affects hemoglobin."), with the exact messages each phase sent: Phase 3 benchmark item S01 rebuilt from the 4912d80 tree with `dump-prompts.ts` (system prompt 6,290 chars and schema 3,949 chars, both equal to what the Phase 3 summary.json records); Phases 4, 5 and 6 from the messages the E2E suites stored (`journal/results/helix-app-e2e/e2e-2026-11-02.json`, `-p5reg.json`, `-p6reg.json`, run 1).
2. **A journaling defect found on the way:** the suites stored those messages by calling `window.__helixApp.prompt()` after the run, so the stored context carries the session after the answer (VAL H6 selected, 2HBS loaded), not the session of the measured call (nothing selected or loaded; Phase 6 builds also sent `"sequenceSelection":null`, which the hook omitted). The "-asked" conditions put that session back by exact string replacement. The Phase 6 reconstruction was then checked against the app's own context through `helix-app/scripts/model-questions.ts --mode phase6` (question ref-first): same output, 464 generated tokens, 21.6 s.
3. **Split by Ollama's fields:** `load_duration`, `prompt_eval_count` and `prompt_eval_duration`, `eval_count` and `eval_duration`, `total_duration`, plus wall and first-token times.
4. **Output tokens by field:** `token-count.ts` sends each piece of an output (raw mode, num_predict 1) and reads `prompt_eval_count` minus the BOS token. Check: the full Phase 6 output counts 463 tokens against `eval_count` 464 (the end token).
5. **Diagnostics:** the Phase 6 prompt without the format schema (constrained decoding off); cold first calls; one candidate fix (compact JSON, below).

## Raw results + uncertainty

Warm, n = 5 per condition, every condition gave the same output 5 times; medians (min to max):

| Condition | System prompt chars | Prompt tokens | Prompt eval (warm) | Generated tokens | ms per token | Total |
|---|---|---|---|---|---|---|
| p3-ref (Phase 3, S01) | 6,290 | 2,201 | 58.8 ms | 382 | 46.0 | 17,652 ms (17,631 to 17,656) |
| p4-ref-asked (Phase 4) | 6,470 | 2,249 | 59.1 ms | 336 | 46.2 | 15,601 ms (15,551 to 15,668) |
| p5-ref-asked (Phase 5) | 6,410 | 2,233 | 60.0 ms | 337 | 46.2 | 15,646 ms (15,619 to 15,654) |
| p6-ref-asked (Phase 6) | 7,186 | 2,418 | 60.5 ms | 464 | 46.5 | 21,661 ms (21,641 to 21,690) |
| p4-ref as stored (post-answer session) | 6,587 | 2,287 | 59.5 ms | 342 | 46.1 | 15,839 ms |
| p5-ref as stored | 6,527 | 2,271 | 59.5 ms | 338 | 46.0 | 15,631 ms |
| p6-ref as stored | 7,278 | 2,451 | 59.9 ms | 533 | 46.3 | 24,781 ms |
| p6-ref without format schema | 7,278 | 2,451 | 46.4 ms | 527 | 46.2 | 24,427 ms |

The "-asked" replays reproduce the E2E provider times (Phase 4 15,516 ms, Phase 5 15,528 ms, Phase 6 21,514 ms, journal HX-P4-2026-11-02-ai-to-world-e2e and HX-P6-2026-11-02-vertical-slice-e2e) within 0.7%. Every call ended with `done_reason` "stop" (no truncation by num_predict); prompt plus output stays under 3,000 tokens against num_ctx 8,192.

Cold first call (model unloaded, then the condition's prompt): load 4,333 to 4,608 ms and prompt evaluation 9,725 to 10,855 ms (2.2k to 2.45k uncached tokens, about 225 tokens/s), total 30.2 to 39.9 s. Warm calls show load 1 to 2 ms and prompt evaluation about 60 ms: Ollama reuses the cached prompt prefix.

Output tokens by field (compact JSON pieces; the rest is pretty-printing whitespace):

| Field | Phase 3 S01 | Phase 4 | Phase 6 |
|---|---|---|---|
| actions | 97 (4 actions incl. resolveVariant 33) | 64 (3 actions) | 115 (5 actions: + highlightSequenceRegion 40, + enterWorld 10) |
| reason | 4 (null) | 4 (null) | 59 (a sentence on both worlds) |
| followUps | 50 | 46 | 43 |
| entities, citations, outcome, intent, level | 132 | 130 | 130 |
| whitespace (generated minus compact) | 100 | 91 | 116 |
| **generated** | **381** | **335** | **463** |

## Per-cause breakdown

**Phase 3 "10 s" to Phase 4 "15.5 s": not a rise.** The Phase 3 figure is the median over all 53 benchmark items (median 218 generated tokens, many short refusals); the reference question itself took 17.5 s in Phase 3 (raw.jsonl, S01, 382 tokens) and 17.65 s today. On the same question the Phase 4 prompt is 2.05 s faster (46 fewer tokens: no resolveVariant action). 100% of the apparent rise is the change of comparison set.

**Phase 4/5 (15.6 s) to Phase 6 (21.7 s), +6,060 ms on the same question:**

| Cause | Measured contribution | Share |
|---|---|---|
| Output length: +128 generated tokens x 46.2 ms | +5,914 ms | 97.6% |
| of which the two-world plan's extra actions (highlightSequenceRegion, enterWorld) and their whitespace | about +76 tokens, +3.5 s | about 59% |
| of which a non-null reason explaining the second world | +55 tokens, +2.5 s | about 43% |
| of which shorter follow-ups | -3 tokens | about -2% |
| Slower tokens with the longer context (46.2 to 46.5 ms) x 464 | +139 ms | 2.3% |
| Prompt growth (+169 prompt tokens), warm | +1.4 ms | 0% |
| Model load, KV reload, truncation | 0 (load 1 to 2 ms, done_reason stop, no reload) | 0% |
| Format schema (constrained decoding) | no measurable cost (46.3 vs 46.2 ms per token) | 0% |
| Thermal or background load | none detected (no pmset warning; 5-call spread under 0.5%) | 0% |

Prompt growth matters only cold: +0.73 s of prompt evaluation on a first call after a load (10.13 to 10.85 s).

## Candidate fixes measured

- **Compact JSON output** (one added rule: write the JSON on one line): whitespace is 22 to 26% of generated tokens. On the Phase 6 prompt it cut the reference question from 464 to 406 tokens, 21.7 to 18.9 s, but the model also changed the plan (7 actions, both worlds). Combined with the one-world prompt (journal HX-P6-2026-11-02-one-world-first-answer, probes b, d, e, g) it cut planning by 25 to 30%, but in 4 of 4 probes the follow-up "Compare it with the reference sequence." lost highlightSequenceRegion (compareVariants only), which the plan of record and the blueprint B check require. **Not shipped:** it lowers plan quality on a known item. Left to the author.
- **num_predict:** the longest output was 533 tokens and every call stopped on its own; lowering the 1,024 cap would only risk truncation. **Not changed.**
- **keep_alive:** warm time is unaffected; after 10 idle minutes the next question pays the cold cost (about +14.5 to 15 s, load plus uncached prompt). A longer keep_alive keeps about 6 GB resident. **Not changed;** an author decision (memory against the first-question delay).
- **The fix that ships** is the author's one-world rule itself: it removes the second world's actions and reason from the first answer (21.7 s to 18.6 s on the reference question; see the one-world entry).

## Failures

- The stored E2E prompts did not describe the measured calls (post-answer session). Found here; the E2E suites now capture the prompt before the question (helix-app run.mjs and phase6.mjs), and the earlier entries that call them "the exact messages of run 1" should be read with this correction.
- `token-count.ts` first used an empty prompt as its baseline; Ollama answers an empty prompt with a load-only response that has no count, so the first output was all null. Fixed (baseline "hello world" minus 2 tokens) and rerun; only the fixed counts are reported.

## Limits / confounders

- One question for the cross-phase comparison (the reference question); the full question set and the benchmark are timed in the one-world entry.
- One machine, one Ollama version; other applications were open (load average up to 8.0), but the 5-call spreads stayed under 0.5%.
- The field attribution counts each JSON piece on its own; tokenisation across piece boundaries can shift a token or two.

## Interpretation

Supported for output length, contradicted for the other causes. Planning time on this machine is almost exactly 46 ms per generated token plus about 60 ms; the Phase 6 rise is the longer first answer (a second world's actions and a reason explaining them). Prompt length, the schema constraint, num_ctx and thermal state do not explain it warm. The "10 s" Phase 3 baseline was a different measure.

## Decision

Ship the one-world first answer (author decision) as the timing fix; do not ship compact JSON; leave keep_alive to the author.

## Artifacts

- `research/benchmark/timing/2026-11-02-phases-blocked/`, `2026-11-02-phases-asked/`, `2026-11-02-compact-probe/` (raw.jsonl, summary.json, tokens-*.json)
- `research/benchmark/timing/prompts/conditions-phases.json`, `p3-4912d80-prompts.json`
- `scripts/ai-benchmark/timing.ts`, `timing-conditions.ts`, `dump-prompts.ts`, `token-count.ts`
- `helix-app/apps/web/e2e/results/model-questions-2026-11-02-before-v2.json` (Phase 6 reconstruction check; private repository, public copy in `journal/results/helix-app-e2e/`)
