# HX-P8-2026-11-03-final-build: the Phase 8 build of record, suites, model-backed scenarios, frame timings and budgets

```yaml
id:            HX-P8-2026-11-03-final-build
date:          2026-11-03
phase:         P8 (P8.5.1 gate measurements: P8.2.1, P8.2.2, P8.3.1, P8.3.2, P8.4.1 built)
hypothesis:    The Phase 8 build (level of detail, semantic zoom and scene labels in DNA World; Mol* lighting, the deferred Mol* scene and the carried findings in Protein World; the opt-in sound layer) keeps every Phase 4, 5 and 6 contract, the model-backed scenarios, 60 Hz with vsync on at pixel ratios 1 and 2 and in low power, 0 idle frames, and every Phase 8 budget, including the bytes before the first interaction that the baseline put over.
git_commit:    helix-app 5edeae4 (streams 90c9320, c44cf76, d96de84, 5edeae4 on 4c47a3a; the coordinator's d259c43); helix-research dfd6f48 (pin af104e2, consumed paths unchanged)
config:        production build served by vite preview on port 5190; rule-based suites run.mjs --only=fallback,follow-up,unsupported,cancel-camera, phase5.mjs --only=dna-render,bridge,transitions,interrupts, phase6.mjs --ollama-runs=0, phase8-camera.mjs, phase8-audio.mjs, shots-p8.mjs, shots-p8-protein.mjs, shots-p7.mjs, a11y.mjs; model-backed run.mjs --only=ollama,cancel-inference,stale, phase5.mjs --only=modes,rapid, phase6.mjs --only=blueprint-b,dh008-routing,dh010-routing --runs=3 --ollama-runs=3 (ministral-3:8b, temperature 0); shipped-frames.mjs --dpr=1 (vsync on and off), --dpr=2 (on and off), --dpr=2 --vsync=on --query=&power=low, 3 pages each; budgets.mjs --repeats=5 with the three frame files, then --repeats=3 --query=&power=low; tag p8-final; suite screenshots sent to a scratch folder, reviewed folders restored where a harness wrote into them
seed:          n/a (timing); model runs at temperature 0, 5 reference runs, 3 cancellations, 3 blueprint B and 3 neutral-question runs per planner
data_version:  curated HBB dataset at the pinned helix-research commit
hardware:      the development Mac (M1 Pro), headless Chrome 156.0.8078.80, viewport 1400x820; machine otherwise idle during the timings (no build, no other agent, Ollama idle between the model runs)
duration:      one sequence, about 75 minutes, 2026-11-03 afternoon local
cost:          0
```

## Method

Everything ran in one serial sequence on the final build after the three streams had committed and the coordinator had verified the merged tree (322 then 350 unit tests, typecheck, pin). Order: the nine rule-based suites, the model-backed scenarios of Phases 4, 5 and 6, the frame timings (the Phase 5 and 7 method: rAF intervals, R3F frame counts, the effects read-back after every move), then the budgets harness of HX-P8-2026-11-03-budgets-baseline. The budgets harness was rerun once after a fix that takes the structure file's resource timing from the idle prefetch when the cold switch does not fetch it; the rerun's files are the records.

## Results

### Suites (raw: helix-app `apps/web/e2e/results/*-p8-final*.json`, public copies in `journal/results/helix-app-e2e/`)

| Suite | Result |
|---|---|
| Phase 4 run.mjs (fallback 5 runs, follow-up, unsupported, cancel-camera) | pass, 0 failures |
| Phase 5 phase5.mjs (dna-render, bridge, transitions, interrupts) | pass, 0 failures (628 bases drawn, 0 mismatches; 1 WebGL context before Mol* is first needed, 2 after) |
| Phase 6 phase6.mjs --ollama-runs=0 (9 scenarios) | pass, 0 failures |
| Phase 8 phase8-camera.mjs (interrupt-pointer, interrupt-wheel, interrupt-escape, scales, labels-during-move, reduced-motion, journey) | pass, 0 failures: a drag took a flight over on its first move (pose jump 1.55 units of travel continuity, stop 61 ms after the last pointer event, 0 idle frames after, centre shift 0.841 against 0.850 expected), a wheel event set its goal relative to the frame's distance (32.47 against 32.50 expected) with continuous frame steps (2.3 before, 0.019 at the take-over, decaying after), Escape stopped a flight within 7 ms and 1 frame with 0 drift after; reduced motion: one frame per move |
| Phase 8 phase8-audio.mjs (opt-in, cues, off, reduced, world, a11y) | pass, 0 failures |
| Phase 8 shot passes shots-p8.mjs and shots-p8-protein.mjs | pass, 0 failures |
| Phase 7 shots-p7.mjs | pass, 0 failures |
| Accessibility a11y.mjs | pass, 0 axe violations on every audited screen; Escape closes Evidence World; kicker names in sentence case |

