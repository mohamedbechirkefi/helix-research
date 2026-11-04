// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * The reference-variant finder (Phase 9, P9.2.3; docs/phase-9-generalisation.md section 15
 * rule 1): the variant of a curated set is chosen by rule, not by hand. One ClinVar esearch for
 * the gene's missense variants classified Pathogenic or Likely pathogenic, one esummary for the
 * uids (capped), the summaries filtered on ClinVar's own words (classification, review status
 * of at least two stars, a single-nucleotide single variant with a dbSNP id and a protein change
 * that is a substitution), ranked by review status, then by number of supporting submissions,
 * then by accession number; then, in rank order, the structure candidate check
 * (lib/structure-candidates.ts) over the UniProt entry's PDB cross-references that cover the
 * residue; the first candidate whose residue is observed in a kept entry is the choice, with
 * that entry.
 *
 * This module takes its adapters as an interface so that the parsing, the verdicts, the ranking
 * and the walk are unit-tested on hand-made summaries; find-variant.ts wires the live adapters,
 * records the ClinVar responses and writes the report.
 */
import type { ClinvarRecord, UniprotEntry } from "@helix/data-adapters";
import { clinvarReviewStars } from "@helix/scientific-core";
import { type CandidateReport, pdbCrossReferencesCovering } from "./structure-candidates.ts";

// ---------------------------------------------------------------- the protein change

const THREE_TO_ONE: Record<string, string> = {
  Ala: "A", Arg: "R", Asn: "N", Asp: "D", Cys: "C", Gln: "Q", Glu: "E", Gly: "G", His: "H", Ile: "I",
  Leu: "L", Lys: "K", Met: "M", Phe: "F", Pro: "P", Ser: "S", Thr: "T", Trp: "W", Tyr: "Y", Val: "V",
};

export interface ProteinChange {
  /** "p.Leu368Gln" as ClinVar writes it in the record's name. */
  hgvsP: string;
  referenceThree: string;
  position: number;
  alternateThree: string;
  referenceOne: string;
  alternateOne: string;
}

/**
 * Read the protein change from a ClinVar record name ("NM_001044.5(SLC6A3):c.1103T>A (p.Leu368Gln)").
 * Returns the substitution, or the reason it is not one (frameshift, nonsense, deletion, duplication,
 * insertion, synonymous, start loss, extension, no protein change): plan section 11 rule 1 applies to any
 * deletion and a frameshift or nonsense candidate is skipped with its reason (section 15 rule 1).
 */
export function parseProteinChange(name: string): { change: ProteinChange; reason: null } | { change: null; reason: string } {
  const m = /\(p\.([^)]*)\)/.exec(name);
  if (!m) return { change: null, reason: "no protein change in the record name" };
  const p = m[1]!;
  if (/fs/.test(p)) return { change: null, reason: `frameshift (p.${p}): out of scope (plan section 11 rule 1)` };
  if (/Ter|\*/.test(p)) return { change: null, reason: `nonsense (p.${p}): not a substitution of one residue` };
  if (/delins/.test(p)) return { change: null, reason: `deletion-insertion (p.${p}): not a substitution` };
  if (/del/.test(p)) return { change: null, reason: `deletion (p.${p}): plan section 11 rule 1 applies to any deletion; not a candidate for a missense set` };
  if (/dup/.test(p)) return { change: null, reason: `duplication (p.${p}): not a substitution` };
  if (/ins/.test(p)) return { change: null, reason: `insertion (p.${p}): not a substitution` };
  if (/ext/.test(p)) return { change: null, reason: `extension (p.${p}): not a substitution` };
  if (/=/.test(p)) return { change: null, reason: `synonymous (p.${p}): no residue change` };
  if (/\?/.test(p)) return { change: null, reason: `unknown effect (p.${p}): not a substitution` };
  const s = /^([A-Z][a-z]{2})(\d+)([A-Z][a-z]{2})$/.exec(p);
  if (!s) return { change: null, reason: `protein change p.${p} is not of the form p.Xxx000Yyy` };
  const [, ref, pos, alt] = s;
  const refOne = THREE_TO_ONE[ref!];
  const altOne = THREE_TO_ONE[alt!];
  if (!refOne || !altOne) return { change: null, reason: `protein change p.${p} names a residue outside the twenty standard amino acids` };
  if (refOne === altOne) return { change: null, reason: `protein change p.${p} changes no residue` };
  return { change: { hgvsP: `p.${p}`, referenceThree: ref!, position: Number(pos), alternateThree: alt!, referenceOne: refOne, alternateOne: altOne }, reason: null };
}

