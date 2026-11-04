// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * NCBI ClinVar adapter via E-utilities esummary. Only the aggregate classification,
 * review status, locations and counts are kept. Trait names and trait cross-references
 * are not kept: they are aggregated across submissions (not effects of the variant) and
 * some carry identifiers from proprietary resources (Q-H-LIC-1).
 *
 * Requests carry `tool=helix-research` and no email parameter, so no personal address
 * ends up in a URL, a log or a browser bundle.
 */
import { z } from "zod";
import type { HttpClient, RequestOptions } from "../http/client.ts";
import { InvalidParameterError, ParseError } from "../http/errors.ts";
import { type Fetched, parseWith } from "./common.ts";

export const EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

export const clinvarUrls = {
  esummary: (uids: string[]): string => {
    if (uids.length === 0 || uids.some((u) => !/^\d+$/.test(u))) throw new InvalidParameterError("ClinVar uids must be numeric");
    return `${EUTILS_BASE}/esummary.fcgi?db=clinvar&id=${uids.join(",")}&retmode=json&tool=helix-research`;
  },
  einfo: (): string => `${EUTILS_BASE}/einfo.fcgi?db=clinvar&retmode=json&tool=helix-research`,
  /** esearch by rsID (all ClinVar records that cite it: alleles, haplotypes). Only an rsID is accepted. */
  esearchRs: (rsId: string): string => {
    if (!/^rs\d{1,12}$/.test(rsId)) throw new InvalidParameterError("ClinVar esearch term must be an rsID (rs followed by digits)");
    return `${EUTILS_BASE}/esearch.fcgi?db=clinvar&term=${rsId}&retmode=json&retmax=100&tool=helix-research`;
  },
  /**
   * esearch for a gene's missense variants classified Pathogenic or Likely pathogenic (Phase 9, P9.2.3,
   * plan section 15 rule 1): the term is built from the gene symbol and ClinVar's own search fields
   * (`[gene]`, the classification properties `clinsig pathogenic` and `clinsig likely pathogenic` under
   * `[Properties]`, and `"missense variant"[Molecular consequence]`, the MCNS field of einfo). The
   * review status is not in the term: the finder filters it on the summaries, where the words are
   * ClinVar's. Only an approved-symbol shape is accepted; at most `retmax` uids (default 100).
   */
  esearchGeneMissensePathogenic: (symbol: string, retmax = 100): string => {
    if (!/^[A-Za-z0-9][A-Za-z0-9@-]{0,39}$/.test(symbol)) throw new InvalidParameterError("ClinVar gene esearch needs a gene symbol (letters, digits, hyphen, at sign)");
    if (!Number.isInteger(retmax) || retmax < 1 || retmax > 100) throw new InvalidParameterError("ClinVar gene esearch retmax must be 1 to 100");
    return `${EUTILS_BASE}/esearch.fcgi?db=clinvar&term=${encodeURIComponent(clinvarGeneMissensePathogenicTerm(symbol))}&retmode=json&retmax=${retmax}&tool=helix-research`;
  },
};

/** The esearch term of `esearchGeneMissensePathogenic`, as text (quoted in the report and the registry). */
export function clinvarGeneMissensePathogenicTerm(symbol: string): string {
  return `${symbol}[gene] AND ("clinsig pathogenic"[Properties] OR "clinsig likely pathogenic"[Properties]) AND "missense variant"[Molecular consequence]`;
}

const Loc = z.object({ status: z.string(), assembly_name: z.string(), chr: z.string(), start: z.string(), stop: z.string(), assembly_acc_ver: z.string().optional() });
const DocRaw = z.object({
  uid: z.string(),
  obj_type: z.string(),
  accession: z.string(),
  accession_version: z.string(),
  title: z.string(),
  protein_change: z.string().default(""),
  supporting_submissions: z.object({ scv: z.array(z.string()).default([]) }).optional(),
  germline_classification: z.object({
    description: z.string(),
    review_status: z.string(),
    last_evaluated: z.string().default(""),
    trait_set: z.array(z.unknown()).default([]),
  }),
  clinical_impact_classification: z.object({ description: z.string().default("") }).loose().optional(),
  oncogenicity_classification: z.object({ description: z.string().default("") }).loose().optional(),
  record_status: z.string().default(""),
  variation_set: z
    .array(
      z.object({
        cdna_change: z.string().default(""),
        canonical_spdi: z.string().default(""),
        variation_loc: z.array(Loc).default([]),
        variation_name: z.string().default(""),
        variant_type: z.string().default(""),
        variation_xrefs: z.array(z.object({ db_source: z.string(), db_id: z.string() })).default([]),
      }),
    )
    .default([]),
  molecular_consequence_list: z.array(z.string()).default([]),
});
const EsummaryRaw = z.object({ result: z.record(z.string(), z.unknown()) });

