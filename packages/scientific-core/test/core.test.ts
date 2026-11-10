// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureJson, loadFixtureInputs } from "../../../scripts/data-preparation/lib/fixtures.ts";
import { REPO_ROOT } from "../../../scripts/data-preparation/lib/node-env.ts";
import { HttpClient, HttpStatusError, NotFoundError, MalformedResponseError, isHelixDataError, parseEnsembl, parseHgnc } from "@helix/data-adapters";
import { EVIDENCE_CATEGORIES, type EvidenceBasis } from "@helix/shared-types";
import {
  HBB_CONFIG,
  acquireSlice,
  alignGlobalFreeEnds,
  buildSlice,
  capabilities,
  classify,
  classifyClinvarReview,
  evidence,
  md5Hex,
  resolveGeneQuery,
  reverseComplement,
  selectTranscript,
  translate,
} from "../src/index.ts";

describe("sequence utilities", () => {
  it("md5 matches RFC 1321 test vectors", () => {
    expect(md5Hex("")).toBe("d41d8cd98f00b204e9800998ecf8427e");
    expect(md5Hex("abc")).toBe("900150983cd24fb0d6963f7d28e17f72");
    expect(md5Hex("12345678901234567890123456789012345678901234567890123456789012345678901234567890")).toBe("57edf4a22be3c955ac49da2e2107b67a");
  });
  it("translation and reverse complement", () => {
    expect(translate("ATGGAGTAA")).toBe("ME*");
    expect(translate("ATGGAGTAAGGG", { toStop: true })).toBe("ME");
    expect(() => translate("ATGG")).toThrow(/multiple of 3/);
    expect(reverseComplement("ATGC")).toBe("GCAT");
  });
  it("alignment reports offset, identity and mismatches", () => {
    const r = alignGlobalFreeEnds("VHLTPV", "MVHLTPE");
    expect(r.constantOffset).toBe(1);
    expect(r.mismatches).toEqual([{ queryPos: 6, referencePos: 7, query: "V", reference: "E" }]);
  });
});

describe("evidence classification (§5)", () => {
  it("maps every basis to a fixed class, with no silent upgrades", () => {
    const expected: Record<EvidenceBasis, number> = {
      "experimental-structure-observation": 1,
      "computed-from-experimental-data": 1,
      "curated-database-annotation": 2,
      "reviewed-clinical-submission": 2,
      "reference-sequence-derivation": 3,
      "computational-prediction": 3,
      "inference-not-verified": 4,
      illustration: 5,
      "missing-or-conflicting": 6,
    };
    for (const [b, c] of Object.entries(expected)) expect(classify(b as EvidenceBasis), b).toBe(c);
    expect(evidence("illustration", "animated folding").categoryLabel).toBe(EVIDENCE_CATEGORIES[5]);
    expect(evidence("curated-database-annotation", "x").limitations.join(" ")).toMatch(/not an observation made here/);
  });
  it("ClinVar conflicting review statuses become class 6", () => {
    expect(classify(classifyClinvarReview("criteria provided, conflicting classifications"))).toBe(6);
    expect(classify(classifyClinvarReview("criteria provided, multiple submitters, no conflicts"))).toBe(2);
  });
  it("every record of the HBB build carries claim-level evidence with a valid class", async () => {
    const b = await buildSlice(await loadFixtureInputs(), HBB_CONFIG, { now: "2026-11-01T00:00:00Z" });
    const seen = new Set<number>();
    for (const f of b.files.filter((x) => x.recordKind !== "mmcif" && x.recordKind !== "capabilities" && x.recordKind !== "questions")) {
      const rec = JSON.parse(f.content);
      for (const r of rec.kind === "sequence-set" ? rec.records : [rec]) {
        expect(r.evidence.length, f.path).toBeGreaterThan(0);
        for (const e of r.evidence) seen.add(e.category);
        expect(r.provenance.evidenceCategory).toBe(r.evidence[0].category);
      }
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4]);
  });
});

