// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Choose a curated set's reference variant by rule (Phase 9, P9.2.3; docs/phase-9-generalisation.md
 * section 15 rule 1), with lib/find-variant.ts: one ClinVar esearch for the gene's missense variants
 * classified Pathogenic or Likely pathogenic, one esummary for the uids (at most --retmax, default
 * 100; the count is reported), the summaries filtered and ranked (review status of at least two
 * stars, then supporting submissions, then accession number), and for each eligible candidate in
 * rank order the structure candidate check (lib/structure-candidates.ts) over the UniProt entry's
 * PDB cross-references that cover the residue; the first candidate whose residue is observed in a
 * kept entry is the choice, with that entry.
 *
 *   node scripts/data-preparation/find-variant.ts --gene SLC6A3 [--uniprot Q01959] [--retmax 100] [--min-stars 2] [--clinvar-recorded]
 *
 * Live requests go to NCBI ClinVar (tool parameter only), UniProt, PDBe SIFTS and RCSB (free, keyless)
 * with the repository's User-Agent and nothing else; HGNC is asked for the UniProt accession only
 * when --uniprot is not given. The two ClinVar responses are recorded once, redacted (Q-H-LIC-1), under
 * research/raw/ncbi-clinvar/ with MANIFEST.tsv rows; the structure responses are not kept (as
 * check-structure-candidates.ts does not keep them: the chosen entry's responses are recorded by the
 * set's own fixtures). The report goes to research/derived/variant-search-<symbol>-<date>.json: every
 * candidate with its rank or its reason, each structure candidate with its verdict, the choice.
 * --min-stars 1 is the fallback the plan allows only when no two-star candidate qualifies; the report
 * (then named variant-search-<symbol>-<date>-min-stars-1.json, beside the rule's own report) and the
 * specification's notes must say so. --clinvar-recorded reads the two ClinVar responses recorded by an
 * earlier run of the same day's rule instead of asking again, so that a second pass (the fallback)
 * asks ClinVar nothing: the responses are recorded once.
 */
import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { ClinvarAdapter, type FetchedResponse, HgncAdapter, HttpClient, RcsbAdapter, SiftsAdapter, UniprotAdapter, clinvarGeneMissensePathogenicTerm, isHelixDataError, parseClinvarEsearch, parseClinvarEsearchTranslation, parseClinvarEsummary, parseJsonBody } from "@helix/data-adapters";
import { toRaw } from "@helix/scientific-core";
import { MANIFEST_HEADER, redactRecord } from "./lib/fixture-recorder.ts";
import { type VariantFinderResult, findVariant } from "./lib/find-variant.ts";
import { REPO_ROOT, USER_AGENT, gitState } from "./lib/node-env.ts";
import { cachedEntryFetchers, checkCandidate } from "./lib/structure-candidates.ts";

function value(args: string[], flag: string): string | null {
  const i = args.indexOf(flag);
  if (i < 0) return null;
  const v = args[i + 1];
  if (v === undefined || v.startsWith("--")) throw new Error(`${flag} needs a value`);
  return v;
}

function intFlag(args: string[], flag: string, fallback: number): number {
  const v = value(args, flag);
  if (v === null) return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${flag} needs a positive integer`);
  return n;
}

/** Record one ClinVar response under research/raw/ncbi-clinvar/<name>.json, redacted, with its MANIFEST row. */
async function recordRaw(name: string, r: FetchedResponse, note: string): Promise<string> {
  const dir = join(REPO_ROOT, "research/raw", r.source);
  await mkdir(dir, { recursive: true });
  const x = redactRecord(toRaw(r), name);
  const bytes = Buffer.from(x.record.body, "utf8");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const file = `${name}.json`;
  await writeFile(join(dir, file), bytes);
  const man = join(dir, "MANIFEST.tsv");
  let exists = true;
  try {
    await readFile(man);
  } catch {
    exists = false;
  }
  if (!exists) await writeFile(man, MANIFEST_HEADER);
  const redaction = x.removed.length > 0 ? `redacted ${r.retrievedAt.slice(0, 10)}: proprietary database identifiers removed (Q-H-LIC-1, ${x.removed.length} removal${x.removed.length === 1 ? "" : "s"}); original sha256 ${x.originalSha256}; ${note}` : note;
  const headers = `"${JSON.stringify(r.headers).replace(/"/g, '""')}"`;
  await appendFile(man, `${file}\t${r.retrievedAt}\t${r.status}\t${sha256}\t${bytes.byteLength}\t${r.method}\t${r.url}\t${headers}\t${redaction}\n`);
  return relative(REPO_ROOT, join(dir, file));
}

