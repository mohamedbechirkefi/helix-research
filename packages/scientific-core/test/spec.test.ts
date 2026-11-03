// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/** Gene specifications (Phase 9): the loader, its refusals, and the in-code HBB mirror. */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "../../../scripts/data-preparation/lib/node-env.ts";
import { FORBIDDEN_SPEC_KEYS, GeneSpecError, GeneSpecSchema, HBB_CONFIG, loadGeneSpec, parseGeneSpec, specOf } from "../src/index.ts";

const hbbSpec = async (): Promise<Record<string, unknown>> => JSON.parse(await readFile(join(REPO_ROOT, "data/specs/hbb.json"), "utf8")) as Record<string, unknown>;

describe("gene specification loader (Phase 9, plan §2)", () => {
  it("data/specs/hbb.json round-trips to the configuration and equals the in-code mirror HBB_CONFIG", async () => {
    const json = await hbbSpec();
    const config = loadGeneSpec(json);
    expect(config).toStrictEqual(HBB_CONFIG);
    // The mirror, turned back into a specification, is the file minus its notes.
    const { notes, ...withoutNotes } = json;
    expect(typeof notes).toBe("string");
    expect(specOf(HBB_CONFIG)).toStrictEqual(withoutNotes);
    expect(GeneSpecSchema.safeParse(json).success).toBe(true);
  });
  it("holds selections only: no position, sequence or version is in the file", async () => {
    const json = await hbbSpec();
    expect(Object.keys(json).sort()).toEqual(["bridgeQuestion", "contactCutoffAngstrom", "datasetId", "description", "genomicWindowFlank", "identifiers", "includeAlphafold", "notes", "pdbId", "questions", "variant"]);
    expect(Object.keys(json.identifiers as object).sort()).toEqual(["ensemblGeneId", "hgncSymbol", "uniprotAccession"]);
    expect(Object.keys(json.variant as object).sort()).toEqual(["clinvarUid", "commonName", "forwardAllele", "rsId", "slug"]);
  });
  it("a variant without kind is a substitution (hbb.json is unchanged); a deletion names its HGVS c. instead of a forward allele (plan §11 rule 1)", async () => {
    const json = await hbbSpec();
    expect(loadGeneSpec(json).variant).toMatchObject({ kind: "substitution", forwardAllele: "A" });
    expect(loadGeneSpec({ ...json, variant: { ...(json.variant as object), kind: "substitution" } })).toStrictEqual(HBB_CONFIG);
    const del = { kind: "deletion", slug: "f508del", commonName: "F508del (p.Phe508del)", rsId: "rs113993960", hgvsC: "c.1521_1523del", clinvarUid: "7105" };
    const config = loadGeneSpec({ ...json, variant: del });
    expect(config.variant).toStrictEqual(del);
    expect("forwardAllele" in config.variant!).toBe(false);
    expect(specOf(config).variant).toStrictEqual(del);
    // A deletion may not carry a forward allele, and a substitution may not carry an HGVS c.
    expect(() => loadGeneSpec({ ...json, variant: { ...del, forwardAllele: "A" } })).toThrow(GeneSpecError);
    expect(() => loadGeneSpec({ ...json, variant: { ...(json.variant as object), hgvsC: "c.20_22del" } })).toThrow(GeneSpecError);
    // The HGVS must be a CDS span without a transcript prefix (the builder adds the versioned id it selected).
    expect(() => loadGeneSpec({ ...json, variant: { ...del, hgvsC: "ENST00000003084.11:c.1521_1523del" } })).toThrow(/coding HGVS deletion/);
    expect(() => loadGeneSpec({ ...json, variant: { ...del, hgvsC: "c.1521A>T" } })).toThrow(/coding HGVS deletion/);
    expect(loadGeneSpec({ ...json, variant: { ...del, hgvsC: "c.1521_1526del" } }).variant).toMatchObject({ hgvsC: "c.1521_1526del" });
  });
  it("refuses a frameshift deletion with a message that says so", async () => {
    const json = await hbbSpec();
    const del = { kind: "deletion", slug: "x", commonName: "x", rsId: "rs1", hgvsC: "c.1521_1522del", clinvarUid: "1" };
    expect(() => loadGeneSpec({ ...json, variant: del })).toThrow(GeneSpecError);
    expect(() => loadGeneSpec({ ...json, variant: del })).toThrow(/deletes 2 base\(s\), not a multiple of three: a frameshift is out of scope/);
    expect(() => loadGeneSpec({ ...json, variant: { ...del, hgvsC: "c.1521del" } })).toThrow(/deletes 1 base\(s\)/);
    expect(() => loadGeneSpec({ ...json, variant: { ...del, hgvsC: "c.1521_1524del" } })).toThrow(/deletes 4 base\(s\)/);
  });
  it("validates the questions: text and capability keys only; an empty list is allowed, an unknown key or a stray field is not", async () => {
    const json = await hbbSpec();
    const config = loadGeneSpec(json);
    expect(config.questions).toHaveLength(4);
    expect(config.questions[0]).toStrictEqual({ text: "Show me where the sickle-cell mutation affects hemoglobin.", requires: ["variantHighlight", "experimentalStructure"] });
    expect(config.bridgeQuestion).toBe("See the sickle-cell mutation on the protein.");
    const { bridgeQuestion, ...noBridge } = json;
    expect(typeof bridgeQuestion).toBe("string");
    expect(loadGeneSpec({ ...noBridge, questions: [] })).toMatchObject({ questions: [] });
    expect("bridgeQuestion" in loadGeneSpec({ ...noBridge, questions: [] })).toBe(false);
    const { questions, ...noQuestions } = json;
    expect(Array.isArray(questions)).toBe(true);
    expect(() => loadGeneSpec(noQuestions)).toThrow(/questions/);
    expect(() => loadGeneSpec({ ...json, questions: [{ text: "x", requires: ["structureView"] }] })).toThrow(/requires/);
    expect(() => loadGeneSpec({ ...json, questions: [{ text: "", requires: [] }] })).toThrow(/text/);
    expect(() => loadGeneSpec({ ...json, questions: [{ text: "x", requires: [], answer: "y" }] })).toThrow(/answer/);
    expect(() => loadGeneSpec({ ...json, bridgeQuestion: "" })).toThrow(/bridgeQuestion/);
    // A question may not smuggle presentation in (the forbidden-key rule applies at any depth).
    expect(() => parseGeneSpec({ ...json, questions: [{ text: "x", requires: [], world: "protein" }] })).toThrow(/key "questions.0.world"/);
  });
  it("rejects unknown keys at the top level and inside groups", async () => {
    const json = await hbbSpec();
    expect(() => loadGeneSpec({ ...json, genomicPosition: 5227002 })).toThrow(GeneSpecError);
    expect(() => loadGeneSpec({ ...json, genomicPosition: 5227002 })).toThrow(/genomicPosition/);
    expect(() => loadGeneSpec({ ...json, identifiers: { ...(json.identifiers as object), refseq: "NM_000518" } })).toThrow(/refseq/);
    expect(() => loadGeneSpec({ ...json, variant: { ...(json.variant as object), position: 7 } })).toThrow(/position/);
  });
  it("rejects a specification that names a world, a chapter, a camera or a colour, at any depth and in any case", async () => {
    const json = await hbbSpec();
    for (const key of FORBIDDEN_SPEC_KEYS) {
      expect(() => parseGeneSpec({ ...json, [key]: "protein" }), key).toThrow(/may not name a world, a chapter, a camera or a colour/);
    }
    expect(() => parseGeneSpec({ ...json, Colour: "#ff0000" })).toThrow(/key "Colour"/);
    expect(() => parseGeneSpec({ ...json, variant: { ...(json.variant as object), camera: { x: 1 } } })).toThrow(/key "variant.camera"/);
    expect(() => parseGeneSpec({ ...json, identifiers: { ...(json.identifiers as object), chapters: [] } })).toThrow(/key "identifiers.chapters"/);
  });
  it("accepts a specification without pdbId and without variant, and the configuration then carries neither", async () => {
    const { pdbId, variant, ...rest } = await hbbSpec();
    expect(pdbId).toBe("2HBS");
    expect(variant).toBeDefined();
    const config = loadGeneSpec({ ...rest, datasetId: "hbb-no-structure" });
    expect(config.pdbId).toBeUndefined();
    expect(config.variant).toBeUndefined();
    expect("pdbId" in config).toBe(false);
    expect("variant" in config).toBe(false);
    expect(config.uniprotAccession).toBe(HBB_CONFIG.uniprotAccession);
    expect(specOf(config).notes).toBeUndefined();
  });
  it("rejects malformed selections and missing build parameters", async () => {
    const json = await hbbSpec();
    expect(() => loadGeneSpec({ ...json, pdbId: "0ABC" })).toThrow(/PDB id/);
    expect(() => loadGeneSpec({ ...json, variant: { ...(json.variant as object), rsId: "334" } })).toThrow(/dbSNP id/);
    expect(() => loadGeneSpec({ ...json, variant: { ...(json.variant as object), forwardAllele: "N" } })).toThrow(/forward allele/);
    expect(() => loadGeneSpec({ ...json, identifiers: { ...(json.identifiers as object), ensemblGeneId: "ENSG1" } })).toThrow(/Ensembl gene id/);
    expect(() => loadGeneSpec({ ...json, genomicWindowFlank: 2.5 })).toThrow(/genomicWindowFlank/);
    const { includeAlphafold, ...noAf } = json;
    expect(includeAlphafold).toBe(true);
    expect(() => loadGeneSpec(noAf)).toThrow(/includeAlphafold/);
    expect(() => loadGeneSpec("hbb")).toThrow(GeneSpecError);
  });
});
