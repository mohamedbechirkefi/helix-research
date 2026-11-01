// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Evidence classification (P2.4.7): fixed rules from what a claim rests on to the six
 * classes of master prompt §5. Categories are never typed in by hand.
 *
 * The rules refuse the silent upgrades §5 forbids: a database annotation stays class 2
 * even when it cites experiments; a prediction (VEP, AlphaFold) stays class 3; an
 * inference we made stays class 4.
 */
import { EVIDENCE_CATEGORIES, type Evidence, type EvidenceBasis, type EvidenceCategory } from "@helix/shared-types";

const RULES: Record<EvidenceBasis, EvidenceCategory> = {
  "experimental-structure-observation": 1,
  "computed-from-experimental-data": 1,
  "curated-database-annotation": 2,
  "reviewed-clinical-submission": 2,
  "reference-sequence-derivation": 3,
  "computational-prediction": 3,
  "inference-not-verified": 4,
  illustration: 5,
  "missing-or-conflicting": 6,
};

/** Default limitations attached per basis, so the caveat travels with the claim. */
const DEFAULT_LIMITATIONS: Partial<Record<EvidenceBasis, string>> = {
  "computed-from-experimental-data": "Computed by HELIX from deposited coordinates; depends on the deposited model and the stated cutoff.",
  "curated-database-annotation": "Curated database annotation; the cited evidence is the curators' assessment, not an observation made here.",
  "reviewed-clinical-submission": "Aggregate classification across submissions; not clinical advice and not a statement of causation for every trait listed.",
  "reference-sequence-derivation": "Theoretically deduced from the reference sequence (HGVS writes such consequences in parentheses).",
  "computational-prediction": "Computational prediction; not an experimental observation.",
  "inference-not-verified": "HELIX inference, not verified against a record.",
  illustration: "Conceptual illustration; not data.",
  "missing-or-conflicting": "Information is missing or sources disagree.",
};

export function classify(basis: EvidenceBasis): EvidenceCategory {
  return RULES[basis];
}

export function evidence(basis: EvidenceBasis, statement: string, opts: { qualifier?: string | null; limitations?: string[] } = {}): Evidence {
  const category = classify(basis);
  const limits = [...(opts.limitations ?? [])];
  const d = DEFAULT_LIMITATIONS[basis];
  if (d && !limits.includes(d)) limits.push(d);
  return { category, categoryLabel: EVIDENCE_CATEGORIES[category], basis, statement, qualifier: opts.qualifier ?? null, limitations: limits };
}

/** ClinVar review statuses that signal disagreement are class 6, whatever the headline classification. */
export function classifyClinvarReview(reviewStatus: string): EvidenceBasis {
  return /conflicting/i.test(reviewStatus) ? "missing-or-conflicting" : "reviewed-clinical-submission";
}
