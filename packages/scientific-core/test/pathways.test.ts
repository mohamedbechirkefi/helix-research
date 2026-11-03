// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/** The opening-pathway rule (Phase 9, P9.1.2; plan §12 rule 3, amended 2026-11-03) on hand-made memberships. */
import { describe, expect, it } from "vitest";
import { OPENING_PATHWAY_RULE, OPENING_PATHWAY_RULE_TEXT, chooseOpeningPathway, isOpeningCandidate } from "../src/index.ts";

const m = (stableId: string, participantCount: number | null, opts: { disease?: boolean; diagram?: boolean } = {}) => ({
  stableId,
  name: `pathway ${stableId}`,
  isDisease: opts.disease ?? false,
  hasDiagram: opts.diagram ?? true,
  participantCount,
});

describe("opening pathway by rule: fewest participants among non-disease pathways with a diagram, ties by stable id; the rule's choice, never an importance", () => {
  it("picks the fewest participants, lists the candidates in rank order and the exclusions with their reason, and says the choice is not importance", () => {
    const c = chooseOpeningPathway([m("R-HSA-10", 25), m("R-HSA-20", 8), m("R-HSA-30", null, { disease: true }), m("R-HSA-40", null, { diagram: false }), m("R-HSA-50", 120)]);
    expect(c.opening).toBe("R-HSA-20");
    expect(c.candidates).toEqual([
      { stableId: "R-HSA-20", participantCount: 8 },
      { stableId: "R-HSA-10", participantCount: 25 },
      { stableId: "R-HSA-50", participantCount: 120 },
    ]);
    expect(c.excluded).toEqual([
      { stableId: "R-HSA-30", reason: "a disease pathway" },
      { stableId: "R-HSA-40", reason: "no diagram" },
    ]);
    expect(c.reason).toBe("R-HSA-20 (pathway R-HSA-20) has the fewest participants (8) among the 3 non-disease membership(s) with a diagram; the rule's choice, not a statement of importance");
    expect(OPENING_PATHWAY_RULE).toBe("fewest-participants-non-disease-with-diagram");
    expect(OPENING_PATHWAY_RULE_TEXT).toBe("the rule's choice: fewest participants among non-disease pathways with a diagram");
    expect(JSON.stringify(c)).not.toMatch(/primary/i);
  });
  it("breaks a tie by stable id, by its number (R-HSA-983231 before R-HSA-1237044), and says so", () => {
    const c = chooseOpeningPathway([m("R-HSA-1237044", 5), m("R-HSA-983231", 5), m("R-HSA-9925563", 5), m("R-HSA-7", 9)]);
    expect(c.opening).toBe("R-HSA-983231");
    expect(c.candidates.map((x) => x.stableId)).toEqual(["R-HSA-983231", "R-HSA-1237044", "R-HSA-9925563", "R-HSA-7"]);
    expect(c.reason).toMatch(/tie among R-HSA-983231, R-HSA-1237044, R-HSA-9925563 broken by stable id/);
  });
  it("a membership that is both a disease pathway and without a diagram is excluded for both reasons", () => {
    const c = chooseOpeningPathway([m("R-HSA-1", 3), m("R-HSA-2", null, { disease: true, diagram: false })]);
    expect(c.excluded).toEqual([{ stableId: "R-HSA-2", reason: "a disease pathway, no diagram" }]);
    expect(isOpeningCandidate({ isDisease: true, hasDiagram: false })).toBe(false);
    expect(isOpeningCandidate({ isDisease: false, hasDiagram: true })).toBe(true);
  });
  it("no membership: no opening pathway, and the reason is the capability's wording", () => {
    expect(chooseOpeningPathway([])).toEqual({ opening: null, candidates: [], excluded: [], reason: "no Reactome pathway lists this protein" });
  });
  it("memberships but none that qualifies (all disease, or none with a diagram): no opening pathway; every membership is kept with its exclusion", () => {
    const allDisease = chooseOpeningPathway([m("R-HSA-1", null, { disease: true }), m("R-HSA-2", null, { disease: true })]);
    expect(allDisease.opening).toBeNull();
    expect(allDisease.candidates).toEqual([]);
    expect(allDisease.excluded.map((e) => e.stableId)).toEqual(["R-HSA-1", "R-HSA-2"]);
    expect(allDisease.reason).toBe("2 membership(s), none a non-disease pathway with a diagram (R-HSA-1: a disease pathway; R-HSA-2: a disease pathway), so no opening pathway is chosen");
    const noDiagram = chooseOpeningPathway([m("R-HSA-3", null, { diagram: false })]);
    expect(noDiagram.opening).toBeNull();
    expect(noDiagram.reason).toMatch(/R-HSA-3: no diagram/);
  });
  it("a candidate whose participant count is unknown is an error, never a silent default", () => {
    expect(() => chooseOpeningPathway([m("R-HSA-1", 3), m("R-HSA-2", null)])).toThrow(/R-HSA-2 is a candidate of the opening-pathway rule but its participant count is unknown/);
  });
  it("the specification cannot name a pathway: the rule takes memberships only (a zero count is a valid count and wins)", () => {
    const c = chooseOpeningPathway([m("R-HSA-1", 0), m("R-HSA-2", 1)]);
    expect(c.opening).toBe("R-HSA-1");
  });
});
