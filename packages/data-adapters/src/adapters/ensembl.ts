// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Ensembl REST adapter (P2.2.2). GRCh38 host only; the content type goes in the query
 * string so browser calls stay CORS-simple (registry §1).
 */
import { z } from "zod";
import type { HttpClient, RequestOptions } from "../http/client.ts";
import { InvalidParameterError } from "../http/errors.ts";
import { type Fetched, parseFasta, parseWith } from "./common.ts";

export const ENSEMBL_BASE = "https://rest.ensembl.org";
const JSON_CT = "content-type=application/json";

const STABLE_ID = /^ENS(G|T|P|E)\d{11}$/;
const RSID = /^rs\d+$/;

function checkStableId(id: string, kinds: string): void {
  const m = STABLE_ID.exec(id);
  if (!m || !kinds.includes(m[1]!)) throw new InvalidParameterError(`Not an unversioned Ensembl ${kinds} stable id: ${id}`);
}

// ---------------------------------------------------------------- URLs (pure)

export const ensemblUrls = {
  infoData: (): string => `${ENSEMBL_BASE}/info/data?${JSON_CT}`,
  infoAssembly: (): string => `${ENSEMBL_BASE}/info/assembly/homo_sapiens?${JSON_CT}`,
  lookupId: (id: string, opts: { utr?: boolean } = {}): string => {
    checkStableId(id, "GT");
    return `${ENSEMBL_BASE}/lookup/id/${id}?expand=1;${opts.utr ? "utr=1;" : ""}mane=1;${JSON_CT}`;
  },
  lookupSymbol: (symbol: string): string => {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,30}$/.test(symbol)) throw new InvalidParameterError(`Invalid gene symbol: ${symbol}`);
    return `${ENSEMBL_BASE}/lookup/symbol/homo_sapiens/${encodeURIComponent(symbol)}?expand=1;mane=1;${JSON_CT}`;
  },
  sequenceId: (id: string, type: "cds" | "cdna" | "protein" | "genomic"): string => {
    checkStableId(id, type === "protein" ? "P" : type === "genomic" ? "GT" : "T");
    const t = type === "protein" ? "" : `type=${type};`;
    return `${ENSEMBL_BASE}/sequence/id/${id}?${t}content-type=text/x-fasta`;
  },
  sequenceRegion: (seqRegion: string, start: number, end: number, strand: 1 | -1): string => {
    if (!/^[0-9XYMT]+$/.test(seqRegion) || !(Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start)) {
      throw new InvalidParameterError(`Invalid region ${seqRegion}:${start}..${end}`);
    }
    if (end - start > 10_000) throw new InvalidParameterError("Region window larger than 10 kb; HELIX never bulk-fetches genomes");
    return `${ENSEMBL_BASE}/sequence/region/human/${seqRegion}:${start}..${end}:${strand}?${JSON_CT}`;
  },
  mapCds: (transcriptId: string, start: number, end: number): string => {
    checkStableId(transcriptId, "T");
    return `${ENSEMBL_BASE}/map/cds/${transcriptId}/${start}..${end}?${JSON_CT}`;
  },
  variation: (rsId: string): string => {
    if (!RSID.test(rsId)) throw new InvalidParameterError(`Not an rsID: ${rsId}`);
    return `${ENSEMBL_BASE}/variation/human/${rsId}?${JSON_CT}`;
  },
  variantRecoder: (rsId: string): string => {
    if (!RSID.test(rsId)) throw new InvalidParameterError(`Not an rsID: ${rsId}`);
    return `${ENSEMBL_BASE}/variant_recoder/human/${rsId}?fields=id,hgvsg,hgvsc,hgvsp,spdi;${JSON_CT}`;
  },
  /** A substitution (c.20A>T) or a deletion of a CDS span (c.1521_1523del, Phase 9) on a versioned Ensembl transcript. */
  vepHgvs: (hgvs: string): string => {
    if (!/^ENST\d{11}\.\d+:c\.(\d+[ACGT]>[ACGT]|\d+_\d+del)$/.test(hgvs)) throw new InvalidParameterError(`Unsupported HGVS for VEP: ${hgvs}`);
    return `${ENSEMBL_BASE}/vep/human/hgvs/${hgvs}?hgvs=1;mane=1;canonical=1;uniprot=1;${JSON_CT}`;
  },
};

