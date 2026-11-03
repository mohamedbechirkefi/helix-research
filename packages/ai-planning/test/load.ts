// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildHbbContext, parseBenchmarkJsonl, type BenchmarkItem, type HbbBundle, type PlanningContext } from "../src/index.ts";

export const REPO_ROOT = resolve(import.meta.dirname, "..", "..", "..");

export function hbbContext(): PlanningContext {
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

export function questions(file = "questions.jsonl"): BenchmarkItem[] {
  return parseBenchmarkJsonl(readFileSync(join(REPO_ROOT, "research", "benchmark", file), "utf8"));
}

/** The FAAH2 set (Phase 9, P9.2.4): the structure-limited gene, with no variant, structure, mapping or contacts record. */
export function faah2Bundle(): HbbBundle {
  const dir = join(REPO_ROOT, "data", "curated", "faah2");
  const j = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf8")) as unknown;
  return { gene: j("gene.json"), transcript: j("transcript.json"), protein: j("protein-Q6GMR7.json"), variant: null, structure: null, mapping: null, contacts: null, predicted: j("predicted-model-AF-Q6GMR7-F1.json"), capabilities: j("capabilities.json") };
}

export function faah2Context(): PlanningContext {
  return buildHbbContext(faah2Bundle());
}

/** The CFTR set (Phase 9, P9.2.1): the first set whose reference variant is an in-frame deletion (F508del on 5UAK). */
export function cftrBundle(): HbbBundle {
  const dir = join(REPO_ROOT, "data", "curated", "cftr");
  const j = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf8")) as unknown;
  return { gene: j("gene.json"), transcript: j("transcript.json"), protein: j("protein-P13569.json"), variant: j("variant-f508del.json"), structure: j("structure-5UAK.json"), mapping: j("residue-mapping-f508del-5UAK.json"), contacts: j("contacts-f508del-5UAK.json"), predicted: j("predicted-model-AF-P13569-F1.json"), capabilities: j("capabilities.json") };
}

export function cftrContext(): PlanningContext {
  return buildHbbContext(cftrBundle());
}

/** The set's curated questions record (questions.json). */
export function questionsRecord(dataset: string): { questions: { text: string; requires: string[] }[]; bridgeQuestion: string | null } {
  return JSON.parse(readFileSync(join(REPO_ROOT, "data", "curated", dataset, "questions.json"), "utf8")) as { questions: { text: string; requires: string[] }[]; bridgeQuestion: string | null };
}

/** The set's pathway-memberships record (pathways.json, Phase 9 P9.1.2). */
export function pathwaysRecord(dataset: string): unknown {
  return JSON.parse(readFileSync(join(REPO_ROOT, "data", "curated", dataset, "pathways.json"), "utf8")) as unknown;
}

/** The set's capability report (capabilities.json). */
export function capabilitiesRecord(dataset: string): unknown {
  return JSON.parse(readFileSync(join(REPO_ROOT, "data", "curated", dataset, "capabilities.json"), "utf8")) as unknown;
}

/** The HBB bundle with its capability report and pathway-memberships record (the app's bundle once the record is loaded). */
export function hbbBundleWithPathways(): HbbBundle {
  const dir = join(REPO_ROOT, "data", "curated", "hbb");
  const j = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf8")) as unknown;
  return {
    gene: j("gene.json"),
    transcript: j("transcript.json"),
    protein: j("protein-P68871.json"),
    variant: j("variant-hbs.json"),
    structure: j("structure-2HBS.json"),
    mapping: j("residue-mapping-hbs-2HBS.json"),
    contacts: j("contacts-hbs-2HBS.json"),
    predicted: j("predicted-model-AF-P68871-F1.json"),
    capabilities: j("capabilities.json"),
    pathways: j("pathways.json"),
  };
}

/** The BRCA1 set (Phase 9, P9.2.2): a substitution inside an observed domain (C61G on 1JM7, solution NMR, with BARD1), coverage 5.5 %. */
export function brca1Bundle(): HbbBundle {
  const dir = join(REPO_ROOT, "data", "curated", "brca1");
  const j = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf8")) as unknown;
  return { gene: j("gene.json"), transcript: j("transcript.json"), protein: j("protein-P38398.json"), variant: j("variant-c61g.json"), structure: j("structure-1JM7.json"), mapping: j("residue-mapping-c61g-1JM7.json"), contacts: j("contacts-c61g-1JM7.json"), predicted: j("predicted-model-AF-P38398-F1.json"), capabilities: j("capabilities.json") };
}

export function brca1Context(): PlanningContext {
  return buildHbbContext(brca1Bundle());
}
