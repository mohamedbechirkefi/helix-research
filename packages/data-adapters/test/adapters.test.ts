// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/** Recorded-fixture tests for each adapter, through the real HttpClient with a fetch mock. */
import { describe, expect, it } from "vitest";
import { fixtureIndex, fixtureJson, fixtureText, loadFixtureInputs, loadRaw } from "../../../scripts/data-preparation/lib/fixtures.ts";
import {
  AlphafoldAdapter,
  ClinvarAdapter,
  EnsemblAdapter,
  HgncAdapter,
  HttpClient,
  InvalidParameterError,
  ParseError,
  ProprietaryContentError,
  RcsbAdapter,
  ReactomeAdapter,
  SiftsAdapter,
  UniprotAdapter,
  alphafoldLocalPlddt,
  compareStableIds,
  parseReactomeAncestors,
  parseReactomeParticipants,
  parseReactomePathways,
  parseReactomeVersion,
  reactomeUrls,
  topLevelPathwaysOf,
  uniprotProteinsOf,
  assertNoProprietaryIdentifiers,
  parseAlphafoldPae,
  plddtBand,
  ensemblUrls,
  findProprietaryIdentifiers,
  hgncUrls,
  parseHgnc,
  parseUniprotEntry,
  redactProprietaryIdentifiers,
  rcsbUrls,
  uniprotUrls,
} from "../src/index.ts";

const inputs = await loadFixtureInputs();
// Extra recorded files the adapters fetch but the slice build does not list as inputs (the AlphaFold PAE file, P9.1.1).
const extras = [await loadRaw((await fixtureIndex()).extra.alphafoldPae!)];

/** fetch mock serving the recorded fixtures by URL, with their recorded headers. */
const fixtureFetch: typeof fetch = async (u) => {
  const url = typeof u === "string" ? u : u instanceof URL ? u.href : u.url;
  const decoded = decodeURI(url);
  const r = [...Object.values(inputs), ...extras].find((x) => x && (x.url === url || x.url === decoded));
  if (!r) return new Response("not recorded", { status: 404 });
  return new Response(r.body, { status: 200, headers: r.headers });
};
const http = new HttpClient({ fetch: fixtureFetch });

describe("URL builders validate parameters", () => {
  it("Ensembl", () => {
    expect(ensemblUrls.lookupId("ENSG00000244734")).toBe("https://rest.ensembl.org/lookup/id/ENSG00000244734?expand=1;mane=1;content-type=application/json");
    expect(() => ensemblUrls.lookupId("ENSG00000244734.6")).toThrow(InvalidParameterError);
    expect(() => ensemblUrls.lookupId("HBB")).toThrow(InvalidParameterError);
    expect(() => ensemblUrls.variation("334")).toThrow(InvalidParameterError);
    expect(() => ensemblUrls.sequenceRegion("11", 1, 50_000, 1)).toThrow(/bulk/);
    expect(ensemblUrls.sequenceRegion("11", 5226982, 5227022, 1)).toContain("content-type=application/json");
  });
  it("UniProt and RCSB", () => {
    expect(uniprotUrls.entry("P68871")).toBe("https://rest.uniprot.org/uniprotkb/P68871.json");
    expect(() => uniprotUrls.entry("p68871; DROP")).toThrow(InvalidParameterError);
    expect(rcsbUrls.mmcif("2hbs")).toBe("https://files.rcsb.org/download/2HBS.cif");
    expect(() => rcsbUrls.entry("../x")).toThrow(InvalidParameterError);
  });
});

describe("Ensembl adapter (recorded fixtures)", () => {
  const ens = new EnsemblAdapter(http);
  it("lookup expand=1 for ENSG00000244734 (E3)", async () => {
    const { data } = await ens.lookupGene("ENSG00000244734");
    expect(data.id).toBe("ENSG00000244734");
    expect(data.version).toBe(6);
    expect(data.Transcript).toHaveLength(19);
  });
  it("sequences (E5-E7) and assembly (E2)", async () => {
    expect((await ens.sequence("ENST00000335295", "cds")).data.sequence).toHaveLength(444);
    expect((await ens.sequence("ENSP00000333994", "protein")).data.id).toBe("ENSP00000333994.3");
    expect((await ens.assembly()).data.assembly_name).toBe("GRCh38.p14");
  });
  it("VEP parse ignores colocated_variants (third-party accessions)", async () => {
    const { data } = await ens.vep("ENST00000335295.4:c.20A>T");
    expect(JSON.stringify(data)).not.toContain("colocated");
    expect(findProprietaryIdentifiers(data)).toEqual([]);
  });
});

