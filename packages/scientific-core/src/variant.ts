// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Variant resolution for single-nucleotide substitutions (P2.4.4).
 *
 * HELIX does not write its own HGVS normaliser (scientific model §5): it keeps the source
 * strings (Ensembl variant_recoder) and checks that g., c. and p. agree through its own
 * coordinate code. A variant is keyed by allele, never by rsID alone.
 */
import type { EnsemblVariantRecoder } from "@helix/data-adapters";
import { ValidationFailedError } from "@helix/data-adapters";
import { type Transcript, type VersionedId, formatVersioned } from "@helix/shared-types";
import { cdsToGenome, codonOf, parseHgvsC, parseHgvsCDeletion, parseHgvsG, parseHgvsGDeletion, spdiNetDeletion } from "./coordinates.ts";
import { AA_THREE_LETTER, complement, proteinSubstitution, translate, translateCodon } from "./sequence.ts";

export interface CodingSubstitution {
  cdsPosition: number;
  codonNumber: number;
  positionInCodon: 1 | 2 | 3;
  refCodon: string;
  altCodon: string;
  refAa: string;
  altAa: string;
  /** "p.Glu7Val", computed by translating the codons. */
  proteinChange: string;
}

/** Apply c.<pos><ref>><alt> to the CDS and translate the codon before and after. */
export function applyCodingSubstitution(cds: string, cdsPosition: number, ref: string, alt: string): CodingSubstitution {
  const { codon, positionInCodon } = codonOf(cdsPosition);
  const refCodon = cds.slice(codon * 3 - 3, codon * 3).toUpperCase();
  if (refCodon.length !== 3) throw new ValidationFailedError("codon", `codon ${codon} is outside the CDS`);
  const refBase = refCodon[positionInCodon - 1];
  if (refBase !== ref) throw new ValidationFailedError("reference-base", `CDS has ${refBase} at c.${cdsPosition}, HGVS says ${ref}`);
  const altCodon = refCodon.slice(0, positionInCodon - 1) + alt + refCodon.slice(positionInCodon);
  const refAa = translateCodon(refCodon);
  const altAa = translateCodon(altCodon);
  return {
    cdsPosition,
    codonNumber: codon,
    positionInCodon,
    refCodon,
    altCodon,
    refAa,
    altAa,
    proteinChange: refAa === altAa ? `p.${refAa}${codon}=` : proteinSubstitution(refAa, codon, altAa),
  };
}

export interface ResolvedAllele {
  forwardAllele: string;
  hgvsg: string;
  spdi: string;
  genomicPosition: number;
  genomicRef: string;
  genomicAlt: string;
  /** hgvsc on the selected transcript and its RefSeq match only. */
  hgvsc: string[];
  /** hgvsp on the selected translation and its RefSeq protein only. */
  hgvsp: string[];
  coding: CodingSubstitution;
  /** Own exon walk: genomic position of the c. position. */
  genomicPositionFromExonWalk: number;
}

