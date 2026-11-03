// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Phase 9 (P9.1.3, plan section 14 rules 2, 3 and 5): the disease-associations record and the
 * `associationView` capability built from the recorded Open Targets response of each set, the checks
 * T49 to T51 on the fixtures and on tampered bodies, and the flag's two settings.
 */
import { describe, expect, it } from "vitest";
import { EXCLUDED_DATASOURCES, ValidationFailedError, sha256Hex } from "@helix/data-adapters";
import { ASSOCIATION_NEVER_CAUSAL, CapabilityReport, DiseaseAssociationsRecord } from "@helix/shared-types";
import { loadFixtureInputs } from "../../../scripts/data-preparation/lib/fixtures.ts";
import { readSpec } from "../../../scripts/data-preparation/lib/build-gene.ts";
import { HBB_CONFIG, type RawRecord, type SliceConfig, type SliceInputs, buildSlice, capabilities, inputsFor } from "../src/index.ts";

const NOW = "2026-11-04T00:00:00Z";

async function associationsOf(set: string, config: SliceConfig, inputs?: SliceInputs) {
  const ins = inputs ?? inputsFor(await loadFixtureInputs(set), config);
  const b = await buildSlice(ins, config, { now: NOW });
  const file = b.files.find((f) => f.path === "associations.json");
  const cap = CapabilityReport.parse(JSON.parse(b.files.find((f) => f.path === "capabilities.json")!.content));
  return { b, inputs: ins, rec: file ? DiseaseAssociationsRecord.parse(JSON.parse(file.content)) : null, recordKind: file?.recordKind ?? null, cap };
}

/** The recorded response with its body edited, re-hashed so that T29 holds and the edit is what the build sees. */
async function tampered(inputs: SliceInputs, edit: (body: { data: { meta: Record<string, unknown>; target: { id: string; associatedDiseases: { rows: Record<string, unknown>[] } } } }) => void): Promise<SliceInputs> {
  const r = inputs.opentargetsAssociations!;
  const body = JSON.parse(r.body);
  edit(body);
  const text = JSON.stringify(body);
  const raw: RawRecord = { ...r, body: text, sha256: await sha256Hex(text) };
  return { ...inputs, opentargetsAssociations: raw };
}

describe("the associationView capability (plan §14 rule 3)", () => {
  const base = { geneId: "G", symbol: "X", biotype: "protein_coding", transcriptSelection: null, hasTranslation: true, protein: { accession: "Q00000", sequenceVerified: true }, experimentalStructures: [], selectedStructure: null, verifiedMappings: [], predictedModel: null, variantPositions: [], pathways: null };
  it("not requested, none kept, and available with the count and the top association's name and score", () => {
    expect(capabilities({ ...base, associations: null }).associationView).toEqual({ available: false, reason: "associations not requested in the gene specification", evidenceCategory: 6 });
    expect(capabilities({ ...base, associations: { count: 0, kept: 0, top: null } }).associationView).toEqual({ available: false, reason: "no Open Targets association for this gene", evidenceCategory: 6 });
    expect(capabilities({ ...base, associations: { count: 552, kept: 25, top: { diseaseName: "beta thalassemia", score: 0.8419 } } }).associationView).toEqual({ available: true, reason: "552 Open Targets associations, 25 kept by score; top: beta thalassemia (score 0.8419); association, never causal", evidenceCategory: 2 });
    expect(capabilities({ ...base, associations: { count: 1, kept: 1, top: { diseaseName: "d", score: 0.1 } } }).associationView.reason).toMatch(/^1 Open Targets association, 1 kept by score/);
  });
});

