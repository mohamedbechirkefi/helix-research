// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Deterministic fallback planner (P3.2.3, master prompt §8 item 3). No model: ordered rules
 * over the query and the bundled records. It reads only the user's query and the trusted
 * context, never retrieved text, so it cannot be injected through retrieved data.
 *
 * Refusal and safety rules run first (clinical, code, identifiers outside the context), then
 * selection-dependent follow-ups, ambiguity, and finally the supported commands. Anything
 * not recognised is answered "unsupported" with a reason: the fallback never guesses.
 */
import type { Action, Plan, Intent, SequenceTarget } from "./schema.ts";
import { extractIdTokens } from "./validate.ts";
import { trustedContextJson, type PlanningContext } from "./context.ts";
import { routeQuestion, type Routing } from "./routing.ts";

export const FALLBACK_VERSION = "helix-fallback-v1";

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const CLINICAL =
  /\b(should (i|he|she|we|they|my)|am i|do i have|will (i|he|she|we|they) (get|be)|(i|he|she|we|they) (will|would|might|could|am going to|is going to|are going to) (get|be|become|develop|fall)|get sick|fall ill|i carry|my (son|daughter|child|children|kids?|baby|partner|husband|wife|family|parents?|pregnancy|risk|chances?|test|genetic|doctor|results?|medication)|dose|dosage|medication|medicine|treat(ment)?|therap|hydroxyurea|folic|diagnos|prognos|symptom|que dois-je|mon enfant|ma fille|mon fils|medicament|traitement|porteur|porteuse)\b/;
const CODE = /\b(javascript|typescript|python|code|script|eval|execute|run it|run this|executez?|executer)\b/;
const CANCEL = /^\s*(stop|cancel|abort|arrete|annule)\b|\bcancel (that|this|it)\b/;
const SELECTION_REF = /\b(this|that|selected|current) (residue|one|amino acid|position)\b|\bthis one\b|\bce (residu|acide amine)\b|\bcelui-ci\b|\bselected residue\b/;
const RESIDUE_NUMBER = /\b(residue|residu|position|amino acid) \d+\b/;
const VARIANT = /(sickle|drepano|falciform|\bhbs\b|\be6v\b|glu6val|glu7val|\be7v\b|rs334|mutation|mutated|variant|substitution)/;
const EVIDENCE = /(evidence|pathogen|clinvar|preuve|record|source|citation)/;
const CONTACT = /(contact|touch|interact|neighbo)/;
const PREDICTED = /(alphafold|predicted|prediction|predit)/;
const STRUCTURE_NAMED = /(2hbs|crystal|cristal|deoxyhemoglobin|asymmetric unit)/;
const STRUCTURE_ANY = /\b(structure|3d model|pdb)\b/;
const PROTEIN_WORLD = /(protein world|monde (de la )?proteine|protein view)/;
const GENE = /\b(gene|gene for|hbb|locus|genome)\b|hemoglobin subunit beta/;
const GLOBIN_UNQUALIFIED = /\bglobin\b/;
// D-H010: a request to see something (the molecule-name rule only).
const SHOW = /\b(show|display|open|see|view|bring up|take me|go to|montre|affiche|ouvre|voir)\b/;
const COMPARE = /\b(compare|comparer|versus|vs\.?|side by side)\b/;
const DOMAINS = /\b(domain|domains|domaine|domaines)\b/;
const PATHWAY = /\b(pathway|dna repair|reparation|voie)\b/;
const BEGINNER = /(beginner|simple|simply|debutant|explain like)/;
const EXPERT = /(expert|detail|in depth|codon|numbering)/;
const OUT_OF_CONTEXT_GENES = new Set(["CFTR", "BRCA1", "BRCA2", "TP53", "EGFR", "KRAS", "BRAF", "APOE", "HBA1", "HBA2", "HBD", "HBG1", "HBG2", "HTT", "DMD", "MYC", "PTEN", "SMN1", "FBN1"]);
const OTHER_VARIANTS = /\b(hbc|hbe|f508del|r175h|v600e)\b/;
// Phase 6: questions about the DNA-level change (gated on the build executing the sequence actions).
const SEQUENCE_CHANGE = /(codon|nucleotide|\bbase change|which base|dna change|sequence change|change in the (dna|sequence|gene)|changed in the (dna|sequence|gene)|in the dna|on the dna|dna sequence|reference sequence|normal sequence|sequence comparison)/;

