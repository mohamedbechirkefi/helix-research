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
import type { Action, Plan, Intent, SequenceTarget, DomainFeatureType } from "./schema.ts";
import { REPRESENTATIONS } from "./schema.ts";
import { NON_MANE_REASON, extractIdTokens } from "./validate.ts";
import { associationEvidenceId, pathwayEvidenceId, trustedContextJson, variantShortName, type PlanningContext } from "./context.ts";
import { routeQuestion, type Routing } from "./routing.ts";
import { contextualAnswer, deicticSubject } from "./contextual.ts";

export const FALLBACK_VERSION = "helix-fallback-v1";

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const CLINICAL =
  /\b(should (i|he|she|we|they|my)|am i|do i have|will (i|he|she|we|they) (get|be)|(i|he|she|we|they) (will|would|might|could|am going to|is going to|are going to) (get|be|become|develop|fall)|get sick|fall ill|make (me|him|her|us|them|my \w+) (sick|ill)|my (h(a)?emoglobin|blood|levels?|an(a)?emia|genes?|dna|cells?)|i carry|my (son|daughter|child|children|kids?|baby|partner|husband|wife|family|parents?|pregnancy|risk|chances?|test|genetic|doctor|results?|medication)|dose|dosage|medication|medicine|treat(ment)?|therap|hydroxyurea|folic|diagnos|prognos|symptom|que dois-je|mon enfant|ma fille|mon fils|medicament|traitement|porteur|porteuse)\b/;
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
const PATHWAY = /\b(pathways?|dna repair|reparation|voies?)\b/;

/** Phase 9 (P9.1.2): does the question ask about pathways (the word list of the pathway rule)? The app reads it to load the pathway record before planning. */
export function asksPathway(query: string): boolean {
  // Phase 10: a Reactome stable id ("show R-HSA-9615710") asks about a pathway too.
  return PATHWAY.test(fold(query)) || /\bR-HSA-\d+\b/i.test(query);
}
// Phase 9 (P9.1.3): a question about the diseases a gene is associated with (Open Targets; association, never causal).
const ASSOCIATION = /\b(diseases?|maladies?|open targets|disease associations?)\b|\bassociat(ed|ions?) with\b/;
/** Phase 9 (P9.1.3): does the question ask about disease associations? The app reads it to load the associations record before planning. */
export function asksAssociation(query: string): boolean {
  return ASSOCIATION.test(fold(query));
}
// Phase 10 (P10.1.1): one rule per explorer action, in the sets' words; each applies only when the build executes the action.
const TO_OVERVIEW = /\b(back to|return to|go back to|reset to|zoom out to|out to) (the )?overview\b|\breset the view\b|\bvue d'ensemble\b/;
const DNA_TO_PROTEIN = /\bfrom (the )?(dna|gene|sequence|codon|transcript) (world )?to (the )?(protein|structure|residue)\b|\b(begin|start|play) the (bridge|transition)\b/;
const PROTEIN_TO_DNA = /\bfrom (the )?(protein|structure|residue) (world )?to (the )?(dna|gene|sequence|codon)\b/;
const REPRESENTATION_WORDS: Record<string, (typeof REPRESENTATIONS)[number] | null> = { surface: "surface", cartoon: "cartoon", "ball and stick": "ball-and-stick", "ball-and-stick": "ball-and-stick", spacefill: "spacefill", "space-filling": "spacefill", "space filling": "spacefill", wireframe: null, ribbon: null, sticks: null, stick: null, lines: null, mesh: null, points: null };
const REPRESENTATION_Q = /\b(?:as|in|to) (?:an? )?(surface|cartoon|ball[- ]and[- ]stick|spacefill|space[- ]filling|wireframe|ribbon|sticks?|lines|mesh|points)\b|\b(surface|cartoon|ball[- ]and[- ]stick|spacefill|space[- ]filling|wireframe|ribbon|sticks?|lines|mesh|points) (?:view|representation|style|mode)\b/;
const TRANSCRIPT_Q = /\btranscripts?\b/;
const TRANSCRIPT_ID = /\bENST\d{11}(?:\.\d+)?\b/i;
const NAMED_PATHWAY = /\b(?:show|open|display|see|view|take me to|go to)(?: me)? (?:the )?(.+?) pathway\b/;
const STABLE_ID = /\bR-HSA-\d+\b/i;
const FEATURE_TYPE_WORDS: [RegExp, DomainFeatureType][] = [
  [/\btransmembrane\b/, "Transmembrane"],
  [/\bzinc fingers?\b/, "Zinc finger"],
  [/\btopological\b/, "Topological domain"],
  [/\bregions?\b/, "Region"],
];
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

