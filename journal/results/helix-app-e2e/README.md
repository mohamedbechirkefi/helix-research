<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# helix-app E2E and measurement results (public copy)

Raw result files from the private product repository `helix-app`, copied here so that every number in the journal and the report can be checked from the public repository (author's decision D-H007, 2026-11-02).

- **Source:** `helix-app/apps/web/e2e/results/` at helix-app commit a1cb0c7, all tracked files (19).
- **Added 2026-11-02 (D-H007 changes):** the three result files tagged `2026-11-02-dh007`, from helix-app commit 56d5578 (journal entry HX-P6-2026-11-02-start-world-dh007).
- **Not copied:** `longframe-bridge-trace.json`, the raw Chrome performance trace (about 350 MB, git-ignored in helix-app too). Its summary, `longframe-bridge-trace-summary.json`, is here.
- **Changes:** none, except one redaction: in `longframe-bridge-2026-11-02.json` an absolute local path was shortened to start at `helix-app/`. `MANIFEST.tsv` gives the sha256 of each public copy and of the private original.
- **Where they are used:** the journal entries of 2026-11-02 (ai-to-world-e2e, cancellation, long-frame, dna-world-bridge, transitions, modes-rapid, long-frame-reprobe, vertical-slice-e2e) cite these files by their helix-app path; the file names are identical here.
- **Licence:** same as this repository. The files contain timings, scene read-backs and model plans produced by the Helix test harness; no third-party records.
