// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Re-scoring of the frozen Phase 10 run (author decision D-H029 answer 87, "fix it and rescore"; Phase 11 carried
 * item C5). The Phase 10 harness (phase10-lib.ts unitContext) re-states two app functions that differ from the app:
 * - the selection bridge: for a codon whose mapping of record has a feature, the app selects the resolver's focus
 *   residue, the re-statement the first mapped residue (HBB codon 7: 2HBS chain H residue 6 against chain B); the app
 *   also passes the bridge's reason when a codon has no structure residue, the re-statement passes none;
 * - the session topics: the re-statement (topicsOfActions) adds "evidence" for any revealEvidence, the app's
 *   topicsOfPlan (apps/web/src/session-profile.ts) only for intent explain_evidence.
 * This module builds each Phase 10 unit with the app's own bridge (phase10-heldout-lib.ts appSelection over the
 * imported SelectionBridge) and the app's own topicsOfPlan, imported at run time from the sibling helix-app checkout.
 * Everything else is the Phase 10 unit context unchanged: prompt v7, the records the session has loaded, the answer
 * kind, the depth, and the loaded-structure rule the app had at the time of the run ("phase10-fallback": the app's
 * contextFor before D-H024 answer 74; that was app behaviour then, not a re-statement, and is kept).
 *
 * phase10-lib.ts is not changed: its unitContext still builds the original contexts, so the frozen run (and every
 * stored messagesSha256 of it) stays reproducible.
 *
 * The oracle of an earlier turn states actions, not an intent. The corrected interests pass those actions to the
 * app's topicsOfPlan with no intent (so never explain_evidence); a single row's "evidence shown" trace adds nothing,
 * because the intent of the answer that left it is not stated (no Phase 10 single row carries that trace).
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { selectionFeature, withSelectionFacts, withSession, type Plan, type PlanningContext } from "@helix/ai-planning";
import { answerKind, loadedStructureFor, sha256, unitBase, type Unit, type UnitContext } from "./phase10-lib.ts";
import { APP_DIR, APP_FILES, appSelection, loadApp, type App, type AppSelection, type AppSet } from "./phase10-heldout-lib.ts";

/** The helix-app files the re-scoring imports: the held-out run's list and the session profile (topicsOfPlan). */
export const RESCORE_APP_FILES = [...APP_FILES, "apps/web/src/session-profile.ts"] as const;

export type TopicsOfPlan = (plan: Pick<Plan, "outcome" | "intent" | "actions"> | null) => string[];
export interface RescoreApp extends App {
  /** helix-app apps/web/src/session-profile.ts topicsOfPlan. */
  topicsOfPlan: TopicsOfPlan;
}

export async function loadRescoreApp(): Promise<RescoreApp> {
  const app = await loadApp();
  const profile = (await import(join(APP_DIR, "apps/web/src/session-profile.ts"))) as { topicsOfPlan: TopicsOfPlan };
  return { ...app, topicsOfPlan: profile.topicsOfPlan };
}

/** The helix-app commit, whether the imported files are clean, and the sha256 of each, for the manifest. */
export function rescoreProvenance(): { repo: "helix-app"; commit: string; filesClean: boolean; files: { path: string; sha256: string }[] } {
  const commit = execFileSync("git", ["-C", APP_DIR, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const status = execFileSync("git", ["-C", APP_DIR, "status", "--porcelain", "--", ...RESCORE_APP_FILES], { encoding: "utf8" }).trim();
  return { repo: "helix-app", commit, filesClean: status === "", files: RESCORE_APP_FILES.map((path) => ({ path, sha256: sha256(readFileSync(join(APP_DIR, path))) })) };
}

const TOPIC_ORDER = ["structure", "sequence", "domains", "pathways", "evidence"] as const;
const WORLD_TOPIC: Partial<Record<string, (typeof TOPIC_ORDER)[number]>> = { protein: "structure", pathway: "pathways", evidence: "evidence" };

/**
 * The session's interests as the app infers them (helix-app session-profile.ts inferInterests): the worlds the
 * session shows it visited, and the topics of the earlier answers read by the app's topicsOfPlan. A single row's
 * traces stand for the answer that left them, as in phase10-lib.ts interestsFor, except "evidence shown" (see header).
 */
export function appInterests(u: Unit, topicsOfPlan: TopicsOfPlan): string[] {
  const topics = new Set<string>();
  for (const s of [...u.earlierStates, u.session]) {
    const t = WORLD_TOPIC[s.currentWorld];
    if (t) topics.add(t);
    if (s.pathwayOpen) topics.add("pathways");
  }
  for (const e of u.earlierExpected) {
    const plan = { outcome: e.planOutcome, intent: null, actions: e.actions.map((step) => step[0]!) } as unknown as Plan;
    for (const t of topicsOfPlan(plan)) topics.add(t);
  }
  if (u.turn === null) {
    const s = u.session;
    if (s.highlighted) topics.add("structure");
    if (s.sequenceHighlight) topics.add("sequence");
    if (s.domainsShown) topics.add("domains");
  }
  return TOPIC_ORDER.filter((t) => topics.has(t));
}

export interface RescoreUnitContext extends UnitContext {
  selection: AppSelection;
}

/** The Phase 10 unit's planning context with the app's bridge and topics (see the header). */
export function appUnitContext(a: AppSet, u: Unit, topicsOfPlan: TopicsOfPlan): RescoreUnitContext {
  const { base, pathwaysLoaded, associationsLoaded } = unitBase(a.set, u);
  const s = appSelection(a, base, u);
  const answer = answerKind(u);
  const r = s.selectedPosition;
  // helix-app Director.contextFor as the Phase 10 run had it (the "phase10-fallback" loaded-structure rule).
  const sel = r ? { ...r, numbering: "auth" as const, featureId: selectionFeature(base, r.structureId, r.chainId, r.residueNumber) } : null;
  const ctx0 = withSession(base, {
    selection: sel,
    loadedStructureId: loadedStructureFor(u.session, sel, "phase10-fallback"),
    retrieved: u.retrieved.map((x) => ({ source: `${x.source} ${x.field}`, text: x.text })),
    sequenceSelection: s.sequenceSelection,
    answer,
    currentWorld: u.session.currentWorld,
  });
  const ctx1 = withSelectionFacts(ctx0, s.facts, u.query);
  const interests = appInterests(u, topicsOfPlan);
  const ctx: PlanningContext = { ...ctx1, personalisation: { depth: "standard", interests } };
  return { ctx, selection: s, notes: { answer, pathwaysLoaded, associationsLoaded, selection: r, codon: s.sequenceSelection?.codon ?? null, binding: ctx.selectionFacts?.binding?.subject ?? null, interests } };
}
