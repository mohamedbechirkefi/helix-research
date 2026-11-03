// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * The planning context (P3.1.1): the trusted, resolved records a plan may reference.
 *
 * A plan is grounded only if every identifier it uses appears here. The context is built by
 * deterministic code from the curated records (data/curated/<gene>/), never by a model.
 * Retrieved free text (literature snippets, record comments) is carried separately as
 * untrusted data: it is shown to the model but never counts as grounding.
 */
import { z } from "zod";
import type { CueRules } from "./routing.ts";

export const WORLDS = ["overview", "genome", "dna", "protein", "pathway"] as const;
export type World = (typeof WORLDS)[number];
/** First answer of a session, or a follow-up to an earlier answer (D-H007). */
export type AnswerKind = "first" | "follow-up";

export interface ContextGene {
  id: string;
  symbol: string;
  name: string;
  hgncId: string;
  aliases: string[];
}
export interface ContextTranscript {
  id: string;
  versioned: string;
  geneId: string;
  label: string;
}
export interface ContextProtein {
  id: string;
  geneId: string;
  name: string;
  length: number;
}
export interface ContextVariant {
  id: string;
  label: string;
  geneId: string;
  proteinId: string;
  names: string[];
  featureId: string;
  evidenceIds: string[];
}
export interface ContextAssembly {
  id: string;
  label: string;
  chains: string[];
}
export interface ContextStructure {
  id: string;
  origin: "experimental" | "predicted";
  title: string;
  proteinIds: string[];
  assemblies: ContextAssembly[];
  /** May a variant be placed on it (verified residue mapping on an experimental structure)? */
  variantPlacement: boolean;
}
export interface ContextFeature {
  id: string;
  kind: "residue" | "contact";
  label: string;
  proteinId: string;
  structureId: string;
  chains: string[];
  /** For a residue feature, its author residue number in the structure (same on every chain). */
  authSeqId: number | null;
  /** Assemblies in which every residue of the feature is present. */
  assemblies: string[];
  evidenceIds: string[];
}
export interface ContextEvidence {
  id: string;
  category: number;
  statement: string;
}
/**
 * One Reactome pathway that lists the set's protein (Phase 9, P9.1.2; plan section 12 rule 6): a
 * database annotation, class 2, membership only. `isOpening` marks the membership Pathway World
 * opens on, the rule's choice (fewest participants among non-disease pathways with a diagram),
 * never an importance. `membership` is one sentence an explanation may quote, composed from the
 * record by deterministic code.
 */
export interface ContextPathway {
  stableId: string;
  name: string;
  topLevelPathway: string | null;
  isOpening: boolean;
  isDisease: boolean;
  membership: string;
}
/**
 * One Open Targets disease association of the set's gene (Phase 9, P9.1.3; plan section 14 rule 4): a
 * database annotation, class 2, scored evidence that links the gene to a disease, never a cause.
 * `association` is one sentence an explanation may quote, composed from the record by deterministic
 * code; it carries the never-causal sentence.
 */
export interface ContextAssociation {
  diseaseId: string;
  name: string;
  score: number;
  association: string;
}
export interface ContextSelection {
  structureId: string;
  chainId: string;
  residueNumber: number;
  numbering: "auth";
  compId: string;
  /** The feature this residue belongs to, if any (resolved by deterministic code). */
  featureId: string | null;
}
export interface RetrievedSnippet {
  source: string;
  text: string;
}

