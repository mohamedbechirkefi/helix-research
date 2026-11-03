// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Gene specifications (Phase 9, docs/phase-9-generalisation.md §2): the only per-gene
 * input of the curated-dataset builder, kept as data under data/specs/<gene>.json and
 * reviewed like any curated record.
 *
 * A specification holds selections only (which gene, which UniProt entry, which
 * experimental entry, which variant allele or HGVS) and build parameters; it never holds a
 * position, a sequence or a version, and it may not name a world, a chapter, a camera or
 * a colour: presentation is chosen from the built set's capability report, never from the
 * specification. The curated questions (§11 rule 6) are text the set offers, not
 * presentation: which of them a set can take is decided by its capability report.
 * Unknown keys are rejected so that a misspelt selection cannot be silently ignored.
 */
import { CAPABILITY_KEYS } from "@helix/shared-types";
import { z } from "zod";
import { parseHgvsCDeletion } from "../coordinates.ts";
import type { SliceConfig, SliceVariant } from "./types.ts";

/** Keys a specification may not carry at any depth (plan §2). Compared case-insensitively. */
export const FORBIDDEN_SPEC_KEYS: readonly string[] = ["world", "worlds", "chapter", "chapters", "camera", "colour", "color"];

const identifier = (pattern: RegExp, what: string) => z.string().regex(pattern, `${what} has an unexpected form`);

const variantCommon = {
  /** File-name stem of the variant's records (variant-<slug>.json, clinvar-<slug>.json). */
  slug: identifier(/^[a-z0-9][a-z0-9-]*$/, "variant slug"),
  commonName: z.string().min(1),
  rsId: identifier(/^rs\d{1,12}$/, "dbSNP id"),
  clinvarUid: identifier(/^\d+$/, "ClinVar uid"),
};

/** A single-base substitution; `kind` may be omitted (the pre-Phase 9 form, hbb.json). */
export const GeneSpecSubstitutionSchema = z.strictObject({
  kind: z.literal("substitution").optional(),
  ...variantCommon,
  /** Forward-strand alternate allele that defines the variant at a multi-allelic site. */
  forwardAllele: identifier(/^[ACGT]+$/, "forward allele"),
});

/** An in-frame deletion named by its transcript-level HGVS on the MANE Select transcript (plan §11 rule 1). */
export const GeneSpecDeletionSchema = z.strictObject({
  kind: z.literal("deletion"),
  ...variantCommon,
  /** "c.<start>_<end>del" (no transcript prefix: the builder adds the versioned MANE Select id it selected, and the recoder must confirm it). */
  hgvsC: identifier(/^c\.\d+(_\d+)?del$/, "coding HGVS deletion (c.<start>_<end>del)").superRefine((h, ctx) => {
    const { start, end } = parseHgvsCDeletion(h);
    const length = end - start + 1;
    if (length % 3 !== 0) ctx.addIssue({ code: "custom", message: `${h} deletes ${length} base(s), not a multiple of three: a frameshift is out of scope for this phase (plan §11 rule 1)` });
  }),
});

export const GeneSpecVariantSchema = z.union([GeneSpecDeletionSchema, GeneSpecSubstitutionSchema]);

export const StructurePreferenceSchema = z.enum(["variant-residue-observed", "highest-resolution", "largest-coverage"]);

/** A curated question and the capability keys the set must have for it to be askable (plan §11 rule 6). */
export const GeneSpecQuestionSchema = z.strictObject({
  text: z.string().min(1),
  requires: z.array(z.enum(CAPABILITY_KEYS)),
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
  /** The recorded reason for the `pdbId` selection (plan §2, §11 rule 4). */
  structurePreference: StructurePreferenceSchema.optional(),
  /** Reference variant selected for the journey. Absent: no reference variant selected. */
  variant: GeneSpecVariantSchema.optional(),
  /** Half-width of the genomic DNA window around the variant, in bases. */
  genomicWindowFlank: z.int().positive(),
  contactCutoffAngstrom: z.number().positive(),
  includeAlphafold: z.boolean(),
  /** Ask Reactome which human pathways list the protein and write pathways.json (plan §12 rule 2). The specification may not name a pathway: the one the world opens on is chosen by rule. */
  pathways: z.boolean(),
  /** Ask Open Targets once for the gene's disease associations and write associations.json (plan section 14 rule 2); never a disease name. */
  associations: z.boolean(),
  /** The set's curated questions, written to questions.json; empty when the set offers none. */
  questions: z.array(GeneSpecQuestionSchema),
  /** The question offered first after a DNA World variant answer. */
  bridgeQuestion: z.string().min(1).optional(),
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

/** The variant selection in the builder's form: the kind is always explicit. */
function variantOf(v: NonNullable<GeneSpec["variant"]>): SliceVariant {
  if (v.kind === "deletion") return { kind: "deletion", slug: v.slug, commonName: v.commonName, rsId: v.rsId, hgvsC: v.hgvsC, clinvarUid: v.clinvarUid };
  return { kind: "substitution", slug: v.slug, commonName: v.commonName, rsId: v.rsId, forwardAllele: v.forwardAllele, clinvarUid: v.clinvarUid };
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
    pathways: s.pathways,
    associations: s.associations,
    questions: s.questions.map((q) => ({ text: q.text, requires: [...q.requires] })),
  };
  if (s.pdbId !== undefined) config.pdbId = s.pdbId;
  if (s.structurePreference !== undefined) config.structurePreference = s.structurePreference;
  if (s.variant !== undefined) config.variant = variantOf(s.variant);
  if (s.bridgeQuestion !== undefined) config.bridgeQuestion = s.bridgeQuestion;
  return config;
}

/** The specification that a configuration mirrors (the inverse of loadGeneSpec, without notes). A substitution is written without `kind`, as hbb.json is. */
export function specOf(config: SliceConfig): GeneSpec {
  const variant = config.variant === undefined ? undefined : config.variant.kind === "substitution" ? (({ kind, ...rest }) => rest)(config.variant) : config.variant;
  return GeneSpecSchema.parse({
    datasetId: config.datasetId,
    description: config.description,
    identifiers: { ensemblGeneId: config.ensemblGeneId, hgncSymbol: config.hgncSymbol, uniprotAccession: config.uniprotAccession },
    ...(config.pdbId !== undefined ? { pdbId: config.pdbId } : {}),
    ...(config.structurePreference !== undefined ? { structurePreference: config.structurePreference } : {}),
    ...(variant !== undefined ? { variant } : {}),
    genomicWindowFlank: config.genomicWindowFlank,
    contactCutoffAngstrom: config.contactCutoffAngstrom,
    includeAlphafold: config.includeAlphafold,
    pathways: config.pathways,
    associations: config.associations,
    questions: config.questions,
    ...(config.bridgeQuestion !== undefined ? { bridgeQuestion: config.bridgeQuestion } : {}),
  });
}