### Model-backed scenarios (ministral-3:8b, raw `*-p8-final-model*.json`)

| Scenario | Result |
|---|---|
| Reference question, 5 runs | executed 5/5, 0 fallbacks; provider 17,580 ms median (17,573 to 18,044); click to end 19,678 ms median (19,670 to 20,189); first token 111 ms median; planned to highlight drawn 1,941 ms median (the Mol* creation now sits inside the first structure load) |
| Cancel during inference, 3 runs | cancelled 3/3 (12 to 16 ms), no structure loaded, the next question executed with the model (17,556 to 17,580 ms) |
| Stale plans | a new question during inference discards the first; a click during inference rejects the stale plan (epoch 2 against 3) |
| Phase 5 modes and rapid | pass, 0 failures (guided, free, resume, the rapid bursts recover to one structure) |
| Blueprint B, 3 runs | first answer 19,648 to 20,028 ms, second 16,874 to 16,930 ms, model both times |
| D-H008 neutral question, 3 runs | answered by the model in DNA World, 18,423 to 18,575 ms |
| D-H010 molecule-name question | the model's plan rejected by the world-cue check, deterministic plan executed in Protein World, 24,279 ms wall (the known check-and-fallback cost, question 45); the DNA-plus-name question answered by the model in DNA World with the bridge chip first, 21,170 ms |

### Frame timings (raw: `shipped-frames-p8-final-dpr1.json`, `-dpr2.json`, `-dpr2-power-low.json`)

| Condition | vsync | tour | codon focus | 4 s drag | 2 s wheel | over 33.4 ms | idle at rest / after moves | idle in Protein World |
|---|---|---|---|---|---|---|---|---|
| dpr 1 | on | 16.7 / 17.9 to 18.4 / 18.8 to 21.2 | 16.7 / 18.2 to 18.4 | 16.7 / 19.8 to 20.6 | 16.7 / 17.9 to 18.6 | 0 of 4,608 | 0 / 0 | **1 frame on 3 of 3 pages** |
| dpr 1 | off | 2.8 to 2.9 / 3.7 to 3.8 | 2.3 to 2.5 / 3.1 to 3.2 | 0.2 / 19.6 to 20.4 | 2.6 / 3.1 | 0 | 0 / 0 | 0 |
| dpr 2 | on | 16.7 / 17.9 to 18.5 / 19.1 to 23.4 | 16.7 / 18.3 to 18.7 | 16.6 to 16.7 / 21.0 to 21.4 | 16.7 / 18.5 to 18.9 | 0 of 4,616 | 0 / 0 | 0 |
| dpr 2 | off | 5.2 to 5.3 / 6.1 | 5.3 / 7.0 to 7.1 | 0.2 / 19.1 to 20.9 | 5.5 / 7.1 to 7.3 | 0 | 0 / 0 | 0 |
| dpr 2, low power | on | 16.6 to 16.7 / 17.7 to 18.6 / 20.0 to 20.2 | 16.6 / 18.2 to 18.6 / max 25.0 | 16.7 to 16.8 / 18.7 to 20.3 | 16.6 to 16.7 / 18.3 to 18.9 | 0 of 4,605 | 0 / 0 | 1 frame on 1 of 3 pages |

Cells are median / p95 (/ max where it matters) in ms across the three pages. Effects: depth of field 1 and ratio 1.5 mid-tour at dpr 2 (1 at dpr 1, the screen ratio), 0 and the screen ratio at rest; low power renders without post-processing. The frames after the tour are the 0.2 s depth-of-field fade (11 per page with vsync on, 42 to 94 uncapped, 1 in low power where there is no fade).

### Budgets (raw: `budgets-p8-final.json`, `budgets-p8-final-power-low.json`)