export interface PlanningContext {
  contextId: string;
  genes: ContextGene[];
  transcripts: ContextTranscript[];
  proteins: ContextProtein[];
  variants: ContextVariant[];
  structures: ContextStructure[];
  features: ContextFeature[];
  evidence: ContextEvidence[];
  /**
   * The Reactome memberships of the set's protein, by stable id (Phase 9, P9.1.2), present only when
   * the pathways record was given to the builder (the app loads that record on first need, so a
   * context may gain this field after it was built; Phase 3 to 8 contexts never carry it).
   */
  pathways?: ContextPathway[];
  /**
   * The Open Targets associations of the set's gene, in the record's order (by score; Phase 9, P9.1.3),
   * present only when the disease-associations record was given to the builder (the app loads that
   * record on first need, as it does the pathways record; earlier contexts never carry it).
   */
  associations?: ContextAssociation[];
  worlds: { id: World; available: boolean; reason: string }[];
  /** Actions in the vocabulary that this build can execute. */
  executableActions: string[];
  /** Session state: what the user has selected, and what is loaded. */
  selection: ContextSelection | null;
  /** The DNA-side selection (Phase 6): a codon of the selected transcript. Absent in Phase 3 contexts. */
  sequenceSelection?: { transcriptId: string; codon: number } | null;
  /**
   * Whether this question opens the session's answers ("first") or follows an earlier answer
   * ("follow-up"), set by deterministic code (D-H007: a first answer stays in one world, checked by
   * validatePlan). Absent in Phase 3 to 6 contexts, whose prompt and validation are then unchanged.
   */
  answer?: AnswerKind;
  /** The world on screen when the question was asked (D-H007). Absent in Phase 3 to 6 contexts. */
  currentWorld?: World;
  /**
   * Route answers by the question's cue words (author decision D-H008, 2026-11-02; routing.ts): the
   * prompt is v4, the rule-based planner answers a neutral variant question in the current world,
   * and validatePlan rejects a first answer that goes to the other world than the one the question
   * names without doubt. Absent: the D-H007 behaviour (prompt v3), kept reproducible.
   */
  routeByCues?: boolean;
  /**
   * Which cue lists a routed context uses (routing.ts): absent or "dh008", the D-H008 lists and
   * prompt v4 (kept reproducible); "dh010" (author decision D-H010, 2026-11-02), the molecule names
   * and "chain" are protein cues, an explicit DNA cue beats a molecule name, and the prompt is v5.
   * Read only when routeByCues is set.
   */
  cueRules?: CueRules;
  /**
   * The routing instructions the model gets (author decision D-H011, 2026-11-02): "dh011" sends
   * prompt v6 (rule 13 rewritten as a cue table, so that the model itself routes the molecule names
   * to Protein World). Read only when routeByCues is set and cueRules is "dh010"; absent, prompt v5
   * (kept reproducible). The cue lists, the rule-based planner and the world-cue check are unchanged.
   */
  routingPrompt?: "dh011";
  loadedStructureId: string | null;
  /** Untrusted text shown to the model as data. Never grounding. */
  retrieved: RetrievedSnippet[];
}

// ---------------------------------------------------------------------------------------
// Builder from the curated HBB records. Only the fields used here are parsed; the curated
// records themselves are validated by scientific-core at build time (Phase 2).

const Ev = z.object({ category: z.number(), statement: z.string() }).loose();
const GeneIn = z
  .object({
    id: z.object({ id: z.string() }).loose(),
    symbol: z.string(),
    description: z.string(),
    hgncId: z.string(),
    aliases: z.array(z.string()),
    selection: z.object({ selected: z.object({ id: z.string(), version: z.number() }).loose() }).loose(),
    evidence: z.array(Ev).optional(),
  })
  .loose();
const TranscriptIn = z
  .object({
    id: z.object({ id: z.string(), version: z.number() }).loose(),
    refSeqMatch: z.object({ id: z.string(), version: z.number() }).loose().nullable(),
    maneSelect: z.boolean(),
  })
  .loose();
const ProteinIn = z
  .object({ accession: z.string(), entryName: z.string(), length: z.number(), evidence: z.array(Ev) })
  .loose();
/**
 * A variant record of either kind (Phase 9, docs/phase-9-generalisation.md section 11 rule 2):
 * `variantKind` is absent on the substitution records written before Phase 9 and read as
 * "substitution"; a deletion carries `proteinChangeComputed` (p. in three-letter form) and the
 * mature numbering fields are null when the processed chain starts at Met1.
 */
const VariantIn = z
  .object({
    key: z.string(),
    commonName: z.string(),
    rsId: z.string(),
    variantKind: z.enum(["substitution", "deletion"]).optional(),
    allele: z.object({ reference: z.string().optional(), alternate: z.string() }).loose(),
    hgvs: z.object({ coding: z.array(z.string()), protein: z.array(z.string()) }).loose(),
    numbering: z.object({ translatedPosition: z.number(), maturePosition: z.number().nullable(), matureLabel: z.string().nullable(), translatedLabel: z.string() }).loose(),
    proteinChangeComputed: z.string().optional(),
    clinvar: z.object({ accession: z.string(), classification: z.string(), reviewStatus: z.string() }).loose(),
    evidence: z.array(Ev),
  })
  .loose();
/**
 * The structure record's coverage of the mapped chain (Phase 9, P9.2.2; plan section 13 rule 3):
 * present on every set built after that rule, absent on older records. The sentence and the
 * numbers are the record's; the app and the context repeat them and never recompute them.
 */
