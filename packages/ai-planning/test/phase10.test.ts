// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Phase 10 (P10.1.1, docs/phase-10-ai-explorer.md section 2): the six explorer actions in the plan
 * vocabulary, their validation against the records, one rule-based rule per action, and the refusals,
 * on HBB and FAAH2. The Phase 3 to 9 contexts, schemas and prompts are unchanged.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACTION_TYPES,
  Action,
  MEASURED_PROMPT_ACTIONS,
  NON_MANE_REASON,
  PHASE10_ACTIONS,
  ShowProteinDomainsAction,
  buildHbbContext,
  buildMessages,
  deterministicPlan,
  explorerRecords,
  planJsonSchema,
  planWorlds,
  taughtActions,
  validatePlan,
  withExplorerRecords,
  withSession,
  type Plan,
  type PlanningContext,
} from "../src/index.ts";
import { REPO_ROOT, faah2Bundle, hbbBundleWithPathways, hbbContext, pathwaysRecord } from "./load.ts";

const PHASE6 = ["resolveGene", "resolveVariant", "loadStructure", "enterWorld", "focusCamera", "highlightResidue", "revealEvidence", "cancelActions", "compareVariants", "highlightSequenceRegion"];
/** The app's build: the registry v3 (Phase 6 plus the six Phase 10 actions), routed by D-H010 cues, with the explorer records. */
const app = (base: PlanningContext, b: { gene: unknown; protein: unknown }, world: PlanningContext["currentWorld"] = "dna", extra: Partial<PlanningContext> = {}): PlanningContext => ({
  ...withExplorerRecords(base, b),
  executableActions: [...PHASE6, ...PHASE10_ACTIONS],
  routeByCues: true,
  cueRules: "dh010",
  answer: "follow-up",
  currentWorld: world,
  ...extra,
});
const hbbB = hbbBundleWithPathways();
const hbb = (world: PlanningContext["currentWorld"] = "dna", extra: Partial<PlanningContext> = {}) => app(buildHbbContext(hbbB), hbbB, world, extra);
const fB = { ...faah2Bundle(), pathways: pathwaysRecord("faah2") };
const faah2 = (world: PlanningContext["currentWorld"] = "dna") => app(buildHbbContext(fB), fB, world);
const run = (q: string, ctx: PlanningContext) => {
  const { plan, rule } = deterministicPlan(q, ctx);
  const v = validatePlan(plan, ctx, { query: q });
  expect(v.issues, `${q}: ${JSON.stringify(v.issues)}`).toEqual([]);
  return { plan, rule, types: plan.actions.map((a) => a.type) };
};
const sha = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex");

