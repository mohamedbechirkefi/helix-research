// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Follow-up suggestion filter (author decision D-H007, 2026-11-02: "model follow-up suggestions
 * are filtered"). A plan may carry up to three suggested next questions (`followUps`). Before any
 * of them reaches a user they pass this filter, whichever planner wrote them (a model or the
 * deterministic fallback). The filter is deterministic code; it never asks a model.
 *
 * A suggestion is kept only if every check passes, in this order:
 *
 *   1. format       one short line of plain English text (no URL, markup or code characters);
 *   2. clinical     no clinical, diagnostic, treatment, risk or personal-health intent
 *                   (blocklist; master prompt §14: Helix is nonclinical);
 *   3. scope        no topic that no curated record here can answer (protein function,
 *                   mechanism, effects and consequences, other variants, populations, the
 *                   wild type or a predicted model, structure metadata...) (blocklist);
 *   4. grounded     no identifier or gene symbol outside the trusted context;
 *   5. capability   the app's own rule-based planner, given the suggestion in the context the
 *                   user will be in after the plan, answers it with a valid, executable plan
 *                   through one of the rules in CAPABILITY_RULES (allowlist).
 *
 * The allowlist is the main gate: a suggestion that is not one of the things this build can
 * show is dropped even when it is harmless. The blocklists exist because the rule-based planner
 * matches keywords and would, for example, answer "What are the clinical implications of this
 * variant?" by locating the variant. When nothing passes, nothing is shown.
 */
import type { Plan } from "./schema.ts";
import { extractIdTokens, validatePlan } from "./validate.ts";
import { selectionFeature, trustedContextJson, withSession, type PlanningContext } from "./context.ts";
import { deterministicPlan } from "./fallback.ts";
import { planWorlds } from "./worlds.ts";

export const FOLLOWUP_FILTER_VERSION = "helix-followup-filter-v1";

export type FollowUpDropReason = "format" | "clinical" | "scope" | "ungrounded" | "capability" | "duplicate";

export interface FollowUpVerdict {
  text: string;
  kept: boolean;
  reason: FollowUpDropReason | null;
  /** What matched (the blocked term, the foreign token, or the planner rule and outcome). */
  detail: string | null;
}

