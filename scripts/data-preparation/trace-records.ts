// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * P11.3.1 (docs/phase-11-release-qa.md), the upstream trace of the scientific audit: each curated record field the
 * app displays, traced to the raw body it was read from and to that body's source and release, without a live call.
 *
 *   node scripts/data-preparation/trace-records.ts [--sets hbb,cftr,brca1,slc6a3,faah2] [--out <file.json>]
 *   node scripts/data-preparation/trace-records.ts --dynamic TP53 --out <dir>   (writes the dynamic set the app
 *        builds in the browser, built here from the same recorded fixtures, data/fixtures/dynamic/<symbol>/)
 *
 * 1. Bodies. Every source row of each set's manifest (url, sha256, source release) is looked up by its sha256 among
 *    the recorded raw inputs: the public fixtures (research/raw, data/fixtures/<set>) and the local snapshot cache
 *    (.cache/helix-raw/blob, not in the repository). A row whose body is found nowhere is reported.
 * 2. Fields. The displayed facts of each record (gene, transcript, protein and its features, variant, ClinVar,
 *    structure, predicted model, pathway memberships, disease associations) are compared with the raw body of the
 *    record's own provenance source, parsed here independently of the builder.
 * Exit 1 on any body not found or any field that differs (each is printed); 0 otherwise.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import { parseHgnc, parseJsonBody } from "@helix/data-adapters";
import { DYNAMIC_GENERATOR_SCRIPT, buildManifest, buildSlice, decideDynamicResolution, dynamicConfig, inputsFor } from "@helix/scientific-core";
import { loadFixtureInputs } from "./lib/fixtures.ts";
import { REPO_ROOT } from "./lib/node-env.ts";

const argv = process.argv.slice(2);
const opt = (k: string): string | null => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? (argv[i + 1] ?? null) : null;
};

// ---- --dynamic: the dynamic set the app builds, from the same fixtures (as scripts/data-preparation/test/dynamic.test.ts)
const dyn = opt("dynamic");
if (dyn) {
  const outDir = opt("out");
  if (!outDir) throw new Error("--dynamic needs --out <dir>");
  const inputs = await loadFixtureInputs(`dynamic/${dyn.toLowerCase()}`);
  const docs = parseHgnc(parseJsonBody(inputs.hgnc.body), inputs.hgnc.url);
  const resolved = decideDynamicResolution(dyn, docs.find((d) => d.symbol.toLowerCase() === dyn.toLowerCase()) ?? null, []);
  const config = dynamicConfig(resolved.symbol, resolved);
  const now = "2026-11-12T00:00:00Z";
  const build = await buildSlice(inputsFor(inputs, config), config, { now });
  const manifest = await buildManifest(build, config, { generatedAt: now, script: DYNAMIC_GENERATOR_SCRIPT, gitCommit: null, gitDirty: null, node: process.version, assembly: build.sources.find((s) => s.assembly)?.assembly ?? "unknown", mode: "dynamic" });
  mkdirSync(outDir, { recursive: true });
  for (const f of build.files) writeFileSync(join(outDir, f.path), f.content);
  writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`dynamic ${resolved.symbol}: ${build.files.length + 1} files written`);
  process.exit(0);
}

const SETS = (opt("sets") ?? "hbb,cftr,brca1,slc6a3,faah2").split(",").filter(Boolean);
const OUT = opt("out");

// ---- 1. the recorded raw bodies, by sha256 -----------------------------------------------------------------------
const sha = (b: Buffer): string => createHash("sha256").update(b).digest("hex");
const bodies = new Map<string, { where: "public fixture" | "local snapshot cache"; path: string }>();
function walk(dir: string, where: "public fixture" | "local snapshot cache"): void {
  if (!existsSync(dir)) return;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, where);
    else if (n !== "MANIFEST.tsv" && n !== "index.json") {
      const h = where === "local snapshot cache" && /^[0-9a-f]{64}$/.test(n) ? n : sha(readFileSync(p));
      if (!bodies.has(h) || where === "public fixture") bodies.set(h, { where, path: relative(REPO_ROOT, p) });
    }
  }
}
walk(join(REPO_ROOT, ".cache/helix-raw/blob"), "local snapshot cache");
walk(join(REPO_ROOT, "research/raw"), "public fixture");
for (const s of SETS) walk(join(REPO_ROOT, "data/fixtures", s), "public fixture");
const bodyText = (h: string): string | null => {
  const b = bodies.get(h);
  return b ? readFileSync(join(REPO_ROOT, b.path), "utf8") : null;
};

