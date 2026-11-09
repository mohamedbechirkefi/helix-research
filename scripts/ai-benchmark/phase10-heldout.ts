// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Phase 10 held-out run (D-H024; set and prompt v8 frozen by D-H025).
 *
 *   node scripts/ai-benchmark/phase10-heldout.ts --planner rules|ollama|director [--model ministral-3:8b]
 *        [--reps 3] [--attempts 1] [--only <ids>] [--interests restated|app] --out phase10-heldout-<date>
 *
 * --interests (D-H029 answer 87): "restated" (the default, the held-out run of 2026-11-09 as it ran) infers the
 * session interests with the research re-statement interestsFor; "app" with the app's topicsOfPlan (appInterests in
 * phase10-heldout-lib.ts), as the re-scoring run phase10-heldout-rescore-2026-11-09 does.
 *
 * Every unit of research/benchmark/phase10-heldout (40 questions, 4 three-turn follow-ups, 6 injection rows) is
 * planned by the helix-app Director, imported at run time (phase10-heldout-lib.ts), in the session the app's
 * controller would pass for it, with prompt v8:
 * - rules: the Director with the deterministic provider only (the app without a model). Rows hold the plan the
 *   Director returns (after its follow-up filter).
 * - ollama: the model alone, called once per unit and repeat on exactly the context the Director plans with
 *   (the Director's own `context`), with the shipped provider configuration (num_predict 1024, timeout 180 s,
 *   num_ctx 8192, keep_alive 60m, no seed, no think flag), temperature 0. Every unit is sent, including those the
 *   Director would answer without a model (`directorWouldSkipModel`), so the model-alone numbers cover the set.
 * - director: no model call. The Director replays the stored model outputs under the two policies, model-first
 *   (the model plan validated, echo and claim screens, else the rules) and split (D-H024 answer 69, the shipped
 *   default with v8); the replay provider checks that every request the Director makes would send messages and a
 *   decoding schema byte-identical to the stored ones, and the run stops on any mismatch.
 * The frozen hashes are checked before and after and written to the manifest with the app provenance.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { OllamaProvider, ProviderError, buildMessages, deterministicPlan, geneLikeTokens, hgncRecordsFromContext, promptVersion, taughtActions, validatePlan, type PlanningContext } from "@helix/ai-planning";
import { resolveGeneQuery } from "@helix/scientific-core";
import { gitCommit, RUNS_DIR } from "./lib.ts";
import { DATASETS, PHASE10_HELDOUT_DIR, frozenHashes, loadSet, loadUnits, sha256, unitContext, type Dataset, type Unit } from "./phase10-lib.ts";
import {
  ReplayProvider,
  appProvenance,
  appSet,
  deterministicRegistry,
  directorInputs,
  loadApp,
  messagesHash,
  replayRegistry,
  restrictToBuildAgrees,
  schemaHash,
  type AppSet,
  type StoredOutput,
} from "./phase10-heldout-lib.ts";

