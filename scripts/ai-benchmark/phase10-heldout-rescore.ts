// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Re-scoring of the Phase 10 held-out run with the app's session topics (D-H029 answer 87): the model step.
 *
 *   HELIX_APP_DIR=<clean helix-app checkout> node scripts/ai-benchmark/phase10-heldout-rescore.ts
 *        [--model ministral-3:8b] [--reps 3] [--from phase10-heldout-2026-11-09] --out phase10-heldout-rescore-<date>
 *
 * Every held-out unit's context is taken from the helix-app Director twice: with the interests of the run as it ran
 * (directorInputs, interests "restated") and with the app's topicsOfPlan (interests "app"). The original messages must
 * hash to the stored messagesSha256 (and schema) of every stored model row of the unit, or the run stops. The model is
 * called only on the units whose corrected messages differ, with the held-out run's parameters (temperature 0,
 * num_predict 1024, num_ctx 8192, keep_alive 60m, timeout 180 s, one attempt, no seed, no think flag); every other row
 * is the stored row, reused after checking that the corrected messages and schema are byte-identical.
 * The rules and the two Director policies are then run by phase10-heldout.ts with --interests app on the same
 * directory (the replays check every request against these rows byte for byte).
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { OllamaProvider, ProviderError, buildMessages, promptVersion, taughtActions, validatePlan, type PlanningContext } from "@helix/ai-planning";
import { gitCommit, RUNS_DIR } from "./lib.ts";
import { DATASETS, PHASE10_HELDOUT_DIR, frozenHashes, loadSet, loadUnits, type Dataset, type Unit } from "./phase10-lib.ts";
import { appProvenance, appSet, deterministicRegistry, directorInputs, loadApp, messagesHash, schemaHash, type AppSet, type InterestsRule } from "./phase10-heldout-lib.ts";

const args = process.argv.slice(2);
const opt = (k: string, d?: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const model = opt("model", "ministral-3:8b")!;
const reps = Number(opt("reps", "3"));
const fromName = opt("from", "phase10-heldout-2026-11-09")!;
const outName = opt("out");
if (!outName) throw new Error("--out <run dir name> is required");
if (outName === fromName) throw new Error("--out must differ from --from: the original run directory is never written");
const baseUrl = "http://127.0.0.1:11434";
const fromDir = join(RUNS_DIR, fromName);
const outDir = join(RUNS_DIR, outName);
const slug = model.replace(/[^A-Za-z0-9.]+/g, "-");
const modelId = `ollama:${model}`;

const before = frozenHashes(PHASE10_HELDOUT_DIR);
if (before.some((h) => !h.match)) throw new Error(`frozen set hash mismatch: ${JSON.stringify(before)}`);
const app = await loadApp();
const provenance = appProvenance({ withProfile: true });
if (!provenance.filesClean) throw new Error(`helix-app files not clean at ${provenance.commit}: import from a clean checkout (HELIX_APP_DIR)`);
const sets = new Map<Dataset, AppSet>(DATASETS.map((d) => [d, appSet(app, loadSet(d, { planPrompt: "v8" }))]));
const units = loadUnits(PHASE10_HELDOUT_DIR);

interface StoredRow {
  unit: string;
  rep: number;
  raw: string;
  messagesSha256: string;
  schemaSha256: string;
  [k: string]: unknown;
}
const stored = readFileSync(join(fromDir, `${slug}.jsonl`), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l) as StoredRow);
const storedOf = (unit: string, rep: number): StoredRow => {
  const rs = stored.filter((r) => r.unit === unit && r.rep === rep);
  if (rs.length !== 1) throw new Error(`${unit}#${rep}: ${rs.length} stored rows (one attempt expected)`);
  return rs[0]!;
};

/** The context the app Director plans the unit in, under the interests rule. */
async function directorContext(u: Unit, interests: InterestsRule): Promise<PlanningContext> {
  const a = sets.get(u.dataset)!;
  const inp = directorInputs(a, u, { interests, app });
  const res = await new app.Director(deterministicRegistry(), inp.base, { policy: "split", claimFacts: a.claimFacts }).handle(u.query, inp.session, { temperature: 0 });
  return res.context;
}

interface Built {
  u: Unit;
  corrected: PlanningContext;
  originalHash: string;
  correctedHash: string;
  correctedSchema: string;
  interestsBefore: string[];
  interestsAfter: string[];
  changed: boolean;
}
const built: Built[] = [];
for (const u of units) {
  const original = await directorContext(u, "restated");
  const corrected = await directorContext(u, "app");
  const originalMessages = JSON.stringify(buildMessages(u.query, original));
  const correctedMessages = JSON.stringify(buildMessages(u.query, corrected));
  const originalHash = messagesHash(u.query, original);
  for (let rep = 0; rep < reps; rep++) {
    const s = storedOf(u.id, rep);
    if (s.messagesSha256 !== originalHash || s.schemaSha256 !== schemaHash(u.query, original)) throw new Error(`${u.id}#${rep}: the original inputs no longer reproduce the stored request`);
  }
  built.push({
    u,
    corrected,
    originalHash,
    correctedHash: messagesHash(u.query, corrected),
    correctedSchema: schemaHash(u.query, corrected),
    interestsBefore: original.personalisation?.interests ?? [],
    interestsAfter: corrected.personalisation?.interests ?? [],
    changed: correctedMessages !== originalMessages,
  });
}
const changedUnits = built.filter((b) => b.changed).map((b) => b.u.id);
console.log(`units ${built.length}; input changed on ${changedUnits.length}: ${changedUnits.join(", ") || "none"}`);