interface Source { source: string; url: string; sha256: string; sourceRelease: string | null; recordId?: string | null; recordVersion?: string | null }
interface Row { set: string; record: string; field: string; record_value: unknown; upstream_value: unknown; source: string; release: string | null; body: string; state: "agrees" | "differs" | "no body" }
const rows: Row[] = [];
const sourceRows: { set: string; source: string; url: string; release: string | null; sha256: string; body: string; where: string }[] = [];
const problems: string[] = [];

const readJson = (p: string): any => JSON.parse(readFileSync(p, "utf8"));
const same = (a: unknown, b: unknown): boolean => (typeof a === "number" && typeof b === "number" ? Math.abs(a - b) < 1e-9 : JSON.stringify(a) === JSON.stringify(b));

for (const set of SETS) {
  const dir = join(REPO_ROOT, "data/curated", set);
  const manifest = readJson(join(dir, "manifest.json"));
  for (const s of manifest.sources as Source[]) {
    const b = bodies.get(s.sha256);
    sourceRows.push({ set, source: s.source, url: s.url, release: s.sourceRelease ?? null, sha256: s.sha256, body: b ? b.path : "not found", where: b ? b.where : "not found" });
    if (!b) problems.push(`${set}: manifest source ${s.source} ${s.url} sha256 ${s.sha256.slice(0, 12)}: no recorded body`);
  }
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const rec = (re: RegExp) => {
    const f = files.find((x) => re.test(x));
    return f ? { file: f, json: readJson(join(dir, f)) } : null;
  };
  /** The parsed raw body of the record's provenance source whose url matches `urlRe`. */
  const upstream = (r: { file: string; json: any }, urlRe: RegExp): { src: Source; body: any; path: string } | null => {
    const srcs: Source[] = r.json.provenance?.sources ?? r.json.records?.flatMap((x: any) => x.provenance?.sources ?? []) ?? [];
    const src = srcs.find((s) => urlRe.test(s.url)) ?? (manifest.sources as Source[]).find((s) => urlRe.test(s.url));
    if (!src) return null;
    const t = bodyText(src.sha256);
    if (t === null) return { src, body: null, path: "not found" };
    let body: any = t;
    try { body = JSON.parse(t); } catch { /* text body */ }
    return { src, body, path: bodies.get(src.sha256)!.path };
  };
  const check = (r: { file: string; json: any } | null, urlRe: RegExp, field: string, recVal: (j: any) => unknown, upVal: (b: any, j: any) => unknown): void => {
    if (!r) return;
    const u = upstream(r, urlRe);
    if (!u) {
      problems.push(`${set} ${r.file} ${field}: no provenance source matches ${urlRe}`);
      return;
    }
    const rv = recVal(r.json);
    let uv: unknown = null;
    let state: Row["state"] = "no body";
    if (u.body !== null) {
      try { uv = upVal(u.body, r.json); } catch (e) { uv = `unreadable: ${String(e).slice(0, 80)}`; }
      state = same(rv, uv) ? "agrees" : "differs";
    }
    rows.push({ set, record: r.file, field, record_value: rv, upstream_value: uv, source: u.src.source, release: u.src.sourceRelease ?? null, body: u.path, state });
    if (state !== "agrees") problems.push(`${set} ${r.file} ${field}: record ${JSON.stringify(rv)} upstream ${JSON.stringify(uv)} (${state}, ${u.path})`);
  };

  const gene = rec(/^gene\.json$/);
  check(gene, /lookup\/id\/ENSG/, "id.id", (j) => j.id.id, (b) => b.id);
  check(gene, /lookup\/id\/ENSG/, "id.version", (j) => j.id.version, (b) => b.version);
  check(gene, /lookup\/id\/ENSG/, "interval [start, end, strand]", (j) => [j.interval.start, j.interval.end, j.interval.strand], (b) => [b.start, b.end, b.strand]);
  check(gene, /lookup\/id\/ENSG/, "description", (j) => j.description, (b) => b.description);
  check(gene, /genenames/, "symbol", (j) => j.symbol, (b) => b.response.docs[0].symbol);
  check(gene, /genenames/, "hgncId", (j) => j.hgncId, (b) => b.response.docs[0].hgnc_id);
  check(gene, /genenames/, "aliases (HGNC alias_symbol; previous symbols are not kept)", (j) => [...j.aliases].sort(), (b) => [...(b.response.docs[0].alias_symbol ?? [])].sort());
  check(gene, /lookup\/id\/ENSG/, "selection.selected (MANE Select)", (j) => j.selection.selected.id ?? j.selection.selected, (b, j) => {
    const t = (b.Transcript ?? []).find((x: any) => (x.MANE ?? []).some((m: any) => m.type === "MANE_Select"));
    return t ? (typeof j.selection.selected === "object" ? t.id : `${t.id}.${t.version}`) : null;
  });

  const tr = rec(/^transcript\.json$/);
  check(tr, /lookup\/id\/ENST/, "id", (j) => `${j.id.id}.${j.id.version}`, (b) => `${b.id}.${b.version}`);
  check(tr, /lookup\/id\/ENST/, "exons", (j) => j.exons.length, (b) => b.Exon.length);
  check(tr, /lookup\/id\/ENST/, "translation length", (j) => j.translation.length, (b) => b.Translation.length);

  const prot = rec(/^protein-.*\.json$/);
  check(prot, /uniprotkb/, "accession", (j) => j.accession, (b) => b.primaryAccession);
  check(prot, /uniprotkb/, "length", (j) => j.length, (b) => b.sequence.length);
  check(prot, /uniprotkb/, "entryVersion", (j) => j.entryVersion, (b) => b.entryAudit.entryVersion);
  check(prot, /uniprotkb/, "features [type, start, end, description] (every one)", (j) => j.features.map((f: any) => [f.type, f.start, f.end, f.description]), (b, j) => j.features.map((f: any) => {
    const u = b.features.find((x: any) => x.type === f.type && x.location.start.value === f.start && x.location.end.value === f.end && (x.description ?? "") === (f.description ?? ""));
    return u ? [u.type, u.location.start.value, u.location.end.value, u.description ?? ""] : ["not in the body", f.type, f.start, f.end];
  }));

  const variant = rec(/^variant-.*\.json$/);
  check(variant, /variation\/human/, "rsId", (j) => j.rsId, (b) => b.name);
  check(variant, /vep\/human\/hgvs/, "hgvs.protein in the VEP body", (j) => j.hgvs.protein.filter((p: string) => p.startsWith("ENSP")), (b, j) => j.hgvs.protein.filter((p: string) => p.startsWith("ENSP") && JSON.stringify(b).includes(p)));
  check(variant, /vep\/human\/hgvs/, "consequence terms", (j) => j.consequence.terms, (b, j) => {
    const tc = (b[0].transcript_consequences ?? []).find((x: any) => x.transcript_id === j.transcript.id);
    return tc ? tc.consequence_terms : null;
  });

  const cv = rec(/^clinvar-.*\.json$/);
  const cvDoc = (b: any, j: any) => b.result[j.uid];
  check(cv, /esummary/, "accessionVersion", (j) => j.accessionVersion, (b, j) => cvDoc(b, j).accession_version);
  check(cv, /esummary/, "classification", (j) => j.classification, (b, j) => cvDoc(b, j).germline_classification.description);
  check(cv, /esummary/, "reviewStatus", (j) => j.reviewStatus, (b, j) => cvDoc(b, j).germline_classification.review_status);
  check(cv, /esummary/, "lastEvaluated", (j) => j.lastEvaluated, (b, j) => cvDoc(b, j).germline_classification.last_evaluated);
  check(cv, /esummary/, "supportingSubmissionCount", (j) => j.supportingSubmissionCount, (b, j) => {
    const s = cvDoc(b, j).supporting_submissions;
    return (s.scv ?? []).length;
  });

  const st = rec(/^structure-.*\.json$/);
  check(st, /rcsb\.org\/rest\/v1\/core\/entry/, "method", (j) => j.method, (b) => b.exptl[0].method);
  check(st, /rcsb\.org\/rest\/v1\/core\/entry/, "resolutionAngstrom", (j) => j.resolutionAngstrom, (b) => b.rcsb_entry_info.resolution_combined?.[0] ?? null);
  check(st, /rcsb\.org\/rest\/v1\/core\/entry/, "revision.version", (j) => j.revision.version, (b) => `${b.rcsb_accession_info.major_revision}.${b.rcsb_accession_info.minor_revision}`);

  const pm = rec(/^predicted-model-.*\.json$/);
  check(pm, /alphafold\.ebi\.ac\.uk\/api\/prediction/, "modelId", (j) => j.modelId, (b) => b[0].modelEntityId ?? b[0].entryId);
  check(pm, /alphafold\.ebi\.ac\.uk\/api\/prediction/, "globalPlddt", (j) => j.globalPlddt, (b) => b[0].globalMetricValue);
  check(pm, /alphafold\.ebi\.ac\.uk\/api\/prediction/, "modelVersion", (j) => j.modelVersion, (b) => b[0].latestVersion);

  const pw = rec(/^pathways\.json$/);
  check(pw, /mapping\/UniProt\/.*\/pathways/, "memberships [stableId, name, isDisease]", (j) => j.memberships.map((m: any) => [m.stableId, m.name, m.isDisease]), (b, j) => j.memberships.map((m: any) => {
    const u = b.find((x: any) => x.stId === m.stableId);
    return u ? [u.stId, u.displayName, u.isInDisease] : ["not in the body", m.stableId];
  }));
  check(pw, /database\/version/, "release", (j) => String(j.release), (b) => String(b).trim());

  const as = rec(/^associations\.json$/);
  const otRows = (b: any) => b.data.target.associatedDiseases.rows;
  check(as, /opentargets/, "count", (j) => j.count, (b) => b.data.target.associatedDiseases.count);
  check(as, /opentargets/, "platform [api, data]", (j) => [j.platform.apiVersion, j.platform.dataVersion], (b) => [`${b.data.meta.apiVersion.x}.${b.data.meta.apiVersion.y}.${b.data.meta.apiVersion.z}`, `${b.data.meta.dataVersion.year}.${b.data.meta.dataVersion.month}`]);
  check(as, /opentargets/, "kept associations [diseaseId, name, score] (every one)", (j) => j.associations.map((a: any) => [a.diseaseId, a.diseaseName, a.score]), (b, j) => j.associations.map((a: any) => {
    const u = otRows(b).find((x: any) => x.disease.id === a.diseaseId);
    return u ? [u.disease.id, u.disease.name, u.score] : ["not in the body", a.diseaseId];
  }));
}

