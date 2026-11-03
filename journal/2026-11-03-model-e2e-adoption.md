<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HX-P7-2026-11-03-model-e2e-adoption: the model-backed E2E scenarios on the design-system build (bridge sequence in the shipped flow, prompt v5 kept)

```yaml
id:            HX-P7-2026-11-03-model-e2e-adoption
date:          2026-11-03
hypothesis:    On the build of record helix-app 12025d0 (design-system adoption P7.3.1, the bridge
               sequence in the shipped flow D-H013 with its trigger narrowed to the scene, prompt v5 kept
               after D-H011), the model-backed scenarios (Phase 4 ollama, cancel-inference, stale; Phase 5
               modes, rapid; Phase 6 blueprint B, dh008-routing, dh010-routing) pass with no page error;
               the bridge sequence plays after the dh008 neutral chip and adds about 3.3 s of wall time to
               that step (as the rule-based suites measured, HX-P7-2026-11-03-phase7-adoption-frame-timing);
               the dh010 molecule-name question goes through the world-cue check and the rule-based fallback
               as on the D-H010 build; model planning times on the shared scenarios stay within about 1 s of
               HX-P7-2026-11-02-model-e2e-dh010. Contradicted by a failed check, a page error, or a
               planning time off by more than run-to-run variation.
git_commit:    helix-app 12025d0 (build of record; tree clean; check:pin OK against helix-research af104e2,
               consumed paths unchanged at 4bc60e1); results and journal in the commits that carry them
               (private repository; public copies of the result files in `journal/results/helix-app-e2e/`)
config:        production build (npm run web:build at 12025d0) served by vite preview on port 5190 (started
               and stopped for these runs); fade and camera 700 ms; screenshots to docs/reviews/dh011-shots
               (HELIX_SHOTS, HELIX_P5_SHOTS, HELIX_P6_SHOTS; reviewed shot folders untouched). Suites, in
               one sequence: e2e/run.mjs --only=ollama,cancel-inference,stale; e2e/phase5.mjs
               --only=modes,rapid; e2e/phase6.mjs --only=blueprint-b,dh008-routing,dh010-routing --runs=3
               --ollama-runs=3; tag 2026-11-03-dh011-model. Nothing in the suites or the app was changed
               for these runs.
seeds:         temperature 0; 5 reference runs, 3 cancellations, 3 blueprint B runs and 3 neutral-question
               runs per planner, 1 run of the other cases, each in a fresh browser context
data_version:  data/curated/hbb unchanged since 0826e68 (pinned at af104e2)
hardware:      Apple M1 Pro, 16 GB, macOS 15.3.1; Chrome 156.0.8078.80 headless, ANGLE Metal; load average
               2.3 to 2.7 at the start (uptime); the other session's browser work had ended
duration:      01:05:41 to 01:17:26 local time (Phase 4 suite 3.6 min, Phase 5 1.5 min, Phase 6 6.6 min); build
               01:05, preview started 01:05 and stopped 01:18
cost:          0
llm:
  provider:       local Ollama 0.40.6 (server already running; not started or stopped here)
  model_id:       ministral-3:8b (digest 1922accd5827)
  call_date:      2026-11-03 (01:05 onward, local time)
  params:         temperature 0, num_ctx 8192, num_predict 1024, keep_alive 60m, plan JSON schema v2;
                  prompt helix-plan-prompt-v5 (the app kept v5: HX-P7-2026-11-02-routing-dh011)
  prompts:        run 1 of the reference question (scenarios.ollama.runs[0].prompt), of the blueprint B
                  follow-up, of the neutral question (scenarios.dh008-routing.ollama.neutral[0].prompt)
                  and of the molecule-name question (scenarios.dh010-routing.ollama.molecule.prompt),
                  captured before the question
  responses:      every plan in the result files
  attempt_count:  Phase 4 suite 5 reference + 3 cancelled + 3 after cancel + 2 stale; Phase 5 suite
                  1 modes + 1 rapid; Phase 6 blueprint B 6 (3 first, 3 follow-up); dh008-routing 3
                  neutral + 3 bridge + 1 protein-cue + 1 DNA-cue; dh010-routing 1 molecule-name +
                  1 DNA-cue-and-name; no retries
```

## Methods