/** Resolve one forward-strand allele of a variant_recoder response against the selected transcript. */
export function resolveAllele(
  recoder: EnsemblVariantRecoder,
  forwardAllele: string,
  ctx: { transcript: Transcript; cds: string; refSeqTranscript: VersionedId | null; refSeqProtein: string | null },
): ResolvedAllele {
  const entry = recoder.map((r) => r[forwardAllele]).find((x) => x !== undefined);
  if (!entry) throw new ValidationFailedError("variant-allele", `allele ${forwardAllele} not present in variant_recoder response`);
  const t = ctx.transcript;
  if (!t.translation) throw new ValidationFailedError("variant-allele", "selected transcript has no translation");
  const tId = formatVersioned(t.id);
  const pId = formatVersioned(t.translation.id);
  const refSeqT = ctx.refSeqTranscript ? formatVersioned(ctx.refSeqTranscript) : null;
  const hgvsg = entry.hgvsg.find((h) => /^NC_\d{6}\.\d+:g\./.test(h));
  const spdi = entry.spdi.find((s) => /^NC_\d{6}\.\d+:/.test(s));
  if (!hgvsg || !spdi) throw new ValidationFailedError("variant-allele", `no chromosome-level hgvsg/spdi for allele ${forwardAllele}`);
  const hgvsc = entry.hgvsc.filter((h) => h.startsWith(`${tId}:`) || (refSeqT !== null && h.startsWith(`${refSeqT}:`)));
  const hgvsp = entry.hgvsp.filter((h) => h.startsWith(`${pId}:`) || (ctx.refSeqProtein !== null && h.startsWith(`${ctx.refSeqProtein}:`)));
  const ensC = hgvsc.find((h) => h.startsWith(`${tId}:`));
  if (!ensC) throw new ValidationFailedError("variant-allele", `no hgvsc on ${tId} for allele ${forwardAllele}`);
  const c = parseHgvsC(ensC);
  const g = parseHgvsG(hgvsg);
  const coding = applyCodingSubstitution(ctx.cds, c.position, c.ref, c.alt);
  const walk = cdsToGenome(t, c.position);
  // Strand consistency: on a reverse-strand gene the coding alleles are complements of the forward alleles.
  const expectRef = t.interval.strand === -1 ? complement(g.ref) : g.ref;
  const expectAlt = t.interval.strand === -1 ? complement(g.alt) : g.alt;
  if (c.ref !== expectRef || c.alt !== expectAlt) {
    throw new ValidationFailedError("strand-alleles", `c. alleles ${c.ref}>${c.alt} are not the strand-adjusted g. alleles ${g.ref}>${g.alt}`);
  }
  return {
    forwardAllele,
    hgvsg,
    spdi,
    genomicPosition: g.position,
    genomicRef: g.ref,
    genomicAlt: g.alt,
    hgvsc,
    hgvsp,
    coding,
    genomicPositionFromExonWalk: walk,
  };
}

/** Every allele at an rsID with its computed protein change, so no allele is mistaken for another. */
export function allelesAtSite(
  recoder: EnsemblVariantRecoder,
  ctx: { transcript: Transcript; cds: string; refSeqTranscript: VersionedId | null; refSeqProtein: string | null },
): ResolvedAllele[] {
  const unplaced = new Set(unplacedRecoderAlleles(recoder).map((u) => u.allele));
  const alleles = [...new Set(recoder.flatMap((r) => Object.keys(r)))].sort().filter((a) => !unplaced.has(a));
  return alleles.map((a) => resolveAllele(recoder, a, ctx));
}

/**
 * Recoder allele keys that carry no chromosome-level (NC_) hgvsg or SPDI: an allele placed only on an
 * alternate scaffold or patch (measured on 2026-11-03, rs1064795122: the key "T" lists NT_187547.1
 * only, the same change seen from the reverse-oriented alt contig HSCHR5_3_CTG1). Such a key is not
 * an allele of the primary-assembly site; it is reported with its placements, never resolved against
 * the transcript and never counted as another allele (Phase 9, P9.2.3).
 */
export function unplacedRecoderAlleles(recoder: EnsemblVariantRecoder): { allele: string; placements: string[] }[] {
  const out: { allele: string; placements: string[] }[] = [];
  for (const r of recoder) {
    for (const [allele, e] of Object.entries(r)) {
      const placed = e.hgvsg.some((h) => /^NC_\d{6}\.\d+:g\./.test(h)) && e.spdi.some((x) => /^NC_\d{6}\.\d+:/.test(x));
      if (!placed && !out.some((o) => o.allele === allele)) out.push({ allele, placements: [...e.hgvsg, ...e.spdi] });
    }
  }
  return out.sort((a, b) => a.allele.localeCompare(b.allele));
}

// ---------------------------------------------------------------- in-frame deletions (Phase 9, plan section 11)

export interface AffectedCodonChange {
  number: number;
  reference: string;
  /** The codon's bases after the deletion, or null when the codon disappears. */
  afterDeletion: string | null;
  referenceAminoAcid: string;
  aminoAcidAfterDeletion: string | null;
}

export interface CodingDeletion {
  cdsStart: number;
  cdsEnd: number;
  length: number;
  /** The deleted bases on the coding strand. */
  deletedBases: string;
  /** Every codon the span touches, in order. */
  affectedCodons: AffectedCodonChange[];
  /** The residues the protein loses, after 3' normalisation at the protein level (translated numbering). */
  deletedResidues: { position: number; aminoAcid: string }[];
  /** UniProt position of the first deleted residue. */
  residue: number;
  /** "p.Phe508del" or "p.Xxx12_Yyy14del", computed by translating the CDS before and after. */
  proteinChange: string;
}

