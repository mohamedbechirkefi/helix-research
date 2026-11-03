// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Curator check for a structure selection (Phase 9, plan section 11 rule 4): for each
 * candidate PDB entry, in the order given, report whether the mapped chain(s) of the
 * UniProt accession observe the residue in atom_site through the SIFTS mapping, the
 * method and resolution, any engineered mutation the entity declares, and where the
 * entity sequence differs from UniProt. The first candidate that observes the residue
 * and carries no unexplained difference is the one the specification should name; the
 * report is the evidence for the specification's notes.
 *
 *   node scripts/data-preparation/check-structure-candidates.ts --uniprot P13569 --residue 508 --entries 6MSM,5UAK
 *
 * Live requests go to UniProt, PDBe SIFTS and RCSB (free, keyless) with the repository's
 * User-Agent and nothing else. The report goes to
 * research/derived/structure-candidates-<accession>-<residue>.json.
 *
 * Phase 9, P9.2.2 (plan section 13): a candidate may be a solution-NMR entry (no _refine, no
 * _em_3d_reconstruction): its resolution is null, the ensemble size is the number of models in
 * atom_site (checked against _pdbx_nmr_ensemble when present), and the residue is looked for in
 * model 1, the one shown. The report also states the coverage of the mapped chain (observed
 * UniProt positions over the protein length) and the other polymer entities with the UniProt
 * accession the entry's own _struct_ref gives them, so that a partner chain can be named.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { HttpClient, RcsbAdapter, SiftsAdapter, UniprotAdapter } from "@helix/data-adapters";
import { alignmentCrossCheck, entityForAccession, mapUniprotChain } from "@helix/scientific-core";
import { REPO_ROOT, USER_AGENT, gitState } from "./lib/node-env.ts";

function flag(args: string[], name: string): string {
  const i = args.indexOf(name);
  const v = args[i + 1];
  if (i < 0 || v === undefined || v.startsWith("--")) throw new Error(`${name} needs a value`);
  return v;
}

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
  verdict: string;
}

async function main(args: string[]): Promise<void> {
  const accession = flag(args, "--uniprot");
  const residue = Number(flag(args, "--residue"));
  const entries = flag(args, "--entries").split(",").map((s) => s.trim()).filter(Boolean);
  if (!Number.isInteger(residue) || residue < 1) throw new Error("--residue needs a positive integer");
  const log = (m: string): void => void process.stderr.write(`${m}\n`);
  const http = new HttpClient({ userAgent: USER_AGENT });
  const uni = new UniprotAdapter(http);
  const rcsb = new RcsbAdapter(http);
  const sifts = new SiftsAdapter(http);
  const startedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  log(`structure candidates for ${accession} residue ${residue}: ${entries.join(", ")} (User-Agent "${USER_AGENT}")`);
  const u = await uni.entry(accession);
  const uniSeq = u.data.sequence;
  const candidates: CandidateReport[] = [];
  let chosen: string | null = null;
  for (const entryId of entries) {
    const s1 = await sifts.uniprotMappings(entryId);
    const { entityId, segments } = entityForAccession(s1.data, accession);
    const cif = await rcsb.mmcif(entryId);
    const entry = await rcsb.entry(entryId);
    const struct = cif.data;
    const ent = struct.entities.find((e) => e.id === entityId);
    const map = mapUniprotChain(struct, s1.data, accession);
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
    const c: CandidateReport = {
      entryId,
      method: struct.method,
      resolutionAngstrom: struct.resolution,
      rcsbResolutionCombined: entry.data.rcsb_entry_info.resolution_combined ?? null,
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
      verdict,
    };
    candidates.push(c);
    const resolutionText = struct.resolution === null ? `no resolution, ${struct.modelCount} model(s) in atom_site${struct.nmrEnsemble ? `, ${struct.nmrEnsemble.conformersSubmitted ?? "?"} conformers submitted` : ""}` : `${struct.resolution} A`;
    log(`${entryId}: ${struct.method}, ${resolutionText}; covers ${coverage.firstObserved ?? "?"}-${coverage.lastObserved ?? "?"} (${coverage.observedPositions} of ${coverage.proteinLength}); other polymer entities ${otherPolymerEntities.map((e) => `${e.entityId} ${e.strandIds.join("/")} ${e.uniprotFromEntry ?? "no UNP xref"}`).join(", ") || "none"}; ${verdict}`);
    if (chosen === null && observed && unexplained.length === 0 && !ent?.mutation) chosen = entryId;
  }
  const git = gitState();
  const report = {
    purpose: "Phase 9 plan section 11 rule 4 (and section 13 rule 2): candidate experimental entries checked in order for whether the mapped chain observes the variant residue in atom_site (model 1) through the SIFTS mapping; the first that does, with no sequence difference inside the mapped segments that a selected variant does not explain and no declared mutation, is the selection. Differences outside the mapped segments are reported with the entry's own _struct_ref_seq_dif explanation. The gene specification's notes cite this report.",
    script: "scripts/data-preparation/check-structure-candidates.ts",
    startedAt,
    finishedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    gitCommit: git.commit,
    gitDirty: git.dirty,
    userAgent: USER_AGENT,
    uniprot: { accession, release: u.release, length: uniSeq.length },
    residue,
    order: entries,
    candidates,
    chosen,
  };
  const dir = join(REPO_ROOT, "research/derived");
  await mkdir(dir, { recursive: true });
  const path = join(dir, `structure-candidates-${accession}-${residue}.json`);
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`);
  log(`chosen: ${chosen ?? "none"}; report ${relative(REPO_ROOT, path)}`);
}

if (process.argv[1] && /check-structure-candidates\.ts$/.test(process.argv[1])) {
  main(process.argv.slice(2)).catch((e: unknown) => {
    process.stderr.write(`check failed: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(2);
  });
}