describe("UniProt adapter (recorded fixture)", () => {
  it("keeps sequence, version, features and only MANE/Ensembl/PDB xrefs", async () => {
    const { data, release } = await new UniprotAdapter(http).entry("P68871");
    expect(release).toBe("2026_03");
    expect(data.sequenceVersion).toBe(2);
    expect(data.features.find((f) => f.type === "Initiator methionine")?.start).toBe(1);
    expect(data.maneSelect?.refSeqProtein).toBe("NP_000509.1");
    expect(data.pdb.find((p) => p.id === "2HBS")?.chains).toBe("B/D/F/H=2-147");
    expect(findProprietaryIdentifiers(data)).toEqual([]);
  });
  it("drops proprietary cross-references and evidence sources even if present", () => {
    const raw = JSON.parse(inputs.uniprot.body) as Record<string, unknown> & { uniProtKBCrossReferences: unknown[]; features: { evidences?: unknown[] }[] };
    raw.uniProtKBCrossReferences.push({ database: "MIM", id: "141900", properties: [] });
    raw.features[0]!.evidences = [{ evidenceCode: "ECO:0000269", source: "MIM", id: "141900" }];
    const parsed = parseUniprotEntry(raw);
    expect(findProprietaryIdentifiers(parsed)).toEqual([]);
    expect(JSON.stringify(parsed)).not.toContain("141900");
  });
  it("a body with the wrong shape is a ParseError", () => {
    expect(() => parseUniprotEntry({ primaryAccession: "P68871" })).toThrow(ParseError);
  });
});

