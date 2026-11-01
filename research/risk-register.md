<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# Risk register (P1.7.1)

**Status:** first version, 2026-11-01, for roadmap task P1.7.1. It gathers the risks found so far in this repository's documents, in `PROGRESS.md` and in the Phase 1 experiments, and assigns each to the roadmap task that addresses it. It is reviewed at every phase gate. A closed risk stays in the table with its closing evidence.

## Scales and owners

**Likelihood** (before mitigation):

- **H:** expected, or already happened once.
- **M:** plausible.
- **L:** unlikely.

**Impact:**

- **H:** a wrong scientific claim shown to users, a privacy or licence breach, or a phase gate blocked.
- **M:** rework of a component or a degraded experience.
- **L:** cosmetic or local.

**Owners:**

- **Author:** Mohamed Bechir Kefi, for decisions, gates and verdicts.
- **Agent:** the implementing agent of the named task.

Task IDs are from `helix/ROADMAP.md`.

## 1. Scientific

| ID | Risk | L | I | Owner | Mitigation | Task | Source |
|---|---|---|---|---|---|---|---|
| S1 | Residue numbering confusion: legacy "Glu6" (mature numbering) against HGVS p.Glu7Val | H | H | Agent | Mapping tests (UniProt 7 ↔ mature 6 ↔ 2HBS 6); the UI shows both conventions with an explanation | P2.4.4 (done), P6.3.1, P11.3.1 | `docs/competitor-analysis.md` R7; `research/hbs-mapping-note.md` |
| S2 | The mmCIF's own `_struct_ref_seq` uses mature numbering and would select the wrong residue (label 7 GLU) | M | H | Agent | SIFTS is the mapping of record; check T25 records the disagreement | P2.4.5 (done) | `docs/data-core.md`; `PROGRESS.md` §B |
| S3 | The Mol* default preset loads assembly 1 (chains A to D), so chain H and the HbS contact vanish | H | H | Agent | `loadStructure` carries `assembly: 'model' \| id`; load the asymmetric unit when the evidence is there | P4.1.1, P4.2.2 | `docs/rendering-integration-decisions.md` §3.6 |
| S4 | The H:Val6 to chain B contact is a crystal (asymmetric-unit) contact and could be shown as a fibre contact. Symmetry contacts of B, D and F are not computed | M | H | Agent | Label it as a crystal contact; compute the symmetry mates before any "fibre" scene | P6.3.1, P11.3.1 | `docs/scientific-research.md`, open question 1; `research/hbs-mapping-note.md` §8 |
| S5 | Illustrative geometry (DNA helix, cell, a fly-through between scales) read as real structure | M | H | Agent, Author | Visible "illustrative" labels; no fake continuous transform between illustrative DNA and real coordinates | P5.2.1, P7.3.1, P8.3.1 | `docs/rendering-integration-decisions.md` §3.5; master prompt §9.3 |
| S6 | ClinVar classification changes between releases, so a shown interpretation goes stale | M | M | Agent | Record the VCV version and the build read; show the review status and date | P6.1.1 | `research/hbs-mapping-note.md` §8 |
| S7 | Users read Helix as clinical advice | M | H | Author | Nonclinical disclaimer in both READMEs and in the UI; no personal data; no "your risk" wording | P6.3.1, P10.2.1 | master prompt §1 |
| S8 | Predicted structures (AlphaFold) confused with experimental ones | M | H | Agent | Keep the in-file disclaimer; "Predicted model" label and confidence display | P9.1.1 | `docs/data-source-registry.md` (AlphaFold DB) |
| S9 | Cellular-component GO terms for P68871 unverified (paging not done), so a Cellular World claim could lack support | M | M | Agent | Page QuickGO before any Cellular World content for HBB | P9.1.2, P11.3.1 | `docs/scientific-research.md` |

## 2. Data and licences