const counts = { sets: SETS.length, sourceRows: sourceRows.length, bodiesPublic: sourceRows.filter((r) => r.where === "public fixture").length, bodiesLocalCacheOnly: sourceRows.filter((r) => r.where === "local snapshot cache").length, bodiesNotFound: sourceRows.filter((r) => r.where === "not found").length, fieldChecks: rows.length, agree: rows.filter((r) => r.state === "agrees").length, differ: rows.filter((r) => r.state === "differs").length, noBody: rows.filter((r) => r.state === "no body").length };
const result = { date: new Date().toISOString(), suite: "P11.3.1 upstream trace", counts, fields: rows, sources: sourceRows, problems };
if (OUT) writeFileSync(OUT, JSON.stringify(result, null, 1));
for (const p of problems) console.log(`  ${p}`);
console.log(`trace: ${counts.sourceRows} manifest source rows (${counts.bodiesPublic} bodies in the public fixtures, ${counts.bodiesLocalCacheOnly} in the local snapshot cache only, ${counts.bodiesNotFound} not found); ${counts.fieldChecks} field checks: ${counts.agree} agree, ${counts.differ} differ, ${counts.noBody} without a body`);
console.log(problems.length ? `FAIL ${problems.length}` : "PASS");
process.exit(problems.length ? 1 : 0);
