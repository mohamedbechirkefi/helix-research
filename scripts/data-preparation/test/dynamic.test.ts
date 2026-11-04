// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Phase 9, P9.3.1 (plan section 16): dynamic mode. The resolver's decisions and refusals on
 * hand-made HGNC responses (no live call), the configuration a resolution gives the builder, the
 * five dynamic builds from their recorded fixtures (data/fixtures/dynamic/<symbol>/) with the
 * capability assertions of rule 5, and the manifest's mode.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HttpClient, type HgncRecord, parseHgnc, parseJsonBody } from "@helix/data-adapters";
import { DYNAMIC_FIXTURE_GENES, DYNAMIC_GENERATOR_SCRIPT, DYNAMIC_SOURCES, DYNAMIC_STEPS, DynamicResolutionError, type SliceBuild, buildManifest, buildSlice, decideDynamicResolution, dynamicConfig, dynamicDatasetId, inputsFor, resolveDynamicGene } from "@helix/scientific-core";
import { CapabilityReport, DatasetManifest } from "@helix/shared-types";
import { fixtureIndex, loadFixtureInputs } from "../lib/fixtures.ts";
import { REPO_ROOT } from "../lib/node-env.ts";

// ---------------------------------------------------------------- hand-made HGNC answers

const doc = (over: Record<string, unknown> = {}) => ({ hgnc_id: "HGNC:11998", symbol: "TP53", name: "tumor protein p53", status: "Approved", alias_symbol: ["p53", "LFS1"], prev_symbol: [], ensembl_gene_id: "ENSG00000141510", uniprot_ids: ["P04637"], mane_select: ["ENST00000269305.9", "NM_000546.6"], locus_type: "gene with protein product", ...over });
const answer = (docs: unknown[]) => JSON.stringify({ response: { numFound: docs.length, docs } });
const record = (over: Record<string, unknown> = {}): HgncRecord => parseHgnc(JSON.parse(answer([doc(over)])))[0]!;

/** An HttpClient whose fetch answers HGNC URLs from a table (a URL not in the table is a 500). */
function hgncClient(table: Record<string, string>, calls: string[] = []): HttpClient {
  const fetchImpl: typeof fetch = (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);
    const body = table[url];
    return Promise.resolve(body === undefined ? new Response("boom", { status: 500 }) : new Response(body, { status: 200, headers: { "content-type": "application/json;charset=utf-8" } }));
  };
  return new HttpClient({ fetch: fetchImpl, maxAttempts: 1 });
}
const SYMBOL = (s: string) => `https://rest.genenames.org/fetch/symbol/${s}`;
const ALIAS = (s: string) => `https://rest.genenames.org/fetch/alias_symbol/${s}`;

