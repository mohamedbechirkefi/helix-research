// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Open Targets Platform adapter (Phase 9, P9.1.3; docs/phase-9-generalisation.md section 14 rule 1;
 * registry section 7). An association is a database annotation (class 2) that scores the evidence
 * linking a target to a disease; it is never a causal statement and never a diagnosis.
 *
 * One POST per gene to the GraphQL endpoint, with `OPEN_TARGETS_ASSOCIATIONS_QUERY`: the platform's
 * `meta` (api and data versions) and the target's first page of associated diseases, ordered by
 * score. The terms discourage one-entity querying, so the builder asks once per set and records the
 * response; dynamic mode (P9.3.1) will not call it.
 *
 * Licence (registry section 7): the platform is CC0 1.0, but its per-source table lists ChEMBL and
 * Human Protein Atlas (CC BY-SA 3.0), Cancer Gene Census (restricted for commercial use) and Europe
 * PMC (mixed). `EXCLUDED_DATASOURCES` names those sources by their platform datasource ids; their
 * `datasourceScores` entries are dropped at parse time and the record names what was dropped. The
 * overall score and the datatype scores are the platform's aggregates over every datasource, and
 * the record says they include the dropped ones.
 */
import { z } from "zod";
import type { HttpClient, RequestOptions } from "../http/client.ts";
import { InvalidParameterError, ParseError } from "../http/errors.ts";
import { type Fetched, parseWith } from "./common.ts";

export const OPEN_TARGETS_GRAPHQL_URL = "https://api.platform.opentargets.org/api/v4/graphql";

/** The page the builder asks for: index 0, 25 rows, ordered by score (plan section 14 rule 1). */
export const OPEN_TARGETS_PAGE = { index: 0, size: 25 } as const;

/**
 * The ordering asked for. The plan (section 14 rule 1) wrote `orderByScore: true`; the live schema
 * (introspected 2026-11-04, research/raw/opentargets/introspect-shapes.json) types the argument as a
 * String: "the first word is the column to sort by: either `score` to use the overall association
 * score (default), a datasource id, or a datatype id. The second word is the order: `desc` (default)
 * or `asc`". A Boolean is refused with HTTP 400 (measured on the first HBB request), so the query
 * says the same thing in the schema's words: the overall score, descending.
 */
export const OPEN_TARGETS_ORDER = "score desc";

/** The one query (plan section 14 rule 1, the ordering in the schema's words); the Ensembl gene id is its only variable. */
export const OPEN_TARGETS_ASSOCIATIONS_QUERY = `query HelixAssociations($ensemblId: String!) {
  meta { apiVersion { x y z } dataVersion { year month } }
  target(ensemblId: $ensemblId) {
    id
    approvedSymbol
    associatedDiseases(page: { index: ${OPEN_TARGETS_PAGE.index}, size: ${OPEN_TARGETS_PAGE.size} }, orderByScore: "${OPEN_TARGETS_ORDER}") {
      count
      rows {
        disease { id name therapeuticAreas { id name } }
        score
        datatypeScores { id score }
        datasourceScores { id score }
      }
    }
  }
}`;

/**
 * Datasource ids whose scores are dropped (registry section 7, licence table): ChEMBL (CC BY-SA
 * 3.0), Cancer Gene Census (commercial use restricted) and Europe PMC (mixed), by their platform
 * datasource ids. Established from the four responses recorded on 2026-11-04 (release 26.09,
 * data/fixtures/<set>/opentargets/), not guessed: `europepmc` appears in all four and
 * `cancer_gene_census` in BRCA1's; no `chembl` id appears, and the clinical-precedence evidence
 * (the platform's ChEMBL-derived source) comes as `clinical_precedence` under the datatype
 * `clinical` (HBB, CFTR), so that id is dropped and `chembl` is kept in the list for the id form the
 * registry's name takes. The Human Protein Atlas, also CC BY-SA 3.0 in the table, feeds target
 * annotations and not associations: no id of it appeared, so none is listed. The platform's own
 * `associationDatasources` list came back empty on that day (research/raw/opentargets/). Compared
 * case-insensitively.
 */
export const EXCLUDED_DATASOURCES: readonly string[] = ["chembl", "clinical_precedence", "cancer_gene_census", "europepmc"];

/** Why those sources are dropped, in the record's words. */
export const EXCLUDED_DATASOURCES_REASON = "share-alike or restricted sources of the Open Targets licence table (registry section 7): ChEMBL (CC BY-SA 3.0; its clinical-precedence evidence carries the datasource id clinical_precedence in release 26.09), Cancer Gene Census (commercial use restricted), Europe PMC (mixed); the Human Protein Atlas (CC BY-SA 3.0) is not an association datasource; their datasource scores are not redistributed here";

export function isExcludedDatasource(id: string): boolean {
  return EXCLUDED_DATASOURCES.includes(id.toLowerCase());
}

const ENSEMBL_GENE = /^ENSG\d{11}$/;

/** The request body of the one query; the gene id is validated (it is the only user-supplied part). */
export function openTargetsRequestBody(ensemblGeneId: string): { query: string; variables: { ensemblId: string } } {
  if (!ENSEMBL_GENE.test(ensemblGeneId)) throw new InvalidParameterError(`Not an Ensembl gene id: ${ensemblGeneId}`);
  return { query: OPEN_TARGETS_ASSOCIATIONS_QUERY, variables: { ensemblId: ensemblGeneId } };
}

