// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Phase 9, P9.2.2 (docs/phase-9-generalisation.md section 13): coverage as a first-class fact,
 * the method check, NMR handling and the partner entity, on hand-made inputs and on the HBB
 * fixtures with a tampered mmCIF (the body re-hashed so that T29 still holds).
 */
import { describe, expect, it } from "vitest";
import { ValidationFailedError, sha256Hex } from "@helix/data-adapters";
import { Structure } from "@helix/shared-types";
import { loadFixtureInputs } from "../../../scripts/data-preparation/lib/fixtures.ts";
import { ACCEPTED_METHODS, HBB_CONFIG, type SliceInputs, buildSlice, capabilities, coverageFraction, coverageText, inputsFor } from "../src/index.ts";

const NOW = "2026-11-03T00:00:00Z";

/** The HBB fixtures with the mmCIF body edited and re-hashed. */
async function withMmcif(edit: (cif: string) => string): Promise<SliceInputs> {
  const inputs = inputsFor(await loadFixtureInputs("hbb"), HBB_CONFIG);
  const body = edit(inputs.mmcif!.body);
  expect(body).not.toBe(inputs.mmcif!.body);
  return { ...inputs, mmcif: { ...inputs.mmcif!, body, sha256: await sha256Hex(body) } };
}

const failingChecks = async (inputs: SliceInputs): Promise<string> => {
  const e = await buildSlice(inputs, HBB_CONFIG, { now: NOW }).catch((x: unknown) => x);
  expect(e).toBeInstanceOf(ValidationFailedError);
  return String((e as Error).message);
};

describe("coverage words and fraction (rule 3), composed from the numbers alone", () => {
  it("an X-ray entry over almost the whole protein, and a small NMR domain of a long protein with a thousands separator", () => {
    expect(coverageText({ entryId: "2HBS", firstObservedPosition: 2, lastObservedPosition: 147, observedPositions: 146, proteinLength: 147, method: "X-RAY DIFFRACTION", resolution: 2.05, modelCount: 1 })).toBe("2HBS covers residues 2 to 147 of 147 (146 observed positions, 99.3 %; X-RAY DIFFRACTION, 2.05 A)");
    expect(coverageText({ entryId: "1JM7", firstObservedPosition: 1, lastObservedPosition: 103, observedPositions: 103, proteinLength: 1863, method: "SOLUTION NMR", resolution: null, modelCount: 14 })).toBe("1JM7 covers residues 1 to 103 of 1,863 (103 observed positions, 5.5 %; SOLUTION NMR, 14 models, model 1 shown)");
    expect(coverageText({ entryId: "9XYZ", firstObservedPosition: 7, lastObservedPosition: 7, observedPositions: 1, proteinLength: 1000000, method: "SOLUTION NMR", resolution: null, modelCount: 1 })).toBe("9XYZ covers residues 7 to 7 of 1,000,000 (1 observed position, 0.0 %; SOLUTION NMR, 1 model, model 1 shown)");
    expect(coverageFraction(146, 147)).toBe(0.9932);
    expect(coverageFraction(103, 1863)).toBe(0.0553);
    expect(coverageFraction(1480, 1480)).toBe(1);
    expect(ACCEPTED_METHODS).toEqual(["X-RAY DIFFRACTION", "ELECTRON MICROSCOPY", "SOLUTION NMR"]);
  });
  it("the capability reason repeats the structure record's coverage sentence before the cross-reference count", () => {
    const base = { geneId: "G", symbol: "X", biotype: "protein_coding", transcriptSelection: null, hasTranslation: true, protein: { accession: "Q00000", sequenceVerified: true }, verifiedMappings: [{ entryId: "1ABC", uniprotPosition: 61 }], predictedModel: null, variantPositions: [61], pathways: null, associations: null };
    const xrefs = [{ entryId: "1ABC", method: "NMR" }, { entryId: "7XYZ", method: "EM" }];
    const text = "1ABC covers residues 1 to 103 of 1,863 (103 observed positions, 5.5 %; SOLUTION NMR, 14 models, model 1 shown)";
    expect(capabilities({ ...base, experimentalStructures: xrefs, selectedStructure: { entryId: "1ABC", coverage: text } }).experimentalStructure).toEqual({ available: true, reason: `${text}; 2 experimental entries cross-referenced (e.g. 1ABC, NMR)`, evidenceCategory: 1 });
    // A caller without the sentence (none in this repository) keeps the pre-P9.2.2 reason; a set without a selection is unchanged.
    expect(capabilities({ ...base, experimentalStructures: xrefs, selectedStructure: { entryId: "1ABC" } }).experimentalStructure.reason).toBe("2 experimental entries (e.g. 1ABC, NMR)");
    expect(capabilities({ ...base, experimentalStructures: xrefs, selectedStructure: null }).experimentalStructure.reason).toMatch(/^no experimental structure selected in the gene specification/);
  });
});

