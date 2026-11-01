// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * RCSB PDB adapter (P2.2.4): Data API (entry, polymer entity, assembly) and the mmCIF
 * file. files.rcsb.org rejects CORS preflights (registry §3), so the file is fetched with
 * a plain GET and no custom headers.
 */
import { z } from "zod";
import type { HttpClient, RequestOptions } from "../http/client.ts";
import { InvalidParameterError } from "../http/errors.ts";
import { type MmcifStructure, readMmcifStructure } from "../mmcif/structure.ts";
import { type Fetched, parseWith } from "./common.ts";

const PDB_ID = /^[0-9][A-Za-z0-9]{3}$/;
function checkPdbId(id: string): string {
  if (!PDB_ID.test(id)) throw new InvalidParameterError(`Not a PDB id: ${id}`);
  return id.toUpperCase();
}

export const rcsbUrls = {
  entry: (id: string): string => `https://data.rcsb.org/rest/v1/core/entry/${checkPdbId(id)}`,
  polymerEntity: (id: string, entityId: string): string => {
    if (!/^\d+$/.test(entityId)) throw new InvalidParameterError(`Not an entity id: ${entityId}`);
    return `https://data.rcsb.org/rest/v1/core/polymer_entity/${checkPdbId(id)}/${entityId}`;
  },
  assembly: (id: string, assemblyId: string): string => {
    if (!/^\d+$/.test(assemblyId)) throw new InvalidParameterError(`Not an assembly id: ${assemblyId}`);
    return `https://data.rcsb.org/rest/v1/core/assembly/${checkPdbId(id)}/${assemblyId}`;
  },
  mmcif: (id: string): string => `https://files.rcsb.org/download/${checkPdbId(id)}.cif`,
};

export const RcsbEntryRaw = z.object({
  rcsb_id: z.string(),
  exptl: z.array(z.object({ method: z.string() })).min(1),
  rcsb_entry_info: z.object({ resolution_combined: z.array(z.number()).optional(), polymer_entity_count: z.number().int().optional() }),
  pdbx_audit_revision_history: z
    .array(z.object({ major_revision: z.number().int(), minor_revision: z.number().int(), revision_date: z.string() }))
    .min(1),
});
export type RcsbEntryRaw = z.infer<typeof RcsbEntryRaw>;

export const RcsbPolymerEntityRaw = z.object({
  rcsb_id: z.string(),
  entity_poly: z.object({ pdbx_seq_one_letter_code_can: z.string(), pdbx_strand_id: z.string() }),
  rcsb_polymer_entity_container_identifiers: z.object({
    entity_id: z.string(),
    asym_ids: z.array(z.string()),
    auth_asym_ids: z.array(z.string()),
    uniprot_ids: z.array(z.string()).optional(),
  }),
  rcsb_polymer_entity_align: z
    .array(
      z.object({
        provenance_source: z.string(),
        reference_database_accession: z.string(),
        reference_database_name: z.string(),
        aligned_regions: z.array(z.object({ entity_beg_seq_id: z.number().int(), ref_beg_seq_id: z.number().int(), length: z.number().int() })),
      }),
    )
    .default([]),
});
export type RcsbPolymerEntityRaw = z.infer<typeof RcsbPolymerEntityRaw>;

export const RcsbAssemblyRaw = z.object({
  rcsb_id: z.string(),
  pdbx_struct_assembly_gen: z.array(z.object({ assembly_id: z.string(), asym_id_list: z.array(z.string()) })),
});
export type RcsbAssemblyRaw = z.infer<typeof RcsbAssemblyRaw>;

export const parseRcsb = {
  entry: (json: unknown, url: string | null = null) => parseWith(RcsbEntryRaw, json, "RCSB entry", url),
  polymerEntity: (json: unknown, url: string | null = null) => parseWith(RcsbPolymerEntityRaw, json, "RCSB polymer entity", url),
  assembly: (json: unknown, url: string | null = null) => parseWith(RcsbAssemblyRaw, json, "RCSB assembly", url),
  mmcif: readMmcifStructure,
};

export class RcsbAdapter {
  private readonly http: HttpClient;
  constructor(http: HttpClient) {
    this.http = http;
  }
  private async json<T>(url: string, parse: (j: unknown, u: string) => T, ro?: RequestOptions): Promise<Fetched<T>> {
    const { response, json } = await this.http.getJson("rcsb", url, ro);
    return { data: parse(json, url), response };
  }
  entry(id: string, ro?: RequestOptions) {
    return this.json(rcsbUrls.entry(id), parseRcsb.entry, ro);
  }
  polymerEntity(id: string, entityId: string, ro?: RequestOptions) {
    return this.json(rcsbUrls.polymerEntity(id, entityId), parseRcsb.polymerEntity, ro);
  }
  assembly(id: string, assemblyId: string, ro?: RequestOptions) {
    return this.json(rcsbUrls.assembly(id, assemblyId), parseRcsb.assembly, ro);
  }
  /** Download and parse the mmCIF; the raw text is returned too, as the render source. */
  async mmcif(id: string, ro?: RequestOptions): Promise<Fetched<MmcifStructure>> {
    const url = rcsbUrls.mmcif(id);
    const response = await this.http.getText("rcsb-files", url, { timeoutMs: 60_000, ...ro });
    return { data: readMmcifStructure(response.body, url), response };
  }
}
