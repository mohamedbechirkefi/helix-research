// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Record the AlphaFold predicted aligned error (PAE) file of a model as a raw fixture, in the
 * research/raw/alphafold MANIFEST.tsv format (Phase 9, P9.1.1: the adapter gains per-residue
 * confidence and the PAE matrix). The entry and version come from the recorded prediction
 * fixture, so the PAE file matches the model file already on record.
 * Usage: node scripts/data-preparation/record-alphafold-pae.ts [P68871]
 */
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { HttpClient, parseAlphafoldPrediction, parseJsonBody } from "@helix/data-adapters";
import { REPO_ROOT, USER_AGENT } from "./lib/node-env.ts";

const accession = process.argv[2] ?? "P68871";
const dir = join(REPO_ROOT, "research/raw/alphafold");
const prediction = parseAlphafoldPrediction(parseJsonBody(await readFile(join(dir, `prediction_${accession}.json`), "utf8")));
if (!prediction.paeDocUrl) throw new Error(`the recorded prediction of ${accession} names no PAE file`);
const http = new HttpClient({ userAgent: USER_AGENT, onEvent: (e) => e.type === "retry" && console.error(`retry ${e.url}: ${e.error.message}`) });
const r = await http.getText("alphafold", prediction.paeDocUrl, { timeoutMs: 60_000 });
const name = prediction.paeDocUrl.slice(prediction.paeDocUrl.lastIndexOf("/") + 1);
await writeFile(join(dir, name), r.body);
await appendFile(join(dir, "MANIFEST.tsv"), `${name}\t${r.retrievedAt}\t${r.status}\t${r.sha256}\t${r.bytes}\t${r.method}\t${r.url}\t${`"${JSON.stringify(r.headers).replace(/"/g, '""')}"`}\t\n`);
console.log(r.status, r.bytes, r.sha256, r.retrievedAt, name);
