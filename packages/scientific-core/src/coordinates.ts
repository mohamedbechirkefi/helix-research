// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Coordinate conversions (docs/scientific-model-and-coordinate-mapping.md §2, §4).
 * Internal convention: 1-based closed, forward strand. 0-based sources are converted here
 * and nowhere else.
 */
import { ValidationFailedError } from "@helix/data-adapters";
import type { Transcript } from "@helix/shared-types";

// ---------------------------------------------------------------- 0-based <-> 1-based

/** SPDI position is 0-based interbase, i.e. the 1-based position minus 1 for a substitution. */
export function spdiToHgvsG(spdi: string): string {
  const m = /^(NC_\d{6}\.\d+):(\d+):([ACGT]):([ACGT])$/.exec(spdi);
  if (!m) throw new ValidationFailedError("spdi", `only single-base substitutions are supported: ${spdi}`);
  return `${m[1]}:g.${Number(m[2]) + 1}${m[3]}>${m[4]}`;
}

export function hgvsGToSpdi(hgvsg: string): string {
  const m = /^(NC_\d{6}\.\d+):g\.(\d+)([ACGT])>([ACGT])$/.exec(hgvsg);
  if (!m) throw new ValidationFailedError("hgvs-g", `only single-base substitutions are supported: ${hgvsg}`);
  return `${m[1]}:${Number(m[2]) - 1}:${m[3]}:${m[4]}`;
}

export function parseHgvsG(hgvsg: string): { accession: string; position: number; ref: string; alt: string } {
  const m = /^(NC_\d{6}\.\d+):g\.(\d+)([ACGT])>([ACGT])$/.exec(hgvsg);
  if (!m) throw new ValidationFailedError("hgvs-g", `unsupported genomic HGVS: ${hgvsg}`);
  return { accession: m[1]!, position: Number(m[2]), ref: m[3]!, alt: m[4]! };
}

export function parseHgvsC(hgvsc: string): { reference: string; position: number; ref: string; alt: string } {
  const m = /^([A-Z]{2,4}_?\d+\.\d+):c\.(\d+)([ACGT])>([ACGT])$/.exec(hgvsc);
  if (!m) throw new ValidationFailedError("hgvs-c", `unsupported coding HGVS (substitutions in the CDS only): ${hgvsc}`);
  return { reference: m[1]!, position: Number(m[2]), ref: m[3]!, alt: m[4]! };
}

/**
 * NCBI Gene esummary genomicinfo is 0-based, listed 5'->3' on the gene strand
 * (chrstart > chrstop on the minus strand). Returns a 1-based closed forward-strand span.
 */
export function ncbiGenomicInfoToOneBased(chrstart: number, chrstop: number): { start: number; end: number; strand: 1 | -1 } {
  return { start: Math.min(chrstart, chrstop) + 1, end: Math.max(chrstart, chrstop) + 1, strand: chrstart > chrstop ? -1 : 1 };
}

export function oneBasedToNcbiGenomicInfo(start: number, end: number, strand: 1 | -1): { chrstart: number; chrstop: number } {
  return strand === -1 ? { chrstart: end - 1, chrstop: start - 1 } : { chrstart: start - 1, chrstop: end - 1 };
}

// ---------------------------------------------------------------- CDS <-> genome (own exon walk)

/** Codon number and position within the codon (1..3) of a CDS position c >= 1. */
export function codonOf(cdsPosition: number): { codon: number; positionInCodon: 1 | 2 | 3 } {
  if (!Number.isInteger(cdsPosition) || cdsPosition < 1) throw new ValidationFailedError("codon", `invalid c. position ${cdsPosition}`);
  return { codon: Math.ceil(cdsPosition / 3), positionInCodon: (((cdsPosition - 1) % 3) + 1) as 1 | 2 | 3 };
}

interface Segment {
  start: number;
  end: number;
}

/** Coding segments of each exon, in transcript (5'->3') order. */
function codingSegments(t: Transcript): Segment[] {
  if (!t.translation) throw new ValidationFailedError("exon-walk", `transcript ${t.id.id} has no translation`);
  const { start: cs, end: ce } = t.translation.interval;
  const ordered = [...t.exons].sort((a, b) => a.rank - b.rank);
  return ordered
    .map((e) => ({ start: Math.max(e.interval.start, cs), end: Math.min(e.interval.end, ce) }))
    .filter((s) => s.start <= s.end);
}

/** Map a c. position (1-based, CDS) to a 1-based forward-strand genomic position by walking exons. */
export function cdsToGenome(t: Transcript, cdsPosition: number): number {
  let remaining = cdsPosition;
  for (const s of codingSegments(t)) {
    const len = s.end - s.start + 1;
    if (remaining <= len) return t.interval.strand === 1 ? s.start + remaining - 1 : s.end - remaining + 1;
    remaining -= len;
  }
  throw new ValidationFailedError("exon-walk", `c.${cdsPosition} is beyond the CDS of ${t.id.id}`);
}

/** Total CDS length from the exon structure (includes the stop codon). */
export function cdsLengthFromExons(t: Transcript): number {
  return codingSegments(t).reduce((n, s) => n + s.end - s.start + 1, 0);
}

/** Length of the 5' UTR in the spliced transcript, so cDNA position = c. + this. */
export function fivePrimeUtrLength(t: Transcript): number {
  if (!t.translation) throw new ValidationFailedError("exon-walk", `transcript ${t.id.id} has no translation`);
  const ordered = [...t.exons].sort((a, b) => a.rank - b.rank);
  let n = 0;
  for (const e of ordered) {
    if (t.interval.strand === 1) {
      if (e.interval.end < t.translation.interval.start) n += e.interval.end - e.interval.start + 1;
      else return n + Math.max(0, t.translation.interval.start - e.interval.start);
    } else {
      if (e.interval.start > t.translation.interval.end) n += e.interval.end - e.interval.start + 1;
      else return n + Math.max(0, e.interval.end - t.translation.interval.end);
    }
  }
  return n;
}

/**
 * Forward-strand genomic span (1-based closed) of codon n. `contiguous` is false when the
 * codon is split by an intron; the span then covers the intron and must not be shown as one block.
 */
export function codonGenomicSpan(t: Transcript, codon: number): { start: number; end: number; contiguous: boolean } {
  const p = [cdsToGenome(t, codon * 3 - 2), cdsToGenome(t, codon * 3 - 1), cdsToGenome(t, codon * 3)];
  const start = Math.min(...p);
  const end = Math.max(...p);
  return { start, end, contiguous: end - start === 2 };
}
