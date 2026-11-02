// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * The 32 deterministic tests of research/hbb-acquisition-plan.md §7, offline against the
 * recorded fixtures (data/fixtures/hbb/index.json). Expected values are hard-coded here on
 * purpose, each with the record it comes from; curated data never hard-codes them.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { fixtureJson, fixtureText, loadFixtureInputs } from "../../../scripts/data-preparation/lib/fixtures.ts";
import {
  MalformedResponseError,
  type MmcifStructure,
  type SiftsSegment,
  type UniprotEntry,
  ValidationFailedError,
  parseEnsembl,
  parseFasta,
  parseHgnc,
  parseJsonBody,
  parseRcsb,
  parseSifts,
  parseUniprotEntry,
  readMmcifStructure,
} from "@helix/data-adapters";
import { Provenance, type Transcript } from "@helix/shared-types";
import {
  HBB_CONFIG,
  type SliceBuild,
  type SliceInputs,
  alignmentCrossCheck,
  allelesAtSite,
  applyCodingSubstitution,
  buildSlice,
  cdsToGenome,
  classifyPdbxMutation,
  codonGenomicSpan,
  detectDrift,
  entityForAccession,
  evidence,
  hgvsGToSpdi,
  interChainContacts,
  labelAuthDivergences,
  clinvarConflicts,
  clinvarReviewStars,
  mapUniprotChain,
  mapUniprotPosition,
  matureIndex,
  matureLabel,
  md5Hex,
  ncbiGenomicInfoToOneBased,
  normaliseTranscript,
  oneBasedToNcbiGenomicInfo,
  resolveAllele,
  resolveGeneQuery,
  selectTranscript,
  spdiToHgvsG,
  structRefSeqIssues,
  translate,
} from "../src/index.ts";

let inputs: SliceInputs;
let transcript: Transcript;
let cds: string;
let uni: UniprotEntry;
let struct: MmcifStructure;
let sifts: SiftsSegment[];
let build: SliceBuild;
const j = (k: keyof SliceInputs) => parseJsonBody(inputs[k]!.body);

beforeAll(async () => {
  inputs = await loadFixtureInputs();
  transcript = normaliseTranscript(parseEnsembl.transcript(j("transcriptLookup")));
  cds = parseFasta(inputs.cds.body).sequence;
  uni = parseUniprotEntry(j("uniprot"));
  struct = readMmcifStructure(inputs.mmcif.body);
  sifts = parseSifts(j("sifts"), "2HBS");
  build = await buildSlice(inputs, HBB_CONFIG, { now: "2026-11-01T20:00:00Z" });
});

const vctx = () => ({ transcript, cds, refSeqTranscript: transcript.refSeqMatch, refSeqProtein: uni.maneSelect?.refSeqProtein ?? null });
const recoder = () => parseEnsembl.variantRecoder(j("variantRecoder"));

describe("identity and selection", () => {
  // research/raw/ensembl/lookup_ENSG00000244734_expand_mane.json
  it("T01: gene lookup returns ENSG00000244734, HBB, GRCh38, chr 11, strand -1", () => {
    const g = parseEnsembl.gene(j("geneLookup"));
    expect([g.id, g.display_name, g.assembly_name, g.seq_region_name, g.strand]).toEqual(["ENSG00000244734", "HBB", "GRCh38", "11", -1]);
  });
  it("T02: selection picks ENST00000335295 v4, the only MANE_Select, refseq_match NM_000518.5", () => {
    const g = parseEnsembl.gene(j("geneLookup"));
    const { selection, transcript: t } = selectTranscript(g);
    expect(selection.rule).toBe("mane_select");
    expect(selection.selected).toEqual({ id: "ENST00000335295", version: 4 });
    expect(g.Transcript.filter((x) => x.MANE.some((m) => m.type === "MANE_Select"))).toHaveLength(1);
    expect(t.MANE[0]?.refseq_match).toBe("NM_000518.5");
  });
  it("T03: with MANE removed, falls back to is_canonical with the flag and a warning; with neither, fails loudly", () => {
    const g = parseEnsembl.gene(j("geneLookup"));
    const noMane = { ...g, Transcript: g.Transcript.map((t) => ({ ...t, MANE: [] })) };
    const r = selectTranscript(noMane);
    expect(r.selection.rule).toBe("ensembl_canonical_not_mane");
    expect(r.selection.selected.id).toBe("ENST00000335295");
    expect(r.selection.warnings.join(" ")).toMatch(/no MANE Select/);
    const none = { ...noMane, Transcript: noMane.Transcript.map((t) => ({ ...t, is_canonical: 0 })) };
    expect(() => selectTranscript(none)).toThrow(ValidationFailedError);
  });
  // research/raw/hgnc/fetch_symbol_HBB.json
  it("T04: HGNC:4827 resolves symbol HBB and alias beta-globin to ENSG00000244734", () => {
    const docs = parseHgnc(j("hgnc"));
    for (const q of ["HBB", "hbb", "beta-globin", "HGNC:4827"]) {
      const r = resolveGeneQuery(q, docs);
      expect(r.status === "resolved" && [r.hgncId, r.ensemblGeneId]).toEqual(["HGNC:4827", "ENSG00000244734"]);
    }
    expect(resolveGeneQuery("beta-globin", docs)).toMatchObject({ matchedBy: "alias" });
    expect(resolveGeneQuery("HBA1", docs).status).toBe("not-found");
  });
});