// ---------------------------------------------------------------- raw schemas (fields read; the rest is dropped)

const ScoreRaw = z.object({ id: z.string().min(1), score: z.number() });
const RowRaw = z.object({
  disease: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    therapeuticAreas: z.array(z.object({ id: z.string().min(1), name: z.string().min(1) })).default([]),
  }),
  score: z.number(),
  datatypeScores: z.array(ScoreRaw).default([]),
  datasourceScores: z.array(ScoreRaw).default([]),
});
const ResponseRaw = z.object({
  data: z
    .object({
      meta: z.object({
        apiVersion: z.object({ x: z.string().min(1), y: z.string().min(1), z: z.string().min(1) }),
        dataVersion: z.object({ year: z.string().min(1), month: z.string().min(1) }),
      }),
      target: z
        .object({
          id: z.string().min(1),
          approvedSymbol: z.string().min(1),
          associatedDiseases: z.object({ count: z.number().int().nonnegative(), rows: z.array(RowRaw) }),
        })
        .nullable(),
    })
    .nullable()
    .optional(),
  errors: z.array(z.object({ message: z.string() }).loose()).optional(),
});

// ---------------------------------------------------------------- parsed shapes

export interface OpenTargetsScore {
  id: string;
  score: number;
}

export interface OpenTargetsAssociation {
  diseaseId: string;
  diseaseName: string;
  therapeuticAreas: { id: string; name: string }[];
  score: number;
  datatypeScores: OpenTargetsScore[];
  /** The kept datasource scores (the excluded ids removed). */
  datasourceScores: OpenTargetsScore[];
  /** The excluded ids this row carried, in the response's order. */
  droppedDatasourceIds: string[];
}

export interface OpenTargetsAssociations {
  /** "x.y.z" and "yy.mm" as the platform's `meta` states them. */
  apiVersion: string;
  dataVersion: string;
  ensemblGeneId: string;
  approvedSymbol: string;
  count: number;
  /** The rows in the order returned (the builder checks the order, T50). */
  rows: OpenTargetsAssociation[];
  /** Every datasource id the response carried, distinct, sorted. */
  datasourceIdsObserved: string[];
  /** The excluded ids that the response carried, distinct, sorted. */
  droppedDatasourceIds: string[];
}

/**
 * Parse the GraphQL response. A response with `errors`, without `data`, or whose `target` is null
 * (an id the platform does not know) is a ParseError: nothing is produced from it. The excluded
 * datasource scores are dropped here, so no later reader sees them.
 */
export function parseOpenTargetsAssociations(json: unknown, url: string | null = null): OpenTargetsAssociations {
  const raw = parseWith(ResponseRaw, json, "Open Targets associations", url);
  if (raw.errors && raw.errors.length > 0) throw new ParseError("Open Targets associations", raw.errors.map((e) => `GraphQL error: ${e.message}`).slice(0, 5), url);
  if (!raw.data) throw new ParseError("Open Targets associations", ["no data in the response"], url);
  if (raw.data.target === null) throw new ParseError("Open Targets associations", ["target is null: the platform does not know this Ensembl gene id"], url);
  const t = raw.data.target;
  const observed = new Set<string>();
  const dropped = new Set<string>();
  const rows: OpenTargetsAssociation[] = t.associatedDiseases.rows.map((r) => {
    const kept: OpenTargetsScore[] = [];
    const droppedHere: string[] = [];
    for (const s of r.datasourceScores) {
      observed.add(s.id);
      if (isExcludedDatasource(s.id)) {
        droppedHere.push(s.id);
        dropped.add(s.id);
      } else kept.push({ id: s.id, score: s.score });
    }
    return {
      diseaseId: r.disease.id,
      diseaseName: r.disease.name,
      therapeuticAreas: r.disease.therapeuticAreas.map((a) => ({ id: a.id, name: a.name })),
      score: r.score,
      datatypeScores: r.datatypeScores.map((s) => ({ id: s.id, score: s.score })),
      datasourceScores: kept,
      droppedDatasourceIds: droppedHere,
    };
  });
  const m = raw.data.meta;
  return {
    apiVersion: `${m.apiVersion.x}.${m.apiVersion.y}.${m.apiVersion.z}`,
    dataVersion: `${m.dataVersion.year}.${m.dataVersion.month}`,
    ensemblGeneId: t.id,
    approvedSymbol: t.approvedSymbol,
    count: t.associatedDiseases.count,
    rows,
    datasourceIdsObserved: [...observed].sort(),
    droppedDatasourceIds: [...dropped].sort(),
  };
}

export class OpenTargetsAdapter {
  private readonly http: HttpClient;
  constructor(http: HttpClient) {
    this.http = http;
  }
  /** The one request per gene (O1): meta and the first page of associated diseases, by score. */
  async associations(ensemblGeneId: string, ro?: RequestOptions): Promise<Fetched<OpenTargetsAssociations>> {
    const url = OPEN_TARGETS_GRAPHQL_URL;
    const { response, json } = await this.http.postJson("opentargets", url, openTargetsRequestBody(ensemblGeneId), ro);
    return { data: parseOpenTargetsAssociations(json, url), response };
  }
}
