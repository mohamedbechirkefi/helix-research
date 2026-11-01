// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Coordinate conventions (docs/scientific-model-and-coordinate-mapping.md §1-2).
 *
 * HELIX keeps one internal genomic convention: 1-based, closed intervals on the
 * forward strand of a named assembly, with the feature strand stated separately.
 * 0-based sources (SPDI, BED, NCBI esummary) are converted at the boundary by
 * scientific-core/coordinates and never stored in these types.
 */
import { z } from "zod";

/** Reference assemblies HELIX knows. GRCh37 only ever appears as a labelled cross-reference. */
export const AssemblyName = z.enum(["GRCh38", "GRCh37"]);
export type AssemblyName = z.infer<typeof AssemblyName>;

/** Ensembl strand convention: 1 forward, -1 reverse. */
export const Strand = z.union([z.literal(1), z.literal(-1)]);
export type Strand = z.infer<typeof Strand>;

/** The only interval convention stored in curated data. */
export const ONE_BASED_CLOSED = "1-based-closed" as const;

export const GenomicInterval = z
  .object({
    assembly: AssemblyName,
    /** Full assembly name with patch, when known (e.g. "GRCh38.p14"). */
    assemblyPatch: z.string().nullable().default(null),
    /** Ensembl sequence region name, e.g. "11". */
    seqRegion: z.string().min(1),
    /** Versioned RefSeq chromosome accession used in HGVS g., e.g. "NC_000011.10". */
    refSeqAccession: z.string().regex(/^NC_\d{6}\.\d+$/).nullable().default(null),
    start: z.number().int().min(1),
    end: z.number().int().min(1),
    /** Strand of the feature; coordinates always count on the forward strand. */
    strand: Strand,
    convention: z.literal(ONE_BASED_CLOSED),
  })
  .refine((i) => i.start <= i.end, { message: "GenomicInterval requires start <= end (1-based closed)" });
export type GenomicInterval = z.infer<typeof GenomicInterval>;

/** Length of a 1-based closed interval. */
export function intervalLength(i: { start: number; end: number }): number {
  return i.end - i.start + 1;
}
