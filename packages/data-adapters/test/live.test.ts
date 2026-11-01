// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Live smoke tests (opt-in: `npm run test:live`, which sets HELIX_LIVE=1). They call the
 * real APIs once each, politely, and check identity, not exact versions: a version bump
 * is drift to report, not a failure.
 */
import { describe, expect, it } from "vitest";
import { EnsemblAdapter, HttpClient, RcsbAdapter, SiftsAdapter, UniprotAdapter, findProprietaryIdentifiers } from "../src/index.ts";

const live = process.env.HELIX_LIVE === "1";
const http = new HttpClient({ userAgent: "helix-research (Mohamed Bechir Kefi)", timeoutMs: 60_000 });

describe.skipIf(!live)("live smoke", () => {
  it("Ensembl ENSG00000244734", async () => {
    const { data, response } = await new EnsemblAdapter(http).lookupGene("ENSG00000244734");
    expect(data.display_name).toBe("HBB");
    expect(data.assembly_name).toBe("GRCh38");
    expect(data.Transcript.some((t) => t.MANE.some((m) => m.type === "MANE_Select"))).toBe(true);
    expect(response.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
  it("UniProt P68871", async () => {
    const r = await new UniprotAdapter(http).entry("P68871");
    expect(r.data.accession).toBe("P68871");
    expect(r.release).toMatch(/^\d{4}_\d{2}$/);
    expect(r.data.sequence[7 - 1]).toBe("E");
    expect(findProprietaryIdentifiers(r.data)).toEqual([]);
  });
  it("RCSB 2HBS and SIFTS", async () => {
    const s = await new RcsbAdapter(http).mmcif("2HBS");
    expect(s.data.entities.find((e) => e.id === "2")?.strandIds).toEqual(["B", "D", "F", "H"]);
    const m = await new SiftsAdapter(http).uniprotMappings("2HBS");
    expect(m.data.filter((x) => x.uniprotAccession === "P68871")).toHaveLength(4);
  }, 120_000);
});
