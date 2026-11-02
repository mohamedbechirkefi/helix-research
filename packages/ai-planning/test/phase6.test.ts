// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/** Phase 6 additions: compareVariants and highlightSequenceRegion, with the Phase 3 prompt and schema kept byte-identical. */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Plan, RULES_V1, RULES_V2, buildMessages, deterministicPlan, planJsonSchema, schemaFor, validatePlan, withSession, type PlanningContext } from "../src/index.ts";
import { hbbContext } from "./load.ts";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const base = hbbContext();
const v2 = (c: PlanningContext): PlanningContext => ({ ...c, executableActions: [...c.executableActions, "compareVariants", "highlightSequenceRegion"] });
const ctx6 = v2(base);
const VAR = "NC_000011.10:g.5227002T>A";
const H6 = { structureId: "2HBS", chainId: "H", residueNumber: 6, numbering: "auth" as const, compId: "VAL", featureId: "HbS_substitution" };
const noStructure = (c: PlanningContext): PlanningContext => ({
  ...c,
  structures: [],
  features: [],
  evidence: c.evidence.filter((e) => !/^(pdb|sifts|atom_site|contacts|alphafold):/.test(e.id)),
  worlds: c.worlds.map((w) => (w.id === "protein" ? { ...w, available: false, reason: "no experimental structure in this dataset" } : w)),
});

describe("Phase 3 prompt and decoding schema unchanged (benchmark reproducibility)", () => {
  // Hashes recorded on 2026-11-02 before the Phase 6 change, from the Phase 3 code at a9ccede.
  it("RULES_V1 and the default generic schema hash as before", () => {
    expect(sha(RULES_V1)).toBe("b612b2a3ac75197596b9c3ccdaea3b17161783ffd34d967c6791b9e172ae3dca");
    expect(sha(JSON.stringify(planJsonSchema()))).toBe("29ca7da53c52b3c5a8fb6586ed3c8d40fffd3d5a7ed5d449a7a57ca37ac3f54e");
  });
  it("a context without the Phase 6 actions gets the v1 rules and schema", () => {
    expect(buildMessages("q", base)[0]!.content.startsWith(`${RULES_V1}\n\nTRUSTED CONTEXT:`)).toBe(true);
    expect(JSON.stringify(schemaFor({ query: "q", context: base, requestId: "1" }))).not.toContain("highlightSequenceRegion");
  });
  it("a Phase 6 context gets the v2 rules and schema, which differ from v1 only where stated", () => {
    expect(buildMessages("q", ctx6)[0]!.content.startsWith(`${RULES_V2}\n\nTRUSTED CONTEXT:`)).toBe(true);
    expect(RULES_V2).toContain('{"type":"highlightSequenceRegion","target":SEQTARGET}');
    expect(RULES_V2).not.toContain("compareVariants\",\"variantIds\":[ID,ID]} exist but are NOT executable");
    const s = JSON.stringify(schemaFor({ query: "q", context: ctx6, requestId: "1" }));
    expect(s).toContain("highlightSequenceRegion");
    expect(JSON.stringify(schemaFor({ query: "q", context: ctx6, requestId: "1", schemaMode: "grounded" }))).toContain("highlightSequenceRegion");
    // Every v1 line except the replaced one survives in v2.
    const replaced = RULES_V1.split("\n").filter((l) => !RULES_V2.split("\n").includes(l));
    expect(replaced).toHaveLength(1);
    expect(replaced[0]).toMatch(/NOT executable in this build/);
  });
});

