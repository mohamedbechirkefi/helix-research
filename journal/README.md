<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# Experiment journal

This folder is the experiment and measurement journal of the Helix research phase. It exists so that every number and every claim in the technical report (`paper/report.en.md`) and in the article can be traced to the run that produced it (workspace decision D-053, Helix decision D-H006).

## Rules

- **One entry per experiment or measurement**, negative results included. A failed run, a wrong model answer or a finding that contradicts a plan is recorded, not omitted.
- **File name:** `YYYY-MM-DD-<slug>.md`, dated on the day of the run.
- **Entry id:** `HX-P<phase>-YYYY-MM-DD-<slug>`. The report and `paper/claims.md` cite entries by this id.
- **Structure:** the fields and sections of the research workspace template `templates/experiment.md`: id, date, hypothesis, git commit, configuration, seeds, data version, hardware, duration, cost, then Methods, Raw results and uncertainty, Failures, Limits and confounders, Interpretation, Decision and Artifacts. Every call to a language model also records provider, exact model id, call date, parameters, the exact prompts, the responses and the attempt count.
- **Unknown values** are written `not recorded`. Nothing is estimated after the fact.
- **No personal data.** No email address or other personal identifier appears in an entry, a command line or a URL.
- **Raw results stay where the experiment wrote them** (`research/raw/`, `research/experiments/*/results/`, `data/curated/`). An entry points to them; it does not copy them.

## Retrospective entries

The entries dated 2026-11-01 for Phases 1 and 2 were written on the same day from the recorded evidence (raw manifests, experiment READMEs and result files, the dataset manifest and git history), after the work and not during it. Each carries the line "Retrospective entry written 2026-11-01 from the recorded evidence; not contemporaneous." From Phase 3 on, entries are written when the run happens.

## Index

| Id | File | Phase task |
|---|---|---|
| HX-P1-2026-11-01-raw-snapshot | `2026-11-01-raw-snapshot.md` | P1.1.3, P1.3.1, P1.8.1 |
| HX-P1-2026-11-01-hbs-mapping | `2026-11-01-hbs-mapping.md` | P1.1.3 |
| HX-P1-2026-11-01-val6-contacts | `2026-11-01-val6-contacts.md` | P1.1.3 |
| HX-P1-2026-11-01-cors | `2026-11-01-cors.md` | P1.3.1 |
| HX-P1-2026-11-01-molstar-embed | `2026-11-01-molstar-embed.md` | P1.4.1 |
| HX-P1-2026-11-01-molstar-r3f-bridge | `2026-11-01-molstar-r3f-bridge.md` | P1.4.2, P1.4.3 |
| HX-P1-2026-11-01-tauri-shell | `2026-11-01-tauri-shell.md` | P1.5.2 |
| HX-P2-2026-11-01-hbb-dataset-build | `2026-11-01-hbb-dataset-build.md` | P2.5.1 to P2.5.3 |
| HX-P3-2026-11-01-ai-benchmark-ollama | `2026-11-01-ai-benchmark-ollama.md` | P3.1.1 to P3.2.4, P3.3.1, P3.3.2 |
| HX-P3-2026-11-01-webllm-browser | `2026-11-01-webllm-browser.md` | P3.2.2 |
| HX-P4-2026-11-02-ai-to-world-e2e | `2026-11-02-ai-to-world-e2e.md` | P4.2.3, P4.2.4, P4.3.1 |
| HX-P4-2026-11-02-cancellation | `2026-11-02-cancellation.md` | P4.3.2 |
| HX-P4-2026-11-02-long-frame | `2026-11-02-long-frame.md` | P1.4.2 carry-over (claim C19) |
| HX-P5-2026-11-02-dna-world-bridge | `2026-11-02-dna-world-bridge.md` | P5.2.1, P5.2.2 |
| HX-P5-2026-11-02-transitions | `2026-11-02-transitions.md` | P5.3.1 (and the Phase 4 suite as regression) |
| HX-P5-2026-11-02-modes-rapid | `2026-11-02-modes-rapid.md` | P5.3.2, P5.3.3 |
| HX-P5-2026-11-02-long-frame-reprobe | `2026-11-02-long-frame-reprobe.md` | carried from HX-P4-2026-11-02-long-frame (claims C19, C48) |
