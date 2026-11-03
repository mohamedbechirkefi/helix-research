// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Phase 9 (P9.2.4): the planning context of a set without a variant, a structure, a mapping or
 * contacts (FAAH2, the structure-limited gene), and the rule-based planner on it. The HBB context
 * is unchanged by the generalised builder.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildHbbContext, deterministicPlan, proteinWorldReason, trustedContextJson, validatePlan, type PlanningContext } from "../src/index.ts";
import { cftrContext, faah2Bundle, faah2Context, hbbContext, questionsRecord } from "./load.ts";

const HBB_TEXT = /HBB|HbS|2HBS|P68871|h(a)?emoglobin|globin|sickle|rs334|VCV000015333|Glu7Val|Glu6Val/i;
const REASON = "no experimental structure is cross-referenced for this protein";
const built = (c: PlanningContext): PlanningContext => ({ ...c, executableActions: [...c.executableActions, "compareVariants", "highlightSequenceRegion"], routeByCues: true, cueRules: "dh010", answer: "first", currentWorld: "dna" });

describe("FAAH2 context: no variant, no experimental structure, Protein World unavailable with the capability reason", () => {
  const ctx = faah2Context();
  it("carries the gene, transcript, protein and the predicted model only", () => {
    expect(ctx.contextId).toBe("curated-faah2");
    expect(ctx.genes.map((g) => [g.symbol, g.id, g.hgncId])).toEqual([["FAAH2", "ENSG00000165591", "HGNC:26440"]]);
    expect(ctx.transcripts[0]).toMatchObject({ versioned: "ENST00000374900.5", label: "MANE Select ENST00000374900.5 (NM_174912.4)" });
    expect(ctx.proteins).toEqual([{ id: "Q6GMR7", geneId: "ENSG00000165591", name: "FAAH2_HUMAN", length: 532 }]);
    expect(ctx.variants).toEqual([]);
    expect(ctx.features).toEqual([]);
    expect(ctx.structures.map((s) => [s.id, s.origin, s.variantPlacement])).toEqual([["AF-Q6GMR7-F1", "predicted", false]]);
    expect(ctx.evidence.map((e) => e.id).sort()).toEqual(["alphafold:AF-Q6GMR7-F1", "ensembl:ENSG00000165591", "uniprot:Q6GMR7"]);
  });
  it("Protein World is unavailable with the capability file's reason, verbatim", () => {
    expect(ctx.worlds.find((w) => w.id === "protein")).toEqual({ id: "protein", available: false, reason: REASON });
    expect(ctx.worlds.find((w) => w.id === "dna")?.available).toBe(true);
    expect(proteinWorldReason(faah2Bundle())).toEqual({ available: false, reason: REASON });
    expect(proteinWorldReason({ structure: null, mapping: null, capabilities: null })).toEqual({ available: false, reason: "no experimental structure record in this dataset" });
  });
  it("contains no HBB-specific text", () => {
    expect(trustedContextJson(ctx)).not.toMatch(HBB_TEXT);
  });
  it("a bundle without the capability report still builds, with a generic reason", () => {
    const { capabilities: _c, ...rest } = faah2Bundle();
    expect(buildHbbContext(rest).worlds.find((w) => w.id === "protein")?.reason).toBe("no experimental structure record in this dataset");
  });
});

describe("rule-based planner on FAAH2: structure and protein questions are refused with the reason, never a structure", () => {
  const ctx = built(faah2Context());
  const run = (q: string) => {
    const { plan, rule } = deterministicPlan(q, ctx);
    expect(validatePlan(plan, ctx, { query: q }).ok).toBe(true);
    return { plan, rule };
  };
  it("the protein structure question", () => {
    const { plan, rule } = run("Show me the protein structure of FAAH2");
    expect(rule).toBe("structure-unavailable");
    expect(plan.outcome).toBe("unsupported");
    expect(plan.actions).toEqual([]);
    expect(plan.reason).toContain(REASON);
    expect(plan.reason).toContain("AF-Q6GMR7-F1 is listed as a computational prediction and is not loaded");
    expect(plan.reason).not.toMatch(HBB_TEXT);
  });
  it("the HBB reference question, a Protein World request and the predicted model", () => {
    for (const q of ["Show me where the sickle-cell mutation affects hemoglobin.", "Open Protein World", "Show the AlphaFold model", "Show me the 3D model of this protein"]) {
      const { plan } = run(q);
      expect(plan.outcome, q).not.toBe("plan");
      expect(plan.actions, q).toEqual([]);
    }
    expect(run("Show me the protein structure of FAAH2").plan.reason).toMatch(/No experimental structure can be shown for FAAH2/);
  });
  it("a DNA question keeps its answer where the data exist", () => {
    const { plan } = run("Show me the FAAH2 gene");
    expect(plan.outcome).toBe("plan");
    expect(plan.actions.map((a) => a.type)).toEqual(["resolveGene", "enterWorld"]);
  });
});

describe("HBB is unchanged by the generalised builder", () => {
  it("builds the context the Phase 8 builder built (pinned in fixtures/hbb-context-phase8.json on 2026-11-03), field for field", () => {
    const pinned = JSON.parse(readFileSync(join(import.meta.dirname, "fixtures", "hbb-context-phase8.json"), "utf8")) as PlanningContext;
    expect(hbbContext()).toEqual(pinned);
    expect(hbbContext().worlds.find((w) => w.id === "protein")).toEqual({ id: "protein", available: true, reason: "experimental structure with a verified residue mapping" });
  });
});

