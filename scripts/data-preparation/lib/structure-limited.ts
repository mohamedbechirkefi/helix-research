// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * The structure-limited gene finder (Phase 9, P9.2.4; docs/phase-9-generalisation.md §4,
 * last row): a seeded, deterministic walk over sampled HGNC ids that keeps the first gene
 * which is protein-coding with a MANE Select transcript and a reviewed UniProt entry that
 * cites no experimental structure. Nothing here chooses a gene for being interesting: the
 * order is the sampler's, the verdicts are the capability check's, and every id visited is
 * reported with its reason.
 *
 * This module is platform-agnostic and takes its adapters as an interface, so the sampler
 * and the three verdicts are unit-tested on hand-made records; find-structure-limited.ts
 * wires the live adapters and writes the report.
 */
import type { EnsemblGeneRaw, HgncRecord, UniprotEntry } from "@helix/data-adapters";
import { isHelixDataError } from "@helix/data-adapters";
import { selectTranscript } from "@helix/scientific-core";

// ---------------------------------------------------------------- sampler

/** mulberry32: a small 32-bit generator with a full period; the same seed gives the same sequence on every machine. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEFAULT_SEED = 20261103;
export const HGNC_ID_MAX = 60000;

/** Lazily sample integers in 1..max uniformly, without replacement, in the seed's order. */
export function* sampleIds(seed: number, max: number = HGNC_ID_MAX): Generator<number> {
  const next = mulberry32(seed);
  const seen = new Set<number>();
  while (seen.size < max) {
    const id = 1 + Math.floor(next() * max);
    if (seen.has(id)) continue;
    seen.add(id);
    yield id;
  }
}

export function firstIds(seed: number, n: number, max: number = HGNC_ID_MAX): number[] {
  const out: number[] = [];
  for (const id of sampleIds(seed, max)) {
    out.push(id);
    if (out.length >= n) break;
  }
  return out;
}

// ---------------------------------------------------------------- verdicts (pure)

export const REQUIRED_LOCUS_TYPE = "gene with protein product";

export interface Verdict {
  pass: boolean;
  reason: string;
}

/** HGNC: one approved protein-coding record with exactly one UniProt id, a MANE Select transcript and an Ensembl gene id. */
export function hgncVerdict(records: HgncRecord[]): Verdict {
  if (records.length === 0) return { pass: false, reason: "unused HGNC id" };
  if (records.length > 1) return { pass: false, reason: `HGNC returned ${records.length} records for one id` };
  const r = records[0]!;
  if (r.status !== "Approved") return { pass: false, reason: `HGNC status ${r.status}` };
  if (r.locusType !== REQUIRED_LOCUS_TYPE) return { pass: false, reason: `locus_type ${r.locusType ?? "absent"}` };
  if (r.uniprotIds.length !== 1) return { pass: false, reason: `${r.uniprotIds.length} UniProt ids` };
  if (r.maneSelect.length === 0) return { pass: false, reason: "no mane_select" };
  if (!r.ensemblGeneId) return { pass: false, reason: "no ensembl_gene_id" };
  return { pass: true, reason: "HGNC: approved, protein product, one UniProt id, MANE Select, Ensembl gene id" };
}

/** UniProt: a reviewed (Swiss-Prot) entry whose cross-references cite no PDB entry. */
export function uniprotVerdict(entry: UniprotEntry): Verdict {
  if (!entry.reviewed) return { pass: false, reason: "UniProt entry not reviewed" };
  if (entry.pdb.length > 0) return { pass: false, reason: `${entry.pdb.length} PDB cross-reference${entry.pdb.length === 1 ? "" : "s"}` };
  return { pass: true, reason: "UniProt: reviewed, no PDB cross-reference" };
}

