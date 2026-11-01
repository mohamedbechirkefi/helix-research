// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/** Versioned accessions (accession.version). Unversioned comparisons are a known source of drift. */
import { z } from "zod";

export const VersionedId = z.object({
  id: z.string().min(1),
  /** null when the source does not version the identifier. */
  version: z.number().int().min(0).nullable(),
});
export type VersionedId = z.infer<typeof VersionedId>;

/** "ENST00000335295" + 4 -> "ENST00000335295.4"; null version -> bare id. */
export function formatVersioned(v: VersionedId): string {
  return v.version === null ? v.id : `${v.id}.${v.version}`;
}

/** Parse "NM_000518.5" -> {id: "NM_000518", version: 5}; no suffix -> version null. */
export function parseVersioned(s: string): VersionedId {
  const m = /^(.+?)\.(\d+)$/.exec(s);
  if (!m || m[1] === undefined || m[2] === undefined) return { id: s, version: null };
  return { id: m[1], version: Number(m[2]) };
}
