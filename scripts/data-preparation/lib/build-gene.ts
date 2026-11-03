// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * The curated dataset build, generic over the gene specification (Phase 9): acquire (live,
 * offline snapshot or recorded fixtures) -> validate -> manifest -> <out>/. Used by
 * build-gene.ts, by the build-hbb.ts wrapper and by the dataset tests.
 *
 * Raw bodies go to the local content-addressed cache (.cache/helix-raw, git-ignored); they
 * may contain third-party identifiers and are never published. Only curated records,
 * filtered by the adapters and checked for proprietary identifiers, are written to the
 * output directory.
 *
 * On any error (network, malformed response, failed validation) nothing is written: the
 * output is written to a sibling temporary directory and swapped in only at the end.
 */
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { HttpClient, RecordCache } from "@helix/data-adapters";
import { type RawRecord, type SliceBuild, type SliceConfig, type SliceInputName, type SliceInputs, acquirePathways, acquireSlice, buildManifest, buildSlice, inputsFor, isPathwayInput, loadGeneSpec } from "@helix/scientific-core";
import type { DatasetManifest } from "@helix/shared-types";
import { type RecordedFixtureSet, redactInputs, writeFixtureSet } from "./fixture-recorder.ts";
import { loadFixtureInputs } from "./fixtures.ts";
import { FsStore, REPO_ROOT, USER_AGENT, gitState } from "./node-env.ts";

export type BuildMode = "live" | "offline" | "fixtures";

/** The script name the manifest's generator field records; the same for every entry point. */
export const GENERATOR_SCRIPT = "scripts/data-preparation/build-gene.ts";

export interface GeneBuildOptions {
  /** The specification's configuration (from data/specs/<gene>.json or built in a test). */
  config: SliceConfig;
  mode: BuildMode;
  /** Output directory (default data/curated/<datasetId>). */
  outDir?: string;
  /** Name of the fixture set under data/fixtures/ for `fixtures` mode (default the datasetId). */
  fixtureSet?: string;
  /**
   * Live or offline mode: record every acquired input (offline: the snapshot of the last live
   * acquisition, same bodies and retrieval times), redacted (Q-H-LIC-1), as
   * data/fixtures/<datasetId>/ and build from those redacted records, so the curated
   * manifest cites the bytes on disk (lib/fixture-recorder.ts).
   *
   * "live-sources" (offline mode with `liveSources`): record only the inputs of the sources
   * fetched live, merged into the existing fixture set (new source folders and index entries;
   * nothing else touched), and redact only those for the build, so that a set whose other
   * records cite the snapshot's own bytes keeps citing them (the HBB set, built offline
   * from the live snapshot, whose fixtures are the frozen research/raw files).
   */
  recordFixtures?: boolean | "live-sources";
  /**
   * Offline mode only: sources fetched live while everything else comes from the snapshot, so
   * that a snapshot that predates a source gains its responses without asking the other
   * sources again (Phase 9, P9.1.2: `reactome`). The merged inputs become the new snapshot.
   */
  liveSources?: LiveSource[];
  log?: (m: string) => void;
}

/** The sources `--live-sources` may name. */
export const LIVE_SOURCES = ["reactome"] as const;
export type LiveSource = (typeof LIVE_SOURCES)[number];

export interface GeneBuildResult {
  outDir: string;
  build: SliceBuild;
  manifest: DatasetManifest;
  fileCount: number;
  /** The fixture set written when `recordFixtures` was set. */
  fixtures?: RecordedFixtureSet;
}

/** Path of a gene specification by its name (the file stem under data/specs/). */
export function specPath(gene: string): string {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(gene)) throw new Error(`gene name "${gene}" is not a specification name (lower-case letters, digits and hyphens)`);
  return join(REPO_ROOT, "data/specs", `${gene}.json`);
}

