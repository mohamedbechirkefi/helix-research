// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * The held-out run's harness (phase10-heldout-lib.ts) against the helix-app code it imports. The app checkout is a
 * sibling of this repository (HELIX_APP_DIR overrides); without it the app comparisons are skipped.
 * - the loaded-structure rules of phase10-lib.ts (the Phase 10 run's fallback, and D-H024 answer 74 as the app has it);
 * - the research re-statements (restrictToBuild, the bridge lookups, the unit context, retrievedEchoes) against the
 *   app's functions on every held-out unit. The one known disagreement (the bridge's residue for a codon whose
 *   mapping of record has a feature: the app selects the resolver's focus residue, the re-statement the first mapped
 *   residue) is pinned by name.
 */
import { describe, expect, it } from "vitest";
import { deterministicPlan, type Plan } from "@helix/ai-planning";
import { DATASETS, PHASE10_HELDOUT_DIR, loadSet, loadUnits, loadedStructureFor, unitContext } from "../phase10-lib.ts";
import { retrievedEchoes } from "../phase10-score.ts";
import { appAvailable, appSet, deterministicRegistry, directorInputs, loadApp, messagesHash, restrictToBuildAgrees } from "../phase10-heldout-lib.ts";

describe("loaded-structure rule", () => {
  const sel = { structureId: "2HBS" };
  it("phase10-fallback: null falls back to the selection's structure (the Phase 10 run)", () => {
    expect(loadedStructureFor({ loadedStructureId: null }, sel, "phase10-fallback")).toBe("2HBS");
    expect(loadedStructureFor({ loadedStructureId: "5UAK" }, sel, "phase10-fallback")).toBe("5UAK");
  });
  it("app-dh024: null is taken at its word; only an absent value falls back", () => {
    expect(loadedStructureFor({ loadedStructureId: null }, sel, "app-dh024")).toBeNull();
    expect(loadedStructureFor({}, sel, "app-dh024")).toBe("2HBS");
    expect(loadedStructureFor({}, null, "app-dh024")).toBeNull();
    expect(loadedStructureFor({ loadedStructureId: "5UAK" }, sel, "app-dh024")).toBe("5UAK");
  });
});

describe.skipIf(!appAvailable())("held-out harness against the helix-app code", async () => {
  const app = appAvailable() ? await loadApp() : null;
  const units = loadUnits(PHASE10_HELDOUT_DIR);

  it("restrictToBuild: the re-statement equals the app's function on every set", () => {
    for (const d of DATASETS) expect(restrictToBuildAgrees(app!, loadSet(d, { planPrompt: "v8" })), d).toBe(true);
  });

  it("the unit context and the bridge: the re-statement equals the app Director's context except the pinned unit", async () => {
    const sets = new Map(DATASETS.map((d) => [d, appSet(app!, loadSet(d, { planPrompt: "v8" }))]));
    const bridgeDiffers: string[] = [];
    const contextDiffers: string[] = [];
    for (const u of units) {
      const a = sets.get(u.dataset)!;
      const inp = directorInputs(a, u);
      if (!inp.selection.restatedAgrees) bridgeDiffers.push(u.id);
      const res = await new app!.Director(deterministicRegistry(), inp.base, { policy: "split", claimFacts: a.claimFacts }).handle(u.query, inp.session, { temperature: 0 });
      const restated = unitContext(a.set, u, { loadedStructure: "app-dh024" }).ctx;
      if (messagesHash(u.query, restated) !== messagesHash(u.query, res.context)) contextDiffers.push(u.id);
    }
    // HBB codon 7: the app selects 2HBS chain H residue 6 (the resolver's focus on the variant feature), the re-statement chain B.
    expect(bridgeDiffers).toEqual(["P10H-INJ-06"]);
    expect(contextDiffers).toEqual(["P10H-INJ-06"]);
  });

  it("the D-H024 answer 74 rule: a codon selected in DNA World names no structure as loaded", async () => {
    const a = appSet(app!, loadSet("brca1", { planPrompt: "v8" }));
    const u = units.find((x) => x.id === "P10H-BRCA1-06")!;
    const inp = directorInputs(a, u);
    expect(inp.session.selection?.structureId).toBe("1JM7");
    const res = await new app!.Director(deterministicRegistry(), inp.base, { policy: "split", claimFacts: a.claimFacts }).handle(u.query, inp.session, { temperature: 0 });
    expect(res.context.loadedStructureId ?? null).toBeNull();
    expect(unitContext(a.set, u, { loadedStructure: "phase10-fallback" }).ctx.loadedStructureId).toBe("1JM7");
  });

  it("retrievedEchoes: the scorer's re-statement equals the app's on every injection unit", () => {
    const sets = new Map(DATASETS.map((d) => [d, appSet(app!, loadSet(d, { planPrompt: "v8" }))]));
    for (const u of units.filter((x) => x.retrieved.length > 0)) {
      const a = sets.get(u.dataset)!;
      const ctx = unitContext(a.set, u, { loadedStructure: "app-dh024" }).ctx;
      const base = deterministicPlan(u.query, ctx).plan;
      const plans: Plan[] = [base, { ...base, reason: `As the record says: ${u.retrieved[0]!.text}` }, { ...base, followUps: [u.retrieved[0]!.text.slice(0, 80)] }];
      for (const p of plans) expect(retrievedEchoes(p, ctx, u.query), u.id).toEqual(app!.retrievedEchoes(p, ctx, u.query));
    }
  });

  it("every held-out unit gets a split route, and the injection units never reach the model", async () => {
    const sets = new Map(DATASETS.map((d) => [d, appSet(app!, loadSet(d, { planPrompt: "v8" }))]));
    for (const u of units) {
      const a = sets.get(u.dataset)!;
      const inp = directorInputs(a, u);
      const res = await new app!.Director(deterministicRegistry(), inp.base, { policy: "split", claimFacts: a.claimFacts }).handle(u.query, inp.session, { temperature: 0 });
      const route = app!.splitRoute(deterministicPlan(u.query, res.context), res.context);
      expect(["retrieved-text", "safety-refusal", "clarification", "no-rule", "explorer-rule", "follow-up", "matched-rule"]).toContain(route.branch);
      if (u.retrieved.length > 0) expect(route.branch, u.id).toBe("retrieved-text");
    }
  });
});
