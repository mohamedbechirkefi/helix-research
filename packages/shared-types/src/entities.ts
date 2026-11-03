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

/** Fields every variant record carries, whatever its kind. */
const VariantCommon = {
  kind: z.literal("variant"),
  /** Stable HELIX key: the allele-level genomic HGVS, never an rsID alone. */
  key: z.string(),
  commonName: z.string().nullable(),
  rsId: z.string().nullable(),
  /** All alleles at the rsID, so a lookup by rsID cannot silently pick one. */
  rsAlleles: z.array(z.string()),
  /** Forward-strand alleles: one base each for a substitution; the deleted bases and an empty alternate for a deletion. */
  allele: z.object({ reference: z.string(), alternate: z.string(), strand: z.literal(1) }),
  /** The changed base for a substitution; the deleted bases, as one closed interval, for a deletion. */
  location: GenomicInterval,
  locationGRCh37: GenomicInterval.nullable(),
  hgvs: z.object({ genomic: z.string(), coding: z.array(z.string()), protein: z.array(z.string()) }),
  spdi: z.string(),
  transcript: VersionedId,
  /** The c. position of a substitution; the first deleted c. position of a deletion. */
  cdsPosition: z.number().int().min(1),
  cdnaPosition: z.number().int().min(1).nullable(),
  /** HGVS p. in three-letter form, computed by translating the codons (never copied from a source). */
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
};

/**
 * A single-base substitution (Phases 2 to 8). `variantKind` is absent on the records written
 * before Phase 9 and read as "substitution"; the record's `kind` stays the record kind.
 */
export const SubstitutionVariant = z.object({
  ...VariantCommon,
  variantKind: z.literal("substitution").optional(),
  codon: z.object({ number: z.number().int().min(1), reference: z.string().length(3), alternate: z.string().length(3), genomic: GenomicInterval }),
  aminoAcids: z.object({ reference: z.string().length(1), alternate: z.string().length(1) }),
});
export type SubstitutionVariant = z.infer<typeof SubstitutionVariant>;

/** One codon the deleted span touches: its reference bases, its bases after the deletion (null when it disappears) and both amino acids. */
export const AffectedCodon = z.object({
  number: z.number().int().min(1),
  reference: z.string().length(3),
  afterDeletion: z.string().length(3).nullable(),
  referenceAminoAcid: z.string().length(1),
  aminoAcidAfterDeletion: z.string().length(1).nullable(),
  genomic: GenomicInterval,
});
export type AffectedCodon = z.infer<typeof AffectedCodon>;

/**
 * An in-frame deletion (Phase 9, docs/phase-9-generalisation.md section 11 rule 2): the deleted
 * cDNA span, every codon it touches, the residue(s) the protein loses and the protein change
 * computed by translation. A frameshift is never written (the builder refuses it).
 */
export const DeletionVariant = z.object({
  ...VariantCommon,
  variantKind: z.literal("deletion"),
  /** Deleted CDS span, 1-based closed, with its forward-strand genomic interval. */
  deletedSpan: z.object({ cdsStart: z.number().int().min(1), cdsEnd: z.number().int().min(1), length: z.number().int().min(3), genomic: GenomicInterval }),
  affectedCodons: z.array(AffectedCodon).min(1),
  /** UniProt position of the (first) deleted residue, after 3' normalisation at the protein level. */
  residue: z.number().int().min(1),
  deletedResidues: z.array(z.object({ position: z.number().int().min(1), aminoAcid: z.string().length(1) })).min(1),
});
export type DeletionVariant = z.infer<typeof DeletionVariant>;

/** A variant record of either kind. The deletion schema is tried first because it is the one with a required discriminator. */
export const Variant = z.union([DeletionVariant, SubstitutionVariant]);
export type Variant = z.infer<typeof Variant>;