describe("validation of the Phase 6 actions", () => {
  const plan = (actions: unknown[]) => ({ outcome: "plan", intent: "compare_variants", entities: { geneId: null, proteinId: null, variantId: VAR, structureId: null }, actions, explanationLevel: "intermediate", citations: [], followUps: [], reason: null });
  const codes = (p: unknown, c: PlanningContext) => validatePlan(p, c).issues.map((i) => i.code);
  it("compareVariants with one variant parses; both are not executable where the build does not list them", () => {
    expect(Plan.safeParse(plan([{ type: "compareVariants", variantIds: [VAR] }])).success).toBe(true);
    expect(codes(plan([{ type: "compareVariants", variantIds: [VAR] }]), base)).toEqual(["not-executable"]);
    expect(codes(plan([{ type: "highlightSequenceRegion", target: { kind: "variant", variantId: VAR } }]), base)).toEqual(["not-executable"]);
    expect(codes(plan([{ type: "highlightSequenceRegion", target: { kind: "variant", variantId: VAR } }, { type: "compareVariants", variantIds: [VAR] }]), ctx6)).toEqual([]);
  });
  it("rejects ungrounded targets, raw positions and a selection that does not exist", () => {
    expect(codes(plan([{ type: "highlightSequenceRegion", target: { kind: "variant", variantId: "NC_000011.10:g.5227002T>G" } }]), ctx6)).toEqual(["ungrounded-id"]);
    expect(codes(plan([{ type: "highlightSequenceRegion", target: { kind: "feature", featureId: "codon_8" } }]), ctx6)).toEqual(["ungrounded-id"]);
    expect(codes(plan([{ type: "highlightSequenceRegion", target: { kind: "cds", start: 19, end: 21 } }]), ctx6)).toEqual(["schema"]);
    expect(codes(plan([{ type: "highlightSequenceRegion", target: { kind: "selection" } }]), ctx6)).toEqual(["prerequisite"]);
    expect(codes(plan([{ type: "highlightSequenceRegion", target: { kind: "selection" } }]), withSession(ctx6, { sequenceSelection: { transcriptId: "ENST00000335295.4", codon: 8 } }))).toEqual([]);
  });
});

describe("deterministic fallback, Phase 6 rules (gated on the build)", () => {
  const types = (p: { actions: { type: string }[] }) => p.actions.map((a) => a.type);
  it("compares the variant with the reference and marks its codon", () => {
    for (const q of ["Compare HbS with the reference sequence.", "How does the DNA change for the sickle-cell variant?", "Show the codon change of the sickle mutation."]) {
      const { plan, rule } = deterministicPlan(q, ctx6);
      expect(types(plan), q).toEqual(["enterWorld", "highlightSequenceRegion", "compareVariants", "revealEvidence"]);
      expect(rule).toMatch(/sequence/);
      expect(validatePlan(plan, ctx6, { query: q }).ok).toBe(true);
    }
  });
  it("a follow-up about the selected HbS residue compares it; about another residue it asks", () => {
    const sel = withSession(ctx6, { selection: H6 });
    const r = deterministicPlan("Compare it with the reference sequence.", sel);
    expect([r.rule, types(r.plan)]).toEqual(["compare-selection-sequence", ["enterWorld", "highlightSequenceRegion", "compareVariants", "revealEvidence"]]);
    expect(validatePlan(r.plan, sel).ok).toBe(true);
    const other = withSession(ctx6, { selection: { ...H6, residueNumber: 8, compId: "LYS", featureId: null } });
    expect(deterministicPlan("Compare it with the reference sequence.", other).plan.outcome).toBe("clarify");
  });
  it("is unchanged without the Phase 6 actions", () => {
    expect(deterministicPlan("Compare HbS with the reference sequence.", base).plan.outcome).toBe("unsupported");
    expect(deterministicPlan("Show the codon change of the sickle mutation.", base).rule).not.toMatch(/sequence/);
  });
  it("without an experimental structure, shows the variant on the sequence and says why (blueprint E)", () => {
    const c = noStructure(ctx6);
    const { plan, rule } = deterministicPlan("Show me where the sickle-cell mutation affects hemoglobin.", c);
    expect(rule).toBe("variant-no-structure-sequence");
    expect(types(plan)).toEqual(["enterWorld", "highlightSequenceRegion", "compareVariants", "revealEvidence"]);
    expect(plan.reason).toMatch(/No experimental structure.*predicted model is never used/);
    expect(validatePlan(plan, c).ok).toBe(true);
    expect(deterministicPlan("Show me where the sickle-cell mutation affects hemoglobin.", noStructure(base)).plan.outcome).toBe("unsupported");
  });
});
