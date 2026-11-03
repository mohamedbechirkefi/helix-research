// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * AlphaFold DB adapter (optional, predicted models only; always labelled as predictions).
 * Phase 9 (P9.1.1): per-residue confidence (pLDDT) read from the model file's own
 * `_ma_qa_metric_local` table, the predicted aligned error (PAE) matrix from the PAE file the
 * prediction record names, and the pLDDT bands AlphaFold DB uses to colour a model. None of this
 * makes a prediction more than a prediction: every consumer labels it class 3 and keeps the in-file
 * disclaimer.
 */
import { z } from "zod";
import type { HttpClient, RequestOptions } from "../http/client.ts";
import { InvalidParameterError, ParseError } from "../http/errors.ts";
import { parseMmcif, rowsOf } from "../mmcif/parser.ts";
import { readDataUsage } from "../mmcif/structure.ts";
import { type Fetched, parseWith } from "./common.ts";

export const alphafoldUrls = {
  prediction: (accession: string): string => {
    if (!/^[A-Z0-9]{6,10}$/.test(accession)) throw new InvalidParameterError(`Not a UniProt accession: ${accession}`);
    return `https://alphafold.ebi.ac.uk/api/prediction/${accession}`;
  },
  /** The model (mmCIF) and PAE (JSON) files are only ever taken from the prediction record; these guards keep a caller from fetching anything else under that name. */
  isModelFile: (url: string): boolean => /^https:\/\/alphafold\.ebi\.ac\.uk\/files\/AF-[A-Z0-9]+-F\d+-model_v\d+\.cif$/.test(url),
  isPaeFile: (url: string): boolean => /^https:\/\/alphafold\.ebi\.ac\.uk\/files\/AF-[A-Z0-9]+-F\d+-predicted_aligned_error_v\d+\.json$/.test(url),
};

const PredictionRaw = z
  .array(
    z.object({
      entryId: z.string(),
      modelEntityId: z.string().optional(),
      latestVersion: z.number().int(),
      modelCreatedDate: z.string(),
      uniprotAccession: z.string(),
      sequenceStart: z.number().int(),
      sequenceEnd: z.number().int(),
      sequenceChecksum: z.string(),
      globalMetricValue: z.number().optional(),
      fractionPlddtVeryLow: z.number().optional(),
      fractionPlddtLow: z.number().optional(),
      fractionPlddtConfident: z.number().optional(),
      fractionPlddtVeryHigh: z.number().optional(),
      sequence: z.string(),
      cifUrl: z.string(),
      paeDocUrl: z.string().optional(),
      paeImageUrl: z.string().optional(),
      toolUsed: z.string().optional(),
      isReviewed: z.boolean().optional(),
      isUniProtReviewed: z.boolean().optional(),
      chainId: z.string().optional(),
    }),
  )
  .min(1);

/** AlphaFold DB's four confidence bands (pLDDT): very high > 90, confident 70 to 90, low 50 to 70, very low < 50. */
export type PlddtBand = "very-high" | "confident" | "low" | "very-low";

export function plddtBand(plddt: number): PlddtBand {
  if (plddt > 90) return "very-high";
  if (plddt > 70) return "confident";
  if (plddt > 50) return "low";
  return "very-low";
}

export interface AlphafoldPrediction {
  entryId: string;
  modelVersion: number;
  modelCreatedDate: string;
  uniprotAccession: string;
  uniprotStart: number;
  uniprotEnd: number;
  sequenceChecksumMd5: string;
  globalPlddt: number | null;
  /** Share of residues in each band, as the prediction record states them (null when the record omits them). */
  plddtFractions: { veryLow: number; low: number; confident: number; veryHigh: number } | null;
  sequence: string;
  cifUrl: string;
  /** The PAE file (JSON) and image the record names; null for records without them. */
  paeDocUrl: string | null;
  paeImageUrl: string | null;
  toolUsed: string | null;
  /** Whether the UniProt entry is reviewed (Swiss-Prot); null when the record does not say. */
  uniprotReviewed: boolean | null;
  chainId: string | null;
}

export function parseAlphafoldPrediction(json: unknown, url: string | null = null): AlphafoldPrediction {
  const raw = parseWith(PredictionRaw, json, "AlphaFold prediction", url);
  const p = raw[0]!;
  const fr = [p.fractionPlddtVeryLow, p.fractionPlddtLow, p.fractionPlddtConfident, p.fractionPlddtVeryHigh];
  const fractions = fr.every((x): x is number => typeof x === "number") ? { veryLow: fr[0]!, low: fr[1]!, confident: fr[2]!, veryHigh: fr[3]! } : null;
  return {
    entryId: p.entryId,
    modelVersion: p.latestVersion,
    modelCreatedDate: p.modelCreatedDate,
    uniprotAccession: p.uniprotAccession,
    uniprotStart: p.sequenceStart,
    uniprotEnd: p.sequenceEnd,
    sequenceChecksumMd5: p.sequenceChecksum.toUpperCase(),
    globalPlddt: p.globalMetricValue ?? null,
    plddtFractions: fractions,
    sequence: p.sequence,
    cifUrl: p.cifUrl,
    paeDocUrl: p.paeDocUrl ?? null,
    paeImageUrl: p.paeImageUrl ?? null,
    toolUsed: p.toolUsed ?? null,
    uniprotReviewed: p.isReviewed ?? p.isUniProtReviewed ?? null,
    chainId: p.chainId ?? null,
  };
}