// ---------------------------------------------------------------- the candidate verdict (pure)

/** ClinVar's aggregate germline classifications the rule accepts (section 15 rule 1: Pathogenic or Likely pathogenic). */
export const ACCEPTED_CLASSIFICATIONS = ["Pathogenic", "Likely pathogenic", "Pathogenic/Likely pathogenic"] as const;
export const MISSENSE = "missense variant";
export const SINGLE_NUCLEOTIDE = "single nucleotide variant";

export interface VariantCandidate {
  uid: string;
  accession: string;
  accessionVersion: string;
  /** The ClinVar accession as a number, the last ranking key. */
  accessionNumber: number;
  title: string;
  classification: string;
  reviewStatus: string;
  /** ClinVar's star level for the review status (null when the status is outside ClinVar's table). */
  reviewStars: number | null;
  supportingSubmissions: number;
  molecularConsequences: string[];
  variantTypes: string[];
  dbSnpIds: string[];
  proteinChange: ProteinChange | null;
  /** Null when eligible; otherwise why the candidate is skipped before any structure is asked. */
  skipReason: string | null;
  /** 1-based rank among the eligible candidates (null when skipped). */
  rank: number | null;
}

/** The verdict on one summary against the rule, before any structure request. */
export function candidateOf(r: ClinvarRecord, minStars = 2): VariantCandidate {
  const stars = clinvarReviewStars(r.reviewStatus);
  const pc = parseProteinChange(r.title || r.variationNames[0] || "");
  const reasons: string[] = [];
  if (!(ACCEPTED_CLASSIFICATIONS as readonly string[]).includes(r.classification)) reasons.push(`classification "${r.classification}" is not Pathogenic or Likely pathogenic`);
  if (stars === null) reasons.push(`review status "${r.reviewStatus}" is outside ClinVar's star table`);
  else if (stars < minStars) reasons.push(`review status "${r.reviewStatus}" is ${stars} star${stars === 1 ? "" : "s"} (the rule asks for at least ${minStars})`);
  if (r.isHaplotypeOrCompound) reasons.push(`${r.objectType}: not a single variant`);
  if (!r.molecularConsequences.includes(MISSENSE)) reasons.push(`molecular consequence ${r.molecularConsequences.length ? r.molecularConsequences.map((c) => `"${c}"`).join(", ") : "absent"} does not include "${MISSENSE}"`);
  if (r.variantTypes.length !== 1 || r.variantTypes[0] !== SINGLE_NUCLEOTIDE) reasons.push(`variant type ${r.variantTypes.length ? r.variantTypes.map((t) => `"${t}"`).join(", ") : "absent"}: the builder's substitution path takes a single nucleotide variant`);
  if (r.dbSnpIds.length === 0) reasons.push("no dbSNP id among the variation cross-references");
  if (pc.change === null) reasons.push(pc.reason);
  return {
    uid: r.uid,
    accession: r.accession,
    accessionVersion: r.accessionVersion,
    accessionNumber: Number(r.accession.replace(/^[A-Z]+0*/, "")) || Number.POSITIVE_INFINITY,
    title: r.title,
    classification: r.classification,
    reviewStatus: r.reviewStatus,
    reviewStars: stars,
    supportingSubmissions: r.supportingSubmissionCount,
    molecularConsequences: r.molecularConsequences,
    variantTypes: r.variantTypes,
    dbSnpIds: r.dbSnpIds,
    proteinChange: pc.change,
    skipReason: reasons.length ? reasons.join("; ") : null,
    rank: null,
  };
}

