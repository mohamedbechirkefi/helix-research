// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * The AI plan schema (P3.1.1). LLM output is untrusted input (master prompt §6, §7.2): it is
 * parsed with these strict schemas (unknown fields and unknown action types are rejected),
 * then checked against the planning context by `validatePlan` (identifiers, capabilities,
 * prerequisites). Only a plan that passes both may reach the Scene Action Interpreter.
 *
 * The action vocabulary is the §7.2 subset needed for the HBB slice. `showProteinDomains`
 * and `compareVariants` are schema-only: they parse, but no build executes them yet, so
 * validation rejects them as not executable.
 */
import { z } from "zod";
import { WORLDS } from "./context.ts";

const Id = z.string().min(1).max(64);

export const SemanticTarget = z.discriminatedUnion("kind", [
  /** A feature defined in the planning context (e.g. HbS_substitution); deterministic code resolves chain and residue. */
  z.strictObject({ kind: z.literal("feature"), featureId: Id }),
  /** The residue the user has currently selected (context.selection). */
  z.strictObject({ kind: z.literal("selection") }),
]);
export type SemanticTarget = z.infer<typeof SemanticTarget>;

export const ASSEMBLY_CHOICE = z.string().min(1).max(16);

/**
 * A sequence region target (Phase 6, highlightSequenceRegion). Semantic only: deterministic code
 * resolves it to transcript coordinates from the curated records (the variant's codon, or the codon
 * that the full-chain mapping of record links to a structure residue). Never a raw position.
 */
export const SequenceTarget = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("variant"), variantId: Id }),
  z.strictObject({ kind: z.literal("feature"), featureId: Id }),
  z.strictObject({ kind: z.literal("selection") }),
]);
export type SequenceTarget = z.infer<typeof SequenceTarget>;

const V1_MEMBERS = [
  z.strictObject({ type: z.literal("resolveGene"), geneId: Id }),
  z.strictObject({ type: z.literal("resolveVariant"), variantId: Id }),
  /** assembly: "model" = the asymmetric unit, or a biological assembly id from the context. */
  z.strictObject({ type: z.literal("loadStructure"), structureId: Id, assembly: ASSEMBLY_CHOICE }),
  z.strictObject({ type: z.literal("enterWorld"), world: z.enum(WORLDS) }),
  z.strictObject({ type: z.literal("focusCamera"), target: SemanticTarget }),
  z.strictObject({ type: z.literal("highlightResidue"), target: SemanticTarget }),
  z.strictObject({ type: z.literal("revealEvidence"), evidenceId: Id }),
  z.strictObject({ type: z.literal("cancelActions") }),
  z.strictObject({ type: z.literal("showProteinDomains"), proteinId: Id }),
] as const;

/** The Phase 3 action union (v1), kept verbatim so the Phase 3 decoding schema stays byte-identical. */
export const ActionV1 = z.discriminatedUnion("type", [...V1_MEMBERS, z.strictObject({ type: z.literal("compareVariants"), variantIds: z.array(Id).min(2).max(4) })]);

/**
 * The action vocabulary (v2, Phase 6). compareVariants now compares each listed variant with the
 * reference sequence of its transcript, so one variant id suffices (a v1 plan with two ids still
 * parses). highlightSequenceRegion marks a region of the transcript sequence. Whether a build
 * executes an action is the context's `executableActions`, checked by validatePlan.
 */
export const Action = z.discriminatedUnion("type", [
  ...V1_MEMBERS,
  z.strictObject({ type: z.literal("compareVariants"), variantIds: z.array(Id).min(1).max(4) }),
  z.strictObject({ type: z.literal("highlightSequenceRegion"), target: SequenceTarget }),
]);
export type Action = z.infer<typeof Action>;
export const ACTION_TYPES = [
  "resolveGene",
  "resolveVariant",
  "loadStructure",
  "enterWorld",
  "focusCamera",
  "highlightResidue",
  "revealEvidence",
  "cancelActions",
  "showProteinDomains",
  "compareVariants",
  "highlightSequenceRegion",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];
/** Actions added in Phase 6. A context that lists one as executable gets the v2 prompt and decoding schema. */
export const V2_ONLY_ACTIONS = ["compareVariants", "highlightSequenceRegion"] as const;
export const usesV2 = (executableActions: readonly string[]): boolean => V2_ONLY_ACTIONS.some((a) => executableActions.includes(a));

