// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
import type { z } from "zod";
import { ParseError } from "../http/errors.ts";
import type { FetchedResponse } from "../http/client.ts";

/** Validate an unknown JSON value against a raw-response schema; typed ParseError on mismatch. */
export function parseWith<T extends z.ZodType>(schema: T, value: unknown, what: string, url: string | null = null): z.infer<T> {
  const r = schema.safeParse(value);
  if (!r.success) {
    throw new ParseError(
      what,
      r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
      url,
    );
  }
  return r.data;
}

/** A parsed record together with the response it came from (for provenance). */
export interface Fetched<T> {
  data: T;
  response: FetchedResponse;
}

/** Parse a single-record FASTA text. */
export function parseFasta(text: string, url: string | null = null): { header: string; id: string; sequence: string } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const first = lines[0];
  if (first === undefined || !first.startsWith(">")) throw new ParseError("FASTA", ["missing '>' header line"], url);
  if (lines.slice(1).some((l) => l.startsWith(">"))) throw new ParseError("FASTA", ["more than one record"], url);
  const sequence = lines.slice(1).join("").replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z*]+$/.test(sequence)) throw new ParseError("FASTA", ["sequence has invalid characters or is empty"], url);
  const header = first.slice(1).trim();
  return { header, id: header.split(/\s+/)[0] ?? "", sequence };
}