describe("capability checks (P2.4.6)", () => {
  it("HBB: everything available; the variant highlight rests on the experimental structure", async () => {
    const b = await buildSlice(await loadFixtureInputs(), HBB_CONFIG, { now: "2026-11-01T00:00:00Z" });
    const cap = JSON.parse(b.files.find((f) => f.path === "capabilities.json")!.content);
    for (const k of ["transcriptView", "proteinView", "experimentalStructure", "predictedStructure", "verifiedResidueMapping", "variantHighlight"]) expect(cap[k].available, k).toBe(true);
    expect(cap.predictedStructure.evidenceCategory).toBe(3);
    expect(cap.variantHighlight.evidenceCategory).toBe(1);
  });
  // data/fixtures/hbb/ensembl/lookup_symbol_HBBP1_expand_mane.json (live, 2026-11-01)
  it("HBBP1 (real record): a pseudogene with no protein and no structure", async () => {
    const g = parseEnsembl.gene(await fixtureJson("hbbp1Lookup"));
    expect(g.biotype).toMatch(/pseudogene/);
    const sel = (() => {
      try {
        return selectTranscript(g).selection;
      } catch {
        return null;
      }
    })();
    const t = g.Transcript.find((x) => sel && x.id === sel.selected.id);
    const cap = capabilities({
      geneId: g.id,
      symbol: g.display_name,
      biotype: g.biotype,
      transcriptSelection: sel,
      hasTranslation: t?.Translation !== undefined,
      protein: null,
      experimentalStructures: [],
      selectedStructure: null,
      verifiedMappings: [],
      predictedModel: null,
      variantPositions: [],
      pathways: null,
      associations: null,
    });
    expect(cap.proteinView.available).toBe(false);
    expect(cap.proteinView.reason).toMatch(/pseudogene/);
    expect(cap.experimentalStructure).toMatchObject({ available: false, evidenceCategory: 6 });
    expect(cap.verifiedResidueMapping.available).toBe(false);
    expect(cap.variantHighlight.available).toBe(false);
  });
  it("predicted-only protein: a variant is never placed on a predicted model", () => {
    const cap = capabilities({
      geneId: "G",
      symbol: "X",
      biotype: "protein_coding",
      transcriptSelection: null,
      hasTranslation: true,
      protein: { accession: "Q00000", sequenceVerified: true },
      experimentalStructures: [],
      selectedStructure: null,
      verifiedMappings: [],
      predictedModel: { modelId: "AF-Q00000-F1", version: 6 },
      variantPositions: [42],
      pathways: null,
      associations: null,
    });
    expect(cap.predictedStructure.available).toBe(true);
    expect(cap.variantHighlight.available).toBe(false);
    expect(cap.variantHighlight.reason).toMatch(/never used to place/);
    expect(cap.transcriptView.available).toBe(false);
    expect(cap.pathwayView).toEqual({ available: false, reason: "pathways not requested in the gene specification", evidenceCategory: 6 });
  });
  it("pathwayView (P9.1.2, plan §12 rule 4): available only when a membership qualifies for the opening rule; the reason names the count and the opening pathway as the rule's choice; each refusal says why", () => {
    const base = {
      geneId: "G",
      symbol: "X",
      biotype: "protein_coding",
      transcriptSelection: null,
      hasTranslation: true,
      protein: { accession: "Q00000", sequenceVerified: true },
      experimentalStructures: [],
      selectedStructure: null,
      verifiedMappings: [],
      predictedModel: null,
      variantPositions: [],
      associations: null,
    };
    expect(capabilities({ ...base, pathways: { membershipCount: 0, opening: null, reason: "no Reactome pathway lists this protein" } }).pathwayView).toEqual({ available: false, reason: "no Reactome pathway lists this protein", evidenceCategory: 6 });
    // Memberships but none qualifies: unavailable with the rule's own sentence.
    const ruleSentence = "2 membership(s), none a non-disease pathway with a diagram (R-HSA-1: a disease pathway; R-HSA-2: no diagram), so no opening pathway is chosen";
    expect(capabilities({ ...base, pathways: { membershipCount: 2, opening: null, reason: ruleSentence } }).pathwayView).toEqual({ available: false, reason: ruleSentence, evidenceCategory: 6 });
    expect(capabilities({ ...base, pathways: { membershipCount: 3, opening: { stableId: "R-HSA-7", name: "Some pathway" }, reason: "r" } }).pathwayView).toEqual({
      available: true,
      reason: "3 Reactome memberships; opens on Some pathway, R-HSA-7 (the rule's choice: fewest participants among non-disease pathways with a diagram)",
      evidenceCategory: 2,
    });
    expect(capabilities({ ...base, pathways: { membershipCount: 1, opening: { stableId: "R-HSA-7", name: "Some pathway" }, reason: "r" } }).pathwayView.reason).toMatch(/^1 Reactome membership; opens on /);
    // No wording calls a pathway primary (plan §12 rule 3, amended).
    expect(JSON.stringify(capabilities({ ...base, pathways: { membershipCount: 3, opening: { stableId: "R-HSA-7", name: "Some pathway" }, reason: "r" } }))).not.toMatch(/primary/i);
  });
});

