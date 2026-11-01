// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * UniProt position -> structure residue (P2.4.5).
 *
 *  - The polymer entity is chosen by SIFTS UniProt accession, never by its description.
 *  - SIFTS is the mapping of record: UniProt position -> label_seq_id within a SIFTS segment.
 *  - auth_seq_id and the insertion code are then read from pdbx_poly_seq_scheme, never
 *    computed by adding an offset.
 *  - The residue name is read from atom_site (the deposited coordinates).
 *  - The file's own _struct_ref_seq is only compared, never used, and a disagreement is
 *    reported as a known issue.
 */
import type { MmcifStructure, SiftsSegment } from "@helix/data-adapters";
import { ValidationFailedError } from "@helix/data-adapters";
import type { KnownIssue, ResidueRef } from "@helix/shared-types";
import { alignGlobalFreeEnds } from "./alignment.ts";
import { AA_PDB_NAME } from "./sequence.ts";

export class StructureMappingError extends ValidationFailedError {
  constructor(message: string) {
    super("structure-mapping", message);
  }
}

/** The polymer entity whose SIFTS accession is `accession`. Throws if none or ambiguous. */
export function entityForAccession(sifts: SiftsSegment[], accession: string): { entityId: string; segments: SiftsSegment[] } {
  const segs = sifts.filter((s) => s.uniprotAccession === accession);
  const entities = [...new Set(segs.map((s) => s.entityId))];
  if (entities.length === 0) throw new StructureMappingError(`no SIFTS mapping for ${accession}`);
  if (entities.length > 1) throw new StructureMappingError(`${accession} maps to several entities (${entities.join(", ")}); choose explicitly`);
  return { entityId: entities[0]!, segments: segs };
}

/** Map one UniProt position to a residue in every chain of the entity (one ResidueRef per chain). */
export function mapUniprotPosition(
  structure: MmcifStructure,
  sifts: SiftsSegment[],
  accession: string,
  uniprotPosition: number,
  assemblyIdFor: (labelAsymId: string) => string | null = () => null,
): ResidueRef[] {
  const { entityId, segments } = entityForAccession(sifts, accession);
  const out: ResidueRef[] = [];
  const chains = [...new Set(segments.map((s) => s.labelAsymId))].sort();
  for (const labelAsymId of chains) {
    const seg = segments.find((s) => s.labelAsymId === labelAsymId && uniprotPosition >= s.unpStart && uniprotPosition <= s.unpEnd);
    if (!seg) continue; // position not covered in this chain
    const labelSeqId = seg.labelSeqStart + (uniprotPosition - seg.unpStart);
    const scheme = structure.polySeqScheme.find((r) => r.labelAsymId === labelAsymId && r.labelSeqId === labelSeqId);
    if (!scheme) throw new StructureMappingError(`pdbx_poly_seq_scheme has no row for ${labelAsymId} ${labelSeqId}`);
    if (scheme.entityId !== entityId) throw new StructureMappingError(`scheme row ${labelAsymId} ${labelSeqId} is entity ${scheme.entityId}, SIFTS says ${entityId}`);
    if (scheme.authSeqNum === null) {
      throw new StructureMappingError(`${labelAsymId} ${labelSeqId} (${scheme.monId}) is not observed; no coordinates to highlight`);
    }
    const atoms = structure.atoms.filter((a) => a.model === 1 && a.labelAsymId === labelAsymId && a.labelSeqId === labelSeqId);
    const ca = atoms.find((a) => a.atomName === "CA") ?? atoms[0];
    if (!ca) throw new StructureMappingError(`atom_site has no atoms for ${labelAsymId} ${labelSeqId}`);
    if (ca.authSeqId !== scheme.authSeqNum || ca.authAsymId !== scheme.authAsymId) {
      throw new StructureMappingError(`atom_site auth ids (${ca.authAsymId} ${ca.authSeqId}) disagree with pdbx_poly_seq_scheme (${scheme.authAsymId} ${scheme.authSeqNum})`);
    }
    out.push({
      entryId: structure.entryId,
      assemblyId: assemblyIdFor(labelAsymId),
      entityId,
      labelAsymId,
      labelSeqId,
      authAsymId: scheme.authAsymId,
      authSeqId: scheme.authSeqNum,
      insCode: scheme.insCode,
      compId: ca.labelCompId,
      authCompId: ca.authCompId,
    });
  }
  if (out.length === 0) throw new StructureMappingError(`${accession} position ${uniprotPosition} is not covered by any SIFTS segment`);
  return out;
}