describe("the disease-associations record built from the recorded response of each set (plan §14 rule 2)", () => {
  it("HBB: the first page by score, the versions of the response, the excluded datasource scores dropped and named, the never-causal sentence, one provenance row (POST), derived from the gene record", async () => {
    const { b, inputs, rec, recordKind, cap } = await associationsOf("hbb", HBB_CONFIG);
    expect(recordKind).toBe("disease-associations");
    const r = rec!;
    expect(r.derivedFrom).toEqual(["gene.json"]);
    expect([r.ensemblGeneId, r.approvedSymbol]).toEqual([HBB_CONFIG.ensemblGeneId, HBB_CONFIG.hgncSymbol]);
    expect(r.platform).toEqual({ apiVersion: "26.9.0", dataVersion: "26.09" });
    expect(r.request).toEqual({ pageIndex: 0, pageSize: 25, orderByScore: true });
    expect(r.count).toBeGreaterThanOrEqual(r.keptCount);
    expect(r.keptCount).toBe(r.associations.length);
    expect(r.associations.length).toBe(25);
    const scores = r.associations.map((a) => a.score);
    expect(scores).toEqual([...scores].sort((x, y) => y - x));
    for (const a of r.associations) {
      expect(a.diseaseId).toMatch(/^[A-Za-z]+_[0-9A-Za-z]+$/);
      expect(a.diseaseName.length).toBeGreaterThan(0);
      expect(a.datasourceScores.every((x) => !EXCLUDED_DATASOURCES.includes(x.id))).toBe(true);
      expect(a.droppedDatasourceIds.every((id) => EXCLUDED_DATASOURCES.includes(id))).toBe(true);
    }
    expect(r.droppedDatasources.excluded).toEqual([...EXCLUDED_DATASOURCES]);
    expect(r.droppedDatasources.observed).toContain("europepmc");
    expect(r.droppedDatasources.observed.every((id) => r.datasourceIdsObserved.includes(id))).toBe(true);
    expect(r.droppedDatasources.reason).toMatch(/registry section 7/);
    expect(r.note).toBe(ASSOCIATION_NEVER_CAUSAL);
    // The evidence: class 2, the never-causal limitation, the aggregate note naming the dropped ids.
    expect(r.evidence[0]!.category).toBe(2);
    expect(r.evidence[0]!.statement).toMatch(/^Open Targets 26\.9\.0 \(data 26\.09\) lists \d+ disease associations for HBB \(ENSG00000244734\); the 25 highest-scoring are kept, the top being .+ \(MONDO_\d+, score 0\.\d+\)\.$/);
    expect(r.evidence[0]!.limitations[0]).toBe(`An Open Targets ${ASSOCIATION_NEVER_CAUSAL}.`);
    expect(r.evidence[0]!.limitations[1]).toMatch(/aggregates over every datasource, including the dropped ones \(.*europepmc.*\)/);
    // "causes" appears only inside the never-causal sentence; no diagnosis anywhere.
    expect(JSON.stringify(r).replace(new RegExp(ASSOCIATION_NEVER_CAUSAL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "")).not.toMatch(/\bcauses?\b|diagnos/i);
    // One provenance row: the one POST, released as the platform's versions, CC0.
    expect(r.provenance.sources).toHaveLength(1);
    expect(r.provenance.sources[0]).toMatchObject({ source: "opentargets", method: "POST", url: "https://api.platform.opentargets.org/api/v4/graphql", sourceRelease: "Open Targets 26.9.0 (data 26.09)", licence: "CC0-1.0", sha256: inputs.opentargetsAssociations!.sha256 });
    expect(r.provenance.sources[0]!.recordId).toBe("target ENSG00000244734 associatedDiseases page 0 size 25");
    expect(r.provenance.evidenceCategory).toBe(2);
    for (const id of ["T49-association-target", "T49-association-rows", "T50-association-order-and-exclusion", "T51-association-versions"]) expect(b.validation.find((v) => v.check === id), id).toMatchObject({ result: "pass" });
    expect(b.validation.find((v) => v.check === "T51-association-versions")!.detail).toBe("record api 26.9.0, data 26.09; the response's meta: api 26.9.0, data 26.09");
    expect(cap.associationView).toEqual({ available: true, reason: `${r.count} Open Targets associations, 25 kept by score; top: ${r.associations[0]!.diseaseName} (score ${r.associations[0]!.score}); association, never causal`, evidenceCategory: 2 });
    expect(cap.derivedFrom).toContain("associations.json");
    expect(b.summary).toMatchObject({ associations: { release: "Open Targets 26.9.0 (data 26.09)", count: r.count, kept: 25 } });
  });
  it("CFTR, FAAH2 and BRCA1: the same record on their own responses; BRCA1 drops the Cancer Gene Census scores; no HBB text", async () => {
    for (const set of ["cftr", "faah2", "brca1"]) {
      const config = await readSpec(set);
      const { b, rec, cap } = await associationsOf(set, config);
      const r = rec!;
      expect(r.ensemblGeneId, set).toBe(config.ensemblGeneId);
      expect(r.associations.length, set).toBe(25);
      expect(r.platform, set).toEqual({ apiVersion: "26.9.0", dataVersion: "26.09" });
      expect(b.validation.filter((v) => /^T(49|50|51)-/.test(v.check) && v.result !== "pass"), set).toEqual([]);
      expect(cap.associationView.available, set).toBe(true);
      expect(JSON.stringify(r), set).not.toMatch(/HBB|P68871|ENSG00000244734|sickle/);
      if (set === "brca1") expect(r.droppedDatasources.observed).toContain("cancer_gene_census");
    }
  });
  it("T49 refuses a score outside 0 to 1 and T50 a page out of score order; the build then writes nothing", async () => {
    const inputs = inputsFor(await loadFixtureInputs("hbb"), HBB_CONFIG);
    const bad = await tampered(inputs, (body) => {
      body.data.target.associatedDiseases.rows[0]!.score = 1.2;
    });
    const e1 = await buildSlice(bad, HBB_CONFIG, { now: NOW }).catch((x: unknown) => x);
    expect(e1).toBeInstanceOf(ValidationFailedError);
    expect(String((e1 as Error).message)).toMatch(/T49-association-rows/);
    const swapped = await tampered(inputs, (body) => {
      const rows = body.data.target.associatedDiseases.rows;
      const first = rows[0]!;
      rows[0] = rows[1]!;
      rows[1] = first;
    });
    const e2 = await buildSlice(swapped, HBB_CONFIG, { now: NOW }).catch((x: unknown) => x);
    expect(e2).toBeInstanceOf(ValidationFailedError);
    expect(String((e2 as Error).message)).toMatch(/T50-association-order-and-exclusion: out of order at/);
    const other = await tampered(inputs, (body) => {
      body.data.target = { ...body.data.target, id: "ENSG00000000001" };
    });
    const e3 = await buildSlice(other, HBB_CONFIG, { now: NOW }).catch((x: unknown) => x);
    expect(String((e3 as Error).message)).toMatch(/T49-association-target/);
  });
  it("associations: false writes no record, asks for no Open Targets input and reports the view as not requested; true without the input is refused with the input named", async () => {
    const config: SliceConfig = { ...HBB_CONFIG, associations: false };
    const inputs = inputsFor(await loadFixtureInputs("hbb"), config);
    expect(inputs.opentargetsAssociations).toBeUndefined();
    const { rec, cap, b } = await associationsOf("hbb", config, inputs);
    expect(rec).toBeNull();
    expect(cap.associationView).toEqual({ available: false, reason: "associations not requested in the gene specification", evidenceCategory: 6 });
    expect(cap.derivedFrom).not.toContain("associations.json");
    expect(b.sources.some((s) => s.source === "opentargets")).toBe(false);
    expect(b.validation.some((v) => /^T(49|50|51)-/.test(v.check))).toBe(false);
    const without = inputsFor(await loadFixtureInputs("hbb"), HBB_CONFIG);
    delete without.opentargetsAssociations;
    const e = await buildSlice(without, HBB_CONFIG, { now: NOW }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ValidationFailedError);
    expect(String((e as Error).message)).toMatch(/opentargetsAssociations is required by the gene specification/);
  });
});