const CoverageIn = z.object({ fraction: z.number(), text: z.string(), proteinLength: z.number(), observedPositions: z.number(), firstObservedPosition: z.number(), lastObservedPosition: z.number() }).loose();
const StructureIn = z
  .object({
    entryId: z.string(),
    title: z.string(),
    method: z.string(),
    resolutionAngstrom: z.number().nullable(),
    /** Models in the deposited entry (an NMR ensemble has several) and the one mapped, measured and shown; absent on records written before P9.2.2 (one model). */
    modelCount: z.number().optional(),
    modelShown: z.number().optional(),
    coverage: CoverageIn.optional(),
    assemblies: z.array(z.object({ id: z.string(), polymerAsymIds: z.array(z.string()) }).loose()),
    chains: z.array(z.object({ labelAsymId: z.string() }).loose()).optional(),
    entities: z.array(z.object({ type: z.string(), strandIds: z.array(z.string()), siftsUniprot: z.array(z.string()) }).loose()),
    citation: z.object({ pubmedId: z.string().nullable(), doi: z.string().nullable() }).loose().nullable(),
    evidence: z.array(Ev),
  })
  .loose();
const MappingIn = z
  .object({
    uniprotAccession: z.string(),
    uniprotPosition: z.number(),
    /** Null when the processed chain starts at Met1 (the structure numbers the residue as UniProt does). */
    maturePosition: z.number().nullable(),
    entryId: z.string(),
    residues: z.array(z.object({ authAsymId: z.string(), authSeqId: z.string(), assemblyId: z.string(), compId: z.string() }).loose()),
    evidence: z.array(Ev),
  })
  .loose();
const ContactsIn = z
  .object({
    entryId: z.string(),
    scope: z.string(),
    cutoffAngstrom: z.number(),
    chains: z.array(
      z
        .object({
          residue: z.object({ authAsymId: z.string(), authSeqId: z.string(), compId: z.string() }).loose(),
          contacts: z.array(z.object({ authAsymId: z.string(), authSeqId: z.number(), compId: z.string() }).loose()),
        })
        .loose(),
    ),
    evidence: z.array(Ev),
  })
  .loose();
const PredictedIn = z
  .object({ modelId: z.string(), uniprotAccession: z.string(), globalPlddt: z.number(), usableForVariantPlacement: z.boolean(), evidence: z.array(Ev) })
  .loose();

/**
 * The curated records of one set, as the app's loader finds them by manifest kind. Phase 9: a set
 * may lack a variant, a structure, a residue mapping, a contacts record or a predicted model; such
 * a record is null and the context is built without it. `capabilities` is the set's capability
 * report (capabilities.json): its reasons are the words the context carries for what is missing.
 * The name is kept from Phase 3 (every consumer imports it); the bundle is not HBB-specific.
 */
export interface HbbBundle {
  gene: unknown;
  transcript: unknown;
  protein: unknown;
  variant: unknown | null;
  structure: unknown | null;
  mapping: unknown | null;
  contacts: unknown | null;
  predicted: unknown | null;
  capabilities?: unknown | null;
  /** Phase 9 (P9.1.2): the pathway-memberships record (pathways.json), when it has been loaded. */
  pathways?: unknown | null;
  /** Phase 9 (P9.1.3): the disease-associations record (associations.json), when it has been loaded. */
  associations?: unknown | null;
}

const CapabilitiesIn = z
  .object({
    experimentalStructure: z.object({ available: z.boolean(), reason: z.string() }).loose(),
    predictedStructure: z.object({ available: z.boolean(), reason: z.string() }).loose().optional(),
    verifiedResidueMapping: z.object({ available: z.boolean(), reason: z.string() }).loose().optional(),
    pathwayView: z.object({ available: z.boolean(), reason: z.string() }).loose().optional(),
  })
  .loose();

/** The fields of the pathway-memberships record the context reads (the record itself is validated by shared-types at build time). */
const PathwaysIn = z
  .object({
    kind: z.literal("pathway-memberships"),
    accession: z.string(),
    release: z.string(),
    membershipCount: z.number(),
    memberships: z.array(
      z
        .object({
          stableId: z.string(),
          name: z.string(),
          isDisease: z.boolean(),
          isOpening: z.boolean(),
          participantCount: z.number().nullable(),
          topLevelPathways: z.array(z.object({ stableId: z.string(), name: z.string() }).loose()),
        })
        .loose(),
    ),
    openingPathway: z.object({ stableId: z.string(), name: z.string() }).loose().nullable(),
    evidence: z.array(Ev),
  })
  .loose();