/** Read and validate data/specs/<gene>.json. */
export async function readSpec(gene: string): Promise<SliceConfig> {
  const p = specPath(gene);
  let text: string;
  try {
    text = await readFile(p, "utf8");
  } catch {
    throw new Error(`no gene specification at ${relative(REPO_ROOT, p)}`);
  }
  return loadGeneSpec(JSON.parse(text));
}

/** Parse the command line shared by build-gene.ts and build-hbb.ts. */
export function parseBuildArgs(args: string[]): { gene: string | null; mode: BuildMode; outDir: string | null; recordFixtures: boolean | "live-sources"; liveSources: LiveSource[] } {
  const mode: BuildMode = args.includes("--offline") ? "offline" : args.includes("--fixtures") ? "fixtures" : "live";
  const value = (flag: string): string | null => {
    const eq = args.find((a) => a.startsWith(`${flag}=`));
    if (eq !== undefined) return eq.slice(flag.length + 1);
    const i = args.indexOf(flag);
    if (i < 0) return null;
    const v = args[i + 1];
    if (v === undefined || v.startsWith("--")) throw new Error(`${flag} needs a value`);
    return v;
  };
  const recordRaw = args.find((a) => a.startsWith("--record-fixtures="))?.slice("--record-fixtures=".length) ?? null;
  if (recordRaw !== null && recordRaw !== "live") throw new Error('--record-fixtures takes no value other than "live" (record only the sources named by --live-sources)');
  const recordFixtures: boolean | "live-sources" = recordRaw === "live" ? "live-sources" : args.includes("--record-fixtures");
  if (recordFixtures && mode === "fixtures") throw new Error("--record-fixtures records a live acquisition (or the snapshot of the last one, with --offline); it cannot be combined with --fixtures");
  const liveRaw = value("--live-sources");
  const liveSources: LiveSource[] = [];
  if (liveRaw !== null) {
    if (mode !== "offline") throw new Error("--live-sources names the sources fetched live beside an offline snapshot; it needs --offline (a live build fetches every source, a fixtures build none)");
    for (const s of liveRaw.split(",").map((x) => x.trim()).filter((x) => x.length > 0)) {
      if (!(LIVE_SOURCES as readonly string[]).includes(s)) throw new Error(`--live-sources: unknown source "${s}" (known: ${LIVE_SOURCES.join(", ")})`);
      if (!liveSources.includes(s as LiveSource)) liveSources.push(s as LiveSource);
    }
    if (liveSources.length === 0) throw new Error("--live-sources needs at least one source name");
  }
  if (recordFixtures === "live-sources" && liveSources.length === 0) throw new Error("--record-fixtures=live needs --live-sources (it records only the sources fetched live beside the offline snapshot)");
  return { gene: value("--gene"), mode, outDir: value("--out"), recordFixtures, liveSources };
}

async function snapshotInputs(cache: RecordCache, store: FsStore, datasetId: string, inputs: SliceInputs, at: string): Promise<void> {
  const keys: Record<string, unknown> = {};
  for (const [name, r] of Object.entries(inputs) as [string, RawRecord | undefined][]) {
    if (!r) continue;
    const key = { source: r.source, recordId: name, version: r.sha256.slice(0, 16), variant: datasetId };
    await cache.put(key, { ...r, status: 200, bytes: new TextEncoder().encode(r.body).byteLength, attempts: 1 });
    keys[name] = key;
  }
  await store.set(`snapshots/${datasetId}-latest.json`, JSON.stringify({ at, keys }, null, 2));
}

async function loadSnapshot(cache: RecordCache, store: FsStore, datasetId: string): Promise<SliceInputs> {
  const raw = await store.get(`snapshots/${datasetId}-latest.json`);
  if (raw === null) throw new Error("no live snapshot in .cache/helix-raw; run a live build first");
  const snap = JSON.parse(raw) as { keys: Record<string, Parameters<RecordCache["lookup"]>[0]> };
  const out: Record<string, RawRecord> = {};
  for (const [name, key] of Object.entries(snap.keys)) {
    const hit = await cache.lookup(key);
    if (!hit.hit) throw new Error(`cache ${hit.reason} for ${name}`);
    const { source, url, method, body, sha256, retrievedAt, headers } = hit.response;
    out[name] = { source, url, method, body, sha256, retrievedAt, headers };
  }
  return out as unknown as SliceInputs;
}