// ---------------------------------------------------------------- raw schemas

const Exon = z.object({ id: z.string(), version: z.number().int(), start: z.number().int(), end: z.number().int(), strand: z.number().int() });
const Utr = z.object({ type: z.string(), start: z.number().int(), end: z.number().int() });
const Mane = z.object({ type: z.string(), refseq_match: z.string() });
const TranslationRaw = z.object({ id: z.string(), version: z.number().int(), length: z.number().int(), start: z.number().int(), end: z.number().int() });

export const EnsemblTranscriptRaw = z.object({
  id: z.string(),
  version: z.number().int(),
  display_name: z.string().default(""),
  biotype: z.string(),
  is_canonical: z.number().int().default(0),
  MANE: z.array(Mane).default([]),
  assembly_name: z.string(),
  seq_region_name: z.string(),
  start: z.number().int(),
  end: z.number().int(),
  strand: z.union([z.literal(1), z.literal(-1)]),
  length: z.number().int().optional(),
  Exon: z.array(Exon).default([]),
  UTR: z.array(Utr).default([]),
  Translation: TranslationRaw.optional(),
});
export type EnsemblTranscriptRaw = z.infer<typeof EnsemblTranscriptRaw>;

export const EnsemblGeneRaw = z.object({
  id: z.string(),
  version: z.number().int(),
  display_name: z.string(),
  description: z.string().nullable().default(null),
  biotype: z.string(),
  assembly_name: z.string(),
  seq_region_name: z.string(),
  start: z.number().int(),
  end: z.number().int(),
  strand: z.union([z.literal(1), z.literal(-1)]),
  canonical_transcript: z.string().optional(),
  Transcript: z.array(EnsemblTranscriptRaw).default([]),
});
export type EnsemblGeneRaw = z.infer<typeof EnsemblGeneRaw>;

export const EnsemblInfoData = z.object({ releases: z.array(z.number().int()).min(1) });
export const EnsemblAssembly = z.object({
  assembly_name: z.string(),
  assembly_accession: z.string(),
  default_coord_system_version: z.string(),
  genebuild_last_geneset_update: z.string().optional(),
});
export type EnsemblAssembly = z.infer<typeof EnsemblAssembly>;

export const EnsemblRegionSequence = z.object({ id: z.string(), seq: z.string(), molecule: z.string() });

export const EnsemblMapping = z.object({
  mappings: z
    .array(z.object({ start: z.number().int(), end: z.number().int(), strand: z.number().int(), seq_region_name: z.string(), assembly_name: z.string(), gap: z.number().int().optional() }))
    .min(1),
});
export type EnsemblMapping = z.infer<typeof EnsemblMapping>;

export const EnsemblVariation = z.object({
  name: z.string(),
  var_class: z.string(),
  mappings: z.array(
    z.object({
      location: z.string(),
      allele_string: z.string(),
      assembly_name: z.string(),
      strand: z.number().int(),
      start: z.number().int(),
      end: z.number().int(),
      seq_region_name: z.string(),
    }),
  ),
});
export type EnsemblVariation = z.infer<typeof EnsemblVariation>;

const RecoderAllele = z.object({
  hgvsg: z.array(z.string()).default([]),
  hgvsc: z.array(z.string()).default([]),
  hgvsp: z.array(z.string()).default([]),
  spdi: z.array(z.string()).default([]),
});
/** variant_recoder returns [{<forward allele>: {...}}]. Non-object keys (e.g. warnings) are rejected. */
export const EnsemblVariantRecoder = z.array(z.record(z.string(), RecoderAllele)).min(1);
export type EnsemblVariantRecoder = z.infer<typeof EnsemblVariantRecoder>;

export const EnsemblVepTranscriptConsequence = z.object({
  transcript_id: z.string(),
  consequence_terms: z.array(z.string()),
  codons: z.string().optional(),
  amino_acids: z.string().optional(),
  protein_start: z.number().int().optional(),
  protein_end: z.number().int().optional(),
  cds_start: z.number().int().optional(),
  cds_end: z.number().int().optional(),
  cdna_start: z.number().int().optional(),
  cdna_end: z.number().int().optional(),
  hgvsc: z.string().optional(),
  hgvsp: z.string().optional(),
  swissprot: z.array(z.string()).optional(),
  mane_select: z.string().optional(),
  variant_allele: z.string().optional(),
});
/** colocated_variants (which carry third-party accessions) are deliberately not in the schema. */
export const EnsemblVep = z
  .array(
    z.object({
      input: z.string(),
      assembly_name: z.string(),
      most_severe_consequence: z.string(),
      transcript_consequences: z.array(EnsemblVepTranscriptConsequence),
    }),
  )
  .min(1);
