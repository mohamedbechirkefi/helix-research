// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Planning-time decomposition (D-H007 item 14). Sends fixed chat requests to a local Ollama and
 * records Ollama's own timing fields, so the time of a plan splits into model load, prompt
 * processing and generation:
 *
 *   node scripts/ai-benchmark/timing.ts --conditions <file.json> [--reps 5] [--warmup 1]
 *        [--order blocked|interleaved] [--only id1,id2] [--tag x] [--cold-first]
 *
 * The conditions file is {"conditions":[{"id","label","messages","format","options","keepAlive"}]}:
 * the exact messages and decoding schema of each condition (built by timing-conditions.ts). In
 * "blocked" order each condition runs its warm-up calls and then its repetitions back to back,
 * as the app does when one prompt is asked again (the prompt prefix stays in Ollama's cache). In
 * "interleaved" order the conditions alternate call by call, so every call follows a different
 * prompt. `--cold-first` unloads the model (keep_alive 0) before each condition's first call, so
 * that call measures a cold load. Every call is stored (raw.jsonl) with the machine's load
 * averages and macOS thermal notes at the time; summary.json gives medians and ranges.
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadavg } from "node:os";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { REPO_ROOT, gitCommit } from "./lib.ts";

const args = process.argv.slice(2);
const opt = (k: string, d?: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const flag = (k: string) => args.includes(`--${k}`);
const conditionsFile = opt("conditions");
if (!conditionsFile) throw new Error("--conditions is required");
const reps = Number(opt("reps", "5"));
const warmups = Number(opt("warmup", "1"));
const order = opt("order", "blocked") as "blocked" | "interleaved";
const only = opt("only")?.split(",");
const tag = opt("tag", "timing")!;
const coldFirst = flag("cold-first");
const baseUrl = opt("base-url", "http://127.0.0.1:11434")!;

export interface TimingCondition {
  id: string;
  label: string;
  model: string;
  messages: { role: string; content: string }[];
  format: unknown;
  options: Record<string, unknown>;
  keepAlive?: string;
}

const file = JSON.parse(readFileSync(conditionsFile, "utf8")) as { conditions: TimingCondition[] };
let conditions = file.conditions;
if (only) conditions = conditions.filter((c) => only.includes(c.id));
if (conditions.length === 0) throw new Error("no condition selected");

function thermal(): string {
  try {
    return execFileSync("pmset", ["-g", "therm"], { encoding: "utf8" })
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .join(" | ");
  } catch {
    return "not recorded";
  }
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

async function unload(model: string): Promise<void> {
  await fetch(`${baseUrl}/api/generate`, { method: "POST", body: JSON.stringify({ model, keep_alive: 0 }) });
  // Wait until /api/ps no longer lists the model.
  for (let i = 0; i < 100; i++) {
    const ps = (await (await fetch(`${baseUrl}/api/ps`)).json()) as { models: { name: string }[] };
    if (!ps.models.some((m) => m.name === model)) return;
    await new Promise((r) => setTimeout(r, 200));
  }
}

async function call(c: TimingCondition) {
  const body = { model: c.model, messages: c.messages, format: c.format, stream: true, keep_alive: c.keepAlive ?? "10m", options: c.options };
  const t0 = performance.now();
  let first: number | null = null;
  let content = "";
  let final: Record<string, unknown> = {};
  const res = await fetch(`${baseUrl}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const chunk = JSON.parse(line) as { message?: { content?: string }; done?: boolean; error?: string };
      if (chunk.error) throw new Error(chunk.error);
      const s = chunk.message?.content ?? "";
      if (s.length > 0 && first === null) first = performance.now() - t0;
      content += s;
      if (chunk.done) final = chunk as Record<string, unknown>;
    }
  }
  const wallMs = performance.now() - t0;
  const ms = (k: string) => (typeof final[k] === "number" ? (final[k] as number) / 1e6 : null);
  const n = (k: string) => (typeof final[k] === "number" ? (final[k] as number) : null);
  return {
    wallMs,
    firstTokenMs: first,
    totalMs: ms("total_duration"),
    loadMs: ms("load_duration"),
    promptEvalCount: n("prompt_eval_count"),
    promptEvalMs: ms("prompt_eval_duration"),
    evalCount: n("eval_count"),
    evalMs: ms("eval_duration"),
    doneReason: (final.done_reason as string | undefined) ?? null,
    content,
  };
}

const date = new Date().toISOString().slice(0, 10);
const outDir = join(REPO_ROOT, "research", "benchmark", "timing", `${date}-${tag}`);
mkdirSync(outDir, { recursive: true });
const rawPath = join(outDir, "raw.jsonl");
writeFileSync(rawPath, "");
const version = ((await (await fetch(`${baseUrl}/api/version`)).json()) as { version: string }).version;

type Row = Awaited<ReturnType<typeof call>> & { condition: string; warmup: boolean; cold: boolean; i: number; at: string; loadavg: number[]; thermal: string; error: string | null };
const rows: Row[] = [];
async function one(c: TimingCondition, i: number, warm: boolean, cold: boolean) {
  if (cold) await unload(c.model);
  const at = new Date().toISOString();
  const la = loadavg().map((x) => +x.toFixed(2));
  const th = thermal();
  let r: Awaited<ReturnType<typeof call>>;
  let error: string | null = null;
  try {
    r = await call(c);
  } catch (e) {
    error = (e as Error).message;
    r = { wallMs: 0, firstTokenMs: null, totalMs: null, loadMs: null, promptEvalCount: null, promptEvalMs: null, evalCount: null, evalMs: null, doneReason: null, content: "" };
  }
  const row: Row = { condition: c.id, warmup: warm, cold, i, at, loadavg: la, thermal: th, error, ...r };
  rows.push(row);
  appendFileSync(rawPath, JSON.stringify(row) + "\n");
  process.stdout.write(
    `${c.id}${warm ? " (warm-up)" : ""}${cold ? " (cold)" : ""} #${i} total ${Math.round(r.totalMs ?? 0)} ms load ${Math.round(r.loadMs ?? 0)} prompt ${r.promptEvalCount}/${Math.round(r.promptEvalMs ?? 0)} ms gen ${r.evalCount}/${Math.round(r.evalMs ?? 0)} ms ${error ?? ""}\n`,
  );
}

const started = Date.now();
if (order === "blocked") {
  for (const c of conditions) {
    for (let w = 0; w < warmups; w++) await one(c, w, true, coldFirst && w === 0);
    for (let i = 0; i < reps; i++) await one(c, i, false, coldFirst && warmups === 0 && i === 0);
  }
} else {
  for (const c of conditions) for (let w = 0; w < warmups; w++) await one(c, w, true, coldFirst && w === 0);
  for (let i = 0; i < reps; i++) {
    // Rotate the order each round so no condition always follows the same one.
    const rot = conditions.map((_, k) => conditions[(k + i) % conditions.length]!);
    for (const c of rot) await one(c, i, false, false);
  }
}

const med = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length;
  return m === 0 ? null : m % 2 ? s[(m - 1) / 2]! : (s[m / 2 - 1]! + s[m / 2]!) / 2;
};
const stat = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => typeof x === "number");
  return v.length === 0 ? null : { median: +med(v)!.toFixed(1), min: +Math.min(...v).toFixed(1), max: +Math.max(...v).toFixed(1), n: v.length };
};
const summary = {
  tag,
  date: new Date().toISOString(),
  gitCommit: gitCommit(),
  ollamaVersion: version,
  conditionsFile: conditionsFile.replace(REPO_ROOT + "/", ""),
  conditionsSha256: sha(readFileSync(conditionsFile, "utf8")),
  order,
  reps,
  warmups,
  coldFirst,
  wallClockS: Math.round((Date.now() - started) / 1000),
  host: { machine: "Apple M1 Pro, 16 GB, macOS 15.3.1" },
  conditions: conditions.map((c) => {
    const rs = rows.filter((r) => r.condition === c.id && !r.warmup && !r.error);
    return {
      id: c.id,
      label: c.label,
      model: c.model,
      options: c.options,
      keepAlive: c.keepAlive ?? "10m",
      systemChars: c.messages.find((m) => m.role === "system")?.content.length ?? 0,
      userChars: c.messages.find((m) => m.role === "user")?.content.length ?? 0,
      formatChars: c.format === undefined || c.format === null ? 0 : JSON.stringify(c.format).length,
      messagesSha256: sha(JSON.stringify(c.messages)),
      n: rs.length,
      errors: rows.filter((r) => r.condition === c.id && r.error).length,
      totalMs: stat(rs.map((r) => r.totalMs)),
      wallMs: stat(rs.map((r) => r.wallMs)),
      loadMs: stat(rs.map((r) => r.loadMs)),
      promptEvalCount: stat(rs.map((r) => r.promptEvalCount)),
      promptEvalMs: stat(rs.map((r) => r.promptEvalMs)),
      evalCount: stat(rs.map((r) => r.evalCount)),
      evalMs: stat(rs.map((r) => r.evalMs)),
      msPerGeneratedToken: stat(rs.map((r) => (r.evalMs !== null && r.evalCount ? r.evalMs / r.evalCount : null))),
      firstTokenMs: stat(rs.map((r) => r.firstTokenMs)),
      outputChars: stat(rs.map((r) => r.content.length)),
      distinctOutputs: new Set(rs.map((r) => r.content)).size,
      warmup: rows.filter((r) => r.condition === c.id && r.warmup).map((r) => ({ cold: r.cold, totalMs: r.totalMs, loadMs: r.loadMs, promptEvalCount: r.promptEvalCount, promptEvalMs: r.promptEvalMs, evalCount: r.evalCount, evalMs: r.evalMs })),
      loadavg1: stat(rows.filter((r) => r.condition === c.id).map((r) => r.loadavg[0]!)),
    };
  }),
};
writeFileSync(join(outDir, "summary.json"), JSON.stringify(summary, null, 1));
console.log(`wrote ${outDir}`);
