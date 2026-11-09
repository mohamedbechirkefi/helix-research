// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Re-scoring of the frozen Phase 10 run with the corrected harness (author decision D-H029 answer 87).
 *
 *   node scripts/ai-benchmark/phase10-rescore.ts --planner deterministic|ollama [--model ministral-3:8b]
 *        [--reps 3] [--from phase10-2026-11-04] --out phase10-rescore-<date>
 *
 * Every unit of the frozen set (research/benchmark/phase10) is built twice: with the Phase 10 harness as it ran
 * (phase10-lib.ts unitContext, unchanged) and with the corrected one (phase10-rescore-lib.ts appUnitContext: the
 * app's selection bridge and topicsOfPlan, imported from the sibling helix-app checkout). The messages of both are
 * hashed; the original hash must equal the stored messagesSha256 of every stored row of the unit, or the run stops.
 * - deterministic: the rule-based planner as the Phase 10 harness ran it (deterministicPlan, a plan failing
 *   validation becomes the "unsupported" answer), rerun on every unit in the corrected context. As a check, the
 *   same planner is also run on the original context and compared byte for byte with the stored rule-based rows.
 * - ollama: the model is called only on the units whose corrected messages differ from the stored ones, with the
 *   Phase 10 parameters (temperature 0, num_predict 1024, num_ctx 8192, keep_alive 60m, timeout 180 s, one
 *   attempt, no seed, no think flag); every other row is the stored row of the original run, reused after checking
 *   that the corrected messages are byte-identical to the stored ones (same sha256 as the stored messages entry).
 * The Director policy is replayed by the scorer (phase10-score.ts --rescore). The frozen hashes are checked before
 * and after and written to the manifest with the helix-app provenance and the list of units whose input changed.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { OllamaProvider, ProviderError, buildMessages, deterministicPlan, geneLikeTokens, hgncRecordsFromContext, promptVersion, schemaFor, taughtActions, validatePlan, type Plan, type PlanningContext } from "@helix/ai-planning";
import { resolveGeneQuery } from "@helix/scientific-core";
import { gitCommit, RUNS_DIR } from "./lib.ts";
import { DATASETS, frozenHashes, loadSet, loadUnits, sha256, unitContext, type Dataset, type Unit } from "./phase10-lib.ts";
import { appSet, type AppSet } from "./phase10-heldout-lib.ts";
import { appUnitContext, loadRescoreApp, rescoreProvenance } from "./phase10-rescore-lib.ts";

const args = process.argv.slice(2);
const opt = (k: string, d?: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const planner = opt("planner", "deterministic")!;
const model = opt("model", "ministral-3:8b")!;
const reps = Number(opt("reps", "3"));
const fromName = opt("from", "phase10-2026-11-04")!;
const outName = opt("out");
if (!outName) throw new Error("--out <run dir name> is required");
if (outName === fromName) throw new Error("--out must differ from --from: the original run directory is never written");
if (planner !== "deterministic" && planner !== "ollama") throw new Error(`unknown --planner ${planner}`);
const baseUrl = "http://127.0.0.1:11434";
const fromDir = join(RUNS_DIR, fromName);
const outDir = join(RUNS_DIR, outName);
const slug = planner === "ollama" ? model.replace(/[^A-Za-z0-9.]+/g, "-") : "deterministic";
const plannerId = planner === "ollama" ? `ollama:${model}` : "deterministic";

const before = frozenHashes();
if (before.some((h) => !h.match)) throw new Error(`frozen set hash mismatch: ${JSON.stringify(before)}`);

const app = await loadRescoreApp();
const provenance = rescoreProvenance();
const sets = new Map<Dataset, AppSet>(DATASETS.map((d) => [d, appSet(app, loadSet(d))]));
const units = loadUnits();

interface StoredRow {
  planner: string;
  unit: string;
  rep: number;
  attempt: number;
  raw: string;
  messagesSha256: string;
  [k: string]: unknown;
}
const readRows = (file: string): StoredRow[] =>
  readFileSync(join(fromDir, file), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as StoredRow);
const stored = readRows(`${slug}.jsonl`);
const storedOf = (unit: string, rep: number): StoredRow => {
  const rs = stored.filter((r) => r.unit === unit && r.rep === rep);
  if (rs.length !== 1) throw new Error(`${unit}#${rep}: ${rs.length} stored rows (one attempt expected)`);
  return rs[0]!;
};
const storedMessages = new Map(
  readFileSync(join(fromDir, "messages.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { sha256: string; messages: unknown })
    .map((m) => [m.sha256, JSON.stringify(m.messages)]),
);

// Both contexts of every unit, and the byte comparison of their messages.
interface Built {
  u: Unit;
  original: PlanningContext;
  corrected: PlanningContext;
  notes: ReturnType<typeof appUnitContext>["notes"];
  originalHash: string;
  correctedHash: string;
  correctedMessages: string;
  changed: boolean;
}
const built: Built[] = units.map((u) => {
  const a = sets.get(u.dataset)!;
  const original = unitContext(a.set, u).ctx;
  const c = appUnitContext(a, u, app.topicsOfPlan);
  const originalMessages = JSON.stringify(buildMessages(u.query, original));
  const correctedMessages = JSON.stringify(buildMessages(u.query, c.ctx));
  const originalHash = sha256(originalMessages);
  const correctedHash = sha256(correctedMessages);
  for (let rep = 0; rep < reps; rep++) {
    const s = storedOf(u.id, rep);
    if (s.messagesSha256 !== originalHash) throw new Error(`${u.id}#${rep}: the original harness no longer reproduces the stored messages`);
  }
  if (storedMessages.get(originalHash) !== originalMessages) throw new Error(`${u.id}: stored messages entry differs from the original harness's messages`);
  return { u, original, corrected: c.ctx, notes: c.notes, originalHash, correctedHash, correctedMessages, changed: correctedMessages !== originalMessages };
});
const changedUnits = built.filter((b) => b.changed).map((b) => b.u.id);
console.log(`units ${built.length}; input changed on ${changedUnits.length}: ${changedUnits.join(", ") || "none"}`);

mkdirSync(outDir, { recursive: true });
const msgPath = join(outDir, "messages.jsonl");
const seenMsgs = new Set<string>(existsSync(msgPath) ? readFileSync(msgPath, "utf8").split("\n").filter(Boolean).map((l) => (JSON.parse(l) as { sha256: string }).sha256) : []);
for (const b of built) {
  if (seenMsgs.has(b.correctedHash)) continue;
  seenMsgs.add(b.correctedHash);
  appendFileSync(msgPath, JSON.stringify({ sha256: b.correctedHash, unit: b.u.id, promptVersion: promptVersion(b.corrected), schemaSha256: sha256(JSON.stringify(schemaFor({ query: b.u.query, context: b.corrected, requestId: "x" }))), messages: JSON.parse(b.correctedMessages) as unknown }) + "\n");
}

/** The rule-based planner as the Phase 10 harness ran it (phase10.ts directorDeterministic). */
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

const validation = (raw: string, ctx: PlanningContext, query: string) => {
  const v = validatePlan(raw, ctx, { query, taughtActions: taughtActions(ctx) });
  return { ok: v.ok, parsedJson: v.parsedJson, schemaValid: v.schemaValid, issues: v.issues.map((i) => `${i.code}:${i.path}${i.value ? `=${i.value}` : ""}`) };
};

const rawPath = join(outDir, `${slug}.jsonl`);
writeFileSync(rawPath, "");
const startedAt = new Date().toISOString();
const runEntry: Record<string, unknown> = { planner: plannerId, file: `${slug}.jsonl`, from: `research/benchmark/runs/${fromName}`, commit: gitCommit(), prompt: "helix-plan-prompt-v7 (library commit 6c6cfb7), decoding schema v3", units: units.length, reps, startedAt, node: process.version };
let n = 0;

if (planner === "deterministic") {
  // Check: the current library's rule-based planner on the original contexts gives the stored rows, byte for byte.
  let sameAsStored = 0;
  for (const b of built) for (let rep = 0; rep < reps; rep++) if (JSON.stringify(directorDeterministic(b.u.query, b.original)) === storedOf(b.u.id, rep).raw) sameAsStored++;
  let changedPlans = 0;
  for (let rep = 0; rep < reps; rep++) {
    for (const b of built) {
      const t0 = performance.now();
      const raw = JSON.stringify(directorDeterministic(b.u.query, b.corrected));
      const totalMs = performance.now() - t0;
      if (rep === 0 && raw !== storedOf(b.u.id, 0).raw) changedPlans++;
      appendFileSync(rawPath, JSON.stringify({ planner: plannerId, unit: b.u.id, file: b.u.file, dataset: b.u.dataset, category: b.u.category, sequence: b.u.sequence, turn: b.u.turn, rep, attempt: 1, at: new Date().toISOString(), query: b.u.query, messagesSha256: b.correctedHash, inputChanged: b.changed, context: b.notes, directorWouldSkipModel: false, raw, sameRawAsStored: raw === storedOf(b.u.id, rep).raw, error: null, firstTokenMs: null, totalMs, usage: null, doneReason: null, validation: validation(raw, b.corrected, b.u.query) }) + "\n");
      n++;
    }
  }
  Object.assign(runEntry, { outputs: n, rulesOnOriginalContextsEqualStored: `${sameAsStored}/${built.length * reps}`, unitsWhosePlanChanged: changedPlans });
  console.log(`rules: ${n} outputs; on the original contexts ${sameAsStored}/${built.length * reps} equal the stored rows; ${changedPlans} units changed plan`);
}

if (planner === "ollama") {
  const provider = new OllamaProvider({ model, baseUrl, numPredict: 1024 });
  const version = ((await (await fetch(`${baseUrl}/api/version`)).json()) as { version: string }).version;
  const tags = (await (await fetch(`${baseUrl}/api/tags`)).json()) as { models: { name: string; digest: string; size: number; details?: unknown }[] };
  const t = tags.models.find((m) => m.name === model);
  const firstChanged = built.find((b) => b.changed);
  let warmup: Record<string, unknown> | null = null;
  if (firstChanged) {
    const w0 = Date.now();
    try {
      const o = await provider.plan({ query: firstChanged.u.query, context: firstChanged.corrected, requestId: "warmup", temperature: 0 });
      warmup = { unit: firstChanged.u.id, wallMs: Date.now() - w0, loadMs: o.usage?.loadMs ?? null, firstTokenMs: o.timings.firstTokenMs };
    } catch (e) {
      warmup = { unit: firstChanged.u.id, wallMs: Date.now() - w0, error: (e as Error).message };
    }
    console.log("warm-up", JSON.stringify(warmup));
  }
  let called = 0;
  let reused = 0;
  let failures = 0;
  for (let rep = 0; rep < reps; rep++) {
    for (const b of built) {
      const s = storedOf(b.u.id, rep);
      if (!b.changed) {
        // Reuse: the corrected messages are byte-identical to the stored ones (checked through the stored messages entry).
        if (b.correctedHash !== s.messagesSha256 || storedMessages.get(s.messagesSha256) !== b.correctedMessages) throw new Error(`${b.u.id}#${rep}: reuse refused, messages differ`);
        appendFileSync(rawPath, JSON.stringify({ ...s, inputChanged: false, reusedFrom: `research/benchmark/runs/${fromName}`, reuseCheck: "corrected messages byte-identical to the stored messages" }) + "\n");
        reused++;
        n++;
        continue;
      }
      const at = new Date().toISOString();
      let raw = "";
      let error: { code: string; message: string; partial: string | null } | null = null;
      let firstTokenMs: number | null = null;
      let totalMs: number | null = null;
      let usage: unknown = null;
      let doneReason: unknown = null;
      try {
        const o = await provider.plan({ query: b.u.query, context: b.corrected, requestId: `${b.u.id}#${rep}.1`, temperature: 0 });
        raw = o.raw;
        firstTokenMs = o.timings.firstTokenMs;
        totalMs = o.timings.totalMs;
        usage = o.usage ?? null;
        doneReason = o.meta?.doneReason ?? null;
      } catch (e) {
        error = { code: e instanceof ProviderError ? e.code : "unknown", message: (e as Error).message, partial: (e as { partial?: string }).partial ?? null };
        failures++;
      }
      called++;
      const unresolvedGenes = geneLikeTokens(b.u.query).filter((x) => /\d/.test(x) && resolveGeneQuery(x, hgncRecordsFromContext(b.corrected)).status === "not-found");
      appendFileSync(rawPath, JSON.stringify({ planner: plannerId, unit: b.u.id, file: b.u.file, dataset: b.u.dataset, category: b.u.category, sequence: b.u.sequence, turn: b.u.turn, rep, attempt: 1, at, query: b.u.query, messagesSha256: b.correctedHash, inputChanged: true, originalMessagesSha256: b.originalHash, context: b.notes, directorWouldSkipModel: unresolvedGenes.length > 0, raw, sameRawAsStored: raw === s.raw, error, firstTokenMs, totalMs, usage, doneReason, validation: error ? null : validation(raw, b.corrected, b.u.query) }) + "\n");
      n++;
      console.log(`${b.u.id}#${rep} ${error ? `ERR ${error.code}` : "ok"} ${totalMs !== null ? Math.round(totalMs) : "-"}ms same-as-stored=${raw === s.raw}`);
    }
  }
  Object.assign(runEntry, {
    outputs: n,
    modelCalls: called,
    reusedRows: reused,
    failures,
    retries: 0,
    attempts: 1,
    ollama: { ollamaVersion: version, model, digest: t?.digest ?? null, sizeBytes: t?.size ?? null, details: t?.details ?? null },
    providerConfig: { timeoutMs: 180_000, numCtx: 8192, keepAlive: "60m", numPredict: 1024, temperature: 0, seed: "not sent (the Director sends none)", think: "not sent (the registry sets none)" },
    warmup,
  });
}

runEntry.endedAt = new Date().toISOString();
const after = frozenHashes();
if (after.some((h, i) => h.onDisk !== before[i]!.onDisk)) console.error("FROZEN SET CHANGED DURING THE RUN");
const manifestPath = join(outDir, "manifest.json");
const manifest = existsSync(manifestPath) ? (JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>) : {};
manifest.study = "Re-scoring of the frozen Phase 10 run with the corrected harness (D-H029 answer 87)";
manifest.original = { dir: `research/benchmark/runs/${fromName}`, note: "never written by this run" };
manifest.set = { dir: "research/benchmark/phase10", frozenBy: "D-H023", hashesBefore: before, hashesAfter: after };
manifest.harness = {
  original: "scripts/ai-benchmark/phase10-lib.ts unitContext (unchanged; reproduces every stored messagesSha256)",
  corrected: "scripts/ai-benchmark/phase10-rescore-lib.ts appUnitContext (the app's SelectionBridge and topicsOfPlan; loaded-structure rule phase10-fallback; prompt v7)",
  app: provenance,
};
manifest.inputComparison = { units: built.length, changed: changedUnits, unchanged: built.length - changedUnits.length, method: "byte comparison of JSON.stringify(buildMessages(query, context)) for the original and the corrected context" };
const runs = ((manifest.runs as Record<string, unknown>[] | undefined) ?? []).filter((r) => r.planner !== plannerId);
runs.push(runEntry);
manifest.runs = runs;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + "\n");
console.log(`done ${n} outputs -> ${rawPath}`);
