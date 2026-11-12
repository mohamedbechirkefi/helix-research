// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Plan validation (P3.1.1). No plan executes without passing this (the 1BZO case: a
 * schema-valid plan that named a structure outside the trusted context).
 *
 * Order: JSON parse -> strict schema -> groundedness (every identifier and citation is in the
 * trusted context; identifiers mentioned in free text are in the trusted context) ->
 * capabilities (executable action, available world) -> prerequisites (structure loaded before
 * a residue is targeted, the assembly contains the feature, a selection exists) -> one world for
 * a first answer (D-H007, only when the context says the question is a first answer) -> the world
 * the question names, for a first answer (D-H008, only in contexts that route by cues) -> outcome
 * consistency.
 */
import { Plan, type Action, type SemanticTarget } from "./schema.ts";
import { allowedIds, trustedContextJson, type PlanningContext } from "./context.ts";
import { planWorlds } from "./worlds.ts";
import { unambiguousCueWorld } from "./routing.ts";

export type IssueCode =
  | "invalid-json"
  | "schema"
  | "ungrounded-id"
  | "ungrounded-text-id"
  | "not-executable"
  | "world-unavailable"
  | "prerequisite"
  | "variant-on-predicted-model"
  | "world-switch"
  | "world-cue"
  | "consistency"
  /** D-H024 (71): showPathway on a membership whose participants the pathway record does not keep. */
  | "pathway-not-openable";

export interface ValidationIssue {
  code: IssueCode;
  path: string;
  message: string;
  value?: string;
}

export interface PlanValidation {
  ok: boolean;
  parsedJson: boolean;
  schemaValid: boolean;
  plan: Plan | null;
  issues: ValidationIssue[];
  /** The subset of issues that are groundedness violations (identifiers outside the context). */
  groundedness: ValidationIssue[];
}

