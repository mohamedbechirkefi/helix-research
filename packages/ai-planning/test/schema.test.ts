// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
import { describe, expect, it } from "vitest";
import { Plan, planJsonSchema, groundedPlanJsonSchema, validatePlan, withSession, extractIdTokens, contextIdLists, type Plan as PlanT } from "../src/index.ts";
import { hbbContext } from "./load.ts";

const ctx = hbbContext();
const good: PlanT = {
  outcome: "plan",
  intent: "locate_variant",
  entities: { geneId: "ENSG00000244734", proteinId: "P68871", variantId: "NC_000011.10:g.5227002T>A", structureId: "2HBS" },
  actions: [
    { type: "loadStructure", structureId: "2HBS", assembly: "model" },
    { type: "focusCamera", target: { kind: "feature", featureId: "HbS_substitution" } },
    { type: "highlightResidue", target: { kind: "feature", featureId: "HbS_substitution" } },
    { type: "revealEvidence", evidenceId: "clinvar:VCV000015333" },
  ],
  explanationLevel: "intermediate",
  citations: ["clinvar:VCV000015333", "uniprot:VAR_002863"],
  followUps: ["Why is this residue important?"],
  reason: null,
};
const codes = (raw: unknown, c = ctx, query?: string) => validatePlan(raw, c, query ? { query } : {}).issues.map((i) => i.code);

describe("planning context from the curated HBB records", () => {
  it("holds only the curated identifiers", () => {
    expect(ctx.genes.map((g) => g.id)).toEqual(["ENSG00000244734"]);
    expect(ctx.proteins.map((p) => p.id)).toEqual(["P68871"]);
    expect(ctx.variants.map((v) => v.id)).toEqual(["NC_000011.10:g.5227002T>A"]);
    expect(ctx.structures.map((s) => s.id)).toEqual(["2HBS", "AF-P68871-F1"]);
    expect(ctx.structures.find((s) => s.id === "AF-P68871-F1")!.variantPlacement).toBe(false);
  });
  it("derives the HbS feature and the H6-B contact with their assemblies", () => {
    const hbs = ctx.features.find((f) => f.id === "HbS_substitution")!;
    expect(hbs.chains).toEqual(["B", "D", "F", "H"]);
    expect(hbs.authSeqId).toBe(6);
    const contact = ctx.features.find((f) => f.kind === "contact")!;
    expect(contact.id).toBe("HbS_contact_H6_B");
    // Assembly 1 holds chains A-D only, so the contact exists only in the asymmetric unit.
    expect(contact.assemblies).toEqual(["model"]);
  });
  it("lists evidence ids including ClinVar and the UniProt variant", () => {
    const ids = ctx.evidence.map((e) => e.id);
    expect(ids).toContain("clinvar:VCV000015333");
    expect(ids).toContain("uniprot:VAR_002863");
    expect(ids).toContain("pdb:2HBS");
  });
});

describe("plan schema (strict)", () => {
  it("accepts a well-formed plan", () => {
    expect(Plan.safeParse(good).success).toBe(true);
    expect(validatePlan(good, ctx).ok).toBe(true);
  });
  it("rejects unknown fields at every level", () => {
    expect(Plan.safeParse({ ...good, script: "alert(1)" }).success).toBe(false);
    expect(Plan.safeParse({ ...good, entities: { ...good.entities, chain: "H" } }).success).toBe(false);
    expect(Plan.safeParse({ ...good, actions: [{ type: "loadStructure", structureId: "2HBS", assembly: "model", url: "x" }] }).success).toBe(false);
    expect(Plan.safeParse({ ...good, actions: [{ type: "focusCamera", target: { kind: "feature", featureId: "HbS_substitution", mesh: 3 } }] }).success).toBe(false);
  });
  it("rejects unknown actions and missing fields", () => {
    expect(Plan.safeParse({ ...good, actions: [{ type: "runScript", code: "x" }] }).success).toBe(false);
    expect(Plan.safeParse({ ...good, actions: [{ type: "loadStructure", structureId: "2HBS" }] }).success).toBe(false);
    const { reason: _r, ...noReason } = good;
    expect(Plan.safeParse(noReason).success).toBe(false);
    expect(codes("{not json")).toEqual(["invalid-json"]);
  });
  it("produces JSON Schemas for constrained decoding", () => {
    const s = planJsonSchema();
    expect(s.additionalProperties).toBe(false);
    expect(JSON.stringify(s)).toContain("highlightResidue");
    const g = JSON.stringify(groundedPlanJsonSchema(contextIdLists(ctx)));
    expect(g).toContain("HbS_contact_H6_B");
    expect(g).not.toContain("showProteinDomains");
  });
});