export interface ClinvarRecord {
  uid: string;
  objectType: string;
  accession: string;
  accessionVersion: string;
  title: string;
  proteinChange: string | null;
  classification: string;
  reviewStatus: string;
  lastEvaluated: string | null;
  traitCount: number;
  supportingSubmissionCount: number;
  cdnaChanges: string[];
  canonicalSpdi: string[];
  locations: { assembly: string; status: string; chromosome: string; start: number; stop: number }[];
  /** True when the record describes more than one variant (haplotype, compound). Never merged with a single-variant record. */
  isHaplotypeOrCompound: boolean;
  /** Somatic clinical-impact and oncogenicity classifications (null when ClinVar reports none). */
  clinicalImpact: string | null;
  oncogenicity: string | null;
  /** ClinVar record_status ("" for a current record). */
  recordStatus: string;
  /** Phase 9 (P9.2.3): the variant names ClinVar writes per variation ("NM_001044.5(SLC6A3):c.1103T>A (p.Leu368Gln)"). */
  variationNames: string[];
  /** Phase 9 (P9.2.3): ClinVar's variant_type per variation ("single nucleotide variant", "Deletion"). */
  variantTypes: string[];
  /** Phase 9 (P9.2.3): dbSNP ids among the variation cross-references, as "rs<number>", in ClinVar's order, without repeats. */
  dbSnpIds: string[];
  /** Phase 9 (P9.2.3): ClinVar's molecular_consequence_list ("missense variant", "non-coding transcript variant"). */
  molecularConsequences: string[];
}

/** Parse an esummary response into one record per uid, in the order of `result.uids`. */
export function parseClinvarEsummary(json: unknown, url: string | null = null): ClinvarRecord[] {
  const raw = parseWith(EsummaryRaw, json, "ClinVar esummary", url);
  const uids = z.array(z.string()).safeParse(raw.result.uids);
  if (!uids.success) throw new ParseError("ClinVar esummary", ["result.uids missing"], url);
  return uids.data.map((uid) => {
    const d = parseWith(DocRaw, raw.result[uid], `ClinVar esummary uid ${uid}`, url);
    return {
      uid: d.uid,
      objectType: d.obj_type,
      accession: d.accession,
      accessionVersion: d.accession_version,
      title: d.title,
      proteinChange: d.protein_change || null,
      classification: d.germline_classification.description,
      reviewStatus: d.germline_classification.review_status,
      lastEvaluated: d.germline_classification.last_evaluated || null,
      traitCount: d.germline_classification.trait_set.length,
      supportingSubmissionCount: d.supporting_submissions?.scv.length ?? 0,
      cdnaChanges: d.variation_set.map((v) => v.cdna_change).filter((s) => s.length > 0),
      canonicalSpdi: d.variation_set.map((v) => v.canonical_spdi).filter((s) => s.length > 0),
      locations: d.variation_set.flatMap((v) =>
        v.variation_loc.map((l) => ({ assembly: l.assembly_name, status: l.status, chromosome: l.chr, start: Number(l.start), stop: Number(l.stop) })),
      ),
      isHaplotypeOrCompound: d.variation_set.length > 1 || /haplotype|compound|diplotype/i.test(d.obj_type),
      clinicalImpact: d.clinical_impact_classification?.description || null,
      oncogenicity: d.oncogenicity_classification?.description || null,
      recordStatus: d.record_status,
      variationNames: d.variation_set.map((v) => v.variation_name).filter((s) => s.length > 0),
      variantTypes: d.variation_set.map((v) => v.variant_type).filter((s) => s.length > 0),
      dbSnpIds: [...new Set(d.variation_set.flatMap((v) => v.variation_xrefs.filter((x) => x.db_source === "dbSNP" && /^\d+$/.test(x.db_id)).map((x) => `rs${x.db_id}`)))],
      molecularConsequences: d.molecular_consequence_list,
    };
  });
}

