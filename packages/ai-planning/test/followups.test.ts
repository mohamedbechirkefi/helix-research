// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Follow-up suggestion filter (D-H007). The examples are real suggestions recorded in earlier
 * runs; the source of each group is named next to it.
 */
import { describe, expect, it } from "vitest";
import { CAPABILITY_RULES, DeterministicProvider, FOLLOWUP_FILTER_VERSION, JourneyDirector, ProviderRegistry, contextAfterPlan, deterministicPlan, filterFollowUps, screenFollowUp, screenPlanFollowUps, withSession, type PlanProvider, type PlanningContext } from "../src/index.ts";
import { hbbContext } from "./load.ts";

const base = hbbContext();
const ctx6: PlanningContext = { ...base, executableActions: [...base.executableActions, "compareVariants", "highlightSequenceRegion"] };
const H6 = { structureId: "2HBS", chainId: "H", residueNumber: 6, numbering: "auth" as const, compId: "VAL", featureId: "HbS_substitution" };
const afterReference = withSession(ctx6, { selection: H6 });
const noStructure = (c: PlanningContext): PlanningContext => ({
  ...c,
  structures: [],
  features: [],
  evidence: c.evidence.filter((e) => !/^(pdb|sifts|atom_site|contacts|alphafold):/.test(e.id)),
  worlds: c.worlds.map((w) => (w.id === "protein" ? { ...w, available: false, reason: "no experimental structure in this dataset" } : w)),
});
const reason = (t: string, c: PlanningContext = afterReference) => screenFollowUp(t, c).reason;

describe("the clinical suggestion recorded in Phase 5", () => {
  // helix-app apps/web/e2e/results/phase5-e2e-2026-11-02.json, scenarios.modes.ollama, the
  // ministral-3:8b plan for "Why is this residue important?" (journal HX-P5-2026-11-02-modes-rapid),
  // and again in phase5-e2e-2026-11-02-p6reg.json.
  const recorded = [
    "What are the clinical implications of this variant?",
    "How does this residue’s mutation affect hemoglobin’s function?",
    "Can you show the structural changes caused by this substitution?",
  ];
  it("drops all three; the clinical one as clinical", () => {
    const s = filterFollowUps(recorded, afterReference);
    expect(s.kept).toEqual([]);
    expect(s.verdicts.map((v) => v.reason)).toEqual(["clinical", "scope", "scope"]);
    expect(s.verdicts[0]!.detail).toBe("clinical");
  });
  it("the rule-based planner alone would have answered it with a scene, which is why the blocklist exists", () => {
    const { plan, rule } = deterministicPlan(recorded[0]!, afterReference);
    expect(plan.outcome).toBe("plan");
    expect(rule).toMatch(/^variant-|^selection-/);
  });
});

describe("clinical, diagnostic, treatment and personal intent is dropped", () => {
  // From the Phase 3 benchmark runs (research/benchmark/runs/*/raw.jsonl) unless stated.
  const clinical = [
    "What is the clinical significance of HbS?",
    "What are the clinical implications of sickle cell disease?",
    "How does this mutation lead to the symptoms of sickle-cell anaemia?",
    "Is this mutation associated with any other diseases?",
    "What are the potential consequences of the sickle-cell mutation for individuals with hemoglobinopathy?",
    "How does the sickle-cell trait relate to malaria resistance?",
    "Which diseases are associated with variants in HBB?",
    "How does the HbS mutation impact the sickle cell disease pathophysiology?",
    "How does this variant affect the sickle-cell disease phenotype?",
    "What are the implications of HbS for public health?",
    // Written for this test: personal and treatment questions.
    "Should I get tested for the sickle-cell variant?",
    "Does my child carry HbS?",
    "What treatment exists for HbS?",
    "Is the sickle-cell variant pathogenic?",
  ];
  it.each(clinical)("%s", (t) => {
    expect(reason(t)).toBe("clinical");
  });
});