| ID | Risk | L | I | Owner | Mitigation | Task | Source |
|---|---|---|---|---|---|---|---|
| D1 | Ensembl platform transition: release 116 is the last on the current platforms, and the future of `rest.ensembl.org` is unknown | H | M | Agent | Curated data ships offline; adapters behind an interface; watch announcements; record the release used | P9.3.1 | `docs/competitor-analysis.md` R2 |
| D2 | Proprietary identifiers (OMIM, HGMD) leak into curated or raw data | M (happened, fixed) | H | Agent | Filters in the adapters; redaction with recorded hashes; the curated-data rule | P2 (done), P11.3.3 | `PROGRESS.md` §F (Q-H-LIC-1) |
| D3 | NCBI usage and ClinVar data-use pages unverified (reCAPTCHA) | M | M | Agent | Re-read them by hand before release; keep the NCBI disclaimer | P11.3.3 | `docs/data-source-registry.md`, "Not covered or unverified" |
| D4 | Model licence obligations missed: Llama "Built with Llama" and the Notice file; Gemma 3 terms; `qwen2.5:3b` is research-only; LFM has a revenue threshold | M | H | Agent, Author | Licence row per model before use; prefer Apache-2.0 or MIT models for the public build | P3.3.1, P11.3.3 | `research/ai-candidates.md` §3.1 |
| D5 | MolViewSpec schema drift and Mol* version fragmentation (Nightingale pins an old Mol*) | M | M | Agent | Pin the Mol* version; validate against its bundled schema; avoid two Mol* copies | P4.2.1 | `docs/competitor-analysis.md` R3, R4 |
| D6 | The proprietary helix-app consumes helix-research, which is under an NC research licence | L | H | Author | The author owns helix-research, and third-party contributions come in under the CLA, which allows relicensing (Assumption, not legal advice: the author confirms before the app ships) | P11.3.3, P12.1.1 | `CLA.md`; `LICENSE`; helix-app `README.md` |
| D7 | iCn3D's DelPhi component is non-commercial; UCSC CGIs need a commercial licence | L | M | Agent | Do not embed iCn3D; call the UCSC public API and link out only | (no task needed unless adopted) | `docs/competitor-analysis.md` R5, R6 |
| D8 | Link rot of third-party story or explainer URLs | M | L | Agent | Store exports and provenance locally; never depend on third-party story URLs | P12.2.1 | `docs/competitor-analysis.md` R8 |
| D9 | CORS behaviour on error responses (429, 5xx) untested, so the browser shows a network error instead of a rate limit | M | M | Agent | Curated data offline; live mode shows a calm "source unavailable" state | P2.5.2, P9.3.1 | `docs/data-source-registry.md` |

## 3. Technical: rendering, Tauri, WebGPU

| ID | Risk | L | I | Owner | Mitigation | Task | Source |
|---|---|---|---|---|---|---|---|
| T1 | No WebGPU in WKWebView on macOS 15.3.1, so in-browser models do not run in the desktop app | H (measured) | M | Agent | AI provider abstraction: Ollama, then deterministic, in the desktop build; re-test on newer macOS | P3.2.4, P11.5.2 | `docs/rendering-integration-decisions.md` §5 |
| T2 | R3F inside the Tauri shell not yet run | M | M | Agent | Run it in the shell (WebGL2 is present, so expected to work) | P11.5.1, P11.5.3 | same, §5 |
| T3 | Gatekeeper rejects the ad-hoc-signed DMG; notarisation needs a paid Apple account | H (measured) | M | Author | Document the install steps; paying is the author's G-SPEND decision | P11.5.4 | same, §5 |
| T4 | Two pickers over overlaid canvases: one click produced two store updates | H (measured, fixed in the experiment) | M | Agent | A modal pointer owner in the world state | P4.1.2 | same, §3.4 |
| T5 | One unexplained 290 to 400 ms frame at the start of a Mol* spin | M | M | Agent | Investigate (Assumption: a focus or contact representation rebuild) | P4.2.3, P8.1.1 | same, §3.7 |
| T6 | Mol* v6 changes the APIs used; there is no supported unified-canvas route | M | M | Agent | Coordinated canvases; pin Mol*; revisit only on a documented API | P4.2.1 | same, §4 |
| T7 | Ollama's browser-origin allowance depends on the version and `OLLAMA_ORIGINS` | M | M | Agent | Use the Rust command or the HTTP plugin scoped to one URL, not a direct webview fetch | P11.5.2 | same, §5 |
| T8 | The installed Ollama 0.9.6 is too old for several current candidate models; Homebrew is unusable | H | M | Agent | Install a current release user-space, checksum-verified (D-H002), before P3.2.1 | P3.2.1 | `research/ai-candidates.md` §1 |
| T9 | Bundle weight: Mol* plus MVS is about 1.12 MB gzip | M | L | Agent | Lazy-load Mol* when entering Protein World | P4.2.1, P8.1.1 | `docs/rendering-integration-decisions.md` §4 |

## 4. AI

| ID | Risk | L | I | Owner | Mitigation | Task | Source |
|---|---|---|---|---|---|---|---|
| A1 | Hallucinated identifiers: llama3.1 proposed PDB 1BZO instead of 2HBS | H (measured) | H | Agent | The plan schema allows identifiers only from the resolved context; the interpreter rejects anything else; the benchmark scores groundedness | P3.1.1, P3.1.3, P4.1.3 | `docs/rendering-integration-decisions.md` §5 |
| A2 | Wrong structure that is still schema-valid: a valid plan with the wrong world, action or target | H | H | Agent | Deterministic validation against the domain model; benchmark scoring of action correctness; never trust fluent output (§8) | P3.1.2, P3.1.3, P4.3.1 | same; master prompt §8 |
| A3 | Prompt injection from retrieved text (records, literature snippets) | M | H | Agent | Retrieved text is quoted as data, truncated and never treated as instructions; injection items in the benchmark; restricted action registry; no code execution | P3.1.2, P10.3.1, P11.3.2 | master prompt §14; `docs/competitor-analysis.md` (Mol* agent policies) |
| A4 | Thinking models break or slow structured output | M | M | Agent | Run with thinking disabled; use a current Ollama with the thinking-model fixes | P3.2.1 | `research/ai-candidates.md` §2 |
| A5 | Latency: 5 s warm to 13 s cold for an 8B model | H (measured) | M | Agent | Visible progress, cancellation, the deterministic path stays usable meanwhile; smaller models benchmarked | P4.3.2, P3.2.1 | `docs/rendering-integration-decisions.md` §5 |
| A6 | Browser model download (about 1 to 4 GB) and memory interfere with the 3D scene | H | M | Agent, Author | Opt-in only, size stated first, WebGPU detection; measure frame time with Mol* open | P3.2.2, P11.1.1 | `research/ai-candidates.md` §4, §6 |
| A7 | Mol* v6's agent makes Helix's structure actions look redundant | M | M | Author | Position Helix on cross-scale evidence and provenance; consider consuming the Mol* tool layer | P3.3.1, P12.2.1 | `docs/competitor-analysis.md` R1 |