describe("gene resolution", () => {
  it("reports ambiguity instead of guessing", async () => {
    const [hbb] = parseHgnc(await fixtureJson("hgnc"));
    const other = { ...hbb!, hgncId: "HGNC:1", symbol: "OTHER", ensemblGeneId: "ENSG00000000001", aliases: ["beta-globin"] };
    expect(resolveGeneQuery("beta-globin", [hbb!, other]).status).toBe("ambiguous");
    expect(resolveGeneQuery("HBB", [hbb!, other]).status).toBe("resolved");
  });
  // helix-app D-H036 item 4: a gene's full HGNC name, from the bundled records, opens it (no live lookup).
  it("matches the full gene name, case-insensitive and whitespace-tolerant", async () => {
    const [hbb] = parseHgnc(await fixtureJson("hgnc"));
    expect(hbb!.name).toBe("hemoglobin subunit beta");
    const cftr = { ...hbb!, hgncId: "HGNC:1884", symbol: "CFTR", name: "CF transmembrane conductance regulator", ensemblGeneId: "ENSG00000001626", aliases: ["ABC35"], previousSymbols: [] };
    const recs = [hbb!, cftr];
    for (const q of ["hemoglobin subunit beta", "Hemoglobin Subunit Beta", "  hemoglobin   subunit\tbeta  "]) {
      expect(resolveGeneQuery(q, recs)).toEqual({ status: "resolved", matchedBy: "name", hgncId: "HGNC:4827", symbol: "HBB", ensemblGeneId: hbb!.ensemblGeneId });
    }
    expect(resolveGeneQuery("cf transmembrane conductance regulator", recs)).toMatchObject({ status: "resolved", matchedBy: "name", symbol: "CFTR" });
    // Only the whole name: a part of it is not a match.
    expect(resolveGeneQuery("hemoglobin", recs).status).toBe("not-found");
    expect(resolveGeneQuery("subunit beta", recs).status).toBe("not-found");
    // Symbols, aliases and previous symbols keep their order and wins.
    expect(resolveGeneQuery("hbb", recs)).toMatchObject({ status: "resolved", matchedBy: "symbol", symbol: "HBB" });
    expect(resolveGeneQuery("abc35", recs)).toMatchObject({ status: "resolved", matchedBy: "alias", symbol: "CFTR" });
    // Two records with the same name are ambiguous, never a guess.
    const twin = { ...cftr, hgncId: "HGNC:2", symbol: "TWIN", aliases: [] };
    expect(resolveGeneQuery("CF transmembrane conductance regulator", [hbb!, cftr, twin]).status).toBe("ambiguous");
  });
});

/** fetch mock answering the live acquisition URLs from recorded fixtures. */
async function fixtureFetchFor(overrides: Record<string, () => Response> = {}): Promise<typeof fetch> {
  const inputs = await loadFixtureInputs();
  const recs = Object.values(inputs).filter((r) => r !== undefined);
  return (async (u: RequestInfo | URL) => {
    const url = decodeURI(typeof u === "string" ? u : u instanceof URL ? u.href : u.url);
    for (const [k, f] of Object.entries(overrides)) if (url.includes(k)) return f();
    const exact = recs.find((r) => r.url === url);
    if (exact) return new Response(exact.body, { status: 200, headers: exact.headers });
    if (url.includes("/variation/human/rs334")) return new Response(inputs.variation.body);
    if (url.includes("esummary.fcgi")) return new Response(inputs.clinvar.body);
    if (url.includes("esearch.fcgi") && inputs.clinvarSearch) return new Response(inputs.clinvarSearch.body);
    // Synthetic einfo body (the recorded one was deleted as not needed; research/raw/README.md).
    if (url.includes("einfo.fcgi")) return new Response('{"einforesult":{"dbinfo":[{"dbbuild":"Build261025-1250.1","lastupdate":"2026/10/25 12:50"}]}}');
    return new Response("not recorded", { status: 404 });
  }) as typeof fetch;
}

