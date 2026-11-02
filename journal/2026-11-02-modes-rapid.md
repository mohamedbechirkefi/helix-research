<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HX-P5-2026-11-02-modes-rapid: guided and free modes with resume (blueprint D), rapid interaction (blueprint G)

```yaml
id:            HX-P5-2026-11-02-modes-rapid
date:          2026-11-02
hypothesis:    (D) A user can follow the guided journey, leave it, orbit, select a residue, ask about it,
               see the scene change, inspect the sources, and resume the narrative at the chapter left,
               which comes back with its verified scene. (G) Changing the selection or the gene in the
               middle of a world transition or of model inference never lets the obsolete action reach
               the scene: the final state follows the last input, the shown world is the store's world,
               and Mol*'s emphasis equals the store's. Contradicted by any of these failing.
git_commit:    helix-app 4962491 (private repository); helix-research packages and data pinned at a13c1ec
config:        helix-app apps/web/e2e/phase5.mjs scenarios modes and rapid (--tag=2026-11-02)
seeds:         n/a (temperature 0); one run per case, each in a fresh browser context
data_version:  data/curated/hbb at a13c1ec
hardware:      Apple M1 Pro, 16 GB, macOS 15.3.1; Chrome 156.0.8078.74 headless, ANGLE Metal
duration:      not recorded separately
cost:          0
llm:
  provider:       local Ollama 0.40.6 (user-space), http://127.0.0.1:11434, /api/chat with streaming
  model_id:       ministral-3:8b
  call_date:      2026-11-02
  params:         as in HX-P4-2026-11-02-ai-to-world-e2e (temperature 0, num_ctx 8192, num_predict 1024,
                  generic plan JSON schema)
  prompts:        helix-plan-prompt-v1 over the context restricted to the Phase 5 build (DNA and Protein
                  worlds available), with the user's selection; the exact messages of these calls were not
                  stored
  responses:      the validated plan of the modes call is stored (scenarios.modes.ollama.steps[asked].plan);
                  the two rapid calls returned plans that were rejected as stale or discarded, outcomes stored
  attempt_count:  3 calls (1 in modes, 2 in rapid), no retries
```

## Methods

- **Modes, once with the deterministic planner and once with ministral-3:8b:** start (guided, chapter 1, DNA World); Next to chapter 2 (codon 7) and chapter 3 (the mapped residue in Protein World); "Explore freely"; drag on the Mol* canvas (orbit); aim at VAL H6 and click the canvas centre (selection); ask "Why is this residue important?"; open every evidence card's provenance; "Resume journey at chapter 3"; Next (chapter 4), Back (chapter 3), the chapter 1 button (revisit); then a click on codon 3 in guided mode.
- **Rapid:** (a) codon 1 clicked 800 ms into a cold DNA -> Protein transition (fade 3,000 ms), then the switch again; (b) four reversals DNA/Protein within 1 s, twice; (c) eight codon clicks, a switch, three more clicks, a switch; (d) "Where does CFTR F508del occur?" asked 600 ms into a transition; (e) codon 1 clicked 1.5 s into ministral-3:8b planning the reference question; (f) the CFTR question asked (deterministic) 1.5 s into that planning. After each, a consistency check: shown world = store world, pointer owner of that world, Mol* read-back = store highlight, a highlight never with an unmapped selection, store structure iff Mol* has one.

## Raw results + uncertainty

From `helix-app/apps/web/e2e/results/phase5-e2e-2026-11-02.json` (passed, 0 failures):

- **Modes, both planners:** every step was as expected: guided at chapters 1, 2, 3; free after "Explore freely" with resume index 2; the orbit moved the Mol* camera 31.9 A; the click picked VAL H6; the question executed and Mol* read back VAL H6; 20 (deterministic) and 21 (model) provenance links, all https; resume brought back chapter 3 with VAL B6, D6, F6, H6 read back and focus H6, codon 7 selected; chapter 4 read back H6 and chain B 70, 73, 84, 85, 88; Back and the chapter 1 revisit worked; the codon 3 click left guided mode with resume index 0.
- **Plans for the question:** deterministic: focusCamera, highlightResidue (selection), revealEvidence ClinVar, 820 ms wall. ministral-3:8b: highlightResidue (selection), then revealEvidence ClinVar, UniProt VAR_002863 and the H6 contacts record, no focus, validated, 27,987 ms wall.
- **Rapid:** (a) navigation cancelled "the scene changed under the request (epoch 2 -> 3)"; DNA World, codon 1, no structure, no emphasis; the next switch was a bare loadStructure with no emphasis. (b) ended in DNA World, then in Protein World with VAL B6, D6, F6, H6 read back. (c) final state: Protein World, codon 7, read-back VAL B6, D6, F6, H6. (d) navigation cancelled "superseded by request q1"; answer `unsupported` ("CFTR is not in the curated records available here; only HBB is."); DNA World, no structure. (e) the model's plan (planning 15,790 ms) was rejected "stale plan: made for session epoch 1, the session is now at epoch 2"; codon 1 kept, no structure. (f) the first request was discarded (stale, cancelled), the second answered `unsupported`; no structure. All consistency checks held; no page error.

## Failures

- **A defect found by the first development run of (e)** (not kept as a file; console output): the reference plan made by the model before the user clicked codon 1 still executed, and its highlight replaced the user's codon 1 selection with codon 7. Cause: the DNA selection was not a subject field, and codon 1 maps to no structure residue, so the session epoch did not move. Fix (in 4962491): `sequenceSelection` is a subject field; the bridge's mirror of a structure selection is a `derived` commit that does not move the epoch. Rerun: (e) rejected as stale, as reported above.
- The same development work found that a codon click during a transition was impossible because the codon strip was hidden as soon as the transition started; it now stays until DNA World is left.

## Limits / confounders

- One run per case, one machine; timing of the mid-transition and mid-inference inputs is fixed (800 ms, 600 ms, 1.5 s).
- Only one gene is curated, so "changing the gene" is a question about an uncurated gene, answered without a scene change.
- The model's follow-up suggestions (not executed) included a clinical-sounding question; they are not shown as claims, but Phase 6 should check where suggestions appear.

## Interpretation

Supported within this perimeter: blueprint D works end to end with both planners, and in every rapid case the obsolete action was cancelled or rejected before it reached the scene, with the final state following the last input.

## Decision

**Continue.**

## Artifacts

- `helix-app/apps/web/e2e/results/phase5-e2e-2026-11-02.json` (private repository), scenarios `modes`, `rapid`
- `helix-app/docs/reviews/phase-5-shots/free-mode-question-fallback.jpg`, `free-mode-question-ollama.jpg`, `resumed-chapter3-fallback.jpg`, `resumed-chapter3-ollama.jpg`, `rapid-burst-final.jpg`
