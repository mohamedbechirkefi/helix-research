// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/** Small pure checks used by the dataset builder; each returns a named pass/fail with detail. */
import { translate } from "./sequence.ts";
import { md5Hex } from "./md5.ts";

export interface CheckOutcome {
  check: string;
  pass: boolean;
  detail: string;
  /** "warn" checks are recorded but never stop the build (e.g. version drift). */
  level: "error" | "warn";
}

export const ok = (check: string, pass: boolean, detail: string, level: "error" | "warn" = "error"): CheckOutcome => ({ check, pass, detail, level });

/** P2.4.3: translate(CDS, to_stop) == Ensembl protein == UniProt canonical, and UniProt md5 matches. */
export function translationChecks(input: { cds: string; ensemblProtein: string; uniprotSequence: string; uniprotMd5: string }): CheckOutcome[] {
  const cds = input.cds.toUpperCase();
  const stop = cds.slice(-3);
  const translated = translate(cds, { toStop: true });
  const md5 = md5Hex(input.uniprotSequence).toUpperCase();
  return [
    ok("cds-shape", cds.length % 3 === 0 && cds.startsWith("ATG") && ["TAA", "TAG", "TGA"].includes(stop), `length ${cds.length}, starts ${cds.slice(0, 3)}, ends ${stop}`),
    ok("translation-equals-ensembl-protein", translated === input.ensemblProtein, `translated ${translated.length} aa vs Ensembl ${input.ensemblProtein.length} aa`),
    ok("translation-equals-uniprot", translated === input.uniprotSequence, `translated ${translated.length} aa vs UniProt ${input.uniprotSequence.length} aa`),
    ok("uniprot-md5", md5 === input.uniprotMd5.toUpperCase(), `computed ${md5}, UniProt ${input.uniprotMd5}`),
  ];
}
