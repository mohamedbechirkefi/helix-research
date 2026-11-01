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
