// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/** Recorded-fixture tests for each adapter, through the real HttpClient with a fetch mock. */
import { describe, expect, it } from "vitest";
import { fixtureJson, fixtureText, loadFixtureInputs } from "../../../scripts/data-preparation/lib/fixtures.ts";
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
  SiftsAdapter,
  UniprotAdapter,
  assertNoProprietaryIdentifiers,
  ensemblUrls,
  findProprietaryIdentifiers,
  parseUniprotEntry,
  rcsbUrls,
  uniprotUrls,
} from "../src/index.ts";

const inputs = await loadFixtureInputs();

/** fetch mock serving the recorded fixtures by URL, with their recorded headers. */
const fixtureFetch: typeof fetch = async (u) => {
  const url = typeof u === "string" ? u : u instanceof URL ? u.href : u.url;
  const decoded = decodeURI(url);
  const r = Object.values(inputs).find((x) => x && (x.url === url || x.url === decoded));
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
  it("AlphaFold prediction and the in-file disclaimer (A1)", async () => {
    const af = new AlphafoldAdapter(http);
    const p = await af.prediction("P68871");
    expect(p.data.modelVersion).toBe(6);
    const m = await af.modelFile(p.data.cifUrl);
    expect(m.data.disclaimer).toMatch(/CC-BY-4.0/);
    await expect(af.modelFile("https://example.org/x.cif")).rejects.toBeInstanceOf(InvalidParameterError);
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
