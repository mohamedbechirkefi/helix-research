// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * The generic builder (Phase 9, step 2): a specification without an experimental structure
 * and without a reference variant builds from the recorded fixtures; the specification is
 * the only per-gene input (no gene identifier is typed in the packages' sources).
 */
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ValidationFailedError } from "@helix/data-adapters";
import { HBB_CONFIG, type SliceConfig, buildSlice, inputsFor, loadGeneSpec } from "@helix/scientific-core";
import { CapabilityReport, DatasetManifest, Gene, Protein } from "@helix/shared-types";
import { GENERATOR_SCRIPT, buildGene, parseBuildArgs, readSpec } from "../lib/build-gene.ts";
import { loadFixtureInputs } from "../lib/fixtures.ts";
import { REPO_ROOT } from "../lib/node-env.ts";

/** The HBB specification with the structure and variant selections removed: same gene, same UniProt entry. */
async function noStructureSpec(): Promise<SliceConfig> {
  const json = JSON.parse(await readFile(join(REPO_ROOT, "data/specs/hbb.json"), "utf8")) as Record<string, unknown>;
  const { pdbId, variant, notes, ...rest } = json;
  expect([pdbId, variant, typeof notes]).toEqual(["2HBS", HBB_CONFIG.variant, "string"]);
  return loadGeneSpec({ ...rest, datasetId: "hbb-no-structure", description: "HBB with no experimental structure and no reference variant selected (test specification).", notes: "Built by the dataset tests from the HBB fixtures; never a curated set." });
}

describe("generic builder: data/specs and the command line", () => {
  it("readSpec('hbb') is HBB_CONFIG and parseBuildArgs reads the documented flags", async () => {
    expect(await readSpec("hbb")).toStrictEqual(HBB_CONFIG);
    await expect(readSpec("nope")).rejects.toThrow(/no gene specification at data\/specs\/nope\.json/);
    await expect(readSpec("../x")).rejects.toThrow(/not a specification name/);
    expect(parseBuildArgs(["--gene", "hbb", "--fixtures", "--out", "/tmp/x"])).toEqual({ gene: "hbb", mode: "fixtures", outDir: "/tmp/x" });
    expect(parseBuildArgs(["--gene", "hbb", "--offline"])).toEqual({ gene: "hbb", mode: "offline", outDir: null });
    expect(parseBuildArgs([])).toEqual({ gene: null, mode: "live", outDir: null });
    expect(() => parseBuildArgs(["--gene"])).toThrow(/--gene needs a value/);
  });
});

