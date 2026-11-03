// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Phase 9 (P9.1.2, plan section 12 rule 6): the planning context's pathway entries and Pathway
 * World availability, the rule-based planner's answer to a pathway question, and the validator's
 * world-cue check in the presence of a Pathway World answer. The HBB Phase 8 fixture is untouched:
 * a bundle without the record has no `pathways` field and the Phase 3 to 8 world wording.
 */
import { describe, expect, it } from "vitest";
import { asksPathway, buildHbbContext, deterministicPlan, pathwayContext, pathwayEvidenceId, pathwayWorldReason, planWorlds, screenFollowUp, trustedContextJson, validatePlan, type PlanningContext } from "../src/index.ts";
import { capabilitiesRecord, cftrBundle, faah2Bundle, hbbBundleWithPathways, hbbContext, pathwaysRecord, questionsRecord } from "./load.ts";

const HBB_TEXT = /HBB|HbS|2HBS|P68871|h(a)?emoglobin|globin|sickle|rs334|VCV000015333|Glu7Val|Glu6Val/i;
const built = (c: PlanningContext, currentWorld: "dna" | "protein" = "dna"): PlanningContext => ({ ...c, executableActions: [...c.executableActions, "compareVariants", "highlightSequenceRegion"], routeByCues: true, cueRules: "dh010", answer: "first", currentWorld });

type Cap = { pathwayView: { available: boolean; reason: string } };
type Rec = { membershipCount: number; memberships: { stableId: string; name: string; isOpening: boolean; isDisease: boolean; topLevelPathways: { name: string }[] }[]; openingPathway: { stableId: string; name: string } | null; evidence: { category: number; statement: string }[] };

describe("the context's pathway entries, from the pathway-memberships record", () => {
  const ctx = buildHbbContext(hbbBundleWithPathways());
  const rec = pathwaysRecord("hbb") as Rec;
  it("one entry per membership, in the record's order (by stable id), with the top-level pathway, the opening flag and a one-line membership sentence", () => {
    expect(ctx.pathways).toHaveLength(rec.membershipCount);
    expect(ctx.pathways!.map((p) => p.stableId)).toEqual(rec.memberships.map((m) => m.stableId));
    const opening = ctx.pathways!.filter((p) => p.isOpening);
    expect(opening.map((p) => p.stableId)).toEqual([rec.openingPathway!.stableId]);
    expect(opening[0]!.name).toBe(rec.openingPathway!.name);
    expect(opening[0]!.topLevelPathway).toBe(rec.memberships.find((m) => m.isOpening)!.topLevelPathways[0]!.name);
    expect(opening[0]!.membership).toBe(`${rec.openingPathway!.name} (${rec.openingPathway!.stableId}, under Autophagy) lists P68871 in Reactome 98: database annotation, class 2, membership only; the membership Pathway World opens on, by rule (fewest participants among non-disease pathways with a diagram).`);
    const disease = ctx.pathways!.find((p) => p.isDisease)!;
    expect(disease.membership).toMatch(/membership only; a disease pathway\.$/);
    for (const p of ctx.pathways!) expect(p.membership).toMatch(/database annotation, class 2, membership only/);
    expect(JSON.stringify(ctx.pathways)).not.toMatch(/primary|important|mechanism/i);
  });
  it("the record's evidence joins the context under reactome:<accession>, statement verbatim", () => {
    const e = ctx.evidence.find((x) => x.id === pathwayEvidenceId("P68871"))!;
    expect(e).toEqual({ id: "reactome:P68871", category: 2, statement: rec.evidence[0]!.statement });
    expect(e.statement).toContain("R-HSA-9615710");
  });
  it("Pathway World is available with the capability report's reason; every other field of the context is the Phase 8 one", () => {
    const cap = capabilitiesRecord("hbb") as Cap;
    expect(ctx.worlds.find((w) => w.id === "pathway")).toEqual({ id: "pathway", available: true, reason: cap.pathwayView.reason });
    const { pathways: _p, evidence, worlds, ...rest } = ctx;
    const { pathways: _q, evidence: evidence8, worlds: worlds8, ...rest8 } = hbbContext();
    expect(rest).toEqual(rest8);
    expect(evidence.filter((e) => !e.id.startsWith("reactome:"))).toEqual(evidence8);
    expect(worlds.filter((w) => w.id !== "pathway")).toEqual(worlds8.filter((w) => w.id !== "pathway"));
  });
  it("pathwayContext alone gives the same entries (the app calls it when the record arrives)", () => {
    const x = pathwayContext(pathwaysRecord("hbb"));
    expect(x.accession).toBe("P68871");
    expect(x.pathways).toEqual(ctx.pathways);
    expect(x.evidence).toEqual([ctx.evidence.find((e) => e.id === "reactome:P68871")]);
  });
});

