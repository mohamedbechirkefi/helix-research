// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Author decision D-H044 item 2 (2026-11-13), the follow-up to D-H043 item 1 (P11-U-01): the rule-based planner
 * detected a foreign gene only by its list of well-known genes or by the pattern /^[A-Z]{2,6}\d{1,2}[A-Z]?$/, so on
 * the HBB set "Show SLC6A3" fell to the generic unsupported answer, and HBB was not detected on another set. The
 * rules now also recognise the build's curated set symbols (RuleOptions.buildSets, given by the caller) as gene
 * names, so another curated gene gets the D-H043 sentence. The open set's own symbol stays excluded; the sentence for
 * a gene outside the build is kept; recognition is not widened beyond the build's symbols. Case follows the existing
 * token pattern (upper-case symbols only): a lower-case "slc6a3" is out of scope, as a lower-case "cftr" already is.
 * Pinned before the change (the recognition tests failed on the rules then consumed).
 */
import { describe, expect, it } from "vitest";
import { deterministicPlan, type PlanningContext } from "../src/index.ts";
import { cftrContext, hbbContext } from "./load.ts";

const BUILD_SETS = ["BRCA1", "CFTR", "FAAH2", "HBB", "SLC6A3"];
const OTHER_SET = (g: string) => `${g} is one of this build's curated sets, not the one open here; open it from the welcome (Choose another gene).`;
const prep = (c: PlanningContext): PlanningContext => ({ ...c, routeByCues: true, cueRules: "dh010", answer: "first", currentWorld: "dna" });
const onHbb = (q: string, buildSets?: readonly string[]) => deterministicPlan(q, prep(hbbContext()), buildSets ? { buildSets } : {});
const onCftr = (q: string, buildSets?: readonly string[]) => deterministicPlan(q, prep(cftrContext()), buildSets ? { buildSets } : {});

describe("the rules recognise the build's curated set symbols as gene names (D-H044 item 2)", () => {
  it("SLC6A3 on the HBB set gets the D-H043 sentence", () => {
    const { plan: p, rule } = onHbb("Show SLC6A3", BUILD_SETS);
    expect(rule).toBe("foreign-gene");
    expect(p.outcome).toBe("unsupported");
    expect(p.actions).toEqual([]);
    expect(p.reason).toBe(OTHER_SET("SLC6A3"));
  });
  it("HBB on another set (CFTR) gets the D-H043 sentence", () => {
    const { plan: p, rule } = onCftr("Show HBB", BUILD_SETS);
    expect(rule).toBe("foreign-gene");
    expect(p.outcome).toBe("unsupported");
    expect(p.reason).toBe(OTHER_SET("HBB"));
  });
  it("a build symbol recognised whatever the case of the build list", () => {
    expect(onHbb("Show SLC6A3", ["hbb", "slc6a3"]).plan.reason).toBe(OTHER_SET("SLC6A3"));
  });
  it("a newly recognised build symbol and a gene outside the build: each sentence for its genes", () => {
    expect(onHbb("Compare SLC6A3 and TP53", BUILD_SETS).plan.reason).toBe(`${OTHER_SET("SLC6A3")} TP53 is not in the curated records available here; only HBB is.`);
  });
  it("the open set's own symbol stays excluded", () => {
    expect(onHbb("Which pathways list HBB?", BUILD_SETS).rule).not.toBe("foreign-gene");
    expect(onCftr("Which pathways list CFTR?", BUILD_SETS).rule).not.toBe("foreign-gene");
  });
  it("a gene outside the build keeps the earlier sentence", () => {
    expect(onHbb("Show TP53", BUILD_SETS).plan.reason).toBe("TP53 is not in the curated records available here; only HBB is.");
  });
  it("not widened: without a build list, SLC6A3 and HBB are not recognised", () => {
    expect(onHbb("Show SLC6A3").rule).not.toBe("foreign-gene");
    expect(onCftr("Show HBB").rule).not.toBe("foreign-gene");
  });
  it("not widened: a symbol neither in the build nor matched by the earlier pattern is not recognised", () => {
    expect(onHbb("Show GAPDH", BUILD_SETS).rule).not.toBe("foreign-gene");
  });
  it("case as the existing pattern: a lower-case symbol is out of scope", () => {
    expect(onHbb("show slc6a3", BUILD_SETS).rule).not.toBe("foreign-gene");
    expect(onHbb("show cftr", BUILD_SETS).rule).not.toBe("foreign-gene");
  });
});
