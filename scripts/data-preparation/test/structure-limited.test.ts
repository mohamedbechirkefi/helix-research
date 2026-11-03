// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Phase 9, P9.2.4: the structure-limited gene finder (sampler, verdicts, the walk on
 * hand-made records; no live call), the fixture recorder's pure parts, and the recorded
 * set itself (data/specs/faah2.json built from data/fixtures/faah2/).
 */
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type EnsemblGeneRaw, type HgncRecord, NotFoundError, ProprietaryContentError, type UniprotEntry, findProprietaryIdentifiers } from "@helix/data-adapters";
import type { RawRecord } from "@helix/scientific-core";
import { CapabilityReport, DatasetManifest, Gene, PredictedModel, Protein } from "@helix/shared-types";
import { GENERATOR_SCRIPT, buildGene, readSpec } from "../lib/build-gene.ts";
import { fixtureFileName, redactRecord } from "../lib/fixture-recorder.ts";
import { fixtureIndex, loadFixtureInputs, readManifest } from "../lib/fixtures.ts";
import { REPO_ROOT } from "../lib/node-env.ts";
import { DEFAULT_SEED, HGNC_ID_MAX, ensemblVerdict, findStructureLimited, firstIds, hgncVerdict, mulberry32, sampleIds, uniprotVerdict } from "../lib/structure-limited.ts";

// ---------------------------------------------------------------- hand-made records

function hgnc(over: Partial<HgncRecord> = {}): HgncRecord {
  return { hgncId: "HGNC:1", symbol: "GENE1", name: "gene one", status: "Approved", aliases: [], previousSymbols: [], ensemblGeneId: "ENSG00000000001", ncbiGeneId: null, uniprotIds: ["P12345"], maneSelect: ["ENST00000000001.1", "NM_000001.1"], location: "1p1", locusType: "gene with protein product", ...over };
}
function uniprot(over: Partial<UniprotEntry> = {}): UniprotEntry {
  return { accession: "P12345", entryName: "GENE1_HUMAN", reviewed: true, organism: { scientificName: "Homo sapiens", taxonId: 9606 }, entryVersion: 1, sequenceVersion: 1, sequence: "MA", length: 2, md5: "x", crc64: "y", features: [], maneSelect: null, ensembl: [], pdb: [], comments: [], ...over };
}
function transcript(id: string, mane: boolean, canonical = mane): EnsemblGeneRaw["Transcript"][number] {
  return { id, version: 1, display_name: "", biotype: "protein_coding", is_canonical: canonical ? 1 : 0, MANE: mane ? [{ type: "MANE_Select", refseq_match: "NM_000001.1" }] : [], assembly_name: "GRCh38", seq_region_name: "1", start: 1, end: 100, strand: 1, Exon: [], UTR: [] };
}
function ensemblGene(over: Partial<EnsemblGeneRaw> = {}): EnsemblGeneRaw {
  return { id: "ENSG00000000001", version: 1, display_name: "GENE1", description: null, biotype: "protein_coding", assembly_name: "GRCh38", seq_region_name: "1", start: 1, end: 100, strand: 1, Transcript: [transcript("ENST00000000001", true), transcript("ENST00000000002", false)], ...over };
}

describe("finder: the sampler is deterministic", () => {
  it("the same seed gives the same first ten ids; the default seed's first ten are pinned", () => {
    expect(firstIds(DEFAULT_SEED, 10)).toEqual(firstIds(DEFAULT_SEED, 10));
    expect(firstIds(DEFAULT_SEED, 10)).toEqual([14563, 32768, 46779, 29444, 28595, 52199, 3715, 44138, 26440, 29750]);
    expect(firstIds(7, 10)).toEqual([703, 3718, 58615, 41942, 31287, 24332, 27974, 14396, 33200, 43790]);
    expect(firstIds(7, 10)).not.toEqual(firstIds(DEFAULT_SEED, 10));
  });
  it("ids are in 1..60000, without replacement, and a small range is exhausted exactly once", () => {
    const ids = firstIds(DEFAULT_SEED, 500);
    expect(new Set(ids).size).toBe(500);
    expect(ids.every((n) => Number.isInteger(n) && n >= 1 && n <= HGNC_ID_MAX)).toBe(true);
    expect([...sampleIds(3, 20)].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_x, i) => i + 1));
    const r = mulberry32(1);
    const xs = [r(), r(), r()];
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(new Set(xs).size).toBe(3);
  });
});

