# HX-P10-2026-11-04-gate-evidence: frame timings, budgets and the benchmark plans replayed in the browser

```yaml
id:            HX-P10-2026-11-04-gate-evidence
date:          2026-11-04
phase:         P10 (P10.4.1 evidence; ROADMAP gate "benchmark questions trigger valid and coherent visual behaviour"; the frame sequence owed since Phase 8)
hypothesis:    (a) The Phase 10 build stays within the Phase 8 budgets. (b) Every Director-policy plan of the frozen benchmark executes in the real app without error, leaves the world the scorer expects, and shows on screen what its steps name; refusals leave the scene unchanged.
git_commit:    build of record helix-app 1e222b5 pinned to helix-research 6c6cfb7; harness and results helix-app af76ae8; implemented by a delegated agent on Opus 5.5 (medium effort), verified by the coordinator
config:        vite preview on port 5190; Chrome 156 headless; shipped-frames at dpr 1, dpr 2 and dpr 2 low power; budgets.mjs with the three frame files, and a low-power budgets run (3 repeats); replay of the 112 policy plans (repeat 0) through the app's Director validation and interpreter on the ?prompt=v7 dev page, with a local stand-in for the Ollama API returning the stored plan (the real model was not called)
seed:          n/a
data_version:  the five curated sets at helix-research 88e1626
hardware:      Apple M1 Pro; not fully quiet: two macOS system processes (mediaanalysisd, deleted) at about 65 % CPU each, not started by the session and left running
duration:      replay about 4.4 minutes; frames and budgets about 20 minutes
cost:          0
```

## Measurements

Results (mirrored with sha256 rows in `results/helix-app-e2e/MANIFEST.tsv`): `shipped-frames-p10-gate-{dpr1,dpr2,dpr2-power-low}.json`, `budgets-p10-gate.json`, `budgets-p10-gate-power-low.json`, `phase10-replay-p10-gate.json` and `.md`, `phase10-e2e-p10-gate.json`.

**Budgets:** 29 checks, 5 over budget; both budget runs exit 1.

| Breach | Value | Budget | Phase 8 |
|---|---|---|---|
| Idle frames, dpr 1 | 1 | 0 | 3 |
| Frames over 33.4 ms, dpr 2 | 1 (63.3 ms, one tour) | 0 | 0 |
| Idle frames, dpr 2 | 1 | 0 | 0 |
| Idle frames, dpr 2 low power | 3 | 0 | 1 |
| All assets gzip | 1,991.5 kB | 1,900 | 1,862.9 |

Every idle frame falls in the 2 s at rest in Protein World (the open Phase 8 item). The bundle grew 128.6 kB since Phase 8, mostly the dynamic-mode worker chunk (81 kB). Every other budget passes, with values within a few percent of Phase 8 (start, transfer, heap, structure round trips, scene chunk).

**Replay:** the plan selection matched the scorer's policy rows on all 112 units (102 model plans, 10 rule-based fallbacks); the app's Director accepted every stored plan as stored.

| Check | Result |
|---|---|
| Executed without an executor error | 109/112 |
| Step failures | 3 units, each `showPathway` on a membership whose participants the record does not keep (P10-CFTR-13 R-HSA-5678895; P10-BRCA1-06 and P10-FU-BRCA1/1 R-HSA-9709570) |
| World after, against the scorer | 1 mismatch (P10-CFTR-13 stays in DNA World) |
| Scene read-back of the named steps | 0 mismatches over 199 step checks, 15 action types |
| Refused and clarify plans | 26/26 left the scene unchanged |
| Console and page errors | 0 |
| axe, 16 sampled units | 0 violations |
| Stated state not reproducible | 11 units: a highlight with no selection, which the app cannot produce because a feature highlight also selects its focus residue; their plans ran without failure |

Unit tests 470 (exit 0), typecheck exit 0, Phase 10 suite exit 0.

## Interpretation

(a) does not hold: four frame checks and the asset total are over budget. The idle frames are the known Protein World item; the single long frame came under background system load and is not attributed. The asset total is a real growth, mostly dynamic mode. (b) holds for 109 of 112 units. The three failures expose a contract gap: the validator accepts `showPathway` on any membership the record lists, while the executor opens only the memberships whose participants the record keeps (the opening rule's candidates). One of the three, P10-CFTR-13, was scored correct and valid by the benchmark, so the plan-level score overstates what the app shows by one unit (three outputs). The 11 non-reproducible states are an oracle-versus-app difference in how a highlight relates to the selection, not a failure.

## Failures

The first replay failed four `selectTranscript` read-backs because the model names the transcript without its version while the app shows the versioned MANE transcript; the read-back was relaxed to compare unversioned ids and all 112 units were rerun. Both runs are kept in the app's results (the trial run untracked).
