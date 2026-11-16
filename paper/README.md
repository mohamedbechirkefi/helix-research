<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# Helix report and article

This folder holds the written outputs of the Helix research phase. They are drafted as the work happens, never after it (workspace decision D-053, Helix decision D-H006).

## Files

| File | What | Status |
|---|---|---|
| `report.en.md` | Detailed technical report, English. The working master. | Version 1.0 (2026-11-16): Phases 0 to 12 and the publication (9.10), with eight figures; published (release v1.0-report) |
| `report.fr.md` | Full French copy of the report | Copy of version 1.0 (2026-11-16); parity check clean (`scripts/report/check_fr_parity.py`); links rechecked (`journal/results/link-check-2026-11-16-v1.tsv`) |
| `claims.md` | Claims register: every claim in the report and article, with its evidence | Live (C01 to C203) |
| `article.en.md`, `article.fr.md` | Short article made from the report | Version 1.0 (2026-11-16), EN and FR, claims a subset of the register; published with the report |
| `figures/` | The figures: four architecture diagrams (copies of `docs/showcase/diagrams/`) and four frames of the demo recording (`scripts/report/video_frames.mjs`) | Version 1.0 |
| `build/` | The PDFs, built by `scripts/report/build_pdf.py` | Version 1.0; only the PDFs are committed |
| `release-checklist.md` | What was checked before the release | Version 1.0 |

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
7. **Publishing is the author's decision.** Releasing the report, the article or a preprint is gate G-PUBLIC. Nothing in this folder is published without the author's instruction. Version 1.0 was published on the author's instruction of 2026-11-16.
8. **AI-use declaration.** Both versions carry the declaration in the report's AI-use chapter, based on the research workspace's `docs/methodology.md`.

## Style

Formal register, no em dashes, readable tables that break cleanly, clickable links in the bibliography, and every number with its source.

## Building the PDFs

From the repository root, with the tools of the Helix workspace (`../.tools/pandoc`, pandoc 3.6.3; `../.tools/pyreport`, a Python venv with typst 0.15.0 and pypdf 6.20.0):

```sh
../.tools/pyreport/bin/python -I scripts/report/build_pdf.py all all
python3 -I scripts/report/check_fr_parity.py paper/report.en.md paper/report.fr.md
python3 -I scripts/report/check_fr_parity.py paper/article.en.md paper/article.fr.md
```

The fonts are macOS system fonts (New York, Menlo).