describe("dynamic mode: the resolver (plan section 16 rule 1)", () => {
  it("an approved symbol resolves by symbol in one HGNC request; the configuration has no structure, no variant, no pathways, no associations", async () => {
    const calls: string[] = [];
    const r = await resolveDynamicGene(hgncClient({ [SYMBOL("TP53")]: answer([doc()]) }, calls), "TP53");
    expect(r).toMatchObject({ symbol: "TP53", hgncId: "HGNC:11998", ensemblGeneId: "ENSG00000141510", uniprotAccession: "P04637", matchedBy: "symbol" });
    expect(calls).toEqual([SYMBOL("TP53")]);
    expect(r.responses.map((x) => x.source)).toEqual(["hgnc"]);
    const c = dynamicConfig(r.symbol, r);
    expect(c).toEqual({ datasetId: "dynamic-tp53", description: expect.stringContaining("dynamic set, built at request time from live retrievals, not curated"), ensemblGeneId: "ENSG00000141510", hgncSymbol: "TP53", uniprotAccession: "P04637", genomicWindowFlank: 20, contactCutoffAngstrom: 4.5, includeAlphafold: true, pathways: false, associations: false, questions: [], mode: "dynamic" });
    expect(c.pdbId).toBeUndefined();
    expect(c.variant).toBeUndefined();
    expect(dynamicDatasetId("HBA1")).toBe("dynamic-hba1");
  });
  it("an alias resolves after the symbol fetch returned no document (two requests), case-insensitively", async () => {
    const calls: string[] = [];
    const r = await resolveDynamicGene(hgncClient({ [SYMBOL("p53")]: answer([]), [ALIAS("p53")]: answer([doc()]) }, calls), "p53");
    expect(r).toMatchObject({ symbol: "TP53", matchedBy: "alias" });
    expect(calls).toEqual([SYMBOL("p53"), ALIAS("p53")]);
  });
  it("refuses, with the reason: unknown, ambiguous alias, not approved, not protein-coding, no Ensembl id, no or several UniProt accessions, a malformed query", async () => {
    const refusal = async (query: string, table: Record<string, string>) => {
      try {
        await resolveDynamicGene(hgncClient(table), query);
      } catch (e) {
        expect(e).toBeInstanceOf(DynamicResolutionError);
        return { code: (e as DynamicResolutionError).code, message: (e as Error).message };
      }
      throw new Error(`${query} resolved`);
    };
    expect(await refusal("NOPE1", { [SYMBOL("NOPE1")]: answer([]), [ALIAS("NOPE1")]: answer([]) })).toEqual({ code: "not-found", message: '"NOPE1" is not an approved HGNC symbol and no HGNC record lists it as an alias.' });
    const two = await refusal("SHARED", { [SYMBOL("SHARED")]: answer([]), [ALIAS("SHARED")]: answer([doc({ alias_symbol: ["SHARED"] }), doc({ hgnc_id: "HGNC:2", symbol: "OTHER", alias_symbol: ["SHARED"] })]) });
    expect(two.code).toBe("ambiguous");
    expect(two.message).toBe('"SHARED" is an alias of 2 HGNC records (TP53, HGNC:11998; OTHER, HGNC:2); type the approved symbol.');
    expect(await refusal("TP53", { [SYMBOL("TP53")]: answer([doc({ status: "Entry Withdrawn" })]) })).toMatchObject({ code: "not-approved", message: 'TP53 (HGNC:11998) has HGNC status "Entry Withdrawn", not Approved.' });
    expect(await refusal("HBBP1", { [SYMBOL("HBBP1")]: answer([doc({ symbol: "HBBP1", hgnc_id: "HGNC:4835", locus_type: "pseudogene" })]) })).toMatchObject({ code: "not-protein-coding", message: 'HBBP1 (HGNC:4835) is not a gene with a protein product (HGNC locus type "pseudogene"); dynamic mode builds protein-coding genes only.' });
    expect(await refusal("TP53", { [SYMBOL("TP53")]: answer([doc({ locus_type: undefined })]) })).toMatchObject({ code: "not-protein-coding", message: expect.stringContaining("locus type absent") });
    expect(await refusal("TP53", { [SYMBOL("TP53")]: answer([doc({ ensembl_gene_id: undefined })]) })).toMatchObject({ code: "no-ensembl-id" });
    expect(await refusal("TP53", { [SYMBOL("TP53")]: answer([doc({ uniprot_ids: [] })]) })).toMatchObject({ code: "no-uniprot", message: "TP53 (HGNC:11998) has no UniProt accession in its HGNC record." });
    expect(await refusal("TP53", { [SYMBOL("TP53")]: answer([doc({ uniprot_ids: ["P04637", "Q00001"] })]) })).toMatchObject({ code: "several-uniprot", message: "TP53 (HGNC:11998) has 2 UniProt accessions in its HGNC record (P04637, Q00001); dynamic mode needs one." });
    expect(await refusal("p53 OR 1=1", {})).toMatchObject({ code: "invalid-query" });
    expect(await refusal("X", {})).toMatchObject({ code: "invalid-query" });
    // An alias refusal names the alias and the record it reached.
    expect(await refusal("psd", { [SYMBOL("psd")]: answer([]), [ALIAS("psd")]: answer([doc({ symbol: "PSG", hgnc_id: "HGNC:3", alias_symbol: ["psd"], locus_type: "pseudogene" })]) })).toMatchObject({ code: "not-protein-coding", message: expect.stringContaining('"psd" (alias of PSG, HGNC:3)') });
  });
  it("a failing HGNC request is the client's error, not a resolution", async () => {
    await expect(resolveDynamicGene(hgncClient({}), "TP53")).rejects.toMatchObject({ code: "http-status" });
  });
  it("the pure decision: the symbol wins over an alias; several alias hits are ambiguous", () => {
    const a = record();
    const b = record({ hgnc_id: "HGNC:2", symbol: "OTHER", alias_symbol: ["TP53"] });
    expect(decideDynamicResolution("TP53", a, [b])).toMatchObject({ symbol: "TP53", matchedBy: "symbol" });
    expect(decideDynamicResolution("tp53", null, [b])).toMatchObject({ symbol: "OTHER", matchedBy: "alias" });
    const c = record({ hgnc_id: "HGNC:9", symbol: "ALT", alias_symbol: ["TP53"] });
    expect(() => decideDynamicResolution("TP53", null, [b, c])).toThrow(/is an alias of 2 HGNC records \(OTHER, HGNC:2; ALT, HGNC:9\)/);
  });
});

