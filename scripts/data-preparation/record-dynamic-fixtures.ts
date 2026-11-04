// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Record the dynamic-mode test inputs (Phase 9, P9.3.1; plan section 16 rule 5): for each of the
 * five genes chosen once (TP53, EGFR, INS, APOE, HBA1), the live resolution against HGNC and the
 * live acquisition of a dynamic build (Ensembl, HGNC, UniProt, AlphaFold DB only; user agent
 * helix-research; no identifier), redacted under Q-H-LIC-1 as the fixture recorder does, written
 * under data/fixtures/dynamic/<symbol>/ with a MANIFEST.tsv per source folder and an index.json in
 * the fixture shape. The build runs over the redacted records before anything is written, so a set
 * whose dynamic build the checks refuse is reported and not recorded.
 *
 * These are test inputs, not curated sets: nothing is written under data/curated/.
 *
 * Usage: node scripts/data-preparation/record-dynamic-fixtures.ts [--gene=TP53[,EGFR]] [--force]
 *   --gene   record only these symbols (default: the five of the plan)
 *   --force  re-record a symbol whose fixture folder exists (the default skips it: recorded once)
 */
import { access } from "node:fs/promises";
import { join, relative } from "node:path";
import { HttpClient } from "@helix/data-adapters";
import { DYNAMIC_FIXTURE_GENES, DYNAMIC_GENERATOR_SCRIPT, DYNAMIC_SOURCES, acquireSlice, buildManifest, buildSlice, dynamicConfig, inputsFor, resolveDynamicGene } from "@helix/scientific-core";
import { redactInputs, writeFixtureSet } from "./lib/fixture-recorder.ts";
import { REPO_ROOT, USER_AGENT } from "./lib/node-env.ts";

const args = process.argv.slice(2);
const geneArg = args.find((a) => a.startsWith("--gene="))?.slice("--gene=".length);
const genes = geneArg ? geneArg.split(",").map((g) => g.trim()).filter(Boolean) : [...DYNAMIC_FIXTURE_GENES];
const force = args.includes("--force");

const http = new HttpClient({
  userAgent: USER_AGENT,
  onEvent: (e) => {
    if (e.type === "retry") console.error(`  retry ${e.attempt} in ${e.delayMs} ms (${e.error.code}): ${e.url}`);
  },
});
const log = (m: string): void => console.error(`  ${m}`);

let failed = 0;
for (const symbol of genes) {
  const dir = join(REPO_ROOT, "data/fixtures/dynamic", symbol.toLowerCase());
  const exists = await access(dir).then(() => true, () => false);
  if (exists && !force) {
    console.log(`${symbol}: ${relative(REPO_ROOT, dir)} exists; recorded once (pass --force to re-record)`);
    continue;
  }
  console.error(`${symbol}: live resolution and acquisition (User-Agent "${USER_AGENT}")`);
  const started = Date.now();
  try {
    const resolved = await resolveDynamicGene(http, symbol);
    log(`resolved by ${resolved.matchedBy}: ${resolved.symbol} ${resolved.hgncId} ${resolved.ensemblGeneId} ${resolved.uniprotAccession}`);
    const config = dynamicConfig(resolved.symbol, resolved);
    const live = await acquireSlice(http, config, log);
    const sources = new Set(Object.values(live).map((r) => r?.source));
    for (const s of sources) if (s && !DYNAMIC_SOURCES.includes(s)) throw new Error(`a dynamic build asked ${s}, which is not a dynamic source`);
    // Redact before anything is built or written (Q-H-LIC-1); the build consumes the redacted records.
    const r = redactInputs(inputsFor(live, config));
    const changed = Object.entries(r.redacted).filter(([, x]) => x.removed.length > 0);
    log(`redaction (Q-H-LIC-1): ${changed.length} of ${Object.keys(r.redacted).length} records changed${changed.length ? `: ${changed.map(([n, x]) => `${n} (${x.removed.length})`).join(", ")}` : ""}`);
    const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const build = await buildSlice(r.inputs, config, { now });
    const failedChecks = build.validation.filter((v) => v.result === "fail");
    if (failedChecks.length > 0) throw new Error(`the dynamic build is refused by ${failedChecks.map((v) => `${v.check} (${v.detail})`).join("; ")}`);
    const manifest = await buildManifest(build, config, { generatedAt: now, script: DYNAMIC_GENERATOR_SCRIPT, gitCommit: null, gitDirty: null, node: process.version, assembly: build.sources.find((s) => s.assembly)?.assembly ?? "unknown", mode: "dynamic" });
    const caps = JSON.parse(build.files.find((f) => f.path === "capabilities.json")!.content) as Record<string, { available: boolean; reason: string }>;
    log(`built: ${build.files.length} files, ${build.validation.length} checks (${build.validation.filter((v) => v.result === "warn").length} warnings); generator ${manifest.generator.script} mode ${manifest.generator.mode}`);
    log(`experimentalStructure: ${caps.experimentalStructure!.reason}`);
    log(`predictedStructure: ${caps.predictedStructure!.available} (${caps.predictedStructure!.reason})`);
    const fixtures = await writeFixtureSet(
      config.datasetId,
      r.redacted,
      `Dynamic-mode test inputs for ${resolved.symbol} (Phase 9, P9.3.1; plan section 16 rule 5), recorded once by scripts/data-preparation/record-dynamic-fixtures.ts on ${now.slice(0, 10)} from the live responses of a dynamic build (HGNC, Ensembl, UniProt, AlphaFold DB only), redacted under Q-H-LIC-1 (proprietary database identifiers removed; each MANIFEST.tsv row carries the original sha256 in its redaction column). Test inputs, not a curated set. Paths are relative to the repository root. Each file is verified against its folder's MANIFEST.tsv sha256 when loaded.`,
      { path: `dynamic/${symbol.toLowerCase()}` },
    );
    console.log(`${symbol}: recorded ${relative(REPO_ROOT, fixtures.dir)}: ${fixtures.files.length} files (${fixtures.files.filter((f) => f.redacted).length} redacted) in ${((Date.now() - started) / 1000).toFixed(1)} s`);
  } catch (e) {
    failed++;
    console.log(`${symbol}: NOT recorded: ${(e as Error).message}`);
  }
}
process.exit(failed === 0 ? 0 : 1);
