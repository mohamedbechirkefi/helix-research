// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Author decision D-H051 question 104 (a) (2026-11-14), finding P11-U-15 of the Phase 11 usability inspection: a pathway
 * named with no matching membership was refused with the record's Reactome stable ids alone whenever the list with
 * names passed the plan's 400-character reason ("R-HSA-983231, R-HSA-1237044, ..." on HBB), ids a visitor cannot
 * recognise. Rules version 8 names the pathways: every name when the names fit, else as many whole names as fit, in
 * the record's order, then how many more and where they are all listed. A short list keeps its earlier form (names with
 * their ids). Pinned before the change (the naming tests fail on rules version 7).
 */
import { describe, expect, it } from "vitest";
import { PHASE10_ACTIONS, buildHbbContext, deterministicPlan, validatePlan, withExplorerRecords, type ContextPathway, type PlanningContext } from "../src/index.ts";
import { hbbBundleWithPathways } from "./load.ts";

const PHASE6 = ["resolveGene", "resolveVariant", "loadStructure", "enterWorld", "focusCamera", "highlightResidue", "revealEvidence", "cancelActions", "compareVariants", "highlightSequenceRegion"];
const hbbB = hbbBundleWithPathways();
// The app's build, as phase10.test.ts sets it up (registry v3, D-H010 cues, the explorer records).
const hbb = (extra: Partial<PlanningContext> = {}): PlanningContext => ({ ...withExplorerRecords(buildHbbContext(hbbB), hbbB), executableActions: [...PHASE6, ...PHASE10_ACTIONS], routeByCues: true, cueRules: "dh010", answer: "follow-up", currentWorld: "dna", ...extra });
const run = (q: string, ctx: PlanningContext) => {
  const { plan, rule } = deterministicPlan(q, ctx);
  const v = validatePlan(plan, ctx, { query: q });
  if (!v.ok) throw new Error(`invalid plan: ${JSON.stringify(v)}`);
  return { plan, rule };
};
const membership = (name: string, i: number): ContextPathway => ({ ...hbb().pathways![0]!, stableId: `R-HSA-90000${i}`, name, isOpening: false });

describe("P11-U-15: a pathway with no matching membership is refused with the pathways' names (rules version 8)", () => {
  it("HBB: the names that fit, then how many more and where", () => {
    const { rule, plan } = run("Show the glycolysis pathway", hbb());
    expect(rule).toBe("pathway-no-membership");
    expect(plan.reason).toBe(
      'No Reactome membership of P68871 matches "glycolysis"; the record lists 10 memberships, among them Factors involved in megakaryocyte development and platelet production; Erythrocytes take up carbon dioxide and release oxygen; Erythrocytes take up oxygen and release carbon dioxide; Scavenging of heme from plasma; Neutrophil degranulation; and 5 more, listed in Pathway World.',
    );
    expect(plan.reason).not.toMatch(/R-HSA-/);
  });
  it("every name, without ids, when the names fit and the names with ids do not", () => {
    const names = ["Transport of bile salts and organic acids, metal ions and amine compounds across the membrane", "Na+/Cl- dependent neurotransmitter transporters", "Dopamine clearance from the synaptic cleft", "Reuptake of the neurotransmitter dopamine into the presynaptic neuron"];
    const { plan } = run("Show the glycolysis pathway", hbb({ pathways: names.map(membership) }));
    expect(plan.reason).toBe(`No Reactome membership of P68871 matches "glycolysis"; the record lists 4 memberships: ${names.join("; ")}.`);
  });
  it("a short list keeps its names with their ids", () => {
    const { plan } = run("Show the glycolysis pathway", hbb({ pathways: [membership("Heme signaling", 1)] }));
    expect(plan.reason).toBe('No Reactome membership of P68871 matches "glycolysis"; the record lists Heme signaling (R-HSA-900001).');
  });
  it("within the plan's 400 characters, with whole names only, for a long record", () => {
    const names = Array.from({ length: 30 }, (_, i) => `Pathway number ${i + 1} with a fairly long descriptive name for the test`);
    const { plan } = run("Show the glycolysis pathway", hbb({ pathways: names.map(membership) }));
    expect(plan.reason!.length).toBeLessThanOrEqual(400);
    const listed = plan.reason!.replace(/^.*among them /, "").replace(/; and \d+ more, listed in Pathway World\.$/, "").split("; ");
    expect(listed.every((n) => names.includes(n))).toBe(true);
    expect(plan.reason).toMatch(new RegExp(`; and ${30 - listed.length} more, listed in Pathway World\\.$`));
  });
});
