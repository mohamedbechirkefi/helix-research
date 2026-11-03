// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Phase 9 (P9.1.3, plan section 14 rule 4): the planning context's association entries from the
 * disease-associations record, the rule-based planner's answer to the set's disease question (a
 * revealEvidence plan, no world switch) and what happens without the record. The HBB Phase 8 fixture
 * is untouched: a bundle without the record has no `associations` field.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { asksAssociation, associationContext, associationEvidenceId, buildHbbContext, deterministicPlan, planWorlds, screenFollowUp, trustedContextJson, validatePlan, type PlanningContext } from "../src/index.ts";
import { REPO_ROOT, brca1Bundle, cftrBundle, faah2Bundle, hbbBundleWithPathways, hbbContext, questionsRecord } from "./load.ts";

const HBB_TEXT = /HBB|HbS|2HBS|P68871|h(a)?emoglobin|globin|sickle|rs334|VCV000015333|Glu7Val|Glu6Val/i;
const built = (c: PlanningContext, currentWorld: "dna" | "protein" = "dna"): PlanningContext => ({ ...c, executableActions: [...c.executableActions, "compareVariants", "highlightSequenceRegion"], routeByCues: true, cueRules: "dh010", answer: "first", currentWorld });

type Rec = { ensemblGeneId: string; approvedSymbol: string; platform: { apiVersion: string; dataVersion: string }; count: number; associations: { diseaseId: string; diseaseName: string; score: number }[]; note: string; evidence: { category: number; statement: string }[] };
const associationsRecord = (set: string): unknown => JSON.parse(readFileSync(join(REPO_ROOT, "data", "curated", set, "associations.json"), "utf8")) as unknown;
const withAssociations = (set: string) => {
  const bundle = set === "hbb" ? hbbBundleWithPathways() : set === "cftr" ? cftrBundle() : set === "faah2" ? faah2Bundle() : brca1Bundle();
  return { ...bundle, associations: associationsRecord(set) };
};

describe("the context's association entries, from the disease-associations record", () => {
  const ctx = buildHbbContext(withAssociations("hbb"));
  const rec = associationsRecord("hbb") as Rec;
  it("one entry per kept association, in the record's order (by score), with the disease id, name and score, and a one-line sentence that carries the never-causal rule", () => {
    expect(ctx.associations).toHaveLength(rec.associations.length);
    expect(ctx.associations!.map((a) => [a.diseaseId, a.name, a.score])).toEqual(rec.associations.map((a) => [a.diseaseId, a.diseaseName, a.score]));
    const top = ctx.associations![0]!;
    expect(top.association).toBe(`${rec.associations[0]!.diseaseName} (${rec.associations[0]!.diseaseId}) is associated with HBB in Open Targets ${rec.platform.apiVersion} (data ${rec.platform.dataVersion}) with score ${rec.associations[0]!.score}: database annotation, class 2; ${rec.note}.`);
    for (const a of ctx.associations!) expect(a.association).toMatch(/database annotation, class 2; association, never causal; a score aggregates evidence, it does not state that the gene causes the disease\.$/);
    expect(JSON.stringify(ctx.associations)).not.toMatch(/\bcauses the\b(?! disease)|diagnos|mechanism/i);
  });
  it("the record's evidence joins the context under opentargets:<gene id>, statement verbatim", () => {
    const e = ctx.evidence.find((x) => x.id === associationEvidenceId("ENSG00000244734"))!;
    expect(e).toEqual({ id: "opentargets:ENSG00000244734", category: 2, statement: rec.evidence[0]!.statement });
  });
  it("every other field of the context is the Phase 8 one; a bundle without the record has no associations field (the pinned HBB fixture)", () => {
    const { associations: _a, evidence, ...rest } = ctx;
    const { associations: _b, evidence: evidence8, ...rest8 } = buildHbbContext(hbbBundleWithPathways());
    expect(rest).toEqual(rest8);
    expect(evidence.filter((e) => !e.id.startsWith("opentargets:"))).toEqual(evidence8);
    expect("associations" in hbbContext()).toBe(false);
    expect("associations" in buildHbbContext(faah2Bundle())).toBe(false);
  });
  it("associationContext alone gives the same entries (the app calls it when the record arrives)", () => {
    const x = associationContext(associationsRecord("hbb"));
    expect(x.ensemblGeneId).toBe("ENSG00000244734");
    expect(x.associations).toEqual(ctx.associations);
    expect(x.evidence).toEqual([ctx.evidence.find((e) => e.id === "opentargets:ENSG00000244734")]);
  });
});

describe("the rule-based planner on the set's disease question", () => {
  it("HBB: reveals the record's evidence and nothing else (no world switch), cites it, validates as a first answer in either world", () => {
    const q = questionsRecord("hbb").questions.find((x) => x.requires.includes("associationView"))!.text;
    expect(q).toBe("What diseases are associated with HBB?");
    for (const world of ["dna", "protein"] as const) {
      const ctx = built(buildHbbContext(withAssociations("hbb")), world);
      const { plan, rule } = deterministicPlan(q, ctx);
      expect(rule).toBe("associations");
      expect(plan.outcome).toBe("plan");
      expect(plan.actions).toEqual([{ type: "revealEvidence", evidenceId: "opentargets:ENSG00000244734" }]);
      expect(plan.citations).toEqual(["opentargets:ENSG00000244734"]);
      expect(plan.entities).toEqual({ geneId: "ENSG00000244734", proteinId: "P68871", variantId: null, structureId: null });
      expect(planWorlds(plan)).toEqual([]);
      const v = validatePlan(plan, ctx, { query: q });
      expect(v.ok, JSON.stringify(v.issues)).toBe(true);
    }
  });
  it("CFTR, FAAH2 and BRCA1: the same plan on their own records; no HBB text", () => {
    for (const set of ["cftr", "faah2", "brca1"]) {
      const ctx = built(buildHbbContext(withAssociations(set)));
      const q = questionsRecord(set).questions.find((x) => x.requires.includes("associationView"))!.text;
      const { plan, rule } = deterministicPlan(q, ctx);
      expect(rule, set).toBe("associations");
      expect(plan.actions.map((a) => a.type), set).toEqual(["revealEvidence"]);
      expect(validatePlan(plan, ctx, { query: q }).ok, set).toBe(true);
      expect(trustedContextJson(ctx), set).not.toMatch(HBB_TEXT);
    }
  });
  it("without the record in the context, a refusal that says so; the word list reads disease questions in English and French", () => {
    const { plan, rule } = deterministicPlan("What diseases are associated with HBB?", built(buildHbbContext(hbbBundleWithPathways())));
    expect(rule).toBe("associations-none");
    expect(plan).toMatchObject({ outcome: "unsupported", reason: "No curated disease-association records are available in this context." });
    expect(asksAssociation("What diseases are associated with HBB?")).toBe(true);
    expect(asksAssociation("Quelles maladies sont liées à ce gène ?")).toBe(true);
    expect(asksAssociation("Which pathways list HBB?")).toBe(false);
    expect(asksAssociation("Show me the protein")).toBe(false);
  });
  it("the follow-up filter (D-H007) drops the disease question as clinical, record or no record: it is asked, never offered as a next question", () => {
    const q = questionsRecord("hbb").questions.find((x) => x.requires.includes("associationView"))!.text;
    expect(screenFollowUp(q, built(buildHbbContext(withAssociations("hbb"))))).toMatchObject({ kept: false, reason: "clinical", detail: "diseases" });
    expect(screenFollowUp(q, built(hbbContext()))).toMatchObject({ kept: false, reason: "clinical" });
  });
});