| Metric | Budget | Final build, default | Final build, low power | Phase 7 baseline |
|---|---|---|---|---|
| Page load to scene ready | <= 1,000 ms | 165 ms (162 to 195, n = 5) | 162 ms (162 to 164, n = 3) | 673 ms |
| Welcome interactive | <= 1,200 ms | 171 ms | 169 ms | 681 ms |
| DNA World ready | <= 1,200 ms | 404 ms (398 to 462) | 310 ms | 682 ms |
| Bytes before scene ready | <= 1,000 kB | **677.7 kB** (24 resources: index 394.7, shell 68.9, stylesheet 9.6, wordmark 38.4, five fonts 123.7, manifest and 11 records 41.1) | 677.7 kB | 1,918.6 kB, over |
| Bytes at rest | <= 2,000 kB | 1,929.5 kB (the Mol* chunk 968.2 kB, its stylesheet, the colour chunk and 2HBS.cif 248.8 kB arrive at 171 ms, after ready) | 1,929.5 kB | 1,918.6 kB |
| JS heap at rest | <= 96 MB | 36.9 MB | 36.3 MB | 42.6 MB |
| World switch to Protein, cold (now including the Mol* creation) | <= 2,500 ms | 1,614 ms (1,605 to 1,616) | 1,595 ms | 1,708 ms |
| 2HBS fetch (idle prefetch) | <= 300 ms | 27 ms | 27 ms | n/a |
| World switch to Protein, warm | <= 1,600 ms | 1,285 ms (1,275 to 1,303) | 1,294 ms | 1,560 ms |
| World switch to DNA | <= 1,600 ms | 1,287 ms (1,274 to 1,305) | 1,291 ms | 1,484 ms |
| JS heap after the load; after 6 round trips | <= 256 MB; <= 10 % | 78.9 MB; 79.9 MB (+1.3 %) | 78.3; 79.4 MB (+1.4 %) | 78.4; 79.5 MB |
| Chrome process tree after the round trips | <= 1,500 MB | 868 MB (835 to 924) | 1,012 MB | 1,156 MB |
| Structures in Mol* after the round trips | 1 | 1 | 1 | 1 |
| Scene chunk; all assets (gzip) | <= 1,100; <= 1,900 kB | 967.9; 1,862.9 kB | same build | 967.5; 1,852 kB |
| Frames (section above) | section 2.2 of the budgets page | all ok except idle frames in Protein World | all ok except idle frames in Protein World | all ok |
| Page errors | 0 | 0 | 0 | 0 |

## Failures and negative results

- **One budget is over on the final build: idle frames.** With vsync on at pixel ratio 1, one R3F frame rendered during the 2 s at rest in Protein World on each of the three pages, and on one of the three low-power pages; none at pixel ratio 2, none with vsync off, none at rest in DNA World or after any move. The Phase 7 build measured 0 in the same window. One frame is not a loop (the budget is 0 because a loop would show as 120), and it appears only in timing-dependent conditions, which points at one deferred invalidation around the end of the last world switch (a flight settling, a label layout, the deferred-sweep mapper or the sound subscriber reading the frame) rather than at steady per-frame work. Not traced in this session; carried to the gate review as an open item with the raw files.
- The two long frames seen in low power on the Phase 7 build (63 and 35 ms) did not recur: 0 frames over 33.4 ms in 4,605 low-power frames, longest 25.0 ms. The carried item is closed as not reproduced on this build, not as explained.
- The warm world switch dropped from 1,560 to 1,285 ms and the DNA switch from 1,484 to 1,287 ms without being targeted: the flights of the semantic zoom settle sooner than the Phase 7 exponential ease after the stage restores the DNA camera. The cold switch dropped from 1,708 to 1,614 ms although it now includes the Mol* plugin creation, because the chunk and the structure file are already prefetched.
- The uncapped 4 s drag shows a 0.2 ms median because the renderer draws one frame per pointer move and the rAF sampler runs free between them; the vsync-on figure (16.7 ms median) is the one a visitor sees. Reported for completeness, not a change in cost.
- The shot and accessibility harnesses wrote their screenshots into reviewed Phase 5, 6 and 7 folders by default during the stream runs and the merge run; the files were restored from HEAD before any commit (methodology log, 2026-11-03). The Protein World shots of the Phase 8 review were regenerated by the final run on the build of record and kept.

## Interpretation

Every Phase 4, 5 and 6 contract and every model-backed scenario holds on the Phase 8 build, with the same read-backs and no fallback on the reference question. Frame budgets hold with the same margins as Phase 7 (uncapped tour p95 3.8 ms at ratio 1 and 6.1 ms at ratio 2 against 3.9 and 6.0 before: the level of detail, the labels, the fog and the sound subscriber added no measurable per-frame cost). The startup target set at the baseline is met: 677.7 kB before the first interaction against 1,918.6 kB, scene ready at 165 ms against 673 ms, with the cold world switch still faster than before. The one open number is a single idle frame in Protein World under two of five timing conditions.

## Decision

Phase 8 build verified by the coordinator; the gate review (helix-app `docs/reviews/phase-8.md`) goes to the author with the idle-frame item, the author questions 50 to 63 and the visual QA shots. Carried forward: trace the Protein World idle frame; the VoiceOver pass; Safari and Firefox (Phase 11).

## Artifacts

helix-app `apps/web/e2e/results/*-p8-final*.json` (suites, model runs, frames, budgets), `docs/reviews/phase-8-dna-world.md`, `phase-8-protein-world.md`, `phase-8-audio.md`, `phase-8.md`; public copies and MANIFEST rows in `journal/results/helix-app-e2e/`.