describe("plan validation: groundedness and capabilities", () => {
  it("rejects a structure outside the context (the 1BZO case)", () => {
    const bad = { ...good, actions: [{ type: "loadStructure", structureId: "1BZO", assembly: "1" }, ...good.actions.slice(1)] };
    const v = validatePlan(bad, ctx);
    expect(v.schemaValid).toBe(true);
    expect(v.ok).toBe(false);
    expect(v.groundedness.map((i) => i.value)).toContain("1BZO");
  });
  it("rejects unknown entity, feature, evidence and citation ids", () => {
    expect(codes({ ...good, entities: { ...good.entities, geneId: "ENSG00000001626" } })).toContain("ungrounded-id");
    expect(codes({ ...good, actions: [good.actions[0], { type: "highlightResidue", target: { kind: "feature", featureId: "F508del" } }] })).toContain("ungrounded-id");
    expect(codes({ ...good, actions: [{ type: "revealEvidence", evidenceId: "pmid:99999999" }] })).toContain("ungrounded-id");
    expect(codes({ ...good, citations: ["PMID:123456"] })).toContain("ungrounded-id");
    expect(codes({ ...good, actions: [{ type: "loadStructure", structureId: "2HBS", assembly: "3" }] })).toContain("ungrounded-id");
  });
  it("flags identifiers in free text unless the context or the user's query has them", () => {
    expect(codes({ ...good, reason: "See PDB 4HHB and PMID 99999999." })).toEqual(["ungrounded-text-id", "ungrounded-text-id"]);
    expect(codes({ ...good, reason: "2HBS chain H, ENSG00000244734, rs334." })).toEqual([]);
    const refusal = { ...good, outcome: "unsupported", actions: [], reason: "1BZO is not in the curated records." };
    expect(codes(refusal)).toEqual(["ungrounded-text-id"]);
    expect(codes(refusal, ctx, "Load PDB entry 1BZO.")).toEqual([]);
  });
  it("finds identifier tokens", () => {
    expect(extractIdTokens("load 1BZO or 4hhb, not the 2nd one").map((t) => t.token)).toEqual(["1BZO", "4hhb"]);
    expect(extractIdTokens("CFTR is ENSG00000001626, PMID: 12345678").map((t) => t.kind)).toEqual(["ensembl", "pmid"]);
  });
  it("rejects schema-only actions as not executable", () => {
    expect(codes({ ...good, actions: [{ type: "showProteinDomains", proteinId: "P68871" }] })).toEqual(["not-executable"]);
    expect(codes({ ...good, actions: [{ type: "compareVariants", variantIds: ["NC_000011.10:g.5227002T>A", "NC_000011.10:g.5227002T>A"] }] })).toEqual(["not-executable"]);
  });
  it("requires the structure to be loaded before a feature is targeted", () => {
    expect(codes({ ...good, actions: [good.actions[2]] })).toContain("prerequisite");
  });
  it("refuses to place the variant on the predicted model", () => {
    const p = { ...good, actions: [{ type: "loadStructure", structureId: "AF-P68871-F1", assembly: "model" }, good.actions[2]] };
    expect(codes(p)).toContain("variant-on-predicted-model");
  });
  it("rejects the H6-B contact in assembly 1, which lacks chain H", () => {
    const t = { kind: "feature", featureId: "HbS_contact_H6_B" };
    expect(codes({ ...good, actions: [{ type: "loadStructure", structureId: "2HBS", assembly: "1" }, { type: "highlightResidue", target: t }] })).toContain("prerequisite");
    expect(codes({ ...good, actions: [{ type: "loadStructure", structureId: "2HBS", assembly: "model" }, { type: "highlightResidue", target: t }] })).toEqual([]);
  });
  it("needs a selection for selection targets and an available world", () => {
    const sel = { ...good, actions: [{ type: "highlightResidue", target: { kind: "selection" } }] };
    expect(codes(sel)).toContain("prerequisite");
    const withSel = withSession(ctx, { selection: { structureId: "2HBS", chainId: "H", residueNumber: 6, numbering: "auth", compId: "VAL", featureId: "HbS_substitution" } });
    expect(codes(sel, withSel)).toEqual([]);
    expect(codes({ ...good, actions: [{ type: "enterWorld", world: "pathway" }] })).toContain("world-unavailable");
  });
  it("checks outcome consistency", () => {
    expect(codes({ ...good, outcome: "unsupported", reason: null })).toEqual(expect.arrayContaining(["consistency"]));
    expect(codes({ ...good, actions: [] })).toContain("consistency");
    expect(codes({ ...good, outcome: "clarify", actions: [], reason: "Which chain?" })).toEqual([]);
  });
});
