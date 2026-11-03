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

/** The reference variant a journey may tell: a selection, not data (every position is read from the responses). */
export interface SliceVariant {
  slug: string;
  commonName: string;
  rsId: string;
  /** Forward-strand alternate allele that defines the variant (rs334 is multi-allelic). */
  forwardAllele: string;
  clinvarUid: string;
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
  /** Half-width of the genomic DNA window around the variant, in bases. */
  genomicWindowFlank: number;
  contactCutoffAngstrom: number;
  includeAlphafold: boolean;
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
  variant: { slug: "hbs", commonName: "HbS (sickle haemoglobin)", rsId: "rs334", forwardAllele: "A", clinvarUid: "15333" },
  genomicWindowFlank: 20,
  contactCutoffAngstrom: 4.5,
  includeAlphafold: true,
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
}

export type SliceInputName = keyof SliceInputs;

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
  return out;
}
