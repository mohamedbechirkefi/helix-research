// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/** UniProt REST adapter (P2.2.3). */
import { z } from "zod";
import type { HttpClient, RequestOptions } from "../http/client.ts";
import { InvalidParameterError } from "../http/errors.ts";
import { isProprietaryDatabase } from "../redaction.ts";
import { type Fetched, parseWith } from "./common.ts";

export const UNIPROT_BASE = "https://rest.uniprot.org";
const ACCESSION = /^([OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2})(-\d+)?$/;

export const uniprotUrls = {
  entry: (accession: string): string => {
    if (!ACCESSION.test(accession)) throw new InvalidParameterError(`Not a UniProt accession: ${accession}`);
    return `${UNIPROT_BASE}/uniprotkb/${accession}.json`;
  },
};

const Position = z.object({ value: z.number().int().nullable(), modifier: z.string().optional() });
const EvidenceRaw = z.object({ evidenceCode: z.string(), source: z.string().optional(), id: z.string().optional() });

const FeatureRaw = z.object({
  type: z.string(),
  location: z.object({ start: Position, end: Position }),
  description: z.string().default(""),
  featureId: z.string().optional(),
  evidences: z.array(EvidenceRaw).default([]),
  featureCrossReferences: z.array(z.object({ database: z.string(), id: z.string() })).default([]),
  alternativeSequence: z
    .object({ originalSequence: z.string().optional(), alternativeSequences: z.array(z.string()).default([]) })
    .optional(),
});

const XrefRaw = z.object({
  database: z.string(),
  id: z.string(),
  properties: z.array(z.object({ key: z.string(), value: z.string() })).default([]),
});

const CommentRaw = z.object({
  commentType: z.string(),
  texts: z.array(z.object({ value: z.string(), evidences: z.array(EvidenceRaw).default([]) })).optional(),
});

export const UniprotEntryRaw = z.object({
  entryType: z.string(),
  primaryAccession: z.string(),
  uniProtkbId: z.string(),
  entryAudit: z.object({ entryVersion: z.number().int(), sequenceVersion: z.number().int() }),
  organism: z.object({ scientificName: z.string(), taxonId: z.number().int() }),
  sequence: z.object({ value: z.string(), length: z.number().int(), md5: z.string(), crc64: z.string() }),
  features: z.array(FeatureRaw).default([]),
  uniProtKBCrossReferences: z.array(XrefRaw).default([]),
  comments: z.array(CommentRaw).default([]),
});
export type UniprotEntryRaw = z.infer<typeof UniprotEntryRaw>;

export interface UniprotFeature {
  type: string;
  start: number;
  end: number;
  description: string;
  featureId: string | null;
  originalSequence: string | null;
  alternativeSequences: string[];
  evidences: string[];
  xrefs: string[];
}

export interface UniprotEntry {
  accession: string;
  entryName: string;
  reviewed: boolean;
  organism: { scientificName: string; taxonId: number };
  entryVersion: number;
  sequenceVersion: number;
  sequence: string;
  length: number;
  md5: string;
  crc64: string;
  features: UniprotFeature[];
  /**
   * Phase 9 (P9.3.1, found by INS): the entry's processing annotations (Signal, Transit peptide,
   * Propeptide, Peptide), kept apart from `features` so that no curated record changes. An entry
   * whose mature products are peptides (insulin) annotates these and no Chain.
   */
  processing: { type: string; start: number; end: number; description: string }[];
  maneSelect: { transcript: string; protein: string; refSeqNucleotide: string; refSeqProtein: string } | null;
  /**
   * Phase 9 (P9.3.1): every MANE-Select cross-reference of the entry, in the entry's order. One for
   * almost every entry; two for an entry shared by two genes (P69905, haemoglobin alpha: HBA1 and
   * HBA2 encode the same protein). `maneSelect` is the first of them, as before.
   */
  maneSelects: { transcript: string; protein: string; refSeqNucleotide: string; refSeqProtein: string }[];
  ensembl: { transcript: string; protein: string; gene: string }[];
  pdb: { id: string; method: string; resolution: string | null; chains: string }[];
  comments: { type: string; text: string; evidences: string[] }[];
}

/** Feature types HELIX keeps (research/hbb-acquisition-plan.md §4). */
export const KEPT_FEATURE_TYPES = new Set([
  "Initiator methionine",
  "Chain",
  "Natural variant",
  "Domain",
  "Binding site",
  "Modified residue",
]);
const KEPT_COMMENTS = new Set(["FUNCTION", "SUBUNIT", "TISSUE SPECIFICITY"]);

