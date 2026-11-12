// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * D-H041 item 4 (finding P11-S-01, docs/scientific-validation.md section 7): record the inputs of the committed HBB
 * curated set as a public fixture set, data/fixtures/hbb/curated/, so that the set can be rebuilt offline from
 * public recorded inputs as the other four curated sets are:
 *
 *   node scripts/data-preparation/record-hbb-curated-inputs.ts
 *   node scripts/data-preparation/build-gene.ts --gene hbb --fixtures --fixture-set hbb/curated --out <dir>
 *
 * The committed HBB set was built offline from the Phase 6 live snapshot (2026-11-02, with the Phase 9 Reactome and
 * Open Targets requests of 2026-11-03), whose bodies sit in the local snapshot cache (.cache/helix-raw, not in the
 * repository). data/fixtures/hbb/index.json keeps pointing at the Phase 1 and 2 bodies, which the package tests read.
 * No request is made. For each input of the snapshot, in order:
 *   1. public: a public fixture whose MANIFEST.tsv row has the same sha256 and the same URL (research/raw,
 *      data/fixtures/hbb/<source>/) is referenced, not copied;
 *   2. cache: the body held in the local snapshot cache is recorded with its URL, retrieval time and kept headers,
 *      redacted under Q-H-LIC-1 exactly as the fixture recorder redacts (a redacted body's MANIFEST row carries the
 *      original sha256 in its redaction column);
 *   3. public-redacted: a cached body that the recorder's redaction cannot clean (a proprietary identifier left in
 *      free text) is not written; the public body whose MANIFEST row names it as its original (the Phase 1 redaction
 *      of the same bytes) is referenced instead;
 *   4. reconstructed: a body held nowhere whose bytes are a re-ordering of the keys of a public body of the same URL
 *      (Ensembl serialises an object's keys in no fixed order) is rebuilt by trying every key order, kept only if its
 *      sha256 equals the one the curated set cites, and recorded with the curated set's retrieval time (its response
 *      headers were not kept, so none are recorded);
 *   5. substitute: otherwise the public body of the same URL is referenced and reported: a different response to
 *      the same request, whose sha256 differs from the one the curated set cites.
 */
import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { ProprietaryContentError } from "@helix/data-adapters";
import type { RawRecord } from "@helix/scientific-core";
import { type ManifestRow, readManifest } from "./lib/fixtures.ts";
import { type RedactedRecord, redactRecord, serialiseFixtureIndex, writeFixtureSet } from "./lib/fixture-recorder.ts";
import { REPO_ROOT } from "./lib/node-env.ts";

const SET_PATH = "hbb/curated";
/** The largest number of key orders tried for one body (step 4). */
const MAX_ORDERS = 1_000_000;

const sha = (b: Buffer | string): string => createHash("sha256").update(b).digest("hex");
const cacheRoot = join(REPO_ROOT, ".cache/helix-raw");
const snapshot = JSON.parse(await readFile(join(cacheRoot, "snapshots/hbb-latest.json"), "utf8")) as { at: string; keys: Record<string, { source: string; recordId: string; version: string; variant: string }> };
const curated = JSON.parse(await readFile(join(REPO_ROOT, "data/curated/hbb/manifest.json"), "utf8")) as { sources: { source: string; url: string; sha256: string; retrievedAt: string; method: "GET" | "POST" }[] };

/** Every MANIFEST.tsv row of the public fixtures the HBB set may reference (not the set written here), with its redaction note. */
const publicRows: { path: string; row: ManifestRow; redaction: string }[] = [];
async function collect(dir: string): Promise<void> {
  const names = await readdir(dir).catch(() => [] as string[]);
  if (names.includes("MANIFEST.tsv")) {
    const lines = (await readFile(join(dir, "MANIFEST.tsv"), "utf8")).split("\n").filter((l) => l.trim().length > 0);
    const col = lines[0]!.split("\t").indexOf("redaction");
    const rows = await readManifest(dir);
    rows.forEach((row, i) => publicRows.push({ path: relative(REPO_ROOT, join(dir, row.file)), row, redaction: lines[i + 1]!.split("\t")[col] ?? "" }));
  }
  for (const n of names) {
    const p = join(dir, n);
    if ((await stat(p)).isDirectory() && relative(REPO_ROOT, p) !== join("data/fixtures", SET_PATH)) await collect(p);
  }
}
await collect(join(REPO_ROOT, "research/raw"));
await collect(join(REPO_ROOT, "data/fixtures/hbb"));

