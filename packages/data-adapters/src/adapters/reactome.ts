// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Reactome Content Service adapter (Phase 9, P9.1.2; docs/phase-9-generalisation.md section
 * 12 rule 1; registry section 6). Pathway membership is a database annotation (class 2): it
 * says that a protein takes part in a curated pathway, never how. Four requests:
 *
 * - `data/database/version`: the Reactome release, a plain-text integer.
 * - `data/mapping/UniProt/{accession}/pathways?species=9606`: the human pathways that list
 *   the protein (stable id, name, species, disease flag, diagram flag).
 * - `data/event/{stId}/ancestors`: the paths from an event up to its top-level pathway (a
 *   list of paths; each path starts with the event and ends in a TopLevelPathway).
 * - `data/participants/{stId}`: the participating physical entities of a pathway, each with
 *   the reference entities Reactome lists for it (the proteins of a complex or a set appear
 *   here as UniProt reference gene products). The plan named
 *   `participants/{stId}/participatingPhysicalEntities`; measured on 2026-11-03 that view
 *   returns complexes and sets without their members, so the proteins cannot be read from it.
 *   This endpoint returns the same physical entities with their members flattened, which is
 *   what the record needs (the accession of each protein, the set's own protein flagged).
 *
 * The data is CC0; diagrams and icons (CC BY 4.0) are not used.
 */
import { z } from "zod";
import type { HttpClient, RequestOptions } from "../http/client.ts";
import { InvalidParameterError, ParseError } from "../http/errors.ts";
import { type Fetched, parseWith } from "./common.ts";

const BASE = "https://reactome.org/ContentService";
/** Human (NCBI taxonomy 9606): the only species this adapter asks for. */
export const REACTOME_HUMAN_TAXON = "9606";
export const REACTOME_HUMAN_SPECIES = "Homo sapiens";

const ACCESSION = /^[A-NR-Z][0-9][A-Z][A-Z0-9]{2}[0-9]$|^[OPQ][0-9][A-Z0-9]{3}[0-9]$/;
const STABLE_ID = /^R-HSA-\d+$/;

export function isReactomeStableId(stId: string): boolean {
  return STABLE_ID.test(stId);
}

export const reactomeUrls = {
  databaseVersion: (): string => `${BASE}/data/database/version`,
  pathwaysForUniprot: (accession: string): string => {
    if (!ACCESSION.test(accession)) throw new InvalidParameterError(`Not a UniProt accession: ${accession}`);
    return `${BASE}/data/mapping/UniProt/${accession}/pathways?species=${REACTOME_HUMAN_TAXON}`;
  },
  eventAncestors: (stId: string): string => {
    if (!STABLE_ID.test(stId)) throw new InvalidParameterError(`Not a human Reactome stable id (R-HSA-<digits>): ${stId}`);
    return `${BASE}/data/event/${stId}/ancestors`;
  },
  participants: (stId: string): string => {
    if (!STABLE_ID.test(stId)) throw new InvalidParameterError(`Not a human Reactome stable id (R-HSA-<digits>): ${stId}`);
    return `${BASE}/data/participants/${stId}`;
  },
};

// ---------------------------------------------------------------- raw schemas (fields read; the rest is dropped)

const MembershipRaw = z.object({
  dbId: z.number().int(),
  stId: z.string().regex(STABLE_ID),
  stIdVersion: z.string().optional(),
  displayName: z.string().min(1),
  speciesName: z.string().min(1),
  isInDisease: z.boolean(),
  hasDiagram: z.boolean(),
  schemaClass: z.string().min(1),
});
const MembershipsRaw = z.array(MembershipRaw);

const EventSummaryRaw = z.object({
  dbId: z.number().int(),
  stId: z.string().min(1),
  displayName: z.string().min(1),
  schemaClass: z.string().min(1),
  speciesName: z.string().optional(),
});
const AncestorsRaw = z.array(z.array(EventSummaryRaw).min(1));

const ReferenceEntityRaw = z.object({
  dbId: z.number().int(),
  stId: z.string().optional(),
  identifier: z.string().optional(),
  schemaClass: z.string().min(1),
  displayName: z.string().min(1),
});
const ParticipantRaw = z.object({
  peDbId: z.number().int(),
  displayName: z.string().min(1),
  schemaClass: z.string().min(1),
  refEntities: z.array(ReferenceEntityRaw).default([]),
});
const ParticipantsRaw = z.array(ParticipantRaw);

// ---------------------------------------------------------------- parsed shapes

export interface ReactomeMembership {
  stableId: string;
  stableIdVersion: string | null;
  name: string;
  species: string;
  isDisease: boolean;
  hasDiagram: boolean;
  schemaClass: string;
}

export interface ReactomeEventSummary {
  stableId: string;
  name: string;
  schemaClass: string;
  species: string | null;
}

/** One path from an event (first element) up to a top-level pathway (last element). */
export type ReactomeAncestorPath = ReactomeEventSummary[];

export interface ReactomeReferenceEntity {
  dbId: number;
  stableId: string | null;
  identifier: string | null;
  schemaClass: string;
  displayName: string;
}

export interface ReactomeParticipant {
  dbId: number;
  displayName: string;
  schemaClass: string;
  referenceEntities: ReactomeReferenceEntity[];
}

/** The release: a decimal integer and nothing else. */
export function parseReactomeVersion(text: string, url: string | null = null): string {
  const t = text.trim();
  if (!/^\d+$/.test(t)) throw new ParseError("Reactome database version", [`not an integer: ${text.slice(0, 40)}`], url);
  return t;
}

/** The memberships of a UniProt mapping, in the order returned (the builder sorts them). */
export function parseReactomePathways(json: unknown, url: string | null = null): ReactomeMembership[] {
  const raw = parseWith(MembershipsRaw, json, "Reactome pathways for a UniProt accession", url);
  return raw.map((m) => ({
    stableId: m.stId,
    stableIdVersion: m.stIdVersion ?? null,
    name: m.displayName,
    species: m.speciesName,
    isDisease: m.isInDisease,
    hasDiagram: m.hasDiagram,
    schemaClass: m.schemaClass,
  }));
}

/** The ancestor paths of an event; the service answers an empty list for an event without ancestors. */
export function parseReactomeAncestors(json: unknown, url: string | null = null): ReactomeAncestorPath[] {
  const raw = parseWith(AncestorsRaw, json, "Reactome event ancestors", url);
  return raw.map((path) => path.map((e) => ({ stableId: e.stId, name: e.displayName, schemaClass: e.schemaClass, species: e.speciesName ?? null })));
}

/**
 * The distinct top-level pathways the ancestor paths of `stableId` end in, sorted by stable
 * id. Every path must start with the event itself and end in a TopLevelPathway; anything else
 * is a ParseError, since the record would otherwise name a wrong parent.
 */
export function topLevelPathwaysOf(stableId: string, paths: ReactomeAncestorPath[], url: string | null = null): { stableId: string; name: string }[] {
  const problems: string[] = [];
  if (paths.length === 0) problems.push(`${stableId}: no ancestor path`);
  const seen = new Map<string, string>();
  paths.forEach((path, i) => {
    const first = path[0]!;
    const last = path[path.length - 1]!;
    if (first.stableId !== stableId) problems.push(`path ${i} starts with ${first.stableId}, not ${stableId}`);
    if (last.schemaClass !== "TopLevelPathway") problems.push(`path ${i} ends in ${last.stableId} (${last.schemaClass}), not a TopLevelPathway`);
    else seen.set(last.stableId, last.name);
  });
  if (problems.length > 0) throw new ParseError("Reactome event ancestors", problems.slice(0, 5), url);
  return [...seen].map(([id, name]) => ({ stableId: id, name })).sort((a, b) => compareStableIds(a.stableId, b.stableId));
}

/** The participating physical entities of a pathway with their reference entities, in the order returned. */
export function parseReactomeParticipants(json: unknown, url: string | null = null): ReactomeParticipant[] {
  const raw = parseWith(ParticipantsRaw, json, "Reactome participants", url);
  return raw.map((p) => ({
    dbId: p.peDbId,
    displayName: p.displayName,
    schemaClass: p.schemaClass,
    referenceEntities: p.refEntities.map((r) => ({ dbId: r.dbId, stableId: r.stId ?? null, identifier: r.identifier ?? null, schemaClass: r.schemaClass, displayName: r.displayName })),
  }));
}

/**
 * The UniProt proteins among a participant's reference entities: reference gene products (and
 * isoforms) whose stable id Reactome writes as `uniprot:<identifier>`. `accession` drops an
 * isoform suffix so that the set's protein is recognised whichever isoform the pathway names.
 */
export function uniprotProteinsOf(p: ReactomeParticipant): { accession: string; identifier: string; displayName: string }[] {
  const out: { accession: string; identifier: string; displayName: string }[] = [];
  for (const r of p.referenceEntities) {
    if (!/^Reference(GeneProduct|Isoform)$/.test(r.schemaClass)) continue;
    if (r.identifier === null || !(r.stableId ?? "").toLowerCase().startsWith("uniprot:")) continue;
    out.push({ accession: r.identifier.split("-")[0]!, identifier: r.identifier, displayName: r.displayName });
  }
  return out;
}

/** Order of stable ids: by their number, so that R-HSA-983231 sorts before R-HSA-1237044. */
export function compareStableIds(a: string, b: string): number {
  const na = Number(a.replace(/^R-HSA-/, ""));
  const nb = Number(b.replace(/^R-HSA-/, ""));
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  return a < b ? -1 : a > b ? 1 : 0;
}

export class ReactomeAdapter {
  private readonly http: HttpClient;
  constructor(http: HttpClient) {
    this.http = http;
  }
  /** The Reactome database version (plain text). */
  async databaseVersion(ro?: RequestOptions): Promise<Fetched<string>> {
    const url = reactomeUrls.databaseVersion();
    const response = await this.http.getText("reactome", url, ro);
    return { data: parseReactomeVersion(response.body, url), response };
  }
  /** Human pathways that list a UniProt accession. */
  async pathwaysForUniprot(accession: string, ro?: RequestOptions): Promise<Fetched<ReactomeMembership[]>> {
    const url = reactomeUrls.pathwaysForUniprot(accession);
    const { response, json } = await this.http.getJson("reactome", url, ro);
    return { data: parseReactomePathways(json, url), response };
  }
  /** The ancestor paths of an event, up to its top-level pathway. */
  async eventAncestors(stId: string, ro?: RequestOptions): Promise<Fetched<ReactomeAncestorPath[]>> {
    const url = reactomeUrls.eventAncestors(stId);
    const { response, json } = await this.http.getJson("reactome", url, ro);
    return { data: parseReactomeAncestors(json, url), response };
  }
  /** The participating physical entities of a pathway with their reference entities. */
  async participants(stId: string, ro?: RequestOptions): Promise<Fetched<ReactomeParticipant[]>> {
    const url = reactomeUrls.participants(stId);
    const { response, json } = await this.http.getJson("reactome", url, ro);
    return { data: parseReactomeParticipants(json, url), response };
  }
}
