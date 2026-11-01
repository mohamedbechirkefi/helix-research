// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Typed errors for every way a source call can fail (P2.2.1, P2.5.2). Callers branch
 * on `code`, never on message text. No error ever carries a partial record.
 */

export type HelixErrorCode =
  | "timeout"
  | "network"
  | "aborted"
  | "http-status"
  | "rate-limited"
  | "not-found"
  | "malformed-response"
  | "invalid-parameter"
  | "parse-error"
  | "validation-failed"
  | "proprietary-content";

export abstract class HelixDataError extends Error {
  abstract readonly code: HelixErrorCode;
  /** True when retrying the same request may succeed. */
  abstract readonly retryable: boolean;
  readonly url: string | null;
  constructor(message: string, url: string | null, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
    this.url = url;
  }
  /** A message safe to show a user: no stack, no response body. */
  userMessage(): string {
    return this.message;
  }
}

export class TimeoutError extends HelixDataError {
  readonly code = "timeout" as const;
  readonly retryable = true;
  readonly timeoutMs: number;
  constructor(url: string, timeoutMs: number) {
    super(`Request timed out after ${timeoutMs} ms: ${url}`, url);
    this.timeoutMs = timeoutMs;
  }
}

export class NetworkError extends HelixDataError {
  readonly code = "network" as const;
  readonly retryable = true;
  constructor(url: string, cause: unknown) {
    super(`Network error for ${url}: ${cause instanceof Error ? cause.message : String(cause)}`, url, { cause });
  }
}

/** The caller cancelled (e.g. the user navigated away). Never retried. */
export class AbortedError extends HelixDataError {
  readonly code = "aborted" as const;
  readonly retryable = false;
  constructor(url: string) {
    super(`Request cancelled: ${url}`, url);
  }
}

export class HttpStatusError extends HelixDataError {
  readonly code: "http-status" | "not-found" = "http-status";
  readonly retryable: boolean;
  readonly status: number;
  /** First 200 characters of the body, for diagnostics only; never parsed as data. */
  readonly bodySnippet: string;
  constructor(url: string, status: number, bodySnippet: string) {
    super(`HTTP ${status} from ${url}`, url);
    this.status = status;
    this.bodySnippet = bodySnippet;
    this.retryable = status === 500 || status === 502 || status === 503 || status === 504;
  }
}

export class NotFoundError extends HttpStatusError {
  override readonly code = "not-found" as const;
  override readonly retryable = false;
  constructor(url: string, bodySnippet: string) {
    super(url, 404, bodySnippet);
    this.message = `Record not found (HTTP 404): ${url}`;
  }
}

export class RateLimitedError extends HelixDataError {
  readonly code = "rate-limited" as const;
  readonly retryable = true;
  /** Seconds the server asked us to wait, when the header was readable. */
  readonly retryAfterSeconds: number | null;
  constructor(url: string, retryAfterSeconds: number | null) {
    super(`Rate limited (HTTP 429) by ${url}${retryAfterSeconds === null ? "" : `; retry after ${retryAfterSeconds} s`}`, url);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export type MalformedKind = "html-instead-of-json" | "invalid-json" | "empty-body" | "unexpected-content-type" | "truncated";

export class MalformedResponseError extends HelixDataError {
  readonly code = "malformed-response" as const;
  readonly retryable: boolean;
  readonly kind: MalformedKind;
  readonly bodySnippet: string;
  /** Our description of what is wrong (never response content). */
  readonly detail: string | null;
  constructor(url: string | null, kind: MalformedKind, bodySnippet: string, retryable = false, detail: string | null = null) {
    super(`Malformed response (${kind})${url ? ` from ${url}` : ""}${detail ? `: ${detail}` : ""}`, url);
    this.detail = detail;
    this.kind = kind;
    this.bodySnippet = bodySnippet;
    this.retryable = retryable;
  }
}

export class InvalidParameterError extends HelixDataError {
  readonly code = "invalid-parameter" as const;
  readonly retryable = false;
  constructor(message: string) {
    super(message, null);
  }
}

/** A body that is syntactically fine but does not have the shape the parser needs. */
export class ParseError extends HelixDataError {
  readonly code = "parse-error" as const;
  readonly retryable = false;
  readonly issues: string[];
  constructor(what: string, issues: string[], url: string | null = null) {
    super(`Could not parse ${what}: ${issues.slice(0, 3).join("; ")}`, url);
    this.issues = issues;
  }
}

/** A scientific validation check failed. The pipeline stops; it never falls back silently. */
export class ValidationFailedError extends HelixDataError {
  readonly code = "validation-failed" as const;
  readonly retryable = false;
  readonly check: string;
  constructor(check: string, message: string) {
    super(`Validation ${check} failed: ${message}`, null);
    this.check = check;
  }
}

/** Curated output would contain an identifier from a proprietary resource (Q-H-LIC-1). */
export class ProprietaryContentError extends HelixDataError {
  readonly code = "proprietary-content" as const;
  readonly retryable = false;
  readonly matches: string[];
  constructor(matches: string[]) {
    super(`Proprietary identifiers found in curated output: ${matches.slice(0, 5).join(", ")}`, null);
    this.matches = matches;
  }
}

export function isHelixDataError(e: unknown): e is HelixDataError {
  return e instanceof HelixDataError;
}
