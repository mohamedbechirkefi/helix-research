// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Minimal Journey Director (P3.3.2), a reference implementation in helix-research. The product
 * director belongs in helix-app (packages/ai-director); this one exists to test the flow on
 * benchmark items:
 *
 *   query -> intent pre-analysis -> trusted resolution (scientific-core) -> context
 *   -> plan (active provider) -> validation -> (fallback) -> result
 *
 * Policy: no plan leaves the director unvalidated. A provider error, an invalid plan or an
 * ungrounded identifier yields the deterministic plan instead, and the result says so. Each
 * request has an id; a result whose id is not the latest is flagged stale and must be ignored.
 */
import { resolveGeneQuery, type GeneResolution } from "@helix/scientific-core";
import type { HgncRecord } from "@helix/data-adapters";
import { withSession, selectionFeature, type AnswerKind, type PlanningContext, type RetrievedSnippet, type World } from "./context.ts";
import { deterministicPlan } from "./fallback.ts";
import { validatePlan, type PlanValidation } from "./validate.ts";
import { screenPlanFollowUps, type FollowUpScreen } from "./followups.ts";
import type { Plan } from "./schema.ts";
import { ProviderError } from "./providers/types.ts";
import type { ProviderRegistry } from "./providers/registry.ts";

export interface SessionInput {
  selection?: { structureId: string; chainId: string; residueNumber: number; compId: string } | null;
  retrieved?: RetrievedSnippet[];
  /** First answer of the session or a follow-up (D-H007); a first answer must stay in one world. Omitted: no world check. */
  answer?: AnswerKind;
  /** The world on screen when the question was asked (D-H007). */
  currentWorld?: World;
}

export interface GeneMention {
  token: string;
  resolution: GeneResolution;
}

export interface DirectorResult {
  requestId: number;
  stale: boolean;
  plan: Plan;
  /** Which provider produced the returned plan. */
  source: string;
  usedFallback: boolean;
  fallbackReason: string | null;
  /** Validation of the provider's own output (null when the deterministic planner answered directly). */
  providerValidation: PlanValidation | null;
  /** Validation of the returned plan; always ok. */
  validation: PlanValidation;
  geneMentions: GeneMention[];
  rejectedRaw: string | null;
  /** The plan's follow-up suggestions as screened (D-H007); the returned plan keeps only the passed ones. */
  followUpScreen: FollowUpScreen;
  timings: { totalMs: number; providerMs: number | null };
}

/** HGNC-shaped records for the genes in the context, so resolution uses scientific-core. */
export function hgncRecordsFromContext(ctx: PlanningContext): HgncRecord[] {
  return ctx.genes.map((g) => ({
    hgncId: g.hgncId,
    symbol: g.symbol,
    name: g.name,
    status: "Approved",
    aliases: g.aliases,
    previousSymbols: [],
    ensemblGeneId: g.id,
    ncbiGeneId: null,
    uniprotIds: ctx.proteins.filter((p) => p.geneId === g.id).map((p) => p.id),
    maneSelect: [],
    location: null,
  }));
}

const STOP_TOKENS = new Set(["PDB", "DNA", "RNA", "HELIX", "AI", "UI", "JSON", "API", "AF", "OK", "CODE", "HBS", "HBC", "VAL", "GLU"]);

/** Gene-symbol-like tokens in the query (uppercase, 2 to 10 characters, not a residue change like E6V). */
export function geneLikeTokens(query: string): string[] {
  const toks = [...query.matchAll(/\b[A-Z][A-Z0-9-]{1,9}\b/g)].map((m) => m[0]);
  return [...new Set(toks)].filter((t) => !STOP_TOKENS.has(t) && !/^[A-Z]\d+[A-Z]$/.test(t) && !/^\d/.test(t) && (/\d/.test(t) || t.length >= 3));
}

export class JourneyDirector {
  private latest = 0;
  private inflight: AbortController | null = null;
  private readonly hgnc: HgncRecord[];
  private readonly registry: ProviderRegistry;
  private readonly baseContext: PlanningContext;

  constructor(registry: ProviderRegistry, baseContext: PlanningContext) {
    this.registry = registry;
    this.baseContext = baseContext;
    this.hgnc = hgncRecordsFromContext(baseContext);
  }

