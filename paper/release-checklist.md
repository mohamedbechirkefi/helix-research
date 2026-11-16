<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# Release checklist: report and article, version 1.0

Release `v1.0-report`, 2026-11-16, on the author's instruction of the same day ("publish the article and the report in github"). Journal: HX-P12-2026-11-16-report-v1.

| Check | Result |
|---|---|
| The Phase 12 gate is passed | Yes, 2026-11-15 (D-H053); the report's version line no longer waits on it |
| The author's two checks before any release | Done 2026-11-15: the ClinVar and RefSeq pages (HX-P12-2026-11-15-ncbi-pages) and the wordmark clearance (P11-LIC-08 closed) [C203] |
| Every statement about publication is current | The report's header and status, section 9.9's open items, the limits on the CSP and on the author's checks, the annex row for Phase 12, the article's section 7.5 and its Availability section; section 9.10 added |
| Every new claim has a row | C202 (the public host) and C203 (the author's checks) |
| English and French parity | Report: numbers 2,106/2,106, claim ids 299/299, journal ids 39/39, headings equal. Article: numbers 495/495, claim ids 128/128. The French copies carry one extra table row, the note on number notation, which holds no number |
| Links | 30 checked on 2026-11-16 (`journal/results/link-check-2026-11-16-v1.tsv`): 25 answer 200, PubMed answers 203, and four DOIs reach their publisher, which refuses the script with 403; Crossref returns each of the four records |
| Figures | Four architecture diagrams, already public in `docs/showcase/diagrams/`, and four frames of the public demo recording `docs/showcase/reviews/phase-12-demo/helix-phase12-demo.mp4`, taken at 0:09.0, 0:21.5, 0:55.0 and 1:09.5. No image from outside the project |
| PDFs | Built by `scripts/report/build_pdf.py`; each page read on a contact sheet before release: report EN 71 pages, report FR 78, article EN 16, article FR 17 |
| Nonclinical notice | On the first pages of all four PDFs |
| No personal data | No e-mail address, account or credential in the texts; the demo address is the public one the author chose |
| Licence | Each source file carries the Helix Source-Available Non-Commercial Research License v1.0 identifier; the header table names it |
| Both languages released together | The release carries the four PDFs (D-006: neither version is distributed without the other) |
