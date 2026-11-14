// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Author decision D-H051 question 104 (a) (2026-11-14), carrying D-H045 item 2: rules version 6 (D-H044 item 2)
 * recognised another curated gene of the build only as its symbol in capitals, so "show cftr", "Show DAT" or "solute
 * carrier family 6 member 3" on the HBB set fell to another rule. Rules version 7 also recognises, for every curated
 * set of the build other than the open one, its symbol in any case, its HGNC aliases and its HGNC approved name,
 * read from the curated gene records (RuleOptions.buildGenes; the symbols of RuleOptions.buildSets in any case).
 * Matching is case-insensitive and whole-word (no letter or digit on either side), whitespace-tolerant inside a
 * name, at least three characters with a letter; the open set's own symbol, aliases and name stay excluded, and a
 * term shared by two sets is not used. A token the earlier rule read as a gene outside the build is replaced by the
 * curated set it is an alias of. Pinned before the change (the recognition tests fail on rules version 6).
 *
 * The build list is read here from data/curated/<set>/gene.json the way helix-app's copy-data.mjs writes the
 * datasets index (symbol; aliases; the HGNC name, Ensembl's description without its "[Source:...]" tail).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { deterministicPlan, type PlanningContext } from "../src/index.ts";
import { cftrContext, hbbContext, REPO_ROOT } from "./load.ts";

interface BuildGene { symbol: string; name: string | null; aliases: string[] }
const BUILD_GENES: BuildGene[] = ["brca1", "cftr", "faah2", "hbb", "slc6a3"].map((d) => {
  const g = JSON.parse(readFileSync(join(REPO_ROOT, "data", "curated", d, "gene.json"), "utf8")) as { symbol: string; description?: string; aliases?: string[] };
  return { symbol: g.symbol, name: typeof g.description === "string" ? g.description.replace(/\s*\[Source:[^\]]*\]\s*$/, "").trim() || null : null, aliases: g.aliases ?? [] };
});
const BUILD_SETS = BUILD_GENES.map((g) => g.symbol);
const OTHER_SET = (g: string) => `${g} is one of this build's curated sets, not the one open here; open it from the welcome (Choose another gene).`;
const prep = (c: PlanningContext): PlanningContext => ({ ...c, routeByCues: true, cueRules: "dh010", answer: "first", currentWorld: "dna" });
// The options as the app passes them: the symbols and the records (an older caller passes the symbols only).
const opts = { buildSets: BUILD_SETS, buildGenes: BUILD_GENES } as Parameters<typeof deterministicPlan>[2];
const onHbb = (q: string, o = opts) => deterministicPlan(q, prep(hbbContext()), o);
const onCftr = (q: string, o = opts) => deterministicPlan(q, prep(cftrContext()), o);
const other = (r: ReturnType<typeof deterministicPlan>) => ({ rule: r.rule, outcome: r.plan.outcome, actions: r.plan.actions, reason: r.plan.reason });
const sent = (g: string) => ({ rule: "foreign-gene", outcome: "unsupported", actions: [], reason: OTHER_SET(g) });

describe("the build list comes from the curated records", () => {
  it("five sets, each with its symbol, name and aliases", () => {
    expect(BUILD_SETS).toEqual(["BRCA1", "CFTR", "FAAH2", "HBB", "SLC6A3"]);
    expect(BUILD_GENES.find((g) => g.symbol === "SLC6A3")).toEqual({ symbol: "SLC6A3", name: "solute carrier family 6 member 3", aliases: ["DAT"] });
    expect(BUILD_GENES.find((g) => g.symbol === "HBB")).toEqual({ symbol: "HBB", name: "hemoglobin subunit beta", aliases: ["CD113t-C", "beta-globin"] });
  });
});