export type EnsemblVep = z.infer<typeof EnsemblVep>;

// ---------------------------------------------------------------- parsers (pure)

export const parseEnsembl = {
  infoData: (json: unknown, url: string | null = null) => parseWith(EnsemblInfoData, json, "Ensembl info/data", url),
  assembly: (json: unknown, url: string | null = null) => parseWith(EnsemblAssembly, json, "Ensembl info/assembly", url),
  gene: (json: unknown, url: string | null = null) => parseWith(EnsemblGeneRaw, json, "Ensembl gene lookup", url),
  transcript: (json: unknown, url: string | null = null) => parseWith(EnsemblTranscriptRaw, json, "Ensembl transcript lookup", url),
  regionSequence: (json: unknown, url: string | null = null) => parseWith(EnsemblRegionSequence, json, "Ensembl sequence/region", url),
  mapping: (json: unknown, url: string | null = null) => parseWith(EnsemblMapping, json, "Ensembl map", url),
  variation: (json: unknown, url: string | null = null) => parseWith(EnsemblVariation, json, "Ensembl variation", url),
  variantRecoder: (json: unknown, url: string | null = null) => parseWith(EnsemblVariantRecoder, json, "Ensembl variant_recoder", url),
  vep: (json: unknown, url: string | null = null) => parseWith(EnsemblVep, json, "Ensembl VEP", url),
  fasta: parseFasta,
};

// ---------------------------------------------------------------- fetchers

export class EnsemblAdapter {
  private readonly http: HttpClient;
  constructor(http: HttpClient) {
    this.http = http;
  }
  private async json<T>(url: string, parse: (j: unknown, u: string) => T, ro?: RequestOptions): Promise<Fetched<T>> {
    const { response, json } = await this.http.getJson("ensembl", url, ro);
    return { data: parse(json, url), response };
  }
  infoData(ro?: RequestOptions) {
    return this.json(ensemblUrls.infoData(), parseEnsembl.infoData, ro);
  }
  assembly(ro?: RequestOptions) {
    return this.json(ensemblUrls.infoAssembly(), parseEnsembl.assembly, ro);
  }
  lookupGene(id: string, ro?: RequestOptions) {
    return this.json(ensemblUrls.lookupId(id), parseEnsembl.gene, ro);
  }
  lookupSymbol(symbol: string, ro?: RequestOptions) {
    return this.json(ensemblUrls.lookupSymbol(symbol), parseEnsembl.gene, ro);
  }
  lookupTranscript(id: string, ro?: RequestOptions) {
    return this.json(ensemblUrls.lookupId(id, { utr: true }), parseEnsembl.transcript, ro);
  }
  async sequence(id: string, type: "cds" | "cdna" | "protein" | "genomic", ro?: RequestOptions) {
    const url = ensemblUrls.sequenceId(id, type);
    const response = await this.http.getText("ensembl", url, ro);
    return { data: parseFasta(response.body, url), response };
  }
  region(seqRegion: string, start: number, end: number, strand: 1 | -1, ro?: RequestOptions) {
    return this.json(ensemblUrls.sequenceRegion(seqRegion, start, end, strand), parseEnsembl.regionSequence, ro);
  }
  mapCds(transcriptId: string, start: number, end: number, ro?: RequestOptions) {
    return this.json(ensemblUrls.mapCds(transcriptId, start, end), parseEnsembl.mapping, ro);
  }
  variation(rsId: string, ro?: RequestOptions) {
    return this.json(ensemblUrls.variation(rsId), parseEnsembl.variation, ro);
  }
  variantRecoder(rsId: string, ro?: RequestOptions) {
    return this.json(ensemblUrls.variantRecoder(rsId), parseEnsembl.variantRecoder, ro);
  }
  vep(hgvs: string, ro?: RequestOptions) {
    return this.json(ensemblUrls.vepHgvs(hgvs), parseEnsembl.vep, ro);
  }
}