// ---------------------------------------------------------------- the five dynamic builds from their fixtures

interface Built {
  symbol: string;
  build: SliceBuild;
  manifest: DatasetManifest;
  caps: CapabilityReport;
  file: (path: string) => unknown;
}

async function buildFromFixtures(symbol: string): Promise<Built> {
  const set = `dynamic/${symbol.toLowerCase()}`;
  const inputs = await loadFixtureInputs(set);
  // The resolution reads the recorded HGNC answer (the same request the resolver and input H1 make for a symbol).
  const docs = parseHgnc(parseJsonBody(inputs.hgnc.body), inputs.hgnc.url);
  const resolved = decideDynamicResolution(symbol, docs.find((d) => d.symbol.toLowerCase() === symbol.toLowerCase()) ?? null, []);
  const config = dynamicConfig(resolved.symbol, resolved);
  const now = "2026-11-04T12:00:00Z";
  const build = await buildSlice(inputsFor(inputs, config), config, { now });
  const manifest = await buildManifest(build, config, { generatedAt: now, script: DYNAMIC_GENERATOR_SCRIPT, gitCommit: null, gitDirty: null, node: "test", assembly: build.sources.find((s) => s.assembly)?.assembly ?? "unknown", mode: "dynamic" });
  const file = (path: string): unknown => JSON.parse(build.files.find((f) => f.path === path)!.content);
  return { symbol: resolved.symbol, build, manifest, caps: CapabilityReport.parse(file("capabilities.json")), file };
}