describe("coordinates and sequence", () => {
  it("T05: exon lengths sum to the transcript length (628), 1-based closed", () => {
    expect(transcript.exons.map((e) => e.interval.end - e.interval.start + 1)).toEqual([142, 223, 263]);
    expect(transcript.exons.reduce((n, e) => n + e.interval.end - e.interval.start + 1, 0)).toBe(628);
    expect(transcript.length).toBe(628);
  });
  it("T06: CDS is 444 nt, divisible by 3, starts ATG, ends TAA", () => {
    expect(cds).toHaveLength(444);
    expect(cds.length % 3).toBe(0);
    expect(cds.slice(0, 3)).toBe("ATG");
    expect(cds.slice(-3)).toBe("TAA");
  });
  it("T07: translate(CDS, to_stop) == ENSP00000333994.3 == UniProt P68871 (147 aa); md5 matches", () => {
    const ensp = parseFasta(inputs.ensemblProtein.body);
    expect(ensp.id).toBe("ENSP00000333994.3");
    const t = translate(cds, { toStop: true });
    expect(t).toHaveLength(147);
    expect(t).toBe(ensp.sequence);
    expect(t).toBe(uni.sequence);
    expect(md5Hex(uni.sequence).toUpperCase()).toBe(uni.md5); // 209D686939D0B8D1EA089368150140E2
  });
  // research/raw/ensembl/map_cds_ENST00000335295_19-21.json
  it("T08: own exon walk maps c.20 to 11:5227002 and codon 7 to 5227001-5227003, equal to map/cds", () => {
    expect(cdsToGenome(transcript, 20)).toBe(5227002);
    const span = codonGenomicSpan(transcript, 7);
    const m = parseEnsembl.mapping(j("codonMap")).mappings[0]!;
    expect([span.start, span.end]).toEqual([5227001, 5227003]);
    expect([m.start, m.end, m.strand]).toEqual([span.start, span.end, -1]);
    expect([cdsToGenome(transcript, 19), cdsToGenome(transcript, 21)]).toEqual([5227003, 5227001]);
  });
  // data/fixtures/hbb/ensembl/sequence_region_11_5226982-5227022_1.json (E8, recorded in Phase 2)
  it("T09: forward-strand base at 11:5227002 is T; coding-strand base at c.20 is A", () => {
    const w = parseEnsembl.regionSequence(j("genomicWindow"));
    expect(w.id).toBe("chromosome:GRCh38:11:5226982:5227022:1");
    expect(w.seq[5227002 - 5226982]).toBe("T");
    expect(cds[20 - 1]).toBe("A");
  });
  // research/raw/ncbi-gene/esummary_3043_85344.json genomicinfo
  it("T10: SPDI <-> g. round-trips; NCBI esummary 5225463/5227070 <-> Ensembl 5225464-5227071", async () => {
    expect(spdiToHgvsG("NC_000011.10:5227001:T:A")).toBe("NC_000011.10:g.5227002T>A");
    expect(hgvsGToSpdi("NC_000011.10:g.5227002T>A")).toBe("NC_000011.10:5227001:T:A");
    const ncbi = await fixtureJson<{ result: Record<string, { genomicinfo: { chrstart: number; chrstop: number }[] }> }>("ncbiGeneEsummary");
    const gi = ncbi.result["3043"]!.genomicinfo[0]!;
    expect([gi.chrstart, gi.chrstop]).toEqual([5227070, 5225463]);
    expect(ncbiGenomicInfoToOneBased(gi.chrstart, gi.chrstop)).toEqual({ start: 5225464, end: 5227071, strand: -1 });
    expect(oneBasedToNcbiGenomicInfo(5225464, 5227071, -1)).toEqual({ chrstart: 5227070, chrstop: 5225463 });
    expect([transcript.interval.start, transcript.interval.end]).toEqual([5225464, 5227071]);
  });
});