describe("finder: the three verdicts on hand-made records", () => {
  it("HGNC: approved protein-coding gene with one UniProt id, a MANE Select and an Ensembl id passes; each missing condition is the reason", () => {
    expect(hgncVerdict([hgnc()])).toMatchObject({ pass: true });
    expect(hgncVerdict([])).toEqual({ pass: false, reason: "unused HGNC id" });
    expect(hgncVerdict([hgnc(), hgnc()]).reason).toMatch(/2 records/);
    expect(hgncVerdict([hgnc({ status: "Entry Withdrawn" })]).reason).toBe("HGNC status Entry Withdrawn");
    expect(hgncVerdict([hgnc({ locusType: "pseudogene" })]).reason).toBe("locus_type pseudogene");
    expect(hgncVerdict([hgnc({ locusType: null })]).reason).toBe("locus_type absent");
    expect(hgncVerdict([hgnc({ uniprotIds: [] })]).reason).toBe("0 UniProt ids");
    expect(hgncVerdict([hgnc({ uniprotIds: ["P1", "P2"] })]).reason).toBe("2 UniProt ids");
    expect(hgncVerdict([hgnc({ maneSelect: [] })]).reason).toBe("no mane_select");
    expect(hgncVerdict([hgnc({ ensemblGeneId: null })]).reason).toBe("no ensembl_gene_id");
  });
  it("UniProt: reviewed with no PDB cross-reference passes; unreviewed or any PDB entry skips", () => {
    expect(uniprotVerdict(uniprot())).toMatchObject({ pass: true });
    expect(uniprotVerdict(uniprot({ reviewed: false })).reason).toBe("UniProt entry not reviewed");
    expect(uniprotVerdict(uniprot({ pdb: [{ id: "1ABC", method: "X-ray", resolution: "2.0 A", chains: "A=1-2" }] })).reason).toBe("1 PDB cross-reference");
    expect(uniprotVerdict(uniprot({ pdb: [{ id: "1ABC", method: "", resolution: null, chains: "" }, { id: "2ABC", method: "", resolution: null, chains: "" }] })).reason).toBe("2 PDB cross-references");
  });
  it("Ensembl: protein_coding with a MANE Select under the builder's rule passes; other biotypes, canonical-only and ambiguous genes skip", () => {
    expect(ensemblVerdict(ensemblGene())).toEqual({ pass: true, reason: "Ensembl: protein_coding, MANE Select ENST00000000001.1", transcript: "ENST00000000001.1" });
    expect(ensemblVerdict(ensemblGene({ biotype: "lncRNA" })).reason).toBe("Ensembl biotype lncRNA");
    expect(ensemblVerdict(ensemblGene({ Transcript: [transcript("ENST00000000001", false, true), transcript("ENST00000000002", false)] })).reason).toMatch(/rule ensembl_canonical_not_mane/);
    expect(ensemblVerdict(ensemblGene({ Transcript: [transcript("ENST00000000001", false), transcript("ENST00000000002", false)] })).reason).toMatch(/^transcript selection: .*neither a MANE Select nor a single Ensembl canonical/);
    expect(ensemblVerdict(ensemblGene({ Transcript: [] })).reason).toMatch(/^transcript selection: .*no transcripts/);
  });
});