describe("dynamic mode: the five builds from their recorded fixtures (plan section 16 rule 5)", () => {
  it("the five genes were recorded once, under data/fixtures/dynamic/<symbol>/, from the four dynamic sources only", async () => {
    expect([...DYNAMIC_FIXTURE_GENES]).toEqual(["TP53", "EGFR", "INS", "APOE", "HBA1"]);
    for (const g of DYNAMIC_FIXTURE_GENES) {
      const idx = await fixtureIndex(`dynamic/${g.toLowerCase()}`);
      const sources = new Set(Object.values(idx.inputs).map((e) => e!.source));
      expect([...sources].sort(), g).toEqual([...DYNAMIC_SOURCES].sort());
      expect(Object.keys(idx.inputs).sort(), g).toEqual(["alphafoldModel", "alphafoldPrediction", "cdna", "cds", "ensemblAssembly", "ensemblInfoData", "ensemblProtein", "geneLookup", "hgnc", "transcriptLookup", "uniprot"]);
      for (const e of Object.values(idx.inputs)) expect(e!.path, g).toMatch(new RegExp(`^data/fixtures/dynamic/${g.toLowerCase()}/`));
      const text = await readFile(join(REPO_ROOT, "data/fixtures/dynamic", g.toLowerCase(), "index.json"), "utf8");
      expect(text).toMatch(/Test inputs, not a curated set/);
    }
  });
  for (const g of DYNAMIC_FIXTURE_GENES) {
    it(`${g}: builds with no failed check; the capability report says experimentalStructure unavailable with the dynamic reason, predictedStructure as found, pathwayView and associationView "not requested in dynamic mode"`, async () => {
      const b = await buildFromFixtures(g);
      expect(b.build.validation.filter((v) => v.result === "fail")).toEqual([]);
      expect(b.caps.symbol).toBe(g);
      expect(b.caps.experimentalStructure.available).toBe(false);
      expect(b.caps.experimentalStructure.reason).toMatch(/^no experimental structure selected in dynamic mode; \d+ entr(y|ies) cross-referenced \(e\.g\. [0-9][A-Z0-9]{3}, [^)]+\); there is no reviewed selection and no candidate check at request time, so none is shown$/);
      expect(b.caps.predictedStructure.available).toBe(true);
      expect(b.caps.predictedStructure.reason).toMatch(/^AF-[A-Z0-9]+-F1 v\d+; computational prediction, never shown as experimental$/);
      expect(b.caps.pathwayView).toEqual({ available: false, reason: "not requested in dynamic mode", evidenceCategory: 6 });
      expect(b.caps.associationView).toEqual({ available: false, reason: "not requested in dynamic mode", evidenceCategory: 6 });
      expect(b.caps.variantHighlight).toMatchObject({ available: false, reason: "no reference variant selected" });
      expect(b.caps.verifiedResidueMapping).toMatchObject({ available: false, reason: "no experimental structure selected in dynamic mode, so there is nothing to map onto" });
      expect(b.caps.transcriptView.available).toBe(true);
      expect(b.caps.proteinView.available).toBe(true);
      // FAAH2's shape: the gene, transcript, sequences, protein, predicted model and capability records; nothing else.
      expect(b.build.files.map((f) => f.recordKind).sort()).toEqual(["capabilities", "gene", "predicted-model", "protein", "sequence-set", "transcript"]);
      expect(b.build.files.some((f) => f.path === "questions.json")).toBe(false);
      expect([...new Set(b.build.sources.map((s) => s.source))].sort()).toEqual([...DYNAMIC_SOURCES].sort());
    });
  }
  it("the manifest of a dynamic build: generator.mode dynamic, script dynamic (browser), the dataset id dynamic-<symbol>, the description naming the mode", async () => {
    const b = await buildFromFixtures("TP53");
    expect(b.manifest.generator).toEqual({ script: DYNAMIC_GENERATOR_SCRIPT, gitCommit: null, gitDirty: null, node: "test", mode: "dynamic" });
    expect(b.manifest.datasetId).toBe("dynamic-tp53");
    expect(b.manifest.description).toMatch(/^TP53 \(HGNC:11998\) dynamic set, built at request time from live retrievals, not curated: gene ENSG00000141510, MANE Select transcript, sequences, UniProt P04637, the AlphaFold prediction record; no experimental structure selected, no variant, no pathways, no associations\.$/);
    expect(b.manifest.files.map((f) => f.recordKind).sort()).toEqual(["capabilities", "gene", "predicted-model", "protein", "sequence-set", "transcript"]);
    expect(b.manifest.sources.every((s) => DYNAMIC_SOURCES.includes(s.source as (typeof DYNAMIC_SOURCES)[number]))).toBe(true);
    expect(b.manifest.sources.every((s) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(s.retrievedAt))).toBe(true);
    // A curated manifest carries no mode key (byte-identical to before).
    const curated = await buildManifest(b.build, { ...dynamicConfig("TP53", { hgncId: "HGNC:11998", ensemblGeneId: "ENSG00000141510", uniprotAccession: "P04637" }), mode: undefined }, { generatedAt: "2026-11-04T12:00:00Z", script: "x", gitCommit: null, gitDirty: null, node: "test", assembly: "GRCh38" });
    expect("mode" in curated.generator).toBe(false);
    const hbb = DatasetManifest.parse(JSON.parse(await readFile(join(REPO_ROOT, "data/curated/hbb/manifest.json"), "utf8")));
    expect("mode" in hbb.generator).toBe(false);
  });
  it("the two generalisations the recording exposed: INS (no Chain feature, peptides) passes T15 with its processing stated; HBA1 (an entry shared with HBA2) passes the MANE cross-reference check with the other gene's cross-reference stated", async () => {
    const ins = await buildFromFixtures("INS");
    const t15 = ins.build.validation.find((v) => v.check === "T15-initiator-met-and-chain")!;
    expect(t15.result).toBe("pass");
    expect(t15.detail).toBe("no Initiator methionine feature (translated numbering is the processed numbering); no Chain feature; processing annotated as Signal 1-24, Peptide 25-54 (Insulin B chain), Propeptide 57-87 (C peptide), Peptide 90-110 (Insulin A chain), so there is no processed chain and translated numbering is the numbering of record");
    expect((ins.file("protein-P01308.json") as { processedChain: unknown }).processedChain).toBeNull();
    const hba1 = await buildFromFixtures("HBA1");
    const mane = hba1.build.validation.find((v) => v.check === "uniprot-mane-xref")!;
    expect(mane.result).toBe("pass");
    expect(mane.detail).toBe("UniProt MANE-Select ENST00000320868.9 / ENSP00000322421.5 / NM_000558.5; the entry is shared: 1 other MANE-Select cross-reference (ENST00000251595.11 / ENSP00000251595.6 / NM_000517.6) belongs to another gene encoding the same protein");
    // The curated sets' details are unchanged (one cross-reference, a Chain feature): pinned by their own fixture tests.
  });
  it("the step list the app's gauge announces names the requests acquireSlice makes for a dynamic build, in order", async () => {
    const b = await buildFromFixtures("APOE");
    const urls = b.manifest.sources.map((s) => s.source);
    expect(DYNAMIC_STEPS.map((s) => s.id)).toEqual(["resolve", "E1", "E2", "E3", "E4", "E5", "E6", "E7", "U1", "H1", "A1", "A1-model"]);
    expect(urls.filter((u) => u === "ensembl")).toHaveLength(7);
    expect(urls.filter((u) => u === "alphafold")).toHaveLength(2);
    expect(urls.filter((u) => u === "uniprot")).toHaveLength(1);
    expect(urls.filter((u) => u === "hgnc")).toHaveLength(1);
  });
});
