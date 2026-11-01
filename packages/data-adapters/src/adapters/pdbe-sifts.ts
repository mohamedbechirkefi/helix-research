// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * PDBe SIFTS adapter: the residue-level UniProt to PDB mapping of record. A conditional
 * source (master prompt §4: "PDBe/SIFTS (structure mappings)") justified in
 * docs/data-source-registry.md §10: the 2HBS file's own _struct_ref_seq uses mature
 * numbering and cannot be trusted as UniProt positions.
 */
import { z } from "zod";
import type { HttpClient, RequestOptions } from "../http/client.ts";
import { InvalidParameterError, ParseError } from "../http/errors.ts";
import { type Fetched, parseWith } from "./common.ts";

export const siftsUrls = {
  uniprotMappings: (pdbId: string): string => {
    if (!/^[0-9][A-Za-z0-9]{3}$/.test(pdbId)) throw new InvalidParameterError(`Not a PDB id: ${pdbId}`);
    return `https://www.ebi.ac.uk/pdbe/api/mappings/uniprot/${pdbId.toLowerCase()}`;
  },
};

const Residue = z.object({
  residue_number: z.number().int(),
  author_residue_number: z.number().int().nullable(),
  author_insertion_code: z.string().default(""),
});
const MappingRaw = z.object({
  entity_id: z.number().int(),
  chain_id: z.string(),
  struct_asym_id: z.string(),
  unp_start: z.number().int(),
  unp_end: z.number().int(),
  start: Residue,
  end: Residue,
  identity: z.number(),
  coverage: z.number(),
});
const SiftsRaw = z.record(
  z.string(),
  z.object({ UniProt: z.record(z.string(), z.object({ name: z.string(), identifier: z.string(), mappings: z.array(MappingRaw) })) }),
);

export interface SiftsSegment {
  uniprotAccession: string;
  entityId: string;
  /** PDB auth chain id (SIFTS chain_id). */
  authAsymId: string;
  /** label_asym_id (SIFTS struct_asym_id). */
  labelAsymId: string;
  unpStart: number;
  unpEnd: number;
  /** residue_number = label_seq_id. */
  labelSeqStart: number;
  labelSeqEnd: number;
  authSeqStart: number | null;
  authSeqEnd: number | null;
  identity: number;
  coverage: number;
}

export function parseSifts(json: unknown, pdbId: string, url: string | null = null): SiftsSegment[] {
  const raw = parseWith(SiftsRaw, json, "PDBe SIFTS mappings", url);
  const entry = raw[pdbId.toLowerCase()];
  if (!entry) throw new ParseError("PDBe SIFTS mappings", [`no entry ${pdbId.toLowerCase()} in response`], url);
  const out: SiftsSegment[] = [];
  for (const [acc, v] of Object.entries(entry.UniProt)) {
    for (const m of v.mappings) {
      out.push({
        uniprotAccession: acc,
        entityId: String(m.entity_id),
        authAsymId: m.chain_id,
        labelAsymId: m.struct_asym_id,
        unpStart: m.unp_start,
        unpEnd: m.unp_end,
        labelSeqStart: m.start.residue_number,
        labelSeqEnd: m.end.residue_number,
        authSeqStart: m.start.author_residue_number,
        authSeqEnd: m.end.author_residue_number,
        identity: m.identity,
        coverage: m.coverage,
      });
    }
  }
  out.sort((a, b) => a.uniprotAccession.localeCompare(b.uniprotAccession) || a.labelAsymId.localeCompare(b.labelAsymId) || a.unpStart - b.unpStart);
  return out;
}

export class SiftsAdapter {
  private readonly http: HttpClient;
  constructor(http: HttpClient) {
    this.http = http;
  }
  async uniprotMappings(pdbId: string, ro?: RequestOptions): Promise<Fetched<SiftsSegment[]>> {
    const url = siftsUrls.uniprotMappings(pdbId);
    const { response, json } = await this.http.getJson("pdbe-sifts", url, ro);
    return { data: parseSifts(json, pdbId, url), response };
  }
}
