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
import { CapabilityReport, DatasetManifest, DeletionVariant, Gene, Protein, QuestionsRecord, ResidueContacts, ResidueMapping, Structure, Variant } from "@helix/shared-types";
import { GENERATOR_SCRIPT, buildGene, parseBuildArgs, readSpec } from "../lib/build-gene.ts";
import { loadFixtureInputs } from "../lib/fixtures.ts";
import { REPO_ROOT } from "../lib/node-env.ts";

/** The HBB specification with the structure and variant selections removed: same gene, same UniProt entry. */
async function noStructureSpec(): Promise<SliceConfig> {
  const json = JSON.parse(await readFile(join(REPO_ROOT, "data/specs/hbb.json"), "utf8")) as Record<string, unknown>;
  const { pdbId, variant, notes, ...rest } = json;
  expect([pdbId, { kind: "substitution", ...(variant as object) }, typeof notes]).toEqual(["2HBS", HBB_CONFIG.variant, "string"]);
  return loadGeneSpec({ ...rest, datasetId: "hbb-no-structure", description: "HBB with no experimental structure and no reference variant selected (test specification).", notes: "Built by the dataset tests from the HBB fixtures; never a curated set." });
}

describe("generic builder: data/specs and the command line", () => {
  it("readSpec('hbb') is HBB_CONFIG and parseBuildArgs reads the documented flags", async () => {
    expect(await readSpec("hbb")).toStrictEqual(HBB_CONFIG);
    await expect(readSpec("nope")).rejects.toThrow(/no gene specification at data\/specs\/nope\.json/);
    await expect(readSpec("../x")).rejects.toThrow(/not a specification name/);
    expect(parseBuildArgs(["--gene", "hbb", "--fixtures", "--out", "/tmp/x"])).toEqual({ gene: "hbb", mode: "fixtures", outDir: "/tmp/x", recordFixtures: false });
    expect(parseBuildArgs(["--gene", "hbb", "--offline"])).toEqual({ gene: "hbb", mode: "offline", outDir: null, recordFixtures: false });
    expect(parseBuildArgs([])).toEqual({ gene: null, mode: "live", outDir: null, recordFixtures: false });
    expect(parseBuildArgs(["--gene", "hbb", "--record-fixtures"])).toEqual({ gene: "hbb", mode: "live", outDir: null, recordFixtures: true });
    expect(() => parseBuildArgs(["--gene", "hbb", "--record-fixtures", "--fixtures"])).toThrow(/cannot be combined/);
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

  it("writes the gene, transcript, sequence, protein, predicted-model, capability and questions records and nothing that needs a structure or a variant", () => {
    expect(files).toEqual(["capabilities.json", "gene.json", "manifest.json", "predicted-model-AF-P68871-F1.json", "protein-P68871.json", "questions.json", "sequences.json", "transcript.json"]);
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

describe("the CFTR set (P9.2.1): an in-frame deletion built from its recorded fixtures (plan §11)", () => {
  let out: string;
  let files: string[];
  let manifest: DatasetManifest;
  let variant: DeletionVariant;
  beforeAll(async () => {
    const dir = await mkdtemp(join(tmpdir(), "helix-cftr-build-"));
    out = join(dir, "cftr");
    await buildGene({ config: await readSpec("cftr"), mode: "fixtures", outDir: out, log: () => undefined });
    files = (await readdir(out)).sort();
    manifest = DatasetManifest.parse(JSON.parse(await readFile(join(out, "manifest.json"), "utf8")));
    const v = Variant.parse(JSON.parse(await readFile(join(out, "variant-f508del.json"), "utf8")));
    if (v.variantKind !== "deletion") throw new Error("expected a deletion record");
    variant = v;
  });
  afterAll(async () => {
    if (out) await rm(join(out, ".."), { recursive: true, force: true });
  });
  it("the specification selects a deletion by its HGVS c. and no forward allele", async () => {
    const spec = await readSpec("cftr");
    expect(spec.variant).toStrictEqual({ kind: "deletion", slug: "f508del", commonName: "F508del (p.Phe508del)", rsId: "rs113993960", hgvsC: "c.1521_1523del", clinvarUid: "7105" });
    expect(spec.structurePreference).toBe("variant-residue-observed");
    expect(spec.pdbId).toBe("5UAK");
  });
  it("the variant record (rule 2): span c.1521 to c.1523, codons 507 ATC to ATT (Ile) and 508 TTT deleted (Phe), p.Phe508del, residue 508", () => {
    expect(variant.variantKind).toBe("deletion");
    expect(variant.deletedSpan).toMatchObject({ cdsStart: 1521, cdsEnd: 1523, length: 3 });
    expect(variant.cdsPosition).toBe(1521);
    expect(variant.affectedCodons.map((c) => [c.number, c.reference, c.afterDeletion, c.referenceAminoAcid, c.aminoAcidAfterDeletion])).toEqual([
      [507, "ATC", "ATT", "I", "I"],
      [508, "TTT", null, "F", null],
    ]);
    expect(variant.proteinChangeComputed).toBe("p.Phe508del");
    expect(variant.residue).toBe(508);
    expect(variant.deletedResidues).toEqual([{ position: 508, aminoAcid: "F" }]);
    expect(variant.numbering).toMatchObject({ translatedPosition: 508, maturePosition: null, matureLabel: null, translatedLabel: "p.Phe508del (translated numbering, Met = 1)" });
    expect(variant.allele).toEqual({ reference: "CTT", alternate: "", strand: 1 });
    expect(variant.location.end - variant.location.start + 1).toBe(3);
    expect(variant.location.start).toBe(variant.deletedSpan.genomic.start);
    // The deleted span is the third base of codon 507 and the first two of codon 508, as the plan says.
    expect(variant.affectedCodons[0]!.genomic.end).toBe(variant.location.start);
    expect(variant.affectedCodons[1]!.genomic.start).toBe(variant.location.start + 1);
    expect(variant.hgvs.coding).toContain("ENST00000003084.11:c.1521_1523del");
    expect(variant.hgvs.protein.every((p) => p.endsWith(":p.Phe508del"))).toBe(true);
    expect(variant.consequence?.terms).toEqual(["inframe_deletion"]);
    expect(variant.provenance.transformations).toContain("apply-deletion-to-cds");
    expect(variant.clinvar?.accession).toBe("VCV000007105");
  });
  it("the checks: the deletion branch and T40 pass, nothing fails, and the substitution-only checks did not run", () => {
    expect(manifest.validation.filter((v) => v.result === "fail")).toEqual([]);
    const ids = manifest.validation.map((v) => v.check);
    for (const id of ["T40-variant-residue-observed", "T13-rsid-deletion-allele", "T08-deleted-span", "T09-forward-and-coding-bases", "T11-deletion-in-frame", "T12-hgvsp-agrees", "T12-vep-agrees", "T18-hgvsp-equals-uniprot-position", "T14-clinvar-record", "T23-residue-from-atom-site", "T28-contacts-computed"]) expect(ids, id).toContain(id);
    for (const id of ["T13-rsid-multiallelic", "T08-codon-span", "T09-forward-and-coding-base", "T11-codon-change"]) expect(ids, id).not.toContain(id);
    const t40 = manifest.validation.find((v) => v.check === "T40-variant-residue-observed")!;
    expect(t40.result).toBe("pass");
    expect(t40.detail).toMatch(/A observed \(label 508, auth 508, PHE\)/);
    expect(manifest.validation.find((v) => v.check === "T23-residue-from-atom-site")!.detail).toMatch(/structure carries the reference residue/);
  });
  it("the structure, mapping and contacts: 5UAK observes Phe 508 on chain A; the contacts name the residue as deleted", async () => {
    const s = Structure.parse(JSON.parse(await readFile(join(out, "structure-5UAK.json"), "utf8")));
    expect([s.entryId, s.method, s.origin]).toEqual(["5UAK", "ELECTRON MICROSCOPY", "experimental"]);
    expect(s.resolutionAngstrom).not.toBeNull();
    const m = ResidueMapping.parse(JSON.parse(await readFile(join(out, "residue-mapping-f508del-5UAK.json"), "utf8")));
    expect([m.uniprotPosition, m.uniprotResidue, m.maturePosition]).toEqual([508, "F", null]);
    expect(m.residues.map((r) => [r.labelAsymId, r.labelSeqId, r.authAsymId, r.authSeqId, r.compId])).toEqual([["A", 508, "A", "508", "PHE"]]);
    const c = ResidueContacts.parse(JSON.parse(await readFile(join(out, "contacts-f508del-5UAK.json"), "utf8")));
    expect(c.scope).toMatch(/own chain included/);
    expect(c.chains).toHaveLength(1);
    expect(c.chains[0]!.contacts.length).toBeGreaterThan(0);
    expect(c.chains[0]!.contacts.every((x) => Math.abs(x.authSeqId - 508) > 1)).toBe(true);
    expect(c.evidence[0]!.statement).toMatch(/the residue deleted in F508del/);
  });
  it("the questions record (rule 6) is listed in the manifest with its hash and carries CFTR's four questions and bridge question", async () => {
    expect(files).toContain("questions.json");
    const q = QuestionsRecord.parse(JSON.parse(await readFile(join(out, "questions.json"), "utf8")));
    expect(q).toMatchObject({ kind: "questions", symbol: "CFTR", derivedFrom: ["capabilities.json"], bridgeQuestion: "See the F508del mutation on the protein." });
    expect(q.questions.map((x) => x.requires)).toEqual([["variantHighlight", "experimentalStructure"], ["variantHighlight"], ["variantHighlight", "experimentalStructure"], ["variantHighlight"]]);
    const entry = manifest.files.find((f) => f.path === "questions.json")!;
    expect(entry.recordKind).toBe("questions");
    expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);
    const cap = CapabilityReport.parse(JSON.parse(await readFile(join(out, "capabilities.json"), "utf8")));
    expect(cap.derivedFrom).not.toContain("questions.json");
    for (const k of ["transcriptView", "proteinView", "experimentalStructure", "predictedStructure", "verifiedResidueMapping", "variantHighlight"] as const) expect(cap[k].available, k).toBe(true);
  });
  it("a frameshift in the specification is refused before anything is fetched", async () => {
    const json = JSON.parse(await readFile(join(REPO_ROOT, "data/specs/cftr.json"), "utf8")) as { variant: Record<string, unknown> };
    expect(() => loadGeneSpec({ ...json, variant: { ...json.variant, hgvsC: "c.1521_1522del" } })).toThrow(/frameshift is out of scope/);
  });
});

describe("no gene is hardcoded in the packages' sources (plan §9)", () => {
  /** Known HBB identifiers; the only place they may appear in code is the in-code mirror of data/specs/hbb.json. */
  const IDENTIFIERS = ["ENSG00000244734", "ENST00000335295", "P68871", "2HBS", "rs334", '"HBB"', "ENSG00000001626", "P13569", "rs113993960", "5UAK", '"CFTR"'];
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
