// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/** Raw Ensembl shapes -> domain types with explicit coordinate conventions (P2.4.1). */
import type { EnsemblTranscriptRaw } from "@helix/data-adapters";
import { ValidationFailedError } from "@helix/data-adapters";
import { type AssemblyName, type GenomicInterval, ONE_BASED_CLOSED, type Transcript, parseVersioned } from "@helix/shared-types";

export function toAssemblyName(name: string): AssemblyName {
  if (name === "GRCh38" || name === "GRCh37") return name;
  throw new ValidationFailedError("assembly", `unsupported assembly ${name}; HELIX displays GRCh38 only`);
}

export function interval(
  assembly: string,
  seqRegion: string,
  start: number,
  end: number,
  strand: number,
  extra: { assemblyPatch?: string | null; refSeqAccession?: string | null } = {},
): GenomicInterval {
  if (strand !== 1 && strand !== -1) throw new ValidationFailedError("strand", `invalid strand ${strand}`);
  if (start > end) throw new ValidationFailedError("interval", `start ${start} > end ${end}`);
  return {
    assembly: toAssemblyName(assembly),
    assemblyPatch: extra.assemblyPatch ?? null,
    seqRegion,
    refSeqAccession: extra.refSeqAccession ?? null,
    start,
    end,
    strand,
    convention: ONE_BASED_CLOSED,
  };
}

/** Exon rank is the transcript order: descending coordinates on the reverse strand. */
export function normaliseTranscript(t: EnsemblTranscriptRaw, extra: { assemblyPatch?: string | null } = {}): Transcript {
  const iv = (s: number, e: number): GenomicInterval => interval(t.assembly_name, t.seq_region_name, s, e, t.strand, extra);
  const exonsOrdered = [...t.Exon].sort((a, b) => (t.strand === 1 ? a.start - b.start : b.start - a.start));
  const length = exonsOrdered.reduce((n, e) => n + e.end - e.start + 1, 0);
  const mane = t.MANE.find((m) => m.type === "MANE_Select");
  return {
    id: { id: t.id, version: t.version },
    displayName: t.display_name,
    biotype: t.biotype,
    isCanonical: t.is_canonical === 1,
    maneSelect: mane !== undefined,
    refSeqMatch: mane ? parseVersioned(mane.refseq_match) : null,
    interval: iv(t.start, t.end),
    length: t.length ?? length,
    exons: exonsOrdered.map((e, i) => ({ id: { id: e.id, version: e.version }, interval: iv(e.start, e.end), rank: i + 1 })),
    utrs: t.UTR.filter((u) => u.type === "five_prime_utr" || u.type === "three_prime_utr").map((u) => ({
      type: u.type as "five_prime_utr" | "three_prime_utr",
      interval: iv(u.start, u.end),
    })),
    translation: t.Translation
      ? { id: { id: t.Translation.id, version: t.Translation.version }, length: t.Translation.length, interval: iv(t.Translation.start, t.Translation.end) }
      : null,
  };
}