/** The kind of a variant record, with the pre-Phase 9 records read as substitutions. */
export function variantKindOf(v: Pick<Variant, "variantKind">): "substitution" | "deletion" {
  return v.variantKind ?? "substitution";
}

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

/**
 * Full-chain residue mapping of record (Phase 6): every UniProt position that SIFTS maps onto a
 * structure entity, with the residue on each mapped chain. Built by scientific-core from SIFTS,
 * pdbx_poly_seq_scheme (auth ids) and atom_site (residue names); consumers look a position up,
 * they never add an offset.
 */
export const ResidueMappingTable = z.object({
  kind: z.literal("residue-mapping-table"),
  uniprotAccession: z.string(),
  entryId: z.string(),
  entityId: z.string(),
  method: z.literal("sifts"),
  /** The SIFTS segments the table was built from, verbatim (one per chain and segment). */
  segments: z.array(
    z.object({ labelAsymId: z.string(), authAsymId: z.string(), unpStart: z.number().int(), unpEnd: z.number().int(), labelSeqStart: z.number().int(), labelSeqEnd: z.number().int(), identity: z.number().nullable() }),
  ),
  chains: z.array(z.string()).min(1),
  coverage: z.object({ firstUniprotPosition: z.number().int().min(1), lastUniprotPosition: z.number().int().min(1), positions: z.number().int().min(1) }),
  crossChecks: z.array(z.object({ method: z.string(), agrees: z.boolean(), detail: z.string() })),
  positions: z.array(
    z.object({
      uniprotPosition: z.number().int().min(1),
      uniprotResidue: z.string().length(1),
      maturePosition: z.number().int().nullable(),
      /** One residue per mapped chain that has coordinates for it. */
      residues: z.array(ResidueRef),
      /** Mapped chains without coordinates for this residue (unobserved in atom_site). */
      unobservedChains: z.array(z.string()),
      /** True when every residue name read from atom_site is the UniProt residue's PDB name. */
      matchesReference: z.boolean(),
    }),
  ),
  ...Curated,
});
export type ResidueMappingTable = z.infer<typeof ResidueMappingTable>;

// ---------------------------------------------------------------- ClinVar (Phase 6)

/**
 * The ClinVar aggregate record of one allele (Phase 6, ROADMAP P6.1.1): classification, review
 * status, its documented star level and conflict status, and the other ClinVar records found at
 * the same rsID, kept separate and never merged. Trait names are never stored (Q-H-LIC-1).
 */
export const ClinvarRecordEntry = z.object({
  kind: z.literal("clinvar-record"),
  variantKey: z.string(),
  uid: z.string(),
  accession: z.string(),
  accessionVersion: z.string(),
  recordVersion: z.number().int().min(1),
  clinvarBuild: z.string().nullable(),
  objectType: z.string(),
  title: z.string(),
  canonicalSpdi: z.array(z.string()),
  classification: z.string(),
  reviewStatus: z.string(),
  /** ClinVar's documented review-status star level (0 to 4); null for a status not in the table. */
  reviewStars: z.number().int().min(0).max(4).nullable(),
  conflicts: z.object({
    /** True when ClinVar reports conflicting classifications for this record. */
    conflicting: z.boolean(),
    /** What the value rests on (the review status text and the classification text, verbatim). */
    basis: z.string(),
  }),
  lastEvaluated: z.string().nullable(),
  supportingSubmissionCount: z.number().int().min(0),
  traitCount: z.number().int().min(0),
  traitNote: z.string(),
  /** Somatic classifications reported on the same record (empty strings in ClinVar mean none). */
  otherClassifications: z.object({ clinicalImpact: z.string().nullable(), oncogenicity: z.string().nullable() }),
  /** Other ClinVar records returned for the same rsID: other alleles, haplotypes. Never merged with this one. */
  relatedRecords: z.array(
    z.object({
      uid: z.string(),
      accessionVersion: z.string(),
      objectType: z.string(),
      title: z.string(),
      classification: z.string(),
      reviewStatus: z.string(),
      reviewStars: z.number().int().min(0).max(4).nullable(),
      relation: z.enum(["haplotype-or-compound", "other-allele-or-variant"]),
      /** True when one of the record's canonical SPDIs is this allele (a haplotype that contains it). */
      includesThisAllele: z.boolean(),
    }),
  ),
  ...Curated,
});
export type ClinvarRecordEntry = z.infer<typeof ClinvarRecordEntry>;

