// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Inter-chain contacts of a residue in the deposited asymmetric unit (no symmetry mates),
 * matching scripts/research/val6_contacts.py: atoms of other auth chains within a cutoff
 * of the given atoms, reported as unique (auth chain, auth seq id, residue name).
 */
import type { MmcifStructure } from "@helix/data-adapters";

export interface Contact {
  authAsymId: string;
  authSeqId: number;
  compId: string;
}

export function interChainContacts(
  structure: MmcifStructure,
  authAsymId: string,
  authSeqId: string,
  atomNames: readonly string[],
  cutoffAngstrom: number,
): { residue: string; contacts: Contact[] } {
  const model = structure.atoms.filter((a) => a.model === 1);
  const probe = model.filter((a) => a.authAsymId === authAsymId && a.authSeqId === authSeqId);
  if (probe.length === 0) throw new Error(`no atoms for ${authAsymId} ${authSeqId}`);
  const centres = probe.filter((a) => atomNames.includes(a.atomName));
  const c2 = cutoffAngstrom * cutoffAngstrom;
  const hits = new Map<string, Contact>();
  for (const p of centres) {
    for (const a of model) {
      if (a.authAsymId === authAsymId) continue;
      const dx = a.x - p.x;
      const dy = a.y - p.y;
      const dz = a.z - p.z;
      if (dx * dx + dy * dy + dz * dz <= c2) {
        const k = `${a.authAsymId}|${a.authSeqId}|${a.authCompId}`;
        if (!hits.has(k)) hits.set(k, { authAsymId: a.authAsymId, authSeqId: Number(a.authSeqId), compId: a.authCompId });
      }
    }
  }
  const contacts = [...hits.values()].sort((x, y) => x.authAsymId.localeCompare(y.authAsymId) || x.authSeqId - y.authSeqId || x.compId.localeCompare(y.compId));
  return { residue: probe[0]!.authCompId, contacts };
}
