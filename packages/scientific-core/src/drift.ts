// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Version drift between resources read on the same day (scientific model §9 pitfall 7).
 * Drift is reported, never fatal: HELIX compares sequences and versioned ids, not entry
 * versions, so a stale cross-reference version does not change any mapping.
 */
import type { DriftReport } from "@helix/shared-types";
import { parseVersioned } from "@helix/shared-types";

export interface DriftInput {
  ensemblGene: { id: string; version: number };
  uniprot: { accession: string; entryVersion: number; ensemblXrefs: { transcript: string; gene: string }[] };
  selectedTranscript: string; // versioned
  vepSwissprot: string[]; // e.g. ["P68871.216"]
  maneRefSeq: string | null; // from Ensembl
  hgncManeSelect: string[];
  uniprotManeSelect: { transcript: string; refSeqNucleotide: string } | null;
  clinvarTitle: string | null;
}

export function detectDrift(i: DriftInput): DriftReport[] {
  const out: DriftReport[] = [];
  const x = i.uniprot.ensemblXrefs.find((e) => e.transcript === i.selectedTranscript);
  if (x) {
    const g = parseVersioned(x.gene);
    if (g.id === i.ensemblGene.id && g.version !== i.ensemblGene.version) {
      out.push({
        id: "uniprot-xref-ensembl-gene-version",
        subject: i.ensemblGene.id,
        observedIn: `UniProt ${i.uniprot.accession} Ensembl cross-reference`,
        observedValue: x.gene,
        referenceSource: "Ensembl lookup",
        referenceValue: `${i.ensemblGene.id}.${i.ensemblGene.version}`,
        fatal: false,
        note: "UniProt's cross-reference lags the Ensembl gene version; the transcript and protein versions agree, so mappings are unaffected.",
      });
    }
  }
  for (const s of i.vepSwissprot) {
    const v = parseVersioned(s);
    if (v.id === i.uniprot.accession && v.version !== i.uniprot.entryVersion) {
      out.push({
        id: "vep-swissprot-entry-version",
        subject: i.uniprot.accession,
        observedIn: "Ensembl VEP swissprot field",
        observedValue: s,
        referenceSource: "UniProt REST entryVersion",
        referenceValue: `${i.uniprot.accession}.${i.uniprot.entryVersion}`,
        fatal: false,
        note: "Entry versions change with annotation; HELIX compares the sequence (md5) instead.",
      });
    }
  }
  const t = parseVersioned(i.selectedTranscript);
  const hgncT = i.hgncManeSelect.find((m) => parseVersioned(m).id === t.id);
  if (hgncT && hgncT !== i.selectedTranscript) {
    out.push({ id: "hgnc-mane-transcript-version", subject: t.id, observedIn: "HGNC mane_select", observedValue: hgncT, referenceSource: "Ensembl lookup", referenceValue: i.selectedTranscript, fatal: false, note: "HGNC lists a different transcript version." });
  }
  if (i.maneRefSeq) {
    const r = parseVersioned(i.maneRefSeq);
    const hgncR = i.hgncManeSelect.find((m) => parseVersioned(m).id === r.id);
    if (hgncR && hgncR !== i.maneRefSeq) {
      out.push({ id: "hgnc-mane-refseq-version", subject: r.id, observedIn: "HGNC mane_select", observedValue: hgncR, referenceSource: "Ensembl MANE refseq_match", referenceValue: i.maneRefSeq, fatal: false, note: "HGNC lists a different RefSeq version." });
    }
    if (i.uniprotManeSelect && i.uniprotManeSelect.refSeqNucleotide !== i.maneRefSeq) {
      out.push({ id: "uniprot-mane-refseq-version", subject: r.id, observedIn: "UniProt MANE-Select", observedValue: i.uniprotManeSelect.refSeqNucleotide, referenceSource: "Ensembl MANE refseq_match", referenceValue: i.maneRefSeq, fatal: false, note: "UniProt lists a different RefSeq version." });
    }
    const m = i.clinvarTitle ? /^(NM_\d+\.\d+)\(/.exec(i.clinvarTitle) : null;
    if (m && m[1] !== i.maneRefSeq && parseVersioned(m[1]!).id === r.id) {
      out.push({ id: "clinvar-title-refseq-version", subject: r.id, observedIn: "ClinVar title", observedValue: m[1]!, referenceSource: "Ensembl MANE refseq_match", referenceValue: i.maneRefSeq, fatal: false, note: "ClinVar describes the variant on an older RefSeq version." });
    }
  }
  return out;
}
