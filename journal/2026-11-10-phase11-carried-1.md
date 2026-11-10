# HX-P11-2026-11-10-carried-1: codon-tape accessibility names, rules version 3 (C6), dynamic sets in S29 (C11), Mol*'s emphasis label (C12)

```yaml
id:            HX-P11-2026-11-10-carried-1
date:          2026-11-10
phase:         P11 (P11.2.1 and carried items C6, C11, C12 of docs/phase-11-release-qa.md; author decisions D-H034 axe budget 0, D-H035)
hypothesis:    (P11.2.1) The label-content-name-mismatch violations come from the codon buttons' aria-label; naming the buttons by their content removes them without losing any word of the name. (C6) Refusing the domain answer when the loaded structure observes none of the domains changes only P10H-BRCA1-08 on both frozen sets. (C11, C12) The dynamic-set notes and Mol*'s in-scene label overlap other panels; each is fixed without new overlaps.
git_commit:    helix-app 8bf853b to 38c0bf7 (pins 0576ea2, 609ea82, 5571156; changes e9c734f, d6ccb4e, 005a310, 33157ce; review de7cf69; allowlist entry 38c0bf7), pinned unchanged to helix-research c045aed; built by a delegated agent on Opus 5.5, medium effort; verified by the coordinator
config:        layout.mjs (S29) with and without --axe=1 at every default viewport, with --dynamic=tp53,apoe on recorded fixtures (no live API); rules score: node scripts/rules-score.ts on the frozen Phase 10 set (112 units) and the frozen held-out set (58 units), 3 repeats, split policy, prompt v8, rules only, rules version 2 (8bf853b) against version 3 (e9c734f); both replays with e2e/replay-allowlist.json
seed:          none (temperature 0 where a model is called; only the Phase 4 suite called Ollama)
data_version:  the five curated sets and the dynamic fixtures at helix-research c045aed, unchanged
hardware:      Apple M1 Pro, the development Mac; no timing or budget suite run
duration:      the agent's pass about 86 minutes; the coordinator's reruns about 25 minutes
cost:          0
```

## Integrity

The frozen Phase 10 and held-out hashes were checked by `rules-score.ts` before and after each scoring pass and matched. helix-research was read, never written, by the build. The rules change lives in the app's Director (`withStructureCoverage`); the helix-research planner is unchanged.

## Measurements

Raw results in helix-app `apps/web/e2e/results/*p11c*`, `layout-p11-carried-axe-pin-before.json` and `docs/reviews/phase-11-carried-1/`; the review is helix-app `docs/reviews/phase-11-carried-1.md`.

**P11.2.1.** Pin on 8bf853b: 56 `label-content-name-mismatch` violations on 45 screens (the 15 of HX-P11-2026-11-10-new-budgets were three widths only). Cause, read with axe's own functions in the page: a codon button scrolled out of the tape window and straddling the stage's clipped edge exposes only part of its letters ("TT 14" against the name "TTG 14, codon 14, Leu"); the earlier "edge fade" reading was wrong. After (buttons named by their content, the rest of the name as visually hidden text): 0 violations on 245 screens. Chrome's computed name gains a space before the comma ("TTG 14 , codon 14, Leu").

**C6.** Rules scores, rules 2 then rules 3:

| Set | Correct and valid | Outcome match | World match | Safe (scorer) | Refusal where expected | Injection held |
|---|---|---|---|---|---|---|
| Frozen Phase 10 (336) | 273, 273 | 273, 273 | 315, 315 | 327, 327 | 36/42, 36/42 | 36/36, 36/36 |
| Frozen held-out (174) | 96, 96 | 99, 99 | 156, 156 | 162, **165** | 9/12, 9/12 | 18/18, 18/18 |

Only P10H-BRCA1-08 changed (3 outputs): from the domain answer on 1JM7 (observes positions 1 to 103; BRCT at 1642 to 1855) to a refusal (rule `domains-not-on-structure`). It stays not correct: the oracle expects an answer.

**Held-out split replay.** With the old entry removed, exit 1 on P10H-BRCA1-08 only (route and final plan differ from the stored row; 0 read-back mismatches on 58 units). After D-H035 listed it (kinds route, final-plan), exit 0.

**C11.** Pin: at 1440 x 860 the two "not available" notes of a dynamic set overlap the tour plate (1,248 px2) on 6 screens. After (the plate moves to the bottom left when both notes show): 0.

**C12.** The suite reads Mol*'s projected label box from Mol*'s render objects and camera (matches the shots within about 10 px). Pin: the label meets the caption on 11 screens and the welcome on 4. After (text size 0.26 to 0.16, attached beside the residue with Mol*'s tether, hidden under the welcome and on viewports under 1160 px): 0 of 120 screens fail.

## Coordinator verification

Rerun on 33157ce plus the allowlist entry, each read by exit code: unit tests (539 passed), typecheck, check:pin, web:build, `layout.mjs --axe=1` (0 violations, 0 failing on 245 screens), `a11y.mjs`, `hidden-canvas.mjs`, the Phase 10 replay (P10-CFTR-13 and 19 as listed) and the held-out split replay (P10H-BRCA1-08 as listed): all exit 0. The agent also ran the Phase 4, 9 and 10 suites (exit 0). The a11y suite rewrote tracked Phase 7 shots and the Phase 4 suite tracked Phase 4 and 5 shots; restored with `git checkout`. A diff scan found no local path or address and no em dash.

## Interpretation

All four hypotheses hold on this machine. The C6 fix is partial by design: it changes the rules' answer only. Under the split the model is still called for this question, and a model plan showing domains on an uncovered structure would still pass validation (the claim screen happened to reject it here). helix-research's held-out harness does not pass the structure coverage, so it would still answer with rules 2 (the same kind of gap as C5). The C12 label reader depends on Mol* 5.13.1 internals; the 1160 px cut-off was the agent's choice, kept by the author (D-H035).

## Failures

The held-out replay exits 1 until the allowlist entry (above). The 15-violation count of the previous entry was an undercount (three widths).
