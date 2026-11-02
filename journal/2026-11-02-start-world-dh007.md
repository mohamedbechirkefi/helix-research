<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HX-P6-2026-11-02-start-world-dh007: start-time cost of DNA World, the every-visit welcome and the follow-up filter in the running app

```yaml
id:            HX-P6-2026-11-02-start-world-dh007
date:          2026-11-02
hypothesis:    After the author's decision D-H007 (welcome on every visit, start in DNA World, filtered
               follow-up suggestions): (1) the app opens in DNA World, and the cost of starting there,
               measured in Phase 5 as about +0.73 s on the reference question against the Phase 4
               Protein World start, is unchanged; (2) the welcome opens on every visit and stores
               nothing; (3) no next-branch question offered in the page fails the follow-up filter, the
               rule-based planner's suggestions survive it, and no other Phase 4, 5 or 6 behaviour
               regresses. Contradicted by a start in another world, a welcome missing on a later visit
               or a stored welcome key, an offered question with clinical wording, or any E2E failure.
git_commit:    helix-app 56d5578 (private repository; public copy of the result files in
               `journal/results/helix-app-e2e/`); helix-research packages and data pinned at 6b8791e
               (follow-up filter `helix-followup-filter-v1`, packages/ai-planning/src/followups.ts)
config:        helix-app apps/web/e2e/phase6.mjs (all scenarios, --ollama-runs=0, new scenario
               welcome-every-visit); apps/web/e2e/run.mjs --only=fallback,follow-up,unsupported,cancel-camera;
               apps/web/e2e/phase5.mjs --only=dna-render,bridge,transitions,interrupts; all with
               --tag=2026-11-02-dh007, fade 700 ms, camera 700 ms
seeds:         n/a (rule-based planner, no sampling); 5 reference runs, 5 transition runs, 3 blueprint B
               runs, 1 run of each other case, each in a fresh browser context
data_version:  data/curated/hbb at 6b8791e (unchanged since 0826e68)
hardware:      Apple M1 Pro, 16 GB, macOS 15.3.1; Chrome 156.0.8078.74 headless, ANGLE Metal, vsync on
duration:      about 12 minutes for the three suites (not timed separately)
cost:          0
llm:           none. Every question was planned by the rule-based planner; blueprint B's model runs were
               skipped (--ollama-runs=0) and blueprint F points the page at an unreachable address. The
               local Ollama server was running but received no planning request (the page's provider
               detection reads its version and model list only).
```

## Methods

- **Start world and its cost.** The Phase 4 reference question ("Show me where the sickle-cell mutation affects hemoglobin."), rule-based planner, 5 runs, each in a fresh context opened with the welcome closed (`?welcome=off`), so the question starts in DNA World and its plan brings Protein World on screen. The time from the question to the first Mol* draw after the verified highlight is read in the page (`askToHighlightDrawnMs`), as in Phase 4, 5 and 6. Blueprint A records the world before the visitor's choice (store, stage and `__helixApp.startWorld()`) and the time from the gene choice to the settled first chapter.
- **Welcome.** New scenario `welcome-every-visit`: the plain page (no welcome parameter) is opened, then loaded again twice in the same browser context (same storage). On each visit: welcome open and visible, journey not started, start world, `localStorage` keys; then "Skip and explore freely" and the same read-back.
- **Follow-ups.** Blueprint A (now with the rule-based planner selected, so the next-branch click calls no model) records the next-branch chips before and after a question, with their `data-source`, and the director's `followUpScreen`. Blueprint E records the chips with the structure-limited fixture.
- **Regression.** The rest of the Phase 6 suite and the model-free scenarios of the Phase 4 and Phase 5 suites, unchanged except for the checks named above.

## Raw results + uncertainty

All three suites passed with 0 failures: `helix-app/apps/web/e2e/results/phase6-e2e-2026-11-02-dh007.json`, `e2e-2026-11-02-dh007-fallback+follow-up+unsupported+cancel-camera.json`, `phase5-e2e-2026-11-02-dh007-dna-render+bridge+transitions+interrupts.json`.

| Reference question, rule-based, question to highlight drawn (n = 5) | Median | Min to max | File |
|---|---|---|---|
| Phase 4 (start in Protein World) | 1,060.9 ms | 1,057.3 to 1,091.6 | `e2e-2026-11-02.json` |
| Phase 5 (start in DNA World) | 1,791.1 ms | 1,757.2 to 1,808.9 | `e2e-2026-11-02-p5reg.json` |
| Phase 6 | 1,810.1 ms | 1,777.1 to 1,844.5 | `e2e-2026-11-02-p6reg.json` |
| **D-H007 build** | **1,775.9 ms** | **1,760.1 to 1,791.7** | `e2e-2026-11-02-dh007-...json` |

