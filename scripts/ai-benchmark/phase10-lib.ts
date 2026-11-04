// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Phase 10 reliability benchmark (P10.3.1): the frozen items as scoring units, and each unit's planning
 * context built the way the app builds it (helix-app apps/web/src/controller.ts and
 * packages/ai-director/src/director.ts at the time of the run). Node only; no model is called here.
 *
 * The app's context, per set:
 *   buildHbbContext(records found by manifest kind; the pathway and association records are not loaded
 *   at start) -> withExplorerRecords -> restrictToBuild (worlds protein, dna, pathway; registry v3) ->
 *   routeByCues, cueRules "dh010" -> planPrompt "v7" (the `?prompt=v7` development switch) ->
 *   contextualRecords (protein, contacts, variant).
 * Per question:
 *   the pathway record joins the context when the question asks about pathways (asksPathway) or Pathway
 *   World was opened earlier in the session; the associations record when the question asks about
 *   diseases (asksAssociation) or they were loaded earlier; the Director's contextFor (selection, loaded
 *   structure, retrieved text, codon selection, answer kind, world on screen), then the selection facts
 *   bound to the question (withSelectionFacts) and the session's depth and interests.
 * The selection is linked as the app's selection bridge links it: a codon selected in DNA World also
 * selects the structure residue its mapping of record gives (first mapped residue), and a residue picked
 * in the viewer also selects its codon (the protein position of the mapping table), so the selection
 * facts carry both. `restrictToBuild` and the bridge's lookups live in helix-app; they are re-stated
 * here (a few lines each) because the research library does not import app code.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  ACTION_TYPES,
  MEASURED_PROMPT_ACTIONS,
  PHASE10_ACTIONS,
  associationContext,
  asksAssociation,
  asksPathway,
  buildHbbContext,
  contextualRecords,
  pathwayContext,
  selectionFacts,
  selectionFeature,
  withExplorerRecords,
  withSelectionFacts,
  withSession,
  type HbbBundle,
  type PlanningContext,
  type World,
} from "@helix/ai-planning";
import { REPO_ROOT } from "./lib.ts";

export const PHASE10_DIR = join(REPO_ROOT, "research", "benchmark", "phase10");
export const FROZEN_FILES = ["questions.jsonl", "followups.jsonl", "injection.jsonl"] as const;
export const DATASETS = ["hbb", "cftr", "brca1", "slc6a3", "faah2"] as const;
export type Dataset = (typeof DATASETS)[number];

export const sha256 = (s: string | Buffer): string => createHash("sha256").update(s).digest("hex");

/** sha256 of each frozen file on disk, and the value the README's integrity block states. */
export function frozenHashes(): { file: string; onDisk: string; readme: string | null; match: boolean }[] {
  const readme = readFileSync(join(PHASE10_DIR, "README.md"), "utf8");
  const out = FROZEN_FILES.map((file) => {
    const onDisk = sha256(readFileSync(join(PHASE10_DIR, file)));
    const m = readme.match(new RegExp(`([0-9a-f]{64})\\s+${file.replace(".", "\\.")}`));
    const stated = m?.[1] ?? null;
    return { file, onDisk, readme: stated, match: stated === onDisk };
  });
  return [...out, { file: "README.md", onDisk: sha256(readFileSync(join(PHASE10_DIR, "README.md"))), readme: null, match: true }];
}

// ---- items -------------------------------------------------------------------------------------

export interface Expected {
  outcome: "executed" | "answered" | "refused" | "clarify";
  planOutcome: "plan" | "unsupported" | "clarify";
  actions: Record<string, unknown>[][];
  allowedValues?: Record<string, unknown[]>;
  forbiddenActionTypes?: string[];
  forbiddenActions?: Record<string, unknown>[];
  forbiddenIds?: string[];
  forbiddenStrings?: string[];
  world: World;
  refusalReason?: string;
  forbiddenClaims: string[];
}
export interface SessionState {
  currentWorld: World;
  loadedStructureId: string | null;
  loadedAssembly?: string | null;
  highlighted?: string;
  sequenceHighlight?: string;
  pathwayOpen?: string;
  representation?: string;
  domainsShown?: string;
  evidenceShown?: string[];
}
export interface ItemSelection {
  world: World;
  residue?: { structureId: string; chainId: string; residueNumber: number; compId: string; numbering: "auth"; uniprotPosition: number };
  codon?: { transcriptId: string; number: number; bases: string; aminoAcid: string };
}
export interface RetrievedIn {
  source: string;
  field: string;
  text: string;
}