describe("questions no curated record answers are dropped", () => {
  const scope = [
    // helix-app e2e results e2e-2026-11-02.json and e2e-2026-11-02-p6reg.json (ministral-3:8b).
    "What is the effect of this mutation on hemoglobin’s function?",
    "How does the sickle-cell mutation alter hemoglobin’s structure?",
    "How does this mutation affect hemoglobin’s function?",
    "What are the structural consequences of the Glu6Val substitution?",
    "Can you show the contacts lost or gained due to this mutation?",
    // Benchmark runs.
    "How does sickle hemoglobin differ structurally from normal hemoglobin?",
    "How does the sickle hemoglobin variant alter the protein’s stability?",
    "Compare the sickle variant with the wild type in this structure.",
    "What is the molecular mechanism of sickle cell disease?",
  ];
  it.each(scope)("%s", (t) => {
    expect(["scope", "clinical"]).toContain(reason(t));
  });
});

describe("ungrounded or unsupported suggestions are dropped", () => {
  it("names outside the curated records", () => {
    expect(reason("Where is CFTR F508del in the structure?")).toBe("ungrounded");
    expect(reason("Show TP53 on the protein.")).toBe("ungrounded");
    expect(reason("Load PDB 1BZO and show the variant.")).toBe("ungrounded");
    // Other haemoglobin variants are caught earlier, by the scope list.
    expect(reason("Show the HbC variant on the protein.")).toBe("scope");
  });
  it("things this build cannot show", () => {
    expect(screenFollowUp("Show the residues around the sickle variant in a different assembly view.", afterReference).kept).toBe(false);
    expect(reason("Show the predicted AlphaFold model.")).toBe("scope");
    expect(reason("Which pathways involve beta-globin?")).toBe("scope");
    expect(reason("Show the protein domains of beta-globin.")).toBe("capability");
    expect(reason("Show the HBB gene on the genome.")).toBe("capability");
    expect(reason("Zoom in on residue 40 please.")).toBe("capability");
  });
  it("format", () => {
    expect(reason("")).toBe("format");
    expect(reason("See https://example.org for more")).toBe("format");
    expect(reason("Run <script>alert(1)</script>")).toBe("format");
    expect(reason("x".repeat(161))).toBe("format");
  });
});

describe("suggestions this app can show are kept", () => {
  it("the deterministic planner's own follow-ups pass, in the context after its plan", () => {
    for (const c of [base, ctx6]) {
      const { plan } = deterministicPlan("Show me where the sickle-cell mutation affects hemoglobin.", c);
      expect(plan.followUps.length).toBeGreaterThan(0);
      const { plan: screened, screen } = screenPlanFollowUps(plan, c);
      expect(screen.verdicts.filter((v) => !v.kept)).toEqual([]);
      expect(screened.followUps).toEqual(plan.followUps);
    }
  });
  it("ClinVar's classification is not suggested (it invites a clinical reading)", () => {
    expect(reason("How is this variant classified by ClinVar?")).toBe("clinical");
  });
  it("planner-to-user questions and other languages are not shown", () => {
    expect(reason("Would you like to see the crystal structure of HbS?")).toBe("scope");
    expect(reason("Quelle est la mutation présente dans cette structure ?")).toBe("format");
    expect(reason("Quelle est la signification clinique de cette variante selon ClinVar?")).toBe("clinical");
  });
  it("model suggestions that name a supported scene", () => {
    // Benchmark runs (ministral-3:8b, qwen3.5:4b, llama3.1:8b).
    const kept = [
      "Show the sickle cell variant (HbS) on the protein.",
      "Which residues contact the valine introduced by the sickle cell mutation?",
      "Show the contacts made by the sickle variant in 2HBS.",
      "Can you highlight the residue responsible for sickle hemoglobin?",
    ];
    for (const t of kept) expect(screenFollowUp(t, afterReference), t).toMatchObject({ kept: true });
  });
  it("the app's supported questions pass in the full build", () => {
    for (const t of ["Show me where the sickle-cell mutation affects hemoglobin.", "How does the DNA change for the sickle-cell variant?", "What does the HbS residue touch in the crystal?", "Show the evidence for the sickle-cell variant.", "Compare it with the reference sequence."]) {
      expect(screenFollowUp(t, afterReference), t).toMatchObject({ kept: true });
    }
  });
  it("without an experimental structure, structure suggestions are dropped and sequence ones kept", () => {
    const c = noStructure(ctx6);
    expect(screenFollowUp("What does the HbS residue touch in the crystal?", c).kept).toBe(false);
    expect(screenFollowUp("How does the DNA change for the sickle-cell variant?", c).kept).toBe(true);
    expect(screenFollowUp("Show the evidence for the sickle-cell variant.", c).kept).toBe(true);
  });
  it("a selection follow-up needs the selection it refers to", () => {
    expect(screenFollowUp("What does this residue touch in the crystal?", ctx6).kept).toBe(false);
    expect(screenFollowUp("What does this residue touch in the crystal?", afterReference).kept).toBe(true);
  });
});

