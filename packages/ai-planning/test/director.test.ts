// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
import { describe, expect, it } from "vitest";
import {
  DeterministicProvider,
  JourneyDirector,
  ProviderError,
  ProviderRegistry,
  contextForItem,
  deterministicPlan,
  geneLikeTokens,
  scoreItem,
  type PlanProvider,
  type PlanRequest,
  type ProviderOutput,
} from "../src/index.ts";
import { hbbContext, questions } from "./load.ts";

const ctx = hbbContext();
const items = questions();

class ScriptedProvider implements PlanProvider {
  readonly id = "scripted";
  readonly kind = "mock" as const;
  readonly label = "scripted";
  readonly local = true as const;
  calls = 0;
  respond: (req: PlanRequest) => Promise<ProviderOutput>;
  constructor(respond: (req: PlanRequest) => Promise<ProviderOutput>) {
    this.respond = respond;
  }
  async detect() {
    return { available: true, reason: "ok" };
  }
  async plan(req: PlanRequest) {
    this.calls++;
    return this.respond(req);
  }
}

const out = (raw: string): ProviderOutput => ({ raw, timings: { firstTokenMs: 1, totalMs: 2 } });

async function directorWith(p: PlanProvider) {
  const reg = new ProviderRegistry([new DeterministicProvider(), p], [p.id]);
  await reg.selectBest();
  return { d: new JourneyDirector(reg, ctx), reg };
}

describe("JourneyDirector (P3.3.2, reference implementation)", () => {
  it("returns a valid provider plan unchanged", async () => {
    const p = new ScriptedProvider(async (req) => out(JSON.stringify(deterministicPlan(req.query, req.context).plan)));
    const { d } = await directorWith(p);
    const r = await d.handle("Show me where the sickle-cell mutation affects hemoglobin.");
    expect(r.source).toBe("scripted");
    expect(r.usedFallback).toBe(false);
    expect(r.validation.ok).toBe(true);
    expect(r.plan.actions.map((a) => a.type)).toContain("highlightResidue");
  });
  it("rejects the 1BZO plan and falls back to the deterministic plan", async () => {
    const p = new ScriptedProvider(async (req) => {
      const { plan } = deterministicPlan(req.query, req.context);
      return out(JSON.stringify({ ...plan, actions: [{ type: "loadStructure", structureId: "1BZO", assembly: "1" }] }));
    });
    const { d } = await directorWith(p);
    const r = await d.handle("Show me where the sickle-cell mutation affects hemoglobin.");
    expect(r.usedFallback).toBe(true);
    expect(r.fallbackReason).toContain("1BZO");
    expect(r.source).toBe("deterministic");
    expect(r.rejectedRaw).toContain("1BZO");
    expect(JSON.stringify(r.plan)).not.toContain("1BZO");
    expect(r.validation.ok).toBe(true);
  });
  it("falls back on malformed output and on provider errors, and marks an unreachable provider", async () => {
    const bad = new ScriptedProvider(async () => out("{\"outcome\":"));
    expect((await (await directorWith(bad)).d.handle("Show me the HBB gene.")).fallbackReason).toContain("invalid-json");
    const down = new ScriptedProvider(async () => {
      throw new ProviderError("scripted", "unavailable", "connection refused");
    });
    const { d, reg } = await directorWith(down);
    const r = await d.handle("Show me the HBB gene.");
    expect(r.usedFallback).toBe(true);
    expect(reg.active.id).toBe("deterministic");
  });
  it("answers genes the trusted records cannot resolve without calling the model", async () => {
    const p = new ScriptedProvider(async () => out("{}"));
    const { d } = await directorWith(p);
    const r = await d.handle("Highlight TP53 R175H on its structure.");
    expect(p.calls).toBe(0);
    expect(r.plan.outcome).toBe("unsupported");
    expect(r.geneMentions.map((g) => [g.token, g.resolution.status])).toEqual([["TP53", "not-found"]]);
    const hbb = await d.handle("Show me the HBB gene.");
    expect(hbb.geneMentions[0]!.resolution).toMatchObject({ status: "resolved", symbol: "HBB", ensemblGeneId: "ENSG00000244734" });
  });
  it("flags a superseded request as stale and supports cancellation", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((res) => (release = res));
    const p = new ScriptedProvider(async (req) => {
      if (req.query.startsWith("slow")) {
        await gate;
        if (req.signal?.aborted) throw new ProviderError("scripted", "aborted", "cancelled");
      }
      return out(JSON.stringify(deterministicPlan("Show me the HBB gene.", req.context).plan));
    });
    const { d } = await directorWith(p);
    const first = d.handle("slow: show me the HBB gene");
    const second = await d.handle("Show me the HBB gene.");
    release();
    const r1 = await first;
    expect(second.stale).toBe(false);
    expect(r1.stale).toBe(true);
    expect(r1.fallbackReason).toBe("cancelled");
  });
  it("finds gene-like tokens but not residue changes or common acronyms", () => {
    expect(geneLikeTokens("Show HBB E6V in 2HBS and CFTR, PDB, DNA, BRCA1")).toEqual(["HBB", "CFTR", "BRCA1"]);
  });
  it("produces correct, valid plans on every benchmark item with the deterministic provider", async () => {
    const reg = new ProviderRegistry([new DeterministicProvider()]);
    await reg.selectBest();
    const d = new JourneyDirector(reg, ctx);
    const failures: string[] = [];
    for (const it of items) {
      const r = await d.handle(it.query, { selection: it.selection, retrieved: it.retrieved });
      const s = scoreItem(it, JSON.stringify(r.plan), contextForItem(ctx, it)).score;
      if (!s.correctAndValid) failures.push(it.id);
    }
    expect(failures).toEqual([]);
  });
  it("with a model that follows injected text, the director still returns only grounded plans", async () => {
    const injectable = new ScriptedProvider(async (req) => {
      const m = req.context.retrieved.map((r) => r.text.match(/\b[1-9][A-Z0-9]{3}\b/)?.[0]).find(Boolean);
      const { plan } = deterministicPlan(req.query, req.context);
      return out(JSON.stringify(m ? { ...plan, actions: [{ type: "loadStructure", structureId: m, assembly: "1" }, ...plan.actions] } : plan));
    });
    const { d } = await directorWith(injectable);
    for (const it of items.filter((i) => i.category === "injection")) {
      const r = await d.handle(it.query, { selection: it.selection, retrieved: it.retrieved });
      for (const f of it.expected.forbiddenIds ?? []) expect(JSON.stringify(r.plan)).not.toContain(f);
      expect(r.validation.ok).toBe(true);
    }
  });
});
