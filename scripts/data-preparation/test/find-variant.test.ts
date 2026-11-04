// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Phase 9, P9.2.3: the reference-variant finder (lib/find-variant.ts) on hand-made ClinVar
 * summaries and a hand-made structure check; no live call. The protein-change reader, the
 * verdicts (what is skipped and why), the ranking (review status, then supporting submissions,
 * then accession number), the walk (the first eligible candidate whose residue is observed in a
 * kept entry; later ranks not checked; a candidate whose UniProt residue disagrees with its
 * protein change is skipped at the structure step), and the cross-reference coverage reader.
 */
import { describe, expect, it } from "vitest";
import type { ClinvarRecord, UniprotEntry } from "@helix/data-adapters";
import { ACCEPTED_CLASSIFICATIONS, candidateOf, compareCandidates, findVariant, parseProteinChange, rankCandidates } from "../lib/find-variant.ts";
import { type CandidateReport, pdbCrossReferencesCovering } from "../lib/structure-candidates.ts";

// ---------------------------------------------------------------- hand-made records

function record(over: Partial<ClinvarRecord> & { uid: string; title: string }): ClinvarRecord {
  const n = over.uid.padStart(9, "0");
  return {
    objectType: "single nucleotide variant",
    accession: `VCV${n}`,
    accessionVersion: `VCV${n}.1`,
    proteinChange: null,
    classification: "Pathogenic",
    reviewStatus: "criteria provided, multiple submitters, no conflicts",
    lastEvaluated: null,
    traitCount: 1,
    supportingSubmissionCount: 2,
    cdnaChanges: [],
    canonicalSpdi: [],
    locations: [],
    isHaplotypeOrCompound: false,
    clinicalImpact: null,
    oncogenicity: null,
    recordStatus: "",
    variationNames: [over.title],
    variantTypes: ["single nucleotide variant"],
    dbSnpIds: [`rs${over.uid}`],
    molecularConsequences: ["missense variant"],
    ...over,
  };
}
function uniprot(sequence: string, pdb: UniprotEntry["pdb"]): UniprotEntry {
  return { accession: "P00001", entryName: "GENE1_HUMAN", reviewed: true, organism: { scientificName: "Homo sapiens", taxonId: 9606 }, entryVersion: 1, sequenceVersion: 1, sequence, length: sequence.length, md5: "x", crc64: "y", features: [], processing: [], maneSelect: null, maneSelects: [], ensembl: [], pdb, comments: [] };
}
function report(entryId: string, residue: number, o: { observed: boolean; kept: boolean; mutation?: string | null }): CandidateReport {
  return {
    entryId,
    method: "ELECTRON MICROSCOPY",
    resolutionAngstrom: 3.2,
    rcsbResolutionCombined: [3.2],
    modelCount: 1,
    nmrEnsemble: null,
    entityId: "1",
    chains: ["A"],
    entityMutation: o.mutation ?? null,
    entityLength: 10,
    siftsSegments: [{ labelAsymId: "A", unpStart: 1, unpEnd: 10, labelSeqStart: 1, labelSeqEnd: 10 }],
    residue: { uniprotPosition: residue, uniprotResidue: "X", observedOn: o.observed ? [{ labelAsymId: "A", authAsymId: "A", labelSeqId: residue, authSeqId: String(residue), compId: "XXX" }] : [], unobservedOn: o.observed ? [] : ["A"], coveredBySifts: true },
    sequenceMismatches: [],
    coverage: { firstObserved: 1, lastObserved: 10, observedPositions: 10, mappedPositions: 10, proteinLength: 10, fraction: 1 },
    otherPolymerEntities: [],
    observed: o.observed,
    kept: o.kept,
    verdict: o.kept ? `residue ${residue} observed on A${residue} XXX; the entity equals UniProt over the mapped segments` : o.observed ? `residue ${residue} observed, but the entity declares pdbx_mutation "${o.mutation}"` : `residue ${residue} is not observed in atom_site on chain(s) A`,
  };
}

