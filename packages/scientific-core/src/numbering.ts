// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Protein numbering (P2.4.4). Translated numbering (HGVS p., UniProt) counts the initiator
 * Met as 1. Mature numbering is derived from the UniProt Chain feature and exists only when
 * that chain starts after position 1. The "mature" label is produced here and only here.
 */
import { ValidationFailedError } from "@helix/data-adapters";
import { AA_THREE_LETTER } from "./sequence.ts";

export interface ProcessedChainRange {
  start: number;
  end: number;
}

/** matureIndex = uniprotPos - chainStart + 1, defined only inside the processed chain. */
export function matureIndex(uniprotPosition: number, chain: ProcessedChainRange | null): number | null {
  if (chain === null || chain.start <= 1) return null;
  if (uniprotPosition < chain.start || uniprotPosition > chain.end) {
    throw new ValidationFailedError("mature-index", `position ${uniprotPosition} is outside the processed chain ${chain.start}-${chain.end}`);
  }
  return uniprotPosition - chain.start + 1;
}

export function translatedLabel(ref: string, position: number, alt: string): string {
  return `p.${AA_THREE_LETTER[ref]}${position}${AA_THREE_LETTER[alt]} (translated numbering, Met = 1)`;
}

/** "Glu6Val (mature numbering)"; null when there is no processed chain. */
export function matureLabel(ref: string, uniprotPosition: number, alt: string, chain: ProcessedChainRange | null): string | null {
  const m = matureIndex(uniprotPosition, chain);
  if (m === null) return null;
  return `${AA_THREE_LETTER[ref]}${m}${AA_THREE_LETTER[alt]} (mature numbering)`;
}

/** Classify the numbering a structure file uses for its _entity.pdbx_mutation text. */
export function classifyPdbxMutation(
  text: string,
  uniprotSequence: string,
  chain: ProcessedChainRange | null,
): "mature/legacy" | "unknown" {
  const m = /^([A-Z])(\d+)([A-Z])\b/.exec(text.trim());
  if (!m || chain === null || chain.start <= 1) return "unknown";
  const ref = m[1]!;
  const pos = Number(m[2]);
  const translatedPos = pos + chain.start - 1;
  // The text uses mature numbering when its reference residue matches UniProt only after
  // shifting by the removed residues, and not at the literal position.
  const atShift = uniprotSequence[translatedPos - 1] === ref;
  const atLiteral = uniprotSequence[pos - 1] === ref;
  return atShift && !atLiteral ? "mature/legacy" : "unknown";
}