describe("variant", () => {
  it("T11: codon 7 is GAG; c.20A>T gives GTG; E -> V", () => {
    const s = applyCodingSubstitution(cds, 20, "A", "T");
    expect([s.codonNumber, s.refCodon, s.altCodon, s.refAa, s.altAa]).toEqual([7, "GAG", "GTG", "E", "V"]);
    expect(() => applyCodingSubstitution(cds, 20, "C", "T")).toThrow(/reference-base|HGVS says C/);
  });
  // research/raw/ensembl/variant_recoder_rs334_retry.json, vep_hgvs_ENST00000335295_c20AT.json
  it("T12: computed p. string is p.Glu7Val and equals VEP and variant_recoder for ENSP00000333994.3 and NP_000509.1", () => {
    const a = resolveAllele(recoder(), "A", vctx());
    expect(a.coding.proteinChange).toBe("p.Glu7Val");
    expect([...a.hgvsp].sort()).toEqual(["ENSP00000333994.3:p.Glu7Val", "NP_000509.1:p.Glu7Val"]);
    const tc = parseEnsembl.vep(j("vep"))[0]!.transcript_consequences.find((c) => c.transcript_id === "ENST00000335295")!;
    expect(tc.hgvsp).toBe("ENSP00000333994.3:p.Glu7Val");
  });
  it("T13: rs334 is T/A/C/G; only A gives Glu7Val (C Glu7Gly, G Glu7Ala); rsID alone is not HbS", () => {
    const v = parseEnsembl.variation(j("variation"));
    expect(v.mappings[0]?.allele_string).toBe("T/A/C/G");
    const all = allelesAtSite(recoder(), vctx());
    expect(Object.fromEntries(all.map((a) => [a.forwardAllele, a.coding.proteinChange]))).toEqual({ A: "p.Glu7Val", C: "p.Glu7Gly", G: "p.Glu7Ala" });
    const variant = JSON.parse(build.files.find((f) => f.path === "variant-hbs.json")!.content);
    expect(variant.key).toBe("NC_000011.10:g.5227002T>A");
    expect(variant.key).not.toBe("rs334");
    expect(variant.rsAlleles).toEqual(["T", "A", "C", "G"]);
  });
  // research/raw/ncbi-clinvar/esummary_rs334_ids.json
  it("T14: ClinVar VCV000015333: Pathogenic, review status verbatim, GRCh38 5227002 and GRCh37 5248232 labelled; haplotypes not merged", () => {
    const v = JSON.parse(build.files.find((f) => f.path === "variant-hbs.json")!.content);
    expect(v.clinvar.accessionVersion).toBe("VCV000015333.183");
    expect(v.clinvar.classification).toBe("Pathogenic");
    expect(v.clinvar.reviewStatus).toBe("criteria provided, multiple submitters, no conflicts");
    expect([v.location.assembly, v.location.start]).toEqual(["GRCh38", 5227002]);
    expect([v.locationGRCh37.assembly, v.locationGRCh37.start]).toEqual(["GRCh37", 5248232]);
    expect(JSON.stringify(v)).not.toMatch(/VCV000446/);
  });
});

