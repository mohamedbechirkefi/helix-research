// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Author decision D-H024 answer 71 (2026-11-04), characterised before the change: the pathway record keeps
 * participants only for the opening rule's candidates (participantsByPathway), and the app can open only
 * those memberships. Today the validator accepts showPathway on any membership the record lists, and the
 * rule-based planner plans it for a named membership whose participants are not kept; the app then throws
 * at execution ("listed in the record, but its participants are not kept"). These pins record that
 * behaviour; the change that follows replaces them.
 */
import { describe, expect, it } from "vitest";
import { buildHbbContext, deterministicPlan, validatePlan, withExplorerRecords, type Plan, type PlanningContext } from "../src/index.ts";
import { hbbBundleWithPathways, pathwaysRecord } from "./load.ts";

const PHASE6 = ["resolveGene", "resolveVariant", "loadStructure", "enterWorld", "focusCamera", "highlightResidue", "revealEvidence", "cancelActions", "compareVariants", "highlightSequenceRegion"];
const PHASE10 = ["selectTranscript", "showProteinDomains", "showPathway", "setRepresentation", "beginTransition", "returnToOverview"];
const b = hbbBundleWithPathways();
const hbb = (): PlanningContext => ({ ...withExplorerRecords(buildHbbContext(b), b), executableActions: [...PHASE6, ...PHASE10], routeByCues: true, cueRules: "dh010", answer: "follow-up", currentWorld: "dna" });
const plan = (actions: Plan["actions"]): Plan => ({ outcome: "plan", intent: "other", entities: { geneId: null, proteinId: null, variantId: null, structureId: null }, actions, explanationLevel: "intermediate", citations: [], followUps: [], reason: null });
const NOT_OPENABLE = "R-HSA-2168880";

describe("D-H024 (71), before the change", () => {
  it("the record keeps no participants for Scavenging of heme from plasma, yet the context lists it", () => {
    const rec = pathwaysRecord("hbb") as { participantsByPathway: { stableId: string }[] };
    expect(rec.participantsByPathway.some((p) => p.stableId === NOT_OPENABLE)).toBe(false);
    expect(hbb().pathways!.some((p) => p.stableId === NOT_OPENABLE)).toBe(true);
  });
  it("the validator accepts showPathway on it", () => {
    expect(validatePlan(plan([{ type: "showPathway", stableId: NOT_OPENABLE }]), hbb()).issues).toEqual([]);
  });
  it("the rule-based planner plans showPathway for it by name and by stable id", () => {
    const r = deterministicPlan("Show the scavenging of heme from plasma pathway", hbb());
    expect(r.rule).toBe("pathway-named");
    expect(r.plan.actions[0]).toEqual({ type: "showPathway", stableId: NOT_OPENABLE });
    expect(deterministicPlan(`Open ${NOT_OPENABLE}`, hbb()).plan.actions[0]).toEqual({ type: "showPathway", stableId: NOT_OPENABLE });
  });
});
