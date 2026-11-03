// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Choose the structure-limited gene of Phase 9 (P9.2.4) by a seeded walk over HGNC ids
 * (lib/structure-limited.ts): the first sampled gene that is approved, protein-coding with
 * one UniProt id and a MANE Select transcript (HGNC), reviewed with no PDB cross-reference
 * (UniProt) and protein_coding with a MANE Select transcript under the builder's rule
 * (Ensembl). The walk stops at the first pass once three have passed, or after
 * --max-candidates HGNC fetches; the first pass in sample order is the choice.
 *
 *   node scripts/data-preparation/find-structure-limited.ts [--seed 20261103] [--max-candidates 60] [--min-passing 3]
 *
 * Live requests go to HGNC, UniProt and Ensembl REST only (free, keyless), spaced by the
 * HttpClient's per-source limits, with the repository's User-Agent and nothing else. The
 * report goes to research/derived/structure-limited-search-<seed>.json: every id visited
 * with its verdict and reason, the choice, the alternates, the date and the releases the
 * responses expose (Ensembl info/data, UniProt release headers; HGNC exposes none).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { EnsemblAdapter, HgncAdapter, HttpClient, UniprotAdapter, isHelixDataError } from "@helix/data-adapters";
import { REPO_ROOT, USER_AGENT, gitState } from "./lib/node-env.ts";
import { DEFAULT_SEED, type FinderResult, findStructureLimited } from "./lib/structure-limited.ts";

function intFlag(args: string[], flag: string, fallback: number): number {
  const i = args.indexOf(flag);
  if (i < 0) return fallback;
  const v = Number(args[i + 1]);
  if (!Number.isInteger(v) || v <= 0) throw new Error(`${flag} needs a positive integer`);
  return v;
}

async function main(args: string[]): Promise<void> {
  const seed = intFlag(args, "--seed", DEFAULT_SEED);
  const maxCandidates = intFlag(args, "--max-candidates", 60);
  const minPassing = intFlag(args, "--min-passing", 3);
  const log = (m: string): void => void process.stderr.write(`${m}\n`);
  const http = new HttpClient({
    userAgent: USER_AGENT,
    onEvent: (e) => {
      if (e.type === "retry") log(`  retry ${e.attempt} in ${e.delayMs} ms (${e.error.code}): ${e.url}`);
    },
  });
  const ens = new EnsemblAdapter(http);
  const uni = new UniprotAdapter(http);
  const hgnc = new HgncAdapter(http);
  const startedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  log(`structure-limited gene search: seed ${seed}, at most ${maxCandidates} HGNC fetches, stop after ${minPassing} passes (User-Agent "${USER_AGENT}")`);
  const info = await ens.infoData();
  const ensemblRelease = Math.max(...info.data.releases);
  const result: FinderResult = await findStructureLimited({ hgncId: (n) => hgnc.hgncId(n), uniprotEntry: (a) => uni.entry(a), ensemblGene: (id) => ens.lookupGene(id) }, { seed, maxCandidates, minPassing, log });
  const finishedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const git = gitState();
  const report = {
    purpose: "Phase 9 P9.2.4: the structure-limited gene, chosen by a seeded walk over HGNC ids (docs/phase-9-generalisation.md section 4, last row). The first candidate in sample order that passes is the choice; it was not chosen for being interesting.",
    script: "scripts/data-preparation/find-structure-limited.ts",
    startedAt,
    finishedAt,
    gitCommit: git.commit,
    gitDirty: git.dirty,
    userAgent: USER_AGENT,
    seed: result.seed,
    sampler: "mulberry32, ids uniform in idRange without replacement",
    idRange: result.idRange,
    maxCandidates: result.maxCandidates,
    minPassing: result.minPassing,
    rules: {
      hgnc: "status Approved; locus_type 'gene with protein product'; exactly one uniprot id; non-empty mane_select; an ensembl_gene_id",
      uniprot: "entry reviewed (Swiss-Prot); no PDB cross-reference",
      ensembl: "biotype protein_coding; a MANE Select transcript under the builder's transcript-selection rule",
    },
    releases: { ensembl: ensemblRelease, uniprot: result.releases.uniprot, uniprotReleaseDate: result.releases.uniprotDate, hgnc: null as null, hgncNote: "the HGNC fetch response exposes no release identifier" },
    stoppedBecause: result.stoppedBecause,
    counts: result.counts,
    chosen: result.chosen,
    alternates: result.alternates,
    visited: result.visited,
  };
  const outDir = join(REPO_ROOT, "research/derived");
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, `structure-limited-search-${seed}.json`);
  await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`);

  const c = result.counts;
  const lines = [
    `visited ${c.visited} HGNC ids (seed ${seed}); ${c.passing} passed, ${c.skipped} skipped; stopped: ${result.stoppedBecause}`,
    ...Object.entries(c.skippedByReason)
      .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
      .map(([r, n]) => `  skipped ${String(n).padStart(3)}  ${r}`),
    result.chosen
      ? `chosen: ${result.chosen.symbol} (${result.chosen.hgncId}, ${result.chosen.uniprotAccession}, ${result.chosen.ensemblGeneId}, ${result.chosen.maneSelectTranscript}, ${result.chosen.pdbCount} PDB cross-references)`
      : "chosen: none (no candidate passed; raise --max-candidates or change the seed and record why)",
    ...result.alternates.map((a) => `  alternate: ${a.symbol} (${a.hgncId}, ${a.uniprotAccession}, ${a.ensemblGeneId}, ${a.maneSelectTranscript})`),
    `releases: Ensembl ${ensemblRelease}, UniProt ${result.releases.uniprot ?? "?"} (${result.releases.uniprotDate ?? "?"}), HGNC not exposed`,
    `report: ${relative(REPO_ROOT, outPath)}`,
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
  if (!result.chosen) process.exit(3);
}

main(process.argv.slice(2)).catch((e: unknown) => {
  if (isHelixDataError(e)) process.stderr.write(`search failed (${e.code}${e.url ? `, ${e.url}` : ""}): ${e.userMessage()}\n`);
  else process.stderr.write(`search failed: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(2);
});