describe("numbering: E6V vs p.Glu7Val", () => {
  it("T15: UniProt Initiator methionine at 1 'Removed'; Chain 2-147", () => {
    const im = uni.features.find((f) => f.type === "Initiator methionine")!;
    const ch = uni.features.find((f) => f.type === "Chain")!;
    expect([im.start, im.end, im.description]).toEqual([1, 1, "Removed"]);
    expect([ch.start, ch.end]).toEqual([2, 147]);
  });
  it("T16: VAR_002863 is at position 7, E -> V, citing rs334", () => {
    const v = uni.features.find((f) => f.featureId === "VAR_002863")!;
    expect([v.start, v.originalSequence, v.alternativeSequences]).toEqual([7, "E", ["V"]]);
    expect(v.xrefs).toContain("dbSNP:rs334");
  });
  it("T17: matureIndex(7) == 6; the 'Glu6Val (mature numbering)' label only comes from the function", () => {
    expect(matureIndex(7, { start: 2, end: 147 })).toBe(6);
    expect(matureLabel("E", 7, "V", { start: 2, end: 147 })).toBe("Glu6Val (mature numbering)");
    expect(matureIndex(7, null)).toBeNull();
    expect(() => matureIndex(1, { start: 2, end: 147 })).toThrow(ValidationFailedError);
    const v = JSON.parse(build.files.find((f) => f.path === "variant-hbs.json")!.content);
    expect(v.numbering.matureLabel).toBe(matureLabel("E", 7, "V", { start: 2, end: 147 }));
  });
  it("T18: HGVS p. position == UniProt position == 7 (asserting 6 fails)", () => {
    const a = resolveAllele(recoder(), "A", vctx());
    expect(a.coding.codonNumber).toBe(7);
    expect(uni.sequence[a.coding.codonNumber - 1]).toBe("E");
    expect(a.coding.codonNumber).not.toBe(6);
    expect(() => expect(a.coding.codonNumber).toBe(6)).toThrow();
  });
  it("T19: 2HBS entity 2 pdbx_mutation is 'E6V VARIANT', tagged mature/legacy", () => {
    const e2 = struct.entities.find((e) => e.id === "2")!;
    expect(e2.mutation).toBe("E6V VARIANT");
    expect(classifyPdbxMutation(e2.mutation!, uni.sequence, { start: 2, end: 147 })).toBe("mature/legacy");
    const s = JSON.parse(build.files.find((f) => f.path === "structure-2HBS.json")!.content);
    expect(s.entities.find((e: { entityId: string }) => e.entityId === "2").mutation).toEqual({ text: "E6V VARIANT", numbering: "mature/legacy" });
  });
});