export interface LocalPlddt {
  /** Model sequence position (label_seq_id), 1-based; equals the UniProt position for a full-length single-fragment model. */
  seqId: number;
  compId: string;
  plddt: number;
  band: PlddtBand;
}

/**
 * Per-residue pLDDT from the model file's `_ma_qa_metric_local` table (the metric whose
 * `_ma_qa_metric` row is named pLDDT in local mode). One row per residue of the first model;
 * the table is required: a model file without it is not an AlphaFold DB model file.
 */
export function alphafoldLocalPlddt(cifText: string, url: string | null = null): LocalPlddt[] {
  const block = parseMmcif(cifText, url);
  const metrics = rowsOf(block, "ma_qa_metric");
  const local = metrics.find((m) => m.mode === "local" && /^pLDDT$/i.test(m.name ?? ""));
  if (!local) throw new ParseError("AlphaFold model", ["no local pLDDT metric in _ma_qa_metric"], url);
  const rows = rowsOf(block, "ma_qa_metric_local").filter((r) => r.metric_id === local.id && (r.model_id === undefined || r.model_id === "1"));
  if (rows.length === 0) throw new ParseError("AlphaFold model", ["no _ma_qa_metric_local rows for pLDDT"], url);
  const out = rows.map((r) => {
    const seqId = Number(r.label_seq_id);
    const plddt = Number(r.metric_value);
    if (!Number.isInteger(seqId) || !Number.isFinite(plddt) || plddt < 0 || plddt > 100) throw new ParseError("AlphaFold model", [`bad _ma_qa_metric_local row: ${r.label_seq_id} ${r.metric_value}`], url);
    return { seqId, compId: r.label_comp_id ?? "?", plddt, band: plddtBand(plddt) };
  });
  for (let i = 1; i < out.length; i++) if (out[i]!.seqId !== out[i - 1]!.seqId + 1) throw new ParseError("AlphaFold model", [`pLDDT rows not contiguous at ${out[i]!.seqId}`], url);
  return out;
}

const PaeRaw = z
  .array(
    z.object({
      predicted_aligned_error: z.array(z.array(z.number())),
      max_predicted_aligned_error: z.number(),
    }),
  )
  .min(1);

export interface AlphafoldPae {
  /** Number of residues (the matrix is size by size). */
  size: number;
  /** Expected position error in ångströms of residue j when the prediction is aligned on residue i: `matrix[i][j]`. */
  matrix: number[][];
  maxPae: number;
}

/** The PAE file: one object with a square matrix (rows and columns are residues in model order) and its maximum. */
export function parseAlphafoldPae(json: unknown, url: string | null = null): AlphafoldPae {
  const raw = parseWith(PaeRaw, json, "AlphaFold PAE", url);
  const m = raw[0]!.predicted_aligned_error;
  const size = m.length;
  const problems: string[] = [];
  if (size === 0) problems.push("empty matrix");
  m.forEach((row, i) => {
    if (row.length !== size) problems.push(`row ${i} has ${row.length} values, expected ${size}`);
  });
  if (problems.length > 0) throw new ParseError("AlphaFold PAE", problems.slice(0, 3), url);
  return { size, matrix: m, maxPae: raw[0]!.max_predicted_aligned_error };
}

/** The licence and disclaimer text AlphaFold keeps inside the model file; it must travel with the model. */
export function alphafoldDisclaimer(cifText: string, url: string | null = null): string {
  const texts = readDataUsage(cifText, url);
  if (texts.length === 0) throw new ParseError("AlphaFold model", ["no _pdbx_data_usage disclaimer"], url);
  return texts.join("\n\n");
}

export class AlphafoldAdapter {
  private readonly http: HttpClient;
  constructor(http: HttpClient) {
    this.http = http;
  }
  async prediction(accession: string, ro?: RequestOptions): Promise<Fetched<AlphafoldPrediction>> {
    const url = alphafoldUrls.prediction(accession);
    const { response, json } = await this.http.getJson("alphafold", url, ro);
    return { data: parseAlphafoldPrediction(json, url), response };
  }
  /** The model file: its disclaimer (kept with the model) and the per-residue pLDDT it carries. */
  async modelFile(cifUrl: string, ro?: RequestOptions): Promise<Fetched<{ disclaimer: string; localPlddt: LocalPlddt[] }>> {
    if (!alphafoldUrls.isModelFile(cifUrl)) throw new InvalidParameterError(`Unexpected AlphaFold model URL: ${cifUrl}`);
    const response = await this.http.getText("alphafold", cifUrl, { timeoutMs: 60_000, ...ro });
    return { data: { disclaimer: alphafoldDisclaimer(response.body, cifUrl), localPlddt: alphafoldLocalPlddt(response.body, cifUrl) }, response };
  }
  /** The PAE file named by the prediction record. */
  async pae(paeDocUrl: string, ro?: RequestOptions): Promise<Fetched<AlphafoldPae>> {
    if (!alphafoldUrls.isPaeFile(paeDocUrl)) throw new InvalidParameterError(`Unexpected AlphaFold PAE URL: ${paeDocUrl}`);
    const { response, json } = await this.http.getJson("alphafold", paeDocUrl, { timeoutMs: 60_000, ...ro });
    return { data: parseAlphafoldPae(json, paeDocUrl), response };
  }
}