The suites of HX-P7-2026-11-02-model-e2e-dh010, unchanged (scenario wordings differ from the benchmark and held-out items), run once in sequence on the build of record so that the model is never asked two questions at once. What differs from that entry is the build: the shipped UI now uses the design system (P7.3.1), and a plan that moves from a DNA-World variant scene to Protein World (the bridge chip, any variant plan reaching the protein, a journey chapter; never the world switcher) first plays the four-station record chain (autoplay about 2.8 s, then a 400 ms hold) before the DNA to Protein transition (D-H013). The suites' read-back contract is unchanged; the bridge's wall time is the measure that must move. Characterisation before the run: the rule-based suites of HX-P7-2026-11-03-phase7-adoption-frame-timing (run ds2) measured the rule-based neutral question's bridge at 5,081 to 5,141 ms wall against 1,832 to 1,872 ms on the D-H010 build (phase6-e2e-2026-11-02-dh010.json), a difference of about 3.3 s. The model-backed figures below are compared with the D-H010 build (phase6-e2e-2026-11-02-dh010-model.json and the Phase 4 and 5 files of that tag).

## Raw results + uncertainty

All three suites PASS with 0 failures and no page error (`failures: []` in each file; Chrome 156.0.8078.80). The D-H010 build column is HX-P7-2026-11-02-model-e2e-dh010 (its result files of tag 2026-11-02-dh010; the suites and the prompt are the same, only the build differs).

| Scenario | Build of record 12025d0 (this entry) | D-H010 build (ff45388) |
|---|---|---|
| Reference question, model (n = 5) | loadStructure, focusCamera, highlightResidue; 5/5 from the model, 0 fallbacks; provider median 17,765 ms (17,678 to 18,168); ask to highlight drawn median 19,645 ms (19,577 to 20,044); planned to highlight drawn 1,873 ms; first token 127 ms | 17,691 ms; 19,523 ms; 1,836 ms; 115 ms |
| Inference cancel (n = 3) | cancel latency 29 to 36 ms, no structure after cancel; next question from the model 17,552 to 17,656 ms | 15 to 30 ms; 17,574 to 17,828 ms |
| Stale | a newer question discarded the first (stale-discarded; the second executed from the model); a residue click during inference rejected the arriving plan ("stale plan: made for session epoch 2, the session is now at epoch 3", provider 17,564 ms) | same outcomes; 17,550 ms |
| Modes, model and rule-based | the ten steps as before (guided start, next, next, explore-free, asked, resume "Resume journey at chapter 3", next, back, revisit-1, implicit-free); the free-mode question executed from the model; owner never both during a transition (1,822 samples) | same outcomes |
| Rapid (a) to (f) | same outcomes; (e) the model's reference plan (18,049 ms) rejected as stale after the codon 1 click, DNA World, 0 structures | (e) 18,023 ms |
| Blueprint B, model (n = 3) | first question from the model 3/3, wall median 19,831 ms (19,468 to 19,869); follow-up from the model 3/3, wall median 16,870 ms; 0 fallbacks; GAG to GTG, codon 7 marked | 19,832 and 16,963 ms |
| Blueprint B, rule-based (n = 3) | first 1,834 ms, follow-up 788 ms (medians) | 1,828 and 771 ms |
| **dh008 neutral question, model (n = 3)** | DNA World only, GAG to GTG, codon 7; provider 18,340 to 18,491 ms; first chip the bridge 3/3; **bridge to Protein World 20,388 to 20,480 ms wall** with provider 16,012 to 16,056 ms, so 4.4 s of wall beyond the model (the bridge sequence, the fade and the camera) against 1.15 s before; VAL B6, D6, F6, H6 read back | provider 18,510 to 18,706 ms; bridge 17,317 to 17,325 ms wall with provider 16,167 to 16,184 ms |
| **dh008 neutral question, rule-based (n = 3)** | DNA World; bridge first 3/3; **bridge to Protein World 5,067 to 5,128 ms wall** (1,829 to 1,837 ms before: +3.3 s, the sequence); same read-back | 1,829 to 1,837 ms |
| dh008 protein cue / DNA cue, model | Protein World, 19,735 ms wall (provider 17,830) / DNA World, 22,075 ms wall (provider 21,302), bridge first after the DNA answer | 19,875 / 22,267 ms |
| dh008 protein cue / DNA cue, rule-based | 1,878 ms / 785 ms | 1,824 / 777 ms |
| dh010 molecule name in DNA World, model | the model planned DNA World (provider 21,579 ms); rejected by the check (world-cue protein<dna); the rule-based plan executed: Protein World, VAL B6, D6, F6, H6, no bridge chip; 23,481 ms wall. **No bridge sequence played** (the trigger is a DNA-World variant scene; this question is asked before any variant scene is on screen) | 21,714 ms; 23,566 ms wall |
| dh010 molecule name, rule-based | same plan, 1,889 ms wall (no sequence) | 1,825 ms |
| dh010 DNA cue and name in Protein World, model | from the model: DNA World (provider 20,409 ms, 21,231 ms wall); bridge first | 20,502 / 21,263 ms |
| dh010 DNA cue and name, rule-based | DNA World, bridge first, 781 ms | 780 ms |
| Welcome gene choice HBB | journey on the transcript chapter, DNA World, 0 structures, 0 planner questions | same |