describe("structure", () => {
  it("T20: 2 polymer entities; the SIFTS P68871 entity is 2 with strands B, D, F, H (not chosen by description)", () => {
    expect(struct.entities.filter((e) => e.type === "polymer")).toHaveLength(2);
    // Same SIFTS data with descriptions swapped must still pick entity 2.
    const swapped: MmcifStructure = { ...struct, entities: struct.entities.map((e) => ({ ...e, description: e.id === "1" ? "BETA CHAIN" : e.id === "2" ? "ALPHA CHAIN" : e.description })) };
    const { entityId, segments } = entityForAccession(sifts, "P68871");
    expect(entityId).toBe("2");
    expect([...new Set(segments.map((s) => s.labelAsymId))].sort()).toEqual(["B", "D", "F", "H"]);
    expect(mapUniprotPosition(swapped, sifts, "P68871", 7).map((r) => r.entityId)).toEqual(["2", "2", "2", "2"]);
  });
  it("T21: entity 2 (146 aa) aligned to P68871: offset 1, exactly one mismatch (entity 6 V, UniProt 7 E)", () => {
    const e2 = struct.entities.find((e) => e.id === "2")!;
    expect(e2.sequenceCanonical).toHaveLength(146);
    const x = alignmentCrossCheck(e2.sequenceCanonical!, uni.sequence, entityForAccession(sifts, "P68871").segments);
    expect(x.alignment.constantOffset).toBe(1);
    expect(x.alignment.mismatches).toEqual([{ queryPos: 6, referencePos: 7, query: "V", reference: "E" }]);
    expect(x.agrees).toBe(true);
  });
  // research/raw/pdbe/sifts_mappings_uniprot_2hbs.json, research/raw/rcsb/polymer_entity_2HBS_2.json
  it("T22: SIFTS maps P68871 7 -> residue_number 6 / author_residue_number 6 in B, D, F, H; agrees with RCSB align", () => {
    const refs = mapUniprotPosition(struct, sifts, "P68871", 7);
    expect(refs.map((r) => [r.labelAsymId, r.labelSeqId, r.authSeqId])).toEqual([["B", 6, "6"], ["D", 6, "6"], ["F", 6, "6"], ["H", 6, "6"]]);
    const al = parseRcsb.polymerEntity(j("rcsbPolymerEntity")).rcsb_polymer_entity_align[0]!;
    expect([al.provenance_source, al.aligned_regions[0]!.ref_beg_seq_id, al.aligned_regions[0]!.entity_beg_seq_id]).toEqual(["SIFTS", 2, 1]);
  });
  it("T23: poly_seq_scheme seq_id 6 is VAL with auth_seq_num 6; atom_site CA is VAL/VAL in each beta chain", () => {
    for (const ch of ["B", "D", "F", "H"]) {
      const row = struct.polySeqScheme.find((r) => r.labelAsymId === ch && r.labelSeqId === 6)!;
      expect([row.monId, row.authSeqNum]).toEqual(["VAL", "6"]);
      const ca = struct.atoms.find((a) => a.labelAsymId === ch && a.labelSeqId === 6 && a.atomName === "CA")!;
      expect([ca.labelCompId, ca.authCompId]).toEqual(["VAL", "VAL"]);
    }
    expect(mapUniprotPosition(struct, sifts, "P68871", 7).every((r) => r.compId === "VAL" && r.authCompId === "VAL")).toBe(true);
  });
  it("T24: negative: chain B label/auth 7 is GLU and UniProt position 6 is P", () => {
    expect(struct.polySeqScheme.find((r) => r.labelAsymId === "B" && r.labelSeqId === 7)?.monId).toBe("GLU");
    expect(struct.atoms.find((a) => a.authAsymId === "B" && a.authSeqId === "7" && a.atomName === "CA")?.authCompId).toBe("GLU");
    expect(uni.sequence[6 - 1]).toBe("P");
    // A highlight resolved with mature 6 used as a UniProt position lands on a different residue.
    expect(mapUniprotPosition(struct, sifts, "P68871", 6)[0]!.compId).not.toBe("VAL");
  });
  it("T25: _struct_ref_seq db_align_beg (1) disagrees with SIFTS unp_start (2); logged as a known issue, SIFTS used", () => {
    const r = struct.structRefSeq.find((x) => x.strandId === "B")!;
    expect(r.dbAlignBeg).toBe(1);
    expect(sifts.find((s) => s.uniprotAccession === "P68871" && s.authAsymId === "B")!.unpStart).toBe(2);
    const issues = structRefSeqIssues(struct, sifts, "P68871");
    expect(issues.map((i) => i.id)).toEqual(["B", "D", "F", "H"].map((c) => `struct-ref-seq-numbering-2HBS-${c}`));
    const m = JSON.parse(build.files.find((f) => f.path === "residue-mapping-hbs-2HBS.json")!.content);
    expect(m.method).toBe("sifts");
  });
  it("T26: heme label_asym_id J <-> auth_asym_id B, auth_seq_id 153; both kept", () => {
    const d = labelAuthDivergences(struct).find((x) => x.labelAsymId === "J")!;
    expect(d).toEqual({ labelAsymId: "J", authAsymId: "B", monId: "HEM", authSeqNum: "153" });
    const s = JSON.parse(build.files.find((f) => f.path === "structure-2HBS.json")!.content);
    expect(s.chains.find((c: { labelAsymId: string }) => c.labelAsymId === "J")).toEqual({ labelAsymId: "J", authAsymId: "B", entityId: "3", entityType: "non-polymer" });
  });
  it("T27: assembly 1 = A,B,C,D and assembly 2 = E,F,G,H (polymers); default scene uses assembly 1", () => {
    const s = JSON.parse(build.files.find((f) => f.path === "structure-2HBS.json")!.content);
    expect(s.assemblies.map((a: { id: string; polymerAsymIds: string[] }) => [a.id, a.polymerAsymIds])).toEqual([["1", ["A", "B", "C", "D"]], ["2", ["E", "F", "G", "H"]]]);
    expect(s.defaultAssemblyId).toBe("1");
  });
  // research/derived/val6_contacts_2HBS.json (Biopython NeighborSearch)
  it("T28: Val6 contacts at 4.5 A: H contacts B 70, 73, 84, 85, 88; B, D, F none (regression of the derived JSON)", async () => {
    const derived = await fixtureJson<{ chains: Record<string, { residue: string; contacts: [string, number, string][] }> }>("valContactsDerived");
    for (const ch of ["B", "D", "F", "H"]) {
      const c = interChainContacts(struct, ch, "6", ["CG1", "CG2"], 4.5);
      expect(c.residue).toBe("VAL");
      expect(c.contacts.map((x) => [x.authAsymId, x.authSeqId, x.compId])).toEqual(derived.chains[ch]!.contacts);
    }
    const h = interChainContacts(struct, "H", "6", ["CG1", "CG2"], 4.5).contacts.filter((x) => x.compId !== "HOH");
    expect(h.map((x) => `${x.authAsymId}${x.authSeqId}`)).toEqual(["B70", "B73", "B84", "B85", "B88"]);
  });
});

