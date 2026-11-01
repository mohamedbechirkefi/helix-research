// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * HGNC REST adapter (conditional source, registry §8): approved symbols and aliases for
 * gene/alias resolution. `Accept: application/json` is CORS-safelisted, so the call stays
 * a simple request in browsers.
 */
import { z } from "zod";
import type { HttpClient, RequestOptions } from "../http/client.ts";
import { InvalidParameterError, NotFoundError } from "../http/errors.ts";
import { type Fetched, parseWith } from "./common.ts";

const SYMBOL = /^[A-Za-z0-9][A-Za-z0-9._-]{0,40}$/;

export const hgncUrls = {
  fetchSymbol: (symbol: string): string => {
    if (!SYMBOL.test(symbol)) throw new InvalidParameterError(`Invalid symbol: ${symbol}`);
    return `https://rest.genenames.org/fetch/symbol/${encodeURIComponent(symbol)}`;
  },
  fetchAlias: (alias: string): string => {
    if (!SYMBOL.test(alias)) throw new InvalidParameterError(`Invalid alias: ${alias}`);
    return `https://rest.genenames.org/fetch/alias_symbol/${encodeURIComponent(alias)}`;
  },
};

const DocRaw = z.object({
  hgnc_id: z.string(),
  symbol: z.string(),
  name: z.string(),
  status: z.string(),
  alias_symbol: z.array(z.string()).default([]),
  prev_symbol: z.array(z.string()).default([]),
  ensembl_gene_id: z.string().optional(),
  entrez_id: z.string().optional(),
  uniprot_ids: z.array(z.string()).default([]),
  mane_select: z.array(z.string()).default([]),
  location: z.string().optional(),
});
const ResponseRaw = z.object({ response: z.object({ numFound: z.number().int(), docs: z.array(DocRaw) }) });

export interface HgncRecord {
  hgncId: string;
  symbol: string;
  name: string;
  status: string;
  aliases: string[];
  previousSymbols: string[];
  ensemblGeneId: string | null;
  ncbiGeneId: string | null;
  uniprotIds: string[];
  maneSelect: string[];
  location: string | null;
}

export function parseHgnc(json: unknown, url: string | null = null): HgncRecord[] {
  const raw = parseWith(ResponseRaw, json, "HGNC response", url);
  return raw.response.docs.map((d) => ({
    hgncId: d.hgnc_id,
    symbol: d.symbol,
    name: d.name,
    status: d.status,
    aliases: d.alias_symbol,
    previousSymbols: d.prev_symbol,
    ensemblGeneId: d.ensembl_gene_id ?? null,
    ncbiGeneId: d.entrez_id ?? null,
    uniprotIds: d.uniprot_ids,
    maneSelect: d.mane_select,
    location: d.location ?? null,
  }));
}

export class HgncAdapter {
  private readonly http: HttpClient;
  constructor(http: HttpClient) {
    this.http = http;
  }
  private async fetchDocs(url: string, ro?: RequestOptions): Promise<Fetched<HgncRecord[]>> {
    const { response, json } = await this.http.getJson("hgnc", url, { ...ro, headers: { Accept: "application/json", ...ro?.headers } });
    return { data: parseHgnc(json, url), response };
  }
  /** Exact approved symbol; NotFoundError when HGNC returns no document. */
  async symbol(symbol: string, ro?: RequestOptions): Promise<Fetched<HgncRecord>> {
    const url = hgncUrls.fetchSymbol(symbol);
    const r = await this.fetchDocs(url, ro);
    const doc = r.data[0];
    if (!doc) throw new NotFoundError(url, "numFound 0");
    return { data: doc, response: r.response };
  }
  alias(alias: string, ro?: RequestOptions): Promise<Fetched<HgncRecord[]>> {
    return this.fetchDocs(hgncUrls.fetchAlias(alias), ro);
  }
}
