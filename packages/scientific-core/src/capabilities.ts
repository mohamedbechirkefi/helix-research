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
  /**
   * The experimental entry the gene specification selected, or null when it selected none
   * (Phase 9). Cross-referenced entries that were not selected are reported, never shown.
   * `coverage` (P9.2.2, plan section 13 rule 3) is the structure record's own sentence for what
   * the entry covers ("2HBS covers residues 2 to 147 of 147 ..."), repeated in the reason so that
   * a partial structure is never read as the whole protein; absent only for callers that predate it.
   */
  selectedStructure: { entryId: string; coverage?: string } | null;
  /** Entries for which a residue mapping was built and verified (SIFTS + atom_site). */
  verifiedMappings: { entryId: string; uniprotPosition: number }[];
  predictedModel: { modelId: string; version: number } | null;
  /** Variant positions requested by the journey, in translated numbering. */
  variantPositions: number[];
  /**
   * Phase 9 (P9.1.2): what Reactome said, or null when the specification did not ask for
   * pathways. `opening` is the membership the world opens on, chosen by rule (plan section 12
   * rule 3, the rule's choice and never an importance), null when no membership qualifies; the
   * `reason` is the rule's own sentence for that case.
   */
  pathways: { membershipCount: number; opening: { stableId: string; name: string } | null; reason: string } | null;
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
  const entries = `${i.experimentalStructures.length} experimental entr${i.experimentalStructures.length === 1 ? "y" : "ies"}`;
  const experimentalStructure =
    i.experimentalStructures.length === 0
      ? no("no experimental structure is cross-referenced for this protein")
      : i.selectedStructure === null
        ? no(`no experimental structure selected in the gene specification; ${entries} cross-referenced (e.g. ${i.experimentalStructures[0]!.entryId}, ${i.experimentalStructures[0]!.method}) but none was selected, so none is shown`)
        : i.selectedStructure.coverage !== undefined
          ? yes(`${i.selectedStructure.coverage}; ${entries} cross-referenced (e.g. ${i.experimentalStructures[0]!.entryId}, ${i.experimentalStructures[0]!.method})`, 1)
          : yes(`${entries} (e.g. ${i.experimentalStructures[0]!.entryId}, ${i.experimentalStructures[0]!.method})`, 1);
  const predictedStructure = i.predictedModel
    ? yes(`${i.predictedModel.modelId} v${i.predictedModel.version}; computational prediction, never shown as experimental`, 3)
    : no("no predicted model loaded");
  const verifiedResidueMapping =
    i.verifiedMappings.length > 0
      ? yes(`verified SIFTS + atom_site mapping for ${[...new Set(i.verifiedMappings.map((m) => m.entryId))].join(", ")}`, 1)
      : no(
          experimentalStructure.available
            ? "experimental entries exist but no mapping was verified"
            : i.experimentalStructures.length > 0 && i.selectedStructure === null
              ? "no experimental structure selected in the gene specification, so there is nothing to map onto"
              : "no experimental structure to map onto",
        );
  const unmapped = i.variantPositions.filter((p) => !i.verifiedMappings.some((m) => m.uniprotPosition === p));
  const variantHighlight =
    i.variantPositions.length === 0
      ? no("no reference variant selected")
      : unmapped.length === 0
        ? yes(`variant position(s) ${i.variantPositions.join(", ")} mapped to observed residues in an experimental structure`, 1)
        : no(`variant position(s) ${unmapped.join(", ")} not mapped to an experimental structure; a predicted model is never used to place a variant`);
  // Membership, never mechanism (plan section 12 rule 4): available when at least one membership qualifies
  // for the opening rule; the reason names the count and the opening pathway as the rule's choice, never as
  // importance. With memberships but no qualifying one, the reason is the rule's own sentence.
  const pathwayView =
    i.pathways === null
      ? no("pathways not requested in the gene specification")
      : i.pathways.membershipCount === 0
        ? no("no Reactome pathway lists this protein")
        : i.pathways.opening === null
          ? no(i.pathways.reason)
          : yes(`${i.pathways.membershipCount} Reactome membership${i.pathways.membershipCount === 1 ? "" : "s"}; opens on ${i.pathways.opening.name}, ${i.pathways.opening.stableId} (the rule's choice: fewest participants among non-disease pathways with a diagram)`, 2);
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
    pathwayView,
  };
}
