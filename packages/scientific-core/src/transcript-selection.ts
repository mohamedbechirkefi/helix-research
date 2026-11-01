// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Transcript selection rule (P2.4.2, research/hbb-acquisition-plan.md §2):
 *   1. the transcript whose MANE array has type MANE_Select;
 *   2. otherwise is_canonical == 1, flagged "ensembl_canonical_not_mane" with a warning;
 *   3. otherwise the gene is unsupported for transcript-level scenes (typed error).
 * Never inferred from length or list order.
 */
import type { EnsemblGeneRaw, EnsemblTranscriptRaw } from "@helix/data-adapters";
import { ValidationFailedError } from "@helix/data-adapters";
import type { TranscriptSelection } from "@helix/shared-types";

export class TranscriptSelectionError extends ValidationFailedError {
  constructor(message: string) {
    super("transcript-selection", message);
  }
}

export function selectTranscript(gene: EnsemblGeneRaw): { selection: TranscriptSelection; transcript: EnsemblTranscriptRaw } {
  const ts = gene.Transcript;
  if (ts.length === 0) throw new TranscriptSelectionError(`${gene.id} has no transcripts in the lookup (was expand=1 set?)`);
  const mane = ts.filter((t) => t.MANE.some((m) => m.type === "MANE_Select"));
  if (mane.length > 1) throw new TranscriptSelectionError(`${gene.id} has ${mane.length} MANE Select transcripts; expected one`);
  if (mane.length === 1) {
    const t = mane[0]!;
    const warnings: string[] = [];
    if (t.is_canonical !== 1) warnings.push(`MANE Select ${t.id}.${t.version} is not flagged is_canonical`);
    if (gene.canonical_transcript && gene.canonical_transcript !== `${t.id}.${t.version}`) {
      warnings.push(`gene canonical_transcript ${gene.canonical_transcript} differs from MANE Select ${t.id}.${t.version}`);
    }
    return {
      transcript: t,
      selection: {
        rule: "mane_select",
        selected: { id: t.id, version: t.version },
        candidatesConsidered: ts.length,
        reason: "only transcript with MANE[].type == MANE_Select",
        warnings,
      },
    };
  }
  const canonical = ts.filter((t) => t.is_canonical === 1);
  if (canonical.length === 1) {
    const t = canonical[0]!;
    return {
      transcript: t,
      selection: {
        rule: "ensembl_canonical_not_mane",
        selected: { id: t.id, version: t.version },
        candidatesConsidered: ts.length,
        reason: "no MANE Select transcript; fell back to the Ensembl canonical transcript",
        warnings: [`${gene.id}: no MANE Select transcript in this release; using Ensembl canonical ${t.id}.${t.version}`],
      },
    };
  }
  throw new TranscriptSelectionError(
    `${gene.id} has neither a MANE Select nor a single Ensembl canonical transcript; unsupported for transcript-level scenes`,
  );
}
