// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Author decision D-H024 answer 70 (2026-11-04): prompt v8 is v7 plus the association rows of the
 * disease-associations record (when it is in the context) and the pathway list marking which memberships
 * can be opened (answer 71). It keeps v7's taught actions and the v3 decoding schema (no new schema).
 * v1 to v7 and their schemas are pinned unchanged by their own tests (prompt-dh011, phase10, prompt-v7);
 * here v8's rules and its system message for the HBB app context are pinned by sha256, and v8 is chosen
 * only on request. Test wordings are new (not benchmark wordings).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ASSOCIATIONS_NOTE_V8,
  PHASE10_ACTIONS,
  PROMPT_VERSION_V7,
  PROMPT_VERSION_V8,
  RULES_V7,
  RULES_V8,
  RULE18_V8,
  SHOW_PATHWAY_LINE_V7,
  SHOW_PATHWAY_LINE_V8,
  V7_TAUGHT_ACTIONS,
  buildHbbContext,
  buildMessages,
  decodingSchemaVersion,
  planJsonSchema,
  promptVersion,
  schemaFor,
  taughtActions,
  validatePlan,
  withContextualRecords,
  withExplorerRecords,
  type HbbBundle,
  type Plan,
  type PlanningContext,
} from "../src/index.ts";
import { REPO_ROOT, hbbBundleWithPathways } from "./load.ts";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const PHASE6 = ["resolveGene", "resolveVariant", "loadStructure", "enterWorld", "focusCamera", "highlightResidue", "revealEvidence", "cancelActions", "compareVariants", "highlightSequenceRegion"];
const b = hbbBundleWithPathways();
const withAssoc: HbbBundle = { ...b, associations: JSON.parse(readFileSync(join(REPO_ROOT, "data", "curated", "hbb", "associations.json"), "utf8")) as unknown };
const app = (bundle: HbbBundle, extra: Partial<PlanningContext> = {}): PlanningContext => ({
  ...withContextualRecords(withExplorerRecords(buildHbbContext(bundle), bundle), bundle),
  executableActions: [...PHASE6, ...PHASE10_ACTIONS],
  routeByCues: true,
  cueRules: "dh010",
  answer: "first",
  currentWorld: "dna",
  ...extra,
});
const trusted = (m: { content: string }) => JSON.parse(m.content.split("TRUSTED CONTEXT:\n")[1]!) as Record<string, unknown>;
const plan = (actions: Plan["actions"], extra: Partial<Plan> = {}): Plan => ({ outcome: "plan", intent: "other", entities: { geneId: null, proteinId: null, variantId: null, structureId: null }, actions, explanationLevel: "intermediate", citations: [], followUps: [], reason: null, ...extra });

describe("prompt v8 is chosen only on request", () => {
  it("planPrompt v8 selects v8 with v7's taught actions and the v3 schema; v7 and the default are unchanged", () => {
    const v8 = app(b, { planPrompt: "v8" });
    expect(PROMPT_VERSION_V8).toBe("helix-plan-prompt-v8");
    expect(promptVersion(v8)).toBe(PROMPT_VERSION_V8);
    expect(taughtActions(v8)).toEqual(V7_TAUGHT_ACTIONS);
    expect(decodingSchemaVersion(v8)).toBe("v3");
    expect(schemaFor({ query: "x", context: v8, requestId: "1" })).toEqual(planJsonSchema("v3"));
    expect(promptVersion(app(b, { planPrompt: "v7" }))).toBe(PROMPT_VERSION_V7);
    expect(promptVersion(app(b))).toBe("helix-plan-prompt-v5");
  });
});

