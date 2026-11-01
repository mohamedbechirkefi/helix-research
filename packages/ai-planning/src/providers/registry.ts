// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Provider registry: capability detection, selection by preference, runtime switching, and
 * the status list the UI shows ("which AI is active, what is unavailable on this device").
 * The deterministic provider must be registered and is always available.
 */
import type { PlanProvider, ProviderCapability, ProviderKind } from "./types.ts";

export interface ProviderStatus {
  id: string;
  kind: ProviderKind;
  label: string;
  available: boolean;
  reason: string;
  active: boolean;
}

export type ProviderListener = (active: string, statuses: ProviderStatus[]) => void;

export class ProviderRegistry {
  private readonly providers = new Map<string, PlanProvider>();
  private readonly caps = new Map<string, ProviderCapability>();
  private activeId: string;
  private readonly listeners = new Set<ProviderListener>();
  private readonly preference: string[];

  /** `preference`: provider ids, best first. Providers not listed come after, in registration order. */
  constructor(providers: PlanProvider[], preference: string[] = []) {
    this.preference = preference;
    for (const p of providers) {
      if (this.providers.has(p.id)) throw new Error(`duplicate provider id ${p.id}`);
      this.providers.set(p.id, p);
    }
    const det = providers.find((p) => p.kind === "deterministic");
    if (!det) throw new Error("a deterministic provider is required (master prompt §8, item 3)");
    this.activeId = det.id;
  }

  get active(): PlanProvider {
    return this.providers.get(this.activeId)!;
  }

  get deterministic(): PlanProvider {
    return [...this.providers.values()].find((p) => p.kind === "deterministic")!;
  }

  get(id: string): PlanProvider | undefined {
    return this.providers.get(id);
  }

  async detectAll(): Promise<ProviderStatus[]> {
    await Promise.all(
      [...this.providers.values()].map(async (p) => {
        let c: ProviderCapability;
        try {
          c = await p.detect();
        } catch (e) {
          c = { available: false, reason: `detection failed: ${(e as Error).message}` };
        }
        this.caps.set(p.id, c);
      }),
    );
    // The active provider may have become unavailable.
    if (!this.caps.get(this.activeId)?.available) this.activeId = this.deterministic.id;
    this.emit();
    return this.statuses();
  }

  /** Detects, then activates the most preferred available provider. */
  async selectBest(): Promise<PlanProvider> {
    await this.detectAll();
    const order = [...this.preference, ...[...this.providers.keys()].filter((id) => !this.preference.includes(id))];
    const best = order.find((id) => this.providers.has(id) && this.caps.get(id)?.available) ?? this.deterministic.id;
    this.activeId = best;
    this.emit();
    return this.active;
  }

  /** Runtime switching (user choice). Refuses providers that are unknown or not available. */
  setActive(id: string): PlanProvider {
    const p = this.providers.get(id);
    if (!p) throw new Error(`unknown provider ${id}`);
    const c = this.caps.get(id);
    if (!c?.available) throw new Error(`provider ${id} is not available: ${c?.reason ?? "not detected yet"}`);
    this.activeId = id;
    this.emit();
    return p;
  }

  /** Marks a provider unavailable after a runtime failure and falls back to the deterministic one if it was active. */
  markUnavailable(id: string, reason: string): void {
    this.caps.set(id, { available: false, reason });
    if (this.activeId === id) this.activeId = this.deterministic.id;
    this.emit();
  }

  statuses(): ProviderStatus[] {
    return [...this.providers.values()].map((p) => ({
      id: p.id,
      kind: p.kind,
      label: p.label,
      available: this.caps.get(p.id)?.available ?? false,
      reason: this.caps.get(p.id)?.reason ?? "not detected yet",
      active: p.id === this.activeId,
    }));
  }

  onChange(l: ProviderListener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private emit(): void {
    const s = this.statuses();
    for (const l of this.listeners) l(this.activeId, s);
  }
}
