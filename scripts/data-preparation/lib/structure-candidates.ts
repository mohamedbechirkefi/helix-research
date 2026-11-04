// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * The structure candidate check (Phase 9, plan section 11 rule 4, section 13 rule 2 and section
 * 15 rule 2) as a library: for one PDB entry and one UniProt residue, does the mapped chain
 * observe the residue in atom_site (model 1) through the SIFTS mapping, is the entity wild type
 * over the mapped segments, does it declare an engineered mutation, what is its method,
 * resolution, coverage, and which other polymer entities does it carry. check-structure-
 * candidates.ts runs it over a curator's list of entries; find-variant.ts (P9.2.3) runs it over
 * the UniProt entry's PDB cross-references for each variant candidate in rank order.
 *
 * The three responses an entry needs (SIFTS mappings, the mmCIF file, the RCSB entry summary) are
 * fetched once per entry and kept for the run, so that a second residue on the same entry costs no
 * request. The evaluation itself is pure and unit-tested on the fetched shapes.
 */
import type { MmcifStructure, RcsbAdapter, RcsbEntryRaw, SiftsAdapter, SiftsSegment } from "@helix/data-adapters";
import { alignmentCrossCheck, entityForAccession, mapUniprotChain } from "@helix/scientific-core";

export interface CandidateReport {
  entryId: string;
  method: string;
  resolutionAngstrom: number | null;
  rcsbResolutionCombined: number[] | null;
  /** Models in atom_site (1 outside NMR); for NMR, what _pdbx_nmr_ensemble states, when present. */
  modelCount: number;
  nmrEnsemble: { conformersCalculated: number | null; conformersSubmitted: number | null; representativeConformer: number | null } | null;
  entityId: string;
  chains: string[];
  entityMutation: string | null;
  entityLength: number | null;
  siftsSegments: { labelAsymId: string; unpStart: number; unpEnd: number; labelSeqStart: number; labelSeqEnd: number }[];
  residue: { uniprotPosition: number; uniprotResidue: string; observedOn: { labelAsymId: string; authAsymId: string; labelSeqId: number | null; authSeqId: string; compId: string }[]; unobservedOn: string[]; coveredBySifts: boolean };
  /** Every position where the entity sequence differs from UniProt; `insideMappedSegments` says whether T38 would see it. */
  sequenceMismatches: { entityPos: number; entity: string; uniprotPos: number; uniprot: string; insideMappedSegments: boolean; structRefSeqDif: string | null }[];
  /** UniProt positions of the mapped chain(s) observed in model 1, over the protein length. */
  coverage: { firstObserved: number | null; lastObserved: number | null; observedPositions: number; mappedPositions: number; proteinLength: number; fraction: number };
  /** The other polymer entities, each with the UniProt accession the entry's _struct_ref gives it (null when it gives none). */
  otherPolymerEntities: { entityId: string; description: string; strandIds: string[]; uniprotFromEntry: string | null }[];
  observed: boolean;
  /** True when the entry would be taken for this residue: observed, wild type over the mapped segments, no declared mutation. */
  kept: boolean;
  verdict: string;
}

/** What one entry needs, fetched once. */
export interface FetchedEntry {
  sifts: SiftsSegment[];
  structure: MmcifStructure;
  entry: RcsbEntryRaw;
}

export interface CandidateFetchers {
  siftsMappings(entryId: string): Promise<SiftsSegment[]>;
  mmcif(entryId: string): Promise<MmcifStructure>;
  entry(entryId: string): Promise<RcsbEntryRaw>;
}

/** Live fetchers over the adapters, with a per-run cache keyed by entry id. */
export function cachedEntryFetchers(rcsb: RcsbAdapter, sifts: SiftsAdapter): { fetchers: CandidateFetchers; fetched: Map<string, Promise<FetchedEntry>> } {
  const fetched = new Map<string, Promise<FetchedEntry>>();
  const one = (entryId: string): Promise<FetchedEntry> => {
    let p = fetched.get(entryId);
    if (!p) {
      p = (async () => {
        const s1 = await sifts.uniprotMappings(entryId);
        const cif = await rcsb.mmcif(entryId);
        const e = await rcsb.entry(entryId);
        return { sifts: s1.data, structure: cif.data, entry: e.data };
      })();
      fetched.set(entryId, p);
    }
    return p;
  };
  return {
    fetchers: {
      siftsMappings: async (id) => (await one(id)).sifts,
      mmcif: async (id) => (await one(id)).structure,
      entry: async (id) => (await one(id)).entry,
    },
    fetched,
  };
}

