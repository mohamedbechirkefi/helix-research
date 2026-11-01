// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Pairwise protein alignment, used as the independent cross-check of SIFTS
 * (docs/scientific-model-and-coordinate-mapping.md §8). Needleman-Wunsch with free end
 * gaps (an entity may lack the initiator Met or termini), linear gap penalty.
 */

export interface AlignmentResult {
  /** 1-based pairs (queryPos, referencePos) for aligned, non-gap columns. */
  pairs: [number, number][];
  mismatches: { queryPos: number; referencePos: number; query: string; reference: string }[];
  /** Matches / aligned columns. */
  identity: number;
  /** referencePos - queryPos when it is the same for every pair, else null. */
  constantOffset: number | null;
  queryCoverage: number;
}

export function alignGlobalFreeEnds(query: string, reference: string, scoring = { match: 2, mismatch: -1, gap: -3 }): AlignmentResult {
  const n = query.length;
  const m = reference.length;
  const W = m + 1;
  const score = new Float64Array((n + 1) * W);
  const tb = new Uint8Array((n + 1) * W); // 1 diag, 2 up (gap in reference), 3 left (gap in query)
  for (let i = 1; i <= n; i++) tb[i * W] = 2;
  for (let j = 1; j <= m; j++) tb[j] = 3;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const lastRow = i === n;
      const lastCol = j === m;
      const d = score[(i - 1) * W + j - 1]! + (query[i - 1] === reference[j - 1] ? scoring.match : scoring.mismatch);
      const up = score[(i - 1) * W + j]! + (lastCol ? 0 : scoring.gap);
      const left = score[i * W + j - 1]! + (lastRow ? 0 : scoring.gap);
      let best = d;
      let dir = 1;
      if (up > best) {
        best = up;
        dir = 2;
      }
      if (left > best) {
        best = left;
        dir = 3;
      }
      score[i * W + j] = best;
      tb[i * W + j] = dir;
    }
  }
  const pairs: [number, number][] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const dir = tb[i * W + j];
    if (dir === 1) {
      pairs.push([i, j]);
      i--;
      j--;
    } else if (dir === 2) i--;
    else j--;
  }
  pairs.reverse();
  const mismatches = pairs
    .filter(([q, r]) => query[q - 1] !== reference[r - 1])
    .map(([q, r]) => ({ queryPos: q, referencePos: r, query: query[q - 1]!, reference: reference[r - 1]! }));
  const offsets = new Set(pairs.map(([q, r]) => r - q));
  return {
    pairs,
    mismatches,
    identity: pairs.length === 0 ? 0 : (pairs.length - mismatches.length) / pairs.length,
    constantOffset: offsets.size === 1 ? [...offsets][0]! : null,
    queryCoverage: n === 0 ? 0 : pairs.length / n,
  };
}