  /** Cancels the request in flight, if any. */
  cancel(): void {
    this.inflight?.abort();
    this.inflight = null;
  }

  isLatest(requestId: number): boolean {
    return requestId === this.latest;
  }

  async handle(query: string, session: SessionInput = {}, opts: { temperature?: number } = {}): Promise<DirectorResult> {
    const t0 = Date.now();
    const requestId = ++this.latest;
    this.inflight?.abort();
    const ctl = new AbortController();
    this.inflight = ctl;

    // Intent pre-analysis and trusted resolution of gene mentions.
    const geneMentions: GeneMention[] = geneLikeTokens(query).map((token) => ({ token, resolution: resolveGeneQuery(token, this.hgnc) }));
    const sel = session.selection
      ? { ...session.selection, numbering: "auth" as const, featureId: selectionFeature(this.baseContext, session.selection.structureId, session.selection.chainId, session.selection.residueNumber) }
      : null;
    const ctx = withSession(this.baseContext, {
      selection: sel,
      loadedStructureId: sel ? sel.structureId : null,
      retrieved: session.retrieved ?? [],
      ...(session.answer !== undefined ? { answer: session.answer } : {}),
      ...(session.currentWorld !== undefined ? { currentWorld: session.currentWorld } : {}),
    });

    const done = (r: Omit<DirectorResult, "requestId" | "stale" | "geneMentions" | "timings" | "followUpScreen"> & { providerMs: number | null }): DirectorResult => {
      if (this.inflight === ctl) this.inflight = null;
      const { providerMs, plan, ...rest } = r;
      // Every suggestion passes the same filter, whichever planner wrote it (D-H007).
      const screened = screenPlanFollowUps(plan, ctx);
      return { ...rest, plan: screened.plan, followUpScreen: screened.screen, requestId, stale: !this.isLatest(requestId), geneMentions, timings: { totalMs: Date.now() - t0, providerMs } };
    };
    const fallback = (reason: string | null, providerValidation: PlanValidation | null, rejectedRaw: string | null, providerMs: number | null) => {
      const { plan } = deterministicPlan(query, ctx);
      const validation = validatePlan(plan, ctx, { query });
      if (!validation.ok) throw new Error(`deterministic plan failed validation: ${validation.issues.map((i) => i.message).join("; ")}`);
      return done({ plan, source: this.registry.deterministic.id, usedFallback: reason !== null, fallbackReason: reason, providerValidation, validation, rejectedRaw, providerMs });
    };

    // A gene the trusted records cannot resolve is answered without a model.
    const unresolved = geneMentions.filter((g) => g.resolution.status === "not-found" && /\d/.test(g.token));
    const provider = this.registry.active;
    if (unresolved.length > 0 || provider.kind === "deterministic") {
      return fallback(null, null, null, null);
    }

    let raw: string;
    let providerMs: number;
    try {
      const out = await provider.plan({ query, context: ctx, requestId: String(requestId), temperature: opts.temperature ?? 0, signal: ctl.signal });
      raw = out.raw;
      providerMs = out.timings.totalMs;
    } catch (e) {
      const code = e instanceof ProviderError ? e.code : "unavailable";
      if (code === "aborted") {
        const { plan } = deterministicPlan("cancel", ctx);
        return done({ plan, source: provider.id, usedFallback: false, fallbackReason: "cancelled", providerValidation: null, validation: validatePlan(plan, ctx), rejectedRaw: null, providerMs: null });
      }
      if (code === "unavailable") this.registry.markUnavailable(provider.id, (e as Error).message);
      return fallback(`provider ${provider.id} failed (${code}): ${(e as Error).message}`, null, null, null);
    }
    const v = validatePlan(raw, ctx, { query });
    if (!v.ok) {
      return fallback(`provider plan rejected: ${v.issues.map((i) => `${i.code}${i.value ? ` ${i.value}` : ""}`).join(", ")}`, v, raw, providerMs);
    }
    return done({ plan: v.plan!, source: provider.id, usedFallback: false, fallbackReason: null, providerValidation: v, validation: v, rejectedRaw: null, providerMs });
  }
}