/** Step 4: the compact serialisation of `value` whose sha256 is `target`, over every key order of its objects, or null. */
function reconstruct(value: unknown, target: string): string | null {
  const objects: Record<string, unknown>[] = [];
  const visit = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(visit);
    else if (v !== null && typeof v === "object") {
      objects.push(v as Record<string, unknown>);
      Object.values(v).forEach(visit);
    }
  };
  visit(value);
  const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));
  if (objects.reduce((a, o) => a * fact(Object.keys(o).length), 1) > MAX_ORDERS) return null;
  const perms = (a: string[]): string[][] => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
  const choices = objects.map((o) => perms(Object.keys(o)));
  const order = new Map<object, string[]>();
  const ser = (v: unknown): string => (Array.isArray(v) ? `[${v.map(ser).join(",")}]` : v !== null && typeof v === "object" ? `{${order.get(v)!.map((k) => `${JSON.stringify(k)}:${ser((v as Record<string, unknown>)[k])}`).join(",")}}` : JSON.stringify(v));
  const pick = (i: number): string | null => {
    if (i === objects.length) {
      const s = ser(value);
      return sha(s) === target ? s : null;
    }
    for (const c of choices[i]!) {
      order.set(objects[i]!, c);
      const r = pick(i + 1);
      if (r !== null) return r;
    }
    return null;
  };
  return pick(0);
}

type How = "public" | "cache" | "public-redacted" | "reconstructed" | "substitute";
interface Planned { name: string; source: string; url: string; sha256: string; how: How; path?: string; record?: RedactedRecord; note?: string }
const plan: Planned[] = [];
for (const [name, key] of Object.entries(snapshot.keys)) {
  let meta: { source: string; url: string; method: "GET" | "POST"; sha256: string; retrievedAt: string; headers: Record<string, string> } | null = null;
  try {
    meta = JSON.parse(await readFile(join(cacheRoot, "index", key.source, encodeURIComponent(key.recordId), key.version, key.variant), "utf8"));
  } catch {
    meta = null;
  }
  const cited = curated.sources.find((s) => s.sha256.startsWith(key.version) && (!meta || s.url === meta.url));
  const url = meta?.url ?? cited?.url;
  const full = meta?.sha256 ?? cited?.sha256;
  if (!url || !full) throw new Error(`${name}: neither the cache nor the curated manifest names its URL (snapshot version ${key.version})`);
  const base = { name, source: key.source, url, sha256: full };
  const pub = publicRows.find((p) => p.row.sha256 === full && p.row.url === url);
  if (pub) {
    plan.push({ ...base, how: "public", path: pub.path });
    continue;
  }
  if (meta) {
    const body = await readFile(join(cacheRoot, "blob", meta.sha256), "utf8");
    if (sha(body) !== meta.sha256) throw new Error(`${name}: cached body sha256 differs from its index entry`);
    const raw: RawRecord = { source: meta.source as RawRecord["source"], url: meta.url, method: meta.method, body, sha256: meta.sha256, retrievedAt: meta.retrievedAt, headers: meta.headers };
    try {
      plan.push({ ...base, how: "cache", record: redactRecord(raw, name) });
    } catch (e) {
      if (!(e instanceof ProprietaryContentError)) throw e;
      const red = publicRows.find((p) => p.redaction.includes(`original sha256 ${full}`));
      if (!red) throw new Error(`${name}: the redaction leaves a proprietary identifier (${e.message}) and no public redaction of these bytes exists`);
      plan.push({ ...base, how: "public-redacted", path: red.path, note: `the recorder's redaction leaves ${e.message.replace(/^.*?: /, "")}; referenced: the Phase 1 redaction of the same bytes` });
    }
    continue;
  }
  const same = publicRows.filter((p) => p.row.url === url);
  let rebuilt: string | null = null;
  for (const p of same) {
    rebuilt = reconstruct(JSON.parse(await readFile(join(REPO_ROOT, p.path), "utf8")), full);
    if (rebuilt !== null) {
      const raw: RawRecord = { source: key.source as RawRecord["source"], url, method: cited?.method ?? "GET", body: rebuilt, sha256: full, retrievedAt: cited!.retrievedAt, headers: {} };
      plan.push({ ...base, how: "reconstructed", record: redactRecord(raw, name), note: `the key order of ${p.path} whose sha256 is the cited one` });
      break;
    }
  }
  if (rebuilt === null) {
    if (same.length === 0) throw new Error(`${name}: no body of ${url} is recorded anywhere`);
    plan.push({ ...base, how: "substitute", path: same[0]!.path, note: `sha256 ${same[0]!.row.sha256} (retrieved ${same[0]!.row.retrievedUtc}); no key order of a public body of this URL gives the cited sha256` });
  }
}

