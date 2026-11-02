// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Counts the model's tokens in pieces of a plan output (journal HX-P6-2026-11-02-planning-time).
 * Ollama 0.40.6 has no tokenize endpoint, so each text is sent once with /api/generate in raw mode
 * and num_predict 1, and its prompt_eval_count minus 1 (the BOS token the runner adds) is its token
 * count. The check: the generated output, counted this way, gives the eval_count Ollama reported.
 *
 *   node scripts/ai-benchmark/token-count.ts <timing raw.jsonl> <condition id> [model]
 *
 * For the first non-warm-up output of the condition, it reports the tokens of: the whole output as
 * generated, the same JSON compacted (no whitespace between tokens), and each top-level field of
 * the compact JSON (key and value), so the generation time can be split by field.
 */
import { readFileSync } from "node:fs";

const [file, condition, model = "ministral-3:8b"] = process.argv.slice(2);
if (!file || !condition) throw new Error("usage: token-count.ts <raw.jsonl> <condition> [model]");
const row = readFileSync(file, "utf8")
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l) as { condition: string; warmup: boolean; content: string; evalCount: number })
  .find((r) => r.condition === condition && !r.warmup);
if (!row) throw new Error(`no output for ${condition}`);

async function count(text: string): Promise<number> {
  const r = await fetch("http://127.0.0.1:11434/api/generate", {
    method: "POST",
    body: JSON.stringify({ model, prompt: text, raw: true, stream: false, keep_alive: "10m", options: { num_predict: 1, temperature: 0, num_ctx: 8192 } }),
  });
  return ((await r.json()) as { prompt_eval_count: number }).prompt_eval_count;
}
// An empty prompt only loads the model (done_reason "load", no count); "hello world" counts BOS + 2.
const bos = (await count("hello world")) - 2;
const empty = bos;
const tokens = async (t: string) => (await count(t)) - empty;
const parsed = JSON.parse(row.content) as Record<string, unknown>;
const compact = JSON.stringify(parsed);
const out: Record<string, unknown> = {
  condition,
  evalCount: row.evalCount,
  emptyPromptCount: empty,
  generated: { chars: row.content.length, tokens: await tokens(row.content) },
  compact: { chars: compact.length, tokens: await tokens(compact) },
  fields: {} as Record<string, number>,
};
for (const [k, v] of Object.entries(parsed)) (out.fields as Record<string, number>)[k] = await tokens(`${JSON.stringify(k)}:${JSON.stringify(v)}`);
const actions = (parsed.actions as unknown[]) ?? [];
out.actions = await Promise.all(actions.map(async (a) => ({ action: (a as { type: string }).type, tokens: await tokens(JSON.stringify(a)) })));
const fu = (parsed.followUps as string[]) ?? [];
out.followUps = await Promise.all(fu.map(async (f) => ({ text: f, tokens: await tokens(JSON.stringify(f)) })));
console.log(JSON.stringify(out, null, 1));
