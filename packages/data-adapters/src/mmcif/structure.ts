// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Typed view of the mmCIF categories HELIX uses (P2.2.5): entry metadata, _entity,
 * _entity_poly, _struct_asym, pdbx_poly_seq_scheme, pdbx_nonpoly_scheme, assemblies,
 * _struct_ref_seq (read only to report its numbering, never to map) and atom_site.
 *
 * Every residue keeps both label_* and auth_* identifiers. Residue names come from
 * atom_site, the coordinates actually deposited.
 */
import { MalformedResponseError } from "../http/errors.ts";
import { type CifBlock, cifNull, parseMmcif, requireCategories, rowsOf } from "./parser.ts";

export const REQUIRED_CATEGORIES = [
  "entry",
  "entity",
  "entity_poly",
  "struct_asym",
  "pdbx_poly_seq_scheme",
  "pdbx_struct_assembly",
  "pdbx_struct_assembly_gen",
  "atom_site",
] as const;

export interface MmcifEntity {
  id: string;
  type: string;
  description: string;
  moleculeCount: number | null;
  mutation: string | null;
  sequenceCanonical: string | null;
  strandIds: string[];
}

export interface PolySeqSchemeRow {
  labelAsymId: string;
  entityId: string;
  labelSeqId: number;
  monId: string;
  authSeqNum: string | null;
  authMonId: string | null;
  authAsymId: string;
  insCode: string | null;
}

export interface NonpolySchemeRow {
  labelAsymId: string;
  entityId: string;
  monId: string;
  authSeqNum: string;
  authAsymId: string;
}

export interface AtomRow {
  group: "ATOM" | "HETATM";
  atomName: string;
  element: string;
  altId: string | null;
  labelCompId: string;
  labelAsymId: string;
  labelEntityId: string;
  labelSeqId: number | null;
  insCode: string | null;
  x: number;
  y: number;
  z: number;
  authSeqId: string;
  authCompId: string;
  authAsymId: string;
  model: number;
}

export interface StructRefSeqRow {
  strandId: string;
  dbAccession: string;
  seqAlignBeg: number;
  seqAlignEnd: number;
  dbAlignBeg: number;
  dbAlignEnd: number;
}

export interface MmcifStructure {
  entryId: string;
  title: string;
  method: string;
  resolution: number | null;
  latestRevision: { version: string; date: string };
  depositionDate: string | null;
  primaryCitation: { title: string; journal: string | null; year: number | null; pubmedId: string | null; doi: string | null } | null;
  entities: MmcifEntity[];
  structAsym: { id: string; entityId: string }[];
  polySeqScheme: PolySeqSchemeRow[];
  nonpolyScheme: NonpolySchemeRow[];
  assemblies: { id: string; details: string; asymIds: string[] }[];
  structRefSeq: StructRefSeqRow[];
  atoms: AtomRow[];
}

