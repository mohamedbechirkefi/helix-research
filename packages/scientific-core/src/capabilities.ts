// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Scientific capability checks (P2.4.6): what HELIX can honestly show for a gene. Each
 * capability says why it is or is not available, and with which evidence class. A scene
 * may only offer what is available here.
 */
import type { CapabilityReport, TranscriptSelection } from "@helix/shared-types";

export interface CapabilityInput {
  geneId: string;
  symbol: string;
  biotype: string;
  transcriptSelection: TranscriptSelection | null;
  hasTranslation: boolean;
  protein: { accession: string; sequenceVerified: boolean } | null;
  /** Experimental entries known for the protein (e.g. UniProt PDB cross-references). */
  experimentalStructures: { entryId: string; method: string }[];
  /** Entries for which a residue mapping was built and verified (SIFTS + atom_site). */
  verifiedMappings: { entryId: string; uniprotPosition: number }[];
  predictedModel: { modelId: string; version: number } | null;
  /** Variant positions requested by the journey, in translated numbering. */
  variantPositions: number[];
}

const yes = (reason: string, evidenceCategory: number | null) => ({ available: true, reason, evidenceCategory });
const no = (reason: string) => ({ available: false, reason, evidenceCategory: 6 });

export function capabilities(i: CapabilityInput): CapabilityReport {
  const transcriptView = i.transcriptSelection
    ? yes(`transcript ${i.transcriptSelection.selected.id}.${i.transcriptSelection.selected.version} selected by rule ${i.transcriptSelection.rule}`, 2)
    : no("no MANE Select or Ensembl canonical transcript");
  const proteinView = !i.hasTranslation
    ? no(`gene biotype ${i.biotype}: the selected transcript has no translation`)
    : i.protein === null
      ? no("no UniProt record cross-referenced to the selected transcript")
      : i.protein.sequenceVerified
        ? yes(`UniProt ${i.protein.accession}; sequence equals the translated CDS`, 2)
        : no(`UniProt ${i.protein.accession} sequence does not equal the translated CDS`);
  const experimentalStructure =
    i.experimentalStructures.length === 0
      ? no("no experimental structure is cross-referenced for this protein")
      : yes(`${i.experimentalStructures.length} experimental entr${i.experimentalStructures.length === 1 ? "y" : "ies"} (e.g. ${i.experimentalStructures[0]!.entryId}, ${i.experimentalStructures[0]!.method})`, 1);
  const predictedStructure = i.predictedModel
    ? yes(`${i.predictedModel.modelId} v${i.predictedModel.version}; computational prediction, never shown as experimental`, 3)
    : no("no predicted model loaded");
  const verifiedResidueMapping =
    i.verifiedMappings.length > 0
      ? yes(`verified SIFTS + atom_site mapping for ${[...new Set(i.verifiedMappings.map((m) => m.entryId))].join(", ")}`, 1)
      : no(experimentalStructure.available ? "experimental entries exist but no mapping was verified" : "no experimental structure to map onto");
  const unmapped = i.variantPositions.filter((p) => !i.verifiedMappings.some((m) => m.uniprotPosition === p));
  const variantHighlight =
    i.variantPositions.length === 0
      ? no("no variant requested")
      : unmapped.length === 0
        ? yes(`variant position(s) ${i.variantPositions.join(", ")} mapped to observed residues in an experimental structure`, 1)
        : no(`variant position(s) ${unmapped.join(", ")} not mapped to an experimental structure; a predicted model is never used to place a variant`);
  return {
    kind: "capabilities",
    derivedFrom: [],
    geneId: i.geneId,
    symbol: i.symbol,
    transcriptView,
    proteinView,
    experimentalStructure,
    predictedStructure,
    verifiedResidueMapping,
    variantHighlight,
  };
}
