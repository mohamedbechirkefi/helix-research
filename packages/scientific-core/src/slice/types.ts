// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/** Inputs and configuration of a gene vertical slice (HBB is the first). */
import type { SourceId } from "@helix/shared-types";

/** One retrieved body plus what provenance needs. Live responses and recorded fixtures both fit. */
export interface RawRecord {
  source: SourceId;
  url: string;
  method: "GET" | "POST";
  body: string;
  sha256: string;
  retrievedAt: string;
  headers: Record<string, string>;
}

/** A single-base substitution selected by its forward-strand alternate allele (rs334 is multi-allelic). */
export interface SliceSubstitution {
  kind: "substitution";
  slug: string;
  commonName: string;
  rsId: string;
  /** Forward-strand alternate allele that defines the variant at a multi-allelic site. */
  forwardAllele: string;
  clinvarUid: string;
}

/** An in-frame deletion selected by its transcript-level HGVS, which the recoder must confirm (Phase 9, plan section 11 rule 1). */
export interface SliceDeletion {
  kind: "deletion";
  slug: string;
  commonName: string;
  rsId: string;
  /** "c.<start>_<end>del" on the MANE Select transcript; the builder prefixes the versioned transcript id it selected. */
  hgvsC: string;
  clinvarUid: string;
}

/** The reference variant a journey may tell: a selection, not data (every position is read from the responses). */
export type SliceVariant = SliceSubstitution | SliceDeletion;

/** How experimental entries are ranked when several exist (plan section 2); recorded as the reason for the `pdbId` selection. */
export type StructurePreference = "variant-residue-observed" | "highest-resolution" | "largest-coverage";

/** A curated question and the capability keys the set must have for it to be askable at all (plan section 11 rule 6). */
export interface SliceQuestion {
  text: string;
  requires: string[];
}

/**
 * Identifiers that define a journey. These are selections (which gene, which variant
 * allele, which entry), not data: every position, sequence and version in the output is
 * read from the responses.
 *
 * Phase 9 (docs/phase-9-generalisation.md §2): the same shape serves every gene. A gene
 * may select no experimental structure (`pdbId` absent) and no reference variant
 * (`variant` absent); the builder then produces only the records those selections allow
 * and the capability report says what is missing. The reviewed form of a configuration is
 * the JSON gene specification under data/specs/ (slice/spec.ts).
 */
export interface SliceConfig {
  datasetId: string;
  description: string;
  ensemblGeneId: string;
  hgncSymbol: string;
  uniprotAccession: string;
  /** Experimental entry selected for the journey; absent when none is selected. */
  pdbId?: string;
  /** Reference variant selected for the journey; absent when none is selected. */
  variant?: SliceVariant;
  /** The recorded reason for the `pdbId` selection; absent when the specification gives none. */
  structurePreference?: StructurePreference;
  /** Half-width of the genomic DNA window around the variant, in bases. */
  genomicWindowFlank: number;
  contactCutoffAngstrom: number;
  includeAlphafold: boolean;
  /**
   * Phase 9 (P9.1.2, plan section 12 rule 2): ask Reactome which human pathways list the
   * protein and write pathways.json (an empty list when none does). False: no Reactome request
   * and no record.
   */
  pathways: boolean;
  /** The set's curated questions, written to questions.json (empty when the set offers none). */
  questions: SliceQuestion[];
  /** The question offered first after a DNA World variant answer; absent when the set has none. */
  bridgeQuestion?: string;
}

/**
 * In-code mirror of data/specs/hbb.json, kept for existing imports; scientific-core is
 * platform-agnostic and reads no files. A test proves the two are equal.
 */
export const HBB_CONFIG: SliceConfig = {
  datasetId: "hbb",
  description: "HBB (beta-globin) vertical slice: gene, MANE Select transcript, sequences, UniProt P68871, the HbS variant, PDB 2HBS and its residue mapping.",
  ensemblGeneId: "ENSG00000244734",
  hgncSymbol: "HBB",
  uniprotAccession: "P68871",
  pdbId: "2HBS",
  variant: { kind: "substitution", slug: "hbs", commonName: "HbS (sickle haemoglobin)", rsId: "rs334", forwardAllele: "A", clinvarUid: "15333" },
  genomicWindowFlank: 20,
  contactCutoffAngstrom: 4.5,
  includeAlphafold: true,
  pathways: true,
  questions: [
    { text: "Show me where the sickle-cell mutation affects hemoglobin.", requires: ["variantHighlight", "experimentalStructure"] },
    { text: "How does the DNA change for the sickle-cell variant?", requires: ["variantHighlight"] },
    { text: "What does the HbS residue touch in the crystal?", requires: ["variantHighlight", "experimentalStructure"] },
    { text: "Show the evidence for the sickle-cell variant.", requires: ["variantHighlight"] },
  ],
  bridgeQuestion: "See the sickle-cell mutation on the protein.",
};