/**
 * Evaluate one fetched entry for one residue of `accession` (whose UniProt sequence is `uniSeq`).
 * Pure: the same inputs give the same report.
 */
export function evaluateCandidate(entryId: string, f: FetchedEntry, accession: string, uniSeq: string, residue: number): CandidateReport {
  const { entityId, segments } = entityForAccession(f.sifts, accession);
  const struct = f.structure;
  const ent = struct.entities.find((e) => e.id === entityId);
  const map = mapUniprotChain(struct, f.sifts, accession);
  const row = map.rows.find((r) => r.uniprotPosition === residue);
  const covered = segments.some((sg) => residue >= sg.unpStart && residue <= sg.unpEnd);
  const xc = ent?.sequenceCanonical ? alignmentCrossCheck(ent.sequenceCanonical, uniSeq, segments) : null;
  const observedOn = (row?.residues ?? []).map((r) => ({ labelAsymId: r.labelAsymId, authAsymId: r.authAsymId, labelSeqId: r.labelSeqId, authSeqId: r.authSeqId, compId: r.compId }));
  const observed = covered && row !== undefined && row.unobservedChains.length === 0 && observedOn.length === map.chains.length && observedOn.length > 0;
  const mismatches = (xc?.alignment.mismatches ?? []).map((m) => ({ entityPos: m.queryPos, entity: m.query, uniprotPos: m.referencePos, uniprot: m.reference }));
  const observedRows = map.rows.filter((r) => r.residues.length > 0);
  const coverage = {
    firstObserved: observedRows[0]?.uniprotPosition ?? null,
    lastObserved: observedRows.at(-1)?.uniprotPosition ?? null,
    observedPositions: observedRows.length,
    mappedPositions: map.rows.length,
    proteinLength: uniSeq.length,
    fraction: Math.round((observedRows.length / uniSeq.length) * 10000) / 10000,
  };
  const otherPolymerEntities = struct.entities
    .filter((e) => e.type === "polymer" && e.id !== entityId)
    .map((e) => ({ entityId: e.id, description: e.description, strandIds: e.strandIds, uniprotFromEntry: struct.structRef.find((x) => x.entityId === e.id && x.dbName === "UNP")?.dbAccession ?? null }));
  // T38 compares atom_site with UniProt at the SIFTS-mapped positions only: a difference inside a mapped
  // segment that no selected variant explains is refused; one outside the segments (a cloning artifact,
  // an expression tag) is recorded with the depositors' own explanation from _struct_ref_seq_dif.
  const inMapped = (pos: number): boolean => segments.some((sg) => pos >= sg.unpStart && pos <= sg.unpEnd);
  const unexplained = mismatches.filter((m) => m.uniprotPos !== residue && inMapped(m.uniprotPos));
  const outside = mismatches.filter((m) => !inMapped(m.uniprotPos));
  const strands = new Set(ent?.strandIds ?? []);
  const explain = (m: { entityPos: number }): string => struct.structRefSeqDif.find((d) => strands.has(d.strandId) && d.seqNum === m.entityPos)?.details ?? "not explained by _struct_ref_seq_dif";
  const outsideText = outside.length > 0 ? `; outside the mapped segments the entity differs at ${outside.map((m) => `${m.uniprotPos} (${m.uniprot} to ${m.entity}, ${explain(m)})`).join(", ")}` : "";
  const verdict = !covered
    ? `residue ${residue} is outside the SIFTS segments of ${entryId}`
    : !observed
      ? `residue ${residue} is not observed in atom_site on chain(s) ${(row?.unobservedChains ?? map.chains).join(", ")}`
      : unexplained.length > 0 || ent?.mutation
        ? `residue ${residue} observed, but the entity differs from UniProt inside the mapped segments at ${unexplained.map((m) => `${m.uniprotPos} (${m.uniprot} to ${m.entity})`).join(", ") || "no position"}${ent?.mutation ? ` and declares pdbx_mutation "${ent.mutation}"` : ""}; the builder refuses a difference no selected variant explains (T38, T19)${outsideText}`
        : `residue ${residue} observed on ${observedOn.map((r) => `${r.authAsymId}${r.authSeqId} ${r.compId}`).join(", ")}; the entity equals UniProt over the mapped segments${outsideText}`;
  return {
    entryId,
    method: struct.method,
    resolutionAngstrom: struct.resolution,
    rcsbResolutionCombined: f.entry.rcsb_entry_info.resolution_combined ?? null,
    modelCount: struct.modelCount,
    nmrEnsemble: struct.nmrEnsemble,
    entityId,
    chains: map.chains,
    entityMutation: ent?.mutation ?? null,
    entityLength: ent?.sequenceCanonical?.length ?? null,
    siftsSegments: segments.map((sg) => ({ labelAsymId: sg.labelAsymId, unpStart: sg.unpStart, unpEnd: sg.unpEnd, labelSeqStart: sg.labelSeqStart, labelSeqEnd: sg.labelSeqEnd })),
    residue: { uniprotPosition: residue, uniprotResidue: uniSeq[residue - 1] ?? "", observedOn, unobservedOn: row?.unobservedChains ?? [], coveredBySifts: covered },
    sequenceMismatches: mismatches.map((m) => ({ ...m, insideMappedSegments: inMapped(m.uniprotPos), structRefSeqDif: struct.structRefSeqDif.find((d) => strands.has(d.strandId) && d.seqNum === m.entityPos)?.details ?? null })),
    coverage,
    otherPolymerEntities,
    observed,
    kept: observed && unexplained.length === 0 && !ent?.mutation,
    verdict,
  };
}

