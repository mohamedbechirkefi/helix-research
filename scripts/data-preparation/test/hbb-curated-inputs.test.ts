// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * D-H041 item 4 (finding P11-S-01, docs/scientific-validation.md section 7): the committed HBB curated set can be
 * rebuilt offline from public recorded inputs, data/fixtures/hbb/curated/ (scripts/data-preparation/
 * record-hbb-curated-inputs.ts), as the other four sets are from data/fixtures/<set>/. The default HBB fixture set
 * (data/fixtures/hbb/index.json, the Phase 1 and 2 bodies the package tests read) is left as it was.
 *
 * Every source the committed manifest cites is an input of the new set, by URL; each input's bytes are the ones the
 * committed set cites, except the five stated here, which no public body can match: four bodies the committed set
 * cites unredacted (the set was built offline from the snapshot, not through the fixture recorder) whose public copies
 * are redacted under Q-H-LIC-1, and the Ensembl assembly body, recorded nowhere, for which the Phase 1 response to the
 * same URL stands in (the same content in a different key order on every response recorded so far).
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseBuildArgs } from "../lib/build-gene.ts";
import { fixtureIndex, loadFixtureInputs } from "../lib/fixtures.ts";
import { REPO_ROOT } from "../lib/node-env.ts";

/** The inputs whose public bytes differ from the ones data/curated/hbb/manifest.json cites, and why. */
const STATED_DIFFERENCES: Record<string, string> = {
  ensemblAssembly: "recorded nowhere; the Phase 1 body of the same URL",
  vep: "redacted under Q-H-LIC-1",
  uniprot: "the Phase 1 redaction under Q-H-LIC-1",
  clinvar: "redacted under Q-H-LIC-1",
  hgnc: "redacted under Q-H-LIC-1",
};

describe("D-H041 item 4: the HBB set's own recorded inputs", () => {
  it("build-gene.ts takes --fixture-set with --fixtures only", () => {
    expect(parseBuildArgs(["--gene", "hbb", "--fixtures", "--fixture-set", "hbb/curated"])).toEqual({ gene: "hbb", mode: "fixtures", outDir: null, recordFixtures: false, liveSources: [], fixtureSet: "hbb/curated" });
    expect(() => parseBuildArgs(["--gene", "hbb", "--offline", "--fixture-set", "hbb/curated"])).toThrow(/--fixture-set .*--fixtures/);
  });

  it("every source the committed HBB manifest cites is an input of data/fixtures/hbb/curated, with the cited bytes except the stated five", async () => {
    const manifest = JSON.parse(await readFile(join(REPO_ROOT, "data/curated/hbb/manifest.json"), "utf8")) as { sources: { url: string; sha256: string }[] };
    const inputs = await loadFixtureInputs("hbb/curated");
    const byUrl = new Map(Object.entries(inputs).map(([name, r]) => [r!.url, { name, sha256: r!.sha256 }]));
    const differing: string[] = [];
    for (const s of manifest.sources) {
      const i = byUrl.get(s.url);
      expect(i, s.url).toBeDefined();
      if (i!.sha256 !== s.sha256) differing.push(i!.name);
    }
    expect([...new Set(differing)].sort()).toEqual(Object.keys(STATED_DIFFERENCES).sort());
  });

  it("the default HBB fixture set is unchanged: its index points at no file of the new set", async () => {
    const idx = await fixtureIndex("hbb");
    for (const e of Object.values(idx.inputs)) expect(e!.path).not.toMatch(/^data\/fixtures\/hbb\/curated\//);
  });
});