describe("T47 (method) and T48 (coverage) on the HBB fixtures and on tampered mmCIF bodies", () => {
  it("HBB: T47 and T48 pass with the entry's numbers; the structure record carries coverage, one model, no ensemble, the entry's own cross-references and the alpha-chain partner", async () => {
    const inputs = inputsFor(await loadFixtureInputs("hbb"), HBB_CONFIG);
    const b = await buildSlice(inputs, HBB_CONFIG, { now: NOW });
    expect(b.validation.find((v) => v.check === "T47-structure-method")).toMatchObject({ result: "pass", detail: "2HBS method X-RAY DIFFRACTION; resolution 2.05 A; 1 model(s) in atom_site; model 1 is the one mapped, measured and shown" });
    expect(b.validation.find((v) => v.check === "T48-structure-coverage")).toMatchObject({ result: "pass", detail: "146 of 146 mapped positions observed in model 1 on chain(s) B,D,F,H, 2-147; protein length 147; fraction 0.9932 = 146/147; words match the numbers" });
    // The two checks sit before the drift check, so every earlier row keeps its index.
    const ids = b.validation.map((v) => v.check);
    expect(ids.slice(-3)).toEqual(["T47-structure-method", "T48-structure-coverage", "T31-drift-recorded"]);
    expect(ids).not.toContain("T40-variant-residue-observed");
    const s = Structure.parse(JSON.parse(b.files.find((f) => f.path === "structure-2HBS.json")!.content));
    expect(s.coverage).toEqual({ uniprotAccession: "P68871", chains: ["B", "D", "F", "H"], firstObservedPosition: 2, lastObservedPosition: 147, observedPositions: 146, mappedPositions: 146, proteinLength: 147, fraction: 0.9932, text: "2HBS covers residues 2 to 147 of 147 (146 observed positions, 99.3 %; X-RAY DIFFRACTION, 2.05 A)" });
    expect([s.modelCount, s.modelShown, s.nmrEnsemble, s.mappedEntityId, s.resolutionAngstrom]).toEqual([1, 1, null, "2", 2.05]);
    expect(s.partners).toEqual([{ entityId: "1", description: "HEMOGLOBIN S (DEOXY), ALPHA CHAIN", strandIds: ["A", "C", "E", "G"], uniprotAccession: "P69905", siftsUniprot: ["P69905"] }]);
    expect(s.entities.find((e) => e.entityId === "2")).toMatchObject({ uniprotFromEntry: ["P68871"], sequenceDifferences: [{ strandId: "B", labelSeqId: 6, residue: "VAL", referenceResidue: "GLU", referencePosition: 6, details: "variant" }, { strandId: "D" }, { strandId: "F" }, { strandId: "H" }] });
    expect(s.evidence[0]!.statement).toBe("2HBS: X-RAY DIFFRACTION, 2.05 A resolution, deposited 1997-05-06.");
    expect(s.evidence[1]!.statement).toBe("2HBS covers residues 2 to 147 of 147 (146 observed positions, 99.3 %; X-RAY DIFFRACTION, 2.05 A); SIFTS maps 146 position(s) of P68871 onto chain(s) B, D, F, H.");
    const cap = JSON.parse(b.files.find((f) => f.path === "capabilities.json")!.content) as { experimentalStructure: { reason: string } };
    expect(cap.experimentalStructure.reason).toBe("2HBS covers residues 2 to 147 of 147 (146 observed positions, 99.3 %; X-RAY DIFFRACTION, 2.05 A); 348 experimental entries cross-referenced (e.g. 1A00, X-ray)");
    // The predicted-model record carries the band fractions the prediction record states (rule 5).
    const pm = JSON.parse(b.files.find((f) => f.path === "predicted-model-AF-P68871-F1.json")!.content) as { plddtFractions: Record<string, number> };
    expect(pm.plddtFractions).toEqual({ veryLow: 0, low: 0.007, confident: 0.02, veryHigh: 0.973 });
  });
  it("T47 refuses a method outside the three, an X-ray entry without a resolution, and an NMR method with one", async () => {
    expect(await failingChecks(await withMmcif((c) => c.replace("_exptl.method            'X-RAY DIFFRACTION'", "_exptl.method            'NEUTRON DIFFRACTION'")))).toMatch(/T47-structure-method: 2HBS method NEUTRON DIFFRACTION \(not one of X-ray diffraction, electron microscopy, solution NMR\)/);
    expect(await failingChecks(await withMmcif((c) => c.replace(/^_refine\.ls_d_res_high\s+2\.05\s*$/m, "_refine.ls_d_res_high ?")))).toMatch(/T47-structure-method: 2HBS method X-RAY DIFFRACTION; resolution none; 1 model\(s\)/);
    const nmrWithResolution = await failingChecks(await withMmcif((c) => c.replace("_exptl.method            'X-RAY DIFFRACTION'", "_exptl.method            'SOLUTION NMR'")));
    expect(nmrWithResolution).toMatch(/T47-structure-method: 2HBS method SOLUTION NMR; resolution 2.05 A/);
    // The refusal names the other checks that saw the method change, never a coverage mismatch: the words are recomposed from the numbers.
    expect(nmrWithResolution).not.toMatch(/T48/);
  });
  it("T48 holds on a tampered entry too (the words are composed from the numbers); the contacts of an entry with hydrogens are heavy-atom contacts and the scope says so", async () => {
    // Give one atom of 2HBS a hydrogen element: the reader keeps it, the contact scope names the exclusion, and nothing else moves.
    const inputs = await withMmcif((c) => c.replace(/^(ATOM\s+1\s+)N(\s+N\s+)/m, (_m, a: string, b: string) => `${a}H${b.replace("N", "H")}`));
    const b = await buildSlice(inputs, HBB_CONFIG, { now: NOW });
    expect(b.validation.find((v) => v.check === "T48-structure-coverage")).toMatchObject({ result: "pass" });
    const contacts = JSON.parse(b.files.find((f) => f.path === "contacts-hbs-2HBS.json")!.content) as { scope: string; evidence: { statement: string }[] };
    expect(contacts.scope).toBe("asymmetric unit, model 1, no symmetry mates; heavy atoms only (the entry deposits hydrogen atoms, which are not counted)");
    expect(contacts.evidence[0]!.statement).toMatch(/heavy atoms on both sides; the entry's hydrogen atoms are not counted/);
  });
});
