<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# Helix report and article

This folder holds the written outputs of the Helix research phase. They are drafted as the work happens, never after it (workspace decision D-053, Helix decision D-H006).

## Files

| File | What | Status |
|---|---|---|
| `report.en.md` | Detailed technical report, English. The working master. | Drafted for Phases 0 to 2; later chapters are headed placeholders |
| `report.fr.md` | Full French copy of the report | First copy made 2026-11-02 from English draft 0.3 (quality approved by the author 2026-11-02); second copy made 2026-11-02 from English draft 0.6 (after Phase 6), parity check clean, links rechecked (`journal/results/link-check-2026-11-02-fr06.tsv`); author review of the new sections pending; next copy is the final version |
| `claims.md` | Claims register: every claim in the report and article, with its evidence | Live |
| `article.en.md`, `article.fr.md` | Short article made from the frozen report | Not started (after Phase 11) |

## Rules

1. **No row, no claim.** Every claim in the report or the article has a row in `claims.md`, with a journal id from `../journal/` and a file path. A claim without evidence is removed or reworded until the evidence supports it.
2. **No untraceable numbers.** Every figure links to a journal entry or a raw result file.
3. **Negative results are reported.** Failed runs, wrong model answers and findings that contradict a plan appear in the report, not only the successes.
4. **One section per phase.** A phase is not closed until its report section is drafted here. Each phase gate review checks this.
5. **Bilingual.**
   - English is the master.
   - A full French copy, `report.fr.md`, is produced at three milestones: after Phase 4 (AI-to-World proof), after Phase 6 (complete HBB vertical slice), and the final version.
   - The two versions carry identical numbers and claims. The check is a diff of every number and every claim id between them.
   - Neither version is distributed without the other.
6. **Article.** `article.en.md` and `article.fr.md` are written from the frozen report. Their claims are a subset of the register.
7. **Publishing is the author's decision.** Releasing the report, the article or a preprint is gate G-PUBLIC. Nothing in this folder is published by an automated session.
8. **AI-use declaration.** Both versions carry the declaration in the report's AI-use chapter, based on the research workspace's `docs/methodology.md`.

## Style

Formal register, no em dashes, readable tables that break cleanly, clickable links in the bibliography, and every number with its source.
