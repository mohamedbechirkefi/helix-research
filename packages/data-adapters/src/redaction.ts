// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Proprietary-identifier guard (author decision Q-H-LIC-1, 2026-11-01): OMIM/MIM numbers
 * and HGMD accessions never enter curated data or fixtures. Adapters drop the fields that
 * carry them; this scanner is the last check before anything is written.
 */
import { ProprietaryContentError } from "./http/errors.ts";

/** Cross-reference database names whose identifiers must be dropped. */
export const PROPRIETARY_DATABASES = new Set(["MIM", "OMIM", "HGMD", "HGMD-PUBLIC", "HGMD_PUBLIC"]);

export function isProprietaryDatabase(name: string): boolean {
  return PROPRIETARY_DATABASES.has(name.toUpperCase().replace(/\s+/g, "-"));
}

const PATTERNS: { name: string; re: RegExp }[] = [
  { name: "OMIM", re: /\bOMIM\b/i },
  { name: "MIM number", re: /\bMIM[:\s#]*\d{6}\b/ },
  { name: "MIM database name", re: /^MIM$/i },
  // Also matches "HGMD_MUTATION", the allele_string Ensembl VEP uses for HGMD records.
  // A bare HGMD accession (e.g. two letters + 6 digits) is not matched on its own: the same
  // shape is used by EMBL/GenBank accessions (e.g. CR536530). Adapters drop HGMD records
  // by their database field; this scan catches the database name wherever it appears.
  { name: "HGMD", re: /HGMD/i },
];

/** Return every string (or key) in `value` that looks like a proprietary identifier. */
export function findProprietaryIdentifiers(value: unknown): string[] {
  const hits: string[] = [];
  const visit = (v: unknown, path: string): void => {
    if (typeof v === "string") {
      for (const p of PATTERNS) {
        const m = p.re.exec(v);
        if (m) hits.push(`${path}: ${p.name} (${m[0]})`);
      }
    } else if (Array.isArray(v)) {
      v.forEach((x, i) => visit(x, `${path}[${i}]`));
    } else if (v !== null && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) {
        visit(k, `${path}.<key>`);
        visit(x, `${path}.${k}`);
      }
    }
  };
  visit(value, "$");
  return hits;
}

export function assertNoProprietaryIdentifiers(value: unknown): void {
  const hits = findProprietaryIdentifiers(value);
  if (hits.length > 0) throw new ProprietaryContentError(hits);
}

/** Object keys that carry a proprietary identifier by name (HGNC `omim_id`, and any key naming OMIM/MIM/HGMD). */
const PROPRIETARY_KEYS = /^(omim|mim|hgmd)([_-]?(id|ids|number|accession))?$/i;
/** Fields whose value names the database an object belongs to (UniProt cross-references and evidences, HGNC/Ensembl xrefs). */
const DATABASE_FIELDS = ["database", "source", "db", "dbname", "db_name"];

function namesProprietaryDatabase(v: unknown): boolean {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return DATABASE_FIELDS.some((f) => typeof o[f] === "string" && isProprietaryDatabase(o[f] as string));
}

export interface Redaction<T = unknown> {
  value: T;
  /** JSON paths removed, with what each was. Empty when nothing had to be removed. */
  removed: string[];
}

/**
 * The redaction research/raw received (Q-H-LIC-1, see research/raw/README.md), as code: a
 * deep copy of a decoded response without (a) any object whose database field names
 * OMIM/MIM or HGMD (UniProt cross-references, evidences and disease cross-references,
 * Ensembl VEP colocated HGMD records), and (b) any key named for those databases (HGNC
 * `omim_id`). Nothing else is touched. The caller then runs `findProprietaryIdentifiers`
 * on the result: an identifier this function could not remove must fail the recording,
 * never be written.
 */
export function redactProprietaryIdentifiers<T = unknown>(value: T): Redaction<T> {
  const removed: string[] = [];
  const visit = (v: unknown, path: string): unknown => {
    if (Array.isArray(v)) {
      const out: unknown[] = [];
      v.forEach((x, i) => {
        if (namesProprietaryDatabase(x)) removed.push(`${path}[${i}] (object of a proprietary database)`);
        else out.push(visit(x, `${path}[${i}]`));
      });
      return out;
    }
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        if (PROPRIETARY_KEYS.test(k)) removed.push(`${path}.${k} (key named for a proprietary database)`);
        else if (namesProprietaryDatabase(x)) removed.push(`${path}.${k} (object of a proprietary database)`);
        else out[k] = visit(x, `${path}.${k}`);
      }
      return out;
    }
    return v;
  };
  return { value: visit(value, "$") as T, removed };
}