describe("generic builder: a specification without pdbId and without variant (fixtures build)", () => {
  let out: string;
  let files: string[];
  let manifest: DatasetManifest;
  let cap: CapabilityReport;
  beforeAll(async () => {
    const dir = await mkdtemp(join(tmpdir(), "helix-gene-build-"));
    out = join(dir, "hbb-no-structure");
    const r = await buildGene({ config: await noStructureSpec(), mode: "fixtures", fixtureSet: "hbb", outDir: out, log: () => undefined });
    files = (await readdir(out)).sort();
    manifest = DatasetManifest.parse(JSON.parse(await readFile(join(out, "manifest.json"), "utf8")));
    cap = CapabilityReport.parse(JSON.parse(await readFile(join(out, "capabilities.json"), "utf8")));
    expect(r.fileCount).toBe(files.length);
  });
  afterAll(async () => {
    if (out) await rm(join(out, ".."), { recursive: true, force: true });
  });

  it("writes the gene, transcript, sequence, protein, predicted-model and capability records and nothing that needs a structure or a variant", () => {
    expect(files).toEqual(["capabilities.json", "gene.json", "manifest.json", "predicted-model-AF-P68871-F1.json", "protein-P68871.json", "sequences.json", "transcript.json"]);
    expect(files.filter((f) => /^(structure|contacts|variant|clinvar|residue-mapping)-|\.cif$/.test(f))).toEqual([]);
  });
  it("the capability file says what is missing, in the specification's terms", () => {
    expect(cap.experimentalStructure.available).toBe(false);
    expect(cap.experimentalStructure.reason).toMatch(/^no experimental structure selected in the gene specification/);
    expect(cap.experimentalStructure.reason).toMatch(/none is shown/);
    expect(cap.verifiedResidueMapping.available).toBe(false);
    expect(cap.verifiedResidueMapping.reason).toMatch(/no experimental structure selected in the gene specification/);
    expect(cap.variantHighlight.available).toBe(false);
    expect(cap.variantHighlight.reason).toBe("no reference variant selected");
    for (const k of ["experimentalStructure", "verifiedResidueMapping", "variantHighlight"] as const) expect(cap[k].evidenceCategory).toBe(6);
    expect(cap.transcriptView.available).toBe(true);
    expect(cap.proteinView.available).toBe(true);
    expect(cap.predictedStructure).toMatchObject({ available: true, evidenceCategory: 3 });
    expect(cap.derivedFrom).toEqual(["gene.json", "transcript.json", "sequences.json", "protein-P68871.json", "predicted-model-AF-P68871-F1.json"]);
  });
  it("the manifest is schema-valid, names build-gene.ts, has no failed check and cites no structure, SIFTS or ClinVar source", async () => {
    expect(manifest.datasetId).toBe("hbb-no-structure");
    expect(manifest.generator.script).toBe(`${GENERATOR_SCRIPT} (fixtures)`);
    expect(manifest.validation.filter((v) => v.result === "fail")).toEqual([]);
    expect(manifest.validation.map((v) => v.check)).not.toContain("T23-residue-from-atom-site");
    expect(manifest.validation.map((v) => v.check)).toContain("T32-alphafold-labelled");
    expect([...new Set(manifest.sources.map((s) => s.source))].sort()).toEqual(["alphafold", "ensembl", "hgnc", "uniprot"]);
    expect(manifest.sources.some((s) => /variant_recoder|\/variation\/|\/vep\/|map\/cds|sequence\/region/.test(s.url))).toBe(false);
    expect(manifest.files.map((f) => f.path).sort()).toEqual(files.filter((f) => f !== "manifest.json"));
    const seqs = JSON.parse(await readFile(join(out, "sequences.json"), "utf8")) as { records: { sequenceKind: string }[] };
    expect(seqs.records.map((r) => r.sequenceKind)).toEqual(["cds", "cdna", "protein"]);
    const prot = Protein.parse(JSON.parse(await readFile(join(out, "protein-P68871.json"), "utf8")));
    expect(prot.xrefs.pdb).toEqual([]);
    expect(prot.features.some((f) => f.type === "Natural variant")).toBe(false);
    expect(prot.provenance.transformations).toContain("natural-variants-dropped-no-variant-selected");
    const gene = Gene.parse(JSON.parse(await readFile(join(out, "gene.json"), "utf8")));
    expect(gene.symbol).toBe(HBB_CONFIG.hgncSymbol);
  });
  it("the same build from in-memory inputs needs none of the variant or structure records", async () => {
    const config = await noStructureSpec();
    const inputs = inputsFor(await loadFixtureInputs("hbb"), config);
    for (const k of ["mmcif", "sifts", "rcsbEntry", "rcsbPolymerEntity", "rcsbAssembly", "variantRecoder", "variation", "vep", "codonMap", "genomicWindow", "clinvar", "clinvarSearch", "clinvarEinfo"] as const) expect(inputs[k], k).toBeUndefined();
    const b = await buildSlice(inputs, config, { now: "2026-11-03T00:00:00Z" });
    expect(b.files.map((f) => f.path).sort()).toEqual(files.filter((f) => f !== "manifest.json"));
    expect(b.summary).toMatchObject({ variant: null, clinvar: null, structure: null, mapping: null, fullChainMapping: null });
  });
  it("a selected structure whose coordinates carry a residue no selected variant explains is refused, not silently shown", async () => {
    // 2HBS carries Val at UniProt position 7 (the HbS residue); with no variant selected that difference is unexplained.
    const config: SliceConfig = { ...(await noStructureSpec()), pdbId: "2HBS" };
    const inputs = inputsFor(await loadFixtureInputs("hbb"), config);
    expect(inputs.mmcif).toBeDefined();
    expect(inputs.variantRecoder).toBeUndefined();
    const e = await buildSlice(inputs, config, { now: "2026-11-03T00:00:00Z" }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ValidationFailedError);
    expect(String((e as Error).message)).toMatch(/T38-full-chain-residue-names/);
  });
  it("a specification that selects a variant or a structure without the matching inputs is refused with the missing input named", async () => {
    const inputs = inputsFor(await loadFixtureInputs("hbb"), await noStructureSpec());
    const e = await buildSlice(inputs, HBB_CONFIG, { now: "2026-11-03T00:00:00Z" }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ValidationFailedError);
    expect(String((e as Error).message)).toMatch(/variantRecoder is required by the gene specification/);
  });
});

describe("no gene is hardcoded in the packages' sources (plan §9)", () => {
  /** Known HBB identifiers; the only place they may appear in code is the in-code mirror of data/specs/hbb.json. */
  const IDENTIFIERS = ["ENSG00000244734", "ENST00000335295", "P68871", "2HBS", "rs334", '"HBB"'];
  const ALLOWED: Record<string, string> = {
    "packages/scientific-core/src/slice/types.ts": "HBB_CONFIG, the in-code mirror of data/specs/hbb.json (a test proves they are equal)",
    "packages/ai-planning/src/fallback.ts": "the Phase 7 fallback planner's HBB cue tables (rs334, 2HBS); generalised with the app in P9.3, outside the builder",
  };
  const stripComments = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\w])\/\/.*$/gm, "$1");
  const tsFiles = async (dir: string): Promise<string[]> => {
    const out: string[] = [];
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) out.push(...(await tsFiles(p)));
      else if (e.name.endsWith(".ts")) out.push(p);
    }
    return out;
  };
  it("no file under packages/*/src names an HBB identifier in code, outside the allowed files", async () => {
    const pkgs = (await readdir(join(REPO_ROOT, "packages"), { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => join(REPO_ROOT, "packages", e.name, "src"));
    const offenders: string[] = [];
    const allowedSeen = new Set<string>();
    for (const src of pkgs.filter((p) => existsSync(p))) {
      for (const f of await tsFiles(src)) {
        const code = stripComments(await readFile(f, "utf8"));
        const hits = IDENTIFIERS.filter((id) => code.includes(id));
        if (hits.length === 0) continue;
        const rel = relative(REPO_ROOT, f);
        if (ALLOWED[rel]) allowedSeen.add(rel);
        else offenders.push(`${rel}: ${hits.join(", ")}`);
      }
    }
    expect(offenders).toEqual([]);
    // The allow-list is exact: an entry that no longer matches must be removed.
    expect([...allowedSeen].sort()).toEqual(Object.keys(ALLOWED).sort());
  });
});