export async function buildGene(o: GeneBuildOptions): Promise<GeneBuildResult> {
  const log = o.log ?? ((m: string) => process.stderr.write(`${m}\n`));
  const config = o.config;
  const outDir = resolve(REPO_ROOT, o.outDir ?? join("data/curated", config.datasetId));
  const cacheRoot = join(REPO_ROOT, ".cache/helix-raw");
  const generatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const store = new FsStore(cacheRoot);
  const cache = new RecordCache(store, { maxEntries: 200 });
  if (o.recordFixtures && o.mode === "fixtures") throw new Error("recordFixtures needs live or offline mode");
  const liveOnly = o.recordFixtures === "live-sources";
  if (liveOnly && (o.mode !== "offline" || !o.liveSources?.length)) throw new Error('recordFixtures "live-sources" needs offline mode with liveSources');
  let inputs: SliceInputs;
  let toRecord: ReturnType<typeof redactInputs>["redacted"] | null = null;
  let mergeRecording = false;
  if (o.mode === "live") {
    const http = new HttpClient({
      userAgent: USER_AGENT,
      onEvent: (e) => {
        if (e.type === "retry") log(`  retry ${e.attempt} in ${e.delayMs} ms (${e.error.code}): ${e.url}`);
      },
    });
    log(`live acquisition for ${config.datasetId} (User-Agent "${USER_AGENT}")`);
    inputs = await acquireSlice(http, config, log);
    await snapshotInputs(cache, store, config.datasetId, inputs, generatedAt);
    if (o.recordFixtures) {
      // Redact before anything is built or written; a body the redaction cannot clean fails here.
      const r = redactInputs(inputsFor(inputs, config));
      inputs = r.inputs;
      toRecord = r.redacted;
      const changed = Object.entries(r.redacted).filter(([, x]) => x.removed.length > 0);
      log(`redaction (Q-H-LIC-1): ${changed.length} of ${Object.keys(r.redacted).length} records changed${changed.length ? `: ${changed.map(([n, x]) => `${n} (${x.removed.length})`).join(", ")}` : ""}`);
    }
  } else if (o.mode === "offline") {
    inputs = await loadSnapshot(cache, store, config.datasetId);
    if (o.liveSources?.includes("reactome") && config.pathways) {
      // Only the named source is asked; the snapshot's other responses stay as they were recorded. The
      // merged inputs become the new snapshot, so the next offline build needs no request at all.
      const http = new HttpClient({
        userAgent: USER_AGENT,
        onEvent: (e) => {
          if (e.type === "retry") log(`  retry ${e.attempt} in ${e.delayMs} ms (${e.error.code}): ${e.url}`);
        },
      });
      log(`offline rebuild of ${config.datasetId} from the snapshot with live Reactome requests only (User-Agent "${USER_AGENT}")`);
      for (const k of Object.keys(inputs)) if (isPathwayInput(k)) delete inputs[k as SliceInputName];
      Object.assign(inputs, await acquirePathways(http, config, log));
      await snapshotInputs(cache, store, config.datasetId, inputs, generatedAt);
    } else if (config.pathways && !inputs.reactomePathways) {
      throw new Error(`the ${config.datasetId} snapshot predates the Reactome requests the specification asks for (pathways: true); rerun with --offline --live-sources=reactome to fetch only those, or run a live build`);
    }
    if (liveOnly) {
      // Only the live-fetched sources are redacted and recorded; the other inputs stay the snapshot's bytes.
      const subset = Object.fromEntries(Object.entries(inputsFor(inputs, config)).filter(([k, r]) => r && isPathwayInput(k))) as unknown as SliceInputs;
      const r = redactInputs(subset);
      Object.assign(inputs, r.inputs);
      toRecord = r.redacted;
      mergeRecording = true;
      const changed = Object.entries(r.redacted).filter(([, x]) => x.removed.length > 0);
      log(`redaction (Q-H-LIC-1) of the live-fetched records only: ${changed.length} of ${Object.keys(r.redacted).length} records changed${changed.length ? `: ${changed.map(([n, x]) => `${n} (${x.removed.length})`).join(", ")}` : ""}`);
    } else if (o.recordFixtures) {
      // The snapshot holds the live responses of the last acquisition (same bodies, same retrieval times), so a
      // recording from it cites exactly what the network returned, without asking the sources again.
      const r = redactInputs(inputsFor(inputs, config));
      inputs = r.inputs;
      toRecord = r.redacted;
      const changed = Object.entries(r.redacted).filter(([, x]) => x.removed.length > 0);
      log(`redaction (Q-H-LIC-1) of the last live snapshot: ${changed.length} of ${Object.keys(r.redacted).length} records changed${changed.length ? `: ${changed.map(([n, x]) => `${n} (${x.removed.length})`).join(", ")}` : ""}`);
    }
  } else {
    inputs = await loadFixtureInputs(o.fixtureSet ?? config.datasetId);
  }
  // A record the specification did not select is never read, whatever the fixture set or snapshot holds.
  inputs = inputsFor(inputs, config);

  const build = await buildSlice(inputs, config, { now: generatedAt });
  const git = gitState();
  const manifest = await buildManifest(build, config, {
    generatedAt,
    script: `${GENERATOR_SCRIPT} (${o.mode})`,
    gitCommit: git.commit,
    gitDirty: git.dirty,
    node: process.version,
    assembly: build.sources.find((s) => s.assembly)?.assembly ?? "unknown",
  });

  // Write to a sibling temp dir, then swap, so a failure never leaves a half-written dataset.
  const tmp = `${outDir}.tmp-${process.pid}`;
  await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });
  for (const f of build.files) await writeFile(join(tmp, f.path), f.content);
  await writeFile(join(tmp, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(resolve(outDir, ".."), { recursive: true });
  await rename(tmp, outDir);

  let fixtures: RecordedFixtureSet | undefined;
  if (toRecord) {
    const sources = [...new Set(Object.values(toRecord).map((x) => x.record.source))].sort();
    fixtures = await writeFixtureSet(
      config.datasetId,
      toRecord,
      mergeRecording
        ? `The ${sources.join(", ")} responses were recorded on ${generatedAt.slice(0, 10)} by scripts/data-preparation/build-gene.ts --gene ${config.datasetId} --offline --live-sources=${sources.join(",")} --record-fixtures=live (live requests to those sources only, everything else from the snapshot), redacted under Q-H-LIC-1 as the other records.`
        : `Offline fixtures for the ${config.datasetId} set, recorded by scripts/data-preparation/build-gene.ts --gene ${config.datasetId} --record-fixtures on ${generatedAt.slice(0, 10)} from the live responses, redacted under Q-H-LIC-1 (proprietary database identifiers removed; each MANIFEST.tsv row carries the original sha256 in its redaction column). Paths are relative to the repository root. Each file is verified against its folder's MANIFEST.tsv sha256 when loaded.`,
      { merge: mergeRecording },
    );
    log(`recorded ${relative(REPO_ROOT, fixtures.dir)}${mergeRecording ? " (merged)" : ""}: ${fixtures.files.length} files (${fixtures.files.filter((f) => f.redacted).length} redacted)`);
  }

  const failed = build.validation.filter((v) => v.result === "fail").length;
  const warned = build.validation.filter((v) => v.result === "warn").length;
  const fileCount = (await readdir(outDir)).length;
  log(`wrote ${relative(REPO_ROOT, outDir)}: ${fileCount} files; ${build.validation.length} checks (${failed} failed, ${warned} warnings); ${build.knownIssues.length} known issues; ${build.drift.length} drift reports`);
  return { outDir, build, manifest, fileCount, ...(fixtures ? { fixtures } : {}) };
}
