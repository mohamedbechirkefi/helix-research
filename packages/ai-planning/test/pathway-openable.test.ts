// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Author decision D-H024 answer 71 (2026-11-04): showPathway is valid only for a membership whose
 * participants the pathway record keeps (participantsByPathway, the opening rule's candidates); the app
 * cannot draw any other membership. This file first pinned the behaviour before the change (characterise
 * before changing): the validator accepted showPathway on any listed membership and the rule-based planner
 * planned it for a named non-openable membership, while the app threw at execution. The pins below are
 * the behaviour after the change; the "before" pins are kept in the comment of each test.
 */
import { describe, expect, it } from "vitest";
import { buildHbbContext, deterministicPlan, pathwayContext, validatePlan, withExplorerRecords, type Plan, type PlanningContext } from "../src/index.ts";
import { hbbBundleWithPathways, pathwaysRecord } from "./load.ts";

const PHASE6 = ["resolveGene", "resolveVariant", "loadStructure", "enterWorld", "focusCamera", "highlightResidue", "revealEvidence", "cancelActions", "compareVariants", "highlightSequenceRegion"];
const PHASE10 = ["selectTranscript", "showProteinDomains", "showPathway", "setRepresentation", "beginTransition", "returnToOverview"];
const b = hbbBundleWithPathways();
const hbb = (): PlanningContext => ({ ...withExplorerRecords(buildHbbContext(b), b), executableActions: [...PHASE6, ...PHASE10], routeByCues: true, cueRules: "dh010", answer: "follow-up", currentWorld: "dna" });
const plan = (actions: Plan["actions"]): Plan => ({ outcome: "plan", intent: "other", entities: { geneId: null, proteinId: null, variantId: null, structureId: null }, actions, explanationLevel: "intermediate", citations: [], followUps: [], reason: null });
/** HBB: Scavenging of heme from plasma is listed in the record, but its participants are not kept. */
const NOT_OPENABLE = "R-HSA-2168880";
const OPENABLE = "R-HSA-1247673";

describe("D-H024 (71): which memberships can be opened", () => {
  it("the context marks a membership openable exactly when the record keeps its participants", () => {
    for (const set of ["hbb", "cftr", "brca1", "slc6a3", "faah2"]) {
      const rec = pathwaysRecord(set) as { participantsByPathway: { stableId: string }[]; openingPathway: { stableId: string } | null };
      const kept = new Set(rec.participantsByPathway.map((p) => p.stableId));
      const ps = pathwayContext(rec).pathways;
      expect(ps.filter((p) => p.openable).map((p) => p.stableId).sort(), set).toEqual([...kept].sort());
      // The opening membership is always openable (it is one of the rule's candidates).
      if (rec.openingPathway) expect(ps.find((p) => p.stableId === rec.openingPathway!.stableId)?.openable, set).toBe(true);
    }
    const p = hbb().pathways!.find((x) => x.stableId === NOT_OPENABLE)!;
    expect(p).toMatchObject({ name: "Scavenging of heme from plasma", openable: false });
  });

  it("the validator rejects showPathway on a membership that cannot be opened (before: accepted, [])", () => {
    expect(validatePlan(plan([{ type: "showPathway", stableId: OPENABLE }]), hbb()).issues).toEqual([]);
    expect(validatePlan(plan([{ type: "showPathway" }]), hbb()).issues).toEqual([]);
    const v = validatePlan(plan([{ type: "showPathway", stableId: NOT_OPENABLE }]), hbb());
    expect(v.ok).toBe(false);
    expect(v.issues.map((i) => [i.code, i.path, i.value])).toEqual([["pathway-not-openable", "actions.0.stableId", NOT_OPENABLE]]);
    expect(v.issues[0]!.message).toBe("Scavenging of heme from plasma (R-HSA-2168880) is listed in the record, but its participants are not kept (the record keeps them for the opening rule's candidates only), so Pathway World cannot open it; it stays in the memberships list");
  });

  it("the rule-based planner never plans one; it answers from the record without showPathway (before: showPathway R-HSA-2168880, rule pathway-named)", () => {
    const q = "Show the scavenging of heme from plasma pathway";
    const { plan: p, rule } = deterministicPlan(q, hbb());
    expect(rule).toBe("pathway-named-not-openable");
    expect(p.actions.map((a) => a.type)).not.toContain("showPathway");
    expect(p.outcome).toBe("plan");
    expect(p.actions).toEqual([{ type: "revealEvidence", evidenceId: "reactome:P68871" }]);
    expect(p.reason).toBe("Scavenging of heme from plasma (R-HSA-2168880) lists P68871 in the Reactome record, but the record does not keep its participants, so Pathway World cannot draw it; it stays in the memberships list.");
    expect(validatePlan(p, hbb(), { query: q }).issues).toEqual([]);
    // By stable id too; an openable membership is still opened.
    expect(deterministicPlan(`Open ${NOT_OPENABLE}`, hbb()).rule).toBe("pathway-named-not-openable");
    expect(deterministicPlan(`Open ${OPENABLE}`, hbb()).plan.actions[0]).toEqual({ type: "showPathway", stableId: OPENABLE });
  });
});
