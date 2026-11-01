// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/** The six evidence classes of master prompt §5. */
import { z } from "zod";

export const EVIDENCE_CATEGORIES = {
  1: "Experimentally supported fact or observation",
  2: "Database annotation/submission with review status",
  3: "Computational prediction with confidence/limitations",
  4: "Hypothesis or uncertain association",
  5: "Conceptual illustration or educational animation",
  6: "Unknown/missing/conflicting information",
} as const;

export const EvidenceCategory = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);
export type EvidenceCategory = z.infer<typeof EvidenceCategory>;

/**
 * What a claim rests on. The classifier (scientific-core/evidence) maps a basis to a
 * category with fixed rules, so the category is never typed in by hand.
 */
export const EvidenceBasis = z.enum([
  "experimental-structure-observation", // read from experimental coordinates (e.g. X-ray atom_site)
  "computed-from-experimental-data", // deterministic computation on experimental coordinates (e.g. distances)
  "curated-database-annotation", // UniProt/Ensembl curated annotation
  "reviewed-clinical-submission", // ClinVar aggregate with a review status
  "reference-sequence-derivation", // deterministic derivation from reference sequences (translation, HGVS p. from c.)
  "computational-prediction", // VEP consequence, AlphaFold model
  "inference-not-verified", // our reasoning, not checked against a record
  "illustration", // conceptual or cinematic depiction
  "missing-or-conflicting", // absent record, failed check, unresolved conflict
]);
export type EvidenceBasis = z.infer<typeof EvidenceBasis>;

export const Evidence = z.object({
  category: EvidenceCategory,
  categoryLabel: z.string(),
  basis: EvidenceBasis,
  /** Short statement of what is claimed, in plain words. */
  statement: z.string().min(1),
  /** Review status, confidence or other qualifier copied verbatim from the source, if any. */
  qualifier: z.string().nullable().default(null),
  limitations: z.array(z.string()).default([]),
});
export type Evidence = z.infer<typeof Evidence>;