/** Review status (stars) descending, then supporting submissions descending, then accession number ascending. */
export function compareCandidates(a: VariantCandidate, b: VariantCandidate): number {
  return (b.reviewStars ?? -1) - (a.reviewStars ?? -1) || b.supportingSubmissions - a.supportingSubmissions || a.accessionNumber - b.accessionNumber;
}

/** Verdicts for every summary, with the eligible ones ranked (the skipped keep ClinVar's order after them). */
export function rankCandidates(records: ClinvarRecord[], minStars = 2): VariantCandidate[] {
  const all = records.map((r) => candidateOf(r, minStars));
  const eligible = all.filter((c) => c.skipReason === null).sort(compareCandidates);
  eligible.forEach((c, i) => {
    c.rank = i + 1;
  });
  return [...eligible, ...all.filter((c) => c.skipReason !== null)];
}

// ---------------------------------------------------------------- the walk

export interface StructureSearch {
  residue: number;
  uniprotResidue: string;
  /** The PDB cross-references of the UniProt entry whose Chains property covers the residue, in UniProt's order. */
  entriesCovering: string[];
  /** Cross-references whose Chains property has no parsable range (none expected). */
  unparsedCrossReferences: string[];
  candidates: CandidateReport[];
  chosenEntry: string | null;
}

export interface WalkedCandidate extends VariantCandidate {
  /** The structure check for this candidate's residue; null when the candidate was skipped or not reached. */
  structure: StructureSearch | null;
  verdict: string;
}

export interface VariantFinderAdapters {
  esearch(symbol: string, retmax: number): Promise<{ data: { count: number; uids: string[] } }>;
  esummary(uids: string[]): Promise<{ data: ClinvarRecord[] }>;
  uniprotEntry(accession: string): Promise<{ data: UniprotEntry; release: string | null; releaseDate: string | null }>;
  /** The structure candidate check for one entry and one residue (lib/structure-candidates.ts, cached per entry). */
  checkStructure(entryId: string, accession: string, uniSeq: string, residue: number): Promise<CandidateReport>;
}

export interface VariantFinderOptions {
  /** Upper bound on the uids summarised (default and maximum 100). */
  retmax?: number;
  /** The least review-status star level accepted (default 2, the rule's; 1 only when no two-star candidate qualifies, and said loudly). */
  minStars?: number;
  log?: (m: string) => void;
}

export interface VariantFinderResult {
  symbol: string;
  accession: string;
  uniprot: { release: string | null; releaseDate: string | null; length: number; pdbCrossReferences: number };
  retmax: number;
  minStars: number;
  esearch: { count: number; returned: number; capped: boolean };
  candidates: WalkedCandidate[];
  counts: { summarised: number; eligible: number; skipped: number; structureChecked: number; skippedByReason: Record<string, number> };
  chosen: { candidate: WalkedCandidate; entry: CandidateReport } | null;
  stoppedBecause: string;
}

/**
 * Run the rule: one esearch, one esummary, verdicts and ranks, then the structure check for each
 * eligible candidate in rank order until one residue is observed in a kept entry.
 */