/**
 * Logical names of the records a slice is built from (research/hbb-acquisition-plan.md §3).
 * The variant group (E8 to E12, C0, C1) exists only when a reference variant is selected;
 * the structure group (P1 to P4, S1) only when an experimental entry is selected.
 */
export interface SliceInputs {
  ensemblInfoData: RawRecord; // E1
  ensemblAssembly: RawRecord; // E2
  geneLookup: RawRecord; // E3
  transcriptLookup: RawRecord; // E4
  cds: RawRecord; // E5
  cdna: RawRecord; // E6
  ensemblProtein: RawRecord; // E7
  genomicWindow?: RawRecord; // E8 (variant)
  codonMap?: RawRecord; // E9 (variant)
  variation?: RawRecord; // E10 (variant)
  variantRecoder?: RawRecord; // E11 (variant)
  vep?: RawRecord; // E12 (variant)
  uniprot: RawRecord; // U1
  mmcif?: RawRecord; // P1 (structure)
  rcsbEntry?: RawRecord; // P2 (structure)
  rcsbPolymerEntity?: RawRecord; // P3 (structure)
  rcsbAssembly?: RawRecord; // P4 (structure)
  sifts?: RawRecord; // S1 (structure)
  /** C0: esearch by rsID (Phase 6). Optional so that Phase 2 snapshots still load. */
  clinvarSearch?: RawRecord;
  clinvar?: RawRecord; // C1 (variant)
  clinvarEinfo?: RawRecord;
  hgnc: RawRecord; // H1
  alphafoldPrediction?: RawRecord; // A1
  alphafoldModel?: RawRecord;
  /** R0: the Reactome database version (Phase 9, P9.1.2; only when the specification asks for pathways). */
  reactomeVersion?: RawRecord;
  /** R1: the human pathways that list the UniProt accession. */
  reactomePathways?: RawRecord;
  /** R2: the ancestor paths of one membership, keyed by its stable id (one input per membership). */
  [k: `reactomeAncestors:${string}`]: RawRecord | undefined;
  /** R3: the participants of one candidate pathway, keyed by its stable id (one input per candidate of the opening rule). */
  [k: `reactomeParticipants:${string}`]: RawRecord | undefined;
}

export type SliceInputName = keyof SliceInputs;

/** The input name of a membership's ancestor paths (R2). */
export const ancestorsInput = (stableId: string): `reactomeAncestors:${string}` => `reactomeAncestors:${stableId}`;
/** The input name of a candidate pathway's participants (R3). */
export const participantsInput = (stableId: string): `reactomeParticipants:${string}` => `reactomeParticipants:${stableId}`;
/** Whether an input name belongs to the pathway group (R0 to R3). */
export const isPathwayInput = (name: string): boolean => /^reactome(Version|Pathways|Ancestors:|Participants:)/.test(name);

/** Inputs that exist only when the specification selects a reference variant. */
export const VARIANT_INPUTS = ["genomicWindow", "codonMap", "variation", "variantRecoder", "vep", "clinvarSearch", "clinvar", "clinvarEinfo"] as const satisfies readonly SliceInputName[];
/** Inputs that exist only when the specification selects an experimental structure. */
export const STRUCTURE_INPUTS = ["mmcif", "rcsbEntry", "rcsbPolymerEntity", "rcsbAssembly", "sifts"] as const satisfies readonly SliceInputName[];

/** A slice with both a variant and a structure selected (every group present), as the HBB fixtures are. */
export type CompleteSliceInputs = SliceInputs & Required<Pick<SliceInputs, "genomicWindow" | "codonMap" | "variation" | "variantRecoder" | "vep" | "clinvar" | "mmcif" | "rcsbEntry" | "rcsbPolymerEntity" | "rcsbAssembly" | "sifts">>;

/** Drop the inputs a configuration does not use, so a build never reads a record its selections did not ask for. */
export function inputsFor(inputs: SliceInputs, config: SliceConfig): SliceInputs {
  const out: SliceInputs = { ...inputs };
  if (!config.variant) for (const k of VARIANT_INPUTS) delete out[k];
  if (!config.pdbId) for (const k of STRUCTURE_INPUTS) delete out[k];
  if (!config.includeAlphafold) {
    delete out.alphafoldPrediction;
    delete out.alphafoldModel;
  }
  if (!config.pathways) for (const k of Object.keys(out)) if (isPathwayInput(k)) delete out[k as SliceInputName];
  return out;
}
