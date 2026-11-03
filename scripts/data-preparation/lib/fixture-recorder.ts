// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Record the inputs of a live build as an offline fixture set (Phase 9, P9.2.4), so that
 * any gene's curated set can be rebuilt and tested on any machine without the network:
 * data/fixtures/<datasetId>/<source>/<file> with a MANIFEST.tsv per source folder in the
 * format record-fixtures.ts writes, and data/fixtures/<datasetId>/index.json in the shape
 * of data/fixtures/hbb/index.json (inputs only; extra empty).
 *
 * Every JSON body receives the redaction research/raw received (Q-H-LIC-1): objects and
 * keys naming OMIM/MIM or HGMD are removed, the body is re-serialised (indent 1, as the
 * Phase 1 snapshot was) and the MANIFEST row carries the new sha256 with the original one
 * in its redaction column. A body in which a proprietary identifier remains after that is
 * never written: the recording fails. The build that records consumes the redacted
 * records, so the curated manifest cites exactly the bytes on disk.
 */
import { createHash } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { ProprietaryContentError, findProprietaryIdentifiers, parseJsonBody, redactProprietaryIdentifiers } from "@helix/data-adapters";
import type { RawRecord, SliceInputs } from "@helix/scientific-core";
import { REPO_ROOT } from "./node-env.ts";

export const MANIFEST_HEADER = "file\tretrieved_utc\thttp_status\tsha256\tbytes\tmethod\turl\theaders\tredaction\n";

export interface RedactedRecord {
  record: RawRecord;
  /** The sha256 of the body as retrieved; equals record.sha256 when nothing was removed. */
  originalSha256: string;
  removed: string[];
}

function isJsonBody(r: RawRecord): boolean {
  if (/\.(cif|fa|fasta)$/.test(new URL(r.url).pathname)) return false;
  if (/text\/x-fasta|format=fasta/.test(r.url)) return false;
  const ct = r.headers["content-type"] ?? "";
  if (/json/.test(ct)) return true;
  if (/text\/plain|chemical\/x-mmcif|x-fasta/.test(ct)) return false;
  return r.body.trimStart().startsWith("{") || r.body.trimStart().startsWith("[");
}

/** Apply the Q-H-LIC-1 redaction to one record; a text body is scanned but never altered. */
export function redactRecord(r: RawRecord, name: string): RedactedRecord {
  if (!isJsonBody(r)) {
    const hits = findProprietaryIdentifiers(r.body);
    if (hits.length > 0) throw new ProprietaryContentError(hits.map((h) => `${name}: ${h}`));
    return { record: r, originalSha256: r.sha256, removed: [] };
  }
  const { value, removed } = redactProprietaryIdentifiers(parseJsonBody(r.body, r.url));
  const hits = findProprietaryIdentifiers(value);
  if (hits.length > 0) throw new ProprietaryContentError(hits.map((h) => `${name} (after redaction): ${h}`));
  if (removed.length === 0) return { record: r, originalSha256: r.sha256, removed };
  const body = JSON.stringify(value, null, 1);
  const sha256 = createHash("sha256").update(body).digest("hex");
  return { record: { ...r, body, sha256 }, originalSha256: r.sha256, removed };
}

/** Redact every input; returns the inputs to build from and what each recording needs. */
export function redactInputs(inputs: SliceInputs): { inputs: SliceInputs; redacted: Record<string, RedactedRecord> } {
  const out: Record<string, RawRecord> = {};
  const redacted: Record<string, RedactedRecord> = {};
  for (const [name, r] of Object.entries(inputs) as [string, RawRecord | undefined][]) {
    if (!r) continue;
    const x = redactRecord(r, name);
    out[name] = x.record;
    redacted[name] = x;
  }
  return { inputs: out as unknown as SliceInputs, redacted };
}