/** The assembly that contains a label asym (first by id). */
export function assemblyOf(structure: MmcifStructure, labelAsymId: string): string | null {
  return [...structure.assemblies].sort((a, b) => a.id.localeCompare(b.id)).find((a) => a.asymIds.includes(labelAsymId))?.id ?? null;
}

/** Independent check: align the entity sequence to UniProt and compare with SIFTS. */
export function alignmentCrossCheck(entitySequence: string, uniprotSequence: string, segments: SiftsSegment[]) {
  const aln = alignGlobalFreeEnds(entitySequence, uniprotSequence);
  const siftsOffsets = new Set(segments.map((s) => s.unpStart - s.labelSeqStart));
  const siftsOffset = siftsOffsets.size === 1 ? [...siftsOffsets][0]! : null;
  return {
    alignment: aln,
    siftsOffset,
    agrees: aln.constantOffset !== null && aln.constantOffset === siftsOffset,
  };
}

/** Residue name check: atom_site residue vs the amino acid expected from a sequence letter. */
export function residueNameMatches(ref: ResidueRef, oneLetter: string): boolean {
  return AA_PDB_NAME[oneLetter] === ref.compId;
}

/**
 * Compare the file's _struct_ref_seq.db_align_beg with SIFTS unp_start for the accession.
 * A disagreement is a known issue: HELIX uses SIFTS and never the file's numbers.
 */
export function structRefSeqIssues(structure: MmcifStructure, sifts: SiftsSegment[], accession: string): KnownIssue[] {
  const issues: KnownIssue[] = [];
  for (const r of structure.structRefSeq.filter((x) => x.dbAccession === accession)) {
    const s = sifts.find((x) => x.uniprotAccession === accession && x.authAsymId === r.strandId);
    if (!s) continue;
    if (r.dbAlignBeg !== s.unpStart || r.dbAlignEnd !== s.unpEnd) {
      issues.push({
        id: `struct-ref-seq-numbering-${structure.entryId}-${r.strandId}`,
        severity: "warning",
        summary: `${structure.entryId} _struct_ref_seq for chain ${r.strandId} disagrees with SIFTS`,
        detail: `_struct_ref_seq db_align_beg..end = ${r.dbAlignBeg}..${r.dbAlignEnd} for ${accession}; SIFTS unp_start..unp_end = ${s.unpStart}..${s.unpEnd}. The file uses a different (mature) numbering of the reference.`,
        resolution: "SIFTS is the mapping of record; _struct_ref_seq is not used for mapping.",
      });
    }
  }
  return issues;
}

/** Non-polymer and water chains whose label_asym_id differs from their auth_asym_id. */
export function labelAuthDivergences(structure: MmcifStructure): { labelAsymId: string; authAsymId: string; monId: string; authSeqNum: string }[] {
  const seen = new Map<string, { labelAsymId: string; authAsymId: string; monId: string; authSeqNum: string }>();
  for (const r of structure.nonpolyScheme) {
    if (r.labelAsymId !== r.authAsymId && !seen.has(r.labelAsymId)) seen.set(r.labelAsymId, { labelAsymId: r.labelAsymId, authAsymId: r.authAsymId, monId: r.monId, authSeqNum: r.authSeqNum });
  }
  return [...seen.values()].sort((a, b) => a.labelAsymId.localeCompare(b.labelAsymId));
}
