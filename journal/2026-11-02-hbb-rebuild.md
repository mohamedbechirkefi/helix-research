<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HX-P6-2026-11-02-hbb-rebuild: live rebuild of the curated HBB dataset with the ClinVar record and the full-chain mapping

```yaml
id:            HX-P6-2026-11-02-hbb-rebuild
date:          2026-11-02
hypothesis:    The Phase 2 build, extended with two records (clinvar-hbs.json: review status, stars,
               conflicts and the other ClinVar records at rs334; residue-mapping-P68871-2HBS.json: every
               SIFTS-mapped position of P68871 on 2HBS), rebuilds live from a clean commit that is on
               main, passes every Phase 2 check plus the new ones, leaves every Phase 2 record unchanged
               in content apart from source updates, and regenerates identically apart from timestamps.
               Contradicted by a failed check, an unexplained difference between two builds, or a Phase 2
               record that changes for a reason other than a newer source record.
git_commit:    helix-research 4b30c60 (generator commit, clean tree); data committed as 0826e68; the second
               build ran from 0826e68, whose packages/ and scripts/ equal 4b30c60 except
               scripts/data-preparation/test/dataset.test.ts (a test, not on the build path)
config:        scripts/data-preparation/build-hbb.ts (live); HBB_CONFIG in
               packages/scientific-core/src/slice/types.ts (unchanged); comparison with
               scripts/data-preparation/compare-builds.ts --cache .cache/helix-raw
seeds:         n/a (deterministic build; two live runs)
data_version:  output data/curated/hbb at 0826e68 (manifest generatedAt 2026-11-02T02:26:08Z); previous
               build generator 0692bff (pre-rewrite hash, = 3b89a9a on main)
hardware:      Apple M1 Pro, 16 GB, macOS 15.3.1; Node v22.23.3
duration:      build 1 56.4 s wall (2026-11-02T02:26:08Z); build 2 4.5 s wall (02:28:16Z)
cost:          0 (free public APIs; User-Agent "helix-research"; NCBI calls carry tool=helix-research only)
```

## Methods

- **Code change (4b30c60):** ClinVar esearch by rsID (C0) before esummary, so the summary covers every ClinVar record that cites rs334; the build writes `clinvar-hbs.json` (classification, review status, ClinVar's star level, conflict status read from ClinVar's words, the other records kept separate, no trait names) and `residue-mapping-P68871-2HBS.json` (one row per SIFTS-mapped UniProt position, residues on each mapped chain, auth ids from pdbx_poly_seq_scheme, residue names from atom_site). New checks T33 to T39.
- **Build 1** (live) into `data/curated/hbb` from the clean tree at 4b30c60; committed as 0826e68.
- **Build 2** (live) into a scratch directory from the clean tree at 0826e68; compared with build 1.
- **Against Phase 2:** the previous dataset (generator 0692bff) was kept in a scratch copy and compared with build 1, both with compare-builds and record by record with provenance, timestamps and hashes removed.
- A first attempt at build 2, made before build 1 was committed, recorded `gitDirty: true` (the uncommitted data counts as a dirty tree); it differed from build 1 only in that flag and was discarded. Build 2 above is the rerun after the commit.

## Raw results + uncertainty

From `data/curated/hbb/manifest.json`:

- **53 checks, 53 pass, 0 warnings, 0 failed** (Phase 2: 46). 14 files (Phase 2: 12). `generator.gitCommit` 4b30c608473822e7ef483bf9ddb0f4f5d4eb26b5, `gitDirty` false.
- **Sources:** Ensembl 116 (GRCh38.p14), UniProt 2026_03 (P68871 entry 219, sequence 2), PDB 2HBS revision 1.5 (2026-08-12), AlphaFold DB model v6, ClinVar Build261025-1250.1 (einfo), all unchanged in release since Phase 2.
- **ClinVar:** VCV000015333.**184** (Phase 2: .183), Pathogenic, "criteria provided, multiple submitters, no conflicts", 2 of 4 stars in ClinVar's review-status table, conflicting false; 75 supporting submissions (Phase 2: 74). T33: esearch rs334 returned 10 uids, esummary returned the same 10. T35: 9 other records, 8 haplotype records that include NC_000011.10:5227001:T:A with another variant, and 1 record of another allele (VCV000015175.3, Likely benign, NM_000518.4(HBB):c.20A>C (p.Glu7Ala)); none merged.
- **Full-chain mapping:** T36: 146 positions (2 to 147), 146 of 146 on each of B, D, F and H, 0 unobserved residues. T37: position 7 equals the HbS mapping record on all four chains. T38: atom_site residue = UniProt residue at 145 of 146 positions; differs at 7 only (UniProt E, structure VAL). T39: the entity sequence differs from UniProt at position 7 only, the same position the independent alignment reports.
- **Build 2 vs build 1:** 14 files; 2 byte-identical (`2HBS.cif`, `capabilities.json`); 219 allowed differences (retrieval and validation timestamps and the hashes of the records that embed them), including 1 raw-body hash explained by HGNC's `responseHeader.QTime`; 1 other difference: `generator.gitCommit` (4b30c60 vs 0826e68, same build code). compare-builds exits 1 because of that difference.
- **Against Phase 2:** every Phase 2 record is identical in content (provenance, timestamps and hashes removed) except `variant-hbs.json`: `clinvar.accessionVersion` VCV000015333.183 -> .184, `supportingSubmissionCount` 74 -> 75, and the evidence statement that quotes the version. `2HBS.cif` is byte-identical. Seven Ensembl raw bodies (assembly, gene lookup, transcript lookup, map/cds, variation, variant_recoder, VEP) have new sha256 values; the two compared field by field from the local cache (gene lookup, assembly) parse to identical JSON, so the difference is in bytes only (ordering or whitespace), not in content. The other five were not compared field by field.
- **Tests:** `npm test` 14 files (1 opt-in live file skipped), 181 tests: 177 pass, 4 live tests skipped by default; `npm run typecheck` clean.

## Failures

- The dirty-tree build 2 attempt (above): a procedure error, not a data problem.
- compare-builds exits 1 on the generator commit difference; the script has no rule for a different but code-equivalent commit. Not changed: the difference is explained here.

## Limits / confounders

- Two live builds two minutes apart cannot show drift on a longer scale; ClinVar's record version changed between Phase 2 (2026-11-01) and this build, which is the expected behaviour of a weekly-updated archive.
- Build time is dominated by the first Ensembl responses (56 s vs 4.5 s for the same requests two minutes later); not a property of the build code.
- The star level is ClinVar's published mapping as encoded in `packages/scientific-core/src/clinvar.ts`; a status ClinVar adds later gets null, not a guess.

## Interpretation

Supported: the extended build is reproducible from a commit that is on main, every Phase 2 check still passes, the new records pass their own checks, and the only content change to a Phase 2 record is ClinVar's newer record version. The stale pre-rewrite generator commit in the manifest is replaced.

## Decision

**Continue.** helix-app pins 0826e68.

## Artifacts

- `data/curated/hbb/` at 0826e68 (`manifest.json`, `clinvar-hbs.json`, `residue-mapping-P68871-2HBS.json`)
- `packages/scientific-core/src/slice/build.ts`, `src/clinvar.ts`, `src/structure-mapping.ts` (`mapUniprotChain`)
- Raw bodies: `.cache/helix-raw` (local, git-ignored; may contain third-party identifiers and is never published)