mkdirSync(outDir, { recursive: true });
const msgPath = join(outDir, "messages.jsonl");
const seen = new Set<string>(existsSync(msgPath) ? readFileSync(msgPath, "utf8").split("\n").filter(Boolean).map((l) => (JSON.parse(l) as { sha256: string }).sha256) : []);
for (const b of built) {
  if (seen.has(b.correctedHash)) continue;
  seen.add(b.correctedHash);
  appendFileSync(msgPath, JSON.stringify({ sha256: b.correctedHash, unit: b.u.id, promptVersion: promptVersion(b.corrected), schemaSha256: b.correctedSchema, messages: buildMessages(b.u.query, b.corrected) }) + "\n");
}

const provider = new OllamaProvider({ model, baseUrl, numPredict: 1024 });
const version = ((await (await fetch(`${baseUrl}/api/version`)).json()) as { version: string }).version;
const tags = (await (await fetch(`${baseUrl}/api/tags`)).json()) as { models: { name: string; digest: string; size: number; details?: unknown }[] };
const t = tags.models.find((m) => m.name === model);
const startedAt = new Date().toISOString();
let warmup: Record<string, unknown> | null = null;
const firstChanged = built.find((b) => b.changed);
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
const rawPath = join(outDir, `${slug}.jsonl`);
writeFileSync(rawPath, "");
let called = 0;
let reused = 0;
let failures = 0;
for (let rep = 0; rep < reps; rep++) {
  for (const b of built) {
    const s = storedOf(b.u.id, rep);
    if (!b.changed) {
      if (b.correctedHash !== s.messagesSha256 || b.correctedSchema !== s.schemaSha256) throw new Error(`${b.u.id}#${rep}: reuse refused, request differs`);
      appendFileSync(rawPath, JSON.stringify({ ...s, inputChanged: false, reusedFrom: `research/benchmark/runs/${fromName}`, reuseCheck: "corrected messages and schema byte-identical to the stored request" }) + "\n");
      reused++;
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
    const v = error ? null : validatePlan(raw, b.corrected, { query: b.u.query, taughtActions: taughtActions(b.corrected) });
    const context = { ...(s.context as Record<string, unknown>), interests: b.interestsAfter };
    appendFileSync(rawPath, JSON.stringify({ planner: modelId, unit: b.u.id, file: b.u.file, dataset: b.u.dataset, category: b.u.category, sequence: b.u.sequence, turn: b.u.turn, rep, attempt: 1, at, query: b.u.query, messagesSha256: b.correctedHash, schemaSha256: b.correctedSchema, inputChanged: true, originalMessagesSha256: b.originalHash, context, directorWouldSkipModel: s.directorWouldSkipModel, raw, sameRawAsStored: raw === s.raw, error, firstTokenMs, totalMs, usage, doneReason, validation: v ? { ok: v.ok, parsedJson: v.parsedJson, schemaValid: v.schemaValid, issues: v.issues.map((i) => `${i.code}:${i.path}${i.value ? `=${i.value}` : ""}`) } : null }) + "\n");
    console.log(`${b.u.id}#${rep} ${error ? `ERR ${error.code}` : "ok"} ${totalMs !== null ? Math.round(totalMs) : "-"}ms same-as-stored=${raw === s.raw}`);
  }
}
const endedAt = new Date().toISOString();
const after = frozenHashes(PHASE10_HELDOUT_DIR);
const unchanged = after.every((h, i) => h.onDisk === before[i]!.onDisk);
const manifestPath = join(outDir, "manifest.json");
const manifest = existsSync(manifestPath) ? (JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>) : {};
manifest.original = { dir: `research/benchmark/runs/${fromName}`, note: "never written by this run" };
manifest.inputComparison = {
  units: built.length,
  changed: built.filter((b) => b.changed).map((b) => ({ unit: b.u.id, interestsBefore: b.interestsBefore, interestsAfter: b.interestsAfter })),
  unchanged: built.length - changedUnits.length,
  method: "byte comparison of JSON.stringify(buildMessages(query, context)), the context being the helix-app Director's with interests restated and app",
};
const runs = ((manifest.runs as Record<string, unknown>[] | undefined) ?? []).filter((r) => r.planner !== "ollama");
runs.push({ planner: "ollama", interests: "app", step: "model on changed units only, stored rows reused otherwise", startedAt, endedAt, units: units.length, reps, node: process.version, commit: gitCommit(), prompt: "helix-plan-prompt-v8 (library commit 3af6e04), decoding schema v3", app: provenance, modelCalls: called, reusedRows: reused, failures, retries: 0, attempts: 1, ollama: { ollamaVersion: version, model, digest: t?.digest ?? null, sizeBytes: t?.size ?? null, details: t?.details ?? null }, providerConfig: { timeoutMs: 180_000, numCtx: 8192, keepAlive: "60m", numPredict: 1024, temperature: 0, seed: "not sent (the Director sends none)", think: "not sent (the registry sets none)" }, warmup, hashesBefore: before, hashesAfter: after, frozenUnchanged: unchanged });
manifest.runs = runs;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + "\n");
console.log(`done: ${called} model calls, ${reused} rows reused -> ${rawPath}`);
if (!unchanged) process.exit(2);