async function main(args: string[]): Promise<void> {
  const symbol = value(args, "--gene");
  if (!symbol) throw new Error("usage: find-variant.ts --gene <symbol> [--uniprot <accession>] [--retmax 100] [--min-stars 2]");
  const retmax = intFlag(args, "--retmax", 100);
  const minStars = intFlag(args, "--min-stars", 2);
  const fromRecorded = args.includes("--clinvar-recorded");
  const log = (m: string): void => void process.stderr.write(`${m}\n`);
  const http = new HttpClient({
    userAgent: USER_AGENT,
    onEvent: (e) => {
      if (e.type === "retry") log(`  retry ${e.attempt} in ${e.delayMs} ms (${e.error.code}): ${e.url}`);
    },
  });
  const clinvar = new ClinvarAdapter(http);
  const uni = new UniprotAdapter(http);
  const { fetchers, fetched } = cachedEntryFetchers(new RcsbAdapter(http), new SiftsAdapter(http));
  const startedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const date = startedAt.slice(0, 10).replace(/-/g, "");
  let accession: string;
  const given = value(args, "--uniprot");
  if (given) accession = given;
  else {
    const h = await new HgncAdapter(http).symbol(symbol);
    const ids = h.data.uniprotIds;
    if (ids.length !== 1) throw new Error(`HGNC lists ${ids.length} UniProt id(s) for ${symbol}; pass --uniprot`);
    accession = ids[0]!;
    log(`UniProt accession ${accession} from HGNC (${h.data.hgncId})`);
  }
  log(`variant search for ${symbol} (${accession}): ClinVar esearch, esummary (at most ${retmax}), structure check per candidate (User-Agent "${USER_AGENT}")`);
  const recorded: { esearch: string | null; esummary: string | null; mode: "requested" | "read from research/raw" } = { esearch: null, esummary: null, mode: fromRecorded ? "read from research/raw" : "requested" };
  const term = clinvarGeneMissensePathogenicTerm(symbol);
  const rawDir = join(REPO_ROOT, "research/raw/ncbi-clinvar");
  const esearchName = `esearch_${symbol}_missense_pathogenic`;
  const esummaryName = `esummary_${symbol}_missense_pathogenic_ids`;
  let translation: ReturnType<typeof parseClinvarEsearchTranslation> | null = null;
  const result: VariantFinderResult = await findVariant(
    {
      esearch: async (s, n) => {
        if (fromRecorded) {
          const file = join(rawDir, `${esearchName}.json`);
          const json = parseJsonBody(await readFile(file, "utf8"), null);
          recorded.esearch = relative(REPO_ROOT, file);
          translation = parseClinvarEsearchTranslation(json, null);
          const data = parseClinvarEsearch(json, null);
          if (data.uids.length > n) throw new Error(`the recorded esearch holds ${data.uids.length} uids, more than --retmax ${n}`);
          return { data };
        }
        const r = await clinvar.esearchGeneMissensePathogenic(s, n);
        translation = parseClinvarEsearchTranslation(parseJsonBody(r.response.body, r.response.url), r.response.url);
        recorded.esearch = await recordRaw(esearchName, r.response, `P9.2.3 find-variant.ts ${startedAt.slice(0, 10)}: gene esearch, term ${term}`);
        return r;
      },
      esummary: async (uids) => {
        if (fromRecorded) {
          const file = join(rawDir, `${esummaryName}.json`);
          const data = parseClinvarEsummary(parseJsonBody(await readFile(file, "utf8"), null), null);
          const got = data.map((d) => d.uid).sort().join(",");
          if (got !== [...uids].sort().join(",")) throw new Error(`the recorded esummary covers uids ${got}, not the esearch's ${uids.join(",")}`);
          recorded.esummary = relative(REPO_ROOT, file);
          return { data };
        }
        const r = await clinvar.esummary(uids);
        recorded.esummary = await recordRaw(esummaryName, r.response, `P9.2.3 find-variant.ts ${startedAt.slice(0, 10)}: the ${uids.length} uid(s) of the gene esearch`);
        return r;
      },
      uniprotEntry: (a) => uni.entry(a),
      checkStructure: (entryId, a, seq, residue) => checkCandidate(fetchers, entryId, a, seq, residue),
    },
    symbol,
    accession,
    { retmax, minStars, log },
  );
  const finishedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const git = gitState();
  const report = {
    purpose: "Phase 9 plan section 15 rule 1: the reference variant chosen by rule. One ClinVar esearch for the gene's missense variants classified Pathogenic or Likely pathogenic, one esummary for the uids, the summaries filtered on ClinVar's own words (classification; review status of at least minStars; a single-nucleotide single variant with a dbSNP id whose protein change is a substitution p.Xxx000Yyy) and ranked by review status, then supporting submissions, then accession number; then, in rank order, the structure candidate check (plan section 11 rule 4) over the UniProt entry's PDB cross-references that cover the residue, in UniProt's order. The first candidate whose residue is observed in a kept entry (wild type over the mapped segments, no declared mutation) is the choice, with that entry. Nothing here chooses a variant for being interesting; the specification's notes cite this report.",
    script: "scripts/data-preparation/find-variant.ts",
    startedAt,
    finishedAt,
    gitCommit: git.commit,
    gitDirty: git.dirty,
    userAgent: USER_AGENT,
    symbol,
    accession,
    uniprot: result.uniprot,
    clinvar: { term, retmax, esearch: result.esearch, translation, recorded, filters: { classifications: ["Pathogenic", "Likely pathogenic", "Pathogenic/Likely pathogenic"], minStars, molecularConsequence: "missense variant", variantType: "single nucleotide variant", dbSnpId: "required", proteinChange: "p.Xxx000Yyy (frameshift, nonsense, deletion, duplication, insertion, synonymous skipped with the reason)" } },
    ranking: ["review status (ClinVar's star level, practice guideline 4, expert panel 3, multiple submitters no conflicts 2)", "supporting submissions (SCV count) descending", "ClinVar accession number ascending"],
    structureRule: "lib/structure-candidates.ts over the UniProt PDB cross-references whose Chains property covers the residue, in UniProt's order; kept = residue observed in atom_site (model 1) on every mapped chain, entity equal to UniProt over the SIFTS-mapped segments, no pdbx_mutation; the structure responses are not kept here (the chosen entry's are recorded by the set's fixtures)",
    entriesFetched: [...fetched.keys()],
    stoppedBecause: result.stoppedBecause,
    counts: result.counts,
    chosen: result.chosen ? { uid: result.chosen.candidate.uid, accession: result.chosen.candidate.accession, accessionVersion: result.chosen.candidate.accessionVersion, title: result.chosen.candidate.title, proteinChange: result.chosen.candidate.proteinChange, dbSnpIds: result.chosen.candidate.dbSnpIds, reviewStatus: result.chosen.candidate.reviewStatus, reviewStars: result.chosen.candidate.reviewStars, supportingSubmissions: result.chosen.candidate.supportingSubmissions, entry: { id: result.chosen.entry.entryId, method: result.chosen.entry.method, resolutionAngstrom: result.chosen.entry.resolutionAngstrom, chains: result.chosen.entry.chains, observedOn: result.chosen.entry.residue.observedOn, coverage: result.chosen.entry.coverage } } : null,
    candidates: result.candidates,
  };
  const outDir = join(REPO_ROOT, "research/derived");
  await mkdir(outDir, { recursive: true });
  // The rule's own report keeps the plan's name; a fallback pass (another --min-stars) is named for it, beside the rule's.
  const outPath = join(outDir, `variant-search-${symbol}-${date}${minStars === 2 ? "" : `-min-stars-${minStars}`}.json`);
  await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`);

  const c = result.counts;
  const lines = [
    `esearch ${symbol}: ${result.esearch.count} record(s), ${result.esearch.returned} summarised${result.esearch.capped ? ` (capped at ${retmax})` : ""}; ${c.eligible} eligible, ${c.skipped} skipped; ${c.structureChecked} structure-checked; stopped: ${result.stoppedBecause}`,
    ...Object.entries(c.skippedByReason)
      .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
      .map(([r, n]) => `  skipped ${String(n).padStart(3)}  ${r}`),
    ...result.candidates.filter((x) => x.rank !== null).map((x) => `  rank ${x.rank} ${x.accessionVersion} ${x.proteinChange?.hgvsP ?? "?"} ${x.dbSnpIds.join("/")} ${x.reviewStars} star(s), ${x.supportingSubmissions} submission(s): ${x.verdict}`),
    result.chosen
      ? `chosen: ${result.chosen.candidate.accessionVersion} ${result.chosen.candidate.proteinChange!.hgvsP} (${result.chosen.candidate.dbSnpIds.join("/")}, uid ${result.chosen.candidate.uid}) in ${result.chosen.entry.entryId} (${result.chosen.entry.method}${result.chosen.entry.resolutionAngstrom === null ? "" : `, ${result.chosen.entry.resolutionAngstrom} A`}; residue on ${result.chosen.entry.residue.observedOn.map((r) => `${r.authAsymId}${r.authSeqId} ${r.compId}`).join(", ")}; covers ${result.chosen.entry.coverage.firstObserved}-${result.chosen.entry.coverage.lastObserved} of ${result.chosen.entry.coverage.proteinLength})`
      : "chosen: none (no eligible candidate has its residue observed in a kept entry; record why before any other path)",
    `ClinVar responses ${recorded.mode}: ${recorded.esearch ?? "no esearch"}, ${recorded.esummary ?? "no esummary"}`,
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