/** The evidence id of a set's pathway-memberships record in the context. */
export const pathwayEvidenceId = (accession: string): string => `reactome:${accession}`;

/**
 * The context's pathway entries and the record's evidence, from the pathway-memberships record
 * (Phase 9, P9.1.2). Used by the builder when the record is in the bundle, and by the app when the
 * record is loaded later (it is fetched on first need, never at start). Every word comes from the
 * record; no membership is called primary or important.
 */
export function pathwayContext(record: unknown): { accession: string; pathways: ContextPathway[]; evidence: ContextEvidence[] } {
  const p = PathwaysIn.parse(record);
  const pathways: ContextPathway[] = p.memberships.map((m) => {
    const top = m.topLevelPathways[0]?.name ?? null;
    const flags = [m.isDisease ? "a disease pathway" : null, m.isOpening ? "the membership Pathway World opens on, by rule (fewest participants among non-disease pathways with a diagram)" : null].filter((x): x is string => x !== null);
    return {
      stableId: m.stableId,
      name: m.name,
      topLevelPathway: top,
      isOpening: m.isOpening,
      isDisease: m.isDisease,
      membership: `${m.name} (${m.stableId}${top ? `, under ${top}` : ""}) lists ${p.accession} in Reactome ${p.release}: database annotation, class 2, membership only${flags.length ? `; ${flags.join("; ")}` : ""}.`,
    };
  });
  const evidence: ContextEvidence[] = [];
  const e = p.evidence[0];
  if (e) evidence.push({ id: pathwayEvidenceId(p.accession), category: e.category, statement: e.statement });
  return { accession: p.accession, pathways, evidence };
}

/** The fields of the disease-associations record the context reads (the record itself is validated by shared-types at build time). */
const AssociationsIn = z
  .object({
    kind: z.literal("disease-associations"),
    ensemblGeneId: z.string(),
    approvedSymbol: z.string(),
    platform: z.object({ apiVersion: z.string(), dataVersion: z.string() }).loose(),
    count: z.number(),
    associations: z.array(z.object({ diseaseId: z.string(), diseaseName: z.string(), score: z.number() }).loose()),
    note: z.string(),
    evidence: z.array(Ev),
  })
  .loose();

/** The evidence id of a set's disease-associations record in the context. */
export const associationEvidenceId = (ensemblGeneId: string): string => `opentargets:${ensemblGeneId}`;

/**
 * The context's association entries and the record's evidence, from the disease-associations
 * record (Phase 9, P9.1.3). Used by the builder when the record is in the bundle, and by the app when
 * the record is loaded later (fetched on first need, never at start). Every word comes from the
 * record; no association is called a cause.
 */
export function associationContext(record: unknown): { ensemblGeneId: string; associations: ContextAssociation[]; evidence: ContextEvidence[] } {
  const a = AssociationsIn.parse(record);
  const associations: ContextAssociation[] = a.associations.map((r) => ({
    diseaseId: r.diseaseId,
    name: r.diseaseName,
    score: r.score,
    association: `${r.diseaseName} (${r.diseaseId}) is associated with ${a.approvedSymbol} in Open Targets ${a.platform.apiVersion} (data ${a.platform.dataVersion}) with score ${r.score}: database annotation, class 2; ${a.note}.`,
  }));
  const evidence: ContextEvidence[] = [];
  const e = a.evidence[0];
  if (e) evidence.push({ id: associationEvidenceId(a.ensemblGeneId), category: e.category, statement: e.statement });
  return { ensemblGeneId: a.ensemblGeneId, associations, evidence };
}

/**
 * Whether Pathway World is available for a set and why (plan section 12 rule 4): from the record
 * when it is in the bundle (a null opening pathway means no membership qualifies), else from the
 * capability report's `pathwayView` (the app has the report at start and the record only on first
 * need), else the Phase 3 to 8 wording.
 */
export function pathwayWorldReason(b: Pick<HbbBundle, "capabilities" | "pathways">): { available: boolean; reason: string } {
  const cap = b.capabilities ? CapabilitiesIn.safeParse(b.capabilities) : null;
  const view = cap?.success ? (cap.data.pathwayView ?? null) : null;
  if (b.pathways) {
    const p = PathwaysIn.parse(b.pathways);
    if (p.openingPathway) return { available: true, reason: view?.available ? view.reason : `${p.membershipCount} Reactome membership${p.membershipCount === 1 ? "" : "s"}; opens on ${p.openingPathway.name}, ${p.openingPathway.stableId} (the rule's choice)` };
    return { available: false, reason: view && !view.available ? view.reason : p.membershipCount === 0 ? "no Reactome pathway lists this protein" : "no membership qualifies for the opening rule" };
  }
  if (view) return { available: view.available, reason: view.reason };
  return { available: false, reason: "no curated pathway records in this context" };
}

