// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * The AI plan schema (P3.1.1). LLM output is untrusted input (master prompt §6, §7.2): it is
 * parsed with these strict schemas (unknown fields and unknown action types are rejected),
 * then checked against the planning context by `validatePlan` (identifiers, capabilities,
 * prerequisites). Only a plan that passes both may reach the Scene Action Interpreter.
 *
 * The action vocabulary is the §7.2 subset needed for the HBB slice, grown in Phase 6
 * (compareVariants, highlightSequenceRegion) and Phase 10 (selectTranscript, showProteinDomains,
 * showPathway, setRepresentation, beginTransition, returnToOverview). Whether a build executes an
 * action is the context's `executableActions`; validation rejects the others as not executable.
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

const V1_CORE = [
  z.strictObject({ type: z.literal("resolveGene"), geneId: Id }),
  z.strictObject({ type: z.literal("resolveVariant"), variantId: Id }),
  /** assembly: "model" = the asymmetric unit, or a biological assembly id from the context. */
  z.strictObject({ type: z.literal("loadStructure"), structureId: Id, assembly: ASSEMBLY_CHOICE }),
  z.strictObject({ type: z.literal("enterWorld"), world: z.enum(WORLDS) }),
  z.strictObject({ type: z.literal("focusCamera"), target: SemanticTarget }),
  z.strictObject({ type: z.literal("highlightResidue"), target: SemanticTarget }),
  z.strictObject({ type: z.literal("revealEvidence"), evidenceId: Id }),
  z.strictObject({ type: z.literal("cancelActions") }),
] as const;
/** The Phase 3 member lists showProteinDomains in its schema-only form `{ proteinId }` (never executed). */
const V1_MEMBERS = [...V1_CORE, z.strictObject({ type: z.literal("showProteinDomains"), proteinId: Id })] as const;

/** The Phase 3 action union (v1), kept verbatim so the Phase 3 decoding schema stays byte-identical. */
export const ActionV1 = z.discriminatedUnion("type", [...V1_MEMBERS, z.strictObject({ type: z.literal("compareVariants"), variantIds: z.array(Id).min(2).max(4) })]);

const V2_SEQUENCE_MEMBERS = [
  z.strictObject({ type: z.literal("compareVariants"), variantIds: z.array(Id).min(1).max(4) }),
  z.strictObject({ type: z.literal("highlightSequenceRegion"), target: SequenceTarget }),
] as const;

/**
 * The action vocabulary of Phase 6 (v2), kept verbatim: compareVariants compares each listed variant
 * with the reference sequence of its transcript, so one variant id suffices (a v1 plan with two ids
 * still parses); highlightSequenceRegion marks a region of the transcript sequence. The v2 decoding
 * schema (`planJsonSchema("v2")`, sent with prompts v2 to v6) is built from it, so it stays
 * byte-identical now that the vocabulary has grown (Phase 10).
 */
export const ActionV2 = z.discriminatedUnion("type", [...V1_MEMBERS, ...V2_SEQUENCE_MEMBERS]);

/**
 * Phase 10 (P10.1.1, docs/phase-10-ai-explorer.md section 2): the UniProt feature types
 * showProteinDomains may show. The set a protein record offers is read from the record
 * (`PlanningContext.proteinFeatureTypes`); this is the closed list it is taken from.
 */
export const DOMAIN_FEATURE_TYPES = ["Domain", "Region", "Topological domain", "Transmembrane", "Zinc finger"] as const;
export type DomainFeatureType = (typeof DOMAIN_FEATURE_TYPES)[number];
/** Phase 10: the closed list of structure representations setRepresentation may ask for (Mol* presets in the app). */
export const REPRESENTATIONS = ["cartoon", "ball-and-stick", "surface", "spacefill"] as const;
export type Representation = (typeof REPRESENTATIONS)[number];

/**
 * Phase 10 showProteinDomains: the protein accession (a protein of the trusted context) and, optionally,
 * the feature types to show (from the closed list; the record decides which exist). The Phase 3 form
 * `{ proteinId }` still parses so that a plan written in it is scored as before (schema-valid, not
 * executable); validatePlan rejects it. Exactly one of the two keys is given.
 */
export const ShowProteinDomainsAction = z.strictObject({ type: z.literal("showProteinDomains"), proteinAccession: Id, featureTypes: z.array(z.enum(DOMAIN_FEATURE_TYPES)).min(1).max(DOMAIN_FEATURE_TYPES.length).optional() });
const ShowProteinDomainsMember = z
  .strictObject({ type: z.literal("showProteinDomains"), proteinAccession: Id.optional(), proteinId: Id.optional(), featureTypes: z.array(z.enum(DOMAIN_FEATURE_TYPES)).min(1).max(DOMAIN_FEATURE_TYPES.length).optional() })
  .refine((a) => (a.proteinAccession === undefined) !== (a.proteinId === undefined), { message: "showProteinDomains names its protein once: proteinAccession (or the Phase 3 proteinId)" });

