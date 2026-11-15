# Helix Phase 12 demo recording: shots

File: helix-phase12-demo.mp4 (MP4 H.264, 1920 x 1200, 30 fps, 93.0 s, 36030488 bytes). Recorded 2026-11-15 by helix-app apps/web/e2e/linkedin-record.mjs from the release build (apps/web/dist) served by vite preview; viewport 1440 x 900 CSS px at device pixel ratio 2.

| Start | End | Segment | Caption | What is on screen |
|---|---|---|---|---|
| 0:00.0 | 0:03.0 | title |  | Title card (drawn by the compositing canvas) |
| 0:03.0 | 0:11.1 | hbb | 1 · Choose a gene | Welcome on the public-host page; HBB typed and Explore pressed; DNA World opens with its camera tour (the tour is cut after about 5 s to its end) |
| 0:11.1 | 0:31.3 | ask | 2 · Ask in plain language | "Show me where the sickle-cell mutation affects hemoglobin." typed in the question box and answered by the deterministic rules (platform web): 2HBS loads, the camera goes to VAL 6 of chain H, the residue is highlighted, the evidence opens |
| 0:31.3 | 0:44.5 | follow | 3 · A follow-up, answered by the rules | The first follow-up the rules suggest under the answer ("What does this residue touch in the crystal?"), clicked and answered by the rules: the residue's contacts in 2HBS |
| 0:44.5 | 0:51.9 | zoom | 4 · From codon to base pair | Back to DNA World (codon 7 still selected); the mouse wheel zooms from the codon scale to the base-pair scale |
| 0:51.9 | 0:59.4 | evidence | 5 · The evidence behind each sentence | Evidence World: the evidence cards with their classes and source records |
| 0:59.4 | 1:11.9 | live | 6 · A second gene, retrieved live | "Choose another gene"; PTEN typed; "Retrieve PTEN live": the records fetched live from the public services and verified in the browser, then its DNA World with the dynamic-mode banner |
| 1:11.9 | 1:27.0 | model | 7 · Development page: the local model | Development page on 127.0.0.1 with Ollama ministral-3:8b selected; after the rules' answer (not filmed), "Show it as a surface." is planned by the local model and executed (2HBS drawn as a surface) |
| 1:27.0 | 1:33.0 | end |  | End card (drawn by the compositing canvas) |

Highlights (a spotlight box and a short tag drawn by the compositing canvas over the element measured at capture time; a push-in zoom where stated):

- 0:06.9 to 0:10.1: "Real transcript from Ensembl, drawn in 3D"
- 0:13.0 to 0:16.0: "A question in plain language"
- 0:19.5 to 0:23.3: "The sickle-cell residue: valine 6, in the real 2HBS crystal" (push-in 1.4x)
- 0:23.6 to 0:27.4: "GAG → GTG at codon 7; numbering 7 → 6 checked" (push-in 1.2x)
- 0:27.4 to 0:30.8: "Every sentence cites its source record"
- 0:31.3 to 0:34.1: "The rules suggest a follow-up"
- 0:36.4 to 0:40.2: "Its neighbours in the 2HBS crystal, from the atom coordinates"
- 0:40.2 to 0:43.6: "Answered by the rules, no model call"
- 0:53.3 to 0:57.1: "Each record with its evidence class, review status and version"
- 1:07.0 to 1:11.4: "PTEN, not curated: built live in the browser from 4 public services"
- 1:13.6 to 1:16.8: "A follow-up for the local model (ministral-3:8b, Ollama)"
- 1:22.8 to 1:26.6: "The model proposes actions; the app validates them"

Editing: every shot is the real app; a numbered chapter caption on each segment (on-screen text drawn by the compositing canvas) and no sound. Left out of this cut: cftr (captured, stills kept). Static waits are capped at 1200 ms and segments play faster (hbb 1x, ask 1x, follow 1x, zoom 1x, evidence 1x, live 1x, model 1x), except inside highlights (real time, holds up to 4500 ms); page loads and the end of each camera tour are cut;
the waits below are shown faster, with an on-screen badge giving the real time: Live retrieval 22.7 s · 11x; Model planning 41.5 s · 20x.
