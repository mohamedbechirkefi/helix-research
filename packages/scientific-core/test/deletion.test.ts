// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * The in-frame deletion model (Phase 9, docs/phase-9-generalisation.md section 11): the
 * deletion applied to a hand-made CDS, the frameshift and junction refusals, the HGVS and
 * SPDI forms of a deletion and the 3' shift, on sequences written here so that every expected
 * value can be checked by hand.
 */
import { describe, expect, it } from "vitest";
import { ValidationFailedError } from "@helix/data-adapters";
import { applyCodingDeletion, hgvsGDeletion, matureDeletionLabel, parseHgvsCDeletion, parseHgvsGDeletion, parseSpdi, shiftDeletionThreePrime, spdiNetDeletion, translatedDeletionLabel } from "../src/index.ts";

// Met Ile Phe Gly Val Lys Lys Stop: the F508del pattern in miniature (codon 2 ATC, codon 3 TTT).
const CDS = "ATG" + "ATC" + "TTT" + "GGT" + "GTT" + "AAA" + "AAG" + "TAA";

describe("applyCodingDeletion (plan §11 rule 2)", () => {
  it("c.6_8del: the third base of codon 2 and the first two of codon 3; codon 2 ATC becomes ATT (Ile, unchanged), codon 3 is deleted, p.Phe3del", () => {
    const d = applyCodingDeletion(CDS, 6, 8);
    expect([d.cdsStart, d.cdsEnd, d.length, d.deletedBases]).toEqual([6, 8, 3, "CTT"]);
    expect(d.affectedCodons).toEqual([
      { number: 2, reference: "ATC", afterDeletion: "ATT", referenceAminoAcid: "I", aminoAcidAfterDeletion: "I" },
      { number: 3, reference: "TTT", afterDeletion: null, referenceAminoAcid: "F", aminoAcidAfterDeletion: null },
    ]);
    expect(d.deletedResidues).toEqual([{ position: 3, aminoAcid: "F" }]);
    expect([d.residue, d.proteinChange]).toEqual([3, "p.Phe3del"]);
  });
  it("a whole-codon deletion touches one codon, which disappears", () => {
    const d = applyCodingDeletion(CDS, 7, 9);
    expect(d.affectedCodons).toEqual([{ number: 3, reference: "TTT", afterDeletion: null, referenceAminoAcid: "F", aminoAcidAfterDeletion: null }]);
    expect(d.proteinChange).toBe("p.Phe3del");
  });
  it("a two-codon deletion names a range, and the 3' rule moves a deletion inside a repeat to its last position", () => {
    expect(applyCodingDeletion(CDS, 7, 12).proteinChange).toBe("p.Phe3_Gly4del");
    // Lys Lys at 6-7: deleting codon 6 or codon 7 gives the same protein; HGVS names the 3' one.
    const d = applyCodingDeletion(CDS, 16, 18);
    expect(d.affectedCodons[0]).toMatchObject({ number: 6, reference: "AAA", afterDeletion: null });
    expect(d.deletedResidues).toEqual([{ position: 7, aminoAcid: "K" }]);
    expect(d.proteinChange).toBe("p.Lys7del");
  });
  it("refuses a frameshift with a message that says it is out of scope", () => {
    expect(() => applyCodingDeletion(CDS, 6, 7)).toThrow(ValidationFailedError);
    expect(() => applyCodingDeletion(CDS, 6, 7)).toThrow(/deletes 2 base\(s\), not a multiple of three: a frameshift is out of scope/);
    expect(() => applyCodingDeletion(CDS, 6, 6)).toThrow(/frameshift/);
    expect(() => applyCodingDeletion(CDS, 6, 9)).toThrow(/deletes 4 base\(s\)/);
  });
  it("refuses a deletion whose junction creates a new residue (a deletion-insertion), one that reaches the stop codon, and one outside the CDS", () => {
    // ATG ATC TTT GGT: deleting c.5_7 (T,C,T) leaves ATG A·TT GGT -> Met Ile Gly: Phe lost, codon 2 ATC -> ATT; still a pure deletion.
    expect(applyCodingDeletion(CDS, 5, 7).proteinChange).toBe("p.Phe3del");
    // Deleting c.4_6 (ATC) leaves ATG TTT: codon 2 becomes TTT (Phe), Ile lost: pure deletion p.Ile2del.
    expect(applyCodingDeletion(CDS, 4, 6).proteinChange).toBe("p.Ile2del");
    // ATG GAT TGG: deleting c.5_7 (A,T,T) leaves ATG GGG -> Met Gly: Asp and Trp lost, Gly gained: a delins.
    expect(() => applyCodingDeletion("ATGGATTGGTAA", 5, 7)).toThrow(/deletion-insertion/);
    expect(() => applyCodingDeletion(CDS, 22, 24)).toThrow(/stop codon|expected/);
    expect(() => applyCodingDeletion(CDS, 23, 25)).toThrow(/outside the CDS/);
    expect(() => applyCodingDeletion(CDS, 0, 2)).toThrow(/invalid deleted span/);
  });
});