describe("finder: the walk on fake adapters (no live call)", () => {
  /** Ids 1..12 in a tiny range; the sampler's order for seed 5 over 12 ids decides who comes first. */
  const byId: Record<number, HgncRecord[]> = {
    1: [],
    2: [hgnc({ hgncId: "HGNC:2", symbol: "PSEUDO2", locusType: "pseudogene" })],
    3: [hgnc({ hgncId: "HGNC:3", symbol: "PASS3", uniprotIds: ["P00003"], ensemblGeneId: "ENSG00000000003" })],
    4: [hgnc({ hgncId: "HGNC:4", symbol: "PDB4", uniprotIds: ["P00004"], ensemblGeneId: "ENSG00000000004" })],
    5: [hgnc({ hgncId: "HGNC:5", symbol: "PASS5", uniprotIds: ["P00005"], ensemblGeneId: "ENSG00000000005" })],
    6: [hgnc({ hgncId: "HGNC:6", symbol: "GONE6", uniprotIds: ["P00006"], ensemblGeneId: "ENSG00000000006" })],
    7: [hgnc({ hgncId: "HGNC:7", symbol: "PASS7", uniprotIds: ["P00007"], ensemblGeneId: "ENSG00000000007" })],
    8: [hgnc({ hgncId: "HGNC:8", symbol: "NOMANE8", uniprotIds: ["P00008"], ensemblGeneId: "ENSG00000000008" })],
    9: [hgnc({ hgncId: "HGNC:9", symbol: "PASS9", uniprotIds: ["P00009"], ensemblGeneId: "ENSG00000000009" })],
    10: [hgnc({ hgncId: "HGNC:10", symbol: "TREMBL10", uniprotIds: ["P00010"], ensemblGeneId: "ENSG00000000010" })],
    11: [hgnc({ hgncId: "HGNC:11", symbol: "WITHDRAWN11", status: "Entry Withdrawn" })],
    12: [hgnc({ hgncId: "HGNC:12", symbol: "PASS12", uniprotIds: ["P00012"], ensemblGeneId: "ENSG00000000012" })],
  };
  const calls: string[] = [];
  const adapters = {
    hgncId: async (n: number) => (calls.push(`hgnc:${n}`), { data: byId[n] ?? [] }),
    uniprotEntry: async (a: string) => {
      calls.push(`uniprot:${a}`);
      if (a === "P00006") throw new NotFoundError(`https://rest.uniprot.org/uniprotkb/${a}.json`, "");
      return { data: uniprot({ accession: a, reviewed: a !== "P00010", pdb: a === "P00004" ? [{ id: "4ABC", method: "", resolution: null, chains: "" }] : [] }), release: "2026_03", releaseDate: "02-September-2026" };
    },
    ensemblGene: async (id: string) => {
      calls.push(`ensembl:${id}`);
      const mane = id !== "ENSG00000000008";
      return { data: ensemblGene({ id, Transcript: [transcript(`ENST${id.slice(4)}`, mane, true)] }) };
    },
  };
  it("stops at the first pass once three have passed, chooses the first in sample order, reports every id and reason, and fetches nothing it does not need", async () => {
    const order = [...sampleIds(5, 12)];
    const r = await findStructureLimited(adapters, { seed: 5, idMax: 12, maxCandidates: 60, minPassing: 3 });
    const expectedPassOrder = order.filter((n) => [3, 5, 7, 9, 12].includes(n)).slice(0, 3);
    expect(r.passing.map((p) => p.hgncNumber)).toEqual(expectedPassOrder);
    expect(r.chosen!.hgncNumber).toBe(expectedPassOrder[0]);
    expect(r.alternates.map((p) => p.hgncNumber)).toEqual(expectedPassOrder.slice(1));
    expect(r.visited.map((v) => v.hgncNumber)).toEqual(order.slice(0, order.indexOf(expectedPassOrder[2]!) + 1));
    expect(r.stoppedBecause).toMatch(/^3 candidates passed/);
    expect(r.counts).toMatchObject({ visited: r.visited.length, passing: 3, skipped: r.visited.length - 3 });
    expect(Object.values(r.counts.skippedByReason).reduce((a, b) => a + b, 0)).toBe(r.counts.skipped);
    const byNumber = new Map(r.visited.map((v) => [v.hgncNumber, v]));
    const reasonOf = (n: number): string | undefined => byNumber.get(n)?.reason;
    for (const [n, reason, stage] of [
      [1, "unused HGNC id", "hgnc"],
      [2, "locus_type pseudogene", "hgnc"],
      [4, "1 PDB cross-reference", "uniprot"],
      [6, /^not-found: /, "uniprot"],
      [8, /no MANE Select transcript/, "ensembl"],
      [10, "UniProt entry not reviewed", "uniprot"],
      [11, "HGNC status Entry Withdrawn", "hgnc"],
    ] as const) {
      if (!byNumber.has(n)) continue;
      expect(reasonOf(n), String(n)).toMatch(reason);
      expect(byNumber.get(n)!.stage).toBe(stage);
      expect(byNumber.get(n)!.verdict).toBe("skip");
    }
    expect(r.chosen).toMatchObject({ verdict: "pass", pdbCount: 0, stage: "ensembl", locusType: "gene with protein product" });
    expect(r.chosen!.maneSelectTranscript).toMatch(/^ENST\d{11}\.1$/);
    expect(r.releases).toEqual({ uniprot: "2026_03", uniprotDate: "02-September-2026" });
    // A UniProt or Ensembl request is made only after the previous stage passed.
    for (const v of r.visited) {
      expect(calls.includes(`uniprot:${v.uniprotAccession}`), `${v.hgncNumber} uniprot`).toBe(v.stage !== "hgnc");
      expect(calls.includes(`ensembl:${v.ensemblGeneId}`), `${v.hgncNumber} ensembl`).toBe(v.stage === "ensembl");
    }
    expect(calls.filter((c) => c.startsWith("hgnc:"))).toHaveLength(r.visited.length);
  });
  it("the HGNC fetch budget bounds the walk, and the first pass is still the choice when fewer than three pass", async () => {
    const r = await findStructureLimited(adapters, { seed: 5, idMax: 12, maxCandidates: 4, minPassing: 3 });
    expect(r.visited).toHaveLength(4);
    expect(r.visited.map((v) => v.hgncNumber)).toEqual([...sampleIds(5, 12)].slice(0, 4));
    expect(r.stoppedBecause).toBe("4 HGNC fetches made");
    expect(r.chosen?.hgncNumber ?? null).toBe(r.passing[0]?.hgncNumber ?? null);
    const none = await findStructureLimited({ ...adapters, hgncId: async () => ({ data: [] }) }, { seed: 5, idMax: 12, maxCandidates: 3 });
    expect(none).toMatchObject({ chosen: null, alternates: [], counts: { visited: 3, passing: 0, skipped: 3, skippedByReason: { "unused HGNC id": 3 } } });
  });
});