/** Identifier-like tokens that free text must not invent. Exported for tests and scoring. */
export const ID_PATTERNS: { kind: string; re: RegExp }[] = [
  { kind: "ensembl", re: /\bENS[GTPE]\d{11}(?:\.\d+)?\b/g },
  { kind: "refseq", re: /\b(?:NM|NP|NC|NG|XM|XP)_\d{6,9}(?:\.\d+)?\b/g },
  { kind: "dbsnp", re: /\brs\d{3,10}\b/g },
  { kind: "clinvar", re: /\b(?:VCV|RCV|SCV)\d{9}(?:\.\d+)?\b/g },
  { kind: "pmid", re: /\bPMID[:\s]*\d{5,9}\b/gi },
  { kind: "doi", re: /\b10\.\d{4,9}\/[^\s"',;)]+/g },
  { kind: "uniprot", re: /\b(?:[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9](?:[A-Z][A-Z0-9]{2}[0-9]){1,2})\b/g },
  { kind: "alphafold", re: /\bAF-[A-Z0-9]{6,10}-F\d+\b/g },
  // A PDB id: a digit 1-9 then three alphanumerics with at least one letter (e.g. 2HBS, 1BZO, 4hhb).
  { kind: "pdb", re: /\b[1-9](?=[A-Za-z0-9]{0,2}[A-Za-z])[A-Za-z0-9]{3}\b/g },
  { kind: "hgnc", re: /\bHGNC:\d+\b/g },
];

// English ordinals and units that look like PDB ids but are not.
const PDB_FALSE_POSITIVES = new Set(["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"]);

/** Identifier-like tokens in free text. */
export function extractIdTokens(text: string): { kind: string; token: string }[] {
  const out: { kind: string; token: string }[] = [];
  for (const { kind, re } of ID_PATTERNS) {
    for (const m of text.matchAll(re)) {
      const token = m[0];
      if (kind === "pdb" && PDB_FALSE_POSITIVES.has(token.toLowerCase())) continue;
      out.push({ kind, token });
    }
  }
  return out;
}

function normaliseToken(kind: string, token: string): string {
  if (kind === "pmid") return token.replace(/\D/g, "");
  return token.toLowerCase();
}

export interface ValidateOptions {
  /** The user's own query. Identifiers the user typed may be named in free text (e.g. to say they are unavailable), never used as action or entity ids. */
  query?: string;
  /**
   * The actions the planner was taught (Phase 10): a model plan is held to the actions its prompt
   * version was measured with (MEASURED_PROMPT_ACTIONS for prompts v1 to v6), so a v5 plan carrying a
   * Phase 10 action is rejected as not executable and the rule-based planner answers. Absent (the
   * rule-based planner, the interpreter's re-validation): the context's executable actions only.
   */
  taughtActions?: readonly string[];
}

/** Phase 10: the reason a transcript other than the MANE Select one is refused (plan section 2). */
/** D-H024 (71): why a listed membership cannot be opened (the app's execution-time sentence, now the validator's). */
export function notOpenableMessage(m: { name: string; stableId: string }): string {
  return `${m.name} (${m.stableId}) is listed in the record, but its participants are not kept (the record keeps them for the opening rule's candidates only), so Pathway World cannot open it; it stays in the memberships list`;
}

export const NON_MANE_REASON = "only the MANE Select transcript is curated; the record lists it as a candidate";

export function validatePlan(raw: unknown, ctx: PlanningContext, opts: ValidateOptions = {}): PlanValidation {
  const issues: ValidationIssue[] = [];
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch (e) {
      issues.push({ code: "invalid-json", path: "", message: (e as Error).message.slice(0, 200) });
      return { ok: false, parsedJson: false, schemaValid: false, plan: null, issues, groundedness: [] };
    }
  }
  const parsed = Plan.safeParse(value);
  if (!parsed.success) {
    for (const i of parsed.error.issues.slice(0, 20)) {
      issues.push({ code: "schema", path: i.path.join("."), message: i.message });
    }
    return { ok: false, parsedJson: true, schemaValid: false, plan: null, issues, groundedness: [] };
  }
  const plan = parsed.data;
  const ids = allowedIds(ctx);
  const ungrounded = (path: string, v: string, kind: string) =>
    issues.push({ code: "ungrounded-id", path, value: v, message: `${kind} "${v}" is not in the trusted context` });

  // Entities.
  const e = plan.entities;
  if (e.geneId !== null && !ids.genes.has(e.geneId)) ungrounded("entities.geneId", e.geneId, "gene");
  if (e.proteinId !== null && !ids.proteins.has(e.proteinId)) ungrounded("entities.proteinId", e.proteinId, "protein");
  if (e.variantId !== null && !ids.variants.has(e.variantId)) ungrounded("entities.variantId", e.variantId, "variant");
  if (e.structureId !== null && !ids.structures.has(e.structureId)) ungrounded("entities.structureId", e.structureId, "structure");
  plan.citations.forEach((c, i) => {
    if (!ids.evidence.has(c)) ungrounded(`citations.${i}`, c, "citation");
  });

  // Actions, in order, tracking what is loaded.
  let loaded: { structureId: string; assembly: string } | null = ctx.loadedStructureId ? { structureId: ctx.loadedStructureId, assembly: "model" } : null;
  const checkTarget = (t: SemanticTarget, path: string) => {
    if (t.kind === "selection") {
      if (!ctx.selection) issues.push({ code: "prerequisite", path, message: "target is the current selection, but nothing is selected" });
      return;
    }
    if (!ids.features.has(t.featureId)) {
      ungrounded(`${path}.featureId`, t.featureId, "feature");
      return;
    }
    const f = ctx.features.find((x) => x.id === t.featureId)!;
    if (!loaded || loaded.structureId !== f.structureId) {
      const s = ctx.structures.find((x) => x.id === loaded?.structureId);
      if (loaded && s && !s.variantPlacement) {
        issues.push({ code: "variant-on-predicted-model", path, message: `feature ${f.id} cannot be placed on ${s.id} (${s.origin}); it is mapped on ${f.structureId}` });
      } else {
        issues.push({ code: "prerequisite", path, message: `feature ${f.id} is on ${f.structureId}, which is not loaded at this point` });
      }
      return;
    }
    if (!f.assemblies.includes(loaded.assembly)) {
      issues.push({ code: "prerequisite", path, message: `feature ${f.id} is not fully present in assembly "${loaded.assembly}" (present in: ${f.assemblies.join(", ")})` });
    }
  };
  // Phase 10: the world on screen as the plan runs (for setRepresentation and beginTransition).
  let world: string | null = ctx.currentWorld ?? null;
  const experimental = ctx.structures.find((x) => x.origin === "experimental" && x.variantPlacement) ?? ctx.structures.find((x) => x.origin === "experimental") ?? null;
  plan.actions.forEach((a: Action, i) => {
    const path = `actions.${i}`;
    if (!ctx.executableActions.includes(a.type)) {
      issues.push({ code: "not-executable", path, value: a.type, message: `action ${a.type} is in the vocabulary but not executable in this build` });
    } else if (opts.taughtActions && !opts.taughtActions.includes(a.type)) {
      issues.push({ code: "not-executable", path, value: a.type, message: `action ${a.type} is executable in this build but not taught by the planner's prompt version; the rule-based planner plans it` });
    }
    switch (a.type) {
      case "resolveGene":
        if (!ids.genes.has(a.geneId)) ungrounded(`${path}.geneId`, a.geneId, "gene");
        break;
      case "resolveVariant":
        if (!ids.variants.has(a.variantId)) ungrounded(`${path}.variantId`, a.variantId, "variant");
        break;
      case "loadStructure": {
        const s = ctx.structures.find((x) => x.id === a.structureId);
        if (!s) {
          ungrounded(`${path}.structureId`, a.structureId, "structure");
          loaded = null;
          break;
        }
        if (!s.assemblies.some((x) => x.id === a.assembly)) {
          issues.push({ code: "ungrounded-id", path: `${path}.assembly`, value: a.assembly, message: `assembly "${a.assembly}" does not exist for ${s.id}` });
        }
        loaded = { structureId: s.id, assembly: a.assembly };
        break;
      }
      case "enterWorld":
        if (!ids.worlds.has(a.world)) issues.push({ code: "world-unavailable", path, value: a.world, message: `world ${a.world} is not available in this context` });
        break;
      case "focusCamera":
      case "highlightResidue":
        checkTarget(a.target, `${path}.target`);
        break;
      case "revealEvidence":
        if (!ids.evidence.has(a.evidenceId)) ungrounded(`${path}.evidenceId`, a.evidenceId, "evidence");
        break;
      case "showProteinDomains": {
        if (a.proteinId !== undefined) {
          // The Phase 3 form: grounded as before; never executable.
          if (!ids.proteins.has(a.proteinId)) ungrounded(`${path}.proteinId`, a.proteinId, "protein");
          if (ctx.executableActions.includes(a.type)) issues.push({ code: "not-executable", path: `${path}.proteinId`, value: a.type, message: "showProteinDomains in its Phase 3 form (proteinId) is not executable; the executable form names proteinAccession" });
          break;
        }
        const acc = a.proteinAccession!;
        if (!ids.proteins.has(acc)) {
          ungrounded(`${path}.proteinAccession`, acc, "protein");
          break;
        }
        const feats = (ctx.proteinFeatures ?? []).filter((f) => f.proteinAccession === acc);
        const present = [...new Set(feats.map((f) => f.type))];
        if (feats.length === 0) {
          issues.push({ code: "prerequisite", path, value: acc, message: ctx.proteinFeatures ? `Helix's copy of the UniProt record of ${acc} keeps Domain features only and has none` : `the protein record's features are not in this context` });
          break;
        }
        const missing = (a.featureTypes ?? []).filter((t) => !present.includes(t));
        if (missing.length > 0) issues.push({ code: "prerequisite", path: `${path}.featureTypes`, value: missing.join(","), message: `Helix's copy of the UniProt record of ${acc} keeps Domain features only, so it has no feature of type ${missing.join(", ")} (it has ${present.join(", ")})` });
        break;
      }
      case "selectTranscript": {
        const candidates = ctx.transcriptCandidates ?? ctx.transcripts.map((t) => ({ id: t.versioned, maneSelect: t.label.startsWith("MANE Select"), source: "context" }));
        const id = a.transcriptId;
        const c = candidates.find((x) => x.id === id || x.id.replace(/\.\d+$/, "") === id);
        if (!c) ungrounded(`${path}.transcriptId`, id, "transcript");
        else if (!c.maneSelect) issues.push({ code: "prerequisite", path: `${path}.transcriptId`, value: id, message: `${c.id}: ${NON_MANE_REASON}` });
        break;
      }
      case "showPathway": {
        const pw = ctx.worlds.find((w) => w.id === "pathway");
        if (!ids.worlds.has("pathway")) issues.push({ code: "world-unavailable", path, value: "pathway", message: `Pathway World is not available in this context${pw ? ` (${pw.reason})` : ""}` });
        else if (a.stableId !== undefined) {
          const m = (ctx.pathways ?? []).find((p) => p.stableId === a.stableId);
          if (!m) ungrounded(`${path}.stableId`, a.stableId, "pathway");
          // D-H024 (71): only a membership whose participants the record keeps can be drawn.
          else if (!m.openable) issues.push({ code: "pathway-not-openable", path: `${path}.stableId`, value: a.stableId, message: notOpenableMessage(m) });
        }
        break;
      }
      case "setRepresentation":
        if (!loaded) issues.push({ code: "prerequisite", path, message: "no structure is loaded, so there is no representation to change" });
        else if (world !== null && world !== "protein") issues.push({ code: "prerequisite", path, value: world, message: `the representation applies to the structure in Protein World; ${world === "dna" ? "DNA" : world} World is on screen` });
        break;
      case "beginTransition":
        if (a.from !== "dna" || a.to !== "protein") issues.push({ code: "prerequisite", path, value: `${a.from}>${a.to}`, message: `no transition from ${a.from} to ${a.to}; the only transition is from DNA World to Protein World` });
        else if (!ids.worlds.has("protein")) issues.push({ code: "world-unavailable", path, value: "protein", message: `the only transition is from DNA World to Protein World, and Protein World is not available (${ctx.worlds.find((w) => w.id === "protein")?.reason ?? "no scene"})` });
        else if (world !== null && world !== "dna") issues.push({ code: "prerequisite", path, value: world, message: `the transition starts in DNA World; ${world} World is on screen` });
        else if (!loaded && experimental) loaded = { structureId: experimental.id, assembly: "model" };
        break;
      case "returnToOverview":
        break;
      case "compareVariants":
        a.variantIds.forEach((v, j) => {
          if (!ids.variants.has(v)) ungrounded(`${path}.variantIds.${j}`, v, "variant");
        });
        break;
      case "highlightSequenceRegion": {
        const t = a.target;
        if (t.kind === "variant" && !ids.variants.has(t.variantId)) ungrounded(`${path}.target.variantId`, t.variantId, "variant");
        if (t.kind === "feature" && !ids.features.has(t.featureId)) ungrounded(`${path}.target.featureId`, t.featureId, "feature");
        if (t.kind === "selection" && !ctx.selection && !ctx.sequenceSelection) issues.push({ code: "prerequisite", path: `${path}.target`, message: "target is the current selection, but nothing is selected" });
        break;
      }
      case "cancelActions":
        break;
    }
    const w = a.type === "enterWorld" ? a.world : a.type === "beginTransition" ? a.to : a.type === "loadStructure" || a.type === "focusCamera" || a.type === "highlightResidue" ? "protein" : a.type === "highlightSequenceRegion" ? "dna" : a.type === "showPathway" ? "pathway" : null;
    if (w !== null && world !== null) world = w;
  });

  // Identifiers mentioned in free text must come from the trusted context.
  const trusted = trustedContextJson(ctx).toLowerCase();
  const query = (opts.query ?? "").toLowerCase();
  const trustedPmids = new Set([...trusted.matchAll(/pmid[^0-9]{0,3}(\d{5,9})|pubmed:(\d{5,9})|"pubmedid":"(\d+)"/g)].map((m) => m[1] ?? m[2] ?? m[3]));
  const texts: [string, string][] = [
    ...(plan.reason ? ([["reason", plan.reason]] as [string, string][]) : []),
    ...plan.followUps.map((f, i) => [`followUps.${i}`, f] as [string, string]),
  ];
  for (const [path, text] of texts) {
    for (const { kind, token } of extractIdTokens(text)) {
      const n = normaliseToken(kind, token);
      const known = kind === "pmid" ? trustedPmids.has(n) || query.includes(n) : trusted.includes(n) || query.includes(n);
      if (!known) issues.push({ code: "ungrounded-text-id", path, value: token, message: `${kind} id "${token}" in free text is not in the trusted context` });
    }
  }

  // A first answer stays in one world (author decision D-H007, 2026-11-02). Follow-ups may change world.
  if (ctx.answer === "first") {
    const worlds = planWorlds(plan);
    if (worlds.length > 1) {
      issues.push({ code: "world-switch", path: "actions", value: worlds.join(">"), message: `a first answer stays in one world; this plan visits ${worlds.join(" then ")}` });
    }
  }

  // A first answer goes to the world the question names (author decision D-H008, 2026-11-02), checked
  // conservatively: only when the question names one world without doubt (strong cue words of that
  // world, none of the other), that world is available, and the plan shows only the other world.
  // D-H010 contexts (cueRules "dh010") read the D-H010 lists: a molecule name alone is strong.
  if (ctx.routeByCues && ctx.answer === "first" && opts.query !== undefined) {
    const named = unambiguousCueWorld(opts.query, ctx.cueRules ?? "dh008");
    const worlds = planWorlds(plan);
    // Phase 9 (P9.1.2): the cue lists name DNA World and Protein World only; a plan that shows Pathway
    // World (membership, no cue list of its own) is not "the other world" and is left to the world rule above.
    const cueWorlds = worlds.filter((w) => w === "dna" || w === "protein");
    if (named && ids.worlds.has(named) && cueWorlds.length > 0 && !cueWorlds.includes(named)) {
      issues.push({ code: "world-cue", path: "actions", value: `${named}<${worlds.join(">")}`, message: `the question names ${named === "dna" ? "DNA" : "Protein"} World; this first answer shows ${worlds.join(" then ")}` });
    }
  }

  // Outcome consistency.
  const executing = plan.actions.filter((a) => a.type !== "cancelActions");
  if (plan.outcome === "plan" && plan.actions.length === 0) {
    issues.push({ code: "consistency", path: "actions", message: "outcome plan requires at least one action" });
  }
  if (plan.outcome !== "plan") {
    if (executing.length > 0) issues.push({ code: "consistency", path: "actions", message: `outcome ${plan.outcome} must not carry scene actions` });
    if (!plan.reason || plan.reason.trim().length === 0) issues.push({ code: "consistency", path: "reason", message: `outcome ${plan.outcome} requires a reason` });
  }

  const groundedness = issues.filter((i) => i.code === "ungrounded-id" || i.code === "ungrounded-text-id");
  return { ok: issues.length === 0, parsedJson: true, schemaValid: true, plan, issues, groundedness };
}
