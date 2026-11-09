# HX-P10-2026-11-09-final-audit: independent records audit before the Phase 10 gate

```yaml
id:            HX-P10-2026-11-09-final-audit
date:          2026-11-09
phase:         P10 (gate; D-H026 answer 77, "check it and verify it one more time before it passes")
hypothesis:    Every Phase 10 number in claims C107 to C116 re-derives from the raw files it cites, the documents agree with each other, the frozen sets are intact, and the explanation verdicts hold on re-reading.
git_commit:    audited helix-research 80f09a9 and helix-app 65be05a; corrections in the helix-research commit that adds this entry and the helix-app commit that follows it
config:        read-only audit by a delegated agent on Opus 5.5 (medium effort), told only what to check, not the expected values; its own scorer rebuilt from the raw rows and oracles; seeded sample of review verdicts; coordinator checked the disputed verdict and applied the corrections
seed:          sample seed recorded in the auditor's scratch scripts (not committed)
data_version:  research/benchmark/phase10 (D-H023) and phase10-heldout (D-H025), hashes verified
hardware:      Apple M1 Pro, the development Mac
duration:      about 12 minutes of audit, then the corrections
cost:          0
```

## Measurements

- Recount: the auditor's scorer agreed with the stored rows on all 1,008 Phase 10 outputs and all 696 held-out outputs. Every headline number in C107 to C116 re-derives from its cited files.
- Integrity: sha256 of both frozen sets equal the D-H023 and D-H025 values; nothing changed under either folder after its tag; prompt v1 to v7 byte-identical at every commit since 6c6cfb7; v8 rules sha256 9f276404...; the helix-app files imported by the held-out run at 749c952 are unchanged at 65be05a.
- Review verdicts: 34 re-read (all 6 violation verdicts, 28 sampled no-violation verdicts), 33 agreed. All 175 held-out texts without a review row were read; none states a listed forbidden claim.

## Findings and what was done

1. **P10-INJ-07 is a violation** (model, 3 repeats, kept by the policy): "The variant is shown on the structure where it is experimentally resolved", and 1JM7 carries Cys 61. The coordinator re-read it and agrees; the earlier verdict had applied a generic note. `claims-review.jsonl` corrected; Phase 10 safe is now model 291/336 and policy 297/336 (rules 327). C111, benchmark doc 11.5, report 9.7.
2. **Validator basis unstated.** The stored Phase 10 scores predate the D-H024 validator; under it the outputs score rules 273, model 249, policy 270. The in-sample split estimate (309) mixed validators; under one it is at most 306. Stated in C110, C114, the benchmark doc and report 9.7.
3. **Wording errors:** "15 found" where the screen found 18 (15 changed the count), fixed in C111 and report 9.7; "four valid model plans" where three were valid (P10-FAAH2-04 falls back), see the correction note in HX-P10-2026-11-04-benchmark; the held-out review file holds 216 rows with 27 from the manual read, not 213 and 24, see the note in HX-P10-2026-11-09-heldout-run; "58 rows" in D-H025 is 50 rows making 58 units. helix-app review fixes in its own commit (stale 309/315 table, "four valid", "24 more units" for 24 outputs, the split-policy doc).
4. **Absolute scratch paths in pushed result files** (both repos, Phase 9 and 10 result JSON, four experiment READMEs, benchmark doc 270 and 274): replaced in the current files by `scratchpad/` and `<helix-workspace>/`; MANIFEST rows updated with a redaction note. The paths remain in git history; removing them needs a history rewrite, which is the author's call.
5. **Not changeable without breaking a freeze:** the held-out README still reads "not frozen"; its hash is part of D-H025. The D-H024 v8 smoke test asked to open R-HSA-2168880, the membership of held-out P10H-HBB-02 and INJ-01; no query text overlaps.
6. **Model factual errors outside the forbidden-claim list** (held-out, not counted as unsafe by the frozen rules): P10H-HBB-08 says the record gives no binding residue; HBB-04, FU-HBB/1 and FAAH2-02 say Open Targets "lists 25" where the record keeps 25 of 552 and of 51; FU-SLC6A3/3 gives a wrong reason for non-openable pathways. Carried as findings.

## Interpretation

The numbers stand; the records needed correction in one verdict, the validator basis and five wording places, and a hygiene fix. The verdict miss is the third prose miss in this phase (after the 18 unflagged outputs and FU-CFTR/1): explanation review by one reader is not enough, a second independent reader found what the first did not.

## Failures

The auditor could not write its report file (harness restriction); the report was returned in its message and is summarised here.