/** A file name from the request URL: path and query (without Ensembl's content-type), sanitised, with the body's extension. */
export function fixtureFileName(r: RawRecord): string {
  const u = new URL(r.url);
  const path = u.pathname.replace(/^\/+/, "");
  const ext = /\.cif$/.test(path) ? ".cif" : /text\/x-fasta/.test(r.url) || /\.fasta$/.test(path) ? ".fa" : ".json";
  const query = (u.search.startsWith("?") ? u.search.slice(1) : u.search)
    .split(/[;&]/)
    .filter((p) => p.length > 0 && !/^content-type=/.test(p))
    .join("_");
  const stem = [path.replace(/\.(json|cif|fa|fasta)$/, ""), query]
    .filter((s) => s.length > 0)
    .join("_")
    .replace(/[^A-Za-z0-9.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
  return `${stem}${ext}`;
}

function tsvQuote(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}

export interface RecordedFixtureSet {
  dir: string;
  indexPath: string;
  files: { name: string; path: string; source: string; bytes: number; sha256: string; redacted: boolean }[];
}

/**
 * Write data/fixtures/<datasetId>/ from redacted inputs: one folder per source with its
 * MANIFEST.tsv (rewritten, not appended, so a re-recording never carries stale rows) and
 * index.json. The set is written to a sibling temporary directory and swapped in.
 */
export async function writeFixtureSet(datasetId: string, redacted: Record<string, RedactedRecord>, description: string): Promise<RecordedFixtureSet> {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(datasetId)) throw new Error(`dataset id "${datasetId}" is not a fixture set name`);
  const dir = join(REPO_ROOT, "data/fixtures", datasetId);
  const tmp = `${dir}.tmp-${process.pid}`;
  await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });
  const manifests = new Map<string, string[]>();
  const index: { description: string; inputs: Record<string, { source: string; path: string }>; extra: Record<string, never> } = { description, inputs: {}, extra: {} };
  const files: RecordedFixtureSet["files"] = [];
  const usedNames = new Set<string>();
  for (const [name, x] of Object.entries(redacted)) {
    const r = x.record;
    const file = fixtureFileName(r);
    const key = `${r.source}/${file}`;
    if (usedNames.has(key)) throw new Error(`two inputs map to the same fixture file ${key}`);
    usedNames.add(key);
    const folder = join(tmp, r.source);
    await mkdir(folder, { recursive: true });
    const bytes = Buffer.from(r.body, "utf8");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (sha256 !== r.sha256) throw new Error(`${name}: body sha256 ${sha256} differs from the record's ${r.sha256}`);
    await writeFile(join(folder, file), bytes);
    const redaction = x.removed.length > 0 ? `redacted ${r.retrievedAt.slice(0, 10)}: OMIM/MIM/HGMD identifiers removed (Q-H-LIC-1, ${x.removed.length} removal${x.removed.length === 1 ? "" : "s"}); original sha256 ${x.originalSha256}` : "";
    const row = `${file}\t${r.retrievedAt}\t200\t${sha256}\t${bytes.byteLength}\t${r.method}\t${r.url}\t${tsvQuote(JSON.stringify(r.headers))}\t${redaction}\n`;
    if (!manifests.has(r.source)) manifests.set(r.source, []);
    manifests.get(r.source)!.push(row);
    const rel = relative(REPO_ROOT, join(dir, r.source, file));
    index.inputs[name] = { source: r.source, path: rel };
    files.push({ name, path: rel, source: r.source, bytes: bytes.byteLength, sha256, redacted: x.removed.length > 0 });
  }
  for (const [source, rows] of manifests) await writeFile(join(tmp, source, "MANIFEST.tsv"), MANIFEST_HEADER + rows.join(""));
  await writeFile(join(tmp, "index.json"), `${JSON.stringify(index, null, 2)}\n`);
  await rm(dir, { recursive: true, force: true });
  await mkdir(join(dir, ".."), { recursive: true });
  await rename(tmp, dir);
  return { dir, indexPath: join(dir, "index.json"), files };
}
