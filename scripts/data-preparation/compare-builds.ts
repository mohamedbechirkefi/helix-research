// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Compare two builds of a curated dataset (P2.5.1 evidence).
 *
 *   node scripts/data-preparation/compare-builds.ts <dirA> <dirB> [--cache .cache/helix-raw]
 *
 * Every file is compared. JSON files are compared field by field; the only differences
 * allowed are timestamps (retrievedAt, generatedAt, validation `at`) and, in manifest.json,
 * the file hashes of JSON records that embed those timestamps.
 *
 * A raw-body sha256 that differs is allowed only if both bodies are in the local cache and
 * become identical once a documented per-request field is removed (VOLATILE below, e.g.
 * HGNC's Solr query timer responseHeader.QTime). Any other difference (a value, an
 * unexplained hash, a file present in one build only) is reported and the exit status is 1.
 */
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

/** Response fields that change on every request without changing content. */
const VOLATILE: { source: string; path: string[] }[] = [{ source: "hgnc", path: ["responseHeader", "QTime"] }];

const TIMESTAMP_KEYS = new Set(["retrievedAt", "generatedAt", "at"]);
const argv = process.argv.slice(2);
const ci = argv.indexOf("--cache");
const cacheDir = ci >= 0 ? resolve(argv[ci + 1]!) : null;
const [a, b] = argv.filter((_x, i) => ci < 0 || (i !== ci && i !== ci + 1));
if (!a || !b) {
  console.error("usage: compare-builds.ts <dirA> <dirB> [--cache <dir>]");
  process.exit(64);
}

const verdicts = new Map<string, string | null>();
/** Explain a raw-body hash difference from the cached bodies, or return null. */
async function explainHash(x: string, y: string): Promise<string | null> {
  const k = `${x}|${y}`;
  if (verdicts.has(k)) return verdicts.get(k)!;
  let verdict: string | null = null;
  if (cacheDir) {
    try {
      const bx = JSON.parse(await readFile(join(cacheDir, "blob", x), "utf8"));
      const by = JSON.parse(await readFile(join(cacheDir, "blob", y), "utf8"));
      for (const v of VOLATILE) {
        const strip = (o: unknown): unknown => {
          const c = structuredClone(o) as Record<string, unknown>;
          let cur: Record<string, unknown> | undefined = c;
          for (const seg of v.path.slice(0, -1)) cur = cur?.[seg] as Record<string, unknown> | undefined;
          if (cur) delete cur[v.path.at(-1)!];
          return c;
        };
        if (JSON.stringify(strip(bx)) === JSON.stringify(strip(by))) {
          verdict = `raw bodies identical except volatile ${v.source} field ${v.path.join(".")}`;
          break;
        }
      }
    } catch {
      verdict = null;
    }
  }
  verdicts.set(k, verdict);
  return verdict;
}
const pendingHashes: Diff[] = [];

type Diff = { file: string; path: string; a: unknown; b: unknown; allowed: boolean; why: string };
const diffs: Diff[] = [];

function walk(file: string, x: unknown, y: unknown, path: string, timestampedFiles: Set<string>): void {
  if (Array.isArray(x) && Array.isArray(y)) {
    if (x.length !== y.length) diffs.push({ file, path, a: x.length, b: y.length, allowed: false, why: "array length" });
    for (let i = 0; i < Math.min(x.length, y.length); i++) walk(file, x[i], y[i], `${path}[${i}]`, timestampedFiles);
    return;
  }
  if (x && y && typeof x === "object" && typeof y === "object") {
    const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
    for (const k of keys) {
      const xv = (x as Record<string, unknown>)[k];
      const yv = (y as Record<string, unknown>)[k];
      walk(file, xv, yv, `${path}.${k}`, timestampedFiles);
    }
    return;
  }
  if (x === y) return;
  const key = path.split(".").pop() ?? "";
  if (TIMESTAMP_KEYS.has(key)) {
    diffs.push({ file, path, a: x, b: y, allowed: true, why: "timestamp" });
    return;
  }
  const m = /^\$\.files\[(\d+)\]\.(sha256|bytes)$/.exec(path);
  if (file === "manifest.json" && m) {
    diffs.push({ file, path, a: x, b: y, allowed: true, why: "hash/size of a record file that embeds timestamps" });
    return;
  }
  const d: Diff = { file, path, a: x, b: y, allowed: false, why: "value" };
  if (key === "sha256" && typeof x === "string" && typeof y === "string") pendingHashes.push(d);
  diffs.push(d);
}

const filesA = (await readdir(a)).sort();
const filesB = (await readdir(b)).sort();
for (const f of new Set([...filesA, ...filesB])) {
  if (!filesA.includes(f) || !filesB.includes(f)) {
    diffs.push({ file: f, path: "", a: filesA.includes(f), b: filesB.includes(f), allowed: false, why: "file present in one build only" });
    continue;
  }
  const ta = await readFile(join(a, f), "utf8");
  const tb = await readFile(join(b, f), "utf8");
  if (ta === tb) continue;
  if (f.endsWith(".json")) walk(f, JSON.parse(ta), JSON.parse(tb), "$", new Set());
  else diffs.push({ file: f, path: "", a: "bytes", b: "bytes", allowed: false, why: "non-JSON file differs" });
}

for (const d of pendingHashes) {
  const why = await explainHash(d.a as string, d.b as string);
  if (why) {
    d.allowed = true;
    d.why = why;
  }
}
const bad = diffs.filter((d) => !d.allowed);
const explained = [...new Set(pendingHashes.filter((d) => d.allowed).map((d) => `${d.why}`))];
const byFile = new Map<string, number>();
for (const d of diffs.filter((x) => x.allowed)) byFile.set(d.file, (byFile.get(d.file) ?? 0) + 1);
console.log(`files compared: ${new Set([...filesA, ...filesB]).size}`);
console.log(`byte-identical files: ${filesA.filter((f) => filesB.includes(f)).length - new Set(diffs.map((d) => d.file)).size}`);
console.log(`allowed differences (timestamps and dependent hashes): ${diffs.length - bad.length}`);
for (const [f, n] of [...byFile].sort()) console.log(`  ${f}: ${n}`);
for (const e of explained) console.log(`  explained hash difference: ${e}`);
console.log(`other differences: ${bad.length}`);
for (const d of bad.slice(0, 50)) console.log(`  ${d.file} ${d.path}: ${JSON.stringify(d.a)} != ${JSON.stringify(d.b)} (${d.why})`);
process.exit(bad.length === 0 ? 0 : 1);
