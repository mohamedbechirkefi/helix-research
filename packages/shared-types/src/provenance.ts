// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/** Provenance model (P2.1.2), following research/hbb-acquisition-plan.md §5. */
import { z } from "zod";
import { EvidenceCategory } from "./evidence.ts";

export const SourceId = z.enum([
  "ensembl",
  "uniprot",
  "rcsb",
  "rcsb-files",
  "pdbe-sifts",
  "ncbi-clinvar",
  "hgnc",
  "alphafold",
  "reactome",
]);
export type SourceId = z.infer<typeof SourceId>;

export const LicenceId = z.enum([
  "Ensembl-no-restrictions",
  "CC-BY-4.0",
  "CC0-1.0",
  "NCBI-public-domain",
]);
export type LicenceId = z.infer<typeof LicenceId>;

export const ValidationResult = z.object({
  check: z.string().min(1),
  result: z.enum(["pass", "fail", "warn"]),
  detail: z.string().nullable().default(null),
  at: z.iso.datetime(),
});
export type ValidationResult = z.infer<typeof ValidationResult>;

/** One fetched source record that a curated record depends on. */
export const Provenance = z.object({
  source: SourceId,
  url: z.url(),
  method: z.enum(["GET", "POST"]),
  retrievedAt: z.iso.datetime(),
  /** e.g. "Ensembl 116", "UniProt 2026_03", "PDB rev 1.5 2026-08-12"; null when the source publishes none. */
  sourceRelease: z.string().nullable(),
  recordId: z.string().min(1),
  recordVersion: z.string().nullable(),
  assembly: z.string().nullable(),
  /** sha256 of the raw response body, as retrieved (hex). */
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  licence: LicenceId,
  attribution: z.string().min(1),
});
export type Provenance = z.infer<typeof Provenance>;

/**
 * Record-level provenance block carried by every curated record: the source records
 * it was built from, the transformations applied, the validations run, and the §5 class.
 */
export const RecordProvenance = z.object({
  sources: z.array(Provenance).min(1),
  transformations: z.array(z.string().min(1)).min(1),
  validation: z.array(ValidationResult),
  evidenceCategory: EvidenceCategory,
});
export type RecordProvenance = z.infer<typeof RecordProvenance>;
