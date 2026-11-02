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

/**
 * Identifiers that define a journey. These are selections (which gene, which variant
 * allele, which entry), not data: every position, sequence and version in the output is
 * read from the responses.
 */
export interface SliceConfig {
  datasetId: string;
  description: string;
  ensemblGeneId: string;
  hgncSymbol: string;
  uniprotAccession: string;
  pdbId: string;
  variant: {
    slug: string;
    commonName: string;
    rsId: string;
    /** Forward-strand alternate allele that defines the variant (rs334 is multi-allelic). */
    forwardAllele: string;
    clinvarUid: string;
  };
  /** Half-width of the genomic DNA window around the variant, in bases. */
  genomicWindowFlank: number;
  contactCutoffAngstrom: number;
  includeAlphafold: boolean;
}

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

/** Logical names of the records a slice is built from (research/hbb-acquisition-plan.md §3). */
export interface SliceInputs {
  ensemblInfoData: RawRecord; // E1
  ensemblAssembly: RawRecord; // E2
  geneLookup: RawRecord; // E3
  transcriptLookup: RawRecord; // E4
  cds: RawRecord; // E5
  cdna: RawRecord; // E6
  ensemblProtein: RawRecord; // E7
  genomicWindow: RawRecord; // E8
  codonMap: RawRecord; // E9
  variation: RawRecord; // E10
  variantRecoder: RawRecord; // E11
  vep: RawRecord; // E12
  uniprot: RawRecord; // U1
  mmcif: RawRecord; // P1
  rcsbEntry: RawRecord; // P2
  rcsbPolymerEntity: RawRecord; // P3
  rcsbAssembly: RawRecord; // P4
  sifts: RawRecord; // S1
  /** C0: esearch by rsID (Phase 6). Optional so that Phase 2 snapshots still load. */
  clinvarSearch?: RawRecord;
  clinvar: RawRecord; // C1
  clinvarEinfo?: RawRecord;
  hgnc: RawRecord; // H1
  alphafoldPrediction?: RawRecord; // A1
  alphafoldModel?: RawRecord;
}

export type SliceInputName = keyof SliceInputs;
