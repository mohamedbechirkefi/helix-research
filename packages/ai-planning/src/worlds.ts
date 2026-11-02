// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Which world each plan action brings on screen (author decision D-H007, 2026-11-02: the model's
 * first answer stays in one world).
 *
 * The mapping follows how the Phase 6 app executes the actions (helix-app apps/web/src/stage.ts):
 * loadStructure, focusCamera and highlightResidue first bring Protein World on screen;
 * highlightSequenceRegion first brings DNA World on screen; enterWorld goes to the world it names.
 * The other actions show nothing world-specific: resolving identifiers, an evidence card, the
 * reference/variant comparison panel (compareVariants is a page panel that the stage shows in any
 * world), cancelling, and showProteinDomains (not executable in any build yet).
 */
import type { World } from "./context.ts";
import type { Action, ActionType, Plan } from "./schema.ts";

export const ACTION_WORLD: Readonly<Partial<Record<ActionType, World>>> = {
  loadStructure: "protein",
  focusCamera: "protein",
  highlightResidue: "protein",
  highlightSequenceRegion: "dna",
};

/** The world an action brings on screen, or null if it shows nothing world-specific. */
export function actionWorld(a: Action): World | null {
  if (a.type === "enterWorld") return a.world;
  return ACTION_WORLD[a.type] ?? null;
}

/**
 * The worlds a plan brings on screen, in order of first appearance. A plan that stays in one world
 * gives at most one entry, whatever world the user is in when it starts.
 */
export function planWorlds(plan: Pick<Plan, "actions">): World[] {
  const seen: World[] = [];
  for (const a of plan.actions) {
    const w = actionWorld(a);
    if (w !== null && !seen.includes(w)) seen.push(w);
  }
  return seen;
}
