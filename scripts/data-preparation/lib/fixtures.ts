// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Load recorded fixtures as RawRecords (Node only; used by tests and offline builds).
 * Each file's URL, retrieval time and headers come from its folder's MANIFEST.tsv, and its
 * sha256 must match the manifest row, so a silently edited fixture fails loudly.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { CompleteSliceInputs, RawRecord, SliceInputs } from "@helix/scientific-core";
import type { SourceId } from "@helix/shared-types";
import { REPO_ROOT } from "./node-env.ts";

interface IndexEntry {
  source: SourceId;
  path: string;
}
interface FixtureIndex {
  inputs: Partial<Record<keyof SliceInputs, IndexEntry>>;
  extra: Record<string, IndexEntry>;
}

/** The recorded fixture set of the first gene; every loader defaults to it. */
export const DEFAULT_FIXTURE_SET = "hbb";

export interface ManifestRow {
  file: string;
  retrievedUtc: string;
  status: number;
  sha256: string;
  method: "GET" | "POST";
  url: string;
  headers: Record<string, string>;
}

function unquoteTsvField(f: string): string {
  return f.startsWith('"') && f.endsWith('"') ? f.slice(1, -1).replace(/""/g, '"') : f;
}

export async function readManifest(dir: string): Promise<ManifestRow[]> {
  const text = await readFile(join(dir, "MANIFEST.tsv"), "utf8");
  const [head, ...lines] = text.split("\n").filter((l) => l.trim().length > 0);
  const cols = head!.split("\t");
  return lines.map((l) => {
    const f = l.split("\t");
    const get = (c: string): string => unquoteTsvField(f[cols.indexOf(c)] ?? "");
    const h = get("headers");
    return {
      file: get("file"),
      retrievedUtc: get("retrieved_utc"),
      status: Number(get("http_status")),
      sha256: get("sha256"),
      method: get("method") === "POST" ? "POST" : "GET",
      url: get("url"),
      headers: h ? (JSON.parse(h) as Record<string, string>) : {},
    };
  });
}

/** data/fixtures/<set>/index.json (Phase 9: one set per gene with recorded fixtures). */
export async function fixtureIndex(set: string = DEFAULT_FIXTURE_SET): Promise<FixtureIndex> {
  // Phase 9 (P9.3.1): the dynamic-mode test inputs live one level down, data/fixtures/dynamic/<symbol>/.
  if (!/^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)?$/.test(set)) throw new Error(`fixture set "${set}" is not a valid name`);
  return JSON.parse(await readFile(join(REPO_ROOT, "data/fixtures", set, "index.json"), "utf8")) as FixtureIndex;
}

/** Load one fixture file as a RawRecord, verified against its manifest. */
export async function loadRaw(entry: IndexEntry): Promise<RawRecord> {
  const abs = join(REPO_ROOT, entry.path);
  const buf = await readFile(abs);
  const sha = createHash("sha256").update(buf).digest("hex");
  const rows = (await readManifest(dirname(abs))).filter((r) => r.file === basename(abs));
  const row = rows.find((r) => r.sha256 === sha);
  if (!row) throw new Error(`fixture ${entry.path}: sha256 ${sha} matches no MANIFEST.tsv row (${rows.length} rows for this file)`);
  return { source: entry.source, url: row.url, method: row.method, body: buf.toString("utf8"), sha256: sha, retrievedAt: row.retrievedUtc, headers: row.headers };
}

/**
 * Load every input the set records. The HBB set records the variant and structure groups,
 * so its inputs are complete; a set recorded for a gene without them is loaded as
 * SliceInputs (the builder reads only what its specification selects).
 */
export async function loadFixtureInputs(set: string = DEFAULT_FIXTURE_SET): Promise<CompleteSliceInputs> {
  const idx = await fixtureIndex(set);
  const out: Partial<SliceInputs> = {};
  for (const [name, entry] of Object.entries(idx.inputs) as [keyof SliceInputs, IndexEntry][]) out[name] = await loadRaw(entry);
  return out as CompleteSliceInputs;
}

/** Read a fixture body by its index name (inputs or extra). Extra files without a manifest are read as-is. */
export async function fixtureText(name: string, set: string = DEFAULT_FIXTURE_SET): Promise<string> {
  const idx = await fixtureIndex(set);
  const e = (idx.inputs as Record<string, IndexEntry>)[name] ?? idx.extra[name];
  if (!e) throw new Error(`unknown fixture ${name}`);
  return readFile(join(REPO_ROOT, e.path), "utf8");
}

export async function fixtureJson<T = unknown>(name: string, set: string = DEFAULT_FIXTURE_SET): Promise<T> {
  return JSON.parse(await fixtureText(name, set)) as T;
}