function num(v: string | undefined): number | null {
  const s = cifNull(v);
  if (s === null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function reqNum(v: string | undefined, what: string, source: string | null): number {
  const n = num(v);
  if (n === null) throw new MalformedResponseError(source, "truncated", "", false, `non-numeric ${what}: ${v}`);
  return n;
}

/** Read a structure from mmCIF text. Throws a typed error on truncated or inconsistent files. */
export function readMmcifStructure(text: string, source: string | null = null): MmcifStructure {
  const block = parseMmcif(text, source);
  return structureFromBlock(block, source);
}

export function structureFromBlock(block: CifBlock, source: string | null = null): MmcifStructure {
  requireCategories(block, REQUIRED_CATEGORIES, source);
  const one = (cat: string, field: string): string | null => cifNull(rowsOf(block, cat)[0]?.[field]);

  const polyByEntity = new Map(rowsOf(block, "entity_poly").map((r) => [r.entity_id ?? "", r]));
  const entities: MmcifEntity[] = rowsOf(block, "entity").map((r) => {
    const p = polyByEntity.get(r.id ?? "");
    return {
      id: r.id ?? "",
      type: r.type ?? "",
      description: cifNull(r.pdbx_description) ?? "",
      moleculeCount: num(r.pdbx_number_of_molecules),
      mutation: cifNull(r.pdbx_mutation),
      sequenceCanonical: p ? (cifNull(p.pdbx_seq_one_letter_code_can)?.replace(/\s+/g, "") ?? null) : null,
      strandIds: p ? (cifNull(p.pdbx_strand_id)?.split(",").map((s) => s.trim()) ?? []) : [],
    };
  });

  const polySeqScheme: PolySeqSchemeRow[] = rowsOf(block, "pdbx_poly_seq_scheme").map((r) => ({
    labelAsymId: r.asym_id ?? "",
    entityId: r.entity_id ?? "",
    labelSeqId: reqNum(r.seq_id, "pdbx_poly_seq_scheme.seq_id", source),
    monId: r.mon_id ?? "",
    authSeqNum: cifNull(r.auth_seq_num),
    authMonId: cifNull(r.auth_mon_id),
    authAsymId: r.pdb_strand_id ?? "",
    insCode: cifNull(r.pdb_ins_code),
  }));

  const nonpolyScheme: NonpolySchemeRow[] = rowsOf(block, "pdbx_nonpoly_scheme").map((r) => ({
    labelAsymId: r.asym_id ?? "",
    entityId: r.entity_id ?? "",
    monId: r.mon_id ?? "",
    authSeqNum: r.auth_seq_num ?? "",
    authAsymId: r.pdb_strand_id ?? "",
  }));

  const atoms: AtomRow[] = rowsOf(block, "atom_site").map((r) => ({
    group: r.group_PDB === "HETATM" ? "HETATM" : "ATOM",
    atomName: r.label_atom_id ?? "",
    element: r.type_symbol ?? "",
    altId: cifNull(r.label_alt_id),
    labelCompId: r.label_comp_id ?? "",
    labelAsymId: r.label_asym_id ?? "",
    labelEntityId: r.label_entity_id ?? "",
    labelSeqId: num(r.label_seq_id),
    insCode: cifNull(r.pdbx_PDB_ins_code),
    x: reqNum(r.Cartn_x, "Cartn_x", source),
    y: reqNum(r.Cartn_y, "Cartn_y", source),
    z: reqNum(r.Cartn_z, "Cartn_z", source),
    authSeqId: r.auth_seq_id ?? "",
    authCompId: r.auth_comp_id ?? "",
    authAsymId: r.auth_asym_id ?? "",
    model: reqNum(r.pdbx_PDB_model_num, "pdbx_PDB_model_num", source),
  }));

  // Consistency: every residue the scheme says was observed must have atoms. A file cut at
  // a row boundary inside atom_site passes the syntax check but fails here.
  const observed = new Set(atoms.map((a) => `${a.labelAsymId}|${a.labelSeqId}`));
  const missing = polySeqScheme.filter((r) => r.authMonId !== null && !observed.has(`${r.labelAsymId}|${r.labelSeqId}`));
  if (missing.length > 0) {
    const m = missing[0]!;
    throw new MalformedResponseError(source, "truncated", "", false, `${missing.length} observed residues have no atoms (first: ${m.labelAsymId} ${m.labelSeqId} ${m.monId})`,
    );
  }

  const revisions = rowsOf(block, "pdbx_audit_revision_history").map((r) => ({
    major: Number(r.major_revision),
    minor: Number(r.minor_revision),
    date: r.revision_date ?? "",
  }));
  revisions.sort((a, b) => a.major - b.major || a.minor - b.minor);
  const last = revisions[revisions.length - 1];

  const cit = rowsOf(block, "citation").find((r) => r.id === "primary");
  const genRows = rowsOf(block, "pdbx_struct_assembly_gen");

  return {
    entryId: one("entry", "id") ?? "",
    title: one("struct", "title") ?? "",
    method: one("exptl", "method") ?? "",
    resolution: num(rowsOf(block, "refine")[0]?.ls_d_res_high),
    latestRevision: last ? { version: `${last.major}.${last.minor}`, date: last.date } : { version: "unknown", date: "" },
    depositionDate: one("pdbx_database_status", "recvd_initial_deposition_date"),
    primaryCitation: cit
      ? {
          title: cifNull(cit.title) ?? "",
          journal: cifNull(cit.journal_abbrev),
          year: num(cit.year),
          pubmedId: cifNull(cit.pdbx_database_id_PubMed),
          doi: cifNull(cit.pdbx_database_id_DOI),
        }
      : null,
    entities,
    structAsym: rowsOf(block, "struct_asym").map((r) => ({ id: r.id ?? "", entityId: r.entity_id ?? "" })),
    polySeqScheme,
    nonpolyScheme,
    assemblies: rowsOf(block, "pdbx_struct_assembly").map((a) => ({
      id: a.id ?? "",
      details: cifNull(a.details) ?? "",
      asymIds: genRows
        .filter((g) => g.assembly_id === a.id)
        .flatMap((g) => (g.asym_id_list ?? "").split(",").map((s) => s.trim()))
        .filter((s) => s.length > 0),
    })),
    structRefSeq: rowsOf(block, "struct_ref_seq").map((r) => ({
      strandId: r.pdbx_strand_id ?? "",
      dbAccession: r.pdbx_db_accession ?? "",
      seqAlignBeg: Number(r.seq_align_beg),
      seqAlignEnd: Number(r.seq_align_end),
      dbAlignBeg: Number(r.db_align_beg),
      dbAlignEnd: Number(r.db_align_end),
    })),
    atoms,
  };
}

/** Read the _pdbx_data_usage text of a model file (AlphaFold keeps its licence and disclaimer there). */
export function readDataUsage(text: string, source: string | null = null): string[] {
  const block = parseMmcif(text, source);
  return rowsOf(block, "pdbx_data_usage")
    .map((r) => cifNull(r.details))
    .filter((s): s is string => s !== null);
}
