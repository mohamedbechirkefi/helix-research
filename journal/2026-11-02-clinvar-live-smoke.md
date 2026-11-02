<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HX-P6-2026-11-02-clinvar-live-smoke: opt-in live smoke tests, including ClinVar rs334

```yaml
id:            HX-P6-2026-11-02-clinvar-live-smoke
date:          2026-11-02
hypothesis:    The live APIs still return the identities the adapters expect: Ensembl ENSG00000244734,
               UniProt P68871, RCSB 2HBS with SIFTS, and (new in Phase 6) ClinVar esearch rs334 returning
               uid 15333 whose esummary is the single-nucleotide HbS record with SPDI
               NC_000011.10:5227001:T:A and a review status. Contradicted by any of these failing.
git_commit:    helix-research 0826e68
config:        npm run test:live (HELIX_LIVE=1 vitest run live), packages/data-adapters/test/live.test.ts
seeds:         n/a; one run
data_version:  live APIs at 2026-11-02T02:49:27Z
hardware:      Apple M1 Pro, 16 GB, macOS 15.3.1; Node v22.23.3
duration:      5.27 s (vitest)
cost:          0
```

## Methods

One run of the four opt-in live tests, each calling the real API once with User-Agent "helix-research"; the ClinVar test checks that no URL carries an email parameter.

## Raw results + uncertainty

4 of 4 passed (Ensembl, UniProt, RCSB and SIFTS, ClinVar). Vitest reports identity checks only; versions are not asserted (drift is reported by the build, HX-P6-2026-11-02-hbb-rebuild).

## Failures

None.

## Limits / confounders

One run; identity checks, not content checks. The fixture tests cover parsing on recorded bodies.

## Interpretation

The ClinVar path used by the Phase 6 build works live.

## Decision

**Continue.**

## Artifacts

- `packages/data-adapters/test/live.test.ts`
