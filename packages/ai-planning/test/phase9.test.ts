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
import { faah2Bundle, faah2Context, hbbContext } from "./load.ts";

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