/**
 * Apply an in-frame deletion c.<start>_<end>del to the CDS: the codons it touches before and
 * after, the residues lost and the protein change by translation. A span whose length is not a
 * multiple of three (a frameshift) and a deletion whose junction creates a new residue (a
 * deletion-insertion at the protein level) are refused: both are out of scope for this phase.
 */
export function applyCodingDeletion(cds: string, cdsStart: number, cdsEnd: number): CodingDeletion {
  const s = cds.toUpperCase();
  if (!Number.isInteger(cdsStart) || !Number.isInteger(cdsEnd) || cdsStart < 1 || cdsEnd < cdsStart) throw new ValidationFailedError("deletion", `invalid deleted span c.${cdsStart}_${cdsEnd}`);
  if (cdsEnd > s.length) throw new ValidationFailedError("deletion", `c.${cdsStart}_${cdsEnd}del is outside the CDS (${s.length} nt)`);
  const length = cdsEnd - cdsStart + 1;
  if (length % 3 !== 0) throw new ValidationFailedError("frameshift", `c.${cdsStart}_${cdsEnd}del deletes ${length} base(s), not a multiple of three: a frameshift is out of scope for this phase (docs/phase-9-generalisation.md section 11 rule 1)`);
  const k = length / 3;
  const firstCodon = codonOf(cdsStart).codon;
  const lastCodon = codonOf(cdsEnd).codon;
  const after = s.slice(0, cdsStart - 1) + s.slice(cdsEnd);
  const codonAt = (seq: string, n: number): string => seq.slice(n * 3 - 3, n * 3);
  const m = lastCodon - firstCodon + 1; // codons touched
  const kept = m - k; // codons the touched window still forms after the deletion
  const affectedCodons: AffectedCodonChange[] = [];
  for (let n = firstCodon; n <= lastCodon; n++) {
    const reference = codonAt(s, n);
    const survives = n < firstCodon + kept;
    const afterDeletion = survives ? codonAt(after, n) : null;
    affectedCodons.push({ number: n, reference, afterDeletion, referenceAminoAcid: translateCodon(reference), aminoAcidAfterDeletion: afterDeletion === null ? null : translateCodon(afterDeletion) });
  }
  const before = translate(s, { toStop: true });
  const afterProtein = translate(after, { toStop: true });
  if (afterProtein.length !== before.length - k) {
    throw new ValidationFailedError("deletion", `translating the CDS after c.${cdsStart}_${cdsEnd}del gives ${afterProtein.length} aa, expected ${before.length - k} (the deletion touches the stop codon or creates one); out of scope for this phase`);
  }
  let p = 0;
  while (p < afterProtein.length && before[p] === afterProtein[p]) p++;
  // 3' rule at the protein level: when the residue after the deleted run equals the first deleted one, the deletion moves right.
  while (p + k < before.length && before[p + k] === before[p]) p++;
  if (before.slice(0, p) + before.slice(p + k) !== afterProtein) {
    throw new ValidationFailedError("delins", `c.${cdsStart}_${cdsEnd}del changes a residue at the junction (a deletion-insertion at the protein level, not a pure deletion); out of scope for this phase`);
  }
  const deletedResidues = Array.from({ length: k }, (_, i) => ({ position: p + 1 + i, aminoAcid: before[p + i]! }));
  const first = deletedResidues[0]!;
  const last = deletedResidues[deletedResidues.length - 1]!;
  const three = (aa: string): string => {
    const t = AA_THREE_LETTER[aa];
    if (!t) throw new ValidationFailedError("hgvs-p", `unknown amino acid ${aa}`);
    return t;
  };
  const proteinChange = k === 1 ? `p.${three(first.aminoAcid)}${first.position}del` : `p.${three(first.aminoAcid)}${first.position}_${three(last.aminoAcid)}${last.position}del`;
  return { cdsStart, cdsEnd, length, deletedBases: s.slice(cdsStart - 1, cdsEnd), affectedCodons, deletedResidues, residue: first.position, proteinChange };
}

