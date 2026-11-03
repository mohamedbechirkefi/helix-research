# HX-P8-2026-11-03-idle-frame-trace: tracing the one idle frame in Protein World (Phase 8 open item)

```yaml
id:            HX-P8-2026-11-03-idle-frame-trace
date:          2026-11-03
phase:         P8 (open item of the gate, HX-P8-2026-11-03-final-build; closed out before Phase 9 on D-H018)
hypothesis:    The single DNA World frame counted during the two seconds at rest in Protein World (1 on 3 of 3 pages at pixel ratio 1 with vsync on, 1 of 3 low-power pages, 0 at ratio 2 and uncapped) comes from one identifiable invalidation; recording the caller of every requestAnimationFrame scheduled in that window names it.
git_commit:    helix-app 6cebe35 (chrome polish) for the probes and the traced run; the gate record was on 5edeae4
config:        production build on vite preview port 5190; four hand-written probes (dev server on 5195, then the production build) that replay the world round trip with a requestAnimationFrame wrapper recording caller stacks, with the frame harness's own settled condition; then shipped-frames.mjs --repeats=3 --vsync=on --dpr=1 --trace-idle=1 (the new flag) on the production build, tag idle-trace
seed:          n/a
data_version:  curated HBB dataset at the pinned helix-research commit
hardware:      the development Mac (M1 Pro), headless Chrome 156; a dev server and the preview running beside the trace (a trace, not a timing of record)
duration:      about 40 minutes
cost:          0
```

## What the measurement counts

`idleFramesInProteinWorld` is the DNA World rig's frame counter (`__helixDna.frames()`) read twice, two seconds apart, after the warm switch to Protein World has ended and the stage, the rig and the request have settled. A count of 1 means the hidden DNA scene (React Three Fiber on demand) rendered one frame while Protein World was shown.

## Runs

| Run | Condition | Idle DNA frames in Protein World | Frames scheduled from outside the render loop |
|---|---|---|---|
| probe, dev server | nav end plus 300 ms (before the rig settled) | 13 | 0 (all from the loop: the fade tail still running) |
| probe, dev server | rig settled plus 250 ms, 3 rounds | 0, 0, 0 | 0 |
| probe, production | rig settled plus 250 ms, 3 rounds | 0, 0, 0 | 0 |
| probe, production | the harness's own settled condition, 4 rounds | 0, 0, 0, 0 | 0 |
| shipped-frames.mjs with the trace, production | the full page sequence (rest, tour, codon focus, drag, wheel, round trip), 3 pages, ratio 1, vsync on | 0, 0, 0 | 0 DNA frames; on page 3 Mol*'s own render loop ticked at 16.6 ms (`Canvas3D` frame, not the DNA scene) |

## Interpretation

The idle frame did not recur on the polished build in 13 settled windows, including three full harness pages under the condition where the gate record showed it on every page. It is therefore not a steady invalidation (a timer, a subscriber, a label pass): those would have reproduced. What remains plausible is a frame scheduled by the DNA scene's own fade tail landing just after the settled condition became true, which the gate run's timing allowed and this run's did not; the trace flag now records the caller if it appears again. The frame harness keeps the budget at 0 and the flag off by default (a stack capture per frame would colour the timings).

The trace also showed that Mol* runs its own continuous animation loop while Protein World is shown (one `requestAnimationFrame` per display frame from its `Canvas3D`); Mol* draws only when something changed, so this is a tick, not a render, and the JS heap growth over six round trips (1.3 %) says it holds nothing. It is recorded here because it is the only loop alive in that window.

## Failures

The first harness edit declared a variable twice (`t0`) and failed to parse; fixed and rerun. None in the runs.