describe("Pathway World availability without the record", () => {
  it("a bundle without the record and without a capability report keeps the Phase 3 to 8 wording and no pathways field (the HBB fixture)", () => {
    const ctx = hbbContext();
    expect("pathways" in ctx).toBe(false);
    expect(ctx.worlds.find((w) => w.id === "pathway")).toEqual({ id: "pathway", available: false, reason: "no curated pathway records in this context" });
    expect(pathwayWorldReason({ capabilities: null, pathways: null })).toEqual({ available: false, reason: "no curated pathway records in this context" });
  });
  it("a bundle with the capability report only (the app at start) takes the report's availability and reason", () => {
    for (const set of ["hbb", "cftr", "faah2"]) {
      const cap = capabilitiesRecord(set) as Cap;
      expect(pathwayWorldReason({ capabilities: cap, pathways: null }), set).toEqual({ available: cap.pathwayView.available, reason: cap.pathwayView.reason });
    }
    const faah2 = buildHbbContext(faah2Bundle());
    expect(faah2.worlds.find((w) => w.id === "pathway")).toEqual({ id: "pathway", available: true, reason: (capabilitiesRecord("faah2") as Cap).pathwayView.reason });
    expect("pathways" in faah2).toBe(false);
  });
  it("a report that says the world is unavailable keeps its reason; a record with no opening pathway is unavailable", () => {
    expect(pathwayWorldReason({ capabilities: { experimentalStructure: { available: false, reason: "x" }, pathwayView: { available: false, reason: "no Reactome pathway lists this protein" } }, pathways: null })).toEqual({ available: false, reason: "no Reactome pathway lists this protein" });
    const empty = { ...(pathwaysRecord("faah2") as Rec), memberships: [], membershipCount: 0, openingPathway: null };
    expect(pathwayWorldReason({ capabilities: null, pathways: empty })).toEqual({ available: false, reason: "no Reactome pathway lists this protein" });
  });
});