describe("fixture recorder: file names and the Q-H-LIC-1 redaction of one record", () => {
  const raw = (over: Partial<RawRecord>): RawRecord => {
    const body = over.body ?? "{}";
    return { source: "uniprot", url: "https://rest.uniprot.org/uniprotkb/P12345.json", method: "GET", body, sha256: createHash("sha256").update(body).digest("hex"), retrievedAt: "2026-11-03T12:00:00Z", headers: { "content-type": "application/json" }, ...over };
  };
  it("names files from the URL path and query, with the body's extension", () => {
    expect(fixtureFileName(raw({ url: "https://rest.ensembl.org/lookup/id/ENSG00000165591?expand=1;mane=1;content-type=application/json", source: "ensembl" }))).toBe("lookup_id_ENSG00000165591_expand_1_mane_1.json");
    expect(fixtureFileName(raw({ url: "https://rest.ensembl.org/sequence/id/ENST00000374900?type=cds;content-type=text/x-fasta", source: "ensembl", body: ">x\nAC" }))).toBe("sequence_id_ENST00000374900_type_cds.fa");
    expect(fixtureFileName(raw({ url: "https://alphafold.ebi.ac.uk/files/AF-Q6GMR7-F1-model_v6.cif", source: "alphafold", body: "data_x" }))).toBe("files_AF-Q6GMR7-F1-model_v6.cif");
    expect(fixtureFileName(raw({ url: "https://rest.genenames.org/fetch/symbol/FAAH2", source: "hgnc" }))).toBe("fetch_symbol_FAAH2.json");
  });
  it("re-serialises a JSON body only when something was removed, keeps the original sha256, and refuses an identifier it cannot remove", () => {
    const clean = raw({ body: JSON.stringify({ primaryAccession: "P12345", uniProtKBCrossReferences: [{ database: "PDB", id: "1ABC" }] }) });
    const c = redactRecord(clean, "uniprot");
    expect(c.record).toBe(clean);
    expect(c.removed).toEqual([]);
    expect(c.originalSha256).toBe(clean.sha256);
    const dirty = raw({ body: JSON.stringify({ primaryAccession: "P12345", uniProtKBCrossReferences: [{ database: "MIM", id: "600000" }, { database: "PDB", id: "1ABC" }] }) });
    const d = redactRecord(dirty, "uniprot");
    expect(d.removed).toEqual(["$.uniProtKBCrossReferences[0] (object of a proprietary database)"]);
    expect(d.originalSha256).toBe(dirty.sha256);
    expect(d.record.sha256).not.toBe(dirty.sha256);
    expect(d.record.sha256).toBe(createHash("sha256").update(d.record.body).digest("hex"));
    expect(d.record.body).toBe(JSON.stringify({ primaryAccession: "P12345", uniProtKBCrossReferences: [{ database: "PDB", id: "1ABC" }] }, null, 1));
    expect(findProprietaryIdentifiers(JSON.parse(d.record.body))).toEqual([]);
    expect(() => redactRecord(raw({ body: JSON.stringify({ note: "see OMIM entry" }) }), "uniprot")).toThrow(ProprietaryContentError);
    const fasta = raw({ source: "ensembl", url: "https://rest.ensembl.org/sequence/id/ENSP00000364035?content-type=text/x-fasta", body: ">ENSP00000364035.4\nMAEV\n", headers: { "content-type": "text/x-fasta; charset=UTF-8" } });
    expect(redactRecord(fasta, "ensemblProtein").record).toBe(fasta);
    expect(() => redactRecord(raw({ source: "alphafold", url: "https://alphafold.ebi.ac.uk/files/AF-X-F1-model_v6.cif", body: "data_x\n# HGMD note\n", headers: {} }), "alphafoldModel")).toThrow(ProprietaryContentError);
  });
});

