// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/** AlphaFold DB adapter (optional, predicted models only; always labelled as predictions). */
import { z } from "zod";
import type { HttpClient, RequestOptions } from "../http/client.ts";
import { InvalidParameterError, ParseError } from "../http/errors.ts";
import { readDataUsage } from "../mmcif/structure.ts";
import { type Fetched, parseWith } from "./common.ts";

export const alphafoldUrls = {
  prediction: (accession: string): string => {
    if (!/^[A-Z0-9]{6,10}$/.test(accession)) throw new InvalidParameterError(`Not a UniProt accession: ${accession}`);
    return `https://alphafold.ebi.ac.uk/api/prediction/${accession}`;
  },
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
      sequence: z.string(),
      cifUrl: z.string(),
      toolUsed: z.string().optional(),
    }),
  )
  .min(1);

export interface AlphafoldPrediction {
  entryId: string;
  modelVersion: number;
  modelCreatedDate: string;
  uniprotAccession: string;
  uniprotStart: number;
  uniprotEnd: number;
  sequenceChecksumMd5: string;
  globalPlddt: number | null;
  sequence: string;
  cifUrl: string;
  toolUsed: string | null;
}

export function parseAlphafoldPrediction(json: unknown, url: string | null = null): AlphafoldPrediction {
  const raw = parseWith(PredictionRaw, json, "AlphaFold prediction", url);
  const p = raw[0]!;
  return {
    entryId: p.entryId,
    modelVersion: p.latestVersion,
    modelCreatedDate: p.modelCreatedDate,
    uniprotAccession: p.uniprotAccession,
    uniprotStart: p.sequenceStart,
    uniprotEnd: p.sequenceEnd,
    sequenceChecksumMd5: p.sequenceChecksum.toUpperCase(),
    globalPlddt: p.globalMetricValue ?? null,
    sequence: p.sequence,
    cifUrl: p.cifUrl,
    toolUsed: p.toolUsed ?? null,
  };
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
  async modelFile(cifUrl: string, ro?: RequestOptions) {
    if (!/^https:\/\/alphafold\.ebi\.ac\.uk\/files\/AF-[A-Z0-9]+-F\d+-model_v\d+\.cif$/.test(cifUrl)) {
      throw new InvalidParameterError(`Unexpected AlphaFold model URL: ${cifUrl}`);
    }
    const response = await this.http.getText("alphafold", cifUrl, { timeoutMs: 60_000, ...ro });
    return { data: { disclaimer: alphafoldDisclaimer(response.body, cifUrl) }, response };
  }
}