describe("RCSB, SIFTS, ClinVar, HGNC, AlphaFold adapters (recorded fixtures)", () => {
  it("RCSB entry, polymer entity, assembly, mmCIF (P1-P4)", async () => {
    const r = new RcsbAdapter(http);
    expect((await r.entry("2HBS")).data.exptl[0]?.method).toBe("X-RAY DIFFRACTION");
    expect((await r.polymerEntity("2HBS", "2")).data.rcsb_polymer_entity_container_identifiers.asym_ids).toEqual(["B", "D", "F", "H"]);
    expect((await r.assembly("2HBS", "1")).data.pdbx_struct_assembly_gen[0]?.asym_id_list).toContain("A");
    expect((await r.mmcif("2HBS")).data.entryId).toBe("2HBS");
  });
  it("SIFTS segments with both label and auth numbering (S1)", async () => {
    const { data } = await new SiftsAdapter(http).uniprotMappings("2HBS");
    const b = data.find((s) => s.uniprotAccession === "P68871" && s.labelAsymId === "B")!;
    expect([b.unpStart, b.labelSeqStart, b.authSeqStart]).toEqual([2, 1, 1]);
  });
  it("ClinVar esummary, haplotypes flagged, no trait names kept (C1)", async () => {
    const recs = (await new ClinvarAdapter(new HttpClient({ fetch: async () => new Response(inputs.clinvar.body) })).esummary(["15333"])).data;
    expect(recs.filter((r) => r.isHaplotypeOrCompound)).toHaveLength(8);
    const hbs = recs.find((r) => r.uid === "15333")!;
    expect(hbs.accessionVersion).toBe("VCV000015333.183");
    expect(JSON.stringify(hbs)).not.toMatch(/trait_name|Orphanet|MedGen/);
    // Phase 6: somatic classifications are empty strings in ClinVar, read as none.
    expect([hbs.clinicalImpact, hbs.oncogenicity, hbs.recordStatus]).toEqual([null, null, ""]);
  });
  it("ClinVar esearch by rsID (C0, Phase 6): uids and count, tool parameter only, rsID terms only", async () => {
    let asked = "";
    const h = new HttpClient({ fetch: async (u) => ((asked = String(u)), new Response(inputs.clinvarSearch!.body)) });
    const { data } = await new ClinvarAdapter(h).esearchRs("rs334");
    expect(data.count).toBe(10);
    expect(data.uids).toContain("15333");
    expect(asked).toBe("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=clinvar&term=rs334&retmode=json&retmax=100&tool=helix-research");
    expect(asked).not.toMatch(/email/i);
    await expect(new ClinvarAdapter(h).esearchRs("HBB[gene] OR 1=1")).rejects.toBeInstanceOf(InvalidParameterError);
  });
  it("HGNC symbol fetch (H1) sends only the CORS-safelisted Accept header", async () => {
    let sent: HeadersInit | undefined;
    const h = new HttpClient({ fetch: async (_u, init) => ((sent = init?.headers), new Response(inputs.hgnc.body)) });
    const { data } = await new HgncAdapter(h).symbol("HBB");
    expect(data.hgncId).toBe("HGNC:4827");
    expect(Object.keys(sent as Record<string, string>)).toEqual(["Accept"]);
  });
  it("HGNC fetch by numeric id (Phase 9 finder): the URL, the Accept header, locus_type, and an unused id as an empty array", async () => {
    expect(hgncUrls.fetchHgncId(4827)).toBe("https://rest.genenames.org/fetch/hgnc_id/HGNC:4827");
    for (const bad of [0, -1, 1.5, Number.NaN]) expect(() => hgncUrls.fetchHgncId(bad)).toThrow(InvalidParameterError);
    const used = {
      responseHeader: { status: 0, QTime: 1 },
      response: {
        numFound: 1,
        start: 0,
        docs: [{ hgnc_id: "HGNC:4827", symbol: "HBB", name: "hemoglobin subunit beta", status: "Approved", locus_type: "gene with protein product", uniprot_ids: ["P68871"], mane_select: ["ENST00000335295.4", "NM_000518.5"], ensembl_gene_id: "ENSG00000244734" }],
      },
    };
    const unused = { responseHeader: { status: 0, QTime: 0 }, response: { numFound: 0, start: 0, docs: [] } };
    const asked: string[] = [];
    let sent: HeadersInit | undefined;
    const h = new HttpClient({
      fetch: async (u, init) => {
        asked.push(String(u));
        sent = init?.headers;
        return new Response(JSON.stringify(String(u).endsWith("HGNC:4827") ? used : unused), { headers: { "content-type": "application/json" } });
      },
    });
    const a = await new HgncAdapter(h).hgncId(4827);
    expect(a.data).toHaveLength(1);
    expect(a.data[0]).toMatchObject({ hgncId: "HGNC:4827", symbol: "HBB", status: "Approved", locusType: "gene with protein product", uniprotIds: ["P68871"], maneSelect: ["ENST00000335295.4", "NM_000518.5"], ensemblGeneId: "ENSG00000244734" });
    expect(Object.keys(sent as Record<string, string>)).toEqual(["Accept"]);
    const b = await new HgncAdapter(h).hgncId(59999);
    expect(b.data).toEqual([]);
    expect(asked).toEqual(["https://rest.genenames.org/fetch/hgnc_id/HGNC:4827", "https://rest.genenames.org/fetch/hgnc_id/HGNC:59999"]);
    // A record without locus_type still parses (the field is optional); the symbol fetch is unchanged.
    expect(parseHgnc({ response: { numFound: 1, docs: [{ hgnc_id: "HGNC:1", symbol: "X", name: "x", status: "Approved" }] } })[0]!.locusType).toBeNull();
    expect((await new HgncAdapter(new HttpClient({ fetch: async () => new Response(inputs.hgnc.body) })).symbol("HBB")).data.locusType).toBe("gene with protein product");
  });
  it("AlphaFold prediction and the in-file disclaimer (A1)", async () => {
    const af = new AlphafoldAdapter(http);
    const p = await af.prediction("P68871");
    expect(p.data.modelVersion).toBe(6);
    const m = await af.modelFile(p.data.cifUrl);
    expect(m.data.disclaimer).toMatch(/CC-BY-4.0/);
    await expect(af.modelFile("https://example.org/x.cif")).rejects.toBeInstanceOf(InvalidParameterError);
  });
  it("AlphaFold confidence (P9.1.1): the record's PAE file and bands, per-residue pLDDT from the model file, the PAE matrix", async () => {
    const af = new AlphafoldAdapter(http);
    const p = await af.prediction("P68871");
    expect(p.data.paeDocUrl).toBe("https://alphafold.ebi.ac.uk/files/AF-P68871-F1-predicted_aligned_error_v6.json");
    expect(p.data.paeImageUrl).toMatch(/predicted_aligned_error_v6\.png$/);
    expect(p.data.plddtFractions).toEqual({ veryLow: 0, low: 0.007, confident: 0.02, veryHigh: 0.973 });
    expect(p.data.uniprotReviewed).toBe(true);
    expect(p.data.chainId).toBe("A");
    // Per-residue pLDDT: one row per residue, contiguous from 1, mean equal to the record's global value, bands equal to its fractions.
    const m = await af.modelFile(p.data.cifUrl);
    const l = m.data.localPlddt;
    expect(l).toHaveLength(147);
    expect(l[0]).toEqual({ seqId: 1, compId: "MET", plddt: 61.09, band: "low" });
    expect(l.at(-1)!.seqId).toBe(147);
    const mean = l.reduce((a, r) => a + r.plddt, 0) / l.length;
    // The record states the global value to two decimals from its own computation; the mean of the per-residue values lands within 0.05 of it (0.012 on this model).
    expect(Math.abs(mean - p.data.globalPlddt!)).toBeLessThan(0.05);
    const share = (b: string) => +(l.filter((r) => r.band === b).length / l.length).toFixed(3);
    expect([share("very-low"), share("low"), share("confident"), share("very-high")]).toEqual([0, 0.007, 0.02, 0.973]);
    // The PAE matrix: square, residues in model order, diagonal near zero, within the stated maximum.
    const pae = await af.pae(p.data.paeDocUrl!);
    expect(pae.data.size).toBe(147);
    expect(pae.data.matrix.every((row) => row.length === 147)).toBe(true);
    expect(Math.max(...pae.data.matrix.map((row, i) => row[i]!))).toBeLessThan(1.5);
    expect(Math.max(...pae.data.matrix.flat())).toBeLessThanOrEqual(pae.data.maxPae);
    await expect(af.pae("https://alphafold.ebi.ac.uk/files/AF-P68871-F1-model_v6.cif")).rejects.toBeInstanceOf(InvalidParameterError);
    // Malformed inputs fail loudly.
    expect(() => parseAlphafoldPae([{ predicted_aligned_error: [[0, 1], [2]], max_predicted_aligned_error: 3 }])).toThrow(ParseError);
    expect(() => alphafoldLocalPlddt("data_x\n_entry.id x\n")).toThrow(ParseError);
    expect(plddtBand(90.01)).toBe("very-high");
    expect(plddtBand(90)).toBe("confident");
    expect(plddtBand(50)).toBe("very-low");
  });
});

