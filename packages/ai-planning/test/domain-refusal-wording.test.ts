// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Phase 11 scientific audit finding P11-S-10 (docs/scientific-validation.md section 7.5), author decision D-H039
 * item 4: the domain refusals named UniProt ("The UniProt record of Q6GMR7 (FAAH2) lists no feature of type Domain,
 * Region, Topological domain, Transmembrane or Zinc finger"), while the protein records keep, of those five types,
 * only Domain (data-adapters KEPT_FEATURE_TYPES); UniProt itself lists a Transmembrane feature for FAAH2 and 20 Region
 * features for TP53. The refusals now say what Helix's copy of the record keeps. The records are not changed.
 * Pinned before the change (the wording tests failed on the rules then consumed).
 */
import { describe, expect, it } from "vitest";
import { KEPT_FEATURE_TYPES } from "@helix/data-adapters";
import { DOMAIN_FEATURE_TYPES, PHASE10_ACTIONS, buildHbbContext, deterministicPlan, validatePlan, withExplorerRecords, type Plan, type PlanningContext } from "../src/index.ts";
import { faah2Bundle, hbbBundleWithPathways, pathwaysRecord } from "./load.ts";

const PHASE6 = ["resolveGene", "resolveVariant", "loadStructure", "enterWorld", "focusCamera", "highlightResidue", "revealEvidence", "cancelActions", "compareVariants", "highlightSequenceRegion"];
const app = (base: PlanningContext, b: { gene: unknown; protein: unknown }): PlanningContext => ({
  ...withExplorerRecords(base, b),
  executableActions: [...PHASE6, ...PHASE10_ACTIONS],
  routeByCues: true,
  cueRules: "dh010",
  answer: "follow-up",
  currentWorld: "dna",
});
const hbbB = hbbBundleWithPathways();
const fB = { ...faah2Bundle(), pathways: pathwaysRecord("faah2") };
const hbb = () => app(buildHbbContext(hbbB), hbbB);
const faah2 = () => app(buildHbbContext(fB), fB);
const plan = (actions: Plan["actions"]): Plan => ({ outcome: "plan", intent: "other", entities: { geneId: null, proteinId: null, variantId: null, structureId: null }, actions, explanationLevel: "intermediate", citations: [], followUps: [], reason: null });
const messages = (actions: Plan["actions"], ctx: PlanningContext) => validatePlan(plan(actions), ctx).issues.map((i) => i.message);

describe("P11-S-10: the domain refusals say what Helix's copy of the UniProt record keeps", () => {
  it("of the explorer types, the protein records keep Domain only (the wording below depends on it)", () => {
    expect(DOMAIN_FEATURE_TYPES.filter((t) => KEPT_FEATURE_TYPES.has(t))).toEqual(["Domain"]);
  });
  it("no domain feature: FAAH2", () => {
    const { rule, plan: p } = deterministicPlan("Show the domains", faah2());
    expect(rule).toBe("domains-none");
    expect(p.reason).toBe("Helix's copy of the UniProt record of Q6GMR7 (FAAH2) keeps Domain features only, not Region, Topological domain, Transmembrane or Zinc finger, and it has no Domain feature, so there is no domain to show.");
  });
  it("a type the copy does not keep: HBB asked for transmembrane helices", () => {
    const { rule, plan: p } = deterministicPlan("Show the transmembrane helices", hbb());
    expect(rule).toBe("domains-type-none");
    expect(p.reason).toBe("Helix's copy of the UniProt record of P68871 keeps Domain features only, so it has no feature of type Transmembrane; it has Domain features.");
  });
  it("validation says the same in its two issue messages", () => {
    expect(messages([{ type: "showProteinDomains", proteinAccession: "Q6GMR7" }], faah2())).toEqual(["Helix's copy of the UniProt record of Q6GMR7 keeps Domain features only and has none"]);
    expect(messages([{ type: "showProteinDomains", proteinAccession: "P68871", featureTypes: ["Transmembrane"] }], hbb())).toEqual(["Helix's copy of the UniProt record of P68871 keeps Domain features only, so it has no feature of type Transmembrane (it has Domain)"]);
  });
  it("no refusal says that UniProt lists no feature of a type", () => {
    for (const [q, ctx] of [["Show the domains", faah2()], ["Show the transmembrane helices", hbb()], ["Show the zinc fingers", hbb()]] as const) expect(deterministicPlan(q, ctx).plan.reason ?? "").not.toMatch(/UniProt record of \w+(?: \(\w+\))? lists no feature/);
  });
});
