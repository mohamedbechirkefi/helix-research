// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Token-bucket rate limiter, one per source (docs/data-source-registry.md, architecture
 * consequence 3). Clock and sleep are injectable so tests run without real waits.
 */

export interface Clock {
  now(): number;
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
}

export const realClock: Clock = {
  now: () => Date.now(),
  sleep: (ms, signal) =>
    new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason);
        return;
      }
      const t = setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      }, ms);
      const onAbort = (): void => {
        clearTimeout(t);
        reject(signal?.reason);
      };
      signal?.addEventListener("abort", onAbort, { once: true });
    }),
};

export interface RateLimit {
  /** Sustained requests per second. */
  perSecond: number;
  /** Bucket size (burst). */
  burst: number;
}

export class TokenBucket {
  private tokens: number;
  private last: number;
  private queue: Promise<void> = Promise.resolve();
  readonly limit: RateLimit;
  private readonly clock: Clock;

  constructor(limit: RateLimit, clock: Clock = realClock) {
    if (!(limit.perSecond > 0) || !(limit.burst >= 1)) throw new RangeError("rate limit must be positive");
    this.limit = limit;
    this.clock = clock;
    this.tokens = limit.burst;
    this.last = clock.now();
  }

  private refill(): void {
    const now = this.clock.now();
    const elapsed = Math.max(0, now - this.last) / 1000;
    this.tokens = Math.min(this.limit.burst, this.tokens + elapsed * this.limit.perSecond);
    this.last = now;
  }

  /** Resolves when a token is available. Calls are served in FIFO order. */
  acquire(signal?: AbortSignal): Promise<void> {
    const next = this.queue.then(async () => {
      this.refill();
      if (this.tokens < 1) {
        const waitMs = Math.ceil(((1 - this.tokens) / this.limit.perSecond) * 1000);
        await this.clock.sleep(waitMs, signal);
        this.refill();
      }
      this.tokens -= 1;
    });
    // Keep the chain alive even if one waiter is aborted.
    this.queue = next.catch(() => undefined);
    return next;
  }

  /** Block the bucket for a server-requested pause (Retry-After). */
  pause(ms: number): void {
    this.refill();
    this.tokens = Math.min(this.tokens, 0) - (ms / 1000) * this.limit.perSecond;
  }
}