const EsearchRaw = z.object({ esearchresult: z.object({ count: z.string(), idlist: z.array(z.string()) }).loose() });
const EsearchTranslationRaw = z.object({
  esearchresult: z
    .object({
      querytranslation: z.string().default(""),
      translationstack: z.array(z.union([z.object({ term: z.string(), field: z.string(), count: z.string() }).loose(), z.string()])).default([]),
      errorlist: z.object({ phrasesnotfound: z.array(z.string()).default([]), fieldsnotfound: z.array(z.string()).default([]) }).loose().optional(),
      warninglist: z.object({ phrasesignored: z.array(z.string()).default([]), quotedphrasenotfound: z.array(z.string()).default([]), outputmessages: z.array(z.string()).default([]) }).loose().optional(),
    })
    .loose(),
});

/**
 * How Entrez read an esearch term (Phase 9, P9.2.3): the query as translated, each clause with the
 * field it was taken in and its own count, and the phrases or fields it did not recognise. A clause
 * that Entrez dropped would show here, so a finder's report can prove its grammar was understood.
 */
export function parseClinvarEsearchTranslation(json: unknown, url: string | null = null): { queryTranslation: string; clauses: { term: string; field: string; count: number }[]; phrasesNotFound: string[]; fieldsNotFound: string[]; phrasesIgnored: string[] } {
  const r = parseWith(EsearchTranslationRaw, json, "ClinVar esearch translation", url).esearchresult;
  return {
    queryTranslation: r.querytranslation,
    clauses: r.translationstack.filter((x): x is { term: string; field: string; count: string } => typeof x !== "string").map((x) => ({ term: x.term, field: x.field, count: Number(x.count) })),
    phrasesNotFound: r.errorlist?.phrasesnotfound ?? [],
    fieldsNotFound: r.errorlist?.fieldsnotfound ?? [],
    phrasesIgnored: r.warninglist?.phrasesignored ?? [],
  };
}

/** Parse an esearch response: the uids, in ClinVar's order, and the total count. */
export function parseClinvarEsearch(json: unknown, url: string | null = null): { count: number; uids: string[] } {
  const r = parseWith(EsearchRaw, json, "ClinVar esearch", url).esearchresult;
  if (r.idlist.some((u) => !/^\d+$/.test(u))) throw new ParseError("ClinVar esearch", ["non-numeric uid in idlist"], url);
  return { count: Number(r.count), uids: r.idlist };
}

export const ClinvarEinfo = z.object({ einforesult: z.object({ dbinfo: z.array(z.object({ dbbuild: z.string(), lastupdate: z.string() })).min(1) }) });

export class ClinvarAdapter {
  private readonly http: HttpClient;
  constructor(http: HttpClient) {
    this.http = http;
  }
  async esummary(uids: string[], ro?: RequestOptions): Promise<Fetched<ClinvarRecord[]>> {
    const url = clinvarUrls.esummary(uids);
    const { response, json } = await this.http.getJson("ncbi-clinvar", url, ro);
    return { data: parseClinvarEsummary(json, url), response };
  }
  async esearchRs(rsId: string, ro?: RequestOptions): Promise<Fetched<{ count: number; uids: string[] }>> {
    const url = clinvarUrls.esearchRs(rsId);
    const { response, json } = await this.http.getJson("ncbi-clinvar", url, ro);
    return { data: parseClinvarEsearch(json, url), response };
  }
  /** Phase 9 (P9.2.3): the gene's missense variants classified Pathogenic or Likely pathogenic, at most `retmax` uids of ClinVar's count. */
  async esearchGeneMissensePathogenic(symbol: string, retmax = 100, ro?: RequestOptions): Promise<Fetched<{ count: number; uids: string[] }>> {
    const url = clinvarUrls.esearchGeneMissensePathogenic(symbol, retmax);
    const { response, json } = await this.http.getJson("ncbi-clinvar", url, ro);
    return { data: parseClinvarEsearch(json, url), response };
  }
  async build(ro?: RequestOptions): Promise<Fetched<{ dbBuild: string; lastUpdate: string }>> {
    const url = clinvarUrls.einfo();
    const { response, json } = await this.http.getJson("ncbi-clinvar", url, ro);
    const d = parseWith(ClinvarEinfo, json, "ClinVar einfo", url).einforesult.dbinfo[0]!;
    return { data: { dbBuild: d.dbbuild, lastUpdate: d.lastupdate }, response };
  }
}