/** Fetch (or reuse) an entry and evaluate it for a residue. */
export async function checkCandidate(fetchers: CandidateFetchers, entryId: string, accession: string, uniSeq: string, residue: number): Promise<CandidateReport> {
  const f: FetchedEntry = { sifts: await fetchers.siftsMappings(entryId), structure: await fetchers.mmcif(entryId), entry: await fetchers.entry(entryId) };
  return evaluateCandidate(entryId, f, accession, uniSeq, residue);
}

/** One line of log for a candidate report, as check-structure-candidates.ts prints it. */
export function candidateLogLine(c: CandidateReport): string {
  const resolutionText = c.resolutionAngstrom === null ? `no resolution, ${c.modelCount} model(s) in atom_site${c.nmrEnsemble ? `, ${c.nmrEnsemble.conformersSubmitted ?? "?"} conformers submitted` : ""}` : `${c.resolutionAngstrom} A`;
  return `${c.entryId}: ${c.method}, ${resolutionText}; covers ${c.coverage.firstObserved ?? "?"}-${c.coverage.lastObserved ?? "?"} (${c.coverage.observedPositions} of ${c.coverage.proteinLength}); other polymer entities ${c.otherPolymerEntities.map((e) => `${e.entityId} ${e.strandIds.join("/")} ${e.uniprotFromEntry ?? "no UNP xref"}`).join(", ") || "none"}; ${c.verdict}`;
}

/**
 * The UniProt PDB cross-references whose `Chains` property covers `residue` ("A=1-620", "A/B=25-600,
 * C=30-610"), in UniProt's order. A cross-reference without a parsable range is reported, not
 * guessed: it is returned under `unparsed`.
 */
export function pdbCrossReferencesCovering(pdb: { id: string; method: string; resolution: string | null; chains: string }[], residue: number): { covering: { id: string; method: string; resolution: string | null; chains: string }[]; unparsed: string[] } {
  const covering: { id: string; method: string; resolution: string | null; chains: string }[] = [];
  const unparsed: string[] = [];
  for (const x of pdb) {
    const ranges = [...x.chains.matchAll(/=(\d+)-(\d+)/g)].map((m) => [Number(m[1]), Number(m[2])] as const);
    if (ranges.length === 0) {
      unparsed.push(x.id);
      continue;
    }
    if (ranges.some(([a, b]) => residue >= a && residue <= b)) covering.push(x);
  }
  return { covering, unparsed };
}
