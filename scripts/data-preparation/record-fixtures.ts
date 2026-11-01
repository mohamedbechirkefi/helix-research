// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Record the live fixtures that research/raw does not contain, in the same MANIFEST.tsv
 * format: E8 (the genomic window around rs334, fetched at the position variant_recoder
 * reports) and an Ensembl lookup of a gene with no protein product (HBBP1), used by the
 * capability tests. Usage: node scripts/data-preparation/record-fixtures.ts
 */
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { EnsemblAdapter, type FetchedResponse, HttpClient, parseJsonBody } from "@helix/data-adapters";
import { parseHgvsG } from "@helix/scientific-core";
import { REPO_ROOT, USER_AGENT } from "./lib/node-env.ts";

const OUT = join(REPO_ROOT, "data/fixtures/hbb");
const http = new HttpClient({ userAgent: USER_AGENT, onEvent: (e) => e.type === "retry" && console.error(`retry ${e.url}: ${e.error.message}`) });
const ens = new EnsemblAdapter(http);

async function save(folder: string, name: string, r: FetchedResponse): Promise<void> {
  const dir = join(OUT, folder);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), r.body);
  const man = join(dir, "MANIFEST.tsv");
  let exists = true;
  try {
    await readFile(man);
  } catch {
    exists = false;
  }
  if (!exists) await writeFile(man, "file\tretrieved_utc\thttp_status\tsha256\tbytes\tmethod\turl\theaders\tredaction\n");
  await appendFile(man, `${name}\t${r.retrievedAt}\t${r.status}\t${r.sha256}\t${r.bytes}\t${r.method}\t${r.url}\t${`"${JSON.stringify(r.headers).replace(/"/g, '""')}"`}\t\n`);
  console.log(r.status, r.bytes, r.sha256.slice(0, 12), folder, name);
}

// Position from the frozen variant_recoder record (research/raw), allele A.
const recoder = parseJsonBody(await readFile(join(REPO_ROOT, "research/raw/ensembl/variant_recoder_rs334_retry.json"), "utf8")) as Record<string, { hgvsg: string[] }>[];
const hgvsg = recoder[0]!.A!.hgvsg.find((h) => h.startsWith("NC_"))!;
const pos = parseHgvsG(hgvsg).position;
const win = await ens.region("11", pos - 20, pos + 20, 1);
await save("ensembl", `sequence_region_11_${pos - 20}-${pos + 20}_1.json`, win.response);
const hbbp1 = await ens.lookupSymbol("HBBP1");
await save("ensembl", "lookup_symbol_HBBP1_expand_mane.json", hbbp1.response);
