// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Phase 10 held-out run (D-H024, set and prompt v8 frozen by D-H025): the app's own code, imported at run
 * time from the sibling helix-app checkout, plans every unit. Nothing of the app is copied into this
 * repository; the commit and the sha256 of each imported file are written to the run manifest.
 *
 * Imported from helix-app (see APP_FILES):
 * - packages/ai-director: the Director class (contextFor with the D-H024 answer 74 loaded-structure rule, the
 *   split route and its acceptance, the echo screen, the claim screen, the follow-up filter), restrictToBuild,
 *   claimFactsFromRecords;
 * - packages/scene-engine: the SelectionBridge (with its TranscriptModel and TargetResolver), which links a
 *   codon selected in DNA World to its structure residue (the resolver's focus residue) and a residue picked
 *   in the viewer to its codon.
 * What stays in this repository: which records a unit's session has loaded, its answer kind and interests
 * (phase10-lib.ts unitBase, answerKind, interestsFor), and the session object the app's controller passes
 * (questionSession, re-stated in directorSession below from helix-app apps/web/src/controller.ts).
 *
 * The app modules are loaded with a computed specifier so that this repository's typecheck does not compile
 * app sources; the shapes used are declared here.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DeterministicProvider,
  ProviderError,
  ProviderRegistry,
  buildMessages,
  schemaFor,
  selectionFacts,
  type Plan,
  type PlanProvider,
  type PlanningContext,
  type ProviderOutput,
  type PlanRequest,
  type SelectionFacts,
  type World,
} from "@helix/ai-planning";
import { REPO_ROOT } from "./lib.ts";
import { BUILD_WORLDS, REGISTERED_ACTION_TYPES, answerKind, interestsFor, linkedSelection, restrictToBuild, sha256, unitBase, type SetRecords, type Unit } from "./phase10-lib.ts";

export const APP_DIR = process.env.HELIX_APP_DIR ?? join(REPO_ROOT, "..", "helix-app");
export const APP_FILES = [
  "packages/ai-director/src/director.ts",
  "packages/ai-director/src/claim-screen.ts",
  "packages/ai-director/src/providers.ts",
  "packages/ai-director/src/next-questions.ts",
  "packages/ai-director/src/index.ts",
  "packages/scene-engine/src/bridge.ts",
  "packages/scene-engine/src/resolver.ts",
  "packages/scene-engine/src/sequence.ts",
  "packages/ai-actions/src/registry.ts",
  "apps/web/src/build-worlds.ts",
  "apps/web/src/controller.ts",
] as const;

export const appAvailable = (): boolean => APP_FILES.every((f) => existsSync(join(APP_DIR, f)));

