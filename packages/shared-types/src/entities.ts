// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Typed domain entities (P2.1.1, master prompt §4.1). Every curated record carries
 * a RecordProvenance block and claim-level Evidence.
 */
import { z } from "zod";
import { GenomicInterval } from "./coordinates.ts";
import { Evidence } from "./evidence.ts";
import { VersionedId } from "./ids.ts";
import { RecordProvenance } from "./provenance.ts";

const Sha256Hex = z.string().regex(/^[0-9a-f]{64}$/);

/** Fields common to every curated record. */
const Curated = {
  provenance: RecordProvenance,
  evidence: z.array(Evidence),
};

// ---------------------------------------------------------------- gene, transcript

export const TranscriptSelectionRule = z.enum([
  "mane_select",
  "ensembl_canonical_not_mane",
]);
export type TranscriptSelectionRule = z.infer<typeof TranscriptSelectionRule>;

export const Exon = z.object({
  id: VersionedId,
  interval: GenomicInterval,
  rank: z.number().int().min(1),
});
export type Exon = z.infer<typeof Exon>;

export const Translation = z.object({
  id: VersionedId,
  length: z.number().int().min(1),
  interval: GenomicInterval,
});
export type Translation = z.infer<typeof Translation>;

export const Transcript = z.object({
  id: VersionedId,
  displayName: z.string(),
  biotype: z.string(),
  isCanonical: z.boolean(),
  maneSelect: z.boolean(),
  refSeqMatch: VersionedId.nullable(),
  interval: GenomicInterval,
  length: z.number().int().min(1),
  exons: z.array(Exon).min(1),
  utrs: z.array(z.object({ type: z.enum(["five_prime_utr", "three_prime_utr"]), interval: GenomicInterval })),
  translation: Translation.nullable(),
});
export type Transcript = z.infer<typeof Transcript>;

export const TranscriptSelection = z.object({
  rule: TranscriptSelectionRule,
  selected: VersionedId,
  candidatesConsidered: z.number().int().min(1),
  /** Human-readable reason, e.g. "only transcript with MANE[].type == MANE_Select". */
  reason: z.string(),
  warnings: z.array(z.string()),
});
export type TranscriptSelection = z.infer<typeof TranscriptSelection>;

export const Gene = z.object({
  kind: z.literal("gene"),
  id: VersionedId,
  symbol: z.string(),
  description: z.string(),
  biotype: z.string(),
  interval: GenomicInterval,
  hgncId: z.string().regex(/^HGNC:\d+$/).nullable(),
  aliases: z.array(z.string()),
  ncbiGeneId: z.string().nullable(),
  transcriptCount: z.number().int().min(0),
  selection: TranscriptSelection.nullable(),
  ...Curated,
});
export type Gene = z.infer<typeof Gene>;

export const TranscriptRecord = Transcript.extend({ kind: z.literal("transcript"), ...Curated });
export type TranscriptRecord = z.infer<typeof TranscriptRecord>;

// ---------------------------------------------------------------- sequences

export const SequenceKind = z.enum(["genomic", "cdna", "cds", "protein"]);
export type SequenceKind = z.infer<typeof SequenceKind>;

export const Sequence = z.object({
  kind: z.literal("sequence"),
  sequenceKind: SequenceKind,
  /** Identifier from the FASTA header or response, with version when the source gives one. */
  sourceId: z.string(),
  alphabet: z.enum(["dna", "protein"]),
  sequence: z.string().regex(/^[A-Z*]+$/),
  length: z.number().int().min(1),
  sha256: Sha256Hex,
  /** For genomic windows: the interval, forward strand. */
  interval: GenomicInterval.nullable(),
  ...Curated,
});
export type Sequence = z.infer<typeof Sequence>;

// ---------------------------------------------------------------- protein

export const ProteinFeature = z.object({
  type: z.string(),
  start: z.number().int().min(1),
  end: z.number().int().min(1),
  description: z.string(),
  featureId: z.string().nullable(),
  originalSequence: z.string().nullable(),
  alternativeSequences: z.array(z.string()),
  /** ECO codes and source ids, e.g. "ECO:0000269 PubMed:13464827". */
  evidences: z.array(z.string()),
  /** Cross-references attached to the feature (dbSNP only; proprietary ones are filtered). */
  xrefs: z.array(z.string()),
});
export type ProteinFeature = z.infer<typeof ProteinFeature>;

export const Isoform = z.object({
  /** "canonical" or the isoform suffix accession, e.g. "P12345-2". */
  isoformId: z.string(),
  isCanonical: z.boolean(),
});
export type Isoform = z.infer<typeof Isoform>;

