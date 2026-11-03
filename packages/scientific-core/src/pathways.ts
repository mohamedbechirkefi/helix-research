// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * The opening-pathway rule (Phase 9, P9.1.2; docs/phase-9-generalisation.md section 12 rule 3,
 * amended 2026-11-03). The rule is mechanical: among the memberships that are not disease
 * pathways and have a diagram, the one with the fewest participants; ties by stable id (by its
 * number). It names only the pathway Pathway World opens on, stated as the rule's choice and
 * never as importance: on HBB it picks a microautophagy pathway in which haemoglobin is one
 * substrate among sixteen, not an erythrocyte pathway. The record keeps the participants of
 * every candidate so that a visitor can open any membership. The specification may not name
 * a pathway.
 *
 * What the rule does when the plan's conditions do not hold:
 * - no membership: no opening pathway ("no Reactome pathway lists this protein");
 * - memberships, but none that is both non-disease and with a diagram: no opening pathway,
 *   and the reason says which condition excluded each membership; the record keeps every
 *   membership and the capability is unavailable with that sentence;
 * - a candidate whose participant count is unknown: an error, because the rule cannot be
 *   applied honestly without it (the builder requests the participants of every candidate).
 */
import { compareStableIds } from "@helix/data-adapters";

export interface OpeningCandidateInput {
  stableId: string;
  name: string;
  isDisease: boolean;
  hasDiagram: boolean;
  /** Participating physical entities Reactome returns for the pathway; null when not requested. */
  participantCount: number | null;
}

export interface OpeningPathwayChoice {
  /** The stable id the world opens on, or null when no membership qualifies. */
  opening: string | null;
  /** The qualifying memberships with their counts, in the order the rule ranked them. */
  candidates: { stableId: string; participantCount: number }[];
  /** The memberships the rule excluded and why. */
  excluded: { stableId: string; reason: string }[];
  /** One sentence a record and a capability report can carry. */
  reason: string;
}

export const OPENING_PATHWAY_RULE = "fewest-participants-non-disease-with-diagram" as const;
/** The rule in words, as the capability reason states it. */
export const OPENING_PATHWAY_RULE_TEXT = "the rule's choice: fewest participants among non-disease pathways with a diagram";

/** Whether a membership is a candidate of the rule (non-disease, with a diagram). */
export function isOpeningCandidate(m: Pick<OpeningCandidateInput, "isDisease" | "hasDiagram">): boolean {
  return !m.isDisease && m.hasDiagram;
}

export function chooseOpeningPathway(memberships: readonly OpeningCandidateInput[]): OpeningPathwayChoice {
  if (memberships.length === 0) return { opening: null, candidates: [], excluded: [], reason: "no Reactome pathway lists this protein" };
  const excluded: OpeningPathwayChoice["excluded"] = [];
  const candidates: { stableId: string; participantCount: number }[] = [];
  for (const m of memberships) {
    if (!isOpeningCandidate(m)) {
      const why = [m.isDisease ? "a disease pathway" : null, m.hasDiagram ? null : "no diagram"].filter((x): x is string => x !== null).join(", ");
      excluded.push({ stableId: m.stableId, reason: why });
      continue;
    }
    if (m.participantCount === null) throw new Error(`${m.stableId} is a candidate of the opening-pathway rule but its participant count is unknown`);
    candidates.push({ stableId: m.stableId, participantCount: m.participantCount });
  }
  candidates.sort((a, b) => a.participantCount - b.participantCount || compareStableIds(a.stableId, b.stableId));
  const first = candidates[0];
  if (!first) {
    return {
      opening: null,
      candidates,
      excluded,
      reason: `${memberships.length} membership(s), none a non-disease pathway with a diagram (${excluded.map((e) => `${e.stableId}: ${e.reason}`).join("; ")}), so no opening pathway is chosen`,
    };
  }
  const tied = candidates.filter((c) => c.participantCount === first.participantCount);
  const name = memberships.find((m) => m.stableId === first.stableId)!.name;
  const tie = tied.length > 1 ? `; tie among ${tied.map((c) => c.stableId).join(", ")} broken by stable id` : "";
  return {
    opening: first.stableId,
    candidates,
    excluded,
    reason: `${first.stableId} (${name}) has the fewest participants (${first.participantCount}) among the ${candidates.length} non-disease membership(s) with a diagram${tie}; the rule's choice, not a statement of importance`,
  };
}
