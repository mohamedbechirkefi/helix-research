// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
import { deterministicPlan } from "../fallback.ts";
import { now, type PlanProvider, type PlanRequest, type ProviderCapability, type ProviderOutput } from "./types.ts";

/** Always available: rule-based plans over the bundled records, no model. */
export class DeterministicProvider implements PlanProvider {
  readonly id = "deterministic";
  readonly kind = "deterministic" as const;
  readonly label = "Deterministic (no AI model)";
  readonly local = true as const;
  async detect(): Promise<ProviderCapability> {
    return { available: true, reason: "rule-based planner over the bundled records; works offline on every device" };
  }
  async plan(req: PlanRequest): Promise<ProviderOutput> {
    const t0 = now();
    const { plan, rule } = deterministicPlan(req.query, req.context);
    const raw = JSON.stringify(plan);
    const t = now() - t0;
    return { raw, timings: { firstTokenMs: t, totalMs: t }, meta: { rule } };
  }
}