/** The helix-app commit and the sha256 of each imported (or re-stated) file, for the manifest. */
export function appProvenance(): { repo: "helix-app"; commit: string; filesClean: boolean; files: { path: string; sha256: string }[] } {
  const commit = execFileSync("git", ["-C", APP_DIR, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const status = execFileSync("git", ["-C", APP_DIR, "status", "--porcelain", "--", ...APP_FILES], { encoding: "utf8" }).trim();
  return { repo: "helix-app", commit, filesClean: status === "", files: APP_FILES.map((path) => ({ path, sha256: sha256(readFileSync(join(APP_DIR, path))) })) };
}

// ---- the shapes used from the app ----------------------------------------------------------------

export interface ClaimHitLike {
  check: string;
  field: string;
  text: string;
  detail: string;
}
export interface SplitRouteLike {
  branch: string;
  rule: string;
  callModel: boolean;
  accept: string | null;
}
export interface DirectorSessionLike {
  selection?: { structureId: string; chainId: string; residueNumber: number; compId: string } | null;
  loadedStructureId?: string | null;
  retrieved?: { source: string; text: string }[];
  sequenceSelection?: { transcriptId: string; codon: number } | null;
  answer?: "first" | "follow-up";
  world?: World;
  selectionFacts?: SelectionFacts | null;
  personalisation?: { depth: string; interests: string[] };
}
export interface DirectorResultLike {
  plan: Plan;
  source: string;
  usedFallback: boolean;
  fallbackReason: string | null;
  context: PlanningContext;
  claimScreen: ClaimHitLike[];
  route: SplitRouteLike | null;
  followUpScreen: { kept?: unknown[]; dropped?: unknown[]; [k: string]: unknown };
  providerValidation: { ok: boolean } | null;
}
interface DirectorLike {
  handle(query: string, session?: DirectorSessionLike, opts?: { temperature?: number }): Promise<DirectorResultLike>;
}
interface CodonLinkLike {
  codon: number;
  bases: string;
  aminoAcid: string;
  protein: { accession: string; position: number; residue: string } | null;
  structure: { status: "mapped"; structureId: string; focus: { authAsymId: string; authSeqId: number; compId: string } } | { status: "none"; reason: string };
}
interface BridgeLike {
  codon(k: number): CodonLinkLike;
  fromStructureResidue(r: { structureId: string; authAsymId: string; authSeqId: number; compId: string }): { status: "mapped"; uniprotPosition: number; codon: CodonLinkLike } | { status: "none"; reason: string };
}
export interface App {
  Director: new (registry: ProviderRegistry, base: PlanningContext, opts: { policy: "model-first" | "split"; claimFacts: unknown }) => DirectorLike;
  claimFactsFromRecords(records: { mapping?: unknown }): unknown;
  restrictToBuild(ctx: PlanningContext, build: { worlds: World[]; actions: readonly string[]; reason: string }): PlanningContext;
  retrievedEchoes(plan: Plan, ctx: PlanningContext, query: string): number[];
  splitRoute(rb: { rule: string; plan: Pick<Plan, "outcome"> }, ctx: Pick<PlanningContext, "retrieved" | "answer">): SplitRouteLike;
  screenClaims(plan: Plan, ctx: PlanningContext, facts: unknown): ClaimHitLike[];
  SelectionBridge: new (opts: { model: unknown; protein: unknown; mappings: unknown[]; tables?: unknown[]; variant: unknown | null; resolver: unknown; context: PlanningContext }) => BridgeLike;
  TranscriptModel: new (transcript: unknown, sequenceSet: unknown) => { transcriptId: string };
  TargetResolver: new (ctx: PlanningContext, records: { structure: unknown; mappings: unknown[]; contacts: unknown[]; tables?: unknown[] }) => unknown;
  /** helix-app packages/ai-actions registry v3 and apps/web build-worlds.ts. */
  REGISTERED_ACTION_TYPES: readonly string[];
  BUILD_WORLDS: readonly World[];
}

export async function loadApp(): Promise<App> {
  const imp = (rel: string): Promise<Record<string, unknown>> => import(join(APP_DIR, rel));
  const director = await imp("packages/ai-director/src/index.ts");
  const bridge = await imp("packages/scene-engine/src/bridge.ts");
  const sequence = await imp("packages/scene-engine/src/sequence.ts");
  const resolver = await imp("packages/scene-engine/src/resolver.ts");
  const registry = await imp("packages/ai-actions/src/registry.ts");
  const worlds = await imp("apps/web/src/build-worlds.ts");
  return { ...director, SelectionBridge: bridge.SelectionBridge, TranscriptModel: sequence.TranscriptModel, TargetResolver: resolver.TargetResolver, REGISTERED_ACTION_TYPES: registry.REGISTERED_ACTION_TYPES, BUILD_WORLDS: worlds.BUILD_WORLDS } as unknown as App;
}

// ---- the selection, as the app's bridge links it -------------------------------------------------

export interface AppSet {
  set: SetRecords;
  bridge: BridgeLike;
  transcriptId: string;
  claimFacts: unknown;
}

/** The app controller's records for a set: bridge (resolver, transcript model) and the claim screen's facts (helix-app controller.ts). */
export function appSet(app: App, set: SetRecords): AppSet {
  const b = set.bundle;
  const mappings = b.mapping ? [b.mapping] : [];
  const tables = set.table ? [set.table] : [];
  const resolver = new app.TargetResolver(set.base, { structure: b.structure ?? null, mappings, contacts: b.contacts ? [b.contacts] : [], tables });
  const model = new app.TranscriptModel(b.transcript, set.sequenceSet);
  const bridge = new app.SelectionBridge({ model, protein: b.protein, mappings, tables, variant: b.variant ?? null, resolver, context: set.base });
  return { set, bridge, transcriptId: model.transcriptId, claimFacts: app.claimFactsFromRecords({ mapping: b.mapping }) };
}

export interface AppSelection {
  selectedPosition: { structureId: string; chainId: string; residueNumber: number; compId: string } | null;
  sequenceSelection: { transcriptId: string; codon: number } | null;
  facts: SelectionFacts | null;
  /** Whether the research re-statement (phase10-lib linkedSelection) links the same residue and codon. */
  restatedAgrees: boolean;
}

/**
 * The shared state after the item's selection, as helix-app controller.ts builds it: a codon selected in DNA
 * World (selectCodon: the bridge's codon link, the selected position being the structure link's focus residue)
 * or a residue picked in the viewer (pickResidue, then bridgeFromStructure: the codon of the residue's protein
 * position); then selectionFacts() over the bridge's codon link.
 */
export function appSelection(a: AppSet, base: PlanningContext, u: Unit): AppSelection {
  const sel = u.selection;
  let pos: AppSelection["selectedPosition"] = null;
  let k: number | null = null;
  let linkReason: string | null = null;
  if (sel?.residue) {
    pos = { structureId: sel.residue.structureId, chainId: sel.residue.chainId, residueNumber: sel.residue.residueNumber, compId: sel.residue.compId };
    const r = a.bridge.fromStructureResidue({ structureId: pos.structureId, authAsymId: pos.chainId, authSeqId: pos.residueNumber, compId: pos.compId });
    if (r.status === "mapped") k = r.codon.codon;
    else linkReason = r.reason;
  } else if (sel?.codon) {
    k = sel.codon.number;
    const link = a.bridge.codon(k);
    const st = link.structure;
    pos = st.status === "mapped" ? { structureId: st.structureId, chainId: st.focus.authAsymId, residueNumber: st.focus.authSeqId, compId: st.focus.compId } : null;
    linkReason = st.status === "none" ? st.reason : null;
  }
  const link = k !== null ? a.bridge.codon(k) : null;
  const codon = link && k !== null ? { transcriptId: a.transcriptId, codon: k, bases: link.bases, aminoAcid: link.aminoAcid, protein: link.protein ? { accession: link.protein.accession, position: link.protein.position, residue: link.protein.residue } : null } : null;
  const reason = linkReason ?? (link && link.structure.status === "none" ? link.structure.reason : null);
  const facts = selectionFacts(base, { codon, residue: pos, unmappedReason: reason });
  const re = linkedSelection(a.set, sel);
  const restatedAgrees = JSON.stringify(re.residue) === JSON.stringify(pos) && (re.codon?.codon ?? null) === k;
  return { selectedPosition: pos, sequenceSelection: k !== null ? { transcriptId: a.transcriptId, codon: k } : null, facts, restatedAgrees };
}

/**
 * The session the app's controller passes the Director for this unit (helix-app controller.ts questionSession):
 * the structure on screen or null (never undefined, so the D-H024 answer 74 rule takes it at its word), the
 * linked selection, the answer kind, the world on screen, the selection facts, depth and interests, and the
 * retrieved text when there is some.
 */
export function directorInputs(a: AppSet, u: Unit): { base: PlanningContext; session: DirectorSessionLike; selection: AppSelection; pathwaysLoaded: boolean; associationsLoaded: boolean } {
  const { base, pathwaysLoaded, associationsLoaded } = unitBase(a.set, u);
  const selection = appSelection(a, base, u);
  const retrieved = u.retrieved.map((r) => ({ source: `${r.source} ${r.field}`, text: r.text }));
  const session: DirectorSessionLike = {
    selection: selection.selectedPosition,
    loadedStructureId: u.session.loadedStructureId ?? null,
    sequenceSelection: selection.sequenceSelection,
    answer: answerKind(u),
    world: u.session.currentWorld,
    selectionFacts: selection.facts,
    personalisation: { depth: "standard", interests: interestsFor(u) },
    ...(retrieved.length > 0 ? { retrieved } : {}),
  };
  return { base, session, selection, pathwaysLoaded, associationsLoaded };
}

// ---- registries ----------------------------------------------------------------------------------

/** The rule-based Director: no model (the app's registry with the deterministic provider active). */
export const deterministicRegistry = (): ProviderRegistry => new ProviderRegistry([new DeterministicProvider()]);

/** The hash of what a provider would send for a request: the chat messages, and the decoding schema. */
export const messagesHash = (query: string, ctx: PlanningContext): string => sha256(JSON.stringify(buildMessages(query, ctx)));
export const schemaHash = (query: string, ctx: PlanningContext): string => sha256(JSON.stringify(schemaFor({ query, context: ctx, requestId: "x" })));

export interface StoredOutput {
  raw: string;
  messagesSha256: string;
  schemaSha256: string;
  totalMs: number | null;
  firstTokenMs: number | null;
  error: { code: string; message: string } | null;
}

/**
 * A provider that answers with the stored model output of the current (unit, repeat), after checking that the
 * request the Director makes would send byte-identical messages (and the same decoding schema) to the ones the
 * live run sent. A mismatch or a missing output throws, so a replay never silently answers a different input.
 */
export class ReplayProvider implements PlanProvider {
  readonly id: string;
  readonly kind = "ollama" as const;
  readonly label: string;
  readonly local = true as const;
  current: StoredOutput | null = null;
  calls: { messagesMatch: boolean; schemaMatch: boolean }[] = [];
  constructor(id: string) {
    this.id = id;
    this.label = `replay of ${id}`;
  }
  async detect() {
    return { available: true, reason: "replay of stored outputs" };
  }
  async plan(req: PlanRequest): Promise<ProviderOutput> {
    const o = this.current;
    if (!o) throw new Error("replay: no stored output for this request");
    const messagesMatch = messagesHash(req.query, req.context) === o.messagesSha256;
    const schemaMatch = schemaHash(req.query, req.context) === o.schemaSha256;
    this.calls.push({ messagesMatch, schemaMatch });
    if (!messagesMatch || !schemaMatch) throw new Error(`replay: the Director's request differs from the stored one (messages ${messagesMatch}, schema ${schemaMatch})`);
    if (o.error) throw new ProviderError(this.id, o.error.code as ProviderError["code"], o.error.message);
    return { raw: o.raw, timings: { firstTokenMs: o.firstTokenMs, totalMs: o.totalMs ?? 0 } };
  }
}

export async function replayRegistry(p: ReplayProvider): Promise<ProviderRegistry> {
  const reg = new ProviderRegistry([new DeterministicProvider(), p], [p.id]);
  await reg.detectAll();
  reg.setActive(p.id);
  return reg;
}

/** Whether the research re-statement of restrictToBuild (phase10-lib.ts) gives the same context as the app's function on this set. */
export function restrictToBuildAgrees(app: App, set: SetRecords): boolean {
  const reason = "no scene for this world in the Phase 6 build";
  const viaApp = app.restrictToBuild(set.explorer, { worlds: [...app.BUILD_WORLDS], actions: app.REGISTERED_ACTION_TYPES, reason });
  return JSON.stringify(viaApp) === JSON.stringify(restrictToBuild(set.explorer, { worlds: BUILD_WORLDS, actions: REGISTERED_ACTION_TYPES, reason }));
}
