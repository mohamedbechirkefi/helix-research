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
    expect(Object.keys(json).sort()).toEqual(["contactCutoffAngstrom", "datasetId", "description", "genomicWindowFlank", "identifiers", "includeAlphafold", "notes", "pdbId", "variant"]);
    expect(Object.keys(json.identifiers as object).sort()).toEqual(["ensemblGeneId", "hgncSymbol", "uniprotAccession"]);
    expect(Object.keys(json.variant as object).sort()).toEqual(["clinvarUid", "commonName", "forwardAllele", "rsId", "slug"]);
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