const WATER_OR_LIGAND = new Set(["HOH", "HEM", "HOA"]);

/**
 * Below this fraction of the protein's residues observed in the entry, the set states its coverage
 * everywhere the structure is named (plan section 13 rule 3): the context carries the record's
 * coverage evidence, and the app's caption, Protein World card and known limitations repeat the
 * record's sentence. At or above it (2HBS, 99.3 %) nothing is added, so the HBB context and its
 * measured prompts are byte-identical to Phase 8.
 */
export const COVERAGE_STATED_BELOW = 0.9;
export const coverageIsStated = (fraction: number): boolean => fraction < COVERAGE_STATED_BELOW;

/** The evidence id of a structure record's coverage sentence in the context. */
export const coverageEvidenceId = (entryId: string, accession: string): string => `coverage:${entryId}-${accession}`;

/**
 * The Phase 3 descriptive name of the curated HBB substitution, kept in its context for the
 * measured Phase 3 to 8 prompts (the system message is pinned byte for byte). Keyed by the
 * variant record's common name, so that no other set's variant ever receives it (Phase 9,
 * P9.2.2: BRCA1's C61G carries the record's names only).
 */
const PHASE3_DESCRIPTIVE_NAMES: Record<string, string> = { "HbS (sickle haemoglobin)": "sickle-cell variant" };

/** The record's common name without its parenthesised gloss: "HbS (sickle haemoglobin)" is "HbS", "F508del (p.Phe508del)" is "F508del". */
export function variantShortName(commonName: string): string {
  return commonName.replace(/\s*\(.*\)$/, "");
}

/** Why Protein World is unavailable for a set without an experimental structure: the capability report's words, else a generic reason. */
export function proteinWorldReason(b: Pick<HbbBundle, "structure" | "mapping" | "capabilities">): { available: boolean; reason: string } {
  if (b.structure && b.mapping) return { available: true, reason: "experimental structure with a verified residue mapping" };
  if (b.structure) return { available: true, reason: "experimental structure without a verified residue mapping" };
  const cap = b.capabilities ? CapabilitiesIn.safeParse(b.capabilities) : null;
  if (cap?.success && !cap.data.experimentalStructure.available) return { available: false, reason: cap.data.experimentalStructure.reason };
  return { available: false, reason: "no experimental structure record in this dataset" };
}

/**
 * Builds the planning context of a curated set from its records. Throws if a record does not
 * parse. The gene, transcript and protein records are required; the variant, structure, mapping,
 * contacts and predicted model are optional (Phase 9): without a structure there is no structure
 * entry, no feature and no structure evidence, and Protein World is unavailable with the reason;
 * without a variant there is no variant entry. Nothing about any gene is written here: every
 * name, label and identifier is read from the records.
 */
