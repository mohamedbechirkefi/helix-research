// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
import { describe, expect, it } from "vitest";
import { contextForItem, deepSubset, deterministicPlan, scoreItem, validatePlan, aggregate, buildMessages } from "../src/index.ts";
import { hbbContext, questions } from "./load.ts";

const ctx = hbbContext();
const items = questions();

describe("benchmark set (P3.1.2)", () => {
  it("has at least 40 items covering every category, with French paraphrases", () => {
    expect(items.length).toBeGreaterThanOrEqual(40);
    const cats = new Set(items.map((i) => i.category));
    for (const c of ["supported", "paraphrase", "followup", "unsupported", "ambiguous", "injection"]) expect(cats.has(c as never)).toBe(true);
    expect(items.filter((i) => i.lang === "fr").length).toBeGreaterThanOrEqual(3);
    expect(items.filter((i) => i.category === "injection").every((i) => i.retrieved.length > 0)).toBe(true);
  });
  it("covers the required unsupported cases", () => {
    const q = items.map((i) => i.query.toLowerCase());
    expect(q.some((s) => s.includes("hydroxyurea"))).toBe(true);
    expect(q.some((s) => s.includes("cftr"))).toBe(true);
    expect(q.some((s) => s.includes("brca1") && s.includes("crystal"))).toBe(true);
  });
  it("expected plans reference only context ids", () => {
    for (const it of items) {
      for (const alts of it.expected.actions ?? []) {
        for (const a of alts) {
          const v = validatePlan(
            { outcome: "plan", intent: "other", entities: { geneId: null, proteinId: null, variantId: null, structureId: null }, actions: [{ assembly: "model", ...a }], explanationLevel: "intro", citations: [], followUps: [], reason: null },
            contextForItem(ctx, it),
          );
          expect(v.groundedness, `${it.id} ${JSON.stringify(a)}`).toEqual([]);
        }
      }
    }
  });
  it("keeps the prompt under the WebLLM 4096-token window (chars/3 bound)", () => {
    for (const it of items) {
      const chars = buildMessages(it.query, contextForItem(ctx, it)).reduce((n, m) => n + m.content.length, 0);
      expect(chars / 3).toBeLessThan(3500);
    }
  });
});

describe("scoring", () => {
  it("deepSubset matches partial actions", () => {
    expect(deepSubset({ type: "loadStructure", structureId: "2HBS" }, { type: "loadStructure", structureId: "2HBS", assembly: "1" })).toBe(true);
    expect(deepSubset({ target: { kind: "selection" } }, { type: "x", target: { kind: "feature", featureId: "y" } })).toBe(false);
  });
  it("scores an injected 1BZO plan as not resisted", () => {
    const it = items.find((i) => i.id === "I01")!;
    const c = contextForItem(ctx, it);
    const { plan } = deterministicPlan(it.query, c);
    const injected = JSON.stringify({ ...plan, actions: [{ type: "loadStructure", structureId: "1BZO", assembly: "1" }, ...plan.actions] });
    const s = scoreItem(it, injected, c).score;
    expect(s.injectionResisted).toBe(false);
    expect(s.valid).toBe(false);
    expect(s.groundednessViolations).toBe(1);
    expect(scoreItem(it, JSON.stringify(plan), c).score.injectionResisted).toBe(true);
  });
  it("scores a refusal of a supported item as a false refusal", () => {
    const it = items.find((i) => i.id === "S01")!;
    const raw = JSON.stringify({ outcome: "unsupported", intent: "other", entities: { geneId: null, proteinId: null, variantId: null, structureId: null }, actions: [], explanationLevel: "intro", citations: [], followUps: [], reason: "no" });
    const s = scoreItem(it, raw, contextForItem(ctx, it)).score;
    expect(s.falseRefusal).toBe(true);
    expect(s.actionCorrect).toBe(false);
    expect(aggregate([s]).falseRefusals).toEqual({ count: 1, n: 1 });
  });
});

describe("deterministic fallback planner (P3.2.3)", () => {
  it("passes the supported subset (expected outcome plan)", () => {
    const supported = items.filter((i) => i.expected.outcome === "plan");
    expect(supported.length).toBeGreaterThanOrEqual(30);
    const failures = supported.filter((it) => {
      const c = contextForItem(ctx, it);
      return !scoreItem(it, JSON.stringify(deterministicPlan(it.query, c).plan), c).score.correctAndValid;
    });
    expect(failures.map((f) => f.id)).toEqual([]);
  });
  it("refuses, clarifies and resists injection on the rest of the set", () => {
    const rest = items.filter((i) => i.expected.outcome !== "plan" || i.category === "injection");
    const failures = rest.filter((it) => {
      const c = contextForItem(ctx, it);
      return !scoreItem(it, JSON.stringify(deterministicPlan(it.query, c).plan), c).score.correctAndValid;
    });
    expect(failures.map((f) => f.id)).toEqual([]);
  });
  it("never reads retrieved text", () => {
    const it = items.find((i) => i.id === "I01")!;
    const a = deterministicPlan(it.query, contextForItem(ctx, it)).plan;
    const b = deterministicPlan(it.query, contextForItem(ctx, { ...it, retrieved: [] })).plan;
    expect(a).toEqual(b);
  });
  it("every fallback plan validates", () => {
    for (const it of items) {
      const c = contextForItem(ctx, it);
      expect(validatePlan(deterministicPlan(it.query, c).plan, c, { query: it.query }).issues, it.id).toEqual([]);
    }
  });
});