describe("CFTR context (P9.2.1): the F508del deletion carries the record's names, its feature on 5UAK and no HBB text", () => {
  const ctx = cftrContext();
  it("the variant entry is record-driven: short name, computed protein change, identifiers, the numbering label and the ClinVar line", () => {
    expect(ctx.variants).toHaveLength(1);
    const v = ctx.variants[0]!;
    expect(v.id).toBe("NC_000007.14:g.117559592_117559594del");
    expect(v.label).toBe("F508del (p.Phe508del)");
    expect(v.featureId).toBe("F508del_deletion");
    expect(v.names).toEqual(["F508del", "p.Phe508del", "rs113993960", "ENST00000003084.11:c.1521_1523del", "NM_000492.4:c.1521_1523del", "ENSP00000003084.6:p.Phe508del", "NP_000483.3:p.Phe508del", "p.Phe508del (translated numbering, Met = 1)", "ClinVar VCV000007105: Pathogenic (practice guideline)"]);
    expect(v.names.join(" ")).not.toMatch(/sickle|allele/);
  });
  it("the residue feature is the mapped residue the deletion removes (5UAK chain A, PHE 508); the contact feature is on the same chain", () => {
    const f = ctx.features.find((x) => x.id === "F508del_deletion")!;
    expect(f).toMatchObject({ kind: "residue", structureId: "5UAK", chains: ["A"], authSeqId: 508, proteinId: "P13569", evidenceIds: ["clinvar:VCV000007105", "uniprot:VAR_000171", "sifts:5UAK-P13569"] });
    expect(f.label).toBe("F508del (p.Phe508del): p.Phe508del (translated numbering, Met = 1); in 5UAK chain A residue 508 is PHE, the residue the deletion removes");
    const c = ctx.features.find((x) => x.kind === "contact")!;
    expect(c.id).toBe("F508del_contact_A508_A");
    expect(c.label).toMatch(/^PHE A508 contacts MET A498, GLU A504, ASN A505, ARG A560, PHE A1068, ARG A1070, PHE A1074 within 4.5 A/);
    expect(ctx.structures.find((s) => s.id === "5UAK")).toMatchObject({ origin: "experimental", variantPlacement: true });
    expect(ctx.structures.find((s) => s.id === "5UAK")?.assemblies[0]).toEqual({ id: "model", label: "asymmetric unit (all polymer chains)", chains: ["A", "R"] });
    expect(ctx.worlds.find((w) => w.id === "protein")).toEqual({ id: "protein", available: true, reason: "experimental structure with a verified residue mapping" });
  });
  it("contains no HBB text (and no tetramer wording: 5UAK deposits one assembly of two chains)", () => {
    expect(trustedContextJson(ctx)).not.toMatch(HBB_TEXT);
    expect(trustedContextJson(ctx)).not.toMatch(/tetramer/);
  });
});

describe("rule-based planner on CFTR: the set's curated questions and its bridge question are answered", () => {
  const ctx = built(cftrContext());
  const record = questionsRecord("cftr");
  const run = (q: string) => {
    const { plan, rule } = deterministicPlan(q, ctx);
    expect(validatePlan(plan, ctx, { query: q }).ok, q).toBe(true);
    return { plan, rule };
  };
  it("the four questions of questions.json plan the expected actions", () => {
    const [locate, dna, contact, evidence] = record.questions.map((x) => run(x.text));
    expect(locate!.rule).toBe("variant-locate");
    expect(locate!.plan.actions.map((a) => a.type)).toEqual(["resolveVariant", "loadStructure", "focusCamera", "highlightResidue", "revealEvidence"]);
    expect(locate!.plan.actions.find((a) => a.type === "loadStructure")).toMatchObject({ structureId: "5UAK" });
    expect(locate!.plan.followUps).toEqual(["How does the DNA change at this codon?", "What does this residue touch in the structure?"]);
    expect(dna!.rule).toBe("variant-sequence");
    expect(dna!.plan.actions.map((a) => a.type)).toEqual(["enterWorld", "highlightSequenceRegion", "compareVariants", "revealEvidence"]);
    expect(contact!.rule).toBe("contact");
    expect(contact!.plan.actions.find((a) => a.type === "highlightResidue")).toMatchObject({ target: { kind: "feature", featureId: "F508del_contact_A508_A" } });
    expect(evidence!.rule).toBe("variant-evidence");
    expect(evidence!.plan.actions.map((a) => a.type)).toEqual(["revealEvidence", "revealEvidence"]);
  });
  it("the bridge question locates the deleted residue on 5UAK", () => {
    const { plan, rule } = run(record.bridgeQuestion!);
    expect(rule).toBe("variant-locate");
    expect(plan.actions.find((a) => a.type === "highlightResidue")).toMatchObject({ target: { kind: "feature", featureId: "F508del_deletion" } });
  });
  it("F508del is not a foreign variant on the CFTR set; it still is on HBB, with the HBB wording unchanged", () => {
    expect(run("Show me F508del on the protein.").rule).toBe("variant-locate");
    const hbb = built(hbbContext());
    const { plan, rule } = deterministicPlan("Show me F508del", hbb);
    expect(rule).toBe("foreign-variant");
    expect(plan.reason).toBe("Only the HbS variant is in the curated records; other variants are not available.");
    expect(deterministicPlan("Where does CFTR F508del occur?", hbb).rule).toBe("foreign-gene");
    expect(deterministicPlan("Show me where the sickle-cell mutation affects hemoglobin.", hbb).plan.followUps).toEqual(["How does the DNA change at this codon?", "What does this residue touch in the crystal?"]);
  });
});