describe("provenance and failure handling", () => {
  it("T29: every curated record has all provenance fields, and each source sha256 matches the stored raw body", async () => {
    const byUrl = new Map(Object.values(inputs).filter(Boolean).map((r) => [r!.url, r!.sha256]));
    // capabilities.json is a derived index (no claims of its own); it names the records it derives from.
    const cap = JSON.parse(build.files.find((f) => f.recordKind === "capabilities")!.content);
    expect(cap.derivedFrom).toContain("variant-hbs.json");
    for (const f of build.files.filter((x) => x.recordKind !== "mmcif" && x.recordKind !== "capabilities")) {
      const rec = JSON.parse(f.content);
      const records = rec.kind === "sequence-set" ? rec.records : [rec];
      for (const r of records) {
        expect(r.provenance, f.path).toBeDefined();
        expect(r.provenance.transformations.length, f.path).toBeGreaterThan(0);
        expect(r.provenance.evidenceCategory, f.path).toBeGreaterThanOrEqual(1);
        for (const s of r.provenance.sources) {
          expect(Provenance.safeParse(s).success, `${f.path} ${s.url}`).toBe(true);
          expect(s.sha256).toBe(byUrl.get(s.url));
        }
      }
    }
    // A body that no longer matches its recorded hash stops the build.
    const tampered = { ...inputs, cds: { ...inputs.cds, body: inputs.cds.body.replace("ATGGTG", "ATGGTC") } };
    await expect(buildSlice(tampered, HBB_CONFIG, { now: "2026-11-01T20:00:00Z" })).rejects.toThrow(/T29-raw-sha256/);
  });
  it("T30: HTML 500 body, GO release-date.json and truncated mmCIF give typed errors, not partial records", async () => {
    // Synthetic: the original variant_recoder HTML 500 page was deleted (research/raw/README.md); same shape.
    const html = "<!DOCTYPE html>\n<html><head><title>500 Internal Server Error</title></head><body>Internal Server Error</body></html>";
    expect(() => parseJsonBody(html)).toThrow(MalformedResponseError);
    const go = await fixtureText("goReleaseDate");
    const e = (() => {
      try {
        parseJsonBody(go);
      } catch (err) {
        return err;
      }
    })() as MalformedResponseError;
    expect(e.kind).toBe("invalid-json");
    expect(() => readMmcifStructure(inputs.mmcif.body.slice(0, 500_000))).toThrow(MalformedResponseError);
    // and the whole build refuses each of them
    await expect(buildSlice({ ...inputs, variantRecoder: { ...inputs.variantRecoder, body: html, sha256: await sha(html) } }, HBB_CONFIG, { now: "2026-11-01T20:00:00Z" })).rejects.toBeInstanceOf(MalformedResponseError);
    const cut = inputs.mmcif.body.slice(0, 500_000);
    await expect(buildSlice({ ...inputs, mmcif: { ...inputs.mmcif, body: cut, sha256: await sha(cut) } }, HBB_CONFIG, { now: "2026-11-01T20:00:00Z" })).rejects.toBeInstanceOf(MalformedResponseError);
  });
  it("T31: version drift is reported, not fatal: UniProt ENSG00000244734.5 vs Ensembl .6; VEP P68871.216 vs 219", () => {
    expect(build.drift.map((d) => [d.id, d.observedValue, d.referenceValue])).toEqual([
      ["uniprot-xref-ensembl-gene-version", "ENSG00000244734.5", "ENSG00000244734.6"],
      ["vep-swissprot-entry-version", "P68871.216", "P68871.219"],
    ]);
    expect(build.drift.every((d) => d.fatal === false)).toBe(true);
    expect(detectDrift({ ensemblGene: { id: "G", version: 1 }, uniprot: { accession: "P", entryVersion: 1, ensemblXrefs: [] }, selectedTranscript: "T.1", vepSwissprot: ["P.1"], maneRefSeq: null, hgncManeSelect: [], uniprotManeSelect: null, clinvarTitle: null })).toEqual([]);
  });
  it("T32: AlphaFold record is evidence class 3, model v6, disclaimer kept, never used to place Val6 (model has Glu at 7)", () => {
    const pm = JSON.parse(build.files.find((f) => f.path === "predicted-model-AF-P68871-F1.json")!.content);
    expect(pm.provenance.evidenceCategory).toBe(3);
    expect(pm.evidence[0].category).toBe(3);
    expect(pm.modelVersion).toBe(6);
    expect(pm.disclaimer).toMatch(/THEORETICAL MODELLING ONLY|CC-BY-4.0/);
    expect(pm.usableForVariantPlacement).toBe(false);
    const pred = JSON.parse(inputs.alphafoldPrediction!.body) as { sequence: string }[];
    expect(pred[0]!.sequence[7 - 1]).toBe("E");
    const m = JSON.parse(build.files.find((f) => f.path === "residue-mapping-hbs-2HBS.json")!.content);
    expect(m.entryId).toBe("2HBS");
    expect(m.provenance.sources.some((s: { source: string }) => s.source === "alphafold")).toBe(false);
    expect(evidence("computational-prediction", "x").category).toBe(3);
  });
});