- The start in DNA World costs **+715.0 ms** on this question against Phase 4 (Phase 5 measured +730.2 ms). Question to structure drawn: median 946.8 ms (Phase 4: 235.0 ms); click to end: median 1,827 ms. The cost is the 700 ms fade into Protein World before the load, as found in Phase 5.
- Page load to scene ready (fresh context, cold HTTP cache): 545 to 560 ms, median 548 ms (n = 5).
- Blueprint A: start world `dna` ("DNA World is the start world (D-H007) and its data are present", nothing passed over); store and stage both in DNA World with the welcome open; gene choice to settled first chapter (transcript, DNA World) 1,720 ms (n = 1; Phase 6: 1,731 ms).
- Transitions (n = 5): cold DNA to Protein 1,754.3 ms, warm 716.5 ms, to DNA 717.0 ms (Phase 6: 1,758.3, 718.5, 712.8); longest frame during a fade 25.3 ms (Phase 6: 23.6 ms). Blueprint B, rule-based (n = 3): first question 1,824 ms, follow-up 780 ms (Phase 6: 1,833 and 775).
- Welcome: open and visible on visits 1, 2 and 3 of the same profile, journey not started, world `dna`; `localStorage` empty before and after each skip; skip closed it each time.
- Follow-ups: before any question the four supported questions are offered (all `supported`). After the next-branch question, the rule-based plan's two suggestions passed the filter (`variant-sequence`, `selection-contact`) and are offered first (`plan`), then two supported questions; the supported DNA question was not offered because it plans the same scene as the plan's codon question (unit-tested), and the question just asked is not repeated. With the fixture: two offers, the DNA change and the evidence; no crystal or 3D question.

## Failures

- None in the final runs. During development, two intermediate runs of the same suites (before the same-scene duplicate rule and before a limitations text change) also passed; their result files were overwritten by the final runs with the same tag, and their timings were within the ranges above (reference question median 1,776.5 and 1,806.9 ms).
- A sweep of the filter over every follow-up suggestion recorded in earlier runs (816 distinct strings from the Phase 3 benchmark runs and the Phase 4 to 6 E2E results, screened in the context after the reference answer) showed the first version too permissive: French suggestions, "How does X affect the structure?", "other variants" and structure-metadata questions passed. The blocklists were tightened and English is required; on the final version 64 of 816 pass (dropped: 486 scope, 179 clinical, 41 format, 41 capability, 5 ungrounded), all of them asking to locate the variant, show its contacts, the selected residue, the DNA change or the experimental structure, and none clinical. The sweep was a development check, not kept as a file.

## Limits / confounders

- One machine, headless Chrome; n = 5 for the reference question and transitions, n = 1 for blueprint A.
- The model path was not exercised: whether ministral-3:8b's suggestions now produce useful chips, and how often all of them are dropped, is not measured here. A timing investigation on Ollama follows this entry (D-H007 item 14), so the machine was kept free of model runs.
- The fallback to Protein World when DNA World's data are missing is tested at the engine level only (journey-engine unit tests); the controller still needs a transcript record to start.
- The filter is a fixed vocabulary (blocklists) plus the rule-based planner (allowlist). A clinical question worded without any listed term and phrased like a supported command would pass; the planner would then answer it with the matching scene, never with clinical text.

## Interpretation

Supported: the app opens in DNA World, the welcome opens on every visit and stores nothing, the start-world cost is the same as in Phase 5 (about +0.72 s on the reference question), and the offered next questions all pass the follow-up filter, with no regression in the model-free Phase 4, 5 and 6 scenarios.

## Decision

**Continue.** Unit tests: helix-research 218 pass, 4 live skipped (41 for the filter); helix-app 121 pass (110 before).

## Artifacts

- `helix-app/apps/web/e2e/results/phase6-e2e-2026-11-02-dh007.json`, `e2e-2026-11-02-dh007-fallback+follow-up+unsupported+cancel-camera.json`, `phase5-e2e-2026-11-02-dh007-dna-render+bridge+transitions+interrupts.json` (private repository; public copies in `journal/results/helix-app-e2e/`)
- `helix-app/docs/reviews/phase-6-shots/welcome-every-visit.jpg` and the updated Phase 6 shots
- `packages/ai-planning/src/followups.ts`, `packages/ai-planning/test/followups.test.ts`
