// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Curator check for a structure selection (Phase 9, plan section 11 rule 4): for each
 * candidate PDB entry, in the order given, report whether the mapped chain(s) of the
 * UniProt accession observe the residue in atom_site through the SIFTS mapping, the
 * method and resolution, any engineered mutation the entity declares, and where the
 * entity sequence differs from UniProt. The first candidate that observes the residue
 * and carries no unexplained difference is the one the specification should name; the
 * report is the evidence for the specification's notes.
 *
 *   node scripts/data-preparation/check-structure-candidates.ts --uniprot P13569 --residue 508 --entries 6MSM,5UAK
 *
 * Live requests go to UniProt, PDBe SIFTS and RCSB (free, keyless) with the repository's
 * User-Agent and nothing else. The report goes to
 * research/derived/structure-candidates-<accession>-<residue>.json.
 *
 * Phase 9, P9.2.2 (plan section 13): a candidate may be a solution-NMR entry (no _refine, no
 * _em_3d_reconstruction): its resolution is null, the ensemble size is the number of models in
 * atom_site (checked against _pdbx_nmr_ensemble when present), and the residue is looked for in
 * model 1, the one shown. The report also states the coverage of the mapped chain (observed
 * UniProt positions over the protein length) and the other polymer entities with the UniProt
 * accession the entry's own _struct_ref gives them, so that a partner chain can be named.
 *
 * Phase 9, P9.2.3 (plan section 15): the check itself lives in lib/structure-candidates.ts, so that
 * find-variant.ts can run it over the UniProt entry's PDB cross-references for each variant candidate.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { HttpClient, RcsbAdapter, SiftsAdapter, UniprotAdapter } from "@helix/data-adapters";
import { REPO_ROOT, USER_AGENT, gitState } from "./lib/node-env.ts";
import { type CandidateReport, cachedEntryFetchers, candidateLogLine, checkCandidate } from "./lib/structure-candidates.ts";

export type { CandidateReport };

function flag(args: string[], name: string): string {
  const i = args.indexOf(name);
  const v = args[i + 1];
  if (i < 0 || v === undefined || v.startsWith("--")) throw new Error(`${name} needs a value`);
  return v;
}

async function main(args: string[]): Promise<void> {
  const accession = flag(args, "--uniprot");
  const residue = Number(flag(args, "--residue"));
  const entries = flag(args, "--entries").split(",").map((s) => s.trim()).filter(Boolean);
  if (!Number.isInteger(residue) || residue < 1) throw new Error("--residue needs a positive integer");
  const log = (m: string): void => void process.stderr.write(`${m}\n`);
  const http = new HttpClient({ userAgent: USER_AGENT });
  const uni = new UniprotAdapter(http);
  const { fetchers } = cachedEntryFetchers(new RcsbAdapter(http), new SiftsAdapter(http));
  const startedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  log(`structure candidates for ${accession} residue ${residue}: ${entries.join(", ")} (User-Agent "${USER_AGENT}")`);
  const u = await uni.entry(accession);
  const uniSeq = u.data.sequence;
  const candidates: CandidateReport[] = [];
  let chosen: string | null = null;
  for (const entryId of entries) {
    // The logic lives in lib/structure-candidates.ts (shared with find-variant.ts since P9.2.3); the verdicts are unchanged.
    const c = await checkCandidate(fetchers, entryId, accession, uniSeq, residue);
    candidates.push(c);
    log(candidateLogLine(c));
    if (chosen === null && c.kept) chosen = entryId;
  }
  const git = gitState();
  const report = {
    purpose: "Phase 9 plan section 11 rule 4 (and section 13 rule 2): candidate experimental entries checked in order for whether the mapped chain observes the variant residue in atom_site (model 1) through the SIFTS mapping; the first that does, with no sequence difference inside the mapped segments that a selected variant does not explain and no declared mutation, is the selection. Differences outside the mapped segments are reported with the entry's own _struct_ref_seq_dif explanation. The gene specification's notes cite this report.",
    script: "scripts/data-preparation/check-structure-candidates.ts",
    startedAt,
    finishedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    gitCommit: git.commit,
    gitDirty: git.dirty,
    userAgent: USER_AGENT,
    uniprot: { accession, release: u.release, length: uniSeq.length },
    residue,
    order: entries,
    candidates,
    chosen,
  };
  const dir = join(REPO_ROOT, "research/derived");
  await mkdir(dir, { recursive: true });
  const path = join(dir, `structure-candidates-${accession}-${residue}.json`);
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`);
  log(`chosen: ${chosen ?? "none"}; report ${relative(REPO_ROOT, path)}`);
}

if (process.argv[1] && /check-structure-candidates\.ts$/.test(process.argv[1])) {
  main(process.argv.slice(2)).catch((e: unknown) => {
    process.stderr.write(`check failed: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(2);
  });
}
