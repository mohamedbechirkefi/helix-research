// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/** Node-only helpers for the AI benchmark: load the curated context and the question set. */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { buildHbbContext, parseBenchmarkJsonl, type BenchmarkItem, type PlanningContext } from "@helix/ai-planning";

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