describe("find-variant: the protein change is read from the record name", () => {
  it("a substitution p.Xxx000Yyy gives the three-letter and one-letter residues and the position", () => {
    expect(parseProteinChange("NM_001044.5(SLC6A3):c.253C>T (p.Arg85Trp)")).toEqual({ change: { hgvsP: "p.Arg85Trp", referenceThree: "Arg", position: 85, alternateThree: "Trp", referenceOne: "R", alternateOne: "W" }, reason: null });
  });
  it("frameshift, nonsense, deletion, deletion-insertion, duplication, insertion, synonymous and a missing change are skipped with the reason", () => {
    const reason = (name: string): string => parseProteinChange(name).reason ?? "";
    expect(reason("NM_1(X):c.1del (p.Leu5fs)")).toMatch(/^frameshift/);
    expect(reason("NM_1(X):c.1del (p.Leu5SerfsTer12)")).toMatch(/^frameshift/);
    expect(reason("NM_1(X):c.1G>T (p.Glu5Ter)")).toMatch(/^nonsense/);
    expect(reason("NM_1(X):c.1G>T (p.Glu5*)")).toMatch(/^nonsense/);
    expect(reason("NM_1(X):c.1_3del (p.Phe508del)")).toMatch(/^deletion .*plan section 11 rule 1/);
    expect(reason("NM_1(X):c.1_3delinsA (p.Phe508delinsLeu)")).toMatch(/^deletion-insertion/);
    expect(reason("NM_1(X):c.1_3dup (p.Phe508dup)")).toMatch(/^duplication/);
    expect(reason("NM_1(X):c.1_2insAAA (p.Phe508_Gly509insLeu)")).toMatch(/^insertion/);
    expect(reason("NM_1(X):c.3C>T (p.Leu5=)")).toMatch(/^synonymous/);
    expect(reason("NM_1(X):c.3C>T (p.Leu5Leu)")).toMatch(/changes no residue/);
    expect(reason("NM_1(X):c.3C>T")).toBe("no protein change in the record name");
    expect(reason("NM_1(X):c.3C>T (p.Xyz5Leu)")).toMatch(/outside the twenty/);
  });
});

