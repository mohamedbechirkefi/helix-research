// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/** Gene and alias resolution against HGNC records (P2.4.1; full names added for helix-app D-H036). */
import type { HgncRecord } from "@helix/data-adapters";

export type MatchedBy = "symbol" | "alias" | "previous-symbol" | "hgnc-id" | "ensembl-id" | "name";

export type GeneResolution =
  | { status: "resolved"; matchedBy: MatchedBy; hgncId: string; symbol: string; ensemblGeneId: string | null }
  | { status: "ambiguous"; candidates: { hgncId: string; symbol: string }[] }
  | { status: "not-found" };

/** Lower case, trimmed, every run of whitespace one space. */
const norm = (s: string): string => s.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Exact (case-insensitive) match; an approved symbol wins over aliases; several alias hits are ambiguous.
 * Last, the full approved name (whitespace-tolerant: runs of spaces count as one); only the whole name
 * matches, never a part of it, and two records with that name are ambiguous. The records given are the
 * only source: nothing is looked up.
 */
export function resolveGeneQuery(query: string, records: HgncRecord[]): GeneResolution {
  const q = norm(query);
  const hit = (r: HgncRecord, by: MatchedBy): GeneResolution => ({
    status: "resolved",
    matchedBy: by,
    hgncId: r.hgncId,
    symbol: r.symbol,
    ensemblGeneId: r.ensemblGeneId,
  });
  const bySymbol = records.filter((r) => r.symbol.toLowerCase() === q);
  if (bySymbol.length === 1) return hit(bySymbol[0]!, "symbol");
  const byId = records.find((r) => r.hgncId.toLowerCase() === q);
  if (byId) return hit(byId, "hgnc-id");
  const byEnsembl = records.find((r) => r.ensemblGeneId?.toLowerCase() === q);
  if (byEnsembl) return hit(byEnsembl, "ensembl-id");
  const byAlias = records.filter((r) => r.aliases.some((a) => a.toLowerCase() === q));
  if (byAlias.length === 1) return hit(byAlias[0]!, "alias");
  if (byAlias.length > 1) return { status: "ambiguous", candidates: byAlias.map((r) => ({ hgncId: r.hgncId, symbol: r.symbol })) };
  const byPrev = records.filter((r) => r.previousSymbols.some((a) => a.toLowerCase() === q));
  if (byPrev.length === 1) return hit(byPrev[0]!, "previous-symbol");
  if (byPrev.length > 1) return { status: "ambiguous", candidates: byPrev.map((r) => ({ hgncId: r.hgncId, symbol: r.symbol })) };
  const byName = q ? records.filter((r) => typeof r.name === "string" && norm(r.name) === q) : [];
  if (byName.length === 1) return hit(byName[0]!, "name");
  if (byName.length > 1) return { status: "ambiguous", candidates: byName.map((r) => ({ hgncId: r.hgncId, symbol: r.symbol })) };
  return { status: "not-found" };
}