describe("prompt v8: the rules", () => {
  it("v8 is v7 with the showPathway line and rule 15's id sentence replaced and rule 18 after rule 17; every other v7 line is kept", () => {
    const a = RULES_V7.split("\n");
    const v = RULES_V8.split("\n");
    const removed = a.filter((l) => !v.includes(l));
    expect(removed).toHaveLength(2);
    expect(removed[0]!.startsWith("15. ")).toBe(true);
    expect(removed[1]).toBe(SHOW_PATHWAY_LINE_V7);
    const added = v.filter((l) => !a.includes(l));
    expect(added).toHaveLength(3);
    expect(added[0]).toBe(removed[0]!.replace("the stable ids of pathways.", "the stable ids of pathways (for showPathway, only those whose openable is true)."));
    expect(added[1]).toBe(RULE18_V8);
    expect(added[2]).toBe(SHOW_PATHWAY_LINE_V8);
    expect(v.indexOf(RULE18_V8)).toBe(v.findIndex((l) => l.startsWith("17. ")) + 1);
    // The action list follows the rules, so rule 18 shifts the showPathway line by one.
    expect(v.indexOf(SHOW_PATHWAY_LINE_V8)).toBe(a.indexOf(SHOW_PATHWAY_LINE_V7) + 1);
    expect(RULE18_V8).toMatch(/never say that the gene or a variant causes/);
  });
  it("v8's rules are pinned", () => {
    expect(sha(RULES_V8)).toBe("9f27640400c263f3db59ad60d94ae21dc79bc294b9ed272e50d3696a84df44f8");
  });
});

describe("prompt v8: the messages", () => {
  it("the HBB first-answer context sends exactly these messages (system message pinned; the user message is v7's)", () => {
    const q = "Draw the hemoglobin molecule as a surface, please.";
    const m = buildMessages(q, app(b, { planPrompt: "v8" }));
    expect(m).toHaveLength(2);
    expect(m[0]!.content.startsWith(`${RULES_V8}\n\nTRUSTED CONTEXT:\n`)).toBe(true);
    expect(sha(m[0]!.content)).toBe("11a37404b99df1be87f7bf94f16d67474de803a30d566291b91d8317bfb3d2cd");
    expect(m[1]!.content).toBe(buildMessages(q, app(b, { planPrompt: "v7" }))[1]!.content);
    const t = trusted(m[0]!);
    const pathways = t.pathways as { stableId: string; openable: boolean; isOpening: boolean }[];
    expect(pathways.filter((p) => !p.openable).map((p) => p.stableId)).toEqual(["R-HSA-2168880", "R-HSA-9927020"]);
    expect(pathways.find((p) => p.isOpening)?.openable).toBe(true);
    // No associations record in this context: no associations entry.
    expect("associations" in t).toBe(false);
  });
  it("with the associations record loaded, every kept row is rendered by name and score with the never-causal note; v7 renders none", () => {
    const ctx = app(withAssoc, { planPrompt: "v8" });
    const t = trusted(buildMessages("Which diseases is HBB associated with?", ctx)[0]!);
    const a = t.associations as { evidenceId: string; note: string; rows: { name: string; score: number }[] };
    expect(a.evidenceId).toBe("opentargets:ENSG00000244734");
    expect(a.note).toBe(ASSOCIATIONS_NOTE_V8);
    expect(a.rows).toHaveLength(ctx.associations!.length);
    expect(a.rows.length).toBe(25);
    expect(a.rows[0]).toEqual({ name: "beta thalassemia", score: 0.842 });
    expect(a.rows.map((r) => r.name)).toEqual(ctx.associations!.map((x) => x.name));
    expect(JSON.stringify(a.rows)).not.toMatch(/MONDO_|EFO_|Orphanet_/);
    expect("associations" in trusted(buildMessages("Which diseases is HBB associated with?", app(withAssoc, { planPrompt: "v7" }))[0]!)).toBe(false);
  });
  it("a v8 model plan answering from the associations validates; showPathway on a non-openable membership does not", () => {
    const ctx = app(withAssoc, { planPrompt: "v8", answer: "follow-up" });
    const ok = plan([{ type: "revealEvidence", evidenceId: "opentargets:ENSG00000244734" }], { citations: ["opentargets:ENSG00000244734"], reason: "Open Targets associates HBB with beta thalassemia (score 0.842) and sickle cell disease (score 0.813); association, never causal." });
    expect(validatePlan(ok, ctx, { taughtActions: taughtActions(ctx) }).issues).toEqual([]);
    expect(validatePlan(plan([{ type: "showPathway", stableId: "R-HSA-2168880" }]), ctx, { taughtActions: taughtActions(ctx) }).issues[0]?.code).toBe("pathway-not-openable");
  });
});
