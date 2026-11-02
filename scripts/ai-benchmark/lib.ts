// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/** Node-only helpers for the AI benchmark: load the curated context and the question set. */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { buildHbbContext, contextForItem, parseBenchmarkJsonl, withSession, type BenchmarkItem, type PlanningContext } from "@helix/ai-planning";

export const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
export const QUESTIONS = join(REPO_ROOT, "research", "benchmark", "questions.jsonl");
export const RUNS_DIR = join(REPO_ROOT, "research", "benchmark", "runs");

export function loadHbbContext(): PlanningContext {
  const dir = join(REPO_ROOT, "data", "curated", "hbb");
  const j = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf8")) as unknown;
  return buildHbbContext({
    gene: j("gene.json"),
    transcript: j("transcript.json"),
    protein: j("protein-P68871.json"),
    variant: j("variant-hbs.json"),
    structure: j("structure-2HBS.json"),
    mapping: j("residue-mapping-hbs-2HBS.json"),
    contacts: j("contacts-hbs-2HBS.json"),
    predicted: j("predicted-model-AF-P68871-F1.json"),
  });
}

/**
 * The benchmark contexts.
 * - phase3: the Phase 3 context (all worlds of the curated context, Phase 3 actions; prompt v1).
 * - app-v2: the context as the Phase 6 app restricts it (DNA and Protein World, compareVariants and
 *   highlightSequenceRegion executable), no answer kind (prompt v2, no world check).
 * - app-v3 (D-H007): app-v2 plus the answer kind and the world on screen (prompt v3, one-world check).
 * - app-v4 (D-H008): app-v3 plus routing by cue words (prompt v4, cue routing, world-cue check).
 * In the app modes, an item's own `session` sets the answer kind, the world on screen and the loaded
 * structure; without it, an item with a selection is a follow-up in Protein World, any other a first
 * answer in DNA World (the app's start world).
 */
export type ContextMode = "phase3" | "app-v2" | "app-v3" | "app-v4";
export function benchmarkContext(base: PlanningContext, item: BenchmarkItem, mode: ContextMode): PlanningContext {
  const c = contextForItem(base, item);
  if (mode === "phase3") return c;
  const app: PlanningContext = {
    ...c,
    worlds: c.worlds.map((w) => (w.id === "dna" || w.id === "protein" ? w : { ...w, available: false, reason: w.available ? "no scene for this world in the Phase 6 build" : w.reason })),
    executableActions: [...c.executableActions, "compareVariants", "highlightSequenceRegion"],
  };
  if (mode === "app-v2") return app;
  const routed = mode === "app-v4" ? { ...app, routeByCues: true } : app;
  const s = item.session;
  if (s) return withSession(routed, { answer: s.answer, currentWorld: s.currentWorld, ...(s.loadedStructureId !== undefined ? { loadedStructureId: s.loadedStructureId } : {}) });
  return withSession(routed, item.selection ? { answer: "follow-up", currentWorld: "protein" } : { answer: "first", currentWorld: "dna" });
}

export function loadQuestions(path = QUESTIONS): BenchmarkItem[] {
  return parseBenchmarkJsonl(readFileSync(path, "utf8"));
}

export function gitCommit(): string {
  try {
    const sha = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: REPO_ROOT, encoding: "utf8" }).trim();
    const dirty = execFileSync("git", ["status", "--porcelain"], { cwd: REPO_ROOT, encoding: "utf8" }).trim().length > 0;
    return `${sha}${dirty ? "-dirty" : ""}`;
  } catch {
    return "unknown";
  }
}

/** Resident memory (KiB) of the model runner processes Ollama spawns, summed. macOS `ps`. */
export function runnerRssKiB(): { rssKiB: number; procs: number } {
  const out = execFileSync("ps", ["-axo", "rss=,command="], { encoding: "utf8" });
  let rssKiB = 0;
  let procs = 0;
  for (const line of out.split("\n")) {
    const m = line.trim().match(/^(\d+)\s+(.*)$/);
    if (!m) continue;
    const cmd = m[2]!;
    if (/ollama(\s|$).*\brunner\b|llama-server|ollama_llama_server/.test(cmd)) {
      rssKiB += Number(m[1]);
      procs += 1;
    }
  }
  return { rssKiB, procs };
}
