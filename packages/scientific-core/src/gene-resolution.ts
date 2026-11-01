// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/** Gene and alias resolution against HGNC records (P2.4.1). */
import type { HgncRecord } from "@helix/data-adapters";

export type MatchedBy = "symbol" | "alias" | "previous-symbol" | "hgnc-id" | "ensembl-id";

export type GeneResolution =
  | { status: "resolved"; matchedBy: MatchedBy; hgncId: string; symbol: string; ensemblGeneId: string | null }
  | { status: "ambiguous"; candidates: { hgncId: string; symbol: string }[] }
  | { status: "not-found" };

/** Exact (case-insensitive) match; an approved symbol wins over aliases; several alias hits are ambiguous. */
export function resolveGeneQuery(query: string, records: HgncRecord[]): GeneResolution {
  const q = query.trim().toLowerCase();
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
  return { status: "not-found" };
}