/** Ensembl: biotype protein_coding and a MANE Select transcript under the builder's own selection rule. */
export function ensemblVerdict(gene: EnsemblGeneRaw): Verdict & { transcript?: string } {
  if (gene.biotype !== "protein_coding") return { pass: false, reason: `Ensembl biotype ${gene.biotype}` };
  let sel: ReturnType<typeof selectTranscript>;
  try {
    sel = selectTranscript(gene);
  } catch (e) {
    return { pass: false, reason: `transcript selection: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (sel.selection.rule !== "mane_select") return { pass: false, reason: `transcript selection rule ${sel.selection.rule} (no MANE Select transcript)` };
  const t = `${sel.selection.selected.id}.${sel.selection.selected.version}`;
  return { pass: true, reason: `Ensembl: protein_coding, MANE Select ${t}`, transcript: t };
}

// ---------------------------------------------------------------- the walk

export interface Visited {
  hgncNumber: number;
  hgncId: string | null;
  symbol: string | null;
  locusType: string | null;
  uniprotAccession: string | null;
  mane: string[] | null;
  ensemblGeneId: string | null;
  /** PDB cross-reference count in the UniProt entry; null when the entry was not fetched. */
  pdbCount: number | null;
  /** Which stage decided: hgnc, uniprot or ensembl. */
  stage: "hgnc" | "uniprot" | "ensembl";
  verdict: "pass" | "skip";
  reason: string;
  maneSelectTranscript?: string;
}

export interface FinderAdapters {
  hgncId(n: number): Promise<{ data: HgncRecord[] }>;
  uniprotEntry(accession: string): Promise<{ data: UniprotEntry; release: string | null; releaseDate: string | null }>;
  ensemblGene(id: string): Promise<{ data: EnsemblGeneRaw }>;
}

export interface FinderOptions {
  seed?: number;
  /** Upper bound on HGNC fetches (default 60). */
  maxCandidates?: number;
  /** Stop at the first pass once this many have passed (default 3). */
  minPassing?: number;
  idMax?: number;
  log?: (m: string) => void;
}

export interface FinderResult {
  seed: number;
  maxCandidates: number;
  minPassing: number;
  idRange: [number, number];
  visited: Visited[];
  passing: Visited[];
  chosen: Visited | null;
  alternates: Visited[];
  /** Why the walk stopped. */
  stoppedBecause: string;
  releases: { uniprot: string | null; uniprotDate: string | null };
  counts: { visited: number; passing: number; skipped: number; skippedByReason: Record<string, number> };
}

/** Walk the sampled ids in order; the first pass is the choice, later passes are alternates. */
export async function findStructureLimited(adapters: FinderAdapters, o: FinderOptions = {}): Promise<FinderResult> {
  const seed = o.seed ?? DEFAULT_SEED;
  const maxCandidates = o.maxCandidates ?? 60;
  const minPassing = o.minPassing ?? 3;
  const idMax = o.idMax ?? HGNC_ID_MAX;
  const log = o.log ?? (() => undefined);
  const visited: Visited[] = [];
  const passing: Visited[] = [];
  const releases: FinderResult["releases"] = { uniprot: null, uniprotDate: null };
  let stoppedBecause = `${maxCandidates} HGNC fetches made`;

  const safely = async <T>(p: Promise<T>): Promise<{ ok: true; value: T } | { ok: false; reason: string }> => {
    try {
      return { ok: true, value: await p };
    } catch (e) {
      if (isHelixDataError(e) && !e.retryable) return { ok: false, reason: `${e.code}: ${e.message}` };
      throw e;
    }
  };

  for (const n of sampleIds(seed, idMax)) {
    if (visited.length >= maxCandidates) break;
    const v: Visited = { hgncNumber: n, hgncId: null, symbol: null, locusType: null, uniprotAccession: null, mane: null, ensemblGeneId: null, pdbCount: null, stage: "hgnc", verdict: "skip", reason: "" };
    visited.push(v);
    const h = await safely(adapters.hgncId(n));
    if (!h.ok) {
      v.reason = h.reason;
      log(`HGNC:${n} skip (${v.reason})`);
      continue;
    }
    const rec = h.value.data[0];
    if (rec) {
      v.hgncId = rec.hgncId;
      v.symbol = rec.symbol;
      v.locusType = rec.locusType;
      v.uniprotAccession = rec.uniprotIds.length === 1 ? rec.uniprotIds[0]! : null;
      v.mane = rec.maneSelect;
      v.ensemblGeneId = rec.ensemblGeneId;
    }
    const hv = hgncVerdict(h.value.data);
    if (!hv.pass) {
      v.reason = hv.reason;
      log(`HGNC:${n} ${rec?.symbol ?? ""} skip (${v.reason})`);
      continue;
    }
    v.stage = "uniprot";
    const u = await safely(adapters.uniprotEntry(v.uniprotAccession!));
    if (!u.ok) {
      v.reason = u.reason;
      log(`HGNC:${n} ${v.symbol} skip (${v.reason})`);
      continue;
    }
    releases.uniprot ??= u.value.release;
    releases.uniprotDate ??= u.value.releaseDate;
    v.pdbCount = u.value.data.pdb.length;
    const uv = uniprotVerdict(u.value.data);
    if (!uv.pass) {
      v.reason = uv.reason;
      log(`HGNC:${n} ${v.symbol} skip (${v.reason})`);
      continue;
    }
    v.stage = "ensembl";
    const g = await safely(adapters.ensemblGene(v.ensemblGeneId!));
    if (!g.ok) {
      v.reason = g.reason;
      log(`HGNC:${n} ${v.symbol} skip (${v.reason})`);
      continue;
    }
    const ev = ensemblVerdict(g.value.data);
    if (!ev.pass) {
      v.reason = ev.reason;
      log(`HGNC:${n} ${v.symbol} skip (${v.reason})`);
      continue;
    }
    v.verdict = "pass";
    v.reason = [hv.reason, uv.reason, ev.reason].join("; ");
    v.maneSelectTranscript = ev.transcript!;
    passing.push(v);
    log(`HGNC:${n} ${v.symbol} PASS (${v.uniprotAccession}, ${v.ensemblGeneId}, ${ev.transcript})`);
    if (passing.length >= minPassing) {
      stoppedBecause = `${passing.length} candidates passed (the stop rule asks for ${minPassing})`;
      break;
    }
  }
  const skipped = visited.filter((v) => v.verdict === "skip");
  const skippedByReason: Record<string, number> = {};
  for (const s of skipped) skippedByReason[s.reason] = (skippedByReason[s.reason] ?? 0) + 1;
  return {
    seed,
    maxCandidates,
    minPassing,
    idRange: [1, idMax],
    visited,
    passing,
    chosen: passing[0] ?? null,
    alternates: passing.slice(1),
    stoppedBecause,
    releases,
    counts: { visited: visited.length, passing: passing.length, skipped: skipped.length, skippedByReason },
  };
}