describe("Reactome adapter (P9.1.2, plan §12 rule 1; recorded fixtures of the first set)", () => {
  const reactome = new ReactomeAdapter(http);
  const acc = inputs.uniprot.url.match(/uniprotkb\/([A-Z0-9]+)\.json/)![1]!;
  it("URL builders validate the accession and the stable id form R-HSA-<digits>; species 9606 only", () => {
    expect(reactomeUrls.databaseVersion()).toBe("https://reactome.org/ContentService/data/database/version");
    expect(reactomeUrls.pathwaysForUniprot("Q6GMR7")).toBe("https://reactome.org/ContentService/data/mapping/UniProt/Q6GMR7/pathways?species=9606");
    expect(reactomeUrls.eventAncestors("R-HSA-1237044")).toBe("https://reactome.org/ContentService/data/event/R-HSA-1237044/ancestors");
    expect(reactomeUrls.participants("R-HSA-1237044")).toBe("https://reactome.org/ContentService/data/participants/R-HSA-1237044");
    for (const bad of ["p68871", "Q6GMR7-1", "HBB", "../x", "Q6GMR7?species=10090"]) expect(() => reactomeUrls.pathwaysForUniprot(bad), bad).toThrow(InvalidParameterError);
    for (const bad of ["R-MMU-1237044", "1237044", "R-HSA-", "R-HSA-12a", "R-HSA-1237044/participants"]) {
      expect(() => reactomeUrls.eventAncestors(bad), bad).toThrow(InvalidParameterError);
      expect(() => reactomeUrls.participants(bad), bad).toThrow(InvalidParameterError);
    }
  });
  it("the database version is a plain-text integer (R0)", async () => {
    const v = await reactome.databaseVersion();
    expect(v.data).toMatch(/^\d+$/);
    expect(v.response.headers["content-type"]).toMatch(/text\/plain/);
    expect(() => parseReactomeVersion("<html>")).toThrow(ParseError);
    expect(() => parseReactomeVersion("98.1")).toThrow(ParseError);
    expect(parseReactomeVersion(" 98\n")).toBe("98");
  });
  it("memberships of the set's accession (R1): human pathways with stable id, name, disease and diagram flags", async () => {
    const { data, response } = await reactome.pathwaysForUniprot(acc);
    expect(response.url).toMatch(/species=9606$/);
    expect(data.length).toBeGreaterThan(0);
    for (const m of data) {
      expect(m.stableId).toMatch(/^R-HSA-\d+$/);
      expect(m.species).toBe("Homo sapiens");
      expect(typeof m.isDisease).toBe("boolean");
      expect(typeof m.hasDiagram).toBe("boolean");
      expect(m.name.length).toBeGreaterThan(0);
    }
    // Malformed: a missing flag, a foreign stable id, a non-array body.
    expect(() => parseReactomePathways([{ dbId: 1, stId: "R-HSA-1", displayName: "x", speciesName: "Homo sapiens", hasDiagram: true, schemaClass: "Pathway" }])).toThrow(ParseError);
    expect(() => parseReactomePathways([{ dbId: 1, stId: "R-MMU-1", displayName: "x", speciesName: "Mus musculus", isInDisease: false, hasDiagram: true, schemaClass: "Pathway" }])).toThrow(ParseError);
    expect(() => parseReactomePathways({ stId: "R-HSA-1" })).toThrow(ParseError);
    expect(parseReactomePathways([])).toEqual([]);
  });
  it("ancestors of a membership (R2): paths from the event to a TopLevelPathway; the top-level pathways are distinct and sorted", async () => {
    const { data: ms } = await reactome.pathwaysForUniprot(acc);
    const first = [...ms].sort((a, b) => compareStableIds(a.stableId, b.stableId))[0]!;
    const { data: paths } = await reactome.eventAncestors(first.stableId);
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) {
      expect(p[0]!.stableId).toBe(first.stableId);
      expect(p[p.length - 1]!.schemaClass).toBe("TopLevelPathway");
    }
    const top = topLevelPathwaysOf(first.stableId, paths);
    expect(top.length).toBeGreaterThan(0);
    expect(top.every((t) => /^R-HSA-\d+$/.test(t.stableId) && t.name.length > 0)).toBe(true);
    // Hand-made: a path that does not start with the event, a path that ends below the top level, no path at all.
    const ev = (stableId: string, schemaClass: string) => ({ stableId, name: stableId, schemaClass, species: null });
    expect(() => topLevelPathwaysOf("R-HSA-1", [[ev("R-HSA-2", "Pathway"), ev("R-HSA-3", "TopLevelPathway")]])).toThrow(/starts with R-HSA-2/);
    expect(() => topLevelPathwaysOf("R-HSA-1", [[ev("R-HSA-1", "Pathway"), ev("R-HSA-3", "Pathway")]])).toThrow(/not a TopLevelPathway/);
    expect(() => topLevelPathwaysOf("R-HSA-1", [])).toThrow(/no ancestor path/);
    expect(topLevelPathwaysOf("R-HSA-1", [[ev("R-HSA-1", "Pathway"), ev("R-HSA-30", "TopLevelPathway")], [ev("R-HSA-1", "Pathway"), ev("R-HSA-4", "TopLevelPathway")], [ev("R-HSA-1", "Pathway"), ev("R-HSA-30", "TopLevelPathway")]]).map((t) => t.stableId)).toEqual(["R-HSA-4", "R-HSA-30"]);
    expect(() => parseReactomeAncestors([[]])).toThrow(ParseError);
    expect(() => parseReactomeAncestors([[{ stId: "R-HSA-1" }]])).toThrow(ParseError);
  });
  it("participants of a pathway (R3): physical entities with their reference entities; the UniProt proteins of a complex or a set are read from them", async () => {
    const { data: ms } = await reactome.pathwaysForUniprot(acc);
    // The recorded set has participants for the candidates of the rule; take the first candidate by stable id.
    const cand = [...ms].filter((m) => !m.isDisease && m.hasDiagram).sort((a, b) => compareStableIds(a.stableId, b.stableId))[0]!;
    const { data } = await reactome.participants(cand.stableId);
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((p) => Number.isInteger(p.dbId) && p.displayName.length > 0 && p.schemaClass.length > 0)).toBe(true);
    const proteins = data.flatMap(uniprotProteinsOf);
    expect(proteins.length).toBeGreaterThan(0);
    expect(proteins.every((x) => /^[A-Z0-9]{6,10}$/.test(x.accession) && x.identifier.startsWith(x.accession))).toBe(true);
    // A small molecule has no protein; a complex may carry several; an isoform keeps its suffix in the identifier only.
    const complex = { dbId: 1, displayName: "c", schemaClass: "Complex", referenceEntities: [
      { dbId: 2, stableId: "chebi:1", identifier: "1", schemaClass: "ReferenceMolecule", displayName: "x [ChEBI:1]" },
      { dbId: 3, stableId: "uniprot:Q6GMR7", identifier: "Q6GMR7", schemaClass: "ReferenceGeneProduct", displayName: "UniProt:Q6GMR7 FAAH2" },
      { dbId: 4, stableId: "uniprot:Q6GMR7-2", identifier: "Q6GMR7-2", schemaClass: "ReferenceIsoform", displayName: "UniProt:Q6GMR7-2 FAAH2" },
      { dbId: 5, stableId: null, identifier: "Q6GMR7", schemaClass: "ReferenceGeneProduct", displayName: "no stable id" },
    ] };
    expect(uniprotProteinsOf(complex)).toEqual([
      { accession: "Q6GMR7", identifier: "Q6GMR7", displayName: "UniProt:Q6GMR7 FAAH2" },
      { accession: "Q6GMR7", identifier: "Q6GMR7-2", displayName: "UniProt:Q6GMR7-2 FAAH2" },
    ]);
    expect(parseReactomeParticipants([{ peDbId: 1, displayName: "x", schemaClass: "SimpleEntity" }])[0]!.referenceEntities).toEqual([]);
    expect(() => parseReactomeParticipants([{ displayName: "x", schemaClass: "SimpleEntity" }])).toThrow(ParseError);
    expect(() => parseReactomeParticipants([{ peDbId: 1, displayName: "x", schemaClass: "Complex", refEntities: [{ dbId: 2 }] }])).toThrow(ParseError);
  });
  it("stable ids order by their number", () => {
    expect(["R-HSA-1237044", "R-HSA-983231", "R-HSA-9927020"].sort(compareStableIds)).toEqual(["R-HSA-983231", "R-HSA-1237044", "R-HSA-9927020"]);
    expect(compareStableIds("R-HSA-5", "R-HSA-5")).toBe(0);
  });
});

