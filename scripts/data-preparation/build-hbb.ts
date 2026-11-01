// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Curated HBB dataset build (P2.5.1): fetch -> validate -> manifest -> data/curated/hbb/.
 *
 *   node scripts/data-preparation/build-hbb.ts                 live fetch (default)
 *   node scripts/data-preparation/build-hbb.ts --offline       rebuild from the last live snapshot in .cache/
 *   node scripts/data-preparation/build-hbb.ts --fixtures      build from the recorded test fixtures
 *   options: --out <dir> (default data/curated/hbb)
 *
 * Raw bodies go to the local content-addressed cache (.cache/helix-raw, git-ignored); they
 * may contain third-party identifiers and are never published. Only curated records,
 * filtered by the adapters and checked for proprietary identifiers, are written to --out.
 *
 * On any error (network, malformed response, failed validation) nothing is written and the
 * process exits with status 2 and a typed message (P2.5.2).
 */
import { mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { HttpClient, RecordCache, isHelixDataError } from "@helix/data-adapters";
import { HBB_CONFIG, type RawRecord, type SliceInputs, acquireSlice, buildManifest, buildSlice } from "@helix/scientific-core";
import { loadFixtureInputs } from "./lib/fixtures.ts";
import { FsStore, REPO_ROOT, USER_AGENT, gitState } from "./lib/node-env.ts";

const args = process.argv.slice(2);
const mode = args.includes("--offline") ? "offline" : args.includes("--fixtures") ? "fixtures" : "live";
const outArg = args.indexOf("--out");
const outDir = resolve(REPO_ROOT, outArg >= 0 ? args[outArg + 1]! : "data/curated/hbb");
const cacheRoot = join(REPO_ROOT, ".cache/helix-raw");
const config = HBB_CONFIG;

function log(m: string): void {
  process.stderr.write(`${m}\n`);
}

async function snapshotInputs(cache: RecordCache, store: FsStore, inputs: SliceInputs, at: string): Promise<void> {
  const keys: Record<string, unknown> = {};
  for (const [name, r] of Object.entries(inputs) as [string, RawRecord | undefined][]) {
    if (!r) continue;
    const key = { source: r.source, recordId: name, version: r.sha256.slice(0, 16), variant: config.datasetId };
    await cache.put(key, { ...r, status: 200, bytes: new TextEncoder().encode(r.body).byteLength, attempts: 1 });
    keys[name] = key;
  }
  await store.set(`snapshots/${config.datasetId}-latest.json`, JSON.stringify({ at, keys }, null, 2));
}

async function loadSnapshot(cache: RecordCache, store: FsStore): Promise<SliceInputs> {
  const raw = await store.get(`snapshots/${config.datasetId}-latest.json`);
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

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const store = new FsStore(cacheRoot);
  const cache = new RecordCache(store, { maxEntries: 200 });
  let inputs: SliceInputs;
  if (mode === "live") {
    const http = new HttpClient({
      userAgent: USER_AGENT,
      onEvent: (e) => {
        if (e.type === "retry") log(`  retry ${e.attempt} in ${e.delayMs} ms (${e.error.code}): ${e.url}`);
      },
    });
    log(`live acquisition for ${config.datasetId} (User-Agent "${USER_AGENT}")`);
    inputs = await acquireSlice(http, config, log);
    await snapshotInputs(cache, store, inputs, generatedAt);
  } else if (mode === "offline") {
    inputs = await loadSnapshot(cache, store);
  } else {
    inputs = await loadFixtureInputs();
  }

  const build = await buildSlice(inputs, config, { now: generatedAt });
  const git = gitState();
  const manifest = await buildManifest(build, config, {
    generatedAt,
    script: `scripts/data-preparation/build-hbb.ts (${mode})`,
    gitCommit: git.commit,
    gitDirty: git.dirty,
    node: process.version,
    assembly: (build.sources.find((s) => s.assembly)?.assembly ?? "unknown"),
  });

  // Write to a sibling temp dir, then swap, so a failure never leaves a half-written dataset.
  const tmp = `${outDir}.tmp-${process.pid}`;
  await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });
  for (const f of build.files) await writeFile(join(tmp, f.path), f.content);
  await writeFile(join(tmp, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await rm(outDir, { recursive: true, force: true });
  await rename(tmp, outDir);

  const failed = build.validation.filter((v) => v.result === "fail").length;
  const warned = build.validation.filter((v) => v.result === "warn").length;
  log(`wrote ${relative(REPO_ROOT, outDir)}: ${(await readdir(outDir)).length} files; ${build.validation.length} checks (${failed} failed, ${warned} warnings); ${build.knownIssues.length} known issues; ${build.drift.length} drift reports`);
  process.stdout.write(`${JSON.stringify(build.summary, null, 2)}\n`);
}

main().catch((e: unknown) => {
  if (isHelixDataError(e)) {
    log(`build failed (${e.code}${e.url ? `, ${e.url}` : ""}): ${e.userMessage()}`);
  } else {
    log(`build failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  log("nothing was written");
  process.exit(2);
});
