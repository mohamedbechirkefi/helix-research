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
const VariantIn = z
  .object({
    key: z.string(),
    commonName: z.string(),
    rsId: z.string(),
    allele: z.object({ alternate: z.string() }).loose(),
    hgvs: z.object({ coding: z.array(z.string()), protein: z.array(z.string()) }).loose(),
    numbering: z.object({ translatedPosition: z.number(), maturePosition: z.number(), matureLabel: z.string(), translatedLabel: z.string() }).loose(),
    clinvar: z.object({ accession: z.string(), classification: z.string(), reviewStatus: z.string() }).loose(),
    evidence: z.array(Ev),
  })
  .loose();
const StructureIn = z
  .object({
    entryId: z.string(),
    title: z.string(),
    method: z.string(),
    resolutionAngstrom: z.number().nullable(),
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
    maturePosition: z.number(),
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

export interface HbbBundle {
  gene: unknown;
  transcript: unknown;
  protein: unknown;
  variant: unknown;
  structure: unknown;
  mapping: unknown;
  contacts: unknown;
  predicted: unknown;
}

const WATER_OR_LIGAND = new Set(["HOH", "HEM", "HOA"]);

/** Builds the HBB planning context from the curated records. Throws if a record does not parse. */
export function buildHbbContext(b: HbbBundle): PlanningContext {
  const gene = GeneIn.parse(b.gene);
  const tx = TranscriptIn.parse(b.transcript);
  const protein = ProteinIn.parse(b.protein);
  const variant = VariantIn.parse(b.variant);
  const structure = StructureIn.parse(b.structure);
  const mapping = MappingIn.parse(b.mapping);
  const contacts = ContactsIn.parse(b.contacts);
  const predicted = PredictedIn.parse(b.predicted);

  const geneId = gene.id.id;
  const evidence: ContextEvidence[] = [];
  const addEv = (id: string, e: z.infer<typeof Ev> | undefined) => {
    if (e) evidence.push({ id, category: e.category, statement: e.statement });
  };
  addEv(`ensembl:${geneId}`, gene.evidence?.[0]);
  addEv(`uniprot:${protein.accession}`, protein.evidence[0]);
  const clinvarEvId = `clinvar:${variant.clinvar.accession}`;
  const uniprotVarId = `uniprot:${(variant.evidence[1]?.statement.match(/VAR_\d+/) ?? ["VAR_unknown"])[0]}`;
  addEv(clinvarEvId, variant.evidence[0]);
  addEv(uniprotVarId, variant.evidence[1]);
  addEv(`hgvs:${variant.hgvs.coding[0]}`, variant.evidence[2]);
  const structEvId = `pdb:${structure.entryId}`;
  const citation = structure.citation;
  evidence.push({
    id: structEvId,
    category: structure.evidence[0]?.category ?? 1,
    statement: `${structure.evidence[0]?.statement ?? structure.entryId}${citation?.pubmedId ? ` Primary citation PMID ${citation.pubmedId}.` : ""}`,
  });
  const mappingEvId = `sifts:${mapping.entryId}-${mapping.uniprotAccession}`;
  addEv(mappingEvId, mapping.evidence[1]);
  addEv(`atom_site:${mapping.entryId}-val6`, mapping.evidence[0]);
  const contactEvId = `contacts:${contacts.entryId}-H6`;
  addEv(contactEvId, contacts.evidence[0]);
  addEv(`alphafold:${predicted.modelId}`, predicted.evidence[0]);

  const featureId = "HbS_substitution";
  const variantChains = mapping.residues.map((r) => r.authAsymId);
  const assemblies: ContextAssembly[] = [
    { id: "model", label: "asymmetric unit (both tetramers, all chains)", chains: [...new Set(structure.entities.flatMap((e) => (e.type === "polymer" ? e.strandIds : [])))] },
    ...structure.assemblies.map((a) => ({ id: a.id, label: `biological assembly ${a.id}`, chains: a.polymerAsymIds })),
  ];
  const assembliesContaining = (chains: string[]) => assemblies.filter((a) => chains.every((c) => a.chains.includes(c))).map((a) => a.id);
  const contactChain = contacts.chains.find((c) => c.contacts.some((x) => !WATER_OR_LIGAND.has(x.compId)));
  const features: ContextFeature[] = [
    {
      id: featureId,
      kind: "residue",
      label: `${variant.commonName}: ${variant.numbering.translatedLabel}; ${variant.numbering.matureLabel}; in ${structure.entryId} chains ${variantChains.join("/")} residue ${mapping.maturePosition} is VAL`,
      proteinId: protein.accession,
      structureId: structure.entryId,
      chains: variantChains,
      authSeqId: mapping.residues[0] ? Number(mapping.residues[0].authSeqId) : null,
      assemblies: assemblies.filter((a) => variantChains.some((c) => a.chains.includes(c))).map((a) => a.id),
      evidenceIds: [clinvarEvId, uniprotVarId, mappingEvId],
    },
  ];
  if (contactChain) {
    const partners = contactChain.contacts.filter((x) => !WATER_OR_LIGAND.has(x.compId));
    const partnerChains = [...new Set(partners.map((p) => p.authAsymId))];
    const chains = [contactChain.residue.authAsymId, ...partnerChains];
    features.push({
      id: `HbS_contact_${contactChain.residue.authAsymId}${contactChain.residue.authSeqId}_${partnerChains.join("")}`,
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
    variants: [
      {
        id: variant.key,
        label: variant.commonName,
        geneId,
        proteinId: protein.accession,
        names: [
          "HbS",
          "sickle-cell variant",
          `${variant.rsId} allele ${variant.allele.alternate}`,
          ...variant.hgvs.coding,
          ...variant.hgvs.protein,
          variant.numbering.matureLabel,
          `ClinVar ${variant.clinvar.accession}: ${variant.clinvar.classification} (${variant.clinvar.reviewStatus})`,
        ],
        featureId,
        evidenceIds: [clinvarEvId, uniprotVarId],
      },
    ],
    structures: [
      {
        id: structure.entryId,
        origin: "experimental",
        title: `${structure.title} (${structure.method}${structure.resolutionAngstrom ? `, ${structure.resolutionAngstrom} A` : ""})`,
        proteinIds: [...new Set(structure.entities.flatMap((e) => e.siftsUniprot))],
        assemblies,
        variantPlacement: true,
      },
      {
        id: predicted.modelId,
        origin: "predicted",
        title: `AlphaFold DB predicted model of ${predicted.uniprotAccession} (pLDDT ${predicted.globalPlddt}); computational prediction`,
        proteinIds: [predicted.uniprotAccession],
        assemblies: [{ id: "model", label: "single predicted chain", chains: ["A"] }],
        variantPlacement: predicted.usableForVariantPlacement,
      },
    ],
    features,
    evidence,
    worlds: [
      { id: "overview", available: true, reason: "always" },
      { id: "genome", available: true, reason: "gene locus on GRCh38" },
      { id: "dna", available: true, reason: "reference sequence of the selected transcript" },
      { id: "protein", available: true, reason: "experimental structure with a verified residue mapping" },
      { id: "pathway", available: false, reason: "no curated pathway records in this context" },
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