describe("filterFollowUps and contextAfterPlan", () => {
  it("keeps order, removes duplicates, caps the count and names its version", () => {
    const s = filterFollowUps(["Show the evidence for the sickle-cell variant.", "show the evidence for the sickle cell variant", "What are the clinical implications of HbS?", "Show the sickle cell variant (HbS) on the protein.", "What does the HbS residue touch in the crystal?", "How does the DNA change for the sickle-cell variant?"], afterReference, 3);
    expect(s.version).toBe(FOLLOWUP_FILTER_VERSION);
    expect(s.kept).toEqual(["Show the evidence for the sickle-cell variant.", "Show the sickle cell variant (HbS) on the protein.", "What does the HbS residue touch in the crystal?"]);
    expect(s.verdicts.map((v) => v.reason)).toEqual([null, "duplicate", "clinical", null, null, "capability"]);
  });
  it("two suggestions that would produce the same scene count once", () => {
    const s = filterFollowUps(["How does the DNA change at this codon?", "How does the DNA change for the sickle-cell variant?"], afterReference);
    expect(s.kept).toEqual(["How does the DNA change at this codon?"]);
    expect(s.verdicts[1]).toMatchObject({ reason: "duplicate", detail: "same scene" });
  });
  it("selects the highlighted variant residue on the resolver's focus chain (H, the contact source)", () => {
    const { plan } = deterministicPlan("Show me where the sickle-cell mutation affects hemoglobin.", ctx6);
    const after = contextAfterPlan(plan, ctx6);
    expect(after.selection).toMatchObject({ structureId: "2HBS", chainId: "H", residueNumber: 6, featureId: "HbS_substitution" });
    expect(contextAfterPlan(deterministicPlan("Where does CFTR F508del occur?", ctx6).plan, ctx6)).toBe(ctx6);
  });
  it("the allowlist only names rules the planner has", () => {
    expect(CAPABILITY_RULES.has("gene")).toBe(false);
    expect(CAPABILITY_RULES.has("predicted-structure")).toBe(false);
  });
});

describe("the reference director screens every plan's follow-ups", () => {
  // A scripted model that returns the rule-based plan with the Phase 5 model's three suggestions.
  const recorded = ["What are the clinical implications of this variant?", "How does this residue’s mutation affect hemoglobin’s function?", "What does this residue touch in the crystal?"];
  const scripted: PlanProvider = {
    id: "scripted",
    kind: "mock",
    label: "scripted",
    local: true,
    detect: async () => ({ available: true, reason: "ok" }),
    plan: async (req) => ({ raw: JSON.stringify({ ...deterministicPlan(req.query, req.context).plan, followUps: recorded }), timings: { firstTokenMs: 1, totalMs: 2 } }),
  };
  it("drops the model's clinical and out-of-scope suggestions and keeps the plan", async () => {
    const reg = new ProviderRegistry([new DeterministicProvider(), scripted], [scripted.id]);
    await reg.selectBest();
    const r = await new JourneyDirector(reg, ctx6).handle("Show me where the sickle-cell mutation affects hemoglobin.");
    expect(r.source).toBe("scripted");
    expect(r.usedFallback).toBe(false);
    expect(r.plan.actions.map((a) => a.type)).toContain("highlightResidue");
    expect(r.followUpScreen.verdicts.map((v) => v.reason)).toEqual(["clinical", "scope", null]);
    expect(r.plan.followUps).toEqual(["What does this residue touch in the crystal?"]);
  });
  it("the deterministic planner's suggestions pass through the same filter", async () => {
    const reg = new ProviderRegistry([new DeterministicProvider()], []);
    await reg.selectBest();
    const r = await new JourneyDirector(reg, ctx6).handle("Show me where the sickle-cell mutation affects hemoglobin.");
    expect(r.followUpScreen.verdicts.length).toBe(2);
    expect(r.plan.followUps).toEqual(r.followUpScreen.kept);
    expect(r.plan.followUps).toEqual(["How does the DNA change at this codon?", "What does this residue touch in the crystal?"]);
  });
});
