// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/** Builds summary.json from scored rows (shared by run.ts and rescore.ts). */
import { createHash } from "node:crypto";
import { hostname } from "node:os";
import { aggregate, buildMessages, percentile, planJsonSchema, FALLBACK_VERSION, PROMPT_VERSION, type BenchmarkItem, type ItemScore, type ProviderOutput } from "@helix/ai-planning";
import { gitCommit, loadHbbContext } from "./lib.ts";

export interface Row {
  item: string;
  category: string;
  lang: string;
  rep: number;
  temperature: number;
  seed: number;
  raw: string;
  error: string | null;
  firstTokenMs: number | null;
  totalMs: number | null;
  usage: ProviderOutput["usage"] | null;
  score: ItemScore | null;
}

const failed = (r: Row): ItemScore => ({
  parsedJson: false,
  schemaValid: false,
  valid: false,
  groundednessViolations: 0,
  outcomeCorrect: false,
  intentCorrect: null,
  actionCorrect: false,
  correctAndValid: false,
  refusalCorrect: null,
  clarifyCorrect: null,
  injectionResisted: null,
  followUpCorrect: null,
  explanationLevelCorrect: null,
  falseRefusal: null,
  issues: [`error:${r.error}`],
});

export function summarise(rows: Row[], items: BenchmarkItem[], extra: Record<string, unknown>) {
  const scoresOf = (rs: Row[]) => rs.map((r) => r.score ?? failed(r));
  const t0Rows = rows.filter((r) => r.temperature === 0);
  const t07Rows = rows.filter((r) => r.temperature !== 0);
  const lat = (rs: Row[], k: "firstTokenMs" | "totalMs") => {
    const xs = rs.map((r) => r[k]).filter((x): x is number => typeof x === "number");
    return { p50: percentile(xs, 50), p95: percentile(xs, 95), max: xs.length ? Math.max(...xs) : null, n: xs.length };
  };
  const byItem = new Map<string, Row[]>();
  for (const r of t0Rows) byItem.set(r.item, [...(byItem.get(r.item) ?? []), r]);
  let identical = 0;
  let sameVerdict = 0;
  for (const rs of byItem.values()) {
    if (new Set(rs.map((r) => r.raw)).size === 1) identical++;
    if (new Set(rs.map((r) => String(r.score?.correctAndValid ?? false))).size === 1) sameVerdict++;
  }
  const categories = [...new Set(items.map((i) => i.category))];
  const tps = t0Rows
    .map((r) => (r.usage?.completionTokens && r.usage?.evalMs ? (1000 * r.usage.completionTokens) / r.usage.evalMs : null))
    .filter((x): x is number => x !== null);
  const ctx = loadHbbContext();
  return {
    ...extra,
    date: new Date().toISOString(),
    promptVersion: PROMPT_VERSION,
    fallbackVersion: FALLBACK_VERSION,
    schemaSha256: createHash("sha256").update(JSON.stringify(planJsonSchema())).digest("hex"),
    promptSystemChars: buildMessages("x", ctx)[0]!.content.length,
    gitCommit: gitCommit(),
    host: { machine: "Apple M1 Pro, 16 GB, macOS 15.3.1", hostnameHash: createHash("sha256").update(hostname()).digest("hex").slice(0, 8) },
    items: byItem.size || items.length,
    temperature0: {
      ...aggregate(scoresOf(t0Rows)),
      latencyMs: { firstToken: lat(t0Rows, "firstTokenMs"), total: lat(t0Rows, "totalMs") },
      decodeTokensPerSecP50: percentile(tps, 50),
      errors: t0Rows.filter((r) => r.error).length,
      repeatability: { items: byItem.size, identicalOutputs: identical, sameVerdict },
      byCategory: Object.fromEntries(categories.map((c) => [c, aggregate(scoresOf(t0Rows.filter((r) => r.category === c)))])),
    },
    temperature07: t07Rows.length
      ? { ...aggregate(scoresOf(t07Rows)), latencyMs: { total: lat(t07Rows, "totalMs") }, errors: t07Rows.filter((r) => r.error).length }
      : null,
  };
}
