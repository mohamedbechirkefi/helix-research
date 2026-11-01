// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Compare two builds of a curated dataset (P2.5.1 evidence).
 *
 *   node scripts/data-preparation/compare-builds.ts <dirA> <dirB>
 *
 * Every file is compared. JSON files are compared field by field; the only differences
 * allowed are timestamps (retrievedAt, generatedAt, validation `at`) and, in manifest.json,
 * the file hashes of JSON records that embed those timestamps. Any other difference (a
 * value, a raw-body sha256, a file present in one build only) is reported and the exit
 * status is 1.
 */
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const TIMESTAMP_KEYS = new Set(["retrievedAt", "generatedAt", "at"]);
const [a, b] = process.argv.slice(2);
if (!a || !b) {
  console.error("usage: compare-builds.ts <dirA> <dirB>");
  process.exit(64);
}

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
  diffs.push({ file, path, a: x, b: y, allowed: false, why: "value" });
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

const bad = diffs.filter((d) => !d.allowed);
const byFile = new Map<string, number>();
for (const d of diffs.filter((x) => x.allowed)) byFile.set(d.file, (byFile.get(d.file) ?? 0) + 1);
console.log(`files compared: ${new Set([...filesA, ...filesB]).size}`);
console.log(`byte-identical files: ${filesA.filter((f) => filesB.includes(f)).length - new Set(diffs.map((d) => d.file)).size}`);
console.log(`allowed differences (timestamps and dependent hashes): ${diffs.length - bad.length}`);
for (const [f, n] of [...byFile].sort()) console.log(`  ${f}: ${n}`);
console.log(`other differences: ${bad.length}`);
for (const d of bad.slice(0, 50)) console.log(`  ${d.file} ${d.path}: ${JSON.stringify(d.a)} != ${JSON.stringify(d.b)} (${d.why})`);
process.exit(bad.length === 0 ? 0 : 1);