export const Protein = z.object({
  kind: z.literal("protein"),
  accession: z.string(),
  entryName: z.string(),
  reviewed: z.boolean(),
  isoform: Isoform,
  entryVersion: z.number().int(),
  sequenceVersion: z.number().int(),
  sequence: z.string().regex(/^[A-Z]+$/),
  length: z.number().int().min(1),
  md5: z.string().regex(/^[0-9A-F]{32}$/),
  crc64: z.string().regex(/^[0-9A-F]{16}$/),
  /** Positions in this record are in translated numbering (initiator Met = 1). */
  numbering: z.literal("translated"),
  /** The UniProt Chain feature; null when the entry has none. */
  processedChain: z.object({ start: z.number().int(), end: z.number().int(), featureId: z.string().nullable() }).nullable(),
  initiatorMethionineRemoved: z.boolean(),
  features: z.array(ProteinFeature),
  xrefs: z.object({
    maneSelect: z
      .object({ transcript: z.string(), protein: z.string(), refSeqNucleotide: z.string(), refSeqProtein: z.string() })
      .nullable(),
    ensembl: z.array(z.object({ transcript: z.string(), protein: z.string(), gene: z.string() })),
    pdb: z.array(z.object({ id: z.string(), method: z.string(), resolution: z.string().nullable(), chains: z.string() })),
  }),
  comments: z.array(z.object({ type: z.string(), text: z.string(), evidences: z.array(z.string()) })),
  ...Curated,
});
export type Protein = z.infer<typeof Protein>;

// ---------------------------------------------------------------- variant

export const ProteinNumbering = z.object({
  /** HGVS p. / UniProt position, initiator Met = 1. */
  translatedPosition: z.number().int().min(1),
  /** Mature-chain (legacy haemoglobin) position, derived from the UniProt Chain feature; null if no chain. */
  maturePosition: z.number().int().min(1).nullable(),
  matureLabel: z.string().nullable(),
  translatedLabel: z.string(),
});
export type ProteinNumbering = z.infer<typeof ProteinNumbering>;

export const Variant = z.object({
  kind: z.literal("variant"),
  /** Stable HELIX key: the allele-level genomic HGVS, never an rsID alone. */
  key: z.string(),
  commonName: z.string().nullable(),
  rsId: z.string().nullable(),
  /** All alleles at the rsID, so a lookup by rsID cannot silently pick one. */
  rsAlleles: z.array(z.string()),
  allele: z.object({ reference: z.string(), alternate: z.string(), strand: z.literal(1) }),
  location: GenomicInterval,
  locationGRCh37: GenomicInterval.nullable(),
  hgvs: z.object({ genomic: z.string(), coding: z.array(z.string()), protein: z.array(z.string()) }),
  spdi: z.string(),
  transcript: VersionedId,
  cdsPosition: z.number().int().min(1),
  cdnaPosition: z.number().int().min(1).nullable(),
  codon: z.object({ number: z.number().int().min(1), reference: z.string().length(3), alternate: z.string().length(3), genomic: GenomicInterval }),
  aminoAcids: z.object({ reference: z.string().length(1), alternate: z.string().length(1) }),
  proteinChangeComputed: z.string(),
  numbering: ProteinNumbering,
  consequence: z.object({ terms: z.array(z.string()), codons: z.string(), source: z.string() }).nullable(),
  clinvar: z
    .object({
      accession: z.string(),
      accessionVersion: z.string(),
      title: z.string(),
      classification: z.string(),
      reviewStatus: z.string(),
      lastEvaluated: z.string().nullable(),
      proteinChange: z.string().nullable(),
      supportingSubmissionCount: z.number().int(),
      traitCount: z.number().int(),
      traitNote: z.string(),
    })
    .nullable(),
  ...Curated,
});
export type Variant = z.infer<typeof Variant>;

// ---------------------------------------------------------------- structure

export const Chain = z.object({
  labelAsymId: z.string(),
  authAsymId: z.string(),
  entityId: z.string(),
  entityType: z.enum(["polymer", "non-polymer", "water", "branched", "macrolide"]),
});
export type Chain = z.infer<typeof Chain>;

export const StructureEntity = z.object({
  entityId: z.string(),
  type: z.string(),
  description: z.string(),
  moleculeCount: z.number().int().nullable(),
  /** _entity.pdbx_mutation verbatim, with the numbering scheme it uses. */
  mutation: z.object({ text: z.string(), numbering: z.enum(["mature/legacy", "unknown"]) }).nullable(),
  sequence: z.string().nullable(),
  strandIds: z.array(z.string()),
  /** UniProt accessions mapped by SIFTS; the only basis for picking an entity. */
  siftsUniprot: z.array(z.string()),
});
export type StructureEntity = z.infer<typeof StructureEntity>;