async function sha(s: string): Promise<string> {
  const { sha256Hex } = await import("@helix/data-adapters");
  return sha256Hex(s);
}

describe("Phase 6: ClinVar review status, conflicts and related records (P6.1.1)", () => {
  it("maps review statuses to ClinVar's documented stars and never guesses an unknown one", () => {
    expect(clinvarReviewStars("practice guideline")).toBe(4);
    expect(clinvarReviewStars("reviewed by expert panel")).toBe(3);
    expect(clinvarReviewStars("criteria provided, multiple submitters, no conflicts")).toBe(2);
    expect(clinvarReviewStars("criteria provided, conflicting classifications")).toBe(1);
    expect(clinvarReviewStars("criteria provided, conflicting interpretations")).toBe(1);
    expect(clinvarReviewStars("criteria provided, single submitter")).toBe(1);
    expect(clinvarReviewStars("no assertion criteria provided")).toBe(0);
    expect(clinvarReviewStars("a status ClinVar never published")).toBeNull();
  });
  it("reads conflicts from ClinVar's words, quoting the basis", () => {
    expect(clinvarConflicts("criteria provided, multiple submitters, no conflicts", "Pathogenic")).toMatchObject({ conflicting: false });
    expect(clinvarConflicts("criteria provided, conflicting classifications", "Conflicting classifications of pathogenicity").conflicting).toBe(true);
    expect(clinvarConflicts("criteria provided, single submitter", "Likely benign").basis).toMatch(/does not assert agreement/);
  });
  it("writes clinvar-hbs.json: 2 stars, no conflicts, 9 related records kept separate, no trait names", () => {
    const f = build.files.find((x) => x.path === "clinvar-hbs.json")!;
    const r = JSON.parse(f.content);
    expect([r.accessionVersion, r.classification, r.reviewStars, r.conflicts.conflicting]).toEqual(["VCV000015333.183", "Pathogenic", 2, false]);
    expect(r.relatedRecords).toHaveLength(9);
    expect(r.relatedRecords.filter((x: { relation: string }) => x.relation === "haplotype-or-compound")).toHaveLength(8);
    expect(r.relatedRecords.filter((x: { includesThisAllele: boolean }) => x.includesThisAllele)).toHaveLength(8);
    const other = r.relatedRecords.find((x: { relation: string }) => x.relation === "other-allele-or-variant");
    expect([other.accessionVersion, other.classification, other.includesThisAllele]).toEqual(["VCV000015175.3", "Likely benign", false]);
    expect(f.content).not.toMatch(/trait_name|Orphanet|MedGen|OMIM/);
    expect(r.evidence[0].category).toBe(2);
    expect(r.provenance.sources.map((x: { recordId: string }) => x.recordId)).toEqual(["esearch rs334", "VCV000015333"]);
    for (const id of ["T33-clinvar-search-covered", "T34-clinvar-review-status", "T35-clinvar-related-records-separate"]) expect(build.validation.find((v) => v.check === id)?.result, id).toBe("pass");
  });
  it("a conflicting review status becomes evidence class 6 and conflicting true", async () => {
    const body = JSON.parse(inputs.clinvar.body);
    body.result["15333"].germline_classification.review_status = "criteria provided, conflicting classifications";
    body.result["15333"].germline_classification.description = "Conflicting classifications of pathogenicity";
    const text = JSON.stringify(body);
    const { sha256Hex } = await import("@helix/data-adapters");
    const b = await buildSlice({ ...inputs, clinvar: { ...inputs.clinvar, body: text, sha256: await sha256Hex(text) } }, HBB_CONFIG, { now: "2026-11-02T00:00:00Z" });
    const r = JSON.parse(b.files.find((x) => x.path === "clinvar-hbs.json")!.content);
    expect([r.reviewStars, r.conflicts.conflicting, r.evidence[0].category]).toEqual([1, true, 6]);
  });
});

