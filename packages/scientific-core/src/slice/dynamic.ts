// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Dynamic mode (Phase 9, P9.3.1; docs/phase-9-generalisation.md section 16): a recognised human
 * protein-coding gene that has no curated set gets a smaller journey built at request time, in the
 * visitor's browser, through the same acquisition and the same builder as a curated set.
 *
 * This module holds the two things dynamic mode adds to the library: the resolution of a typed
 * query against HGNC (symbol first, then alias; one approved protein-coding record with one Ensembl
 * gene id and one UniProt accession, or a refusal that says why) and the configuration such a
 * resolution gives the builder (rule 1: no experimental structure, no variant, no pathways, no
 * associations, the AlphaFold prediction record included). Acquisition and the build are
 * `acquireSlice` and `buildSlice`, unchanged; the manifest is `buildManifest` with `mode: "dynamic"`.
 *
 * Platform-agnostic: only an HttpClient is needed, so the same code runs in a worker in the browser
 * (the app) and in Node (the fixture recorder and the tests). Nothing here adds an identifier to a
 * request: in a browser the page's own user agent applies.
 */
import { HgncAdapter, type HgncRecord, type HttpClient, NotFoundError, type FetchedResponse } from "@helix/data-adapters";
import { DYNAMIC_QUERY, dynamicDatasetId } from "./dynamic-steps.ts";
import type { SliceConfig } from "./types.ts";

export * from "./dynamic-steps.ts";

/** HGNC locus type of a gene with a protein product (the only kind dynamic mode builds). */
export const PROTEIN_CODING_LOCUS_TYPE = "gene with protein product";

/** The one HGNC record a dynamic build is made from, with the fields the builder's configuration needs. */
export interface ResolvedDynamicGene {
  symbol: string;
  hgncId: string;
  name: string;
  ensemblGeneId: string;
  uniprotAccession: string;
  matchedBy: "symbol" | "alias";
  /** The HGNC responses the resolution read, so that a caller can keep them as provenance. */
  responses: FetchedResponse[];
}

