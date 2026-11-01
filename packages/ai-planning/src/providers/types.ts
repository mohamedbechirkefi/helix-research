// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * The AI provider abstraction (P3.2.4, amendment A-1). One interface for the deterministic
 * planner, a local Ollama server (desktop shell or development) and an in-browser WebLLM
 * engine. A provider only proposes raw text; validation and the fallback policy live in the
 * director, so no provider output is ever executed unvalidated.
 */
import type { PlanningContext } from "../context.ts";

export type ProviderKind = "deterministic" | "ollama" | "webllm" | "mock";

export interface PlanRequest {
  query: string;
  context: PlanningContext;
  requestId: string;
  temperature?: number;
  seed?: number;
  /** "generic": identifiers are free strings in the decoding schema; "grounded": enums of the context ids. */
  schemaMode?: "generic" | "grounded";
  signal?: AbortSignal;
}

export interface ProviderCapability {
  available: boolean;
  /** Human-readable, surfaced to the user (why a provider is or is not offered). */
  reason: string;
  details?: Record<string, unknown>;
}

export interface ProviderOutput {
  raw: string;
  timings: { firstTokenMs: number | null; totalMs: number };
  usage?: { promptTokens?: number; completionTokens?: number; loadMs?: number; evalMs?: number; promptEvalMs?: number };
  meta?: Record<string, unknown>;
}

export interface PlanProvider {
  readonly id: string;
  readonly kind: ProviderKind;
  readonly label: string;
  /** Local and free to run on this device; no provider may be a paid cloud service. */
  readonly local: true;
  detect(): Promise<ProviderCapability>;
  plan(req: PlanRequest): Promise<ProviderOutput>;
}

export class ProviderError extends Error {
  readonly providerId: string;
  readonly code: "unavailable" | "http" | "aborted" | "protocol" | "timeout";
  /** Output received before the failure, if any (kept for diagnosis, never executed). */
  partial = "";
  constructor(providerId: string, code: ProviderError["code"], message: string) {
    super(message);
    this.name = "ProviderError";
    this.providerId = providerId;
    this.code = code;
  }
}

export const now = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());
