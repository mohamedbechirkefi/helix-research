// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * ClinVar review status (Phase 6, P6.1.1). The star levels are ClinVar's own published mapping of
 * review status to stars (ClinVar documentation "Review status in ClinVar"); a status outside that
 * table gets null, never a guess. Conflict status is read from ClinVar's own words: the review
 * status "criteria provided, conflicting classifications" (older wording "conflicting
 * interpretations") or a classification "Conflicting classifications of pathogenicity".
 */
const STARS: [RegExp, number][] = [
  [/^practice guideline$/i, 4],
  [/^reviewed by expert panel$/i, 3],
  [/^criteria provided, multiple submitters, no conflicts$/i, 2],
  [/^criteria provided, conflicting (classifications|interpretations)$/i, 1],
  [/^criteria provided, single submitter$/i, 1],
  [/^no assertion criteria provided$/i, 0],
  [/^no classification provided$/i, 0],
  [/^no assertion provided$/i, 0],
  [/^no classification for the individual variant$/i, 0],
  [/^no classifications from unflagged records$/i, 0],
];

/** ClinVar's documented star level for a review status, or null when the status is not in the table. */
export function clinvarReviewStars(reviewStatus: string): number | null {
  const s = reviewStatus.trim();
  for (const [re, n] of STARS) if (re.test(s)) return n;
  return null;
}

/** Conflict status from ClinVar's review status and classification text, with the basis quoted. */
export function clinvarConflicts(reviewStatus: string, classification: string): { conflicting: boolean; basis: string } {
  const conflicting = /conflicting/i.test(reviewStatus) || /conflicting/i.test(classification);
  const noConflict = /no conflicts/i.test(reviewStatus);
  if (conflicting && noConflict) throw new Error(`ClinVar review status "${reviewStatus}" says both conflicting and no conflicts`);
  return {
    conflicting,
    basis: `review status "${reviewStatus}"; classification "${classification}"${conflicting ? "" : noConflict ? " (ClinVar states no conflicts)" : " (ClinVar does not report a conflict; this status does not assert agreement among several submitters)"}`,
  };
}