/** One scored question: a questions.jsonl or injection.jsonl row, or one turn of a follow-up sequence. */
export interface Unit {
  /** Row id, or `<sequence id>/<turn>` for a follow-up turn. */
  id: string;
  file: "questions" | "injection" | "followups";
  dataset: Dataset;
  /** The report's category: the row's category, `injection`, or `followup`. */
  category: string;
  /** The tested action of an `action` row. */
  action: string | null;
  sequence: string | null;
  turn: number | null;
  query: string;
  selection: ItemSelection | null;
  session: SessionState;
  retrieved: RetrievedIn[];
  expected: Expected;
  /** Follow-up turns: the queries of the earlier turns of the sequence (they decide which records the session has loaded). */
  earlierQueries: string[];
  /** Follow-up turns: the states the earlier turns started from (worlds visited). */
  earlierStates: SessionState[];
  /** Follow-up turns: the earlier turns' oracle actions (topics of the questions already answered). */
  earlierExpected: Expected[];
}

const jsonl = (file: string): Record<string, unknown>[] =>
  readFileSync(join(PHASE10_DIR, file), "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as Record<string, unknown>);

export function loadUnits(): Unit[] {
  const units: Unit[] = [];
  const row = (r: Record<string, unknown>, file: Unit["file"]): Unit => ({
    id: r.id as string,
    file,
    dataset: r.dataset as Dataset,
    category: file === "injection" ? "injection" : (r.category as string),
    action: (r.action as string | undefined) ?? null,
    sequence: null,
    turn: null,
    query: r.query as string,
    selection: (r.selection as ItemSelection | null) ?? null,
    session: r.session as SessionState,
    retrieved: (r.retrieved as RetrievedIn[] | undefined) ?? [],
    expected: r.expected as Expected,
    earlierQueries: [],
    earlierStates: [],
    earlierExpected: [],
  });
  for (const r of jsonl("questions.jsonl")) units.push(row(r, "questions"));
  for (const r of jsonl("followups.jsonl")) {
    const turns = r.turns as { turn: number; query: string; selection: ItemSelection | null; assumes: SessionState; expected: Expected }[];
    turns.forEach((t, i) =>
      units.push({
        id: `${r.id as string}/${t.turn}`,
        file: "followups",
        dataset: r.dataset as Dataset,
        category: "followup",
        action: null,
        sequence: r.id as string,
        turn: t.turn,
        query: t.query,
        selection: t.selection ?? null,
        session: t.assumes,
        retrieved: [],
        expected: t.expected,
        earlierQueries: turns.slice(0, i).map((x) => x.query),
        earlierStates: turns.slice(0, i).map((x) => x.assumes),
        earlierExpected: turns.slice(0, i).map((x) => x.expected),
      }),
    );
  }
  for (const r of jsonl("injection.jsonl")) units.push(row(r, "injection"));
  return units;
}

// ---- the set's records and the app's base context ---------------------------------------------

interface Manifest {
  files: { path: string; recordKind: string }[];
}
interface MappingTable {
  uniprotAccession: string;
  entryId: string;
  positions: { uniprotPosition: number; residues: { authAsymId: string; authSeqId: string; compId: string }[] }[];
}
interface VariantMapping {
  uniprotAccession: string;
  uniprotPosition: number;
  entryId: string;
  residues: { authAsymId: string; authSeqId: string; compId: string }[];
}

export interface SetRecords {
  dataset: Dataset;
  bundle: HbbBundle;
  pathways: unknown | null;
  associations: unknown | null;
  table: MappingTable | null;
  variantMapping: VariantMapping | null;
  cds: string;
  transcriptId: string;
  protein: { accession: string; sequence: string };
  /** The app's context at page load, before any question (see the header). */
  base: PlanningContext;
}

/** The worlds of the app's build (helix-app apps/web/src/build-worlds.ts). */
export const BUILD_WORLDS: readonly World[] = ["protein", "dna", "pathway"];
/** helix-app packages/ai-actions registry v3: the Phase 6 registry and the six Phase 10 actions. */
export const REGISTERED_ACTION_TYPES: readonly string[] = [...MEASURED_PROMPT_ACTIONS, ...PHASE10_ACTIONS];

/** helix-app packages/ai-director/src/providers.ts restrictToBuild, re-stated. */
export function restrictToBuild(ctx: PlanningContext, build: { worlds: readonly World[]; actions: readonly string[]; reason: string }): PlanningContext {
  return {
    ...ctx,
    worlds: ctx.worlds.map((w) => (build.worlds.includes(w.id) ? w : { ...w, available: false, reason: w.available ? build.reason : w.reason })),
    executableActions: build.actions.filter((a) => (ACTION_TYPES as readonly string[]).includes(a)),
  };
}

export function loadSet(dataset: Dataset): SetRecords {
  const dir = join(REPO_ROOT, "data", "curated", dataset);
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as Manifest;
  const ofKind = (kind: string): unknown | null => {
    const f = manifest.files.find((x) => x.recordKind === kind);
    return f ? (JSON.parse(readFileSync(join(dir, f.path), "utf8")) as unknown) : null;
  };
  // The app's loader (helix-app apps/web/src/data.ts KINDS): pathways and associations load on first need.
  const bundle: HbbBundle = {
    gene: ofKind("gene"),
    transcript: ofKind("transcript"),
    protein: ofKind("protein"),
    variant: ofKind("variant"),
    structure: ofKind("structure"),
    mapping: ofKind("residue-mapping"),
    contacts: ofKind("residue-contacts"),
    predicted: ofKind("predicted-model"),
    capabilities: ofKind("capabilities"),
  };
  const built0 = buildHbbContext(bundle);
  const withExplorer = withExplorerRecords(built0, { gene: bundle.gene, protein: bundle.protein });
  const built = restrictToBuild(withExplorer, { worlds: BUILD_WORLDS, actions: REGISTERED_ACTION_TYPES, reason: "no scene for this world in the Phase 6 build" });
  const base: PlanningContext = { ...built, routeByCues: true, cueRules: "dh010", planPrompt: "v7" };
  base.contextualRecords = contextualRecords({ protein: bundle.protein, contacts: bundle.structure ? bundle.contacts : null, variant: bundle.variant });
  const seqs = ofKind("sequence-set") as { records: { sequenceKind: string; sourceId: string; sequence: string }[] };
  const tx = bundle.transcript as { id: { id: string; version: number } };
  const transcriptId = `${tx.id.id}.${tx.id.version}`;
  const cds = seqs.records.find((r) => r.sequenceKind === "cds" && r.sourceId === transcriptId)?.sequence;
  if (!cds) throw new Error(`${dataset}: no CDS for ${transcriptId}`);
  const p = bundle.protein as { accession: string; sequence: string };
  return {
    dataset,
    bundle,
    pathways: ofKind("pathway-memberships"),
    associations: ofKind("disease-associations"),
    table: ofKind("residue-mapping-table") as MappingTable | null,
    variantMapping: bundle.mapping as VariantMapping | null,
    cds,
    transcriptId,
    protein: { accession: p.accession, sequence: p.sequence },
    base,
  };
}

// ---- the selection bridge (re-stated lookups) --------------------------------------------------

const BASES = "TCAG";
const AMINO = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";
/** The standard genetic code, one-letter amino acids ("*" for a stop). */
export function translateCodon(bases: string): string {
  const b = bases.toUpperCase();
  const i = BASES.indexOf(b[0] ?? "");
  const j = BASES.indexOf(b[1] ?? "");
  const k = BASES.indexOf(b[2] ?? "");
  if (i < 0 || j < 0 || k < 0 || b.length !== 3) return "?";
  return AMINO[i * 16 + j * 4 + k]!;
}
const AA1: Record<string, string> = { Ala: "A", Arg: "R", Asn: "N", Asp: "D", Cys: "C", Gln: "Q", Glu: "E", Gly: "G", His: "H", Ile: "I", Leu: "L", Lys: "K", Met: "M", Phe: "F", Pro: "P", Ser: "S", Thr: "T", Trp: "W", Tyr: "Y", Val: "V" };

interface Residue {
  structureId: string;
  chainId: string;
  residueNumber: number;
  compId: string;
}
interface CodonFact {
  transcriptId: string;
  codon: number;
  bases: string;
  aminoAcid: string;
  protein: { accession: string; position: number; residue: string } | null;
}

/** Codon k as the bridge reads it: reference bases, translation, the protein position k (Met = 1). */
function codonFact(set: SetRecords, k: number): CodonFact {
  const bases = set.cds.slice((k - 1) * 3, k * 3);
  return { transcriptId: set.transcriptId, codon: k, bases, aminoAcid: translateCodon(bases), protein: { accession: set.protein.accession, position: k, residue: set.protein.sequence[k - 1] ?? "?" } };
}
/** Protein position -> the structure residue the bridge selects: the variant mapping of record, else the first mapped residue of the full-chain table. */
function residueForPosition(set: SetRecords, position: number): Residue | null {
  const m = set.variantMapping;
  if (m && m.uniprotPosition === position && m.residues[0]) return { structureId: m.entryId, chainId: m.residues[0].authAsymId, residueNumber: Number(m.residues[0].authSeqId), compId: m.residues[0].compId };
  const row = set.table?.positions.find((r) => r.uniprotPosition === position);
  const r0 = row?.residues[0];
  return set.table && r0 ? { structureId: set.table.entryId, chainId: r0.authAsymId, residueNumber: Number(r0.authSeqId), compId: r0.compId } : null;
}
/** Structure residue -> protein position, looked up in the full-chain table (the bridge's fromStructureResidue). */
function positionForResidue(set: SetRecords, r: Residue): number | null {
  if (!set.table || set.table.entryId !== r.structureId) return null;
  const row = set.table.positions.find((p) => p.residues.some((x) => x.authAsymId === r.chainId && Number(x.authSeqId) === r.residueNumber));
  return row?.uniprotPosition ?? null;
}

/** The selection as the app's shared state holds it after the bridge linked it (both sides), checked against the item. */
export function linkedSelection(set: SetRecords, sel: ItemSelection | null): { residue: Residue | null; codon: CodonFact | null } {
  if (!sel) return { residue: null, codon: null };
  if (sel.residue) {
    const r = { structureId: sel.residue.structureId, chainId: sel.residue.chainId, residueNumber: sel.residue.residueNumber, compId: sel.residue.compId };
    const pos = positionForResidue(set, r);
    if (pos !== sel.residue.uniprotPosition) throw new Error(`${set.dataset}: residue ${r.chainId}${r.residueNumber} maps to ${pos}, the item says ${sel.residue.uniprotPosition}`);
    return { residue: r, codon: codonFact(set, pos) };
  }
  if (sel.codon) {
    const c = codonFact(set, sel.codon.number);
    if (c.bases !== sel.codon.bases || c.aminoAcid !== AA1[sel.codon.aminoAcid]) throw new Error(`${set.dataset}: codon ${sel.codon.number} is ${c.bases} ${c.aminoAcid}, the item says ${sel.codon.bases} ${sel.codon.aminoAcid}`);
    return { residue: residueForPosition(set, sel.codon.number), codon: c };
  }
  return { residue: null, codon: null };
}

// ---- the session ---------------------------------------------------------------------------------

const TOPIC_ORDER = ["structure", "sequence", "domains", "pathways", "evidence"] as const;
const WORLD_TOPIC: Partial<Record<string, (typeof TOPIC_ORDER)[number]>> = { protein: "structure", pathway: "pathways" };
/** helix-app session-profile.ts topicsOfPlan, over action objects. */
function topicsOfActions(actions: Record<string, unknown>[]): string[] {
  const t = new Set<string>();
  for (const a of actions) {
    const ty = a.type;
    if (ty === "loadStructure" || ty === "focusCamera" || ty === "highlightResidue" || ty === "setRepresentation" || ty === "beginTransition" || (ty === "enterWorld" && a.world === "protein")) t.add("structure");
    if (ty === "highlightSequenceRegion" || ty === "compareVariants" || ty === "selectTranscript") t.add("sequence");
    if (ty === "showPathway" || (ty === "enterWorld" && a.world === "pathway")) t.add("pathways");
    if (ty === "showProteinDomains") t.add("domains");
    if (ty === "revealEvidence") t.add("evidence");
  }
  return [...t];
}

/**
 * The answer kind (D-H007): a follow-up when an earlier question of the session executed a plan. A
 * follow-up turn after turn 1 always is; a single row is when its session carries a trace that only an
 * earlier answer leaves (a highlight, a sequence mark, an open pathway, a representation, the domains,
 * revealed evidence). A world or a structure alone is not such a trace (a chapter or the world
 * navigation also leaves them, and they do not count in the app).
 */
export function answerKind(u: Unit): "first" | "follow-up" {
  if (u.turn !== null && u.turn > 1) return "follow-up";
  const s = u.session;
  const trace = s.highlighted !== undefined || s.sequenceHighlight !== undefined || s.pathwayOpen !== undefined || s.representation !== undefined || s.domainsShown !== undefined || (s.evidenceShown?.length ?? 0) > 0;
  return trace ? "follow-up" : "first";
}

/** The session's interests (helix-app session-profile.ts inferInterests) from the worlds the session shows it visited and the answers it shows. */
export function interestsFor(u: Unit): string[] {
  const topics = new Set<string>();
  for (const s of [...u.earlierStates, u.session]) {
    const t = WORLD_TOPIC[s.currentWorld];
    if (t) topics.add(t);
    if (s.pathwayOpen) topics.add("pathways");
  }
  for (const e of u.earlierExpected) for (const t of topicsOfActions(e.actions.map((step) => step[0]!))) topics.add(t);
  if (u.turn === null) {
    // A single row's traces stand for the answer that left them.
    const s = u.session;
    if (s.highlighted) topics.add("structure");
    if (s.sequenceHighlight) topics.add("sequence");
    if (s.domainsShown) topics.add("domains");
    if ((s.evidenceShown?.length ?? 0) > 0) topics.add("evidence");
  }
  return TOPIC_ORDER.filter((t) => topics.has(t));
}

export interface UnitContext {
  ctx: PlanningContext;
  notes: { answer: "first" | "follow-up"; pathwaysLoaded: boolean; associationsLoaded: boolean; selection: Residue | null; codon: number | null; binding: string | null; interests: string[] };
}

/** The planning context the app's Director would plan this unit in (prompt v7). */
export function unitContext(set: SetRecords, u: Unit): UnitContext {
  const base: PlanningContext = { ...set.base, evidence: [...set.base.evidence] };
  const pathwayWorld = base.worlds.some((w) => w.id === "pathway" && w.available);
  const asked = [...u.earlierQueries, u.query];
  const pathwaysLoaded = !!set.pathways && ((pathwayWorld && asked.some(asksPathway)) || [...u.earlierStates, u.session].some((s) => s.currentWorld === "pathway" || s.pathwayOpen !== undefined));
  const associationsLoaded = !!set.associations && (asked.some(asksAssociation) || [...u.earlierStates, u.session].some((s) => (s.evidenceShown ?? []).some((e) => e.startsWith("opentargets:"))));
  if (pathwaysLoaded) {
    const add = pathwayContext(set.pathways);
    base.pathways = add.pathways;
    for (const e of add.evidence) if (!base.evidence.some((x) => x.id === e.id)) base.evidence.push(e);
  }
  if (associationsLoaded) {
    const add = associationContext(set.associations);
    base.associations = add.associations;
    for (const e of add.evidence) if (!base.evidence.some((x) => x.id === e.id)) base.evidence.push(e);
  }
  const link = linkedSelection(set, u.selection);
  const answer = answerKind(u);
  // helix-app Director.contextFor: loadedStructureId falls back to the selection's structure.
  const sel = link.residue ? { ...link.residue, numbering: "auth" as const, featureId: selectionFeature(base, link.residue.structureId, link.residue.chainId, link.residue.residueNumber) } : null;
  const ctx0 = withSession(base, {
    selection: sel,
    loadedStructureId: u.session.loadedStructureId ?? (sel ? sel.structureId : null),
    retrieved: u.retrieved.map((r) => ({ source: `${r.source} ${r.field}`, text: r.text })),
    sequenceSelection: link.codon ? { transcriptId: link.codon.transcriptId, codon: link.codon.codon } : null,
    answer,
    currentWorld: u.session.currentWorld,
  });
  const facts = selectionFacts(base, { codon: link.codon, residue: link.residue, unmappedReason: null });
  const ctx1 = withSelectionFacts(ctx0, facts, u.query);
  const interests = interestsFor(u);
  const ctx: PlanningContext = { ...ctx1, personalisation: { depth: "standard", interests } };
  return { ctx, notes: { answer, pathwaysLoaded, associationsLoaded, selection: link.residue, codon: link.codon?.codon ?? null, binding: ctx.selectionFacts?.binding?.subject ?? null, interests } };
}