/** "crystal" for an X-ray entry (the context's structure title carries the method), else "structure". */
function structureWord(s: PlanningContext["structures"][number] | null): string {
  return s && /x-ray/i.test(s.title) ? "crystal" : "structure";
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

const can = (ctx: PlanningContext, t: string) => ctx.executableActions.includes(t);
const worldOf = (ctx: PlanningContext, id: string) => ctx.worlds.find((w) => w.id === id) ?? null;

/**
 * Phase 10 (P10.1.1, docs/phase-10-ai-explorer.md section 2): the rules of the six explorer actions.
 * Each applies only when the context's build executes its action (so Phase 3 to 9 contexts plan as
 * before); each either plans the action with the records it consults or refuses with the reason.
 */
function phase10Rule(query: string, q: string, ctx: PlanningContext, level: Plan["explanationLevel"]): { plan: Plan; rule: string } | null {
  const gene = ctx.genes[0] ?? null;
  const protein = ctx.proteins[0] ?? null;
  const symbol = gene?.symbol ?? "this gene";
  const plan = (intent: Intent, actions: Action[], citations: string[] = [], reason: string | null = null, entities: Partial<Plan["entities"]> = {}): Plan => ({ ...base(ctx), outcome: "plan", intent, entities: { ...base(ctx).entities, ...entities }, actions, citations, explanationLevel: level, reason });
  const proteinWorld = worldOf(ctx, "protein");

  // beginTransition: the bridge sequence as an action; only DNA World to Protein World exists.
  if (can(ctx, "beginTransition") && (DNA_TO_PROTEIN.test(q) || PROTEIN_TO_DNA.test(q))) {
    const only = "The only transition is from DNA World to Protein World (the bridge sequence, codon to residue through the records)";
    if (PROTEIN_TO_DNA.test(q) && !DNA_TO_PROTEIN.test(q)) return { plan: refuse(ctx, "other", `${only}; there is no transition from Protein World to DNA World. Use the world switcher to go back to DNA World.`), rule: "transition-unavailable" };
    if (!proteinWorld?.available) return { plan: refuse(ctx, "other", `${only}, and Protein World is not available for ${symbol}: ${proteinWorld?.reason ?? "no scene"}.`), rule: "transition-no-protein-world" };
    if (ctx.currentWorld !== undefined && ctx.currentWorld !== "dna") return { plan: refuse(ctx, "other", `${only}; it starts in DNA World, and ${ctx.currentWorld === "protein" ? "Protein" : ctx.currentWorld === "pathway" ? "Pathway" : ctx.currentWorld} World is on screen.`), rule: "transition-not-in-dna" };
    const variant = ctx.variants[0] ?? null;
    const f = variant ? (ctx.features.find((x) => x.id === variant.featureId) ?? null) : null;
    const actions: Action[] = [{ type: "beginTransition", from: "dna", to: "protein" }];
    if (variant && f) {
      const t = { kind: "feature" as const, featureId: f.id };
      actions.push({ type: "focusCamera", target: t }, { type: "highlightResidue", target: t }, ...variant.evidenceIds.slice(0, 1).map((id) => ({ type: "revealEvidence" as const, evidenceId: id })));
      return { plan: plan("locate_variant", actions, f.evidenceIds, null, { geneId: variant.geneId, proteinId: variant.proteinId, variantId: variant.id, structureId: f.structureId }), rule: "transition" };
    }
    return { plan: plan("show_protein", actions, [], null, { proteinId: protein?.id ?? null }), rule: "transition" };
  }

  // returnToOverview: the world on screen back to its overview.
  if (can(ctx, "returnToOverview") && TO_OVERVIEW.test(q)) {
    return { plan: plan("other", [{ type: "returnToOverview" }], gene ? ctx.evidence.filter((e) => e.id === `ensembl:${gene.id}`).map((e) => e.id) : []), rule: "overview" };
  }

  // setRepresentation: the closed list, on the structure in Protein World.
  const rep = can(ctx, "setRepresentation") ? q.match(REPRESENTATION_Q) : null;
  if (rep) {
    const word = (rep[1] ?? rep[2] ?? "").replace(/-/g, " ");
    const representation = REPRESENTATION_WORDS[word] ?? REPRESENTATION_WORDS[word.replace(/ /g, "-")] ?? null;
    const list = REPRESENTATIONS.join(", ");
    if (!representation) return { plan: refuse(ctx, "show_structure", `"${word}" is not one of the representations Helix draws; the closed list is ${list}.`), rule: "representation-unknown" };
    if (!proteinWorld?.available) return { plan: refuse(ctx, "show_structure", `No structure can be drawn for ${symbol}: ${proteinWorld?.reason ?? "no Protein World"}.`), rule: "representation-no-structure" };
    if (ctx.currentWorld !== undefined && ctx.currentWorld !== "protein") return { plan: refuse(ctx, "show_structure", `The representation applies to the structure in Protein World; ${ctx.currentWorld === "dna" ? "DNA" : ctx.currentWorld === "pathway" ? "Pathway" : ctx.currentWorld} World is on screen. Open the structure in Protein World first.`), rule: "representation-not-in-protein" };
    if (!ctx.loadedStructureId) return { plan: refuse(ctx, "show_structure", "No structure is on screen, so there is no representation to change. Load the structure first."), rule: "representation-no-structure" };
    return { plan: plan("show_structure", [{ type: "setRepresentation", representation }], ctx.evidence.filter((e) => e.id === `pdb:${ctx.loadedStructureId}`).map((e) => e.id), null, { structureId: ctx.loadedStructureId }), rule: "representation" };
  }

  // selectTranscript: a candidate of the records; only the MANE Select transcript is executable.
  if (can(ctx, "selectTranscript") && (TRANSCRIPT_Q.test(q) || TRANSCRIPT_ID.test(query))) {
    const candidates = ctx.transcriptCandidates ?? ctx.transcripts.map((t) => ({ id: t.versioned, maneSelect: t.label.startsWith("MANE Select"), source: "context" }));
    const mane = candidates.find((c) => c.maneSelect) ?? null;
    const named = query.match(TRANSCRIPT_ID)?.[0] ?? null;
    const cite = gene ? ctx.evidence.filter((e) => e.id === `ensembl:${gene.id}`).map((e) => e.id) : [];
    if (named) {
      const c = candidates.find((x) => x.id.toUpperCase() === named.toUpperCase() || x.id.replace(/\.\d+$/, "").toUpperCase() === named.toUpperCase());
      if (!c) return { plan: refuse(ctx, "show_gene", `${named} is not a transcript the curated records name for ${symbol}.`), rule: "transcript-unknown" };
      if (!c.maneSelect) return { plan: refuse(ctx, "show_gene", `${c.id} is not shown: ${NON_MANE_REASON}${mane ? ` (the curated transcript is ${mane.id}, MANE Select)` : ""}.`), rule: "transcript-not-mane" };
      return { plan: plan("show_gene", [{ type: "selectTranscript", transcriptId: c.id }], cite, null, { geneId: gene?.id ?? null }), rule: "transcript" };
    }
    if (!mane) return { plan: refuse(ctx, "show_gene", `No MANE Select transcript is recorded for ${symbol}.`), rule: "transcript-none" };
    return { plan: plan("show_gene", [{ type: "selectTranscript", transcriptId: mane.id }], cite, null, { geneId: gene?.id ?? null }), rule: "transcript" };
  }

  // showPathway: a named membership (its name or stable id), or the record's opening pathway.
  const named = can(ctx, "showPathway") ? (query.match(STABLE_ID)?.[0] ?? q.match(NAMED_PATHWAY)?.[1] ?? null) : null;
  if (named !== null) {
    const pathwayWorld = worldOf(ctx, "pathway");
    const isId = STABLE_ID.test(named);
    const words = fold(named).replace(/^(?:reactome|curated)\s+/, "").trim();
    const generic = !isId && (words === "" || [gene?.symbol, ...(gene?.aliases ?? []), protein?.name, protein?.id, "reactome", "its", "this", "a", "the"].filter((x): x is string => typeof x === "string").some((x) => fold(x) === words));
    if (!generic) {
      if (!pathwayWorld?.available) return { plan: refuse(ctx, "other", `Pathway World is not available for ${symbol}: ${pathwayWorld?.reason ?? "no pathway records"}.`), rule: "pathway-unavailable" };
      const evId = protein ? pathwayEvidenceId(protein.id) : null;
      const cited = evId && ctx.evidence.some((e) => e.id === evId) ? [evId] : [];
      const memberships = ctx.pathways ?? [];
      const opening = /^(opening|first|default)$/.test(words);
      const hit = opening ? (memberships.find((m) => m.isOpening) ?? null) : isId ? (memberships.find((m) => m.stableId.toLowerCase() === named.toLowerCase()) ?? null) : (memberships.find((m) => fold(m.name) === words) ?? memberships.find((m) => fold(m.name).includes(words)) ?? null);
      if (!hit) {
        const head = `No Reactome membership of ${protein?.id ?? symbol} matches "${named}"`;
        const byName = `${head}; the record lists ${memberships.map((m) => `${m.name} (${m.stableId})`).join("; ")}.`;
        const byId = `${head}; the record lists ${memberships.length} membership${memberships.length === 1 ? "" : "s"}: ${memberships.map((m) => m.stableId).join(", ")}.`;
        return { plan: refuse(ctx, "other", memberships.length === 0 ? `${head}.` : byName.length <= 400 ? byName : byId.slice(0, 400)), rule: "pathway-no-membership" };
      }
      return { plan: plan("other", [{ type: "showPathway", stableId: hit.stableId }, ...cited.map((id) => ({ type: "revealEvidence" as const, evidenceId: id }))], cited, null, { geneId: gene?.id ?? null, proteinId: protein?.id ?? null }), rule: "pathway-named" };
    }
  }

  // showProteinDomains: the protein record's features of the explorer types (the set read from the record).
  if (can(ctx, "showProteinDomains") && ctx.proteinFeatures !== undefined && (DOMAINS.test(q) || /\b(transmembrane|zinc fingers?|topological)\b/.test(q))) {
    if (!protein) return { plan: refuse(ctx, "show_domains", "No protein record is in this context."), rule: "domains-no-protein" };
    const feats = ctx.proteinFeatures.filter((f) => f.proteinAccession === protein.id);
    if (feats.length === 0) return { plan: refuse(ctx, "show_domains", `The UniProt record of ${protein.id} (${symbol}) lists no feature of type Domain, Region, Topological domain, Transmembrane or Zinc finger, so there is no domain to show.`), rule: "domains-none" };
    const asked = FEATURE_TYPE_WORDS.filter(([re]) => re.test(q)).map(([, t]) => t);
    const present = asked.filter((t) => feats.some((f) => f.type === t));
    if (asked.length > 0 && present.length === 0) return { plan: refuse(ctx, "show_domains", `The UniProt record of ${protein.id} lists no feature of type ${asked.join(", ")}; it lists ${[...new Set(feats.map((f) => f.type))].join(", ")}.`), rule: "domains-type-none" };
    const ev = `uniprot:${protein.id}`;
    const cited = ctx.evidence.some((e) => e.id === ev) ? [ev] : [];
    return { plan: plan("show_domains", [{ type: "showProteinDomains", proteinAccession: protein.id, ...(present.length > 0 ? { featureTypes: present } : {}) }, ...cited.map((id) => ({ type: "revealEvidence" as const, evidenceId: id }))], cited, null, { geneId: gene?.id ?? null, proteinId: protein.id }), rule: "protein-domains" };
  }
  return null;
}

/**
 * Phase 10 (P10.1.2, plan section 3): a question bound to the selection, answered from the selection
 * facts. Applies only to contexts that carry the contextual records (the app's); Phase 3 to 9 contexts
 * plan as before. The actions show the selection in the world on screen (the codon on the sequence in
 * DNA World, the residue in Protein World; the recorded contacts of that exact residue when asked);
 * the citations are the records the answer reads, never the variant's for a non-variant selection.
 */
function contextualRule(query: string, ctx: PlanningContext, level: Plan["explanationLevel"]): { plan: Plan; rule: string } | null {
  const facts = ctx.selectionFacts ?? null;
  const d = deicticSubject(query);
  if (!facts) {
    if (d && d.subject !== "residue") return { plan: clarify(ctx, "explain_selection", "Nothing is selected. Select a codon in DNA World or a residue in Protein World first."), rule: "contextual-nothing-selected" };
    return null;
  }
  const answer = contextualAnswer(query, ctx);
  if (!answer || !facts.binding) return null;
  if (facts.binding.target === "codon" && !facts.codon) return { plan: clarify(ctx, "explain_selection", `No codon is linked to the selection${facts.unmappedReason ? `: ${facts.unmappedReason}` : ""}.`), rule: "contextual-no-codon" };
  const known = new Set(ctx.evidence.map((e) => e.id));
  const cited = [...new Set(answer.sentences.flatMap((x) => x.evidenceIds).filter((id) => known.has(id)))];
  const actions: Action[] = [];
  let rule = `contextual-${answer.kind}`;
  const inDna = ctx.currentWorld === "dna" || (ctx.currentWorld !== "protein" && facts.binding.target === "codon");
  if (inDna && facts.codon && ctx.sequenceSelection && sequenceActions(ctx)) {
    actions.push({ type: "highlightSequenceRegion", target: { kind: "selection" } });
  } else if (facts.residue && ctx.selection) {
    const r = facts.residue;
    const contact = answer.kind === "contacts" && facts.contacts?.status === "recorded" ? (ctx.features.find((f) => f.kind === "contact" && f.structureId === r.structureId && f.chains[0] === r.chainId && f.id.includes(`_contact_${r.chainId}${r.residueNumber}_`)) ?? null) : null;
    if (contact) {
      const t = { kind: "feature" as const, featureId: contact.id };
      actions.push({ type: "focusCamera", target: t }, { type: "highlightResidue", target: t });
      rule = "contextual-contacts-recorded";
    } else {
      actions.push({ type: "focusCamera", target: { kind: "selection" } }, { type: "highlightResidue", target: { kind: "selection" } });
    }
  }
  actions.push(...cited.map((id) => ({ type: "revealEvidence" as const, evidenceId: id })));
  return {
    plan: {
      ...base(ctx),
      outcome: "plan",
      intent: "explain_selection",
      entities: { geneId: null, proteinId: facts.protein?.accession ?? null, variantId: facts.variant?.id ?? null, structureId: facts.residue?.structureId ?? null },
      actions,
      citations: cited,
      explanationLevel: level,
      reason: null,
    },
    rule,
  };
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
  // Phase 9: the set's own variant is asked for by the generic words or by the record's short name (F508del on the CFTR set; HbS is in the word list already).
  const variantAsked = VARIANT.test(q) || (variant !== null && q.includes(fold(variantShortName(variant.label))));
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
  // Phase 9: a named variant is foreign only when the trusted context does not carry it (the set's own variant may be one of these names, F508del on the CFTR set).
  const namedVariant = q.match(OTHER_VARIANTS);
  if (namedVariant && !trusted.includes(namedVariant[1]!)) {
    const own = variant ? `the ${variantShortName(variant.label)} variant` : "no variant";
    return r(refuse(ctx, "compare_variants", sequenceActions(ctx) ? `Only ${own} is in the curated records; other variants are not available.` : `Only ${own} is in the curated records; other variants are not available, and variant comparison is not executable in this build.`), "foreign-variant");
  }

  // 3. Cancel.
  if (CANCEL.test(q)) return r({ ...base(ctx), outcome: "plan", intent: "cancel", actions: [{ type: "cancelActions" }], reason: null }, "cancel");

  // 4a. Phase 10 (P10.1.2): a question bound to the selection (contexts with the contextual records only).
  if (ctx.contextualRecords !== undefined) {
    const c = contextualRule(query, ctx, level);
    if (c) return r(c.plan, c.rule);
  }

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
    if (CONTACT.test(q)) return r(clarify(ctx, "explain_selection", `No curated contact data exists for ${sel.chainId}${sel.residueNumber}; contacts are curated only for the ${variant ? variantShortName(variant.label) : "variant"} residue on chain ${contactFeature?.chains[0] ?? "?"}.`), "selection-contact-missing");
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

  // 4b. Phase 10 (P10.1.1): the explorer actions, one rule each, when the build executes them.
  const explorer = phase10Rule(query, q, ctx, level);
  if (explorer) return r(explorer.plan, explorer.rule);

  // 5. Ambiguity.
  if (RESIDUE_NUMBER.test(q)) return r(clarify(ctx, "other", "Which numbering, protein and chain? For beta-globin, translated numbering (Met = 1) and mature numbering differ by one."), "residue-number");
  if (COMPARE.test(q)) {
    if (sequenceActions(ctx) && variant) return r(sequencePlan(ctx, variant, { kind: "variant", variantId: variant.id }, level, null), "compare-sequence");
    return r(refuse(ctx, "compare_variants", "Variant comparison is not executable in this build."), "compare");
  }
  if (DOMAINS.test(q)) return r(refuse(ctx, "show_domains", "Protein domain display is not executable in this build."), "domains");
  // Phase 9 (P9.1.2): a pathway question opens Pathway World when the set has Reactome memberships
  // (membership only, class 2); the citation is the record's evidence, so the explanation names the
  // memberships with their class. Without the world, the Phase 3 refusal.
  if (PATHWAY.test(q)) {
    const pathwayWorld = ctx.worlds.find((w) => w.id === "pathway") ?? null;
    if (pathwayWorld?.available) {
      const evId = protein ? pathwayEvidenceId(protein.id) : null;
      const cited = evId && ctx.evidence.some((e) => e.id === evId) ? [evId] : [];
      return r({ ...base(ctx), outcome: "plan", intent: "other", entities: { ...base(ctx).entities, geneId: gene?.id ?? null, proteinId: protein?.id ?? null }, actions: [{ type: "enterWorld", world: "pathway" }, ...cited.map((id) => ({ type: "revealEvidence" as const, evidenceId: id }))], citations: cited, explanationLevel: level, reason: null }, "pathway-world");
    }
    return r(refuse(ctx, "other", "No curated pathway records are available in this context."), "pathway");
  }
  // Phase 9 (P9.1.3): a disease question reveals the set's Open Targets associations (class 2; association,
  // never causal) when the record is in the context; no world changes. Without the record, a refusal that says so.
  if (ASSOCIATION.test(q)) {
    const evId = gene ? associationEvidenceId(gene.id) : null;
    if (ctx.associations && ctx.associations.length > 0 && evId && ctx.evidence.some((e) => e.id === evId)) {
      return r({ ...base(ctx), outcome: "plan", intent: "other", entities: { ...base(ctx).entities, geneId: gene?.id ?? null, proteinId: protein?.id ?? null }, actions: [{ type: "revealEvidence", evidenceId: evId }], citations: [evId], explanationLevel: level, reason: null }, "associations");
    }
    return r(refuse(ctx, "other", "No curated disease-association records are available in this context."), "associations-none");
  }

  // 6. Supported commands.
  // Phase 6: the DNA-level change of the variant, on the sequence next to the reference.
  if (variant && sequenceActions(ctx) && SEQUENCE_CHANGE.test(q) && (variantAsked || /\b(it|this|that)\b/.test(q))) {
    return r(sequencePlan(ctx, variant, { kind: "variant", variantId: variant.id }, level, null), "variant-sequence");
  }
  // Phase 6 (blueprint E): no experimental structure with a verified mapping. Say so and show the
  // variant on the sequence instead; a predicted model is never substituted.
  if (variant && variantAsked && !experimental && !EVIDENCE.test(q)) {
    const why = "No experimental structure with a verified residue mapping is available for this variant in the curated records here, so it is not placed on a 3D structure; a predicted model is never used instead.";
    if (sequenceActions(ctx)) return r(sequencePlan(ctx, variant, { kind: "variant", variantId: variant.id }, level, `${why} The change is shown on the transcript sequence instead.`), "variant-no-structure-sequence");
    return r(refuse(ctx, "locate_variant", why), "variant-no-structure");
  }
  if (variant && experimental && contactFeature && CONTACT.test(q) && (variantAsked || /\b(valine|val) ?6\b|\bchain h\b/.test(q))) {
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
  if (routing?.world === "dna" && variant && sequenceActions(ctx) && variantAsked && !EVIDENCE.test(q) && ctx.worlds.some((w) => w.id === "dna" && w.available)) {
    return r(sequencePlan(ctx, variant, { kind: "variant", variantId: variant.id }, level, null), routing.why === "named" ? "variant-sequence" : "variant-sequence-current-world");
  }
  if (variant && variantAsked) {
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
          // The follow-up names the structure as the record does: a crystal for an X-ray entry, the structure otherwise (a cryo-EM entry is not a crystal).
          followUps: sequenceActions(ctx) ? ["How does the DNA change at this codon?", `What does this residue touch in the ${structureWord(experimental)}?`] : ["Why is this residue important?", `What does this residue touch in the ${structureWord(experimental)}?`],
          reason: null,
        },
        "variant-locate",
      );
    }
  }
  // Phase 9 (P9.2.4): a set without an experimental structure. A request for the structure, the
  // predicted model or Protein World is refused with the set's own reason (the capability report's
  // words, carried by the context's protein world); a predicted model is never substituted.
  const proteinWorld = ctx.worlds.find((w) => w.id === "protein") ?? null;
  if (!experimental && proteinWorld && !proteinWorld.available && (STRUCTURE_ANY.test(q) || PREDICTED.test(q) || PROTEIN_WORLD.test(q) || (routing?.world === "protein" && SHOW.test(q)))) {
    const model = predicted ? ` The predicted model ${predicted.id} is listed as a computational prediction and is not loaded.` : "";
    return r(refuse(ctx, "show_structure", `No experimental structure can be shown for ${gene?.symbol ?? "this gene"}: ${proteinWorld.reason}.${model} A predicted model is never shown as an experimental structure.`), "structure-unavailable");
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