export const INTENTS = [
  "locate_variant",
  "explain_selection",
  "show_gene",
  "show_protein",
  "show_structure",
  "explain_evidence",
  "compare_variants",
  "show_domains",
  "cancel",
  "other",
] as const;
export const Intent = z.enum(INTENTS);
export type Intent = z.infer<typeof Intent>;

export const Outcome = z.enum(["plan", "unsupported", "clarify"]);
export type Outcome = z.infer<typeof Outcome>;

export const ExplanationLevel = z.enum(["intro", "intermediate", "expert"]);

export const EntityRefs = z.strictObject({
  geneId: Id.nullable(),
  proteinId: Id.nullable(),
  variantId: Id.nullable(),
  structureId: Id.nullable(),
});

export const Plan = z.strictObject({
  outcome: Outcome,
  intent: Intent,
  entities: EntityRefs,
  actions: z.array(Action).max(8),
  explanationLevel: ExplanationLevel,
  /** Evidence ids from the context that support the explanation. */
  citations: z.array(Id).max(6),
  /** Suggested next questions, short. */
  followUps: z.array(z.string().max(160)).max(3),
  /** Required for unsupported and clarify: why, or what to clarify. */
  reason: z.string().max(400).nullable(),
});
export type Plan = z.infer<typeof Plan>;

/**
 * The JSON Schema given to constrained decoders (Ollama `format`, WebLLM `response_format`).
 * Generic: identifiers are free strings, so the benchmark measures whether a model invents them.
 * "v1" (default) is the Phase 3 schema, byte-identical; "v2" adds the Phase 6 actions.
 */
export function planJsonSchema(version: "v1" | "v2" = "v1"): Record<string, unknown> {
  const schema = version === "v1" ? Plan.extend({ actions: z.array(ActionV1).max(8) }) : Plan;
  const s = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  delete s.$schema;
  return s;
}

/**
 * A context-bound JSON Schema: identifier fields are enums of the context's ids, so a
 * constrained decoder cannot emit an identifier outside the context. Validation still runs.
 */
export function groundedPlanJsonSchema(ids: {
  genes: string[];
  proteins: string[];
  variants: string[];
  structures: string[];
  assemblies: string[];
  features: string[];
  evidence: string[];
}, version: "v1" | "v2" = "v1"): Record<string, unknown> {
  const e = (xs: string[]) => (xs.length > 0 ? z.enum(xs as [string, ...string[]]) : z.never());
  const target = z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("feature"), featureId: e(ids.features) }),
    z.strictObject({ kind: z.literal("selection") }),
  ]);
  const base = [
    z.strictObject({ type: z.literal("resolveGene"), geneId: e(ids.genes) }),
    z.strictObject({ type: z.literal("resolveVariant"), variantId: e(ids.variants) }),
    z.strictObject({ type: z.literal("loadStructure"), structureId: e(ids.structures), assembly: e(ids.assemblies) }),
    z.strictObject({ type: z.literal("enterWorld"), world: z.enum(WORLDS) }),
    z.strictObject({ type: z.literal("focusCamera"), target }),
    z.strictObject({ type: z.literal("highlightResidue"), target }),
    z.strictObject({ type: z.literal("revealEvidence"), evidenceId: e(ids.evidence) }),
    z.strictObject({ type: z.literal("cancelActions") }),
  ] as const;
  const seqTarget = z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("variant"), variantId: e(ids.variants) }),
    z.strictObject({ kind: z.literal("feature"), featureId: e(ids.features) }),
    z.strictObject({ kind: z.literal("selection") }),
  ]);
  const action =
    version === "v1"
      ? z.discriminatedUnion("type", [...base])
      : z.discriminatedUnion("type", [
          ...base,
          z.strictObject({ type: z.literal("compareVariants"), variantIds: z.array(e(ids.variants)).min(1).max(4) }),
          z.strictObject({ type: z.literal("highlightSequenceRegion"), target: seqTarget }),
        ]);
  const plan = z.strictObject({
    outcome: Outcome,
    intent: Intent,
    entities: z.strictObject({
      geneId: e(ids.genes).nullable(),
      proteinId: e(ids.proteins).nullable(),
      variantId: e(ids.variants).nullable(),
      structureId: e(ids.structures).nullable(),
    }),
    actions: z.array(action).max(8),
    explanationLevel: ExplanationLevel,
    citations: z.array(e(ids.evidence)).max(6),
    followUps: z.array(z.string().max(160)).max(3),
    reason: z.string().max(400).nullable(),
  });
  const s = z.toJSONSchema(plan, { target: "draft-7" }) as Record<string, unknown>;
  delete s.$schema;
  return s;
}
