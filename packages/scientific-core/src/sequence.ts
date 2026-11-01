// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/** Nucleotide and protein sequence utilities (standard genetic code, NCBI table 1). */
import { ValidationFailedError } from "@helix/data-adapters";

const BASES = "TCAG";
const AA_TABLE_1 = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";

/** Standard code: codon -> one-letter amino acid ('*' for stop). */
export const GENETIC_CODE: Readonly<Record<string, string>> = (() => {
  const t: Record<string, string> = {};
  let k = 0;
  for (const a of BASES) for (const b of BASES) for (const c of BASES) t[a + b + c] = AA_TABLE_1[k++]!;
  return t;
})();

export const AA_THREE_LETTER: Readonly<Record<string, string>> = {
  A: "Ala", R: "Arg", N: "Asn", D: "Asp", C: "Cys", Q: "Gln", E: "Glu", G: "Gly", H: "His", I: "Ile",
  L: "Leu", K: "Lys", M: "Met", F: "Phe", P: "Pro", S: "Ser", T: "Thr", W: "Trp", Y: "Tyr", V: "Val",
  "*": "Ter",
};

/** PDB three-letter residue names for the 20 standard amino acids. */
export const AA_PDB_NAME: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(AA_THREE_LETTER)
    .filter(([k]) => k !== "*")
    .map(([k, v]) => [k, v.toUpperCase()]),
);

export function translateCodon(codon: string): string {
  const aa = GENETIC_CODE[codon.toUpperCase()];
  if (aa === undefined) throw new ValidationFailedError("translate", `not a codon: ${codon}`);
  return aa;
}

/** Translate a CDS. With toStop, stops at (and excludes) the first stop codon, like Biopython. */
export function translate(cds: string, opts: { toStop?: boolean } = {}): string {
  const s = cds.toUpperCase();
  if (s.length % 3 !== 0) throw new ValidationFailedError("translate", `CDS length ${s.length} is not a multiple of 3`);
  let out = "";
  for (let i = 0; i < s.length; i += 3) {
    const aa = translateCodon(s.slice(i, i + 3));
    if (aa === "*" && opts.toStop) break;
    out += aa;
  }
  return out;
}

const COMPLEMENT: Readonly<Record<string, string>> = { A: "T", T: "A", G: "C", C: "G", N: "N" };

export function complement(base: string): string {
  const c = COMPLEMENT[base.toUpperCase()];
  if (c === undefined) throw new ValidationFailedError("complement", `not a base: ${base}`);
  return c;
}

export function reverseComplement(seq: string): string {
  let out = "";
  for (let i = seq.length - 1; i >= 0; i--) out += complement(seq[i]!);
  return out;
}

/** HGVS-style protein substitution, three-letter code: "p.Glu7Val". */
export function proteinSubstitution(ref: string, position: number, alt: string): string {
  const r = AA_THREE_LETTER[ref];
  const a = AA_THREE_LETTER[alt];
  if (!r || !a) throw new ValidationFailedError("hgvs-p", `unknown amino acid ${ref} or ${alt}`);
  return `p.${r}${position}${a}`;
}