describe("proprietary identifier guard (Q-H-LIC-1)", () => {
  it("finds OMIM, MIM numbers and HGMD accessions", () => {
    expect(findProprietaryIdentifiers({ a: "see MIM:603903" })).toHaveLength(1);
    expect(findProprietaryIdentifiers({ OMIM: "x" })).toHaveLength(1);
    expect(findProprietaryIdentifiers(["HGMD CM870001"]).length).toBeGreaterThan(0);
    expect(() => assertNoProprietaryIdentifiers({ db: "HGMD-PUBLIC" })).toThrow(ProprietaryContentError);
  });
  it("does not flag sequences, hashes or HGNC/ClinVar/UniProt ids", async () => {
    expect(findProprietaryIdentifiers({ embl: "CR536530", allele_string: "T/A" })).toEqual([]);
    expect(findProprietaryIdentifiers({ allele_string: "HGMD_MUTATION" })).toHaveLength(1);
    expect(findProprietaryIdentifiers({ s: "MVHLTPEEKSAVTALWGKV", md5: "209D686939D0B8D1EA089368150140E2", h: "HGNC:4827", v: "VCV000015333", u: "VAR_002863" })).toEqual([]);
  });
  it("the redacted raw fixtures used by tests contain none", async () => {
    for (const name of ["uniprot", "variation", "vep", "clinvar", "hgnc"]) {
      expect(findProprietaryIdentifiers(await fixtureJson(name)), name).toEqual([]);
    }
    expect((await fixtureText("goReleaseDate")).trim()).toBe("{date: 2026-08-05}");
  });
});

