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

// ---------------------------------------------------------------- deletions (Phase 9, plan section 11)

/** "c.1521_1523del" or "c.1521del" (a CDS span, 1-based closed), optionally prefixed by a versioned reference. */
export function parseHgvsCDeletion(hgvsc: string): { reference: string | null; start: number; end: number } {
  const m = /^(?:([A-Z]{2,4}_?\d+\.\d+):)?c\.(\d+)(?:_(\d+))?del$/.exec(hgvsc);
  if (!m) throw new ValidationFailedError("hgvs-c", `unsupported coding HGVS deletion (a CDS span, c.<start>_<end>del): ${hgvsc}`);
  const start = Number(m[2]);
  const end = m[3] === undefined ? start : Number(m[3]);
  if (end < start) throw new ValidationFailedError("hgvs-c", `deletion end before start: ${hgvsc}`);
  return { reference: m[1] ?? null, start, end };
}

/** "NC_000007.14:g.117559590_117559592del" (or g.<pos>del): the deleted forward-strand span, 1-based closed. */
export function parseHgvsGDeletion(hgvsg: string): { accession: string; start: number; end: number } {
  const m = /^(NC_\d{6}\.\d+):g\.(\d+)(?:_(\d+))?del$/.exec(hgvsg);
  if (!m) throw new ValidationFailedError("hgvs-g", `unsupported genomic HGVS deletion: ${hgvsg}`);
  const start = Number(m[2]);
  const end = m[3] === undefined ? start : Number(m[3]);
  if (end < start) throw new ValidationFailedError("hgvs-g", `deletion end before start: ${hgvsg}`);
  return { accession: m[1]!, start, end };
}

/** SPDI "acc:pos:deleted:inserted" (0-based interbase position; inserted may be empty). */
export function parseSpdi(spdi: string): { accession: string; position0: number; deleted: string; inserted: string } {
  const m = /^(NC_\d{6}\.\d+):(\d+):([ACGT]*):([ACGT]*)$/.exec(spdi);
  if (!m) throw new ValidationFailedError("spdi", `unsupported SPDI: ${spdi}`);
  return { accession: m[1]!, position0: Number(m[2]), deleted: m[3]!, inserted: m[4]! };
}

/**
 * The net deletion an SPDI expresses once the bases common to its deleted and inserted
 * sequences are removed from both ends (SPDI's contextual allele may repeat them), as a
 * left-aligned 1-based closed forward-strand span. Throws when the SPDI is not a pure deletion.
 */
export function spdiNetDeletion(spdi: string): { accession: string; start: number; end: number; deleted: string } {
  const p = parseSpdi(spdi);
  let prefix = 0;
  while (prefix < p.inserted.length && prefix < p.deleted.length && p.inserted[prefix] === p.deleted[prefix]) prefix++;
  let suffix = 0;
  while (suffix < p.inserted.length - prefix && suffix < p.deleted.length - prefix && p.inserted[p.inserted.length - 1 - suffix] === p.deleted[p.deleted.length - 1 - suffix]) suffix++;
  const inserted = p.inserted.slice(prefix, p.inserted.length - suffix);
  const deleted = p.deleted.slice(prefix, p.deleted.length - suffix);
  if (inserted.length > 0 || deleted.length === 0) throw new ValidationFailedError("spdi", `not a pure deletion: ${spdi}`);
  const start = p.position0 + prefix + 1;
  return { accession: p.accession, start, end: start + deleted.length - 1, deleted };
}

/**
 * Shift a deletion to its 3'-most equivalent position on the given strand of `seq` (HGVS
 * rule), where `seq` starts at forward-strand position `seqStart`. Returns the shifted
 * 1-based closed forward-strand span; throws if the shift reaches the end of `seq`, since the
 * sequence then does not show where the repeat ends.
 */
export function shiftDeletionThreePrime(seq: string, seqStart: number, start: number, end: number, strand: 1 | -1): { start: number; end: number } {
  const s = seq.toUpperCase();
  const len = end - start + 1;
  let a = start - seqStart; // 0-based index of the first deleted base in seq
  if (a < 0 || a + len > s.length) throw new ValidationFailedError("deletion-shift", `span ${start}-${end} is outside the sequence ${seqStart}-${seqStart + s.length - 1}`);
  if (strand === 1) {
    while (a + len < s.length && s[a + len] === s[a]) a++;
    if (a + len >= s.length) throw new ValidationFailedError("deletion-shift", `the repeat around ${start}-${end} reaches the end of the sequence; widen the window`);
  } else {
    while (a > 0 && s[a - 1] === s[a + len - 1]) a--;
    if (a <= 0) throw new ValidationFailedError("deletion-shift", `the repeat around ${start}-${end} reaches the start of the sequence; widen the window`);
  }
  return { start: seqStart + a, end: seqStart + a + len - 1 };
}

/** HGVS g. of a forward-strand deletion span. */
export function hgvsGDeletion(accession: string, start: number, end: number): string {
  return `${accession}:g.${start}${end > start ? `_${end}` : ""}del`;
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
