# HX-P11-2026-11-10-carried-2: the idle frame at rest (not reproduced), C14 bloom and Sound control, S19 no-LLM suite

```yaml
id:            HX-P11-2026-11-10-carried-2
date:          2026-11-10
phase:         P11 (budget "idle frames at rest" 0; carried item C14; S19 and task P11.1.2 of docs/phase-11-release-qa.md)
hypothesis:    (idle) The baseline's one idle frame at rest comes from something that completes late on a fresh browser (asset, font, environment map, texture upload, shader compile). (C14a) The near-white highlights at the overview are satin reflections over the bloom threshold. (C14b) Moving the Sound control into the design system changes neither behaviour nor accessibility. (S19) With no model at all, every supported question of every curated set is answered by the rules and no request reaches Ollama.
git_commit:    helix-app 38c0bf7 to 2d852dd (harness 6ffa6d9; pins e39ab2f, 7ae8f9a; changes e5c5f9e, e0ea650; suite 9118a79; review 2d852dd), pinned unchanged to helix-research c045aed; built by a delegated agent on Opus 5.5, medium effort; verified by the coordinator
config:        shipped-frames.mjs at dpr 1 vsync on with the new --fresh-browser=1 (a new browser and empty profile per page) and --rest-only=1, with and without --trace-idle=1 --loaf=1; specular-bloom.mjs (pixels whose smallest channel is at least 235 on the DNA canvas at the overview, dpr 1 and 2); shipped-frames at dpr 1, dpr 2, dpr 2 low power (3 pages each) then budgets.mjs --frames-only; nollm.mjs on a static host and on a development page with every Ollama request failed by interception
seed:          none
data_version:  the five curated sets and the dynamic fixtures at helix-research c045aed, unchanged
hardware:      Apple M1 Pro, the development Mac, Chrome 157.0.8103.40 headless; frame runs with nothing else running from the pass; the author's editor and the coordinating session open
duration:      the agent's pass about 74 minutes; the coordinator's reruns about 20 minutes
cost:          0
```

## Measurements

Raw results in helix-app `apps/web/e2e/results/*p11c2*`; the review is helix-app `docs/reviews/phase-11-carried-2.md`.

**Idle frame at rest.** 60 cold pages (10 full pages traced, 20 rest-only traced, 30 rest-only untraced): 0 idle frames at rest, 0 frame requests in the rest window on the 30 traced pages, no resource or font completing in the window, the Mol* prefetch ended about 600 ms after navigation. Not reproduced, not attributed; no pin, no fix; the budget stays 0. The record is now 1 idle frame at rest in 225 pages since Phase 8, on the same page as the baseline's 141.8 ms tour frame.

**C14 (a).** Pin: 2 near-white pixels at dpr 1 (smallest channel 253) and 98 at dpr 2. Cause by elimination: a one-pixel specular highlight of the anisotropic brushed-metal tube, not a satin reflection (satin, metal, joint and knurl roughness, clearcoat and key gain had no effect; only anisotropy 0 removed it, adding 9 other pixels). Fix: the lit non-amber materials clamp their output at a new token `scene.bloom.surfaceCap` 0.9, under the 0.95 bloom threshold. After: 0 near-white pixels at both ratios (brightest 222).

**C14 (b).** The Sound control is the design system's `SoundToggle`; the Phase 8 audio suite passes before and after with byte-identical toggle shots; a11y exit 0.

**Frames after both changes** (3 pages each, vsync on; `budgets.mjs --frames-only` exit 0, 12 of 12): median 16.8 ms in every condition; 0 frames over 33.4 ms; longest 25.2 ms (dpr 1), 23.2 ms (dpr 2), 22.2 ms (dpr 2 low power); 0 idle frames.

**S19.** 30 of 30 supported and bridge questions answered and executed by the rules on each host (HBB, CFTR, BRCA1, SLC6A3 six plus a bridge each, FAAH2 two); 0 Ollama requests attempted on the static host; on the development page 33 version probes, all refused in the browser, 0 reaching Ollama, 0 chat requests; 14 of 14 noLlm budget checks. Gene search: 20 of 20 symbols and aliases as expected, an unknown symbol refused with the live offer, TP53 built from recorded responses. Finding: gene names ("hemoglobin subunit beta" and the four others) do not resolve; the visitor is asked for a symbol. Observation: the Pathway World layer covers the world switcher for a mouse user.

## Coordinator verification

Rerun on 2d852dd, each by exit code: unit tests (541 passed), typecheck, check:pin, web:build, nollm.mjs (0 failures, 0 budgets over), specular-bloom.mjs (0 failures), phase8-audio.mjs, a11y.mjs, the Phase 9 and Phase 10 suites, the held-out split replay: all exit 0. The agent also ran layout.mjs and the Phase 10 replay (exit 0). No tracked shot was rewritten. The coordinator's cleanup of its own result files also deleted three untracked result files of the 2026-11-09 Phase 10 close verification (`e2e-p10-verify.json`, `phase10-e2e-p10-verify.json`, `phase5-e2e-p10-verify.json`); they were never committed or cited, and their outcome (exit 0) is recorded in the workspace STATUS of that day.

## Interpretation

The idle-frame hypothesis is not supported: nothing late on a cold profile asks for a frame at rest. The single occurrence remains unexplained and is read, without measurement, as a page-level event. The C14 (a) hypothesis was wrong about the material; the fix holds by the pixel count and the frame budgets. C14 (b) and S19 hold. The 0.9 cap, the 235 threshold and S19's counting rules are the agent's choices, stated in the review.

## Failures

The C14 (a) cause first named in Phase 8 (satin) was wrong. The deletion of three untracked result files (above).
