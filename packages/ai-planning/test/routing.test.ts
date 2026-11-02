// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Author decision D-H008 (2026-11-02): a first answer goes to the world the question names; a
 * neutral question stays in the current world; after a DNA-World variant answer the first offered
 * suggestion is the bridge to the protein.
 *
 * The first block pins the behaviour before the change (characterisation, written at d8d2ece and
 * committed alone). Cases the change alters are re-stated, not edited, in the D-H008 block.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  RULES_V3,
  buildMessages,
  contextAfterPlan,
  deterministicPlan,
  planWorlds,
  promptVersion,
  screenFollowUp,
  validatePlan,
  withSession,
  type PlanningContext,
} from "../src/index.ts";
import { hbbContext } from "./load.ts";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const VAR = "NC_000011.10:g.5227002T>A";
const F = { kind: "feature", featureId: "HbS_substitution" };
const base = hbbContext();
/** The context as the Phase 6 app restricts it (helix-app restrictToBuild): DNA and Protein World, Phase 6 actions. */
const app: PlanningContext = {
  ...base,
  worlds: base.worlds.map((w) => (w.id === "dna" || w.id === "protein" ? w : { ...w, available: false, reason: w.available ? "no scene for this world in the Phase 6 build" : w.reason })),
  executableActions: [...base.executableActions, "compareVariants", "highlightSequenceRegion"],
};
const firstDna = withSession(app, { answer: "first", currentWorld: "dna" });
const plan = (actions: unknown[], intent = "locate_variant") => ({
  outcome: "plan",
  intent,
  entities: { geneId: "ENSG00000244734", proteinId: "P68871", variantId: VAR, structureId: null },
  actions,
  explanationLevel: "intermediate",
  citations: [],
  followUps: [],
  reason: null,
});
const DNA_PLAN = plan([{ type: "highlightSequenceRegion", target: { kind: "variant", variantId: VAR } }, { type: "compareVariants", variantIds: [VAR] }], "compare_variants");
const PROTEIN_PLAN = plan([{ type: "loadStructure", structureId: "2HBS", assembly: "model" }, { type: "highlightResidue", target: F }, { type: "focusCamera", target: F }]);

const S19 = "I'm a beginner: show me the sickle-cell mutation and keep it simple.";
const S08 = "take me to the sickle cell spot on hemoglobin";
const PROTEIN_Q = "Show me the sickle-cell mutation on the protein.";
const DNA_LETTERS_Q = "Which DNA letter changes in the sickle-cell variant?";
const CODON_Q = "Show the codon change of the sickle mutation.";
const BRIDGE = "See the sickle-cell mutation on the protein.";

describe("characterisation at d8d2ece (before D-H008)", () => {
  it("the v3 rules hash as shipped at c7b2385", () => {
    expect(sha(RULES_V3)).toBe("59da4a21b410c7637139e28f93b05eb5f1c4c941bd7d1aa0e01df491c864a630");
  });
  it("a first answer in the app context gets the v3 prompt", () => {
    expect(promptVersion(firstDna)).toBe("helix-plan-prompt-v3");
    expect(buildMessages(S19, firstDna)[1]!.content).toContain("\n\nANSWER: first (rule 13: actions of one world only)\n\n");
  });
  it("the rule-based planner answers neutral variant questions in Protein World, whatever world is on screen", () => {
    for (const q of [S19, S08]) {
      const r = deterministicPlan(q, firstDna);
      expect(r.rule, q).toBe("variant-locate");
      expect(planWorlds(r.plan), q).toEqual(["protein"]);
    }
  });
  it("the rule-based planner answers a DNA-letter question without a listed sequence phrase in Protein World", () => {
    const r = deterministicPlan(DNA_LETTERS_Q, firstDna);
    expect(r.rule).toBe("variant-locate");
    expect(planWorlds(r.plan)).toEqual(["protein"]);
  });
  it("protein and codon questions route as before", () => {
    expect(deterministicPlan(PROTEIN_Q, firstDna).rule).toBe("variant-locate");
    const c = deterministicPlan(CODON_Q, firstDna);
    expect(c.rule).toBe("variant-sequence");
    expect(planWorlds(c.plan)).toEqual(["dna"]);
  });
  it("validatePlan accepts a one-world first answer in either world, whatever the question names", () => {
    expect(validatePlan(DNA_PLAN, firstDna, { query: PROTEIN_Q }).issues).toEqual([]);
    expect(validatePlan(PROTEIN_PLAN, firstDna, { query: DNA_LETTERS_Q }).issues).toEqual([]);
  });
  it("contextAfterPlan leaves the world and answer kind as they were", () => {
    const after = contextAfterPlan(validatePlan(DNA_PLAN, firstDna).plan!, firstDna);
    expect(after.currentWorld).toBe("dna");
    expect(after.answer).toBe("first");
    const afterP = contextAfterPlan(validatePlan(PROTEIN_PLAN, firstDna).plan!, firstDna);
    expect(afterP.currentWorld).toBe("dna");
    expect(afterP.answer).toBe("first");
  });
  it("the bridge question passes the follow-up filter after a DNA-World variant answer", () => {
    const after = contextAfterPlan(validatePlan(DNA_PLAN, firstDna).plan!, firstDna);
    expect(screenFollowUp(BRIDGE, after)).toEqual({ text: BRIDGE, kept: true, reason: null, detail: "variant-locate" });
    expect(screenFollowUp("See it on the protein.", after).kept).toBe(false);
  });
});