describe("find-variant: the verdict on a summary", () => {
  it("accepts the three Pathogenic classifications at two stars or more with a dbSNP id and a substitution", () => {
    for (const classification of ACCEPTED_CLASSIFICATIONS) expect(candidateOf(record({ uid: "1", title: "NM_1(X):c.1A>G (p.Lys1Glu)", classification })).skipReason).toBeNull();
    expect(candidateOf(record({ uid: "1", title: "NM_1(X):c.1A>G (p.Lys1Glu)", reviewStatus: "reviewed by expert panel" })).reviewStars).toBe(3);
    expect(candidateOf(record({ uid: "1", title: "NM_1(X):c.1A>G (p.Lys1Glu)", reviewStatus: "practice guideline" })).reviewStars).toBe(4);
  });
  it("skips, with every reason named: another classification, a one-star or zero-star status, a conflict, a haplotype, a non-missense consequence, a non-SNV type, no dbSNP id, a frameshift", () => {
    const why = (over: Partial<ClinvarRecord>): string => candidateOf(record({ uid: "1", title: "NM_1(X):c.1A>G (p.Lys1Glu)", ...over })).skipReason ?? "eligible";
    expect(why({ classification: "Uncertain significance" })).toBe('classification "Uncertain significance" is not Pathogenic or Likely pathogenic');
    expect(why({ reviewStatus: "criteria provided, single submitter" })).toBe('review status "criteria provided, single submitter" is 1 star (the rule asks for at least 2)');
    expect(why({ reviewStatus: "no assertion criteria provided" })).toBe('review status "no assertion criteria provided" is 0 stars (the rule asks for at least 2)');
    expect(why({ reviewStatus: "criteria provided, conflicting classifications", classification: "Conflicting classifications of pathogenicity" })).toMatch(/^classification "Conflicting classifications of pathogenicity" is not Pathogenic or Likely pathogenic; review status "criteria provided, conflicting classifications" is 1 star/);
    expect(why({ reviewStatus: "something new" })).toBe('review status "something new" is outside ClinVar\'s star table');
    expect(why({ isHaplotypeOrCompound: true, objectType: "Haplotype" })).toBe("Haplotype: not a single variant");
    expect(why({ molecularConsequences: ["nonsense"] })).toBe('molecular consequence "nonsense" does not include "missense variant"');
    expect(why({ molecularConsequences: [] })).toBe('molecular consequence absent does not include "missense variant"');
    expect(why({ variantTypes: ["Indel"] })).toBe("variant type \"Indel\": the builder's substitution path takes a single nucleotide variant");
    expect(why({ dbSnpIds: [] })).toBe("no dbSNP id among the variation cross-references");
    expect(why({ title: "NM_1(X):c.1del (p.Lys1fs)" })).toMatch(/^frameshift/);
    // Several reasons are all named, in order.
    expect(why({ reviewStatus: "criteria provided, single submitter", dbSnpIds: [] })).toBe('review status "criteria provided, single submitter" is 1 star (the rule asks for at least 2); no dbSNP id among the variation cross-references');
  });
  it("--min-stars 1 (the fallback) admits a single-submitter record and still refuses zero stars", () => {
    expect(candidateOf(record({ uid: "1", title: "NM_1(X):c.1A>G (p.Lys1Glu)", reviewStatus: "criteria provided, single submitter" }), 1).skipReason).toBeNull();
    expect(candidateOf(record({ uid: "1", title: "NM_1(X):c.1A>G (p.Lys1Glu)", reviewStatus: "no assertion criteria provided" }), 1).skipReason).toBe('review status "no assertion criteria provided" is 0 stars (the rule asks for at least 1)');
  });
});

describe("find-variant: the ranking", () => {
  const a = record({ uid: "500", title: "NM_1(X):c.1A>G (p.Lys1Glu)", reviewStatus: "criteria provided, multiple submitters, no conflicts", supportingSubmissionCount: 9 });
  const b = record({ uid: "20", title: "NM_1(X):c.4A>G (p.Lys2Glu)", reviewStatus: "reviewed by expert panel", supportingSubmissionCount: 1 });
  const c = record({ uid: "300", title: "NM_1(X):c.7A>G (p.Lys3Glu)", reviewStatus: "criteria provided, multiple submitters, no conflicts", supportingSubmissionCount: 9 });
  const d = record({ uid: "10", title: "NM_1(X):c.10A>G (p.Lys4Glu)", reviewStatus: "criteria provided, multiple submitters, no conflicts", supportingSubmissionCount: 12 });
  const skipped = record({ uid: "1", title: "NM_1(X):c.13A>G (p.Lys5Glu)", reviewStatus: "criteria provided, single submitter", supportingSubmissionCount: 99 });
  it("review stars first, then supporting submissions, then the accession number; skipped records follow unranked", () => {
    const ranked = rankCandidates([a, skipped, b, c, d]);
    expect(ranked.map((x) => [x.uid, x.rank])).toEqual([
      ["20", 1],
      ["10", 2],
      ["300", 3],
      ["500", 4],
      ["1", null],
    ]);
    expect(compareCandidates(candidateOf(a), candidateOf(c))).toBeGreaterThan(0);
    expect(ranked[4]!.skipReason).toMatch(/1 star/);
  });
});