export interface FollowUpScreen {
  version: string;
  kept: string[];
  verdicts: FollowUpVerdict[];
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .toLowerCase();

/**
 * Clinical, diagnostic, treatment, risk and personal-health intent. Matched on folded text with
 * word boundaries. Disease names are included: Helix shows molecules and records, and a
 * suggestion about a disease invites a clinical reading.
 */
export const CLINICAL_TERMS: RegExp =
  /\b(clinic\w*|medic\w*|disease\w*|disorder\w*|syndrome\w*|illness\w*|(hemo|haemo)globinopath\w*|individuals?|people|persons?|an(a)?emi\w*|symptom\w*|diagnos\w*|prognos\w*|treat\w*|therap\w*|cure\w*|curing|drug\w*|dose\w*|dosage\w*|hydroxyurea|transfusion\w*|transplant\w*|patient\w*|health\w*|doctor\w*|physician\w*|hospital\w*|counsel\w*|risk\w*|carrier\w*|trait\w*|screen\w*|tests?|testing|tested|pregnan\w*|prenatal|newborn\w*|life expectancy|mortality|surviv\w*|prevalen\w*|incidence|pain\w*|crisis|crises|implication\w*|pathophysiolog\w*|phenotyp\w*|inherit\w*|heredit\w*|pathogenic\w*|benign|classif\w*|harmful|dangerous|safe|safety|outcome\w*|(should|could|would|will|can|do|am) i|i (have|carry|am)|my|mine|personal|child\w*|baby|babies|son|daughter|famil\w*|parent\w*|relatives?|homozyg\w*|heterozyg\w*|zygosity|genotyp\w*|clinique\w*|maladie\w*|traitement\w*|symptome\w*|diagnostic\w*|medecin\w*|porteu\w*|patient\w*|sante|risque\w*|signification)\b/;

/** Topics that no curated record in this build answers, even though they sound scientific. */
export const OUT_OF_SCOPE_TERMS: RegExp =
  /\b(function\w*|mechanism\w*|stabilit\w*|stable|fold\w*|misfold\w*|polymer\w*|aggregat\w*|fiber\w*|fibre\w*|oxygen|affinity|binding|effects?|impacts?|consequen\w*|causes?|caused|causing|lead to|leads to|alter\w*|differ\w*|lost|loss|gain\w*|evolution\w*|evolv\w*|selection pressure|population\w*|frequen\w*|malaria|histor\w*|ancestr\w*|wild[- ]?type|normal (hemo|haemo)globin|quaternary|dynamic\w*|simulat\w*|significance|importance of|affect\w*|do(es)? to|shape|structural chang\w*|occur\w*|explain\w*|other|others|another|else|associated|known|normal|numbering|predict\w*|alphafold|tetramer\w*|biological|assembl\w*|interface\w*|subunits?|publication|published|date|resolution|citation\w*|author\w*|journal\w*|electron density|density|variants|hb(a|a2|c|e|f)|related|pathways?|basis|alignment\w*|distances?|forms?|oxy|without|between|details?|provide|compar\w*|specific|instead|interested|referring|in mind|being discussed|the user|ask if|(would|do|are|did) you|you(r|'re|'d| want| need| like| have| mean)?)\b/;

/** Rules of the deterministic planner that correspond to something this app can show. */
export const CAPABILITY_RULES: ReadonlySet<string> = new Set([
  "variant-locate", // where the curated variant is, on the experimental structure
  "contact", // what the curated variant residue touches (curated contacts record)
  "variant-evidence", // the curated records behind the variant
  "variant-sequence", // the DNA-level change, on the sequence next to the reference
  "variant-sequence-current-world", // the same scene, for a variant question that names no world, asked in DNA World (D-H008)
  "compare-sequence", // the variant compared with the reference sequence
  "compare-selection-sequence", // the selected variant residue compared with the reference
  "selection-explain", // the selected residue, with its curated evidence
  "selection-contact", // what the selected variant residue touches
  "selection-evidence", // the records behind the selected residue
  "experimental-structure", // the curated experimental structure
  "protein-world", // Protein World
]);

const FORMAT_BAD = /(https?:|www\.|[<>{}`\\|]|\n|\r)/i;
/** The interface is in English; a suggestion in another language is not shown (French is the one models produced). */
const NOT_ENGLISH = /\b(est|les|des|cette|quels?|quelles?|comment|peux|une|sont|dans|avec|pour|structurales?)\b/;
/** "Show me where the mutation affects hemoglobin" asks for a place, not an effect: the one use of "affect" that is kept. */
const WHERE_AFFECTS = /\bwhere\b([^?.]*?)\baffects?\b/g;
/** A comparison with the reference sequence is a capability (blueprint B); any other comparison is not. */
const COMPARE_REFERENCE = /\bcompar\w*\b([^?.]*?)\breference sequence\b/g;
/** "Can you show ..." is the user's own phrasing; "Would you like ..." is the planner talking to the user. */
const CAN_YOU = /^(can|could) you\b/;

/**
 * The context the user will be in once the plan has run, for suggestions that refer to "this
 * residue". A highlighted residue feature becomes the selection, on the chain the scene-engine
 * resolver focuses (the chain of the curated contact's source residue, else the feature's first
 * chain). Anything else leaves the context as it was.
 */
export function contextAfterPlan(plan: Plan, ctx: PlanningContext): PlanningContext {
  if (plan.outcome !== "plan") return ctx;
  // D-H008 contexts (routeByCues): once the plan has run, a suggestion is asked as a follow-up, in
  // the world the plan ended in, so the cue routing of the rule-based planner reads the right world.
  if (ctx.routeByCues) {
    const worlds = planWorlds(plan);
    const world = worlds.at(-1) ?? ctx.currentWorld;
    ctx = withSession(ctx, { ...(ctx.answer !== undefined ? { answer: "follow-up" as const } : {}), ...(world !== undefined ? { currentWorld: world } : {}) });
  }
  const hl = [...plan.actions].reverse().find((a) => a.type === "highlightResidue");
  if (!hl || hl.type !== "highlightResidue" || hl.target.kind !== "feature") return ctx;
  const featureId = hl.target.featureId;
  const f = ctx.features.find((x) => x.id === featureId);
  if (!f || f.kind !== "residue" || f.authSeqId === null || f.chains.length === 0) return ctx;
  const contact = ctx.features.find((x) => x.kind === "contact" && x.structureId === f.structureId && f.chains.includes(x.chains[0] ?? ""));
  const chainId = contact?.chains[0] ?? f.chains[0]!;
  // compId only appears in refusal text, which a kept suggestion never produces.
  const sel = { structureId: f.structureId, chainId, residueNumber: f.authSeqId, numbering: "auth" as const, compId: "UNK", featureId: selectionFeature(ctx, f.structureId, chainId, f.authSeqId) };
  return withSession(ctx, { selection: sel, loadedStructureId: f.structureId });
}

/** Screens one suggestion against a context (the one the user is in when it would be asked). */
export function screenFollowUp(text: string, ctx: PlanningContext): FollowUpVerdict {
  return screenText(text, ctx).verdict;
}

function screenText(text: string, ctx: PlanningContext): { verdict: FollowUpVerdict; plan: Plan | null } {
  const t = typeof text === "string" ? text.trim() : "";
  const drop = (reason: FollowUpDropReason, detail: string | null) => ({ verdict: { text: t, kept: false, reason, detail }, plan: null });
  if (t.length < 8 || t.length > 160 || FORMAT_BAD.test(t)) return drop("format", t.length === 0 ? "empty" : t.length > 160 ? "too long" : t.length < 8 ? "too short" : "markup, URL or line break");
  const q = fold(t);
  const clinical = q.match(CLINICAL_TERMS);
  if (clinical) return drop("clinical", clinical[0]);
  if (NOT_ENGLISH.test(q)) return drop("format", "not English");
  const scope = q.replace(CAN_YOU, "please").replace(WHERE_AFFECTS, "where$1is in").replace(COMPARE_REFERENCE, "show$1reference sequence").match(OUT_OF_SCOPE_TERMS);
  if (scope) return drop("scope", scope[0]);
  const trusted = trustedContextJson(ctx).toLowerCase();
  const foreignId = extractIdTokens(t).find((x) => !trusted.includes(x.token.toLowerCase()));
  if (foreignId) return drop("ungrounded", `${foreignId.kind} ${foreignId.token}`);
  const { plan, rule } = deterministicPlan(t, ctx);
  if (rule.startsWith("foreign-")) return drop("ungrounded", rule);
  if (plan.outcome !== "plan" || !CAPABILITY_RULES.has(rule)) return drop("capability", `${rule} (${plan.outcome})`);
  const v = validatePlan(plan, ctx, { query: t });
  if (!v.ok) return drop("capability", `${rule}: ${v.issues.map((i) => i.code).join(", ")}`);
  return { verdict: { text: t, kept: true, reason: null, detail: rule }, plan };
}

/**
 * Screens a list of suggestions; keeps at most `max`, in their order, without duplicates. Two
 * suggestions are duplicates when their words match or when they would produce the same scene
 * (the same rule-based plan): one question per scene is offered.
 */
export function filterFollowUps(texts: readonly string[], ctx: PlanningContext, max = 3): FollowUpScreen {
  const seen = new Set<string>();
  const verdicts: FollowUpVerdict[] = [];
  const kept: string[] = [];
  for (const raw of texts) {
    const { verdict: v, plan } = screenText(raw, ctx);
    if (v.kept) {
      const words = fold(v.text).replace(/[^a-z0-9]+/g, " ").trim();
      const scene = JSON.stringify([plan?.intent, plan?.actions]);
      if (seen.has(words) || seen.has(scene)) {
        verdicts.push({ ...v, kept: false, reason: "duplicate", detail: seen.has(words) ? "same words" : "same scene" });
        continue;
      }
      seen.add(words);
      seen.add(scene);
      if (kept.length >= max) {
        verdicts.push({ ...v, kept: false, reason: "capability", detail: `more than ${max} suggestions` });
        continue;
      }
      kept.push(v.text);
    }
    verdicts.push(v);
  }
  return { version: FOLLOWUP_FILTER_VERSION, kept, verdicts };
}

/** The plan with its follow-ups screened in the context after the plan; also returns the verdicts. */
export function screenPlanFollowUps(plan: Plan, ctx: PlanningContext): { plan: Plan; screen: FollowUpScreen } {
  const screen = filterFollowUps(plan.followUps, contextAfterPlan(plan, ctx));
  return { plan: { ...plan, followUps: screen.kept }, screen };
}
