// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
import { beforeAll, describe, expect, it } from "vitest";
import { fixtureText } from "../../../scripts/data-preparation/lib/fixtures.ts";
import { MalformedResponseError, type MmcifStructure, ParseError, cifNull, parseMmcif, readMmcifStructure, rowsOf } from "../src/index.ts";

describe("CIF syntax", () => {
  it("reads single items, loops, both quote styles, embedded quotes, text fields and comments", () => {
    const text = [
      "data_TEST",
      "# a comment",
      "_struct.title 'A title with spaces'",
      "_struct.pdbx_descriptor \"it's quoted\"",
      "_exptl.method X-RAY",
      "loop_",
      "_citation.id",
      "_citation.title",
      "primary 'O'Brien's model'",
      "1",
      ";A multi-line",
      "text field",
      ";",
      "_entity.id 1",
      "_entity.pdbx_mutation ?",
      "_entity.details .",
    ].join("\n");
    const b = parseMmcif(text);
    expect(b.header).toBe("TEST");
    expect(rowsOf(b, "struct")[0]).toEqual({ title: "A title with spaces", pdbx_descriptor: "it's quoted" });
    expect(rowsOf(b, "citation")).toEqual([
      { id: "primary", title: "O'Brien's model" },
      { id: "1", title: "A multi-line\ntext field" },
    ]);
    expect(cifNull(rowsOf(b, "entity")[0]!.pdbx_mutation)).toBeNull();
    expect(cifNull(rowsOf(b, "entity")[0]!.details)).toBeNull();
  });

  it("fails with a typed error on an unterminated text field or quote", () => {
    expect(() => parseMmcif("data_X\n_a.b\n;never closed\n")).toThrow(MalformedResponseError);
    expect(() => parseMmcif("data_X\n_a.b 'open\n")).toThrow(MalformedResponseError);
  });

  it("fails when a loop's value count is not a multiple of its columns", () => {
    const e = (() => {
      try {
        parseMmcif("data_X\nloop_\n_a.x\n_a.y\n1 2 3\n");
      } catch (err) {
        return err;
      }
    })();
    expect(e).toBeInstanceOf(MalformedResponseError);
    expect((e as MalformedResponseError).kind).toBe("truncated");
  });

  it("rejects text that is not mmCIF (no data block, or an HTML page)", () => {
    expect(() => parseMmcif("_a.b 1")).toThrow(ParseError);
    expect(() => parseMmcif("<html><body>error</body></html>")).toThrow(ParseError);
  });
});