export async function findVariant(adapters: VariantFinderAdapters, symbol: string, accession: string, o: VariantFinderOptions = {}): Promise<VariantFinderResult> {
  const retmax = o.retmax ?? 100;
  const minStars = o.minStars ?? 2;
  const log = o.log ?? (() => undefined);
  const search = await adapters.esearch(symbol, retmax);
  const uids = search.data.uids;
  const capped = search.data.count > uids.length;
  log(`esearch ${symbol}: ${search.data.count} record(s), ${uids.length} uid(s) returned${capped ? ` (capped at ${retmax}: the rest are not seen)` : ""}`);
  const records = uids.length > 0 ? (await adapters.esummary(uids)).data : [];
  const ranked = rankCandidates(records, minStars);
  const u = await adapters.uniprotEntry(accession);
  const uniSeq = u.data.sequence;
  const walked: WalkedCandidate[] = ranked.map((c) => ({ ...c, structure: null, verdict: c.skipReason ? `skipped: ${c.skipReason}` : "not checked" }));
  let chosen: VariantFinderResult["chosen"] = null;
  let structureChecked = 0;
  let stoppedBecause = "no eligible candidate";
  for (const c of walked) {
    if (c.skipReason !== null) continue;
    if (chosen) {
      c.verdict = "not checked: a higher-ranked candidate was chosen";
      continue;
    }
    const pc = c.proteinChange!;
    const uniRes = uniSeq[pc.position - 1] ?? "";
    if (uniRes !== pc.referenceOne) {
      c.verdict = `skipped at the structure step: UniProt ${accession} has ${uniRes || "no residue"} at ${pc.position}, the protein change says ${pc.referenceThree} (${pc.referenceOne}); the record's transcript numbering is not the entry's`;
      log(`${c.accession} ${pc.hgvsP}: ${c.verdict}`);
      continue;
    }
    const { covering, unparsed } = pdbCrossReferencesCovering(u.data.pdb, pc.position);
    const search: StructureSearch = { residue: pc.position, uniprotResidue: uniRes, entriesCovering: covering.map((x) => x.id), unparsedCrossReferences: unparsed, candidates: [], chosenEntry: null };
    c.structure = search;
    structureChecked += 1;
    log(`${c.accession} ${pc.hgvsP} (rank ${c.rank}, ${c.reviewStars} stars, ${c.supportingSubmissions} submissions): ${covering.length} cross-referenced entr${covering.length === 1 ? "y covers" : "ies cover"} residue ${pc.position}${covering.length ? `: ${covering.map((x) => x.id).join(", ")}` : ""}`);
    for (const x of covering) {
      const r = await adapters.checkStructure(x.id, accession, uniSeq, pc.position);
      search.candidates.push(r);
      log(`  ${r.entryId}: ${r.verdict}`);
      if (r.kept) {
        search.chosenEntry = r.entryId;
        break;
      }
    }
    if (search.chosenEntry) {
      c.verdict = `chosen: residue ${pc.position} observed in ${search.chosenEntry} (${search.candidates.at(-1)!.method}${search.candidates.at(-1)!.resolutionAngstrom === null ? "" : `, ${search.candidates.at(-1)!.resolutionAngstrom} A`}), wild type over the mapped segments`;
      chosen = { candidate: c, entry: search.candidates.at(-1)! };
      stoppedBecause = `rank ${c.rank} (${c.accession}, ${pc.hgvsP}) has its residue observed in ${search.chosenEntry}`;
    } else {
      c.verdict = covering.length === 0 ? `no PDB cross-reference of ${accession} covers residue ${pc.position}` : `residue ${pc.position} is observed in no kept entry (${search.candidates.map((r) => `${r.entryId}: ${r.observed ? (r.kept ? "kept" : "refused") : "not observed"}`).join("; ")})`;
    }
  }
  if (!chosen && walked.some((c) => c.skipReason === null)) stoppedBecause = "every eligible candidate was checked; none has its residue observed in a kept entry";
  const skipped = walked.filter((c) => c.skipReason !== null);
  const skippedByReason: Record<string, number> = {};
  for (const s of skipped) skippedByReason[s.skipReason!] = (skippedByReason[s.skipReason!] ?? 0) + 1;
  return {
    symbol,
    accession,
    uniprot: { release: u.release, releaseDate: u.releaseDate, length: uniSeq.length, pdbCrossReferences: u.data.pdb.length },
    retmax,
    minStars,
    esearch: { count: search.data.count, returned: uids.length, capped },
    candidates: walked,
    counts: { summarised: records.length, eligible: walked.length - skipped.length, skipped: skipped.length, structureChecked, skippedByReason },
    chosen,
    stoppedBecause,
  };
}
