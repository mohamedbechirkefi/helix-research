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
import { cdsToGenome, codonOf, parseHgvsC, parseHgvsG } from "./coordinates.ts";
import { complement, proteinSubstitution, translateCodon } from "./sequence.ts";

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
  const alleles = [...new Set(recoder.flatMap((r) => Object.keys(r)))].sort();
  return alleles.map((a) => resolveAllele(recoder, a, ctx));
}

/** Strip the reference prefix: "ENSP00000333994.3:p.Glu7Val" -> "p.Glu7Val". */
export function hgvsChangePart(h: string): string {
  const i = h.indexOf(":");
  return i < 0 ? h : h.slice(i + 1);
}