function evidenceString(e: z.infer<typeof EvidenceRaw>): string | null {
  if (e.source && isProprietaryDatabase(e.source)) return null;
  return [e.evidenceCode, e.source && e.id ? `${e.source}:${e.id}` : null].filter(Boolean).join(" ");
}

function prop(x: z.infer<typeof XrefRaw>, key: string): string | null {
  return x.properties.find((p) => p.key === key)?.value ?? null;
}

/** Keep only what the domain model uses; drop every proprietary cross-reference. */
export function parseUniprotEntry(json: unknown, url: string | null = null): UniprotEntry {
  const raw = parseWith(UniprotEntryRaw, json, "UniProt entry", url);
  const features: UniprotFeature[] = raw.features
    .filter((f) => KEPT_FEATURE_TYPES.has(f.type) && f.location.start.value !== null && f.location.end.value !== null)
    .map((f) => ({
      type: f.type,
      start: f.location.start.value!,
      end: f.location.end.value!,
      description: f.description,
      featureId: f.featureId ?? null,
      originalSequence: f.alternativeSequence?.originalSequence ?? null,
      alternativeSequences: f.alternativeSequence?.alternativeSequences ?? [],
      evidences: f.evidences.map(evidenceString).filter((s): s is string => s !== null),
      xrefs: f.featureCrossReferences.filter((x) => x.database === "dbSNP").map((x) => `${x.database}:${x.id}`),
    }));
  const PROCESSING = new Set(["Signal", "Transit peptide", "Propeptide", "Peptide"]);
  const processing = raw.features
    .filter((f) => PROCESSING.has(f.type) && f.location.start.value !== null && f.location.end.value !== null)
    .map((f) => ({ type: f.type, start: f.location.start.value!, end: f.location.end.value!, description: f.description }));
  const manes = raw.uniProtKBCrossReferences.filter((x) => x.database === "MANE-Select");
  const mane = manes[0];
  const maneOf = (m: (typeof manes)[number]) => ({ transcript: m.id, protein: prop(m, "ProteinId") ?? "", refSeqNucleotide: prop(m, "RefSeqNucleotideId") ?? "", refSeqProtein: prop(m, "RefSeqProteinId") ?? "" });
  return {
    accession: raw.primaryAccession,
    entryName: raw.uniProtkbId,
    reviewed: raw.entryType.toLowerCase().includes("reviewed") && !raw.entryType.toLowerCase().includes("unreviewed"),
    organism: { scientificName: raw.organism.scientificName, taxonId: raw.organism.taxonId },
    entryVersion: raw.entryAudit.entryVersion,
    sequenceVersion: raw.entryAudit.sequenceVersion,
    sequence: raw.sequence.value,
    length: raw.sequence.length,
    md5: raw.sequence.md5,
    crc64: raw.sequence.crc64,
    features,
    processing,
    maneSelect: mane ? maneOf(mane) : null,
    maneSelects: manes.map(maneOf),
    ensembl: raw.uniProtKBCrossReferences
      .filter((x) => x.database === "Ensembl")
      .map((x) => ({ transcript: x.id, protein: prop(x, "ProteinId") ?? "", gene: prop(x, "GeneId") ?? "" })),
    pdb: raw.uniProtKBCrossReferences
      .filter((x) => x.database === "PDB")
      .map((x) => ({ id: x.id, method: prop(x, "Method") ?? "", resolution: prop(x, "Resolution"), chains: prop(x, "Chains") ?? "" })),
    comments: raw.comments
      .filter((c) => KEPT_COMMENTS.has(c.commentType))
      .flatMap((c) =>
        (c.texts ?? []).map((t) => ({
          type: c.commentType,
          text: t.value,
          evidences: t.evidences.map(evidenceString).filter((s): s is string => s !== null),
        })),
      ),
  };
}

export class UniprotAdapter {
  private readonly http: HttpClient;
  constructor(http: HttpClient) {
    this.http = http;
  }
  async entry(accession: string, ro?: RequestOptions): Promise<Fetched<UniprotEntry> & { release: string | null; releaseDate: string | null }> {
    const url = uniprotUrls.entry(accession);
    const { response, json } = await this.http.getJson("uniprot", url, ro);
    return {
      data: parseUniprotEntry(json, url),
      response,
      release: response.headers["x-uniprot-release"] ?? null,
      releaseDate: response.headers["x-uniprot-release-date"] ?? null,
    };
  }
}
