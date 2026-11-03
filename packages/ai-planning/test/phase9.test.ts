// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Phase 9 (P9.2.4): the planning context of a set without a variant, a structure, a mapping or
 * contacts (FAAH2, the structure-limited gene), and the rule-based planner on it. The HBB context
 * is unchanged by the generalised builder.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COVERAGE_STATED_BELOW, buildHbbContext, coverageEvidenceId, coverageIsStated, deterministicPlan, proteinWorldReason, trustedContextJson, validatePlan, type PlanningContext } from "../src/index.ts";
import { brca1Bundle, brca1Context, cftrContext, faah2Bundle, faah2Context, hbbContext, questionsRecord } from "./load.ts";

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

describe("BRCA1 context (P9.2.2, plan section 13): a domain structure solved by NMR with a partner chain, its coverage stated", () => {
  const ctx = brca1Context();
  const bundle = brca1Bundle();
  const rec = bundle.structure as { entryId: string; method: string; modelCount: number; modelShown: number; coverage: { text: string; fraction: number }; evidence: { category: number; statement: string }[] };
  it("the structure entry names the method, the ensemble and the model shown; no resolution is invented", () => {
    const s = ctx.structures.find((x) => x.id === "1JM7")!;
    expect(s.title).toBe(`Solution structure of the BRCA1/BARD1 RING-domain heterodimer (${rec.method}, ${rec.modelCount} models, model ${rec.modelShown} shown)`);
    expect(s.title.toLowerCase()).toContain("solution nmr, 14 models, model 1 shown");
    expect(s.title).not.toMatch(/\d A\b/);
    expect(s).toMatchObject({ origin: "experimental", variantPlacement: true, proteinIds: ["P38398", "Q99728"] });
  });
  it("the asymmetric unit of the two-chain heterodimer lists both polymer chains and is not called a tetramer", () => {
    expect(s(ctx).assemblies).toEqual([
      { id: "model", label: "asymmetric unit (all polymer chains)", chains: ["A", "B"] },
      { id: "1", label: "biological assembly 1", chains: ["A", "B"] },
    ]);
    expect(trustedContextJson(ctx)).not.toMatch(/tetramer|crystal/i);
  });
  it("the coverage sentence is carried as the record's own evidence entry, with the record's category, because 5.5 % is below the stated threshold", () => {
    expect(coverageIsStated(rec.coverage.fraction)).toBe(true);
    expect(COVERAGE_STATED_BELOW).toBe(0.9);
    const e = ctx.evidence.find((x) => x.id === coverageEvidenceId("1JM7", "P38398"))!;
    const own = rec.evidence.find((x) => x.statement.startsWith(rec.coverage.text))!;
    expect(e).toEqual({ id: "coverage:1JM7-P38398", category: own.category, statement: own.statement });
    expect(e.statement).toContain("1JM7 covers residues 1 to 103 of 1,863 (103 observed positions, 5.5 %; SOLUTION NMR, 14 models, model 1 shown)");
  });
  it("the variant entry carries the record's names only (no Phase 3 descriptive name); the features are on 1JM7 chain A residue 61 and its 7 contacts including the zinc", () => {
    const v = ctx.variants[0]!;
    expect(v.label).toBe("C61G (p.Cys61Gly)");
    expect(v.featureId).toBe("C61G_substitution");
    expect(v.names).toEqual(["C61G", "rs28897672 allele C", "ENST00000357654.9:c.181T>G", "NM_007294.4:c.181T>G", "ENSP00000350283.3:p.Cys61Gly", "NP_009225.1:p.Cys61Gly", "ClinVar VCV000017661: Pathogenic (reviewed by expert panel)"]);
    const f = ctx.features.find((x) => x.id === "C61G_substitution")!;
    expect(f).toMatchObject({ kind: "residue", structureId: "1JM7", chains: ["A"], authSeqId: 61, proteinId: "P38398" });
    expect(f.label).toBe("C61G (p.Cys61Gly): p.Cys61Gly (translated numbering, Met = 1); in 1JM7 chains A residue 61 is CYS");
    const c = ctx.features.find((x) => x.kind === "contact")!;
    expect(c.id).toBe("C61G_contact_A61_A");
    expect(c.label).toMatch(/^CYS A61 contacts CYS A39, HIS A41, LEU A63, CYS A64, ASN A66, ILE A68, ZN A124 within 4.5 A/);
    expect(trustedContextJson(ctx)).not.toMatch(HBB_TEXT);
  });
  it("Protein World and Pathway World are available with the records' reasons", () => {
    expect(ctx.worlds.find((w) => w.id === "protein")).toEqual({ id: "protein", available: true, reason: "experimental structure with a verified residue mapping" });
    expect(ctx.worlds.find((w) => w.id === "pathway")?.available).toBe(true);
  });
  function s(c: PlanningContext) {
    return c.structures.find((x) => x.id === "1JM7")!;
  }
});

