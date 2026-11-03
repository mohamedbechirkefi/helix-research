// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Gene specifications (Phase 9, docs/phase-9-generalisation.md §2): the only per-gene
 * input of the curated-dataset builder, kept as data under data/specs/<gene>.json and
 * reviewed like any curated record.
 *
 * A specification holds selections only (which gene, which UniProt entry, which
 * experimental entry, which variant allele) and build parameters; it never holds a
 * position, a sequence or a version, and it may not name a world, a chapter, a camera or
 * a colour: presentation is chosen from the built set's capability report, never from the
 * specification. Unknown keys are rejected so that a misspelt selection cannot be
 * silently ignored.
 */
import { z } from "zod";
import type { SliceConfig } from "./types.ts";

/** Keys a specification may not carry at any depth (plan §2). Compared case-insensitively. */
export const FORBIDDEN_SPEC_KEYS: readonly string[] = ["world", "worlds", "chapter", "chapters", "camera", "colour", "color"];

const identifier = (pattern: RegExp, what: string) => z.string().regex(pattern, `${what} has an unexpected form`);

export const GeneSpecVariantSchema = z.strictObject({
  /** File-name stem of the variant's records (variant-<slug>.json, clinvar-<slug>.json). */
  slug: identifier(/^[a-z0-9][a-z0-9-]*$/, "variant slug"),
  commonName: z.string().min(1),
  rsId: identifier(/^rs\d{1,12}$/, "dbSNP id"),
  /** Forward-strand alternate allele that defines the variant at a multi-allelic site. */
  forwardAllele: identifier(/^[ACGT]+$/, "forward allele"),
  clinvarUid: identifier(/^\d+$/, "ClinVar uid"),
});

export const GeneSpecSchema = z.strictObject({
  datasetId: identifier(/^[a-z0-9][a-z0-9-]*$/, "dataset id"),
  description: z.string().min(1),
  identifiers: z.strictObject({
    ensemblGeneId: identifier(/^ENSG\d{11}$/, "Ensembl gene id"),
    hgncSymbol: identifier(/^[A-Za-z0-9][A-Za-z0-9@-]*$/, "HGNC symbol"),
    uniprotAccession: identifier(/^[A-NR-Z][0-9][A-Z][A-Z0-9]{2}[0-9]$|^[OPQ][0-9][A-Z0-9]{3}[0-9]$/, "UniProt accession"),
  }),
  /** Experimental entry selected for the journey. Absent: no experimental structure selected. */
  pdbId: identifier(/^[1-9][A-Za-z0-9]{3}$/, "PDB id").optional(),
  /** Reference variant selected for the journey. Absent: no reference variant selected. */
  variant: GeneSpecVariantSchema.optional(),
  /** Half-width of the genomic DNA window around the variant, in bases. */
  genomicWindowFlank: z.int().positive(),
  contactCutoffAngstrom: z.number().positive(),
  includeAlphafold: z.boolean(),
  /** Curator notes, shown nowhere, kept for provenance. */
  notes: z.string().optional(),
});

export type GeneSpec = z.infer<typeof GeneSpecSchema>;

export class GeneSpecError extends Error {
  override readonly name = "GeneSpecError";
}

function forbiddenKeyPath(value: unknown, path: string[]): string[] | null {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const hit = forbiddenKeyPath(value[i], [...path, String(i)]);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_SPEC_KEYS.includes(k.toLowerCase())) return [...path, k];
      const hit = forbiddenKeyPath(v, [...path, k]);
      if (hit) return hit;
    }
  }
  return null;
}

/** Parse a specification (already decoded from JSON) and reject anything that is not a selection. */
export function parseGeneSpec(json: unknown): GeneSpec {
  const forbidden = forbiddenKeyPath(json, []);
  if (forbidden) {
    throw new GeneSpecError(`a gene specification may not name a world, a chapter, a camera or a colour (key "${forbidden.join(".")}"); presentation is chosen from the capability report`);
  }
  const r = GeneSpecSchema.safeParse(json);
  if (!r.success) {
    const issues = r.error.issues.map((i) => `${i.path.map(String).join(".") || "<root>"}: ${i.message}`).join("; ");
    throw new GeneSpecError(`invalid gene specification: ${issues}`);
  }
  return r.data;
}

/** The builder's configuration for a specification. Notes are dropped: they are shown nowhere. */
export function loadGeneSpec(json: unknown): SliceConfig {
  const s = parseGeneSpec(json);
  const config: SliceConfig = {
    datasetId: s.datasetId,
    description: s.description,
    ensemblGeneId: s.identifiers.ensemblGeneId,
    hgncSymbol: s.identifiers.hgncSymbol,
    uniprotAccession: s.identifiers.uniprotAccession,
    genomicWindowFlank: s.genomicWindowFlank,
    contactCutoffAngstrom: s.contactCutoffAngstrom,
    includeAlphafold: s.includeAlphafold,
  };
  if (s.pdbId !== undefined) config.pdbId = s.pdbId;
  if (s.variant !== undefined) config.variant = { ...s.variant };
  return config;
}

/** The specification that a configuration mirrors (the inverse of loadGeneSpec, without notes). */
export function specOf(config: SliceConfig): GeneSpec {
  return GeneSpecSchema.parse({
    datasetId: config.datasetId,
    description: config.description,
    identifiers: { ensemblGeneId: config.ensemblGeneId, hgncSymbol: config.hgncSymbol, uniprotAccession: config.uniprotAccession },
    ...(config.pdbId !== undefined ? { pdbId: config.pdbId } : {}),
    ...(config.variant !== undefined ? { variant: config.variant } : {}),
    genomicWindowFlank: config.genomicWindowFlank,
    contactCutoffAngstrom: config.contactCutoffAngstrom,
    includeAlphafold: config.includeAlphafold,
  });
}