describe("redactProprietaryIdentifiers (the research/raw redaction, Q-H-LIC-1, as code)", () => {
  it("removes MIM/OMIM/HGMD-keyed objects and keys, nothing else, and reports each removal", () => {
    const body = {
      responseHeader: { status: 0 },
      docs: [{ symbol: "G", omim_id: ["123456"], uniprot_ids: ["P12345"], locus_type: "gene with protein product" }],
      uniProtKBCrossReferences: [
        { database: "PDB", id: "1ABC" },
        { database: "MIM", id: "141900", properties: [{ key: "Type", value: "gene" }] },
        { database: "Ensembl", id: "ENST00000000001" },
      ],
      comments: [{ commentType: "DISEASE", disease: { diseaseId: "X", diseaseCrossReference: { database: "MIM", id: "603902" }, evidences: [{ evidenceCode: "ECO:0000269", source: "PubMed", id: "1" }, { evidenceCode: "ECO:0000269", source: "MIM", id: "603902" }] } }],
      colocated_variants: [{ id: "rs1", allele_string: "T/A" }, { id: "CM900001", allele_string: "HGMD_MUTATION", source: "HGMD-PUBLIC" }, { id: "CM900002", allele_string: "HGMD_MUTATION", strand: 1 }],
    };
    const before = JSON.stringify(body);
    const r = redactProprietaryIdentifiers(body);
    expect(JSON.stringify(body)).toBe(before);
    expect(r.value).toEqual({
      responseHeader: { status: 0 },
      docs: [{ symbol: "G", uniprot_ids: ["P12345"], locus_type: "gene with protein product" }],
      uniProtKBCrossReferences: [
        { database: "PDB", id: "1ABC" },
        { database: "Ensembl", id: "ENST00000000001" },
      ],
      comments: [{ commentType: "DISEASE", disease: { diseaseId: "X", evidences: [{ evidenceCode: "ECO:0000269", source: "PubMed", id: "1" }] } }],
      colocated_variants: [{ id: "rs1", allele_string: "T/A" }],
    });
    expect(r.removed).toEqual([
      "$.docs[0].omim_id (key named for a proprietary database)",
      "$.uniProtKBCrossReferences[1] (object of a proprietary database)",
      "$.comments[0].disease.diseaseCrossReference (object of a proprietary database)",
      "$.comments[0].disease.evidences[1] (object of a proprietary database)",
      "$.colocated_variants[1] (object of a proprietary database)",
      "$.colocated_variants[2] (object of a proprietary database)",
    ]);
    expect(findProprietaryIdentifiers(r.value)).toEqual([]);
    // An identifier in free text is not removed: the caller must refuse to record such a body.
    const free = redactProprietaryIdentifiers({ note: "see OMIM for details" });
    expect(free.removed).toEqual([]);
    expect(findProprietaryIdentifiers(free.value)).toHaveLength(1);
    // The redacted HBB fixtures contain nothing left to remove.
    expect(redactProprietaryIdentifiers(JSON.parse(inputs.hgnc.body)).removed).toEqual([]);
    expect(redactProprietaryIdentifiers(JSON.parse(inputs.uniprot.body)).removed).toEqual([]);
  });
});
