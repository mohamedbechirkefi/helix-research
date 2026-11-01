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