## 5. Performance

| ID | Risk | L | I | Owner | Mitigation | Task | Source |
|---|---|---|---|---|---|---|---|
| P1 | Low-end hardware unmeasured: all numbers so far are from an M1 Pro | H | M | Agent | Device tiers, adaptive rendering, a low-power view | P8.1.1, P11.1.1 | `docs/competitor-analysis.md` R10 |
| P2 | A local model and the Mol* page compete for 16 GB of unified memory | M | M | Agent | Measure resident memory and frame time with both running; prefer models of 7 GB or less | P3.2.1 | `research/ai-candidates.md` §3 |
| P3 | Measurements so far are main-thread rAF intervals, not GPU timers | M | L | Agent | Add GPU timing where available; generated performance tables per phase | P8.1.1 | `docs/rendering-integration-decisions.md` §3.2 |

## 6. Privacy and security

| ID | Risk | L | I | Owner | Mitigation | Task | Source |
|---|---|---|---|---|---|---|---|
| X1 | A personal email address sent in requests and committed. It happened: the NCBI `email` parameter in public manifests, and a crates.io User-Agent | H (happened) | H | Agent, Author | No email in any request or file; NCBI sends `tool` only; User-Agent `helix-research`; an address scan before every commit (`CONTRIBUTING.md`); history rewritten and force-pushed on the author's approval | P0.3.2 (done), P11.3.2 | `PROGRESS.md` §B, privacy incident |
| X2 | GitHub still serves the pre-rewrite commits by SHA until garbage collection | M | M | Author | A GitHub Support request to purge them (the author's step) | none (author action) | `PROGRESS.md` §B |
| X3 | Local branches holding the email or proprietary identifiers (`backup-before-email-rewrite`, `pre-redaction-local`) are pushed by mistake | L | H | Agent | Never push them; deleting them is the author's G-DESTRUCTIVE call | none (standing rule) | `PROGRESS.md` §B |
| X4 | LLM output reaches code execution or broad network rights | L | H | Agent | Typed actions only; no `eval`; Tauri capability allowlist; CSP `connect-src` names `http://localhost:11434` explicitly | P4.1.3, P11.5.3 | `docs/rendering-integration-decisions.md` §5 |
| X5 | Users upload personal genomic data | L | H | Author | No upload path, no storage of personal data, stated in the UI | P11.3.2 | master prompt §1, §14 |
| X6 | Supply chain: npm dependencies, GitHub Actions | M | M | Agent | Lockfiles committed; pinned action SHA (CLA workflow); review before release | P11.3.2 | `PROGRESS.md` §E (D-H004) |

## 7. Schedule

| ID | Risk | L | I | Owner | Mitigation | Task | Source |
|---|---|---|---|---|---|---|---|
| Q1 | Thirteen phases for one author, alongside the other workspace tracks | H | M | Author | Vertical slices with a demonstrable state at each gate (§2); cut scope before rigour | every gate task | master prompt §2, §15 |
| Q2 | Art direction and polish (P7, P8) absorb unbounded time | M | M | Author | Three concepts, one selection by criteria, measured budgets; restraint over effects (§9) | P7.1.2, P8.5.1 | master prompt §9 |
| Q3 | Upstream events (the Ensembl transition, Mol* v6) force rework mid-phase | M | M | Agent | Pin versions; offline curated data; adapters behind interfaces | P4.2.1, P9.3.1 | D1, T6 above |
| Q4 | The author's review is a bottleneck for gates that judge feel and quality | M | L | Author | Prepare reviews with the agent's ticks, evidence and shots, so a verdict takes one sitting (as practised in the author's previous product) | gate tasks | helix-app `docs/hivzz-methodology-notes.md` §1.4 |

## Highest risks now

The risks that are likely and high-impact, and must hold before P4:

- **A1 and A2:** hallucinated or wrong-but-valid plans. P3.1.1 and P3.1.3 must make groundedness a hard check.
- **S1, S3 and S4:** numbering, assembly and crystal-contact honesty. Encode them in the typed actions (P4.1.1) and the labels.
- **X1:** the privacy rule, now in the conventions of both repositories.
- **T1 and T8:** desktop AI depends on Ollama, and the installed Ollama is too old for the best candidates.