describe("the vocabulary and what stays measured", () => {
  it("the six actions parse with semantic targets only", () => {
    for (const a of [
      { type: "selectTranscript", transcriptId: "ENST00000335295.4" },
      { type: "showProteinDomains", proteinAccession: "P68871" },
      { type: "showProteinDomains", proteinAccession: "P68871", featureTypes: ["Domain"] },
      { type: "showPathway" },
      { type: "showPathway", stableId: "R-HSA-1247673" },
      { type: "setRepresentation", representation: "ball-and-stick" },
      { type: "beginTransition", from: "dna", to: "protein" },
      { type: "returnToOverview" },
    ])
      expect(Action.safeParse(a).success, JSON.stringify(a)).toBe(true);
    for (const a of [
      { type: "setRepresentation", representation: "wireframe" },
      { type: "showProteinDomains", proteinAccession: "P68871", featureTypes: ["Binding site"] },
      { type: "showProteinDomains", proteinAccession: "P68871", proteinId: "P68871" },
      { type: "beginTransition", from: "dna", to: "ribosome" },
      { type: "returnToOverview", camera: [0, 0, 1] },
      { type: "showPathway", stableId: "R-HSA-1", residues: [6] },
    ])
      expect(Action.safeParse(a).success, JSON.stringify(a)).toBe(false);
    expect(ShowProteinDomainsAction.safeParse({ type: "showProteinDomains", proteinId: "P68871" }).success).toBe(false);
    expect(ACTION_TYPES).toEqual(expect.arrayContaining([...PHASE10_ACTIONS]));
  });
  it("the v1 and v2 decoding schemas are byte-identical to Phase 6 (sha256 pinned before the change)", () => {
    expect(sha(planJsonSchema("v1"))).toBe("29ca7da53c52b3c5a8fb6586ed3c8d40fffd3d5a7ed5d449a7a57ca37ac3f54e");
    expect(sha(planJsonSchema("v2"))).toBe("a737a251eff854bac1f893de3020d71a5dddd051fb34f28bb29d09852907c6d6");
  });
  it("the HBB context built by the builder is the Phase 8 fixture; the explorer records are added beside it, never in it", () => {
    const pinned = JSON.parse(readFileSync(join(import.meta.dirname, "fixtures", "hbb-context-phase8.json"), "utf8")) as PlanningContext;
    expect(hbbContext()).toEqual(pinned);
    const extended = withExplorerRecords(hbbContext(), hbbB);
    const { transcriptCandidates, transcriptSelection, proteinFeatures, proteinFeatureTypes, ...rest } = extended;
    expect(rest).toEqual(pinned);
    expect(transcriptCandidates).toBeDefined();
    expect(transcriptSelection && proteinFeatures && proteinFeatureTypes).toBeTruthy();
  });
  it("prompt v5 renders the same messages with the explorer records and the Phase 10 actions in the context", () => {
    const before: PlanningContext = { ...buildHbbContext(hbbB), executableActions: PHASE6, routeByCues: true, cueRules: "dh010", answer: "first", currentWorld: "dna" };
    const after: PlanningContext = { ...withExplorerRecords(before, hbbB), executableActions: [...PHASE6, ...PHASE10_ACTIONS] };
    expect(buildMessages("Show the domains", after)).toEqual(buildMessages("Show the domains", before));
  });
  it("planWorlds: showPathway opens Pathway World, beginTransition and setRepresentation are Protein World, the others stay", () => {
    const p = (actions: Plan["actions"]) => planWorlds({ actions });
    expect(p([{ type: "showPathway" }])).toEqual(["pathway"]);
    expect(p([{ type: "beginTransition", from: "dna", to: "protein" }, { type: "focusCamera", target: { kind: "selection" } }])).toEqual(["protein"]);
    expect(p([{ type: "setRepresentation", representation: "surface" }])).toEqual(["protein"]);
    expect(p([{ type: "selectTranscript", transcriptId: "x" }, { type: "showProteinDomains", proteinAccession: "P68871" }, { type: "returnToOverview" }])).toEqual([]);
  });
});

describe("the explorer records, read from the gene and protein records", () => {
  it("HBB: the gene record's MANE Select transcript and the protein record's two other Ensembl transcripts; the Globin domain", () => {
    const r = explorerRecords(hbbB);
    expect(r.transcriptCandidates).toEqual([
      { id: "ENST00000335295.4", maneSelect: true, source: "gene record selection (rule mane_select)" },
      { id: "ENST00000647020.1", maneSelect: false, source: "UniProt P68871 cross-reference" },
      { id: "ENST00000883533.1", maneSelect: false, source: "UniProt P68871 cross-reference" },
    ]);
    expect(r.transcriptSelection).toEqual({ selected: "ENST00000335295.4", rule: "mane_select", reason: "only transcript with MANE[].type == MANE_Select", candidatesConsidered: 19 });
    expect(r.proteinFeatures).toEqual([{ id: "uniprot-feature:P68871:Domain:3-147", proteinAccession: "P68871", type: "Domain", description: "Globin", start: 3, end: 147, evidences: ["ECO:0000255 PROSITE-ProRule:PRU00238"] }]);
    expect(r.proteinFeatureTypes).toEqual(["Domain"]);
  });
  it("FAAH2: one candidate (MANE Select) and no feature of the explorer types", () => {
    const r = explorerRecords(fB);
    expect(r.transcriptCandidates.map((c) => [c.id, c.maneSelect])).toEqual([["ENST00000374900.5", true]]);
    expect(r.proteinFeatures).toEqual([]);
    expect(r.proteinFeatureTypes).toEqual([]);
  });
});

