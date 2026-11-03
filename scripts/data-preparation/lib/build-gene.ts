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
import { type RawRecord, type SliceBuild, type SliceConfig, type SliceInputs, acquireSlice, buildManifest, buildSlice, inputsFor, loadGeneSpec } from "@helix/scientific-core";
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
   * Live mode only: record every acquired input, redacted (Q-H-LIC-1), as
   * data/fixtures/<datasetId>/ and build from those redacted records, so the curated
   * manifest cites the bytes on disk (lib/fixture-recorder.ts).
   */
  recordFixtures?: boolean;
  log?: (m: string) => void;
}

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
export function parseBuildArgs(args: string[]): { gene: string | null; mode: BuildMode; outDir: string | null; recordFixtures: boolean } {
  const mode: BuildMode = args.includes("--offline") ? "offline" : args.includes("--fixtures") ? "fixtures" : "live";
  const value = (flag: string): string | null => {
    const i = args.indexOf(flag);
    if (i < 0) return null;
    const v = args[i + 1];
    if (v === undefined || v.startsWith("--")) throw new Error(`${flag} needs a value`);
    return v;
  };
  const recordFixtures = args.includes("--record-fixtures");
  if (recordFixtures && mode !== "live") throw new Error("--record-fixtures records a live acquisition; it cannot be combined with --offline or --fixtures");
  return { gene: value("--gene"), mode, outDir: value("--out"), recordFixtures };
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
  if (o.recordFixtures && o.mode !== "live") throw new Error("recordFixtures needs live mode");
  let inputs: SliceInputs;
  let toRecord: ReturnType<typeof redactInputs>["redacted"] | null = null;
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
    fixtures = await writeFixtureSet(
      config.datasetId,
      toRecord,
      `Offline fixtures for the ${config.datasetId} set, recorded by scripts/data-preparation/build-gene.ts --gene ${config.datasetId} --record-fixtures on ${generatedAt.slice(0, 10)} from the live responses, redacted under Q-H-LIC-1 (OMIM/MIM/HGMD identifiers removed; each MANIFEST.tsv row carries the original sha256 in its redaction column). Paths are relative to the repository root. Each file is verified against its folder's MANIFEST.tsv sha256 when loaded.`,
    );
    log(`recorded ${relative(REPO_ROOT, fixtures.dir)}: ${fixtures.files.length} files (${fixtures.files.filter((f) => f.redacted).length} redacted)`);
  }

  const failed = build.validation.filter((v) => v.result === "fail").length;
  const warned = build.validation.filter((v) => v.result === "warn").length;
  const fileCount = (await readdir(outDir)).length;
  log(`wrote ${relative(REPO_ROOT, outDir)}: ${fileCount} files; ${build.validation.length} checks (${failed} failed, ${warned} warnings); ${build.knownIssues.length} known issues; ${build.drift.length} drift reports`);
  return { outDir, build, manifest, fileCount, ...(fixtures ? { fixtures } : {}) };
}
