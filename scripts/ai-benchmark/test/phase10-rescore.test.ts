// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * The Phase 10 re-scoring harness (phase10-rescore-lib.ts, D-H029 answer 87) against the helix-app code it imports and
 * against the frozen Phase 10 run. The app checkout is a sibling of this repository (HELIX_APP_DIR overrides); without
 * it the app comparisons are skipped.
 * - the original harness (phase10-lib.ts unitContext) still reproduces every stored messagesSha256 of the frozen run;
 * - the corrected context differs from the original on exactly the two units pinned by name (the session topics);
 * - the corrected context equals the app Director's own context, given the Phase 10 loaded-structure value;
 * - the app's topicsOfPlan and the research re-statement disagree on revealEvidence without intent explain_evidence;
 * - the Phase 10 validator basis of the scorer differs from the current validator only by "pathway-not-openable".
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildMessages, type Plan } from "@helix/ai-planning";
import { RUNS_DIR } from "../lib.ts";
import { DATASETS, interestsFor, loadSet, loadUnits, loadedStructureFor, sha256, unitBase, unitContext } from "../phase10-lib.ts";
import { appAvailable, appSet, deterministicRegistry, messagesHash } from "../phase10-heldout-lib.ts";
import { appInterests, appUnitContext, loadRescoreApp } from "../phase10-rescore-lib.ts";
import { validateUnder } from "../phase10-score.ts";

const ORIGINAL = join(RUNS_DIR, "phase10-2026-11-04");
const storedRows = (file: string): { unit: string; rep: number; raw: string; messagesSha256: string }[] =>
  readFileSync(join(ORIGINAL, file), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { unit: string; rep: number; raw: string; messagesSha256: string });

describe("the original Phase 10 harness stays reproducible", () => {
  it.skipIf(!existsSync(ORIGINAL))("phase10-lib unitContext gives the stored messagesSha256 of every stored model row", () => {
    const sets = new Map(DATASETS.map((d) => [d, loadSet(d)]));
    const hashes = new Map(loadUnits().map((u) => [u.id, messagesHash(u.query, unitContext(sets.get(u.dataset)!, u).ctx)]));
    const rows = storedRows("ministral-3-8b.jsonl");
    expect(rows).toHaveLength(336);
    for (const r of rows) expect(r.messagesSha256, r.unit).toBe(hashes.get(r.unit));
  });
});

describe("validator basis", () => {
  it.skipIf(!existsSync(ORIGINAL))("phase10 drops only pathway-not-openable: P10-CFTR-13's stored rule plan is valid there and invalid now", () => {
    const set = loadSet("cftr");
    const u = loadUnits().find((x) => x.id === "P10-CFTR-13")!;
    const ctx = unitContext(set, u).ctx;
    const raw = storedRows("deterministic.jsonl").find((r) => r.unit === u.id && r.rep === 0)!.raw;
    const now = validateUnder(raw, ctx, u.query, "current");
    expect(now.ok).toBe(false);
    expect(now.issues.map((i) => i.code)).toEqual(["pathway-not-openable"]);
    const then = validateUnder(raw, ctx, u.query, "phase10");
    expect(then.ok).toBe(true);
    expect(then.issues).toEqual([]);
  });
});

describe.skipIf(!appAvailable())("re-scoring harness against the helix-app code", async () => {
  const app = appAvailable() ? await loadRescoreApp() : null;
  const units = loadUnits();

  it("topicsOfPlan: revealEvidence adds evidence only with intent explain_evidence (the re-statement adds it always)", () => {
    const reveal = [{ type: "revealEvidence", evidenceId: "opentargets:ENSG00000165591" }];
    expect(app!.topicsOfPlan({ outcome: "plan", intent: "other", actions: reveal } as unknown as Plan)).toEqual([]);
    expect(app!.topicsOfPlan({ outcome: "plan", intent: "explain_evidence", actions: reveal } as unknown as Plan)).toEqual(["evidence"]);
    const u = units.find((x) => x.id === "P10-FU-FAAH2/2")!;
    expect(interestsFor(u)).toEqual(["evidence"]);
    expect(appInterests(u, app!.topicsOfPlan)).toEqual([]);
  });

  it("the corrected context differs from the original on P10-FU-FAAH2/2 and /3 only (byte comparison of the messages)", () => {
    const sets = new Map(DATASETS.map((d) => [d, appSet(app!, loadSet(d))]));
    const changed: string[] = [];
    for (const u of units) {
      const a = sets.get(u.dataset)!;
      const before = JSON.stringify(buildMessages(u.query, unitContext(a.set, u).ctx));
      const after = JSON.stringify(buildMessages(u.query, appUnitContext(a, u, app!.topicsOfPlan).ctx));
      if (before !== after) changed.push(u.id);
    }
    expect(changed).toEqual(["P10-FU-FAAH2/2", "P10-FU-FAAH2/3"]);
  });

  it("the app's bridge and the re-stated bridge link the same residue and codon on every Phase 10 unit (no unit selects HBB codon 7)", () => {
    const sets = new Map(DATASETS.map((d) => [d, appSet(app!, loadSet(d))]));
    for (const u of units) expect(appUnitContext(sets.get(u.dataset)!, u, app!.topicsOfPlan).selection.restatedAgrees, u.id).toBe(true);
    expect(units.some((u) => u.dataset === "hbb" && u.selection?.codon?.number === 7)).toBe(false);
  });

  it("the corrected context equals the app Director's context on every unit, given the Phase 10 loaded-structure value", async () => {
    const sets = new Map(DATASETS.map((d) => [d, appSet(app!, loadSet(d))]));
    const differs: string[] = [];
    for (const u of units) {
      const a = sets.get(u.dataset)!;
      const c = appUnitContext(a, u, app!.topicsOfPlan);
      const sel = c.selection.selectedPosition;
      const session = {
        selection: sel,
        loadedStructureId: loadedStructureFor(u.session, sel, "phase10-fallback"),
        sequenceSelection: c.selection.sequenceSelection,
        answer: c.notes.answer,
        world: u.session.currentWorld,
        selectionFacts: c.selection.facts,
        personalisation: { depth: "standard", interests: c.notes.interests },
        ...(u.retrieved.length > 0 ? { retrieved: u.retrieved.map((r) => ({ source: `${r.source} ${r.field}`, text: r.text })) } : {}),
      };
      const res = await new app!.Director(deterministicRegistry(), unitBase(a.set, u).base, { policy: "model-first", claimFacts: a.claimFacts }).handle(u.query, session, { temperature: 0 });
      if (sha256(JSON.stringify(buildMessages(u.query, res.context))) !== sha256(JSON.stringify(buildMessages(u.query, c.ctx)))) differs.push(u.id);
    }
    expect(differs).toEqual([]);
  });
});