describe("validation of the six actions", () => {
  const plan = (actions: Plan["actions"]): Plan => ({ outcome: "plan", intent: "other", entities: { geneId: null, proteinId: null, variantId: null, structureId: null }, actions, explanationLevel: "intermediate", citations: [], followUps: [], reason: null });
  const issues = (actions: Plan["actions"], ctx: PlanningContext) => validatePlan(plan(actions), ctx).issues.map((i) => [i.code, i.message]);
  it("selectTranscript: a candidate of the records, and only the MANE Select one", () => {
    expect(issues([{ type: "selectTranscript", transcriptId: "ENST00000335295.4" }], hbb())).toEqual([]);
    expect(issues([{ type: "selectTranscript", transcriptId: "ENST00000647020.1" }], hbb())).toEqual([["prerequisite", `ENST00000647020.1: ${NON_MANE_REASON}`]]);
    expect(issues([{ type: "selectTranscript", transcriptId: "ENST00000999999.1" }], hbb())[0]?.[0]).toBe("ungrounded-id");
  });
  it("setRepresentation: Protein World on screen with a structure", () => {
    expect(issues([{ type: "setRepresentation", representation: "surface" }], hbb("protein", { loadedStructureId: "2HBS" }))).toEqual([]);
    expect(issues([{ type: "setRepresentation", representation: "surface" }], hbb("dna", { loadedStructureId: "2HBS" }))[0]?.[1]).toMatch(/Protein World; DNA World is on screen/);
    expect(issues([{ type: "setRepresentation", representation: "surface" }], hbb("protein"))[0]?.[1]).toMatch(/no structure is loaded/);
    expect(validatePlan(plan([{ type: "setRepresentation", representation: "wireframe" } as never]), hbb("protein", { loadedStructureId: "2HBS" })).schemaValid).toBe(false);
  });
  it("showPathway: a membership of the record, Pathway World available", () => {
    expect(issues([{ type: "showPathway", stableId: "R-HSA-1247673" }], hbb())).toEqual([]);
    expect(issues([{ type: "showPathway" }], hbb())).toEqual([]);
    expect(issues([{ type: "showPathway", stableId: "R-HSA-70171" }], hbb())[0]?.[0]).toBe("ungrounded-id");
    const noWorld: PlanningContext = { ...hbb(), worlds: hbb().worlds.map((w) => (w.id === "pathway" ? { ...w, available: false, reason: "no Reactome pathway lists this protein" } : w)) };
    expect(issues([{ type: "showPathway" }], noWorld)).toEqual([["world-unavailable", "Pathway World is not available in this context (no Reactome pathway lists this protein)"]]);
  });
  it("beginTransition: dna to protein only, from DNA World, Protein World available; it brings the experimental structure for the actions after it", () => {
    const t = { type: "beginTransition", from: "dna", to: "protein" } as const;
    const f = { kind: "feature", featureId: "HbS_substitution" } as const;
    expect(issues([t, { type: "focusCamera", target: f }, { type: "highlightResidue", target: f }], hbb())).toEqual([]);
    expect(issues([{ type: "beginTransition", from: "protein", to: "dna" }], hbb("protein"))[0]?.[1]).toMatch(/the only transition is from DNA World to Protein World/);
    expect(issues([t], hbb("protein"))[0]?.[1]).toMatch(/starts in DNA World; protein World is on screen/);
    expect(issues([t], faah2())[0]?.[0]).toBe("world-unavailable");
  });
  it("showProteinDomains: a protein of the context with features of the explorer types; types read from the record", () => {
    expect(issues([{ type: "showProteinDomains", proteinAccession: "P68871" }], hbb())).toEqual([]);
    expect(issues([{ type: "showProteinDomains", proteinAccession: "P68871", featureTypes: ["Domain"] }], hbb())).toEqual([]);
    expect(issues([{ type: "showProteinDomains", proteinAccession: "P68871", featureTypes: ["Transmembrane"] }], hbb())[0]?.[1]).toBe("Helix's copy of the UniProt record of P68871 keeps Domain features only, so it has no feature of type Transmembrane (it has Domain)");
    expect(issues([{ type: "showProteinDomains", proteinAccession: "Q6GMR7" }], faah2())[0]?.[1]).toBe("Helix's copy of the UniProt record of Q6GMR7 keeps Domain features only and has none");
    // The Phase 3 form parses and is never executable.
    expect(issues([{ type: "showProteinDomains", proteinId: "P68871" }], hbb()).map((i) => i[0])).toEqual(["not-executable"]);
  });
  it("returnToOverview takes nothing", () => {
    expect(issues([{ type: "returnToOverview" }], hbb("protein"))).toEqual([]);
  });
  it("not executable in a Phase 9 build (the app's Phase 6 registry)", () => {
    const old: PlanningContext = { ...hbb(), executableActions: PHASE6 };
    for (const a of [{ type: "returnToOverview" }, { type: "showPathway" }] as Plan["actions"]) expect(issues([a], old)[0]?.[0]).toBe("not-executable");
  });
  it("a model plan under prompts v1 to v6 is held to the measured actions: a Phase 10 action is rejected and the rule-based planner answers", () => {
    expect(taughtActions(hbb())).toEqual(MEASURED_PROMPT_ACTIONS);
    const v = validatePlan(plan([{ type: "returnToOverview" }]), hbb(), { taughtActions: taughtActions(hbb()) });
    expect(v.ok).toBe(false);
    expect(v.issues.map((i) => [i.code, i.value])).toEqual([["not-executable", "returnToOverview"]]);
    expect(validatePlan(plan([{ type: "revealEvidence", evidenceId: "uniprot:P68871" }]), hbb(), { taughtActions: taughtActions(hbb()) }).ok).toBe(true);
  });
});