**Bridge sequence timings observed.** The sequence shows only where a plan leaves a DNA-World variant scene for the protein, that is on the dh008 bridge chip (both planners) and on the guided variant-codon to variant-residue chapter step of the modes scenario (not timed by that suite). Its cost is the difference between the bridge chip's wall time and what the same step cost on the D-H010 build with the same provider time: rule-based 5,067 to 5,128 ms against 1,829 to 1,837 ms (+3,238 to +3,291 ms); model path 20,388 to 20,480 ms against 17,317 to 17,325 ms with provider times 150 ms shorter (+3,071 to +3,155 ms of wall, +3.2 to +3.3 s once the provider difference is removed). This matches the design (autoplay about 2.8 s then a 400 ms hold) and the rule-based characterisation of HX-P7-2026-11-03-phase7-adoption-frame-timing (run ds2: 5,081 to 5,141 ms). Every other model-backed step is within 0.2 s of the D-H010 build.

Screenshots: `helix-app/docs/reviews/dh011-shots/` (19 files: the reference answer, stale rejection, free-mode question and resumed chapter for both planners, rapid burst, blueprint B first and second for both planners, dh008 neutral bridge chip and bridge protein for both planners, dh008 protein cue, dh010 molecule name for both planners, dh010 welcome gene choice).

## Failures

None. No suite needed a wait adjusted: the bridge sequence (about 3.3 s) fits the existing waits, and no contract was touched. As on the benchmark (HX-P7-2026-11-02-routing-dh011) and on the D-H010 build, the model itself answered the molecule-name question in DNA World with prompt v5; the world-cue check caught it and the rule-based plan answered (23.5 s in total, n = 1).

## Limits / confounders

- One machine, headless Chrome, few runs; n = 1 for the D-H010 cases and the stale and rapid cases.
- The model's plans are compared across builds whose prompt and context are identical (v5, D-H010 lists); any planning-time difference is machine load, not the build.

## Interpretation

Supported: on the build of record every model-backed scenario passes, the bridge sequence plays after the dh008 neutral chip at a cost of about 3.3 s of wall time on that step for both planners (as the rule-based suites measured), it does not play on the dh010 molecule-name path (no variant scene is on screen first, by the narrowed trigger), the dh010 question goes through the check-and-fallback path exactly as on the D-H010 build, and the model planning times on the shared scenarios are within 0.2 s of that build (the reference question 17,765 against 17,691 ms, the neutral question 18.3 to 18.5 against 18.5 to 18.7 s, the bridge's own provider time 16.0 against 16.2 s).

## Decision

Continue; nothing to change. The design-system build with the bridge sequence is the build of record for the model-backed scenarios. Unit tests at the time of the runs: helix-research 287 pass (4 live skipped); helix-app 257 pass (the tree then carried the other session's uncommitted concept-prototype edits, not part of 12025d0). For the author: the visitor who takes the bridge chip now waits the model's planning time plus the 3.3 s sequence plus the transition; whether the sequence should start while the model is still planning (the chain's text needs no plan) is a design question, not measured here.

## Artifacts

- `helix-app/apps/web/e2e/results/e2e-2026-11-03-dh011-model-ollama+cancel-inference+stale.json`, `phase5-e2e-2026-11-03-dh011-model-modes+rapid.json`, `phase6-e2e-2026-11-03-dh011-model.json` (private repository; public copies in `journal/results/helix-app-e2e/`, sha256 in MANIFEST.tsv; no path needed shortening)
- `helix-app/docs/reviews/dh011-shots/` (19 screenshots)
- Compared with: `e2e-2026-11-02-dh010-ollama+cancel-inference+stale.json`, `phase5-e2e-2026-11-02-dh010-modes+rapid.json`, `phase6-e2e-2026-11-02-dh010-model.json` (HX-P7-2026-11-02-model-e2e-dh010) and `phase6-e2e-2026-11-03-ds2.json` (HX-P7-2026-11-03-phase7-adoption-frame-timing)