describe("coverage evidence by set (P9.2.2): CFTR (77.0 %) carries it, HBB (99.3 %) does not and stays the Phase 8 context", () => {
  it("CFTR's context gains exactly the coverage entry of its structure record", () => {
    const ctx = cftrContext();
    const e = ctx.evidence.find((x) => x.id === coverageEvidenceId("5UAK", "P13569"))!;
    expect(e.statement).toMatch(/^5UAK covers residues 5 to 1436 of 1,480 \(1139 observed positions, 77\.0 %; ELECTRON MICROSCOPY, 3\.87 A\)/);
    expect(ctx.structures.find((x) => x.id === "5UAK")?.title).toMatch(/ \(ELECTRON MICROSCOPY, 3\.87 A\)$/);
  });
  it("HBB's context has no coverage entry and no models clause", () => {
    const ctx = hbbContext();
    expect(ctx.evidence.some((x) => x.id.startsWith("coverage:"))).toBe(false);
    expect(ctx.structures.find((x) => x.id === "2HBS")?.title).toBe("THE HIGH RESOLUTION CRYSTAL STRUCTURE OF DEOXYHEMOGLOBIN S (X-RAY DIFFRACTION, 2.05 A)");
    expect(ctx.variants[0]?.names).toContain("sickle-cell variant");
  });
});

describe("rule-based planner on BRCA1: the five questions of questions.json and the bridge question", () => {
  const ctx = built(brca1Context());
  const record = questionsRecord("brca1");
  const run = (q: string) => {
    const { plan, rule } = deterministicPlan(q, ctx);
    expect(validatePlan(plan, ctx, { query: q }).ok, q).toBe(true);
    return { plan, rule };
  };
  it("locate, DNA, contacts, evidence and pathways plan the expected actions on 1JM7", () => {
    const [locate, dna, contact, evidence, pathway] = record.questions.map((x) => run(x.text));
    expect(locate!.rule).toBe("variant-locate");
    expect(locate!.plan.actions.find((a) => a.type === "loadStructure")).toMatchObject({ structureId: "1JM7" });
    expect(locate!.plan.followUps?.[1]).toBe("What does this residue touch in the structure?");
    expect(dna!.rule).toBe("variant-sequence");
    expect(contact!.rule).toBe("contact");
    expect(contact!.plan.actions.find((a) => a.type === "highlightResidue")).toMatchObject({ target: { kind: "feature", featureId: "C61G_contact_A61_A" } });
    expect(evidence!.rule).toBe("variant-evidence");
    expect(pathway!.plan.actions[0]).toMatchObject({ type: "enterWorld", world: "pathway" });
  });
  it("the bridge question lands on the residue feature", () => {
    const { plan } = run(record.bridgeQuestion!);
    expect(plan.outcome).toBe("plan");
    expect(plan.actions.find((a) => a.type === "loadStructure")).toMatchObject({ structureId: "1JM7" });
  });
});
