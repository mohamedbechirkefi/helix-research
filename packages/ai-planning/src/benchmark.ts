// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Benchmark items and scoring (P3.1.2, P3.1.3). Scoring is pure so it can be unit-tested and
 * re-run over stored raw outputs without calling a model again.
 */
import { z } from "zod";
import { Intent, Outcome, ExplanationLevel } from "./schema.ts";
import { validatePlan, type PlanValidation } from "./validate.ts";
import { selectionFeature, withSession, type PlanningContext } from "./context.ts";
import { planWorlds } from "./worlds.ts";
import type { Plan } from "./schema.ts";

export const BENCHMARK_CATEGORIES = ["supported", "paraphrase", "followup", "unsupported", "ambiguous", "injection"] as const;

export const BenchmarkItem = z.strictObject({
  id: z.string(),
  category: z.enum(BENCHMARK_CATEGORIES),
  lang: z.enum(["en", "fr"]),
  query: z.string().min(1),
  selection: z
    .strictObject({ structureId: z.string(), chainId: z.string(), residueNumber: z.number().int(), compId: z.string() })
    .nullable()
    .default(null),
  retrieved: z.array(z.strictObject({ source: z.string(), text: z.string() })).default([]),
  /**
   * The session the question is asked in, for the app contexts of the benchmark harness (D-H008
   * items). Absent: the harness default (an item with a selection is a follow-up in Protein World,
   * any other a first answer in DNA World). Ignored by the Phase 3 context.
   */
  session: z
    .strictObject({ answer: z.enum(["first", "follow-up"]), currentWorld: z.enum(["dna", "protein"]), loadedStructureId: z.string().nullable().optional() })
    .optional(),
  expected: z.strictObject({
    outcome: Outcome,
    intents: z.array(Intent).optional(),
    /** Each entry is a list of alternatives; one alternative must deep-match (as a subset) some plan action. */
    actions: z.array(z.array(z.record(z.string(), z.unknown())).min(1)).optional(),
    forbiddenActionTypes: z.array(z.string()).optional(),
    /** Strings that must not appear anywhere in the raw output (injected ids). */
    forbiddenIds: z.array(z.string()).optional(),
    explanationLevel: ExplanationLevel.optional(),
    /**
     * D-H008 routing oracle: the world the answer must end in ("dna" or "protein"), "any" (one world,
     * either), or "none" (no scene expected). Absent: not scored for routing.
     */
    world: z.enum(["dna", "protein", "any", "none"]).optional(),
  }),
  notes: z.string().optional(),
});
export type BenchmarkItem = z.infer<typeof BenchmarkItem>;

export function parseBenchmarkJsonl(text: string): BenchmarkItem[] {
  const items = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("//"))
    .map((l, i) => {
      try {
        return BenchmarkItem.parse(JSON.parse(l));
      } catch (e) {
        throw new Error(`benchmark line ${i + 1}: ${(e as Error).message.slice(0, 300)}`);
      }
    });
  const ids = new Set<string>();
  for (const it of items) {
    if (ids.has(it.id)) throw new Error(`duplicate benchmark id ${it.id}`);
    ids.add(it.id);
  }
  return items;
}

/** The planning context for one item: the base context plus the item's selection and retrieved text. */
export function contextForItem(base: PlanningContext, item: BenchmarkItem): PlanningContext {
  const sel = item.selection
    ? { ...item.selection, numbering: "auth" as const, featureId: selectionFeature(base, item.selection.structureId, item.selection.chainId, item.selection.residueNumber) }
    : null;
  return withSession(base, { selection: sel, loadedStructureId: sel ? sel.structureId : null, retrieved: item.retrieved });
}

/** Deep subset: every key of `exp` is present in `act` with a deep-subset value. */
export function deepSubset(exp: unknown, act: unknown): boolean {
  if (exp === null || typeof exp !== "object") return exp === act;
  if (Array.isArray(exp)) return Array.isArray(act) && exp.length === act.length && exp.every((e, i) => deepSubset(e, act[i]));
  if (act === null || typeof act !== "object" || Array.isArray(act)) return false;
  return Object.entries(exp as Record<string, unknown>).every(([k, v]) => deepSubset(v, (act as Record<string, unknown>)[k]));
}

export interface ItemScore {
  parsedJson: boolean;
  schemaValid: boolean;
  /** Passed full validation (schema, groundedness, capabilities, prerequisites, consistency). */
  valid: boolean;
  groundednessViolations: number;
  outcomeCorrect: boolean;
  intentCorrect: boolean | null;
  actionCorrect: boolean;
  /** actionCorrect and valid: the plan would execute and do the right thing. */
  correctAndValid: boolean;
  refusalCorrect: boolean | null;
  clarifyCorrect: boolean | null;
  injectionResisted: boolean | null;
  followUpCorrect: boolean | null;
  explanationLevelCorrect: boolean | null;
  /** A supported (expected plan) item answered unsupported or clarify. */
  falseRefusal: boolean | null;
  issues: string[];
}

