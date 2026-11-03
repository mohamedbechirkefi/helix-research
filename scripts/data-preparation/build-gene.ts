// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Curated dataset build for any gene with a specification (Phase 9):
 *
 *   node scripts/data-preparation/build-gene.ts --gene hbb                live fetch (default)
 *   node scripts/data-preparation/build-gene.ts --gene hbb --offline      rebuild from the last live snapshot in .cache/
 *   node scripts/data-preparation/build-gene.ts --gene hbb --fixtures     build from the recorded fixtures (data/fixtures/<gene>/)
 *   node scripts/data-preparation/build-gene.ts --gene <id> --record-fixtures   live build that also records
 *        every input, redacted (Q-H-LIC-1), as data/fixtures/<id>/ with MANIFEST.tsv files and index.json
 *        (with --offline: the same recording from the snapshot of the last live acquisition)
 *   node scripts/data-preparation/build-gene.ts --gene <id> --offline --live-sources=reactome [--record-fixtures]
 *        offline rebuild in which only the named sources are fetched live (Phase 9, P9.1.2: Reactome, for a
 *        snapshot that predates the pathway requests); the merged inputs become the new snapshot
 *   options: --out <dir> (default data/curated/<datasetId>)
 *
 * The specification is data/specs/<gene>.json (packages/scientific-core/src/slice/spec.ts);
 * nothing about the gene is typed here. On any error nothing is written and the process
 * exits with status 2 and a typed message (P2.5.2).
 */
import { isHelixDataError } from "@helix/data-adapters";
import { GeneSpecError } from "@helix/scientific-core";
import { buildGene, parseBuildArgs, readSpec } from "./lib/build-gene.ts";

function log(m: string): void {
  process.stderr.write(`${m}\n`);
}

export async function runBuildGene(args: string[]): Promise<void> {
  const { gene, mode, outDir, recordFixtures, liveSources } = parseBuildArgs(args);
  if (!gene) throw new Error("usage: build-gene.ts --gene <name> [--offline [--live-sources=reactome]|--fixtures|--record-fixtures] [--out <dir>]");
  const config = await readSpec(gene);
  const r = await buildGene({ config, mode, recordFixtures, liveSources, ...(outDir ? { outDir } : {}), log });
  process.stdout.write(`${JSON.stringify(r.build.summary, null, 2)}\n`);
}

export function reportBuildFailure(e: unknown): never {
  if (isHelixDataError(e)) {
    log(`build failed (${e.code}${e.url ? `, ${e.url}` : ""}): ${e.userMessage()}`);
  } else if (e instanceof GeneSpecError) {
    log(`build failed (gene specification): ${e.message}`);
  } else {
    log(`build failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  log("nothing was written");
  process.exit(2);
}

if (process.argv[1] && /build-gene\.ts$/.test(process.argv[1])) {
  runBuildGene(process.argv.slice(2)).catch(reportBuildFailure);
}