describe("the rule-based planner on a pathway question", () => {
  it("HBB: opens Pathway World and cites the record's evidence; the plan validates as a first answer in either world (the molecule name is not a cue against Pathway World)", () => {
    const q = (questionsRecord("hbb").questions.find((x) => x.requires.includes("pathwayView")) ?? { text: "Which pathways list HBB?" }).text;
    for (const world of ["dna", "protein"] as const) {
      const ctx = built(buildHbbContext(hbbBundleWithPathways()), world);
      const { plan, rule } = deterministicPlan(q, ctx);
      expect(rule).toBe("pathway-world");
      expect(plan.outcome).toBe("plan");
      expect(plan.actions).toEqual([{ type: "enterWorld", world: "pathway" }, { type: "revealEvidence", evidenceId: "reactome:P68871" }]);
      expect(plan.citations).toEqual(["reactome:P68871"]);
      expect(plan.entities).toEqual({ geneId: "ENSG00000244734", proteinId: "P68871", variantId: null, structureId: null });
      expect(planWorlds(plan)).toEqual(["pathway"]);
      const v = validatePlan(plan, ctx, { query: q });
      expect(v.ok, JSON.stringify(v.issues)).toBe(true);
    }
  });
  it("CFTR and FAAH2: the same plan on their own records; no HBB text", () => {
    for (const [set, bundle] of [["cftr", cftrBundle()], ["faah2", faah2Bundle()]] as const) {
      const ctx = built(buildHbbContext({ ...bundle, pathways: pathwaysRecord(set) }));
      const q = questionsRecord(set).questions.find((x) => x.requires.includes("pathwayView"))!.text;
      const { plan, rule } = deterministicPlan(q, ctx);
      expect(rule, set).toBe("pathway-world");
      expect(plan.actions.map((a) => a.type), set).toEqual(["enterWorld", "revealEvidence"]);
      expect(validatePlan(plan, ctx, { query: q }).ok, set).toBe(true);
      expect(trustedContextJson(ctx)).not.toMatch(HBB_TEXT);
    }
  });
  it("with the world available but the record not yet loaded, the plan enters the world without a citation; without the world, the Phase 3 refusal", () => {
    const ctx = built(buildHbbContext({ ...hbbBundleWithPathways(), pathways: null }));
    const { plan, rule } = deterministicPlan("Which pathways list HBB?", ctx);
    expect(rule).toBe("pathway-world");
    expect(plan.actions).toEqual([{ type: "enterWorld", world: "pathway" }]);
    expect(plan.citations).toEqual([]);
    const none = deterministicPlan("Which pathways list HBB?", built(hbbContext()));
    expect(none.rule).toBe("pathway");
    expect(none.plan).toMatchObject({ outcome: "unsupported", reason: "No curated pathway records are available in this context." });
  });
  it("asksPathway reads the rule's word list", () => {
    expect(asksPathway("Which pathways list HBB?")).toBe(true);
    expect(asksPathway("Quelle voie métabolique ?")).toBe(true);
    expect(asksPathway("Show me the protein")).toBe(false);
  });
  it("the world-cue check still rejects a DNA answer to a protein question and a protein answer to a DNA question", () => {
    const ctx = built(buildHbbContext(hbbBundleWithPathways()));
    const dnaPlan = { outcome: "plan", intent: "other", entities: { geneId: null, proteinId: null, variantId: null, structureId: null }, actions: [{ type: "enterWorld", world: "dna" }], explanationLevel: "intermediate", citations: [], followUps: [], reason: null };
    expect(validatePlan(dnaPlan, ctx, { query: "Show the protein structure" }).issues.map((i) => i.code)).toContain("world-cue");
    const pathwayPlan = { ...dnaPlan, actions: [{ type: "enterWorld", world: "pathway" }] };
    expect(validatePlan(pathwayPlan, ctx, { query: "Show the protein structure" }).issues.map((i) => i.code)).not.toContain("world-cue");
  });
});

describe("the follow-up filter (D-H007) and the pathway question", () => {
  it("keeps the set's pathway question when the context has Pathway World (capability rule pathway-world); drops it as out of scope without the world, as before", () => {
    const q = questionsRecord("hbb").questions.find((x) => x.requires.includes("pathwayView"))!.text;
    const withWorld = built(buildHbbContext(hbbBundleWithPathways()));
    expect(screenFollowUp(q, withWorld)).toMatchObject({ kept: true, detail: "pathway-world" });
    expect(screenFollowUp("Which pathways involve beta-globin?", withWorld)).toMatchObject({ kept: true, detail: "pathway-world" });
    expect(screenFollowUp("What is the function of HBB in these pathways?", withWorld)).toMatchObject({ kept: false, reason: "scope", detail: "function" });
    expect(screenFollowUp(q, built(hbbContext()))).toMatchObject({ kept: false, reason: "scope", detail: "pathways" });
  });
});