describe("acquisition and graceful errors (P2.5.2)", () => {
  it("acquireSlice derives every dependent URL from earlier answers and feeds a valid build", async () => {
    const urls: string[] = [];
    const f = await fixtureFetchFor();
    const http = new HttpClient({ fetch: (async (u: RequestInfo | URL, i?: RequestInit) => (urls.push(String(u)), f(u, i))) as typeof fetch });
    const inputs = await acquireSlice(http, HBB_CONFIG);
    expect(urls.some((u) => u.includes("/lookup/id/ENST00000335295?"))).toBe(true); // from the selection rule
    expect(urls.some((u) => u.includes("/map/cds/ENST00000335295/19..21"))).toBe(true); // from c.20 -> codon 7
    expect(urls.some((u) => u.includes("11:5226982..5227022:1"))).toBe(true); // from hgvsg position +/- 20
    expect(urls.some((u) => u.endsWith("/polymer_entity/2HBS/2"))).toBe(true); // from SIFTS
    expect(urls.some((u) => u.endsWith("/assembly/2HBS/1"))).toBe(true); // assembly containing chain B
    // Phase 6: the esummary asks for every uid that the rsID esearch returned, never a typed-in list.
    expect(urls.some((u) => u.includes("esearch.fcgi?db=clinvar&term=rs334&"))).toBe(true);
    expect(urls.some((u) => u.includes("esummary.fcgi?db=clinvar&id=446748,446747,446738,446737,446736,446735,446731,446730,15333,15175&"))).toBe(true);
    expect(urls.every((u) => !/email=/i.test(u))).toBe(true);
    const b = await buildSlice(inputs, HBB_CONFIG, { now: "2026-11-01T00:00:00Z" });
    expect(b.validation.every((v) => v.result !== "fail")).toBe(true);
  });

  it("a missing record surfaces as NotFoundError with its URL", async () => {
    const http = new HttpClient({ fetch: await fixtureFetchFor({ "uniprotkb/P68871": () => new Response('{"messages":["not found"]}', { status: 404 }) }) });
    const e = await acquireSlice(http, HBB_CONFIG).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(NotFoundError);
    expect((e as NotFoundError).url).toContain("P68871");
  });

  it("API downtime (persistent 503) surfaces as a retryable HttpStatusError after back-off", async () => {
    const http = new HttpClient({ maxAttempts: 2, backoffBaseMs: 1, fetch: await fixtureFetchFor({ "data.rcsb.org": () => new Response("<html>down</html>", { status: 503 }) }) });
    const e = await acquireSlice(http, HBB_CONFIG).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(HttpStatusError);
    expect(isHelixDataError(e) && e.retryable).toBe(true);
  });

  it("a maintenance HTML page served with 200 is MalformedResponseError, not a record", async () => {
    const http = new HttpClient({ fetch: await fixtureFetchFor({ "pdbe/api": () => new Response("<!DOCTYPE html><html>maintenance</html>", { status: 200 }) }) });
    const e = await acquireSlice(http, HBB_CONFIG).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(MalformedResponseError);
  });
});

describe("platform-agnostic runtime packages (amendment A-1)", () => {
  it("no Node-only APIs in packages/*/src", async () => {
    const offenders: string[] = [];
    for (const pkg of ["shared-types", "data-adapters", "scientific-core", "ai-planning"]) {
      const walk = async (dir: string): Promise<void> => {
        for (const e of await readdir(dir, { withFileTypes: true })) {
          const p = join(dir, e.name);
          if (e.isDirectory()) await walk(p);
          else if (p.endsWith(".ts")) {
            const src = await readFile(p, "utf8");
            if (/from\s+["']node:|require\(|\bprocess\.|\bBuffer\b|__dirname|import\.meta\.dirname/.test(src)) offenders.push(p.slice(REPO_ROOT.length + 1));
          }
        }
      };
      await walk(join(REPO_ROOT, "packages", pkg, "src"));
    }
    expect(offenders).toEqual([]);
  });
  it("every source file carries the SPDX header", async () => {
    const missing: string[] = [];
    const walk = async (dir: string): Promise<void> => {
      for (const e of await readdir(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory() && e.name !== "node_modules") await walk(p);
        else if (p.endsWith(".ts") && !(await readFile(p, "utf8")).startsWith("// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0")) missing.push(p.slice(REPO_ROOT.length + 1));
      }
    };
    await walk(join(REPO_ROOT, "packages"));
    await walk(join(REPO_ROOT, "scripts/data-preparation"));
    expect(missing).toEqual([]);
  });
});