export const Structure = z.object({
  kind: z.literal("structure"),
  entryId: z.string(),
  title: z.string(),
  method: z.string(),
  /** "experimental" for PDB entries; "predicted" for computed models. */
  origin: z.enum(["experimental", "predicted"]),
  resolutionAngstrom: z.number().nullable(),
  revision: z.object({ version: z.string(), date: z.string() }),
  depositionDate: z.string().nullable(),
  citation: z.object({ title: z.string(), journal: z.string().nullable(), year: z.number().int().nullable(), pubmedId: z.string().nullable(), doi: z.string().nullable() }).nullable(),
  entities: z.array(StructureEntity),
  chains: z.array(Chain),
  assemblies: z.array(z.object({ id: z.string(), details: z.string(), asymIds: z.array(z.string()), polymerAsymIds: z.array(z.string()) })),
  defaultAssemblyId: z.string(),
  modelFile: z.object({ path: z.string(), format: z.literal("mmcif"), sha256: Sha256Hex, bytes: z.number().int() }),
  ...Curated,
});
export type Structure = z.infer<typeof Structure>;

/** Both label_* and auth_* ids, always. Viewer commands are generated from this. */
export const ResidueRef = z.object({
  entryId: z.string(),
  assemblyId: z.string().nullable(),
  entityId: z.string(),
  labelAsymId: z.string(),
  labelSeqId: z.number().int().nullable(),
  authAsymId: z.string(),
  authSeqId: z.string(),
  insCode: z.string().nullable(),
  /** Residue name read from atom_site (label_comp_id), never inferred from a sequence. */
  compId: z.string(),
  authCompId: z.string(),
});
export type ResidueRef = z.infer<typeof ResidueRef>;

export const ResidueMapping = z.object({
  kind: z.literal("residue-mapping"),
  uniprotAccession: z.string(),
  uniprotPosition: z.number().int().min(1),
  uniprotResidue: z.string().length(1),
  maturePosition: z.number().int().nullable(),
  entryId: z.string(),
  entityId: z.string(),
  method: z.enum(["sifts", "alignment"]),
  crossChecks: z.array(z.object({ method: z.string(), agrees: z.boolean(), detail: z.string() })),
  residues: z.array(ResidueRef),
  ...Curated,
});
export type ResidueMapping = z.infer<typeof ResidueMapping>;

export const ResidueContacts = z.object({
  kind: z.literal("residue-contacts"),
  entryId: z.string(),
  /** e.g. "asymmetric unit, model 1, no symmetry mates". */
  scope: z.string(),
  cutoffAngstrom: z.number().positive(),
  numbering: z.literal("auth_asym_id / auth_seq_id"),
  chains: z.array(
    z.object({
      residue: ResidueRef,
      probeAtoms: z.array(z.string()).min(1),
      contacts: z.array(z.object({ authAsymId: z.string(), authSeqId: z.number().int(), compId: z.string() })),
    }),
  ),
  ...Curated,
});
export type ResidueContacts = z.infer<typeof ResidueContacts>;

// ---------------------------------------------------------------- pathway (typed now, adapter later)

export const Pathway = z.object({
  kind: z.literal("pathway"),
  stableId: VersionedId,
  name: z.string(),
  species: z.string(),
  ...Curated,
});
export type Pathway = z.infer<typeof Pathway>;

// ---------------------------------------------------------------- predicted models

export const PredictedModel = z.object({
  kind: z.literal("predicted-model"),
  modelId: z.string(),
  modelVersion: z.number().int(),
  uniprotAccession: z.string(),
  uniprotRange: z.object({ start: z.number().int(), end: z.number().int() }),
  modelCreatedDate: z.string(),
  globalPlddt: z.number().nullable(),
  sequenceChecksumMatchesUniprot: z.boolean(),
  disclaimer: z.string(),
  /** Hard flag: never used to place an experimental residue. */
  usableForVariantPlacement: z.literal(false),
  ...Curated,
});
export type PredictedModel = z.infer<typeof PredictedModel>;

// ---------------------------------------------------------------- issues, drift, capabilities

export const KnownIssue = z.object({
  id: z.string(),
  severity: z.enum(["info", "warning", "error"]),
  summary: z.string(),
  detail: z.string(),
  resolution: z.string(),
});
export type KnownIssue = z.infer<typeof KnownIssue>;

export const DriftReport = z.object({
  id: z.string(),
  subject: z.string(),
  observedIn: z.string(),
  observedValue: z.string(),
  referenceSource: z.string(),
  referenceValue: z.string(),
  fatal: z.literal(false),
  note: z.string(),
});
export type DriftReport = z.infer<typeof DriftReport>;

export const Capability = z.object({
  available: z.boolean(),
  reason: z.string(),
  evidenceCategory: z.number().int().min(1).max(6).nullable(),
});
export type Capability = z.infer<typeof Capability>;

/**
 * Derived index, not a claim-bearing record: it carries no provenance of its own and
 * names the curated records it was computed from instead.
 */
export const CapabilityReport = z.object({
  kind: z.literal("capabilities"),
  derivedFrom: z.array(z.string()).default([]),
  geneId: z.string(),
  symbol: z.string(),
  transcriptView: Capability,
  proteinView: Capability,
  experimentalStructure: Capability,
  predictedStructure: Capability,
  verifiedResidueMapping: Capability,
  variantHighlight: Capability,
});
export type CapabilityReport = z.infer<typeof CapabilityReport>;