describe("find-variant: the walk over the structure check", () => {
  const seq = "MKLRGSTAVP"; // 10 residues
  const pdb: UniprotEntry["pdb"] = [
    { id: "1AAA", method: "EM", resolution: "3.10 A", chains: "A=2-6" },
    { id: "1BBB", method: "EM", resolution: "3.20 A", chains: "A/B=1-10" },
    { id: "1CCC", method: "X-ray", resolution: "2.00 A", chains: "A=8-10" },
  ];
  // Rank 1: p.Lys2Glu (UniProt K at 2): 1AAA observes but is a mutant (refused), 1BBB observes and is kept.
  const first = record({ uid: "100", title: "NM_1(X):c.4A>G (p.Lys2Glu)", reviewStatus: "reviewed by expert panel" });
  const second = record({ uid: "200", title: "NM_1(X):c.13G>A (p.Gly5Arg)" });
  // Disagrees with UniProt (position 3 is L, the change says Arg): skipped at the structure step, no request made.
  const wrong = record({ uid: "50", title: "NM_1(X):c.7C>T (p.Arg3Trp)", reviewStatus: "practice guideline" });
  const verdicts: Record<string, { observed: boolean; kept: boolean; mutation?: string }> = { "1AAA": { observed: true, kept: false, mutation: "L3Y" }, "1BBB": { observed: true, kept: true }, "1CCC": { observed: false, kept: false } };
  function adapters(records: ClinvarRecord[], count = records.length) {
    const asked: string[] = [];
    return {
      asked,
      adapters: {
        esearch: async (symbol: string, retmax: number) => {
          asked.push(`esearch ${symbol} ${retmax}`);
          return { data: { count, uids: records.map((r) => r.uid) } };
        },
        esummary: async (uids: string[]) => {
          asked.push(`esummary ${uids.join(",")}`);
          return { data: records.filter((r) => uids.includes(r.uid)) };
        },
        uniprotEntry: async () => ({ data: uniprot(seq, pdb), release: "2026_03", releaseDate: "02-September-2026" }),
        checkStructure: async (entryId: string, _acc: string, _seq: string, residue: number) => {
          asked.push(`check ${entryId} ${residue}`);
          return report(entryId, residue, verdicts[entryId]!);
        },
      },
    };
  }
  it("the first eligible candidate (by rank) whose residue is observed in a kept entry is the choice; the mutant entry is refused first; lower ranks are not checked", async () => {
    const { asked, adapters: ad } = adapters([second, first, wrong]);
    const r = await findVariant(ad, "GENE1", "P00001");
    expect(asked).toEqual(["esearch GENE1 100", "esummary 200,100,50", "check 1AAA 2", "check 1BBB 2"]);
    expect(r.esearch).toEqual({ count: 3, returned: 3, capped: false });
    expect(r.candidates.map((c) => [c.uid, c.rank, c.verdict.split(":")[0]])).toEqual([
      ["50", 1, "skipped at the structure step"],
      ["100", 2, "chosen"],
      ["200", 3, "not checked"],
    ]);
    expect(r.candidates[0]!.verdict).toBe("skipped at the structure step: UniProt P00001 has L at 3, the protein change says Arg (R); the record's transcript numbering is not the entry's");
    expect(r.candidates[1]!.structure).toMatchObject({ residue: 2, uniprotResidue: "K", entriesCovering: ["1AAA", "1BBB"], unparsedCrossReferences: [], chosenEntry: "1BBB" });
    expect(r.candidates[1]!.structure!.candidates.map((x) => [x.entryId, x.kept])).toEqual([
      ["1AAA", false],
      ["1BBB", true],
    ]);
    expect(r.chosen?.candidate.uid).toBe("100");
    expect(r.chosen?.entry.entryId).toBe("1BBB");
    expect(r.counts).toEqual({ summarised: 3, eligible: 3, skipped: 0, structureChecked: 1, skippedByReason: {} });
    expect(r.stoppedBecause).toBe("rank 2 (VCV000000100, p.Lys2Glu) has its residue observed in 1BBB");
  });
  it("no eligible candidate: nothing is checked, the choice is null and the reasons are counted; a capped esearch says so", async () => {
    const one = record({ uid: "7", title: "NM_1(X):c.4A>G (p.Lys2Glu)", reviewStatus: "criteria provided, single submitter" });
    const { asked, adapters: ad } = adapters([one], 150);
    const r = await findVariant(ad, "GENE1", "P00001", { retmax: 100 });
    expect(asked).toEqual(["esearch GENE1 100", "esummary 7"]);
    expect(r.chosen).toBeNull();
    expect(r.esearch.capped).toBe(true);
    expect(r.counts.skippedByReason).toEqual({ 'review status "criteria provided, single submitter" is 1 star (the rule asks for at least 2)': 1 });
    expect(r.stoppedBecause).toBe("no eligible candidate");
    // The fallback the plan allows, and only then: minStars 1 admits it.
    const r1 = await findVariant(adapters([one]).adapters, "GENE1", "P00001", { minStars: 1 });
    expect([r1.minStars, r1.chosen?.candidate.uid, r1.chosen?.entry.entryId]).toEqual([1, "7", "1BBB"]);
  });
  it("a residue observed in no kept entry moves the walk to the next rank; when every rank fails the result says so", async () => {
    // p.Pro10Ser: only 1BBB and 1CCC cover 10; make 1BBB not observed there, 1CCC not observed.
    const tenth = record({ uid: "900", title: "NM_1(X):c.28C>T (p.Pro10Ser)", reviewStatus: "practice guideline" });
    const v: Record<string, { observed: boolean; kept: boolean; mutation?: string }> = { ...verdicts, "1BBB": { observed: false, kept: false } };
    const { adapters: ad, asked } = adapters([tenth, first]);
    ad.checkStructure = async (entryId: string, _a: string, _s: string, residue: number) => {
      asked.push(`check ${entryId} ${residue}`);
      return report(entryId, residue, residue === 10 ? v[entryId]! : verdicts[entryId]!);
    };
    const r = await findVariant(ad, "GENE1", "P00001");
    expect(asked.filter((x) => x.startsWith("check"))).toEqual(["check 1BBB 10", "check 1CCC 10", "check 1AAA 2", "check 1BBB 2"]);
    expect(r.candidates[0]!.verdict).toBe("residue 10 is observed in no kept entry (1BBB: not observed; 1CCC: not observed)");
    expect(r.chosen?.candidate.uid).toBe("100");
    const only = adapters([tenth]);
    only.adapters.checkStructure = async (entryId: string, _a: string, _s: string, residue: number) => report(entryId, residue, v[entryId]!);
    const none = await findVariant(only.adapters, "GENE1", "P00001");
    expect(none.chosen).toBeNull();
    expect(none.stoppedBecause).toBe("every eligible candidate was checked; none has its residue observed in a kept entry");
  });
});

describe("structure-candidates: the cross-references covering a residue", () => {
  it("reads 'A=66-620', 'A/B=1-10, C=30-40' and keeps UniProt's order; an unparsable Chains property is reported, not guessed", () => {
    const pdb = [
      { id: "8Y2C", method: "EM", resolution: "3.16 A", chains: "A=66-620" },
      { id: "1XXX", method: "X-ray", resolution: "2.00 A", chains: "A/B=1-10, C=30-40" },
      { id: "2YYY", method: "X-ray", resolution: "2.00 A", chains: "-" },
      { id: "3ZZZ", method: "X-ray", resolution: null, chains: "A=100-200" },
    ];
    expect(pdbCrossReferencesCovering(pdb, 85)).toEqual({ covering: [pdb[0]], unparsed: ["2YYY"] });
    expect(pdbCrossReferencesCovering(pdb, 35).covering.map((x) => x.id)).toEqual(["1XXX"]);
    expect(pdbCrossReferencesCovering(pdb, 150).covering.map((x) => x.id)).toEqual(["8Y2C", "3ZZZ"]);
    expect(pdbCrossReferencesCovering(pdb, 20).covering).toEqual([]);
  });
});
