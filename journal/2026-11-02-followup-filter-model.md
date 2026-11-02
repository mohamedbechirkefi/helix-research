<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HX-P6-2026-11-02-followup-filter-model: the follow-up filter on ministral-3:8b's suggestions

```yaml
id:            HX-P6-2026-11-02-followup-filter-model
date:          2026-11-02
hypothesis:    With the shipped configuration (prompt v3, one-world check), the follow-up filter
               helix-followup-filter-v1 keeps at least one useful model suggestion after most model
               answers, and keeps no clinical one. Contradicted if it drops almost every model
               suggestion or keeps a clinical one.
git_commit:    helix-research c7b2385 (filter unchanged since 6b8791e); helix-app 9efc210
config:        the E2E question set planned through the app's Director (helix-app
               scripts/model-questions.ts --mode d-h007, 3 runs); the filter runs inside the Director
               (screenPlanFollowUps) in the context the user is in after the plan
seeds:         temperature 0
data_version:  data/curated/hbb at 6b8791e
hardware:      Apple M1 Pro, 16 GB, macOS 15.3.1
duration:      the question-set run of HX-P6-2026-11-02-one-world-first-answer (no extra model calls)
cost:          0
llm:           same calls as HX-P6-2026-11-02-one-world-first-answer, file
               helix-app/apps/web/e2e/results/model-questions-2026-11-02-v3-final.json (rows[].followUpScreen,
               rows[].raw); provider local Ollama 0.40.6, model ministral-3:8b, 2026-11-02, temperature 0,
               num_ctx 8192, num_predict 1024; prompts in the file; 27 calls + 1 warm-up, no retries
```

## Methods

Every plan the model returned (fallback plans excluded) carries up to 3 `followUps`; the Director screens them with the filter (format, clinical, scope, grounded, capability) and keeps only those that pass. The verdicts (`followUpScreen.verdicts`: kept, reason, detail) were counted per call and per distinct text. The filter was not changed. For comparison, the same count on the "before" (prompt v2) and first-draft v3 runs.

## Raw results + uncertainty

Shipped configuration (v3-final): 24 model answers (27 calls minus the 3 fallbacks), 18 of them with suggestions; the 3 runs of each question gave identical suggestions:

| | Suggestions screened | Kept | Dropped: scope | capability | clinical | format, ungrounded |
|---|---|---|---|---|---|---|
| Per call (54) | 54 | 3 (5.6%) | 30 | 18 | 3 | 0 |
| Distinct texts (18) | 18 | 1 | 10 | 6 | 1 | 0 |

- Kept: "Can you show the location of this mutation on the protein structure?" (after the codon question; rule variant-locate). Nothing kept after the reference question, the compare follow-up, the residue question, the contacts follow-up or the gene question.
- Dropped as scope (examples): "What amino acid change does this mutation cause?" (term "cause"), "How does this mutation affect hemoglobin's structure?" ("affect"), "What is the effect of this amino acid change on hemoglobin function?" ("effect"), "What variants are associated with HBB?" ("variants").
- Dropped as capability (no rule of the deterministic planner answers them): "Can you show the DNA sequence change as well?", "Can you show the DNA sequence change alongside the protein change?", "Can you show the 3D position of these interacting residues?", "What amino acids are involved in this interaction?", "What is the protein sequence of HBB?", "Show me the transcript of HBB.".
- Dropped as clinical: "What are the clinical implications of this variant?".
- Before the change (prompt v2): 6 of 54 kept (2 distinct: "Can you show the molecular interactions involving this residue?", "Can you show the location of this mutation on the protein 3D structure?"); first v3 draft: 3 of 45.
- No clinical suggestion was kept in any configuration.

## Failures

None in the run. The filter drops almost all model suggestions; recorded as the result, not changed (the brief forbids loosening it).

## Limits / confounders

- 9 questions with reconstructed sessions; in the app, the offered chips also include the app's supported questions, which pass the same filter, so a chip row still appears after a model answer (blueprint A); only the model's own suggestions are counted here.
- Some dropped suggestions look harmless and answerable by the app ("Can you show the DNA sequence change as well?" asks for what the compare action shows); they fail the capability allowlist because no deterministic rule matches their wording.

## Interpretation

Contradicted: on the model path the filter keeps 1 of 18 distinct suggestions (3 of 54 shown), so the model rarely contributes a chip; the chips users see after a model answer are almost always the app's own supported questions. Safety holds: no clinical suggestion passes.

## Decision

Filter unchanged. For the author: accept that model suggestions are mostly dropped, or widen the capability rules (for example a rule for "show the DNA sequence change"), or stop asking the model for suggestions (about 43 to 50 generated tokens, 2 s per answer, journal HX-P6-2026-11-02-planning-time).

## Artifacts

- `helix-app/apps/web/e2e/results/model-questions-2026-11-02-v3-final.json`, `-before-v2.json`, `-v3-oneworld.json` (private repository; public copies in `journal/results/helix-app-e2e/`)
- `packages/ai-planning/src/followups.ts` (unchanged)