/** The six actions of Phase 10 (P10.1.1). Semantic targets only: never a coordinate, a residue number or a mesh. */
const V3_MEMBERS = [
  z.strictObject({ type: z.literal("selectTranscript"), transcriptId: Id }),
  z.strictObject({ type: z.literal("showPathway"), stableId: Id.optional() }),
  z.strictObject({ type: z.literal("setRepresentation"), representation: z.enum(REPRESENTATIONS) }),
  z.strictObject({ type: z.literal("beginTransition"), from: z.enum(WORLDS), to: z.enum(WORLDS) }),
  z.strictObject({ type: z.literal("returnToOverview") }),
] as const;

/**
 * The decoding vocabulary of prompt v7 (P10.3.1): the Phase 6 decoding vocabulary with the six Phase 10
 * actions, showProteinDomains in its executable form only (proteinAccession). The v3 decoding schema
 * (`planJsonSchema("v3")`, sent with prompt v7 only) is built from it; v1 and v2 are unchanged.
 */
export const ActionV3 = z.discriminatedUnion("type", [...V1_CORE, ShowProteinDomainsAction, ...V2_SEQUENCE_MEMBERS, ...V3_MEMBERS]);

/**
 * The action vocabulary (v3, Phase 10): the Phase 6 vocabulary with showProteinDomains in its
 * executable form and the five other Phase 10 actions. Whether a build executes an action is the
 * context's `executableActions`, checked by validatePlan. The decoding schemas sent to a model are
 * not built from it: v1 and v2 for prompts v1 to v6, v3 (ActionV3) for prompt v7.
 */
export const Action = z.discriminatedUnion("type", [...V1_CORE, ShowProteinDomainsMember, ...V2_SEQUENCE_MEMBERS, ...V3_MEMBERS]);
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
  "selectTranscript",
  "showPathway",
  "setRepresentation",
  "beginTransition",
  "returnToOverview",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];
/** Actions added in Phase 6. A context that lists one as executable gets the v2 prompt and decoding schema. */
export const V2_ONLY_ACTIONS = ["compareVariants", "highlightSequenceRegion"] as const;
export const usesV2 = (executableActions: readonly string[]): boolean => V2_ONLY_ACTIONS.some((a) => executableActions.includes(a));
/** Actions added in Phase 10 (P10.1.1). No measured prompt (v1 to v6) teaches them; prompt v7 does. */
export const PHASE10_ACTIONS = ["selectTranscript", "showProteinDomains", "showPathway", "setRepresentation", "beginTransition", "returnToOverview"] as const;
export type Phase10ActionType = (typeof PHASE10_ACTIONS)[number];
/**
 * The actions a model plan may carry under the measured prompts v1 to v6: those the build executed
 * when the prompt was measured (the Phase 6 registry). A model plan with any other action (the six
 * Phase 10 actions, showProteinDomains included) is rejected by validatePlan when the director passes
 * this list, and the rule-based planner answers, so the measured behaviour of those prompts is kept.
 */
export const MEASURED_PROMPT_ACTIONS = ["resolveGene", "resolveVariant", "loadStructure", "enterWorld", "focusCamera", "highlightResidue", "revealEvidence", "cancelActions", "compareVariants", "highlightSequenceRegion"] as const;

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
 * "v1" (default) is the Phase 3 schema, byte-identical; "v2" adds the Phase 6 actions; "v3" (prompt v7
 * only) adds the six Phase 10 actions.
 */
export type DecodingSchemaVersion = "v1" | "v2" | "v3";
export function planJsonSchema(version: DecodingSchemaVersion = "v1"): Record<string, unknown> {
  const schema = Plan.extend({ actions: z.array(version === "v1" ? ActionV1 : version === "v2" ? ActionV2 : ActionV3).max(8) });
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
}, version: DecodingSchemaVersion = "v1"): Record<string, unknown> {
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
      : version === "v2"
        ? z.discriminatedUnion("type", [
            ...base,
            z.strictObject({ type: z.literal("compareVariants"), variantIds: z.array(e(ids.variants)).min(1).max(4) }),
            z.strictObject({ type: z.literal("highlightSequenceRegion"), target: seqTarget }),
          ])
        : z.discriminatedUnion("type", [
            ...base,
            z.strictObject({ type: z.literal("compareVariants"), variantIds: z.array(e(ids.variants)).min(1).max(4) }),
            z.strictObject({ type: z.literal("highlightSequenceRegion"), target: seqTarget }),
            // Prompt v7: the Phase 10 actions; the protein is an enum of the context's proteins, the other ids stay free (validation grounds them).
            z.strictObject({ type: z.literal("showProteinDomains"), proteinAccession: e(ids.proteins), featureTypes: z.array(z.enum(DOMAIN_FEATURE_TYPES)).min(1).max(DOMAIN_FEATURE_TYPES.length).optional() }),
            ...V3_MEMBERS,
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
