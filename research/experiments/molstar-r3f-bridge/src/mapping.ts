// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
//
// Codon <-> 2HBS residue mapping for HBB, as established in research/hbs-mapping-note.md:
//   codon k of ENST00000335295.4 CDS  = translated protein position k (p., UniProt P68871)
//   mature protein position = k - 1 (initiator Met removed)  = 2HBS beta-chain label_seq_id (= auth_seq_id)
// The offset is verified for this transcript/structure only; it is not a general rule.

export const CODON_TABLE: Record<string, string> = Object.fromEntries(
  'TTT F TTC F TTA L TTG L CTT L CTC L CTA L CTG L ATT I ATC I ATA I ATG M GTT V GTC V GTA V GTG V TCT S TCC S TCA S TCG S CCT P CCC P CCA P CCG P ACT T ACC T ACA T ACG T GCT A GCC A GCA A GCG A TAT Y TAC Y TAA * TAG * CAT H CAC H CAA Q CAG Q AAT N AAC N AAA K AAG K GAT D GAC D GAA E GAG E TGT C TGC C TGA * TGG W CGT R CGC R CGA R CGG R AGT S AGC S AGA R AGG R GGT G GGC G GGA G GGG G'
    .split(' ').reduce<[string, string][]>((acc, x, i, a) => (i % 2 === 0 ? [...acc, [x, a[i + 1]]] : acc), []));
export const THREE_LETTER: Record<string, string> = { A: 'ALA', R: 'ARG', N: 'ASN', D: 'ASP', C: 'CYS', E: 'GLU', Q: 'GLN', G: 'GLY', H: 'HIS', I: 'ILE', L: 'LEU', K: 'LYS', M: 'MET', F: 'PHE', P: 'PRO', S: 'SER', T: 'THR', W: 'TRP', Y: 'TYR', V: 'VAL' };

export type Codon = { index: number; cdsStart: number; bases: string; aa: string; matureResidue: number | null };

export function parseFasta(text: string) {
  const [header, ...rest] = text.trim().split('\n');
  return { id: header.slice(1).trim(), seq: rest.join('').replace(/\s/g, '').toUpperCase() };
}

export function codons(cds: string, from: number, to: number): Codon[] {
  const out: Codon[] = [];
  for (let k = from; k <= to; k++) {
    const bases = cds.slice((k - 1) * 3, k * 3);
    out.push({ index: k, cdsStart: (k - 1) * 3 + 1, bases, aa: CODON_TABLE[bases], matureResidue: k === 1 ? null : k - 1 });
  }
  return out;
}

export const HBS = { codon: 7, cdsPos: 20, ref: 'GAG', alt: 'GTG', structureChain: 'H', structureSeqId: 6 };
export const BETA_CHAINS = ['B', 'D', 'F', 'H'];
export const codonForResidue = (labelSeqId: number) => labelSeqId + 1;