export class DynamicResolutionError extends Error {
  override readonly name = "DynamicResolutionError";
  readonly code: "invalid-query" | "not-found" | "ambiguous" | "not-protein-coding" | "not-approved" | "no-ensembl-id" | "no-uniprot" | "several-uniprot";
  constructor(code: DynamicResolutionError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * The pure decision over HGNC's answers (testable on hand-made records): `bySymbol` is the record of
 * the exact approved symbol (null when HGNC returned none), `byAlias` the records whose alias list
 * carries the query. A symbol hit wins; one alias hit is taken; several are ambiguous; none is not
 * found. The record is then checked: approved, a protein product, one Ensembl gene id, exactly one
 * UniProt accession. Every refusal names the query and the reason.
 */
export function decideDynamicResolution(query: string, bySymbol: HgncRecord | null, byAlias: HgncRecord[]): Omit<ResolvedDynamicGene, "responses"> {
  const q = query.trim();
  let record: HgncRecord;
  let matchedBy: "symbol" | "alias";
  if (bySymbol) {
    record = bySymbol;
    matchedBy = "symbol";
  } else {
    const hits = byAlias.filter((r) => r.aliases.some((a) => a.toLowerCase() === q.toLowerCase()));
    if (hits.length === 0) throw new DynamicResolutionError("not-found", `"${q}" is not an approved HGNC symbol and no HGNC record lists it as an alias.`);
    if (hits.length > 1) throw new DynamicResolutionError("ambiguous", `"${q}" is an alias of ${hits.length} HGNC records (${hits.map((h) => `${h.symbol}, ${h.hgncId}`).join("; ")}); type the approved symbol.`);
    record = hits[0]!;
    matchedBy = "alias";
  }
  const who = matchedBy === "alias" ? `"${q}" (alias of ${record.symbol}, ${record.hgncId})` : `${record.symbol} (${record.hgncId})`;
  if (record.status !== "Approved") throw new DynamicResolutionError("not-approved", `${who} has HGNC status "${record.status}", not Approved.`);
  if (record.locusType !== PROTEIN_CODING_LOCUS_TYPE) throw new DynamicResolutionError("not-protein-coding", `${who} is not a gene with a protein product (HGNC locus type ${record.locusType ? `"${record.locusType}"` : "absent"}); dynamic mode builds protein-coding genes only.`);
  if (!record.ensemblGeneId) throw new DynamicResolutionError("no-ensembl-id", `${who} has no Ensembl gene id in its HGNC record.`);
  if (record.uniprotIds.length === 0) throw new DynamicResolutionError("no-uniprot", `${who} has no UniProt accession in its HGNC record.`);
  if (record.uniprotIds.length > 1) throw new DynamicResolutionError("several-uniprot", `${who} has ${record.uniprotIds.length} UniProt accessions in its HGNC record (${record.uniprotIds.join(", ")}); dynamic mode needs one.`);
  return { symbol: record.symbol, hgncId: record.hgncId, name: record.name, ensemblGeneId: record.ensemblGeneId, uniprotAccession: record.uniprotIds[0]!, matchedBy };
}

/**
 * Resolve a typed query against HGNC: fetch by approved symbol, then by alias when the symbol fetch
 * returns no document. The HGNC calls are simple GETs (Accept is CORS-safelisted), so they run from
 * a browser as from Node.
 */
export async function resolveDynamicGene(http: HttpClient, query: string): Promise<ResolvedDynamicGene> {
  const q = query.trim();
  if (!DYNAMIC_QUERY.test(q)) throw new DynamicResolutionError("invalid-query", `"${q}" is not a gene symbol (2 to 10 letters, digits or hyphens, starting with a letter).`);
  const hgnc = new HgncAdapter(http);
  const responses: FetchedResponse[] = [];
  let bySymbol: HgncRecord | null = null;
  try {
    const r = await hgnc.symbol(q);
    responses.push(r.response);
    bySymbol = r.data;
  } catch (e) {
    if (!(e instanceof NotFoundError)) throw e;
  }
  let byAlias: HgncRecord[] = [];
  if (!bySymbol) {
    const r = await hgnc.alias(q);
    responses.push(r.response);
    byAlias = r.data;
  }
  return { ...decideDynamicResolution(q, bySymbol, byAlias), responses };
}

/** The words of the description every dynamic manifest carries (the mode is named, never implied). */
export const dynamicDescription = (g: Pick<ResolvedDynamicGene, "symbol" | "hgncId" | "ensemblGeneId" | "uniprotAccession">): string =>
  `${g.symbol} (${g.hgncId}) dynamic set, built at request time from live retrievals, not curated: gene ${g.ensemblGeneId}, MANE Select transcript, sequences, UniProt ${g.uniprotAccession}, the AlphaFold prediction record; no experimental structure selected, no variant, no pathways, no associations.`;

/**
 * The builder's configuration for a resolved gene (plan section 16 rule 1): no `pdbId`, no `variant`,
 * `pathways` and `associations` false, the AlphaFold record included, no curated questions. The
 * window flank and contact cutoff are the curated defaults; nothing reads them without a variant or a
 * structure.
 */
export function dynamicConfig(symbol: string, resolved: Pick<ResolvedDynamicGene, "hgncId" | "ensemblGeneId" | "uniprotAccession">): SliceConfig {
  return {
    datasetId: dynamicDatasetId(symbol),
    description: dynamicDescription({ symbol, ...resolved }),
    ensemblGeneId: resolved.ensemblGeneId,
    hgncSymbol: symbol,
    uniprotAccession: resolved.uniprotAccession,
    genomicWindowFlank: 20,
    contactCutoffAngstrom: 4.5,
    includeAlphafold: true,
    pathways: false,
    associations: false,
    questions: [],
    mode: "dynamic",
  };
}

