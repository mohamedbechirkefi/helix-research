// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Author decision D-H010 (2026-11-02), routing part: the molecule names (hemoglobin, haemoglobin,
 * hémoglobine; beta-globin, beta globin, β-globin; HBB) and "chain" are protein cues for first-answer
 * routing. Amends D-H008, which treated the molecule names as neutral and "chain" as a weak cue.
 *
 * The first block pins the behaviour before the change (characterisation at helix-research 4ab9c9a,
 * committed alone). The D-H008 contexts (routeByCues without cueRules) keep this behaviour after
 * the change, so these pins stay true; the D-H010 behaviour (cueRules "dh010", prompt v5) is
 * stated in its own block. Test wordings are not the held-out items' wordings.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  DeterministicProvider,
  JourneyDirector,
  ProviderRegistry,
  RULES_V4,
  RULES_V5,
  buildMessages,
  contextForItem,
  deterministicPlan,
  planWorlds,
  promptVersion,
  questionCues,
  routeQuestion,
  unambiguousCueWorld,
  validatePlan,
  withSession,
  type PlanProvider,
  type PlanningContext,
  type ProviderOutput,
} from "../src/index.ts";
import { hbbContext, questions } from "./load.ts";

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

describe("D-H010: molecule names and chain are protein cues", () => {
  const v5: PlanningContext = { ...app, routeByCues: true, cueRules: "dh010" };
  const v5Dna = withSession(v5, { answer: "first", currentWorld: "dna" });
  const v5Protein = withSession(v5, { answer: "first", currentWorld: "protein" });
  const cues = (q: string) => questionCues(q, "dh010");
  const VAR = "NC_000011.10:g.5227002T>A";
  const F = { kind: "feature", featureId: "HbS_substitution" };
  const plan = (actions: unknown[], intent = "locate_variant") => ({ outcome: "plan", intent, entities: { geneId: "ENSG00000244734", proteinId: "P68871", variantId: VAR, structureId: null }, actions, explanationLevel: "intermediate", citations: [], followUps: [], reason: null });
  const DNA_PLAN = plan([{ type: "highlightSequenceRegion", target: { kind: "variant", variantId: VAR } }, { type: "compareVariants", variantIds: [VAR] }], "compare_variants");
  const PROTEIN_PLAN = plan([{ type: "loadStructure", structureId: "2HBS", assembly: "model" }, { type: "highlightResidue", target: F }, { type: "focusCamera", target: F }]);
  const cueCodes = (p: unknown, c: PlanningContext, q: string) => validatePlan(p, c, { query: q }).issues.filter((i) => i.code === "world-cue").map((i) => `${i.code} ${i.value}`);

  it("prompt v5 is v4 with rule 13 replaced; v4 is unchanged and still served to D-H008 contexts", () => {
    expect(sha(RULES_V4)).toBe("1464a7f8ca7ca2896693c83b61f1bd06c43d53f7d288d2d18415d681738df04a");
    expect(sha(RULES_V5)).toBe("fc0fc5918587d5799faed1e8850f2d8dab8e40c3838bba1c9cbbdd98611037f8");
    expect(promptVersion(v4Dna)).toBe("helix-plan-prompt-v4");
    expect(promptVersion(v5Dna)).toBe("helix-plan-prompt-v5");
    expect(promptVersion({ ...v5Dna, routeByCues: false })).toBe("helix-plan-prompt-v3");
    const a = RULES_V4.split("\n");
    const b = RULES_V5.split("\n");
    expect(b).toHaveLength(a.length);
    const changed = b.filter((l, i) => l !== a[i]);
    expect(changed).toHaveLength(1);
    expect(changed[0]).toContain("chain, fold, crystal");
    expect(changed[0]).toContain("and so do the names hemoglobin, beta-globin and HBB");
    expect(changed[0]).toContain("letter, gene, locus or chromosome name DNA World. A DNA word beats a name");
    expect(changed[0]).not.toContain("name neither world");
    expect(buildMessages(S08, v5Dna)[0]!.content.startsWith(`${RULES_V5}\n\nTRUSTED CONTEXT:`)).toBe(true);
    expect(buildMessages(S08, v4Dna)[0]!.content.startsWith(`${RULES_V4}\n\nTRUSTED CONTEXT:`)).toBe(true);
  });
  it("molecule names are strong protein cues, in every spelling", () => {
    for (const q of [S08, HBB_MUTATION, FR_HEMOGLOBINE, GREEK_BETA, HAEMOGLOBIN, BARE_HBB, BARE_HEMOGLOBIN, "Show me beta-globin.", "Show me the beta globin variant.", "Montre la bêta-globine.", "Load deoxyhemoglobin."]) {
      expect(cues(q), q).toMatchObject({ version: "helix-routing-dh010-v1", named: "protein", strong: { protein: true } });
      expect(cues(q).molecule!.length, q).toBeGreaterThan(0);
      expect(unambiguousCueWorld(q, "dh010"), q).toBe("protein");
    }
    expect(cues(GREEK_BETA).molecule).toEqual(["beta-globin"]);
    // Not names of the molecule under D-H010: the variant's name and globin alone.
    for (const q of ["Show me the HbS variant.", "Show me the globin.", "Show me the sickle-cell mutation."]) expect(cues(q).named, q).toBe(null);
  });
  it("chain is a strong protein cue", () => {
    expect(cues(BETA_CHAIN)).toMatchObject({ named: "protein", protein: ["chain"], strong: { protein: true } });
    expect(unambiguousCueWorld(BETA_CHAIN, "dh010")).toBe("protein");
    expect(cues("Où est la variante dans la chaîne bêta ?").named).toBe("protein");
  });
  it("mixed cases: a DNA cue beats a molecule name; a DNA cue with an explicit protein cue names both", () => {
    expect(cues(CODON_OF_HEMOGLOBIN)).toMatchObject({ named: "dna", dna: ["codon"], protein: ["hemoglobin"], molecule: ["hemoglobin"], strong: { dna: true, protein: false } });
    expect(unambiguousCueWorld(CODON_OF_HEMOGLOBIN, "dh010")).toBe("dna");
    expect(cues("Which DNA letter of HBB changes?").named).toBe("dna");
    // The gene words are weak DNA cues: they beat a name but never trigger the check.
    for (const q of [HBB_GENE, "Montre-moi le gène HBB.", "Open the gene for hemoglobin subunit beta.", "Where is the HBB locus on chromosome 11?"]) {
      expect(cues(q).named, q).toBe("dna");
      expect(unambiguousCueWorld(q, "dh010"), q).toBe(null);
    }
    expect(cues("Show the codon change on the beta chain.").named).toBe("both");
    expect(cues("Show the hemoglobin codon and its residue in 3D.").named).toBe("both");
    expect(unambiguousCueWorld("Show the codon change on the beta chain.", "dh010")).toBe(null);
    // Still one world: a mixed question is left to the planner, and rule 13 holds.
    expect(routeQuestion("Show the codon change on the beta chain.", "dna", "dh010")).toMatchObject({ world: null, why: "mixed" });
  });
  it("routes molecule-name questions to Protein World whatever the world on screen; DNA cues still win", () => {
    for (const w of ["dna", "protein"] as const) {
      expect(routeQuestion(S08, w, "dh010"), w).toMatchObject({ world: "protein", why: "named" });
      expect(routeQuestion(CODON_OF_HEMOGLOBIN, w, "dh010"), w).toMatchObject({ world: "dna", why: "named" });
      expect(routeQuestion("Show me the sickle-cell mutation.", w, "dh010"), w).toMatchObject({ world: w, why: "current-world" });
    }
  });
  it("the rule-based planner answers a molecule-name variant question on the structure, from either world", () => {
    for (const q of [S08, HBB_MUTATION, FR_HEMOGLOBINE, GREEK_BETA, HAEMOGLOBIN, BETA_CHAIN]) {
      for (const c of [v5Dna, v5Protein]) {
        const d = deterministicPlan(q, c);
        expect(d.rule, q).toBe("variant-locate");
        expect(planWorlds(d.plan), q).toEqual(["protein"]);
        expect(validatePlan(d.plan, c, { query: q }).ok, q).toBe(true);
      }
    }
    const codon = deterministicPlan(CODON_OF_HEMOGLOBIN, v5Protein);
    expect(codon.rule).toBe("variant-sequence");
    expect(planWorlds(codon.plan)).toEqual(["dna"]);
  });
  it("a request to show the molecule by name opens Protein World; the gene keeps the gene rule", () => {
    for (const q of [BARE_HBB, BARE_HEMOGLOBIN, "Open beta-globin."]) {
      const d = deterministicPlan(q, v5Dna);
      expect(d.rule, q).toBe("protein-world-named");
      expect(d.plan.actions).toEqual([{ type: "enterWorld", world: "protein" }]);
      expect(validatePlan(d.plan, v5Dna, { query: q }).ok, q).toBe(true);
    }
    expect(deterministicPlan("Tell me about hemoglobin.", v5Dna).rule).toBe("no-rule");
    expect(deterministicPlan(HBB_GENE, v5Dna).rule).toBe("gene");
    // D-H008 contexts are unchanged.
    expect(deterministicPlan(BARE_HBB, v4Dna).rule).toBe("gene");
  });
  it("the world-cue check rejects a DNA-World first answer to a molecule-name question; gene, mixed and D-H008 cases pass", () => {
    expect(cueCodes(DNA_PLAN, v5Dna, HBB_MUTATION)).toEqual(["world-cue protein<dna"]);
    expect(cueCodes(DNA_PLAN, v5Dna, S08)).toEqual(["world-cue protein<dna"]);
    expect(cueCodes(DNA_PLAN, v5Dna, BETA_CHAIN)).toEqual(["world-cue protein<dna"]);
    expect(cueCodes(PROTEIN_PLAN, v5Protein, CODON_OF_HEMOGLOBIN)).toEqual(["world-cue dna<protein"]);
    expect(cueCodes(PROTEIN_PLAN, v5Dna, "Show the sickle-cell mutation in the HBB gene.")).toEqual([]);
    expect(cueCodes(DNA_PLAN, v5Dna, "Show the codon change on the beta chain.")).toEqual([]);
    expect(cueCodes(DNA_PLAN, v4Dna, HBB_MUTATION)).toEqual([]);
  });
  it("the director falls back on a world-cue rejection; the rule-based plan shows the structure", async () => {
    const raw = JSON.stringify(DNA_PLAN);
    const p: PlanProvider = { id: "scripted", kind: "mock", label: "scripted", local: true, detect: async () => ({ available: true, reason: "ok" }), plan: async (): Promise<ProviderOutput> => ({ raw, timings: { firstTokenMs: 1, totalMs: 2 } }) };
    const reg = new ProviderRegistry([new DeterministicProvider(), p], [p.id]);
    await reg.selectBest();
    const res = await new JourneyDirector(reg, v5).handle(HBB_MUTATION, { answer: "first", currentWorld: "dna" });
    expect(res.usedFallback).toBe(true);
    expect(res.fallbackReason).toBe("provider plan rejected: world-cue protein<dna");
    expect(planWorlds(res.plan)).toEqual(["protein"]);
  });
  it("every rule-based plan of the benchmark sets passes its own validation, in one world, from either world", () => {
    for (const item of [...questions(), ...questions("heldout.jsonl"), ...questions("routing-heldout.jsonl")]) {
      for (const w of ["dna", "protein"] as const) {
        const c = withSession(contextForItem(v5, item), { answer: item.selection ? "follow-up" : "first", currentWorld: item.selection ? "protein" : w });
        const { plan: p } = deterministicPlan(item.query, c);
        expect(planWorlds(p).length, `${item.id} ${w}`).toBeLessThanOrEqual(1);
        expect(validatePlan(p, c, { query: item.query }).issues.filter((i) => i.code === "world-switch" || i.code === "world-cue"), `${item.id} ${w}`).toEqual([]);
      }
    }
  });
});