// ---------------------------------------------------------------- pathway (typed now, adapter later)

export const Pathway = z.object({
  kind: z.literal("pathway"),
  stableId: VersionedId,
  name: z.string(),
  species: z.string(),
  ...Curated,
});
export type Pathway = z.infer<typeof Pathway>;

// ---------------------------------------------------------------- pathway memberships (Phase 9, P9.1.2)

const ReactomeStableId = z.string().regex(/^R-HSA-\d+$/);

/** A pathway named by its Reactome stable id and display name. */
export const PathwayRef = z.object({
  stableId: ReactomeStableId,
  name: z.string().min(1),
});
export type PathwayRef = z.infer<typeof PathwayRef>;

/**
 * One Reactome pathway that lists the protein (a database annotation, class 2: membership,
 * never mechanism). `topLevelPathways` are the distinct top-level pathways its ancestor paths
 * end in (one, unless Reactome places the pathway under several). `participantCount` is the
 * number of participating physical entities Reactome returns for the pathway, known for the
 * candidates of the opening-pathway rule and null for the memberships the rule excluded;
 * `isOpening` marks the one membership the rule names (plan section 12 rule 3), never an
 * importance.
 */
export const PathwayMembership = z.object({
  stableId: ReactomeStableId,
  stableIdVersion: z.string().nullable(),
  name: z.string().min(1),
  /** Reactome's class of the event: Pathway, TopLevelPathway or CellLineagePath (a developmental lineage path, which the mapping lists among a protein's pathways). */
  schemaClass: z.enum(["Pathway", "TopLevelPathway", "CellLineagePath"]),
  species: z.string().min(1),
  isDisease: z.boolean(),
  hasDiagram: z.boolean(),
  topLevelPathways: z.array(PathwayRef),
  participantCount: z.number().int().nonnegative().nullable(),
  isOpening: z.boolean(),
});
export type PathwayMembership = z.infer<typeof PathwayMembership>;

/** A UniProt reference gene product among a pathway's participants; `isSetProtein` flags the set's own protein. */
export const PathwayParticipantProtein = z.object({
  /** The UniProt accession without any isoform suffix. */
  accession: z.string().min(1),
  /** The identifier as Reactome returns it (an isoform keeps its suffix). */
  identifier: z.string().min(1),
  displayName: z.string().min(1),
  isSetProtein: z.boolean(),
});
export type PathwayParticipantProtein = z.infer<typeof PathwayParticipantProtein>;

/**
 * One participating physical entity of a pathway as Reactome returns it (a complex, a set, a
 * protein with a sequence, a small molecule, ...), with the UniProt proteins among the
 * reference entities Reactome lists for it (empty for a small molecule).
 */
export const PathwayParticipant = z.object({
  dbId: z.number().int(),
  displayName: z.string().min(1),
  schemaClass: z.string().min(1),
  proteins: z.array(PathwayParticipantProtein),
});
export type PathwayParticipant = z.infer<typeof PathwayParticipant>;

/** The participants of one candidate membership, as Reactome returns them, with the UniProt proteins among them. */
export const PathwayParticipantSet = z.object({
  stableId: ReactomeStableId,
  name: z.string().min(1),
  topLevelPathways: z.array(PathwayRef),
  participantCount: z.number().int().nonnegative(),
  participants: z.array(PathwayParticipant),
  /** The distinct UniProt proteins over every participant, sorted by accession, the set's protein flagged. */
  proteins: z.array(PathwayParticipantProtein),
  /** Whether the set's protein is among those proteins. */
  listsSetProtein: z.boolean(),
});
export type PathwayParticipantSet = z.infer<typeof PathwayParticipantSet>;