describe("rule-based planner, one rule per action, on HBB", () => {
  it("which transcript: selectTranscript of the MANE Select transcript", () => {
    const { rule, plan } = run("Which transcript is shown?", hbb());
    expect(rule).toBe("transcript");
    expect(plan.actions).toEqual([{ type: "selectTranscript", transcriptId: "ENST00000335295.4" }]);
    expect(plan.citations).toEqual(["ensembl:ENSG00000244734"]);
  });
  it("a non-MANE transcript is refused with the reason", () => {
    const { rule, plan } = run("Select transcript ENST00000647020", hbb());
    expect(rule).toBe("transcript-not-mane");
    expect(plan.outcome).toBe("unsupported");
    expect(plan.reason).toBe(`ENST00000647020.1 is not shown: ${NON_MANE_REASON} (the curated transcript is ENST00000335295.4, MANE Select).`);
  });
  it("show the domains: showProteinDomains with the record's evidence", () => {
    const { rule, plan } = run("Show the domains", hbb());
    expect(rule).toBe("protein-domains");
    expect(plan.actions).toEqual([{ type: "showProteinDomains", proteinAccession: "P68871" }, { type: "revealEvidence", evidenceId: "uniprot:P68871" }]);
    expect(run("Show the protein domains of beta-globin.", hbb("protein", { loadedStructureId: "2HBS" })).rule).toBe("protein-domains");
  });
  it("show the <name or stable id> pathway: showPathway of the membership", () => {
    expect(run("Show the heme signaling pathway", hbb()).plan.actions[0]).toEqual({ type: "showPathway", stableId: "R-HSA-9707616" });
    expect(run("Open R-HSA-1247673", hbb()).plan.actions[0]).toEqual({ type: "showPathway", stableId: "R-HSA-1247673" });
    expect(run("Show the opening pathway", hbb()).plan.actions[0]).toEqual({ type: "showPathway", stableId: "R-HSA-9615710" });
  });
  it("a pathway with no matching membership is refused with the record's list", () => {
    const { rule, plan } = run("Show the glycolysis pathway", hbb());
    expect(rule).toBe("pathway-no-membership");
    expect(plan.reason).toBe('No Reactome membership of P68871 matches "glycolysis"; the record lists 10 memberships: R-HSA-983231, R-HSA-1237044, R-HSA-1247673, R-HSA-2168880, R-HSA-6798695, R-HSA-9613829, R-HSA-9615710, R-HSA-9707564, R-HSA-9707616, R-HSA-9927020.');
  });
  it("the Phase 9 pathway questions keep their rule", () => {
    expect(run("Which pathways list HBB?", hbb()).rule).toBe("pathway-world");
    expect(run("Show me the HBB pathway", hbb()).rule).toBe("pathway-world");
  });
  it("show it as a surface / ball and stick: setRepresentation in Protein World", () => {
    const pw = hbb("protein", { loadedStructureId: "2HBS" });
    expect(run("Show it as a surface", pw).plan.actions).toEqual([{ type: "setRepresentation", representation: "surface" }]);
    expect(run("Show it as ball and stick", pw).plan.actions).toEqual([{ type: "setRepresentation", representation: "ball-and-stick" }]);
    expect(run("Draw it in spacefill", pw).plan.actions).toEqual([{ type: "setRepresentation", representation: "spacefill" }]);
    expect(run("Back to cartoon view", pw).plan.actions).toEqual([{ type: "setRepresentation", representation: "cartoon" }]);
  });
  it("a representation outside the list, and setRepresentation in DNA World, are refused", () => {
    const pw = hbb("protein", { loadedStructureId: "2HBS" });
    const w = run("Show it as a wireframe", pw);
    expect(w.rule).toBe("representation-unknown");
    expect(w.plan.reason).toBe('"wireframe" is not one of the representations Helix draws; the closed list is cartoon, ball-and-stick, surface, spacefill.');
    const d = run("Show it as a surface", hbb("dna", { loadedStructureId: "2HBS" }));
    expect(d.rule).toBe("representation-not-in-protein");
    expect(d.plan.reason).toMatch(/^The representation applies to the structure in Protein World; DNA World is on screen/);
  });
  it("take me from the DNA to the protein: beginTransition then the variant residue", () => {
    const { rule, types } = run("Take me from the DNA to the protein", hbb());
    expect(rule).toBe("transition");
    expect(types).toEqual(["beginTransition", "focusCamera", "highlightResidue", "revealEvidence"]);
    expect(run("Take me from the DNA to the protein", hbb("dna", { answer: "first" })).rule).toBe("transition");
    expect(run("Take me from the protein to the DNA", hbb("protein")).rule).toBe("transition-unavailable");
  });
  it("back to the overview: returnToOverview in any world", () => {
    for (const w of ["dna", "protein", "pathway"] as const) expect(run("Back to the overview", hbb(w)).plan.actions).toEqual([{ type: "returnToOverview" }]);
  });
});