export interface ResolvedDeletion {
  /** The transcript-level HGVS the specification named, confirmed in the recoder response. */
  hgvsC: string;
  /** The recoder key under which the deletion is listed (the allele string as Ensembl writes it). */
  recoderAllele: string;
  hgvsg: string;
  spdi: string;
  /** Deleted forward-strand span (1-based closed) as the genomic HGVS names it. */
  genomicStart: number;
  genomicEnd: number;
  /** Deleted bases on the forward strand, from the SPDI. */
  deletedForward: string;
  /** hgvsc on the selected transcript and its RefSeq match only. */
  hgvsc: string[];
  /** hgvsp on the selected translation and its RefSeq protein only. */
  hgvsp: string[];
  coding: CodingDeletion;
  /** Own exon walk of c.start and c.end, as a forward-strand span. */
  genomicSpanFromExonWalk: { start: number; end: number };
}

/**
 * Resolve an in-frame deletion named by its transcript-level HGVS (c.<start>_<end>del on the
 * selected transcript) in a variant_recoder response: the entry whose hgvsc lists it, its
 * chromosome-level g. and SPDI, and the deletion applied to the CDS. The recoder confirms the
 * HGVS; nothing in the specification is trusted beyond that string.
 */
export function resolveDeletion(
  recoder: EnsemblVariantRecoder,
  hgvsC: string,
  ctx: { transcript: Transcript; cds: string; refSeqTranscript: VersionedId | null; refSeqProtein: string | null },
): ResolvedDeletion {
  const t = ctx.transcript;
  if (!t.translation) throw new ValidationFailedError("variant-allele", "selected transcript has no translation");
  const tId = formatVersioned(t.id);
  const pId = formatVersioned(t.translation.id);
  const refSeqT = ctx.refSeqTranscript ? formatVersioned(ctx.refSeqTranscript) : null;
  const wanted = `${tId}:${hgvsC}`;
  let recoderAllele: string | null = null;
  let entry: EnsemblVariantRecoder[number][string] | undefined;
  for (const r of recoder) {
    for (const [allele, e] of Object.entries(r)) {
      if (e.hgvsc.includes(wanted)) {
        recoderAllele = allele;
        entry = e;
      }
    }
  }
  if (!entry || recoderAllele === null) {
    const seen = recoder.flatMap((r) => Object.values(r).flatMap((e) => e.hgvsc.filter((h) => h.startsWith(`${t.id.id}`))));
    throw new ValidationFailedError("variant-allele", `variant_recoder does not list ${wanted}; on ${t.id.id} it lists: ${seen.join(", ") || "nothing"}`);
  }
  const hgvsg = entry.hgvsg.find((h) => /^NC_\d{6}\.\d+:g\./.test(h));
  const spdi = entry.spdi.find((s) => /^NC_\d{6}\.\d+:/.test(s));
  if (!hgvsg || !spdi) throw new ValidationFailedError("variant-allele", `no chromosome-level hgvsg/spdi for ${wanted}`);
  const g = parseHgvsGDeletion(hgvsg);
  const net = spdiNetDeletion(spdi);
  const c = parseHgvsCDeletion(hgvsC);
  const coding = applyCodingDeletion(ctx.cds, c.start, c.end);
  if (net.deleted.length !== coding.length || g.end - g.start + 1 !== coding.length) {
    throw new ValidationFailedError("deletion-length", `c. deletes ${coding.length} bases, g. ${g.end - g.start + 1}, SPDI ${net.deleted.length}`);
  }
  const hgvsc = entry.hgvsc.filter((h) => h.startsWith(`${tId}:`) || (refSeqT !== null && h.startsWith(`${refSeqT}:`)));
  const hgvsp = entry.hgvsp.filter((h) => h.startsWith(`${pId}:`) || (ctx.refSeqProtein !== null && h.startsWith(`${ctx.refSeqProtein}:`)));
  const w1 = cdsToGenome(t, c.start);
  const w2 = cdsToGenome(t, c.end);
  return {
    hgvsC,
    recoderAllele,
    hgvsg,
    spdi,
    genomicStart: g.start,
    genomicEnd: g.end,
    deletedForward: net.deleted,
    hgvsc,
    hgvsp,
    coding,
    genomicSpanFromExonWalk: { start: Math.min(w1, w2), end: Math.max(w1, w2) },
  };
}

/** Strip the reference prefix: "ENSP00000333994.3:p.Glu7Val" -> "p.Glu7Val". */
export function hgvsChangePart(h: string): string {
  const i = h.indexOf(":");
  return i < 0 ? h : h.slice(i + 1);
}