describe("Phase 6: full-chain residue mapping of record", () => {
  it("maps P68871 2-147 onto 2HBS B, D, F, H with label = auth = position - 1, read from the records", () => {
    const t = JSON.parse(build.files.find((x) => x.path === "residue-mapping-P68871-2HBS.json")!.content);
    expect(t.kind).toBe("residue-mapping-table");
    expect(t.coverage).toEqual({ firstUniprotPosition: 2, lastUniprotPosition: 147, positions: 146 });
    expect(t.chains).toEqual(["B", "D", "F", "H"]);
    for (const p of t.positions) {
      expect(p.residues.map((r: { labelAsymId: string }) => r.labelAsymId)).toEqual(["B", "D", "F", "H"]);
      for (const r of p.residues) expect([r.labelSeqId, r.authSeqId, r.authAsymId]).toEqual([p.uniprotPosition - 1, String(p.uniprotPosition - 1), r.labelAsymId]);
      expect(p.unobservedChains).toEqual([]);
    }
    expect(t.positions.filter((p: { matchesReference: boolean }) => !p.matchesReference).map((p: { uniprotPosition: number }) => p.uniprotPosition)).toEqual([7]);
    const p7 = t.positions.find((p: { uniprotPosition: number }) => p.uniprotPosition === 7);
    expect(p7.residues.map((r: { compId: string }) => r.compId)).toEqual(["VAL", "VAL", "VAL", "VAL"]);
    expect(t.crossChecks.filter((c: { method: string; agrees: boolean }) => !/not used/.test(c.method)).every((c: { agrees: boolean }) => c.agrees)).toBe(true);
    for (const id of ["T36-full-chain-covers-sifts", "T37-full-chain-agrees-with-variant-mapping", "T38-full-chain-residue-names", "T39-full-chain-alignment-agrees"]) expect(build.validation.find((v) => v.check === id)?.result, id).toBe("pass");
  });
  it("every row equals mapUniprotPosition at the same position (same steps, one record)", () => {
    const t = mapUniprotChain(struct, sifts, "P68871");
    for (const p of [2, 7, 50, 147]) expect(t.rows.find((r) => r.uniprotPosition === p)!.residues).toEqual(mapUniprotPosition(struct, sifts, "P68871", p));
  });
  it("records an unobserved residue on its chain instead of failing the table", () => {
    const scheme = struct.polySeqScheme.map((r) => (r.labelAsymId === "D" && r.labelSeqId === 145 ? { ...r, authSeqNum: null } : r));
    const t = mapUniprotChain({ ...struct, polySeqScheme: scheme }, sifts, "P68871");
    const row = t.rows.find((r) => r.uniprotPosition === 146)!;
    expect(row.unobservedChains).toEqual(["D"]);
    expect(row.residues.map((r) => r.labelAsymId)).toEqual(["B", "F", "H"]);
  });
  it("reads residue names from atom_site, so a changed name shows in its row (the input of T38)", () => {
    const t = mapUniprotChain({ ...struct, atoms: struct.atoms.map((a) => (a.labelAsymId === "B" && a.labelSeqId === 50 ? { ...a, labelCompId: "ALA" } : a)) }, sifts, "P68871");
    const row = t.rows.find((r) => r.uniprotPosition === 51)!;
    expect(row.residues.find((r) => r.labelAsymId === "B")!.compId).toBe("ALA");
  });
});