describe("the structure-limited set (data/specs/faah2.json) builds from its recorded fixtures", () => {
  let out: string;
  let files: string[];
  let manifest: DatasetManifest;
  let cap: CapabilityReport;
  beforeAll(async () => {
    const dir = await mkdtemp(join(tmpdir(), "helix-faah2-"));
    out = join(dir, "faah2");
    const config = await readSpec("faah2");
    expect(config.pdbId).toBeUndefined();
    expect(config.variant).toBeUndefined();
    const r = await buildGene({ config, mode: "fixtures", outDir: out, log: () => undefined });
    files = (await readdir(out)).sort();
    manifest = DatasetManifest.parse(JSON.parse(await readFile(join(out, "manifest.json"), "utf8")));
    cap = CapabilityReport.parse(JSON.parse(await readFile(join(out, "capabilities.json"), "utf8")));
    expect(r.fileCount).toBe(files.length);
  });
  afterAll(async () => {
    if (out) await rm(join(out, ".."), { recursive: true, force: true });
  });
  it("the fixture set is complete for the specification, every file matches its MANIFEST row, and the redacted records carry the original sha256 in the redaction column", async () => {
    const idx = await fixtureIndex("faah2");
    // Phase 9 (P9.1.2): the set's one Reactome membership adds the version, the memberships, one ancestors and one participants record.
    expect(Object.keys(idx.inputs).sort()).toEqual(["alphafoldModel", "alphafoldPrediction", "cdna", "cds", "ensemblAssembly", "ensemblInfoData", "ensemblProtein", "geneLookup", "hgnc", "opentargetsAssociations", "reactomeAncestors:R-HSA-2142753", "reactomeParticipants:R-HSA-2142753", "reactomePathways", "reactomeVersion", "transcriptLookup", "uniprot"]);
    expect(idx.extra).toEqual({});
    const inputs = await loadFixtureInputs("faah2");
    for (const [name, r] of Object.entries(inputs)) {
      expect(r.url, name).toMatch(/^https:\/\/(rest\.ensembl\.org|rest\.uniprot\.org|rest\.genenames\.org|alphafold\.ebi\.ac\.uk|reactome\.org\/ContentService|api\.platform\.opentargets\.org\/api\/v4\/graphql)(\/|$)/);
      expect(r.url).not.toMatch(/email|mailto|@/i);
      expect(findProprietaryIdentifiers(name.endsWith("Model") || /^(cds|cdna|ensemblProtein|reactomeVersion)$/.test(name) ? r.body : JSON.parse(r.body)), name).toEqual([]);
    }
    const redactedRows = (await Promise.all(["uniprot", "hgnc"].map((s) => readManifest(join(REPO_ROOT, "data/fixtures/faah2", s))))).flat();
    expect(redactedRows).toHaveLength(2);
    const text = await readFile(join(REPO_ROOT, "data/fixtures/faah2/uniprot/MANIFEST.tsv"), "utf8");
    expect(text.split("\n")[0]).toBe("file\tretrieved_utc\thttp_status\tsha256\tbytes\tmethod\turl\theaders\tredaction");
    // Re-recorded from the snapshot on 2026-11-03 (P9.1.2) with the recorder's wording that names no database.
    expect(text).toMatch(/\tredacted 2026-11-03: proprietary database identifiers removed \(Q-H-LIC-1, 1 removal\); original sha256 [0-9a-f]{64}\n/);
    expect(JSON.parse(inputs.hgnc.body).response.docs[0]).not.toHaveProperty("omim_id");
    const reactomeRows = await readManifest(join(REPO_ROOT, "data/fixtures/faah2/reactome"));
    expect(reactomeRows.map((r) => r.url)).toEqual([
      "https://reactome.org/ContentService/data/database/version",
      "https://reactome.org/ContentService/data/mapping/UniProt/Q6GMR7/pathways?species=9606",
      "https://reactome.org/ContentService/data/event/R-HSA-2142753/ancestors",
      "https://reactome.org/ContentService/data/participants/R-HSA-2142753",
    ]);
  });
  it("writes the gene, transcript, sequence, protein, predicted-model, pathways, capability and questions records (the pathway question, P9.1.2) and nothing that needs a structure or a variant", () => {
    expect(files).toEqual(["associations.json", "capabilities.json", "gene.json", "manifest.json", "pathways.json", "predicted-model-AF-Q6GMR7-F1.json", "protein-Q6GMR7.json", "questions.json", "sequences.json", "transcript.json"]);
  });
  it("capabilities: structure, mapping and variant unavailable with the builder's reasons; transcript and protein views available; the prediction as found", () => {
    expect(cap.symbol).toBe("FAAH2");
    expect(cap.experimentalStructure).toEqual({ available: false, reason: "no experimental structure is cross-referenced for this protein", evidenceCategory: 6 });
    expect(cap.verifiedResidueMapping).toEqual({ available: false, reason: "no experimental structure to map onto", evidenceCategory: 6 });
    expect(cap.variantHighlight).toEqual({ available: false, reason: "no reference variant selected", evidenceCategory: 6 });
    expect(cap.transcriptView).toEqual({ available: true, reason: "transcript ENST00000374900.5 selected by rule mane_select", evidenceCategory: 2 });
    expect(cap.proteinView).toMatchObject({ available: true, evidenceCategory: 2 });
    expect(cap.predictedStructure).toEqual({ available: true, reason: "AF-Q6GMR7-F1 v6; computational prediction, never shown as experimental", evidenceCategory: 3 });
    // P9.1.2: the specification asks for pathways and Reactome lists the protein in one, so the view is available (class 2, membership only).
    expect(cap.pathwayView).toEqual({ available: true, reason: "1 Reactome membership; opens on Arachidonate metabolism, R-HSA-2142753 (the rule's choice: fewest participants among non-disease pathways with a diagram)", evidenceCategory: 2 });
    expect(cap.derivedFrom).toContain("pathways.json");
  });
  it("the manifest and records: no failed check, four sources, a protein with no PDB cross-reference and its initiator Met kept, a prediction labelled as such", async () => {
    expect(manifest.datasetId).toBe("faah2");
    expect(manifest.generator.script).toBe(`${GENERATOR_SCRIPT} (fixtures)`);
    expect(manifest.validation.filter((v) => v.result === "fail")).toEqual([]);
    expect(manifest.validation.find((v) => v.check === "T15-initiator-met-and-chain")).toMatchObject({ result: "pass", detail: "no Initiator methionine feature (translated numbering is the processed numbering); Chain 1-532" });
    expect([...new Set(manifest.sources.map((s) => s.source))].sort()).toEqual(["alphafold", "ensembl", "hgnc", "opentargets", "reactome", "uniprot"]);
    expect(manifest.sources.map((s) => s.sha256).sort()).toEqual(Object.values(await loadFixtureInputs("faah2")).map((r) => r.sha256).sort());
    const prot = Protein.parse(JSON.parse(await readFile(join(out, "protein-Q6GMR7.json"), "utf8")));
    expect(prot.xrefs.pdb).toEqual([]);
    expect(prot.initiatorMethionineRemoved).toBe(false);
    expect(prot.processedChain).toMatchObject({ start: 1, end: 532 });
    expect(prot.length).toBe(532);
    const gene = Gene.parse(JSON.parse(await readFile(join(out, "gene.json"), "utf8")));
    expect(gene.symbol).toBe("FAAH2");
    expect(gene.id).toMatchObject({ id: "ENSG00000165591" });
    const model = PredictedModel.parse(JSON.parse(await readFile(join(out, "predicted-model-AF-Q6GMR7-F1.json"), "utf8")));
    expect(model.usableForVariantPlacement).toBe(false);
  });
  it("the committed curated set, when present, is the same build (only timestamps and the generator mode may differ)", async () => {
    const committed = join(REPO_ROOT, "data/curated/faah2/manifest.json");
    const m = DatasetManifest.parse(JSON.parse(await readFile(committed, "utf8").catch(() => "null")) ?? manifest);
    expect(m.datasetId).toBe("faah2");
    expect(m.sources.map((s) => s.sha256)).toEqual(manifest.sources.map((s) => s.sha256));
    expect(m.files.map((f) => f.path)).toEqual(manifest.files.map((f) => f.path));
    expect(m.validation.map((v) => [v.check, v.result])).toEqual(manifest.validation.map((v) => [v.check, v.result]));
  });
});