const args = process.argv.slice(2);
const opt = (k: string, d?: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const planner = opt("planner", "rules")!;
const model = opt("model", "ministral-3:8b")!;
const reps = Number(opt("reps", "3"));
const attempts = Number(opt("attempts", "1"));
const only = opt("only")?.split(",");
const outName = opt("out");
const interests = (opt("interests", "restated") as "restated" | "app");
if (interests !== "restated" && interests !== "app") throw new Error(`unknown --interests ${String(interests)}`);
if (!outName) throw new Error("--out <run dir name> is required");
if (!["rules", "ollama", "director"].includes(planner)) throw new Error(`unknown --planner ${planner}`);
const baseUrl = "http://127.0.0.1:11434";
const outDir = join(RUNS_DIR, outName);
const slug = model.replace(/[^A-Za-z0-9.]+/g, "-");
const modelId = `ollama:${model}`;

const before = frozenHashes(PHASE10_HELDOUT_DIR);
if (before.some((h) => !h.match)) throw new Error(`frozen set hash mismatch: ${JSON.stringify(before)}`);

const app = await loadApp();
const provenance = appProvenance({ withProfile: interests === "app" });
const sets = new Map<Dataset, AppSet>(DATASETS.map((d) => [d, appSet(app, loadSet(d, { planPrompt: "v8" }))]));
let units = loadUnits(PHASE10_HELDOUT_DIR);
if (only) units = units.filter((u) => only.includes(u.id) || (u.sequence !== null && only.includes(u.sequence)));
const restrictAgrees = Object.fromEntries(DATASETS.map((d) => [d, restrictToBuildAgrees(app, sets.get(d)!.set)]));

mkdirSync(outDir, { recursive: true });
const msgPath = join(outDir, "messages.jsonl");
const seenMsgs = new Set<string>(existsSync(msgPath) ? readFileSync(msgPath, "utf8").split("\n").filter(Boolean).map((l) => (JSON.parse(l) as { sha256: string }).sha256) : []);

/** The rule-based Director on the unit, which also yields the context the Director plans with. */
async function rulesDirector(u: Unit) {
  const a = sets.get(u.dataset)!;
  const inp = directorInputs(a, u, { interests, app });
  const d = new app.Director(deterministicRegistry(), inp.base, { policy: "split", claimFacts: a.claimFacts });
  const t0 = performance.now();
  const res = await d.handle(u.query, inp.session, { temperature: 0 });
  const ms = performance.now() - t0;
  const ctx = res.context;
  const rb = deterministicPlan(u.query, ctx);
  // The research re-statement of the same context (phase10-lib unitContext with the D-H024 answer 74 rule).
  const restated = unitContext(a.set, u, { loadedStructure: "app-dh024" }).ctx;
  const unresolved = geneLikeTokens(u.query).filter((t) => /\d/.test(t) && resolveGeneQuery(t, hgncRecordsFromContext(ctx)).status === "not-found");
  const notes = {
    answer: inp.session.answer,
    pathwaysLoaded: inp.pathwaysLoaded,
    associationsLoaded: inp.associationsLoaded,
    selection: inp.session.selection ?? null,
    codon: inp.session.sequenceSelection?.codon ?? null,
    loadedStructureId: ctx.loadedStructureId ?? null,
    binding: ctx.selectionFacts?.binding?.subject ?? null,
    interests: inp.session.personalisation?.interests ?? [],
    bridgeRestatedAgrees: inp.selection.restatedAgrees,
    contextRestatedAgrees: messagesHash(u.query, restated) === messagesHash(u.query, ctx),
    rule: rb.rule,
    splitRoute: app.splitRoute(rb, ctx),
  };
  return { res, ctx, ms, notes, directorWouldSkipModel: unresolved.length > 0 };
}

function logMessages(u: Unit, ctx: PlanningContext): { msgHash: string; schemaSha256: string } {
  const msgHash = messagesHash(u.query, ctx);
  const schemaSha256 = schemaHash(u.query, ctx);
  if (!seenMsgs.has(msgHash)) {
    seenMsgs.add(msgHash);
    appendFileSync(msgPath, JSON.stringify({ sha256: msgHash, unit: u.id, promptVersion: promptVersion(ctx), schemaSha256, messages: buildMessages(u.query, ctx) }) + "\n");
  }
  return { msgHash, schemaSha256 };
}

const startedAt = new Date().toISOString();
const runEntry: Record<string, unknown> = { planner, interests, startedAt, units: units.length, reps, node: process.version, commit: gitCommit(), prompt: "helix-plan-prompt-v8 (library commit 3af6e04), decoding schema v3" };
let n = 0;
let failures = 0;
let retries = 0;
const counters = { bridgeDisagree: 0, contextDisagree: 0, replayCalls: 0, replayMismatch: 0 };

if (planner === "rules") {
  const rawPath = join(outDir, "rules.jsonl");
  writeFileSync(rawPath, "");
  for (let rep = 0; rep < reps; rep++) {
    for (const u of units) {
      const r = await rulesDirector(u);
      const { msgHash } = logMessages(u, r.ctx);
      if (!r.notes.bridgeRestatedAgrees) counters.bridgeDisagree++;
      if (!r.notes.contextRestatedAgrees) counters.contextDisagree++;
      const raw = JSON.stringify(r.res.plan);
      const v = validatePlan(raw, r.ctx, { query: u.query, taughtActions: taughtActions(r.ctx) });
      appendFileSync(rawPath, JSON.stringify({ planner: "rules", unit: u.id, file: u.file, dataset: u.dataset, category: u.category, sequence: u.sequence, turn: u.turn, rep, attempt: 1, at: new Date().toISOString(), query: u.query, messagesSha256: msgHash, context: r.notes, source: r.res.source, usedFallback: r.res.usedFallback, fallbackReason: r.res.fallbackReason, followUpScreen: r.res.followUpScreen, raw, error: null, firstTokenMs: null, totalMs: r.ms, usage: null, doneReason: null, validation: { ok: v.ok, issues: v.issues.map((i) => `${i.code}:${i.path}`) } }) + "\n");
      n++;
    }
  }
}

if (planner === "ollama") {
  const rawPath = join(outDir, `${slug}.jsonl`);
  writeFileSync(rawPath, "");
  const provider = new OllamaProvider({ model, baseUrl, numPredict: 1024 });
  runEntry.providerConfig = { timeoutMs: 180_000, numCtx: 8192, keepAlive: "60m", numPredict: 1024, temperature: 0, seed: "not sent (the Director sends none)", think: "not sent (the registry sets none)" };
  const version = ((await (await fetch(`${baseUrl}/api/version`)).json()) as { version: string }).version;
  const tags = (await (await fetch(`${baseUrl}/api/tags`)).json()) as { models: { name: string; digest: string; size: number; details?: unknown }[] };
  const show = (await (await fetch(`${baseUrl}/api/show`, { method: "POST", body: JSON.stringify({ model }) })).json()) as { capabilities?: string[]; details?: unknown };
  const t = tags.models.find((m) => m.name === model);
  runEntry.ollama = { ollamaVersion: version, model, digest: t?.digest ?? null, sizeBytes: t?.size ?? null, details: t?.details ?? show.details ?? null, capabilities: show.capabilities ?? [] };
  // Warm-up (unscored): the cold load is not a planning latency.
  {
    const u = units[0]!;
    const r = await rulesDirector(u);
    const t0 = Date.now();
    try {
      const o = await provider.plan({ query: u.query, context: r.ctx, requestId: "warmup", temperature: 0 });
      runEntry.warmup = { unit: u.id, wallMs: Date.now() - t0, loadMs: o.usage?.loadMs ?? null, firstTokenMs: o.timings.firstTokenMs };
    } catch (e) {
      runEntry.warmup = { unit: u.id, wallMs: Date.now() - t0, error: (e as Error).message };
    }
    console.log("warm-up", JSON.stringify(runEntry.warmup));
  }
  for (let rep = 0; rep < reps; rep++) {
    for (const u of units) {
      const r = await rulesDirector(u);
      const { msgHash, schemaSha256 } = logMessages(u, r.ctx);
      if (!r.notes.bridgeRestatedAgrees) counters.bridgeDisagree++;
      if (!r.notes.contextRestatedAgrees) counters.contextDisagree++;
      for (let attempt = 1; attempt <= Math.max(1, attempts); attempt++) {
        const at = new Date().toISOString();
        let raw = "";
        let error: { code: string; message: string; partial: string | null } | null = null;
        let firstTokenMs: number | null = null;
        let totalMs: number | null = null;
        let usage: unknown = null;
        let doneReason: unknown = null;
        try {
          const o = await provider.plan({ query: u.query, context: r.ctx, requestId: `${u.id}#${rep}.${attempt}`, temperature: 0 });
          raw = o.raw;
          firstTokenMs = o.timings.firstTokenMs;
          totalMs = o.timings.totalMs;
          usage = o.usage ?? null;
          doneReason = o.meta?.doneReason ?? null;
        } catch (e) {
          error = { code: e instanceof ProviderError ? e.code : "unknown", message: (e as Error).message, partial: (e as { partial?: string }).partial ?? null };
        }
        const v = error ? null : validatePlan(raw, r.ctx, { query: u.query, taughtActions: taughtActions(r.ctx) });
        appendFileSync(rawPath, JSON.stringify({ planner: modelId, unit: u.id, file: u.file, dataset: u.dataset, category: u.category, sequence: u.sequence, turn: u.turn, rep, attempt, at, query: u.query, messagesSha256: msgHash, schemaSha256, context: r.notes, directorWouldSkipModel: r.directorWouldSkipModel, raw, error, firstTokenMs, totalMs, usage, doneReason, validation: v ? { ok: v.ok, parsedJson: v.parsedJson, schemaValid: v.schemaValid, issues: v.issues.map((i) => `${i.code}:${i.path}${i.value ? `=${i.value}` : ""}`) } : null }) + "\n");
        n++;
        console.log(`${String(n).padStart(4)} ${u.id}#${rep}${attempt > 1 ? `.${attempt}` : ""} ${error ? `ERR ${error.code} ${error.message.slice(0, 80)}` : v?.ok ? "valid" : `INVALID ${v?.issues[0]?.code ?? ""}`} ${totalMs !== null ? Math.round(totalMs) : "-"}ms`);
        if (!error) break;
        failures++;
        const retryable = error.code === "unavailable" || error.code === "http" || error.code === "protocol";
        if (!retryable || attempt >= attempts) break;
        retries++;
      }
    }
  }
}

if (planner === "director") {
  const stored = new Map<string, StoredOutput>();
  const modelPath = join(outDir, `${slug}.jsonl`);
  for (const l of readFileSync(modelPath, "utf8").split("\n").filter(Boolean)) {
    const r = JSON.parse(l) as StoredOutput & { unit: string; rep: number };
    stored.set(`${r.unit}#${r.rep}`, r); // the last attempt of (unit, repeat)
  }
  runEntry.replayOf = { file: `${slug}.jsonl`, sha256: sha256(readFileSync(modelPath)) };
  for (const policy of ["model-first", "split"] as const) {
    const name = `director-${policy}`;
    const rawPath = join(outDir, `${name}.jsonl`);
    writeFileSync(rawPath, "");
    for (let rep = 0; rep < reps; rep++) {
      for (const u of units) {
        const a = sets.get(u.dataset)!;
        const inp = directorInputs(a, u, { interests, app });
        const p = new ReplayProvider(modelId);
        p.current = stored.get(`${u.id}#${rep}`) ?? null;
        const d = new app.Director(await replayRegistry(p), inp.base, { policy, claimFacts: a.claimFacts });
        const res = await d.handle(u.query, inp.session, { temperature: 0 });
        counters.replayCalls += p.calls.length;
        const bad = p.calls.filter((c) => !c.messagesMatch || !c.schemaMatch).length;
        counters.replayMismatch += bad;
        if (bad > 0 || (p.calls.length > 0 && !p.current)) throw new Error(`replay mismatch on ${u.id}#${rep} (${policy}): ${JSON.stringify(p.calls)}`);
        const raw = JSON.stringify(res.plan);
        appendFileSync(
          rawPath,
          JSON.stringify({
            planner: name,
            unit: u.id,
            file: u.file,
            dataset: u.dataset,
            category: u.category,
            sequence: u.sequence,
            turn: u.turn,
            rep,
            attempt: 1,
            query: u.query,
            messagesSha256: messagesHash(u.query, res.context),
            modelCalled: p.calls.length > 0,
            modelUsed: res.source === modelId,
            source: res.source,
            usedFallback: res.usedFallback,
            fallbackReason: res.fallbackReason,
            route: res.route,
            claimScreen: res.claimScreen,
            followUpScreen: res.followUpScreen,
            providerValid: res.providerValidation?.ok ?? null,
            raw,
            error: null,
            firstTokenMs: null,
            totalMs: p.calls.length > 0 ? p.current?.totalMs ?? null : null,
            usage: null,
            doneReason: null,
          }) + "\n",
        );
        n++;
      }
    }
  }
}

const endedAt = new Date().toISOString();
const after = frozenHashes(PHASE10_HELDOUT_DIR);
const unchanged = after.every((h, i) => h.onDisk === before[i]!.onDisk);
if (!unchanged) console.error("FROZEN SET CHANGED DURING THE RUN");

const manifestPath = join(outDir, "manifest.json");
const manifest = existsSync(manifestPath) ? (JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>) : {};
manifest.study = interests === "app" ? "Re-scoring of the Phase 10 held-out run with the app's session topics (D-H029 answer 87)" : "Phase 10 held-out run (D-H024; set and prompt v8 frozen by D-H025)";
manifest.interestsRule = interests === "app" ? "app (helix-app session-profile.ts topicsOfPlan, appInterests)" : "restated (phase10-lib.ts interestsFor)";
manifest.set = { dir: "research/benchmark/phase10-heldout", frozenBy: "D-H025", tag: "p10-heldout-frozen (a95a337)", hashesBefore: before, hashesAfterLatestPass: after };
manifest.prompt = { version: "helix-plan-prompt-v8", libraryCommit: "3af6e04", rulesSha256: "9f27640400c263f3db59ad60d94ae21dc79bc294b9ed272e50d3696a84df44f8" };
manifest.loadedStructureRule = "app-dh024 (helix-app Director.contextFor after D-H024 answer 74; the app passes the structure on screen or null)";
manifest.app = provenance;
manifest.restrictToBuildRestatedAgrees = restrictAgrees;
const runs = (manifest.runs as Record<string, unknown>[] | undefined) ?? [];
runs.push({ ...runEntry, endedAt, outputs: n, failures, retries, checks: counters, frozenUnchanged: unchanged });
manifest.runs = runs;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + "\n");
console.log(`done ${planner}: ${n} outputs, ${failures} failures, ${retries} retries; ${startedAt} -> ${endedAt}; checks ${JSON.stringify(counters)}; restrictToBuild agrees ${JSON.stringify(restrictAgrees)}`);
if (!unchanged) process.exit(2);