describe("2HBS mmCIF (research/raw/rcsb/2HBS.cif)", () => {
  let text: string;
  let s: MmcifStructure;
  beforeAll(async () => {
    text = await fixtureText("mmcif");
    s = readMmcifStructure(text);
  });

  it("reads entry metadata", () => {
    expect(s.entryId).toBe("2HBS");
    expect(s.method).toBe("X-RAY DIFFRACTION");
    expect(s.resolution).toBe(2.05);
    expect(s.latestRevision).toEqual({ version: "1.5", date: "2026-08-12" });
    expect(s.primaryCitation?.pubmedId).toBe("9325099");
  });

  it("P9.2.2: one model, no NMR ensemble, the entry's own cross-references and sequence differences (read, never used to map)", () => {
    expect(s.modelCount).toBe(1);
    expect(s.nmrEnsemble).toBeNull();
    expect(s.structRef.map((r) => [r.entityId, r.dbName, r.dbAccession])).toEqual([
      ["1", "UNP", "P69905"],
      ["2", "UNP", "P68871"],
    ]);
    // 2HBS declares the HbS residue as a variant of the reference at mature position 6 on each beta chain.
    expect(s.structRefSeqDif.map((d) => [d.strandId, d.seqNum, d.monId, d.dbMonId, d.dbSeqNum, d.details])).toEqual([
      ["B", 6, "VAL", "GLU", 6, "variant"],
      ["D", 6, "VAL", "GLU", 6, "variant"],
      ["F", 6, "VAL", "GLU", 6, "variant"],
      ["H", 6, "VAL", "GLU", 6, "variant"],
    ]);
  });

  it("reads entities, poly_seq_scheme and atom_site with label and auth ids", () => {
    expect(s.entities.filter((e) => e.type === "polymer").map((e) => e.id)).toEqual(["1", "2"]);
    expect(s.polySeqScheme.filter((r) => r.entityId === "2")).toHaveLength(4 * 146);
    const ca = s.atoms.filter((a) => a.atomName === "CA" && a.labelEntityId === "2");
    expect(ca).toHaveLength(4 * 146);
    expect(s.atoms.every((a) => a.model === 1 && a.altId === null)).toBe(true);
  });

  it("T30: a truncated file is a typed error, never a partial structure", () => {
    // cut inside a row of atom_site
    const midRow = text.slice(0, text.indexOf("ATOM   5000 ") + 30);
    expect(() => readMmcifStructure(midRow)).toThrow(MalformedResponseError);
    // cut exactly at a row boundary: syntax is fine, but observed residues have no atoms
    const atRow = text.slice(0, text.indexOf("ATOM   5000 "));
    const e = (() => {
      try {
        readMmcifStructure(atRow);
      } catch (err) {
        return err;
      }
    })();
    expect(e).toBeInstanceOf(MalformedResponseError);
    expect((e as MalformedResponseError).message).toMatch(/truncated/);
    // cut before atom_site: required category missing
    const beforeLoop = text.lastIndexOf("loop_", text.indexOf("_atom_site.group_PDB"));
    expect(() => readMmcifStructure(text.slice(0, beforeLoop))).toThrow(/missing mmCIF categories: atom_site/);
    // a dangling loop_ header at the end of the file
    expect(() => readMmcifStructure(text.slice(0, beforeLoop + 6))).toThrow(MalformedResponseError);
  });
});