/**
 * The membership Pathway World opens on (plan section 12 rule 3, amended 2026-11-03): the
 * rule's choice, never an importance. Its participants are in `participantsByPathway` like
 * every other candidate's.
 */
export const OpeningPathway = z.object({
  stableId: ReactomeStableId,
  name: z.string().min(1),
  rule: z.literal("fewest-participants-non-disease-with-diagram"),
  /** The candidates in the rule's rank order (fewest participants first, ties by stable id number). */
  candidates: z.array(z.object({ stableId: ReactomeStableId, participantCount: z.number().int().nonnegative() })),
  reason: z.string().min(1),
});
export type OpeningPathway = z.infer<typeof OpeningPathway>;

/**
 * The pathways that list a protein (pathways.json, Phase 9 P9.1.2, plan section 12 rules 2 and
 * 3): the Reactome memberships sorted by stable id, each with its top-level pathway; the
 * participants of every candidate membership (non-disease, with a diagram), so that a visitor
 * can open any of them; and the membership the world opens on, by rule. A protein no pathway
 * lists has an empty list and a null opening pathway. The record says that a protein takes
 * part in a curated pathway, never how, and never that the variant changes the pathway; no
 * field calls a pathway primary.
 */
export const PathwayMembershipsRecord = z.object({
  kind: z.literal("pathway-memberships"),
  derivedFrom: z.array(z.string()),
  accession: z.string().min(1),
  /** The species the memberships were requested for. */
  species: z.string().min(1),
  /** The Reactome database version the responses came from, as `data/database/version` states it. */
  release: z.string().regex(/^\d+$/),
  membershipCount: z.number().int().nonnegative(),
  memberships: z.array(PathwayMembership),
  /** One entry per candidate of the opening rule, sorted by stable id number. */
  participantsByPathway: z.array(PathwayParticipantSet),
  openingPathway: OpeningPathway.nullable(),
  /** What a participant is in this record and what the response does not state (each entity's species). */
  participantsNote: z.string().min(1),
  ...Curated,
});
export type PathwayMembershipsRecord = z.infer<typeof PathwayMembershipsRecord>;

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
  /** Phase 9 (P9.1.2): Reactome memberships with participants can be shown, opening on the rule's choice (class 2, membership only). */
  pathwayView: Capability,
});
export type CapabilityReport = z.infer<typeof CapabilityReport>;

/** The capability keys a question may require (the Capability-valued fields of the report). */
export const CAPABILITY_KEYS = ["transcriptView", "proteinView", "experimentalStructure", "predictedStructure", "verifiedResidueMapping", "variantHighlight", "pathwayView"] as const;
export type CapabilityKey = (typeof CAPABILITY_KEYS)[number];

/** One curated question with the capabilities the set must have for it to be askable at all. */
export const CuratedQuestion = z.object({
  text: z.string().min(1),
  requires: z.array(z.enum(CAPABILITY_KEYS)),
});
export type CuratedQuestion = z.infer<typeof CuratedQuestion>;

/**
 * The set's questions (Phase 9, docs/phase-9-generalisation.md section 11 rule 6): curator
 * text copied from the gene specification, not a claim-bearing record (no provenance of its
 * own; it names the capability record its `requires` keys refer to). `bridgeQuestion` is the
 * question offered first after a DNA World variant answer; null when the set has none.
 */
export const QuestionsRecord = z.object({
  kind: z.literal("questions"),
  derivedFrom: z.array(z.string()).default([]),
  geneId: z.string(),
  symbol: z.string(),
  questions: z.array(CuratedQuestion),
  bridgeQuestion: z.string().min(1).nullable(),
});
export type QuestionsRecord = z.infer<typeof QuestionsRecord>;
