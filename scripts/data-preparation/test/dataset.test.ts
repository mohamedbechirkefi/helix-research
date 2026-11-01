// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/** Dataset-level tests: determinism of the build, and integrity of the committed data/curated/hbb. */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findProprietaryIdentifiers } from "@helix/data-adapters";
import { HBB_CONFIG, buildManifest, buildSlice } from "@helix/scientific-core";
import { DatasetManifest, Gene, Protein, ResidueMapping, Structure, Variant } from "@helix/shared-types";
import { loadFixtureInputs } from "../lib/fixtures.ts";
import { REPO_ROOT } from "../lib/node-env.ts";

const stripTimes = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(stripTimes)
    : v && typeof v === "object"
      ? Object.fromEntries(Object.entries(v).filter(([k]) => !["retrievedAt", "generatedAt", "at"].includes(k)).map(([k, x]) => [k, stripTimes(x)]))
      : v;

describe("build determinism (P2.5.1)", () => {
  it("two builds from the same records differ only in timestamps", async () => {
    const inputs = await loadFixtureInputs();
    const a = await buildSlice(inputs, HBB_CONFIG, { now: "2026-11-01T10:00:00Z" });
    const later = Object.fromEntries(Object.entries(inputs).map(([k, r]) => [k, r && { ...r, retrievedAt: "2026-11-02T09:00:00Z" }])) as typeof inputs;
    const b = await buildSlice(later, HBB_CONFIG, { now: "2026-11-02T10:00:00Z" });
    expect(a.files.map((f) => f.path)).toEqual(b.files.map((f) => f.path));
    for (let i = 0; i < a.files.length; i++) {
      const fa = a.files[i]!;
      const fb = b.files[i]!;
      if (fa.recordKind === "mmcif") expect(fa.content).toBe(fb.content);
      else expect(stripTimes(JSON.parse(fa.content)), fa.path).toEqual(stripTimes(JSON.parse(fb.content)));
    }
    const ma = await buildManifest(a, HBB_CONFIG, { generatedAt: "2026-11-01T10:00:00Z", script: "t", gitCommit: null, gitDirty: null, node: "v22", assembly: "GRCh38.p14" });
    expect(DatasetManifest.safeParse(ma).success).toBe(true);
    expect(ma.sources.map((s) => s.sha256)).toEqual(b.sources.map((s) => s.sha256));
  });
});

const DIR = join(REPO_ROOT, "data/curated/hbb");
describe.skipIf(!existsSync(join(DIR, "manifest.json")))("committed curated dataset data/curated/hbb", () => {
  it("manifest is schema-valid and every file matches its sha256", async () => {
    const m = DatasetManifest.parse(JSON.parse(await readFile(join(DIR, "manifest.json"), "utf8")));
    expect(m.validation.filter((v) => v.result === "fail")).toEqual([]);
    for (const f of m.files) {
      const buf = await readFile(join(DIR, f.path));
      expect(createHash("sha256").update(buf).digest("hex"), f.path).toBe(f.sha256);
      expect(buf.byteLength).toBe(f.bytes);
    }
    expect(m.sources.every((s) => s.retrievedAt.startsWith("20"))).toBe(true);
  });
  it("records validate against their schemas and carry no proprietary identifiers", async () => {
    const read = async (p: string) => JSON.parse(await readFile(join(DIR, p), "utf8"));
    Gene.parse(await read("gene.json"));
    Protein.parse(await read("protein-P68871.json"));
    Variant.parse(await read("variant-hbs.json"));
    Structure.parse(await read("structure-2HBS.json"));
    ResidueMapping.parse(await read("residue-mapping-hbs-2HBS.json"));
    const m = DatasetManifest.parse(await read("manifest.json"));
    for (const f of m.files.filter((x) => x.path.endsWith(".json"))) expect(findProprietaryIdentifiers(await read(f.path)), f.path).toEqual([]);
    expect(findProprietaryIdentifiers(m)).toEqual([]);
  });
  it("the HbS mapping: UniProt 7 (mature 6) -> 2HBS label/auth 6 VAL in B, D, F, H (hbs-mapping-note §6)", async () => {
    const map = ResidueMapping.parse(JSON.parse(await readFile(join(DIR, "residue-mapping-hbs-2HBS.json"), "utf8")));
    expect([map.uniprotPosition, map.maturePosition, map.method]).toEqual([7, 6, "sifts"]);
    expect(map.residues.map((r) => [r.labelAsymId, r.labelSeqId, r.authAsymId, r.authSeqId, r.compId])).toEqual([
      ["B", 6, "B", "6", "VAL"],
      ["D", 6, "D", "6", "VAL"],
      ["F", 6, "F", "6", "VAL"],
      ["H", 6, "H", "6", "VAL"],
    ]);
  });
});
