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
};

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
  variation_set: z
    .array(z.object({ cdna_change: z.string().default(""), canonical_spdi: z.string().default(""), variation_loc: z.array(Loc).default([]) }))
    .default([]),
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
    };
  });
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
  async build(ro?: RequestOptions): Promise<Fetched<{ dbBuild: string; lastUpdate: string }>> {
    const url = clinvarUrls.einfo();
    const { response, json } = await this.http.getJson("ncbi-clinvar", url, ro);
    const d = parseWith(ClinvarEinfo, json, "ClinVar einfo", url).einforesult.dbinfo[0]!;
    return { data: { dbBuild: d.dbbuild, lastUpdate: d.lastupdate }, response };
  }
}