describe("a solution-NMR entry (P9.2.2, plan section 13 rule 2): no _refine, no _em_3d_reconstruction, several models", () => {
  /** A two-residue, two-model entry in the shape of an NMR deposition, with the categories the reader requires. */
  const nmr = [
    "data_1ABC",
    "_entry.id 1ABC",
    "_struct.title 'Solution structure of a test peptide'",
    "_exptl.method 'SOLUTION NMR'",
    "_pdbx_nmr_ensemble.entry_id 1ABC",
    "_pdbx_nmr_ensemble.conformers_calculated_total_number 25",
    "_pdbx_nmr_ensemble.conformers_submitted_total_number 2",
    "_pdbx_nmr_ensemble.representative_conformer ?",
    "_pdbx_nmr_representative.entry_id 1ABC",
    "_pdbx_nmr_representative.conformer_id 2",
    "_pdbx_nmr_representative.selection_criteria 'closest to the average'",
    "loop_",
    "_entity.id",
    "_entity.type",
    "_entity.pdbx_description",
    "_entity.pdbx_number_of_molecules",
    "_entity.pdbx_mutation",
    "1 polymer 'test peptide' 1 ?",
    "_entity_poly.entity_id 1",
    "_entity_poly.pdbx_seq_one_letter_code_can GA",
    "_entity_poly.pdbx_strand_id A",
    "loop_",
    "_struct_ref.id",
    "_struct_ref.db_name",
    "_struct_ref.db_code",
    "_struct_ref.entity_id",
    "_struct_ref.pdbx_db_accession",
    "1 UNP TEST_HUMAN 1 Q00000",
    "loop_",
    "_struct_ref_seq_dif.align_id",
    "_struct_ref_seq_dif.mon_id",
    "_struct_ref_seq_dif.pdbx_pdb_strand_id",
    "_struct_ref_seq_dif.seq_num",
    "_struct_ref_seq_dif.pdbx_seq_db_name",
    "_struct_ref_seq_dif.pdbx_seq_db_accession_code",
    "_struct_ref_seq_dif.db_mon_id",
    "_struct_ref_seq_dif.pdbx_seq_db_seq_num",
    "_struct_ref_seq_dif.details",
    "1 ALA A 2 UNP Q00000 ? ? 'cloning artifact'",
    "_struct_asym.id A",
    "_struct_asym.entity_id 1",
    "loop_",
    "_pdbx_poly_seq_scheme.asym_id",
    "_pdbx_poly_seq_scheme.entity_id",
    "_pdbx_poly_seq_scheme.seq_id",
    "_pdbx_poly_seq_scheme.mon_id",
    "_pdbx_poly_seq_scheme.auth_seq_num",
    "_pdbx_poly_seq_scheme.auth_mon_id",
    "_pdbx_poly_seq_scheme.pdb_strand_id",
    "_pdbx_poly_seq_scheme.pdb_ins_code",
    "A 1 1 GLY 1 GLY A .",
    "A 1 2 ALA 2 ALA A .",
    "_pdbx_struct_assembly.id 1",
    "_pdbx_struct_assembly.details author_defined_assembly",
    "_pdbx_struct_assembly_gen.assembly_id 1",
    "_pdbx_struct_assembly_gen.asym_id_list A",
    "loop_",
    "_atom_site.group_PDB",
    "_atom_site.label_atom_id",
    "_atom_site.type_symbol",
    "_atom_site.label_alt_id",
    "_atom_site.label_comp_id",
    "_atom_site.label_asym_id",
    "_atom_site.label_entity_id",
    "_atom_site.label_seq_id",
    "_atom_site.pdbx_PDB_ins_code",
    "_atom_site.Cartn_x",
    "_atom_site.Cartn_y",
    "_atom_site.Cartn_z",
    "_atom_site.auth_seq_id",
    "_atom_site.auth_comp_id",
    "_atom_site.auth_asym_id",
    "_atom_site.pdbx_PDB_model_num",
    "ATOM CA C . GLY A 1 1 ? 0.0 0.0 0.0 1 GLY A 1",
    "ATOM HA H . GLY A 1 1 ? 0.5 0.5 0.5 1 GLY A 1",
    "ATOM CA C . ALA A 1 2 ? 3.8 0.0 0.0 2 ALA A 1",
    "ATOM CA C . GLY A 1 1 ? 0.1 0.0 0.0 1 GLY A 2",
    "ATOM HA H . GLY A 1 1 ? 0.6 0.5 0.5 1 GLY A 2",
    "ATOM CA C . ALA A 1 2 ? 3.9 0.0 0.0 2 ALA A 2",
  ].join("\n");
  it("resolution null, the model count from atom_site, the ensemble from _pdbx_nmr_ensemble and the representative conformer from _pdbx_nmr_representative", () => {
    const s = readMmcifStructure(nmr);
    expect(s.method).toBe("SOLUTION NMR");
    expect(s.resolution).toBeNull();
    expect(s.modelCount).toBe(2);
    expect(s.nmrEnsemble).toEqual({ conformersCalculated: 25, conformersSubmitted: 2, representativeConformer: 2, representativeSelectionCriteria: "closest to the average" });
    expect(s.atoms.filter((a) => a.model === 1)).toHaveLength(3);
    expect(s.structRef).toEqual([{ id: "1", dbName: "UNP", dbCode: "TEST_HUMAN", dbAccession: "Q00000", entityId: "1" }]);
    expect(s.structRefSeqDif).toEqual([{ strandId: "A", seqNum: 2, monId: "ALA", dbName: "UNP", dbAccession: "Q00000", dbMonId: null, dbSeqNum: null, details: "cloning artifact" }]);
  });
  it("an entry that states a resolution in neither category is not an error: the reader leaves it null and says nothing else", () => {
    const withoutEnsemble = nmr.split("\n").filter((l) => !l.startsWith("_pdbx_nmr_")).join("\n");
    const s = readMmcifStructure(withoutEnsemble);
    expect(s.resolution).toBeNull();
    expect(s.nmrEnsemble).toBeNull();
    expect(s.modelCount).toBe(2);
  });
});