function base(ctx: PlanningContext): Pick<Plan, "entities" | "citations" | "followUps" | "explanationLevel"> {
  return { entities: { geneId: null, proteinId: null, variantId: null, structureId: null }, citations: [], followUps: [], explanationLevel: "intermediate" };
}

/** Phase 6: does this build execute the sequence actions (compareVariants, highlightSequenceRegion)? */
function sequenceActions(ctx: PlanningContext): boolean {
  return ctx.executableActions.includes("compareVariants") && ctx.executableActions.includes("highlightSequenceRegion");
}

/** Phase 6: show a variant on the transcript sequence next to the reference (blueprints B and E). */
function sequencePlan(ctx: PlanningContext, variant: PlanningContext["variants"][number], target: SequenceTarget, level: Plan["explanationLevel"], reason: string | null): Plan {
  const hgvsEv = ctx.evidence.find((e) => e.id.startsWith("hgvs:"))?.id ?? null;
  const dna = ctx.worlds.some((w) => w.id === "dna" && w.available);
  const actions: Action[] = [
    ...(dna ? [{ type: "enterWorld" as const, world: "dna" as const }] : []),
    { type: "highlightSequenceRegion", target },
    { type: "compareVariants", variantIds: [variant.id] },
    ...(hgvsEv ? [{ type: "revealEvidence" as const, evidenceId: hgvsEv }] : []),
  ];
  return {
    ...base(ctx),
    outcome: "plan",
    intent: "compare_variants",
    entities: { geneId: variant.geneId, proteinId: variant.proteinId, variantId: variant.id, structureId: null },
    actions,
    citations: hgvsEv ? [hgvsEv] : [],
    explanationLevel: level,
    reason,
  };
}

function refuse(ctx: PlanningContext, intent: Intent, reason: string): Plan {
  return { ...base(ctx), outcome: "unsupported", intent, actions: [], reason };
}
function clarify(ctx: PlanningContext, intent: Intent, reason: string): Plan {
  return { ...base(ctx), outcome: "clarify", intent, actions: [], reason };
}

export interface FallbackResult {
  plan: Plan;
  /** The rule that produced the plan, for transparency in the UI and tests. */
  rule: string;
  /** D-H008 contexts only (routeByCues): where the question's cue words send the answer. */
  routing?: Routing;
}