describe("deletion HGVS, SPDI and the 3' shift", () => {
  it("parses c. and g. deletions and refuses other forms", () => {
    expect(parseHgvsCDeletion("c.1521_1523del")).toEqual({ reference: null, start: 1521, end: 1523 });
    expect(parseHgvsCDeletion("ENST00000003084.11:c.1521_1523del")).toEqual({ reference: "ENST00000003084.11", start: 1521, end: 1523 });
    expect(parseHgvsCDeletion("c.9del")).toEqual({ reference: null, start: 9, end: 9 });
    expect(() => parseHgvsCDeletion("c.1521_1523delCTT")).toThrow(/unsupported coding HGVS deletion/);
    expect(() => parseHgvsCDeletion("c.1523_1521del")).toThrow(/end before start/);
    expect(parseHgvsGDeletion("NC_000007.14:g.117559590_117559592del")).toEqual({ accession: "NC_000007.14", start: 117559590, end: 117559592 });
    expect(() => parseHgvsGDeletion("NC_000007.14:g.117559590T>A")).toThrow(/unsupported genomic HGVS deletion/);
    expect(hgvsGDeletion("NC_000007.14", 117559590, 117559592)).toBe("NC_000007.14:g.117559590_117559592del");
    expect(hgvsGDeletion("NC_000007.14", 5, 5)).toBe("NC_000007.14:g.5del");
  });
  it("reads the net deletion of an SPDI, whatever context it repeats", () => {
    expect(parseSpdi("NC_000007.14:117559589:CTT:")).toEqual({ accession: "NC_000007.14", position0: 117559589, deleted: "CTT", inserted: "" });
    expect(spdiNetDeletion("NC_000007.14:117559589:CTT:")).toEqual({ accession: "NC_000007.14", start: 117559590, end: 117559592, deleted: "CTT" });
    // A contextual form that repeats a flanking base on both sides nets to the same deletion.
    expect(spdiNetDeletion("NC_000007.14:117559588:TCTTT:TT")).toEqual({ accession: "NC_000007.14", start: 117559590, end: 117559592, deleted: "CTT" });
    expect(() => spdiNetDeletion("NC_000007.14:117559589:C:A")).toThrow(/not a pure deletion/);
    expect(() => spdiNetDeletion("NC_000007.14:117559589:CTT:CTT")).toThrow(/not a pure deletion/);
  });
  it("shifts a deletion to its 3'-most equivalent position and refuses to guess past the sequence end", () => {
    // ...A T C T T T G G... starting at position 100: deleting CTT at 102-104 or TCT at 101-103 is the same allele; 3' on the forward strand is 102-104.
    const seq = "ATCTTTGG";
    expect(shiftDeletionThreePrime(seq, 100, 101, 103, 1)).toEqual({ start: 102, end: 104 });
    expect(shiftDeletionThreePrime(seq, 100, 102, 104, 1)).toEqual({ start: 102, end: 104 });
    // On the reverse strand the 3' direction is the forward 5': the same allele shifts left.
    expect(shiftDeletionThreePrime(seq, 100, 102, 104, -1)).toEqual({ start: 101, end: 103 });
    // A single base inside a homopolymer run that reaches the end of the sequence cannot be placed.
    expect(() => shiftDeletionThreePrime("ATTTT", 1, 2, 2, 1)).toThrow(/reaches the end of the sequence/);
    expect(() => shiftDeletionThreePrime(seq, 100, 90, 92, 1)).toThrow(/outside the sequence/);
  });
  it("labels a deletion in translated numbering, and in mature numbering only when a processed chain starts after 1", () => {
    expect(translatedDeletionLabel("p.Phe508del")).toBe("p.Phe508del (translated numbering, Met = 1)");
    expect(matureDeletionLabel([{ position: 508, aminoAcid: "F" }], { start: 1, end: 1480 })).toBeNull();
    expect(matureDeletionLabel([{ position: 508, aminoAcid: "F" }], null)).toBeNull();
    expect(matureDeletionLabel([{ position: 7, aminoAcid: "E" }], { start: 2, end: 147 })).toBe("Glu6del (mature numbering)");
    expect(matureDeletionLabel([{ position: 7, aminoAcid: "E" }, { position: 8, aminoAcid: "K" }], { start: 2, end: 147 })).toBe("Glu6_Lys7del (mature numbering)");
  });
});