const toRecord: Record<string, RedactedRecord> = {};
for (const p of plan) if (p.record) toRecord[p.name] = p.record;
const date = new Date().toISOString().slice(0, 10);
const description = `The inputs of the committed HBB curated set (data/curated/hbb), recorded on ${date} by scripts/data-preparation/record-hbb-curated-inputs.ts (D-H041, P11-S-01) from the local snapshot cache of the Phase 6 live build of 2026-11-02 (Reactome and Open Targets of 2026-11-03). Inputs whose exact bytes and URL are already public are referenced where they are (research/raw, data/fixtures/hbb). The bodies held only in the cache are recorded here, redacted under Q-H-LIC-1 as the other sets' (a redacted body's MANIFEST.tsv row carries the original sha256 in its redaction column); the UniProt body, which the recorder's redaction cannot clean, is referenced in its Phase 1 redaction (research/raw/uniprot). The codon map, held nowhere, was rebuilt from the Phase 1 body of the same URL by its key order and matches the sha256 the curated set cites; its response headers were not kept. The assembly body, held nowhere and not rebuildable, is the Phase 1 body of the same URL. Paths are relative to the repository root. Each file is verified against its folder's MANIFEST.tsv sha256 when loaded. Build with build-gene.ts --gene hbb --fixtures --fixture-set hbb/curated.`;
const written = await writeFixtureSet("hbb", toRecord, description, { path: SET_PATH });
// The index lists every input of the snapshot, in its order: the recorded ones where they were written, the others where they already are.
const index = JSON.parse(await readFile(written.indexPath, "utf8")) as { inputs: Record<string, { source: string; path: string }> };
const inputs: Record<string, { source: string; path: string }> = {};
for (const p of plan) inputs[p.name] = p.record ? index.inputs[p.name]! : { source: p.source, path: p.path! };
await writeFile(written.indexPath, serialiseFixtureIndex({ description, inputs, extra: {} }));

const report = plan.map((p) => {
  const f = written.files.find((x) => x.name === p.name);
  return { input: p.name, how: p.how, url: p.url, citedSha256: p.sha256, path: f?.path ?? p.path, sha256: f?.sha256 ?? publicRows.find((r) => r.path === p.path)?.row.sha256, bytes: f?.bytes, redacted: f?.redacted ?? false, ...(p.note ? { note: p.note } : {}) };
});
for (const r of report) console.error(`${r.how.padEnd(15)} ${r.input}  ${r.path}  ${r.sha256}${r.sha256 === r.citedSha256 ? "" : `  (cited ${r.citedSha256})`}`);
const out = process.argv.slice(2).find((a) => a.startsWith("--report="))?.slice("--report=".length);
if (out) await writeFile(out, `${JSON.stringify({ date, set: `data/fixtures/${SET_PATH}`, inputs: report }, null, 2)}\n`);
const count = (h: How): number => plan.filter((p) => p.how === h).length;
console.error(`${relative(REPO_ROOT, written.indexPath)}: ${plan.length} inputs: ${count("public")} public, ${count("cache")} recorded from the cache, ${count("public-redacted")} public redaction, ${count("reconstructed")} reconstructed, ${count("substitute")} substitute`);