export function deterministicPlan(query: string, ctx: PlanningContext): FallbackResult {
  const q = fold(query);
  const gene = ctx.genes[0] ?? null;
  const protein = ctx.proteins[0] ?? null;
  const variant = ctx.variants[0] ?? null;
  const experimental = ctx.structures.find((s) => s.origin === "experimental" && s.variantPlacement) ?? null;
  const predicted = ctx.structures.find((s) => s.origin === "predicted") ?? null;
  const varFeature = variant ? (ctx.features.find((f) => f.id === variant.featureId) ?? null) : null;
  const contactFeature = ctx.features.find((f) => f.kind === "contact") ?? null;
  const level: Plan["explanationLevel"] = BEGINNER.test(q) ? "intro" : EXPERT.test(q) ? "expert" : "intermediate";
  const symbols = new Set(ctx.genes.flatMap((g) => [g.symbol.toUpperCase(), ...g.aliases.map((a) => a.toUpperCase())]));
  // D-H008 (author, 2026-11-02): the question's cue words route the answer; neutral stays in the current world.
  // D-H010 contexts (cueRules "dh010") read the D-H010 lists: molecule names and "chain" are protein cues.
  const routing = ctx.routeByCues ? routeQuestion(query, ctx.currentWorld, ctx.cueRules ?? "dh008") : undefined;
  const r = (plan: Plan, rule: string): FallbackResult => (routing ? { plan, rule, routing } : { plan, rule });

  // 1. Safety refusals.
  if (CLINICAL.test(q)) return r(refuse(ctx, "other", "HELIX is a nonclinical educational tool and cannot give medical, diagnostic or treatment advice. Please ask a qualified health professional."), "clinical");
  if (CODE.test(q)) return r(refuse(ctx, "other", "HELIX does not write or run code; it only executes its fixed, validated scene actions."), "code");

  // 2. Identifiers, genes or variants outside the trusted context.
  const trusted = trustedContextJson(ctx).toLowerCase();
  const foreignIds = extractIdTokens(query).filter((t) => !trusted.includes(t.token.toLowerCase()));
  if (foreignIds.length > 0) return r(refuse(ctx, "other", `${foreignIds.map((t) => t.token).join(", ")} is not in the curated records available here (${ctx.contextId}).`), "foreign-id");
  const geneLike = [...query.matchAll(/\b[A-Z][A-Z0-9]{1,7}\b/g)].map((m) => m[0]).filter((t) => (OUT_OF_CONTEXT_GENES.has(t) || /^[A-Z]{2,6}\d{1,2}[A-Z]?$/.test(t)) && !symbols.has(t));
  if (geneLike.length > 0) return r(refuse(ctx, "other", `${[...new Set(geneLike)].join(", ")} is not in the curated records available here; only ${[...symbols][0] ?? "the curated gene"} is.`), "foreign-gene");
  if (OTHER_VARIANTS.test(q)) return r(refuse(ctx, "compare_variants", sequenceActions(ctx) ? "Only the HbS variant is in the curated records; other variants are not available." : "Only the HbS variant is in the curated records; other variants are not available, and variant comparison is not executable in this build."), "foreign-variant");

  // 3. Cancel.
  if (CANCEL.test(q)) return r({ ...base(ctx), outcome: "plan", intent: "cancel", actions: [{ type: "cancelActions" }], reason: null }, "cancel");

  // 4. Follow-ups that refer to the current selection.
  if (SELECTION_REF.test(q) || (/\b(it|ca)\b/.test(q) && COMPARE.test(q))) {
    const sel = ctx.selection;
    if (!sel) return r(clarify(ctx, "explain_selection", "Nothing is selected. Select a residue in the structure first, or name the residue, chain and structure."), "selection-missing");
    if (COMPARE.test(q) || (sequenceActions(ctx) && SEQUENCE_CHANGE.test(q))) {
      if (!sequenceActions(ctx)) return r(refuse(ctx, "compare_variants", "Variant comparison is not executable in this build."), "compare-selection");
      const selVariant = sel.featureId ? ctx.variants.find((v) => v.featureId === sel.featureId) : undefined;
      if (!selVariant) return r(clarify(ctx, "compare_variants", `No curated variant is recorded at ${sel.compId} ${sel.chainId}${sel.residueNumber}; only ${ctx.variants.map((v) => v.label).join(", ") || "no variant"} can be compared with the reference.`), "compare-selection-no-variant");
      return r(sequencePlan(ctx, selVariant, { kind: "selection" }, level, null), "compare-selection-sequence");
    }
    const selFeature = sel.featureId ? ctx.features.find((f) => f.id === sel.featureId) : null;
    if (CONTACT.test(q) && selFeature && contactFeature && contactFeature.chains[0] === sel.chainId) {
      const t = { kind: "feature" as const, featureId: contactFeature.id };
      return r({ ...base(ctx), outcome: "plan", intent: "explain_selection", entities: { ...base(ctx).entities, structureId: sel.structureId, proteinId: contactFeature.proteinId }, actions: [{ type: "focusCamera", target: t }, { type: "highlightResidue", target: t }, ...contactFeature.evidenceIds.slice(0, 1).map((id) => ({ type: "revealEvidence" as const, evidenceId: id }))], citations: contactFeature.evidenceIds.slice(0, 2), explanationLevel: level, reason: null }, "selection-contact");
    }
    if (CONTACT.test(q)) return r(clarify(ctx, "explain_selection", `No curated contact data exists for ${sel.chainId}${sel.residueNumber}; contacts are curated only for the HbS residue on chain ${contactFeature?.chains[0] ?? "?"}.`), "selection-contact-missing");
    const evidenceIds = selFeature ? selFeature.evidenceIds.slice(0, 2) : [];
    if (EVIDENCE.test(q)) {
      if (evidenceIds.length === 0) return r(clarify(ctx, "explain_evidence", `No curated evidence is available for ${sel.compId} ${sel.chainId}${sel.residueNumber}.`), "selection-evidence-missing");
      return r({ ...base(ctx), outcome: "plan", intent: "explain_evidence", actions: evidenceIds.map((id) => ({ type: "revealEvidence" as const, evidenceId: id })), citations: evidenceIds, explanationLevel: level, reason: null }, "selection-evidence");
    }
    const actions: Action[] = [{ type: "focusCamera", target: { kind: "selection" } }];
    if (!/\b(zoom|focus|centre|center)\b/.test(q)) actions.push({ type: "highlightResidue", target: { kind: "selection" } });
    actions.push(...evidenceIds.slice(0, 1).map((id) => ({ type: "revealEvidence" as const, evidenceId: id })));
    return r(
      {
        ...base(ctx),
        outcome: "plan",
        intent: "explain_selection",
        entities: { ...base(ctx).entities, structureId: sel.structureId },
        actions,
        citations: evidenceIds,
        explanationLevel: level,
        reason: evidenceIds.length === 0 ? `No curated evidence is available for ${sel.compId} ${sel.chainId}${sel.residueNumber}; only its location is shown.` : null,
      },
      selFeature ? "selection-explain" : "selection-explain-no-evidence",
    );
  }

  // 5. Ambiguity.
  if (RESIDUE_NUMBER.test(q)) return r(clarify(ctx, "other", "Which numbering, protein and chain? For beta-globin, translated numbering (Met = 1) and mature numbering differ by one."), "residue-number");
  if (COMPARE.test(q)) {
    if (sequenceActions(ctx) && variant) return r(sequencePlan(ctx, variant, { kind: "variant", variantId: variant.id }, level, null), "compare-sequence");
    return r(refuse(ctx, "compare_variants", "Variant comparison is not executable in this build."), "compare");
  }
  if (DOMAINS.test(q)) return r(refuse(ctx, "show_domains", "Protein domain display is not executable in this build."), "domains");
  if (PATHWAY.test(q)) return r(refuse(ctx, "other", "No curated pathway records are available in this context."), "pathway");

  // 6. Supported commands.
  // Phase 6: the DNA-level change of the variant, on the sequence next to the reference.
  if (variant && sequenceActions(ctx) && SEQUENCE_CHANGE.test(q) && (VARIANT.test(q) || /\b(it|this|that)\b/.test(q))) {
    return r(sequencePlan(ctx, variant, { kind: "variant", variantId: variant.id }, level, null), "variant-sequence");
  }
  // Phase 6 (blueprint E): no experimental structure with a verified mapping. Say so and show the
  // variant on the sequence instead; a predicted model is never substituted.
  if (variant && VARIANT.test(q) && !experimental && !EVIDENCE.test(q)) {
    const why = "No experimental structure with a verified residue mapping is available for this variant in the curated records here, so it is not placed on a 3D structure; a predicted model is never used instead.";
    if (sequenceActions(ctx)) return r(sequencePlan(ctx, variant, { kind: "variant", variantId: variant.id }, level, `${why} The change is shown on the transcript sequence instead.`), "variant-no-structure-sequence");
    return r(refuse(ctx, "locate_variant", why), "variant-no-structure");
  }
  if (variant && experimental && contactFeature && CONTACT.test(q) && (VARIANT.test(q) || /\b(valine|val) ?6\b|\bchain h\b/.test(q))) {
    const t = { kind: "feature" as const, featureId: contactFeature.id };
    return r(
      {
        ...base(ctx),
        outcome: "plan",
        intent: "locate_variant",
        entities: { geneId: gene?.id ?? null, proteinId: contactFeature.proteinId, variantId: variant.id, structureId: contactFeature.structureId },
        actions: [{ type: "loadStructure", structureId: contactFeature.structureId, assembly: "model" }, { type: "focusCamera", target: t }, { type: "highlightResidue", target: t }, ...contactFeature.evidenceIds.slice(0, 1).map((id) => ({ type: "revealEvidence" as const, evidenceId: id }))],
        citations: contactFeature.evidenceIds,
        explanationLevel: level,
        reason: null,
      },
      "contact",
    );
  }
  // D-H008: a variant question that names DNA World, or names no world while DNA World is on screen,
  // shows the variant on the sequence next to the reference (the codon change), in DNA World only.
  // A question that names Protein World, or names none in Protein World, keeps the rules below;
  // a question that names both keeps the rule order of D-H007.
  if (routing?.world === "dna" && variant && sequenceActions(ctx) && VARIANT.test(q) && !EVIDENCE.test(q) && ctx.worlds.some((w) => w.id === "dna" && w.available)) {
    return r(sequencePlan(ctx, variant, { kind: "variant", variantId: variant.id }, level, null), routing.why === "named" ? "variant-sequence" : "variant-sequence-current-world");
  }
  if (variant && VARIANT.test(q)) {
    if (EVIDENCE.test(q)) {
      return r({ ...base(ctx), outcome: "plan", intent: "explain_evidence", entities: { ...base(ctx).entities, geneId: variant.geneId, variantId: variant.id }, actions: variant.evidenceIds.map((id) => ({ type: "revealEvidence" as const, evidenceId: id })), citations: variant.evidenceIds, explanationLevel: level, reason: null }, "variant-evidence");
    }
    if (experimental && varFeature) {
      const t = { kind: "feature" as const, featureId: varFeature.id };
      return r(
        {
          ...base(ctx),
          outcome: "plan",
          intent: "locate_variant",
          entities: { geneId: variant.geneId, proteinId: variant.proteinId, variantId: variant.id, structureId: varFeature.structureId },
          actions: [
            { type: "resolveVariant", variantId: variant.id },
            { type: "loadStructure", structureId: varFeature.structureId, assembly: "model" },
            { type: "focusCamera", target: t },
            { type: "highlightResidue", target: t },
            { type: "revealEvidence", evidenceId: variant.evidenceIds[0]! },
          ],
          citations: varFeature.evidenceIds,
          explanationLevel: level,
          followUps: sequenceActions(ctx) ? ["How does the DNA change at this codon?", "What does this residue touch in the crystal?"] : ["Why is this residue important?", "What does this residue touch in the crystal?"],
          reason: null,
        },
        "variant-locate",
      );
    }
  }
  if (predicted && PREDICTED.test(q)) {
    return r({ ...base(ctx), outcome: "plan", intent: "show_structure", entities: { ...base(ctx).entities, proteinId: predicted.proteinIds[0] ?? null, structureId: predicted.id }, actions: [{ type: "loadStructure", structureId: predicted.id, assembly: "model" }], citations: ctx.evidence.filter((e) => e.id.endsWith(predicted.id)).map((e) => e.id), explanationLevel: level, reason: null }, "predicted-structure");
  }
  if (experimental && STRUCTURE_NAMED.test(q)) {
    return r({ ...base(ctx), outcome: "plan", intent: "show_structure", entities: { ...base(ctx).entities, structureId: experimental.id }, actions: [{ type: "loadStructure", structureId: experimental.id, assembly: "model" }], citations: ctx.evidence.filter((e) => e.id === `pdb:${experimental.id}`).map((e) => e.id), explanationLevel: level, reason: null }, "experimental-structure");
  }
  if (STRUCTURE_ANY.test(q) && ctx.structures.length > 1) {
    return r(clarify(ctx, "show_structure", `Which structure: ${ctx.structures.map((s) => `${s.id} (${s.origin})`).join(" or ")}?`), "structure-ambiguous");
  }
  if (protein && PROTEIN_WORLD.test(q)) {
    return r({ ...base(ctx), outcome: "plan", intent: "show_protein", entities: { ...base(ctx).entities, proteinId: protein.id }, actions: [{ type: "enterWorld", world: "protein" }], citations: [], explanationLevel: level, reason: null }, "protein-world");
  }
  // D-H010: a request to show the molecule by name ("show me HBB", "open beta-globin") names Protein
  // World, so it opens Protein World instead of the gene rule below (whose Genome World the app
  // does not have). A question with a DNA cue ("the HBB gene") is routed to DNA World and keeps
  // the gene rule.
  if (protein && ctx.cueRules === "dh010" && routing?.world === "protein" && routing.why === "named" && (routing.cues.molecule?.length ?? 0) > 0 && SHOW.test(q) && ctx.worlds.some((w) => w.id === "protein" && w.available)) {
    return r({ ...base(ctx), outcome: "plan", intent: "show_protein", entities: { ...base(ctx).entities, proteinId: protein.id }, actions: [{ type: "enterWorld", world: "protein" }], citations: [], explanationLevel: level, reason: null }, "protein-world-named");
  }
  if (GLOBIN_UNQUALIFIED.test(q) && !/(beta|alpha|hbb)/.test(q)) {
    return r(clarify(ctx, "other", "Alpha or beta globin? Only beta-globin (HBB) has curated records here; 2HBS contains both chains."), "globin-ambiguous");
  }
  if (gene && GENE.test(q)) {
    return r({ ...base(ctx), outcome: "plan", intent: "show_gene", entities: { ...base(ctx).entities, geneId: gene.id }, actions: [{ type: "resolveGene", geneId: gene.id }, { type: "enterWorld", world: "genome" }], citations: ctx.evidence.filter((e) => e.id === `ensembl:${gene.id}`).map((e) => e.id), explanationLevel: level, reason: null }, "gene");
  }
  return r(refuse(ctx, "other", "This request is not one of the supported commands in the deterministic mode."), "no-rule");
}