describe("rule-based planner on FAAH2: the refusals with the records' reasons", () => {
  it("no domain in the record", () => {
    const { rule, plan } = run("Show the domains", faah2());
    expect(rule).toBe("domains-none");
    expect(plan.reason).toBe("Helix's copy of the UniProt record of Q6GMR7 (FAAH2) keeps Domain features only, not Region, Topological domain, Transmembrane or Zinc finger, and it has no Domain feature, so there is no domain to show.");
  });
  it("beginTransition names the transition and the reason Protein World is unavailable", () => {
    const { rule, plan } = run("Take me from the DNA to the protein", faah2());
    expect(rule).toBe("transition-no-protein-world");
    expect(plan.reason).toBe("The only transition is from DNA World to Protein World (the bridge sequence, codon to residue through the records), and Protein World is not available for FAAH2: no experimental structure is cross-referenced for this protein.");
  });
  it("setRepresentation: no structure can be drawn", () => {
    expect(run("Show it as a surface", faah2()).rule).toBe("representation-no-structure");
  });
  it("which transcript, the opening pathway and the overview are planned", () => {
    expect(run("Which transcript?", faah2()).plan.actions).toEqual([{ type: "selectTranscript", transcriptId: "ENST00000374900.5" }]);
    expect(run("Show the arachidonate metabolism pathway", faah2()).plan.actions[0]).toEqual({ type: "showPathway", stableId: "R-HSA-2142753" });
    expect(run("Back to the overview", faah2()).plan.actions).toEqual([{ type: "returnToOverview" }]);
  });
});

describe("contexts without the Phase 10 actions plan as before", () => {
  it("the Phase 3 domains refusal and the gene rule", () => {
    const ctx = withSession(hbbContext(), {});
    expect(deterministicPlan("Show the protein domains of beta-globin.", ctx).rule).toBe("domains");
    expect(deterministicPlan("Show the protein domains of beta-globin.", ctx).plan.outcome).toBe("unsupported");
    expect(deterministicPlan("Back to the overview", ctx).rule).toBe("no-rule");
    expect(REPO_ROOT).toBeTruthy();
  });
});
