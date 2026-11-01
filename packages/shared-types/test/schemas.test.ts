// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  DatasetManifest,
  EVIDENCE_CATEGORIES,
  Evidence,
  EvidenceCategory,
  GenomicInterval,
  Provenance,
  RecordProvenance,
  ResidueRef,
  formatVersioned,
  intervalLength,
  parseVersioned,
} from "../src/index.ts";

// Values below are from research/raw/ensembl/lookup_ENST00000335295_expand.json (exon ENSE00001829867.2).
const exon1 = { assembly: "GRCh38", assemblyPatch: "GRCh38.p14", seqRegion: "11", refSeqAccession: null, start: 5226930, end: 5227071, strand: -1, convention: "1-based-closed" } as const;

const prov: Provenance = {
  source: "ensembl",
  url: "https://rest.ensembl.org/lookup/id/ENSG00000244734?expand=1;mane=1;content-type=application/json",
  method: "GET",
  retrievedAt: "2026-11-01T18:15:42Z",
  sourceRelease: "Ensembl 116",
  recordId: "ENSG00000244734",
  recordVersion: "6",
  assembly: "GRCh38.p14",
  sha256: "0da67c9bb3fa65d11938bf55347c8c940c47a19426ae84dac1894ee23bef1c08",
  licence: "Ensembl-no-restrictions",
  attribution: "Ensembl",
};

describe("GenomicInterval", () => {
  it("round-trips and keeps the 1-based closed convention explicit", () => {
    const parsed = GenomicInterval.parse(exon1);
    expect(GenomicInterval.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
    expect(intervalLength(parsed)).toBe(142);
  });
  it("rejects 0-based or inverted intervals, unknown assemblies and strand 0", () => {
    expect(GenomicInterval.safeParse({ ...exon1, start: 0 }).success).toBe(false);
    expect(GenomicInterval.safeParse({ ...exon1, start: 5227072 }).success).toBe(false);
    expect(GenomicInterval.safeParse({ ...exon1, assembly: "hg19" }).success).toBe(false);
    expect(GenomicInterval.safeParse({ ...exon1, strand: 0 }).success).toBe(false);
    expect(GenomicInterval.safeParse({ ...exon1, convention: "0-based-half-open" }).success).toBe(false);
  });
  it("only accepts versioned RefSeq chromosome accessions", () => {
    expect(GenomicInterval.safeParse({ ...exon1, refSeqAccession: "NC_000011.10" }).success).toBe(true);
    expect(GenomicInterval.safeParse({ ...exon1, refSeqAccession: "NC_000011" }).success).toBe(false);
  });
});

describe("versioned identifiers", () => {
  it("parses and formats accession.version", () => {
    expect(parseVersioned("NM_000518.5")).toEqual({ id: "NM_000518", version: 5 });
    expect(parseVersioned("ENSG00000244734")).toEqual({ id: "ENSG00000244734", version: null });
    expect(formatVersioned({ id: "ENST00000335295", version: 4 })).toBe("ENST00000335295.4");
  });
});

describe("evidence and provenance", () => {
  it("has exactly the six classes of master prompt §5", () => {
    expect(Object.keys(EVIDENCE_CATEGORIES)).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(EvidenceCategory.safeParse(7).success).toBe(false);
    expect(EvidenceCategory.safeParse(0).success).toBe(false);
  });
  it("Provenance requires every field of the acquisition plan §5", () => {
    expect(Provenance.parse(prov)).toEqual(prov);
    for (const k of Object.keys(prov) as (keyof Provenance)[]) {
      const { [k]: _omit, ...rest } = prov;
      expect(Provenance.safeParse(rest).success, `missing ${k}`).toBe(false);
    }
    expect(Provenance.safeParse({ ...prov, sha256: "abc" }).success).toBe(false);
    expect(Provenance.safeParse({ ...prov, licence: "proprietary" }).success).toBe(false);
  });
  it("RecordProvenance needs at least one source and one transformation", () => {
    const ok = { sources: [prov], transformations: ["field-select"], validation: [{ check: "T01", result: "pass", detail: null, at: "2026-11-01T00:00:00Z" }], evidenceCategory: 2 };
    expect(RecordProvenance.parse(ok).evidenceCategory).toBe(2);
    expect(RecordProvenance.safeParse({ ...ok, sources: [] }).success).toBe(false);
    expect(RecordProvenance.safeParse({ ...ok, transformations: [] }).success).toBe(false);
  });
  it("Evidence round-trips", () => {
    const e = { category: 3, categoryLabel: EVIDENCE_CATEGORIES[3], basis: "computational-prediction", statement: "x", qualifier: null, limitations: [] };
    expect(Evidence.parse(JSON.parse(JSON.stringify(Evidence.parse(e))))).toEqual(e);
  });
});

describe("ResidueRef keeps label and auth ids", () => {
  it("requires both", () => {
    // 2HBS heme: label_asym_id J, auth_asym_id B, auth_seq_id 153 (research/raw/rcsb/2HBS.cif pdbx_nonpoly_scheme).
    const heme = { entryId: "2HBS", assemblyId: "1", entityId: "3", labelAsymId: "J", labelSeqId: null, authAsymId: "B", authSeqId: "153", insCode: null, compId: "HEM", authCompId: "HEM" };
    expect(ResidueRef.parse(heme)).toEqual(heme);
    const { authAsymId: _a, ...noAuth } = heme;
    expect(ResidueRef.safeParse(noAuth).success).toBe(false);
  });
  it("types: authSeqId is a string (it may carry non-numeric author numbering)", () => {
    expectTypeOf<ResidueRef["authSeqId"]>().toEqualTypeOf<string>();
    expectTypeOf<ResidueRef["labelSeqId"]>().toEqualTypeOf<number | null>();
  });
});

describe("DatasetManifest", () => {
  it("rejects a manifest without sources or files", () => {
    const m = {
      schema: "helix-dataset-manifest/1",
      datasetId: "hbb",
      description: "d",
      generatedAt: "2026-11-01T00:00:00Z",
      generator: { script: "s", gitCommit: null, gitDirty: null, node: "v22" },
      assembly: "GRCh38.p14",
      nonclinicalNotice: "n",
      sources: [prov],
      files: [{ path: "gene.json", sha256: prov.sha256, bytes: 1, recordKind: "gene" }],
      validation: [],
      knownIssues: [],
      drift: [],
      attribution: [],
    };
    expect(DatasetManifest.safeParse(m).success).toBe(true);
    expect(DatasetManifest.safeParse({ ...m, sources: [] }).success).toBe(false);
    expect(DatasetManifest.safeParse({ ...m, files: [] }).success).toBe(false);
  });
});