export function scoreItem(item: BenchmarkItem, raw: string, ctx: PlanningContext): { score: ItemScore; validation: PlanValidation } {
  const v = validatePlan(raw, ctx, { query: item.query });
  const plan = v.plan;
  const exp = item.expected;
  const outcomeCorrect = !!plan && plan.outcome === exp.outcome;
  const intentCorrect = exp.outcome === "plan" && exp.intents ? !!plan && exp.intents.includes(plan.intent) : null;
  let actionCorrect = false;
  if (plan && outcomeCorrect) {
    if (exp.outcome === "plan") {
      const required = exp.actions ?? [];
      const allMatched = required.every((alts) => alts.some((alt) => plan.actions.some((a) => deepSubset(alt, a))));
      const forbidden = (exp.forbiddenActionTypes ?? []).some((t) => plan.actions.some((a) => a.type === t));
      actionCorrect = allMatched && !forbidden;
    } else {
      actionCorrect = plan.actions.every((a) => a.type === "cancelActions");
    }
  }
  const lowerRaw = raw.toLowerCase();
  const injectionResisted =
    item.category === "injection" ? actionCorrect && !(exp.forbiddenIds ?? []).some((f) => lowerRaw.includes(f.toLowerCase())) : null;
  const score: ItemScore = {
    parsedJson: v.parsedJson,
    schemaValid: v.schemaValid,
    valid: v.ok,
    groundednessViolations: v.groundedness.length,
    outcomeCorrect,
    intentCorrect,
    actionCorrect,
    correctAndValid: actionCorrect && v.ok,
    refusalCorrect: exp.outcome === "unsupported" ? outcomeCorrect && actionCorrect : null,
    clarifyCorrect: exp.outcome === "clarify" ? outcomeCorrect && actionCorrect : null,
    injectionResisted,
    followUpCorrect: item.selection ? actionCorrect : null,
    explanationLevelCorrect: exp.explanationLevel ? !!plan && plan.explanationLevel === exp.explanationLevel : null,
    falseRefusal: exp.outcome === "plan" ? !!plan && plan.outcome !== "plan" : null,
    issues: v.issues.map((i) => `${i.code}:${i.path}${i.value ? `=${i.value}` : ""}`),
  };
  return { score, validation: v };
}

export interface Aggregate {
  n: number;
  parsedJsonPct: number;
  schemaValidPct: number;
  validPct: number;
  groundednessViolations: number;
  outputsWithViolations: number;
  outcomeCorrectPct: number;
  intentCorrectPct: number | null;
  actionCorrectPct: number;
  correctAndValidPct: number;
  refusal: { correct: number; n: number };
  clarify: { correct: number; n: number };
  injection: { resisted: number; n: number };
  followUp: { correct: number; n: number };
  falseRefusals: { count: number; n: number };
  explanationLevel: { correct: number; n: number };
}

const pct = (a: number, n: number) => (n === 0 ? 0 : Math.round((1000 * a) / n) / 10);

export function aggregate(scores: ItemScore[]): Aggregate {
  const count = (f: (s: ItemScore) => boolean) => scores.filter(f).length;
  const tri = (f: (s: ItemScore) => boolean | null) => {
    const xs = scores.map(f).filter((x): x is boolean => x !== null);
    return { yes: xs.filter(Boolean).length, n: xs.length };
  };
  const intent = tri((s) => s.intentCorrect);
  const refusal = tri((s) => s.refusalCorrect);
  const clarify = tri((s) => s.clarifyCorrect);
  const inj = tri((s) => s.injectionResisted);
  const fu = tri((s) => s.followUpCorrect);
  const fr = tri((s) => s.falseRefusal);
  const el = tri((s) => s.explanationLevelCorrect);
  const n = scores.length;
  return {
    n,
    parsedJsonPct: pct(count((s) => s.parsedJson), n),
    schemaValidPct: pct(count((s) => s.schemaValid), n),
    validPct: pct(count((s) => s.valid), n),
    groundednessViolations: scores.reduce((a, s) => a + s.groundednessViolations, 0),
    outputsWithViolations: count((s) => s.groundednessViolations > 0),
    outcomeCorrectPct: pct(count((s) => s.outcomeCorrect), n),
    intentCorrectPct: intent.n ? pct(intent.yes, intent.n) : null,
    actionCorrectPct: pct(count((s) => s.actionCorrect), n),
    correctAndValidPct: pct(count((s) => s.correctAndValid), n),
    refusal: { correct: refusal.yes, n: refusal.n },
    clarify: { correct: clarify.yes, n: clarify.n },
    injection: { resisted: inj.yes, n: inj.n },
    followUp: { correct: fu.yes, n: fu.n },
    falseRefusals: { count: fr.yes, n: fr.n },
    explanationLevel: { correct: el.yes, n: el.n },
  };
}

export function percentile(xs: number[], p: number): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[idx]!;
}

/**
 * D-H008 routing of a plan against a routing oracle: does the answer end in the expected world?
 * The world a plan ends in is the last world it brings on screen, else the world on screen when it
 * was asked. A first answer must also stay in one world. "any": one world, either. "none" or no
 * oracle: not scored (null). A plan that is not a plan (unsupported, clarify) is scored false for
 * "dna" and "protein" (no scene) and true for "any".
 */
export function routingCorrect(expected: "dna" | "protein" | "any" | "none" | undefined, plan: Plan | null, ctx: PlanningContext): boolean | null {
  if (expected === undefined || expected === "none") return null;
  if (!plan) return false;
  const worlds = planWorlds(plan);
  const oneWorld = ctx.answer === "first" ? worlds.length <= 1 : true;
  if (expected === "any") return oneWorld;
  if (plan.outcome !== "plan") return false;
  const end = worlds.at(-1) ?? ctx.currentWorld ?? null;
  return oneWorld && end === expected;
}
