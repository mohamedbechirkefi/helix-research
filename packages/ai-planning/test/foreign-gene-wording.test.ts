// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Phase 11 usability inspection finding P11-U-01 (helix-app docs/reviews/phase-11-usability/findings.md), author
 * decision D-H043 item 1: the rule-based planner's foreign-gene refusal said "CFTR is not in the curated records
 * available here; only HBB is." on the HBB set of a build that curates CFTR too. The rules know only the open set's
 * symbols; the build's curated sets (the datasets index) are now given to the rules by the caller (the app's
 * Director), outside the planning context, so that neither the prompt nor the trusted context changes. A gene that
 * is one of the build's curated sets is named as such; a gene outside the build keeps the earlier sentence.
 * Pinned before the change (the wording tests failed on the rules then consumed).
 */
import { describe, expect, it } from "vitest";
import { deterministicPlan, type PlanningContext } from "../src/index.ts";
import { hbbContext } from "./load.ts";

const BUILD_SETS = ["HBB", "CFTR", "BRCA1", "SLC6A3", "FAAH2"];
const ctx = (): PlanningContext => ({ ...hbbContext(), routeByCues: true, cueRules: "dh010", answer: "first", currentWorld: "dna" });
// The third argument is new with D-H043; called through a loose signature so that this pin typechecks before the change.
const plan = (q: string, buildSets?: readonly string[]) => (deterministicPlan as (query: string, c: PlanningContext, o?: { buildSets?: readonly string[] }) => ReturnType<typeof deterministicPlan>)(q, ctx(), buildSets ? { buildSets } : undefined);

describe("foreign-gene refusal names another curated set of the build as such (D-H043 item 1, P11-U-01)", () => {
  it("a gene that is one of the build's curated sets", () => {
    const { plan: p, rule } = plan("Where does CFTR F508del occur?", BUILD_SETS);
    expect(rule).toBe("foreign-gene");
    expect(p.outcome).toBe("unsupported");
    expect(p.actions).toEqual([]);
    expect(p.reason).toBe("CFTR is one of this build's curated sets, not the one open here; open it from the welcome (Choose another gene).");
  });
  it("matches the build's symbols whatever the case of the list", () => {
    expect(plan("Show BRCA1", ["hbb", "brca1"]).plan.reason).toBe("BRCA1 is one of this build's curated sets, not the one open here; open it from the welcome (Choose another gene).");
  });
  it("a gene outside the build keeps the earlier sentence", () => {
    const { plan: p, rule } = plan("Show TP53", BUILD_SETS);
    expect(rule).toBe("foreign-gene");
    expect(p.reason).toBe("TP53 is not in the curated records available here; only HBB is.");
  });
  it("with no build list given, the earlier sentence for every gene", () => {
    expect(plan("Where does CFTR F508del occur?").plan.reason).toBe("CFTR is not in the curated records available here; only HBB is.");
  });
  it("two curated sets and one outside the build: each sentence for its genes", () => {
    expect(plan("Compare CFTR, BRCA1 and TP53", BUILD_SETS).plan.reason).toBe(
      "CFTR, BRCA1 are among this build's curated sets, not the one open here; open one from the welcome (Choose another gene). TP53 is not in the curated records available here; only HBB is.",
    );
  });
});
