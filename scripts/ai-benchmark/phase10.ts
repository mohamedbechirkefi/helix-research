// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Phase 10 reliability benchmark harness (P10.3.1).
 *
 *   node scripts/ai-benchmark/phase10.ts --planner deterministic|ollama [--model ministral-3:8b]
 *        [--reps 3] [--attempts 1] [--only P10-HBB-01,P10-FU-HBB] [--out <dir name>]
 *
 * Every unit of the frozen set (research/benchmark/phase10: 85 questions, 5 three-turn follow-ups, 12
 * injection rows) is planned in the context the app builds for it (phase10-lib.ts), with prompt v7.
 * - deterministic: the app Director's rule-based branch (deterministicPlan; a plan that fails
 *   validation becomes the "unsupported" answer with the reason, as the Director does).
 * - ollama: the shipped provider configuration (helix-app ai-director createProviderRegistry: num_predict
 *   1024, the provider's default 180 s timeout, num_ctx 8192, keep_alive 60m, no seed, no think flag),
 *   temperature 0. The Director calls the provider once per question and falls back on any error, so
 *   the shipped attempt count is 1; `--attempts` can raise it for transport errors only, and every
 *   attempt is stored.
 * Follow-up turns run in order within each repeat; each turn starts from the state its row `assumes`.
 * One JSONL row per output (raw text, message hash, timings, usage, error, validation under the v7
 * taught actions); the frozen hashes are checked before and after and written to the manifest.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  OllamaProvider,
  ProviderError,
  buildMessages,
  deterministicPlan,
  geneLikeTokens,
  hgncRecordsFromContext,
  promptVersion,
  schemaFor,
  taughtActions,
  validatePlan,
  type Plan,
  type PlanningContext,
} from "@helix/ai-planning";
import { resolveGeneQuery } from "@helix/scientific-core";
import { gitCommit, RUNS_DIR } from "./lib.ts";
import { DATASETS, frozenHashes, loadSet, loadUnits, sha256, unitContext, type Dataset, type SetRecords, type Unit } from "./phase10-lib.ts";

