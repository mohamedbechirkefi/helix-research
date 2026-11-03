// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Curated HBB dataset build: a thin wrapper that runs the generic builder with --gene hbb
 * (Phase 9). The documented commands keep working:
 *
 *   node scripts/data-preparation/build-hbb.ts                 live fetch (default)
 *   node scripts/data-preparation/build-hbb.ts --offline       rebuild from the last live snapshot in .cache/
 *   node scripts/data-preparation/build-hbb.ts --fixtures      build from the recorded test fixtures
 *   options: --out <dir> (default data/curated/hbb)
 *
 * The specification is data/specs/hbb.json; see build-gene.ts.
 */
import { reportBuildFailure, runBuildGene } from "./build-gene.ts";

runBuildGene(["--gene", "hbb", ...process.argv.slice(2)]).catch(reportBuildFailure);