export function buildHbbContext(b: HbbBundle): PlanningContext {
  const gene = GeneIn.parse(b.gene);
  const tx = TranscriptIn.parse(b.transcript);
  const protein = ProteinIn.parse(b.protein);
  const variant = b.variant ? VariantIn.parse(b.variant) : null;
  const structure = b.structure ? StructureIn.parse(b.structure) : null;
  const mapping = structure && b.mapping ? MappingIn.parse(b.mapping) : null;
  const contacts = structure && b.contacts ? ContactsIn.parse(b.contacts) : null;
  const predicted = b.predicted ? PredictedIn.parse(b.predicted) : null;
  const variantKind: "substitution" | "deletion" = variant?.variantKind ?? "substitution";

  const geneId = gene.id.id;
  const evidence: ContextEvidence[] = [];
  const addEv = (id: string, e: z.infer<typeof Ev> | undefined) => {
    if (e) evidence.push({ id, category: e.category, statement: e.statement });
  };
  addEv(`ensembl:${geneId}`, gene.evidence?.[0]);
  addEv(`uniprot:${protein.accession}`, protein.evidence[0]);

  // The variant: its ClinVar, UniProt and HGVS evidence (the record's first three entries).
  let clinvarEvId: string | null = null;
  let uniprotVarId: string | null = null;
  if (variant) {
    clinvarEvId = `clinvar:${variant.clinvar.accession}`;
    uniprotVarId = `uniprot:${(variant.evidence[1]?.statement.match(/VAR_\d+/) ?? ["VAR_unknown"])[0]}`;
    addEv(clinvarEvId, variant.evidence[0]);
    addEv(uniprotVarId, variant.evidence[1]);
    addEv(`hgvs:${variant.hgvs.coding[0]}`, variant.evidence[2]);
  }

  // The experimental structure, its mapping of record and its contacts.
  const structures: ContextStructure[] = [];
  const features: ContextFeature[] = [];
  let featureId: string | null = null;
  if (structure) {
    const structEvId = `pdb:${structure.entryId}`;
    const citation = structure.citation;
    evidence.push({
      id: structEvId,
      category: structure.evidence[0]?.category ?? 1,
      statement: `${structure.evidence[0]?.statement ?? structure.entryId}${citation?.pubmedId ? ` Primary citation PMID ${citation.pubmedId}.` : ""}`,
    });
    // The asymmetric unit's label describes what the deposited assemblies say it holds: two
    // tetramers when the entry deposits two four-chain assemblies (2HBS), else every polymer chain.
    const twoTetramers = structure.assemblies.length === 2 && structure.assemblies.every((a) => a.polymerAsymIds.length === 4);
    const assemblies: ContextAssembly[] = [
      { id: "model", label: twoTetramers ? "asymmetric unit (both tetramers, all chains)" : "asymmetric unit (all polymer chains)", chains: [...new Set(structure.entities.flatMap((e) => (e.type === "polymer" ? e.strandIds : [])))] },
      ...structure.assemblies.map((a) => ({ id: a.id, label: `biological assembly ${a.id}`, chains: a.polymerAsymIds })),
    ];
    const assembliesContaining = (chains: string[]) => assemblies.filter((a) => chains.every((c) => a.chains.includes(c))).map((a) => a.id);
    let mappingEvId: string | null = null;
    if (mapping) {
      mappingEvId = `sifts:${mapping.entryId}-${mapping.uniprotAccession}`;
      addEv(mappingEvId, mapping.evidence[1]);
      const first = mapping.residues[0];
      addEv(`atom_site:${mapping.entryId}-${first ? `${first.compId.toLowerCase()}${first.authSeqId}` : mapping.maturePosition}`, mapping.evidence[0]);
    }
    const contactChain = contacts?.chains.find((c) => c.contacts.some((x) => !WATER_OR_LIGAND.has(x.compId))) ?? null;
    const contactEvId = contacts ? `contacts:${contacts.entryId}-${contactChain ? `${contactChain.residue.authAsymId}${contactChain.residue.authSeqId}` : "none"}` : null;
    if (contacts && contactEvId) addEv(contactEvId, contacts.evidence[0]);
    if (variant && mapping && clinvarEvId && uniprotVarId && mappingEvId) {
      // The variant's residue feature: the mapped residue of record on the experimental structure.
      // A substitution's label keeps its Phase 3 form; a deletion (Phase 9) says that the structure
      // shows the residue the deletion removes, numbered as the mapping record numbers it.
      featureId = `${variantShortName(variant.commonName).replace(/[^A-Za-z0-9]+/g, "_")}_${variantKind}`;
      const variantChains = mapping.residues.map((r) => r.authAsymId);
      const comp = mapping.residues[0]?.compId ?? "?";
      const residueNo = mapping.maturePosition ?? mapping.residues[0]?.authSeqId ?? variant.numbering.translatedPosition;
      const numbering = variant.numbering.matureLabel ? `${variant.numbering.translatedLabel}; ${variant.numbering.matureLabel}` : variant.numbering.translatedLabel;
      const label =
        variantKind === "deletion"
          ? `${variant.commonName}: ${numbering}; in ${structure.entryId} chain${variantChains.length > 1 ? "s" : ""} ${variantChains.join("/")} residue ${residueNo} is ${comp}, the residue the deletion removes`
          : `${variant.commonName}: ${numbering}; in ${structure.entryId} chains ${variantChains.join("/")} residue ${residueNo} is ${comp}`;
      features.push({
        id: featureId,
        kind: "residue",
        label,
        proteinId: protein.accession,
        structureId: structure.entryId,
        chains: variantChains,
        authSeqId: mapping.residues[0] ? Number(mapping.residues[0].authSeqId) : null,
        assemblies: assemblies.filter((a) => variantChains.some((c) => a.chains.includes(c))).map((a) => a.id),
        evidenceIds: [clinvarEvId, uniprotVarId, mappingEvId],
      });
      if (contactChain && contacts && contactEvId) {
        const partners = contactChain.contacts.filter((x) => !WATER_OR_LIGAND.has(x.compId));
        const partnerChains = [...new Set(partners.map((p) => p.authAsymId))];
        const chains = [contactChain.residue.authAsymId, ...partnerChains];
        features.push({
          id: `${featureId.replace(/_(substitution|deletion)$/, "")}_contact_${contactChain.residue.authAsymId}${contactChain.residue.authSeqId}_${partnerChains.join("")}`,
          kind: "contact",
          label: `${contactChain.residue.compId} ${contactChain.residue.authAsymId}${contactChain.residue.authSeqId} contacts ${partners.map((p) => `${p.compId} ${p.authAsymId}${p.authSeqId}`).join(", ")} within ${contacts.cutoffAngstrom} A (${contacts.scope})`,
          proteinId: protein.accession,
          structureId: contacts.entryId,
          chains,
          authSeqId: null,
          assemblies: assembliesContaining(chains),
          evidenceIds: [contactEvId],
        });
      }
    }
    // Phase 9 (P9.2.2): an entry whose coverage of the protein is partial carries the record's
    // coverage evidence (its own category and sentence; SIFTS and the atom records), so that a plan
    // may cite it and the explanation can repeat it. The models clause names an ensemble (NMR).
    const coverage = structure.coverage ?? null;
    if (coverage && coverageIsStated(coverage.fraction)) {
      const accession = mapping?.uniprotAccession ?? protein.accession;
      addEv(coverageEvidenceId(structure.entryId, accession), structure.evidence.find((e) => e.statement.startsWith(coverage.text)));
    }
    const models = structure.modelCount !== undefined && structure.modelCount > 1 ? `, ${structure.modelCount} models, model ${structure.modelShown ?? 1} shown` : "";
    structures.push({
      id: structure.entryId,
      origin: "experimental",
      title: `${structure.title} (${structure.method}${structure.resolutionAngstrom ? `, ${structure.resolutionAngstrom} A` : ""}${models})`,
      proteinIds: [...new Set(structure.entities.flatMap((e) => e.siftsUniprot))],
      assemblies,
      variantPlacement: featureId !== null,
    });
  }
  if (predicted) {
    addEv(`alphafold:${predicted.modelId}`, predicted.evidence[0]);
    structures.push({
      id: predicted.modelId,
      origin: "predicted",
      title: `AlphaFold DB predicted model of ${predicted.uniprotAccession} (pLDDT ${predicted.globalPlddt}); computational prediction`,
      proteinIds: [predicted.uniprotAccession],
      assemblies: [{ id: "model", label: "single predicted chain", chains: ["A"] }],
      variantPlacement: predicted.usableForVariantPlacement,
    });
  }

  const variants: ContextVariant[] = [];
  if (variant && clinvarEvId && uniprotVarId) {
    const clinvarLine = `ClinVar ${variant.clinvar.accession}: ${variant.clinvar.classification} (${variant.clinvar.reviewStatus})`;
    const names: (string | null)[] =
      variantKind === "deletion"
        ? // Phase 9: a deletion's names are the record's own (its short name, the computed protein
          // change, its identifiers and its numbering label); no descriptive literal is written here.
          [variantShortName(variant.commonName), variant.proteinChangeComputed ?? null, variant.rsId, ...variant.hgvs.coding, ...variant.hgvs.protein, variant.numbering.translatedLabel, clinvarLine]
        : // The short name, the Phase 3 descriptive name when the record is the one it was written for (kept for the measured prompts), then the record's identifiers.
          [variantShortName(variant.commonName), PHASE3_DESCRIPTIVE_NAMES[variant.commonName] ?? null, `${variant.rsId} allele ${variant.allele.alternate}`, ...variant.hgvs.coding, ...variant.hgvs.protein, variant.numbering.matureLabel, clinvarLine];
    variants.push({
      id: variant.key,
      label: variant.commonName,
      geneId,
      proteinId: protein.accession,
      names: names.filter((n): n is string => n !== null && n !== ""),
      featureId: featureId ?? `${variantShortName(variant.commonName).replace(/[^A-Za-z0-9]+/g, "_")}_${variantKind}`,
      evidenceIds: [clinvarEvId, uniprotVarId],
    });
  }

  // Phase 9 (P9.1.2): the pathway memberships, when the record is in the bundle (membership only, class 2).
  const pathways = b.pathways ? pathwayContext(b.pathways) : null;
  if (pathways) evidence.push(...pathways.evidence);
  // Phase 9 (P9.1.3): the disease associations, when the record is in the bundle (association, never causal; class 2).
  const associations = b.associations ? associationContext(b.associations) : null;
  if (associations) evidence.push(...associations.evidence);

  const proteinWorld = proteinWorldReason(b);
  const pathwayWorld = pathwayWorldReason(b);
  return {
    contextId: `curated-${gene.symbol.toLowerCase()}`,
    genes: [{ id: geneId, symbol: gene.symbol, name: gene.description.replace(/\s*\[Source:.*$/, ""), hgncId: gene.hgncId, aliases: gene.aliases }],
    transcripts: [
      {
        id: tx.id.id,
        versioned: `${tx.id.id}.${tx.id.version}`,
        geneId,
        label: `${tx.maneSelect ? "MANE Select " : ""}${tx.id.id}.${tx.id.version}${tx.refSeqMatch ? ` (${tx.refSeqMatch.id}.${tx.refSeqMatch.version})` : ""}`,
      },
    ],
    proteins: [{ id: protein.accession, geneId, name: protein.entryName, length: protein.length }],
    variants,
    structures,
    features,
    evidence,
    ...(pathways ? { pathways: pathways.pathways } : {}),
    ...(associations ? { associations: associations.associations } : {}),
    worlds: [
      { id: "overview", available: true, reason: "always" },
      { id: "genome", available: true, reason: "gene locus on GRCh38" },
      { id: "dna", available: true, reason: "reference sequence of the selected transcript" },
      { id: "protein", available: proteinWorld.available, reason: proteinWorld.reason },
      { id: "pathway", available: pathwayWorld.available, reason: pathwayWorld.reason },
    ],
    executableActions: ["resolveGene", "resolveVariant", "loadStructure", "enterWorld", "focusCamera", "highlightResidue", "revealEvidence", "cancelActions"],
    selection: null,
    loadedStructureId: null,
    retrieved: [],
  };
}

/** Returns a copy of the context with session state and retrieved text set. */
export function withSession(
  ctx: PlanningContext,
  s: {
    selection?: ContextSelection | null;
    loadedStructureId?: string | null;
    retrieved?: RetrievedSnippet[];
    sequenceSelection?: { transcriptId: string; codon: number } | null;
    answer?: AnswerKind;
    currentWorld?: World;
  },
): PlanningContext {
  return {
    ...ctx,
    ...(s.sequenceSelection !== undefined ? { sequenceSelection: s.sequenceSelection } : {}),
    ...(s.answer !== undefined ? { answer: s.answer } : {}),
    ...(s.currentWorld !== undefined ? { currentWorld: s.currentWorld } : {}),
    selection: s.selection === undefined ? ctx.selection : s.selection,
    loadedStructureId: s.loadedStructureId === undefined ? (s.selection ? s.selection.structureId : ctx.loadedStructureId) : s.loadedStructureId,
    retrieved: s.retrieved ?? ctx.retrieved,
  };
}

/** Resolves a residue selection to a feature, deterministically (never by the model). */
export function selectionFeature(ctx: PlanningContext, structureId: string, chainId: string, residueNumber: number): string | null {
  for (const f of ctx.features) {
    if (f.kind === "residue" && f.structureId === structureId && f.chains.includes(chainId) && f.authSeqId === residueNumber) return f.id;
  }
  return null;
}

/** The trusted part of the context, serialised. Used for prompts and for text groundedness checks. */
export function trustedContextJson(ctx: PlanningContext): string {
  const { retrieved: _r, ...trusted } = ctx;
  return JSON.stringify(trusted);
}

/** All identifiers a plan may use, by kind. */
export function allowedIds(ctx: PlanningContext) {
  return {
    genes: new Set(ctx.genes.map((g) => g.id)),
    proteins: new Set(ctx.proteins.map((p) => p.id)),
    variants: new Set(ctx.variants.map((v) => v.id)),
    structures: new Set(ctx.structures.map((s) => s.id)),
    features: new Set(ctx.features.map((f) => f.id)),
    evidence: new Set(ctx.evidence.map((e) => e.id)),
    worlds: new Set(ctx.worlds.filter((w) => w.available).map((w) => w.id)),
  };
}
