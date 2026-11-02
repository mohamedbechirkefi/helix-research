// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Author decision D-H010 (2026-11-02), routing part: the molecule names (hemoglobin, haemoglobin,
 * hémoglobine; beta-globin, beta globin, β-globin; HBB) and "chain" are protein cues for first-answer
 * routing. Amends D-H008, which treated the molecule names as neutral and "chain" as a weak cue.
 *
 * The first block pins the behaviour before the change (characterisation at helix-research 4ab9c9a,
 * committed alone). The D-H008 contexts (routeByCues without cueRules) keep this behaviour after
 * the change, so these pins stay true; the D-H010 behaviour is stated in its own block.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { RULES_V4, deterministicPlan, planWorlds, promptVersion, questionCues, routeQuestion, unambiguousCueWorld, validatePlan, withSession, type PlanningContext } from "../src/index.ts";
import { hbbContext } from "./load.ts";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const base = hbbContext();
const app: PlanningContext = {
  ...base,
  worlds: base.worlds.map((w) => (w.id === "dna" || w.id === "protein" ? w : { ...w, available: false, reason: w.available ? "no scene for this world in the Phase 6 build" : w.reason })),
  executableActions: [...base.executableActions, "compareVariants", "highlightSequenceRegion"],
};
/** The D-H008 routed context (prompt v4). */
const v4: PlanningContext = { ...app, routeByCues: true };
const v4Dna = withSession(v4, { answer: "first", currentWorld: "dna" });
const v4Protein = withSession(v4, { answer: "first", currentWorld: "protein" });

const S08 = "take me to the sickle cell spot on hemoglobin";
const HBB_MUTATION = "Show me the HBB mutation.";
const CODON_OF_HEMOGLOBIN = "Which codon of hemoglobin changes in the sickle-cell variant?";
const BETA_CHAIN = "Show the sickle-cell change in the beta chain.";
const FR_HEMOGLOBINE = "Montre-moi la mutation drépanocytaire de l'hémoglobine.";
const GREEK_BETA = "Show the β-globin sickle mutation.";
const HAEMOGLOBIN = "Show me the haemoglobin sickle-cell variant.";
const HBB_GENE = "Show me the HBB gene.";
const BARE_HBB = "Show me HBB.";
const BARE_HEMOGLOBIN = "Show me hemoglobin.";

describe("characterisation at 4ab9c9a (before D-H010)", () => {
  it("the v4 rules hash as shipped at cba0368", () => {
    expect(sha(RULES_V4)).toBe("1464a7f8ca7ca2896693c83b61f1bd06c43d53f7d288d2d18415d681738df04a");
    expect(promptVersion(v4Dna)).toBe("helix-plan-prompt-v4");
  });
  it("molecule names are not cues; 'chain' is a weak protein cue", () => {
    for (const q of [S08, HBB_MUTATION, FR_HEMOGLOBINE, GREEK_BETA, HAEMOGLOBIN, HBB_GENE, BARE_HBB, BARE_HEMOGLOBIN, "Show me beta-globin.", "Show me the beta globin variant."]) {
      expect(questionCues(q).named, q).toBe(null);
      expect(questionCues(q).protein, q).toEqual([]);
    }
    expect(questionCues(BETA_CHAIN)).toMatchObject({ named: "protein", protein: ["chain"], strong: { dna: false, protein: false } });
    expect(unambiguousCueWorld(BETA_CHAIN)).toBe(null);
    expect(questionCues(CODON_OF_HEMOGLOBIN)).toMatchObject({ named: "dna", dna: ["codon"], protein: [] });
  });
  it("a variant question naming only the molecule stays in the world on screen (rule-based)", () => {
    for (const q of [S08, HBB_MUTATION, FR_HEMOGLOBINE, GREEK_BETA, HAEMOGLOBIN]) {
      expect(routeQuestion(q, "dna"), q).toMatchObject({ world: "dna", why: "current-world" });
      const d = deterministicPlan(q, v4Dna);
      expect(d.rule, q).toBe("variant-sequence-current-world");
      expect(planWorlds(d.plan), q).toEqual(["dna"]);
      const p = deterministicPlan(q, v4Protein);
      expect(p.rule, q).toBe("variant-locate");
      expect(planWorlds(p.plan), q).toEqual(["protein"]);
    }
  });
  it("a chain question goes to Protein World; a codon question with a molecule name to DNA World", () => {
    expect(routeQuestion(BETA_CHAIN, "dna")).toMatchObject({ world: "protein", why: "named" });
    expect(planWorlds(deterministicPlan(BETA_CHAIN, v4Dna).plan)).toEqual(["protein"]);
    expect(deterministicPlan(CODON_OF_HEMOGLOBIN, v4Protein).rule).toBe("variant-sequence");
  });
  it("the gene rule answers HBB and the HBB gene with Genome World, which the app build does not have", () => {
    for (const q of [HBB_GENE, BARE_HBB]) {
      const d = deterministicPlan(q, v4Dna);
      expect(d.rule, q).toBe("gene");
      expect(planWorlds(d.plan), q).toEqual(["genome"]);
      expect(validatePlan(d.plan, v4Dna, { query: q }).issues.map((i) => i.code), q).toContain("world-unavailable");
    }
    expect(deterministicPlan(BARE_HEMOGLOBIN, v4Dna).rule).toBe("no-rule");
    expect(deterministicPlan("Show me beta-globin.", v4Dna).rule).toBe("no-rule");
  });
  it("the world-cue check does not fire for a molecule-name question answered in DNA World", () => {
    const c = (q: string, p: unknown) => validatePlan(p, v4Dna, { query: q }).issues.filter((i) => i.code === "world-cue");
    const dna = deterministicPlan(HBB_MUTATION, v4Dna).plan;
    expect(c(HBB_MUTATION, dna)).toEqual([]);
    expect(c(S08, dna)).toEqual([]);
    expect(c(BETA_CHAIN, dna)).toEqual([]);
  });
});
