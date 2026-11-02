<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# helix-app E2E and measurement results (public copy)

Raw result files from the private product repository `helix-app`, copied here so that every number in the journal and the report can be checked from the public repository (author's decision D-H007, 2026-11-02).

- **Source:** `helix-app/apps/web/e2e/results/` at helix-app commit a1cb0c7, all tracked files (19).
- **Added 2026-11-02 (D-H007 changes):** the three result files tagged `2026-11-02-dh007`, from helix-app commit 56d5578 (journal entry HX-P6-2026-11-02-start-world-dh007).
- **Added 2026-11-02 (one-world first answer, planning time, follow-up filter on the model path):** the three E2E files tagged `2026-11-02-oneworld` and the twelve `model-questions-2026-11-02-*.json` files (the E2E questions planned through the app's Director by `helix-app/scripts/model-questions.ts`), from helix-app commit 871699e (journal entries HX-P6-2026-11-02-planning-time, HX-P6-2026-11-02-one-world-first-answer, HX-P6-2026-11-02-followup-filter-model, HX-P6-2026-11-02-model-e2e-oneworld). No redaction was needed: they contain no absolute local path.
- **Added 2026-11-02 (D-H008, routing by cue words and the bridge to the protein):** the six E2E files tagged `2026-11-02-dh008` and `2026-11-02-dh008-model`, and `model-questions-2026-11-02-dh008.json`, from helix-app commit 020ab75 (build d9d8ded; journal entries HX-P6-2026-11-02-routing-dh008 and HX-P6-2026-11-02-model-e2e-dh008). No redaction was needed: they contain no absolute local path.
- **Note on stored prompts:** in the files from before 2026-11-02 oneworld, the `prompt` of run 1 was captured after the question, so its context shows the session after the answer, not the one the model saw (HX-P6-2026-11-02-planning-time).
- **Not copied:** `longframe-bridge-trace.json`, the raw Chrome performance trace (about 350 MB, git-ignored in helix-app too). Its summary, `longframe-bridge-trace-summary.json`, is here.
- **Changes:** none, except one redaction: in `longframe-bridge-2026-11-02.json` an absolute local path was shortened to start at `helix-app/`. `MANIFEST.tsv` gives the sha256 of each public copy and of the private original.
- **Where they are used:** the journal entries of 2026-11-02 (ai-to-world-e2e, cancellation, long-frame, dna-world-bridge, transitions, modes-rapid, long-frame-reprobe, vertical-slice-e2e) cite these files by their helix-app path; the file names are identical here.
- **Licence:** same as this repository. The files contain timings, scene read-backs and model plans produced by the Helix test harness; no third-party records.