describe("rules version 7 recognises another curated gene by its symbol in any case, an alias or its name (D-H051 104 a)", () => {
  it("a lower-case symbol (the symbols alone suffice)", () => {
    expect(other(onHbb("show slc6a3"))).toEqual(sent("SLC6A3"));
    expect(other(onHbb("show cftr"))).toEqual(sent("CFTR"));
    expect(other(onHbb("show slc6a3", { buildSets: BUILD_SETS }))).toEqual(sent("SLC6A3"));
    expect(other(onCftr("Show hbb please"))).toEqual(sent("HBB"));
  });
  it("an HGNC alias, in any case", () => {
    expect(other(onHbb("Show DAT"))).toEqual(sent("SLC6A3"));
    expect(other(onHbb("what is dat?"))).toEqual(sent("SLC6A3"));
    expect(other(onCftr("Show beta-globin"))).toEqual(sent("HBB"));
    expect(other(onHbb("Open TNR-CFTR"))).toEqual(sent("CFTR"));
  });
  it("an alias the earlier pattern read as a gene outside the build is named as the curated set", () => {
    expect(other(onHbb("Show BRCC1"))).toEqual(sent("BRCA1"));
    expect(other(onHbb("Show MRP7"))).toEqual(sent("CFTR"));
  });
  it("the HGNC approved name, whole, whitespace-tolerant", () => {
    expect(other(onHbb("Show the solute carrier family 6 member 3"))).toEqual(sent("SLC6A3"));
    expect(other(onCftr("Show me Hemoglobin  Subunit\tBeta"))).toEqual(sent("HBB"));
    expect(other(onHbb("open fatty acid amide hydrolase 2"))).toEqual(sent("FAAH2"));
    expect(other(onHbb("CF transmembrane conductance regulator, please"))).toEqual(sent("CFTR"));
  });
  it("two curated sets, and a curated set with a gene outside the build, in the order asked", () => {
    expect(onHbb("Compare dat and TP53").plan.reason).toBe(`${OTHER_SET("SLC6A3")} TP53 is not in the curated records available here; only HBB is.`);
    expect(onHbb("Compare beta-globin with cftr and dat").plan.reason).toBe("CFTR, SLC6A3 are among this build's curated sets, not the one open here; open one from the welcome (Choose another gene).");
  });
});

describe("rules version 7 keeps what it must", () => {
  it("the open set's own symbol, aliases and name stay excluded", () => {
    for (const q of ["show hbb", "Show beta-globin", "Show the hemoglobin subunit beta", "Which pathways list HBB?"]) expect(onHbb(q).rule).not.toBe("foreign-gene");
    for (const q of ["show cftr", "Show the CF transmembrane conductance regulator protein", "Show TNR-CFTR"]) expect(onCftr(q).rule).not.toBe("foreign-gene");
  });
  it("no false positive on ordinary words or a part of a name", () => {
    for (const q of ["show the transporter", "show the data", "update the view", "cat", "What is a solute carrier?", "Show the beta chain", "Which fatty acid binds here?", "Explain DNA repair"]) expect(onHbb(q).rule, q).not.toBe("foreign-gene");
    for (const q of ["Show the hemoglobin", "What does the transmembrane domain do?"]) expect(onCftr(q).rule, q).not.toBe("foreign-gene");
  });
  it("a gene outside the build keeps the earlier sentence and is still recognised in capitals only", () => {
    expect(onHbb("Show TP53").plan.reason).toBe("TP53 is not in the curated records available here; only HBB is.");
    expect(onHbb("show tp53").rule).not.toBe("foreign-gene");
  });
  it("not widened without a build list", () => {
    for (const q of ["show slc6a3", "Show DAT", "Show the solute carrier family 6 member 3"]) expect(onHbb(q, {}).rule).not.toBe("foreign-gene");
  });
  it("names the curated records do not carry stay unrecognised as curated sets (a stated limit)", () => {
    // DAT1 is an HGNC previous symbol of SLC6A3 and "dopamine transporter" its protein's name; neither is in the gene record.
    expect(onHbb("Show DAT1").plan.reason).toBe("DAT1 is not in the curated records available here; only HBB is.");
    expect(onHbb("show the dopamine transporter").rule).not.toBe("foreign-gene");
  });
});