const args = process.argv.slice(2);
const opt = (k: string, d?: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const planner = opt("planner", "deterministic")!;
const model = opt("model", "ministral-3:8b")!;
const reps = Number(opt("reps", "3"));
const attempts = Number(opt("attempts", "1"));
const only = opt("only")?.split(",");
const baseUrl = "http://127.0.0.1:11434";
const date = new Date().toISOString().slice(0, 10);
const outDir = join(RUNS_DIR, opt("out", `phase10-${date}`)!);
if (planner !== "deterministic" && planner !== "ollama") throw new Error(`unknown --planner ${planner}`);

const before = frozenHashes();
if (before.some((h) => !h.match)) throw new Error(`frozen set hash mismatch: ${JSON.stringify(before)}`);

const sets = new Map<Dataset, SetRecords>(DATASETS.map((d) => [d, loadSet(d)]));
let units = loadUnits();
if (only) units = units.filter((u) => only.includes(u.id) || (u.sequence !== null && only.includes(u.sequence)));

/** The app Director's deterministic branch (helix-app packages/ai-director/src/director.ts). */
function directorDeterministic(query: string, ctx: PlanningContext): Plan {
  const { plan } = deterministicPlan(query, ctx);
  const v = validatePlan(plan, ctx, { query });
  if (v.ok) return plan;
  return {
    outcome: "unsupported",
    intent: plan.intent,
    entities: { geneId: null, proteinId: null, variantId: null, structureId: null },
    actions: [],
    explanationLevel: plan.explanationLevel,
    citations: [],
    followUps: [],
    reason: `This build cannot show that yet: ${v.issues.map((i) => i.message).join("; ")}`.slice(0, 400),
  };
}

async function ollamaMeta() {
  const version = ((await (await fetch(`${baseUrl}/api/version`)).json()) as { version: string }).version;
  const tags = (await (await fetch(`${baseUrl}/api/tags`)).json()) as { models: { name: string; digest: string; size: number; details?: unknown }[] };
  const show = (await (await fetch(`${baseUrl}/api/show`, { method: "POST", body: JSON.stringify({ model }) })).json()) as { capabilities?: string[]; details?: unknown };
  const t = tags.models.find((m) => m.name === model);
  return { ollamaVersion: version, model, digest: t?.digest ?? null, sizeBytes: t?.size ?? null, details: t?.details ?? show.details ?? null, capabilities: show.capabilities ?? [] };
}

// The shipped provider (helix-app createProviderRegistry): numPredict 1024; timeout, num_ctx and keep_alive are the provider's defaults.
const provider = planner === "ollama" ? new OllamaProvider({ model, baseUrl, numPredict: 1024 }) : null;
const providerConfig = planner === "ollama" ? { timeoutMs: 180_000, numCtx: 8192, keepAlive: "60m", numPredict: 1024, temperature: 0, seed: "not sent (the Director sends none)", think: "not sent (the registry sets none)" } : null;

mkdirSync(outDir, { recursive: true });
const slug = planner === "ollama" ? model.replace(/[^A-Za-z0-9.]+/g, "-") : "deterministic";
const rawPath = join(outDir, `${slug}.jsonl`);
const msgPath = join(outDir, "messages.jsonl");
writeFileSync(rawPath, "");
const seenMsgs = new Set<string>(existsSync(msgPath) ? readFileSync(msgPath, "utf8").split("\n").filter(Boolean).map((l) => (JSON.parse(l) as { sha256: string }).sha256) : []);

const meta = planner === "ollama" ? await ollamaMeta() : null;
const startedAt = new Date().toISOString();
console.log(`phase10 ${planner} ${planner === "ollama" ? model : ""} units=${units.length} reps=${reps} start=${startedAt}`);

// Warm-up (unscored), as Phase 3: the cold load is not a planning latency.
let warmup: Record<string, unknown> | null = null;
if (provider) {
  const u = units[0]!;
  const { ctx } = unitContext(sets.get(u.dataset)!, u);
  const t = Date.now();
  try {
    const o = await provider.plan({ query: u.query, context: ctx, requestId: "warmup", temperature: 0 });
    warmup = { unit: u.id, wallMs: Date.now() - t, loadMs: o.usage?.loadMs ?? null, firstTokenMs: o.timings.firstTokenMs };
  } catch (e) {
    warmup = { unit: u.id, wallMs: Date.now() - t, error: (e as Error).message };
  }
  console.log("warm-up", JSON.stringify(warmup));
}

// Order: per repeat, every unit in file order (follow-up turns consecutively, turn 1 to 3).
let n = 0;
let failures = 0;
let retries = 0;
for (let rep = 0; rep < reps; rep++) {
  for (const u of units) {
    const set = sets.get(u.dataset)!;
    const { ctx, notes } = unitContext(set, u);
    const messages = buildMessages(u.query, ctx);
    const msgHash = sha256(JSON.stringify(messages));
    if (!seenMsgs.has(msgHash)) {
      seenMsgs.add(msgHash);
      appendFileSync(msgPath, JSON.stringify({ sha256: msgHash, unit: u.id, promptVersion: promptVersion(ctx), schemaSha256: sha256(JSON.stringify(schemaFor({ query: u.query, context: ctx, requestId: "x" }))), messages }) + "\n");
    }
    const unresolvedGenes = geneLikeTokens(u.query).filter((t) => /\d/.test(t) && resolveGeneQuery(t, hgncRecordsFromContext(ctx)).status === "not-found");
    for (let attempt = 1; attempt <= Math.max(1, attempts); attempt++) {
      const at = new Date().toISOString();
      let raw = "";
      let error: { code: string; message: string; partial: string | null } | null = null;
      let firstTokenMs: number | null = null;
      let totalMs: number | null = null;
      let usage: unknown = null;
      let doneReason: unknown = null;
      if (provider) {
        try {
          const o = await provider.plan({ query: u.query, context: ctx, requestId: `${u.id}#${rep}.${attempt}`, temperature: 0 });
          raw = o.raw;
          firstTokenMs = o.timings.firstTokenMs;
          totalMs = o.timings.totalMs;
          usage = o.usage ?? null;
          doneReason = o.meta?.doneReason ?? null;
        } catch (e) {
          error = { code: e instanceof ProviderError ? e.code : "unknown", message: (e as Error).message, partial: (e as { partial?: string }).partial ?? null };
        }
      } else {
        const t0 = performance.now();
        raw = JSON.stringify(directorDeterministic(u.query, ctx));
        totalMs = performance.now() - t0;
      }
      const v = error ? null : validatePlan(raw, ctx, { query: u.query, taughtActions: taughtActions(ctx) });
      const row = {
        planner: planner === "ollama" ? `ollama:${model}` : "deterministic",
        unit: u.id,
        file: u.file,
        dataset: u.dataset,
        category: u.category,
        sequence: u.sequence,
        turn: u.turn,
        rep,
        attempt,
        at,
        query: u.query,
        messagesSha256: msgHash,
        context: notes,
        directorWouldSkipModel: unresolvedGenes.length > 0,
        raw,
        error,
        firstTokenMs,
        totalMs,
        usage,
        doneReason,
        validation: v ? { ok: v.ok, parsedJson: v.parsedJson, schemaValid: v.schemaValid, issues: v.issues.map((i) => `${i.code}:${i.path}${i.value ? `=${i.value}` : ""}`) } : null,
      };
      appendFileSync(rawPath, JSON.stringify(row) + "\n");
      n++;
      const retryable = error !== null && (error.code === "unavailable" || error.code === "http" || error.code === "protocol");
      console.log(`${String(n).padStart(4)} ${u.id}#${rep}${attempt > 1 ? `.${attempt}` : ""} ${error ? `ERR ${error.code} ${error.message.slice(0, 80)}` : v?.ok ? "valid" : `INVALID ${v?.issues[0]?.code ?? ""}`} ${totalMs !== null ? Math.round(totalMs) : "-"}ms`);
      if (!error) break;
      failures++;
      if (!retryable || attempt >= attempts) break;
      retries++;
    }
  }
}
const endedAt = new Date().toISOString();
const after = frozenHashes();
if (after.some((h, i) => h.onDisk !== before[i]!.onDisk)) console.error("FROZEN SET CHANGED DURING THE RUN");

const manifestPath = join(outDir, "manifest.json");
const manifest = existsSync(manifestPath) ? (JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>) : {};
manifest.study = "P10.3.1 Phase 10 reliability benchmark";
manifest.set = { dir: "research/benchmark/phase10", frozenBy: "D-H023", hashesBefore: before, hashesAfter: after };
const runs = (manifest.runs as Record<string, unknown>[] | undefined) ?? [];
runs.push({
  planner: planner === "ollama" ? `ollama:${model}` : "deterministic",
  file: `${slug}.jsonl`,
  commit: gitCommit(),
  prompt: "helix-plan-prompt-v7 (library commit 6c6cfb7), decoding schema v3",
  units: units.length,
  reps,
  attempts,
  outputs: n,
  failures,
  retries,
  startedAt,
  endedAt,
  ...(meta ? { ollama: meta, providerConfig, warmup } : {}),
  node: process.version,
});
manifest.runs = runs;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + "\n");
console.log(`done ${n} outputs, ${failures} failures, ${retries} retries; ${startedAt} -> ${endedAt}; ${rawPath}`);
