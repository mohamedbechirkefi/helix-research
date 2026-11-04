# HX-P9-2026-11-04-dynamic-mode: P9.3.1, a recognised gene built live in the browser through the same builder

```yaml
id:            HX-P9-2026-11-04-dynamic-mode
date:          2026-11-04
phase:         P9 (P9.3.1 dynamic mode, plan section 16)
hypothesis:    A recognised human gene without a curated set can be given FAAH2's honest shape at request time, in the visitor's browser, through the unchanged builder and loader, from four CORS-open sources, with the mode stated on every surface and nothing stored; five recorded genes test it offline and one live run shows the cost.
git_commit:    helix-research 920f70b (library: resolver, configuration, mode, fixtures; three generalisations); helix-app 796b0f3 pinned to it (worker, loader path, welcome button, gauge, banner, limitation, suite); implemented by a delegated agent from plan section 16, verified by the coordinator (gates by exit code in both repositories, the suites' PASS lines, the identifier guard over the 40 dynamic fixtures, scans, the request allow-list in the worker)
config:        record-dynamic-fixtures.ts once live for TP53, EGFR, INS, APOE, HBA1 (Ensembl, HGNC, UniProt, AlphaFold; user agent helix-research; no identifier); the Phase 9 suite serving those fixtures by interception; one live scenario behind HELIX_LIVE=1 on PTEN against the real services from headless Chrome
seed:          n/a
data_version:  Ensembl 116, UniProt 2026_03, AlphaFold DB v6 at the recording and the live run
hardware:      the development Mac; Chrome 156 headless
duration:      about 85 minutes of agent time plus verification
cost:          0
```

## Measurements

| Quantity | Value |
|---|---|
| Five fixture genes built from fixtures | 18 to 20 checks each, 0 failed; experimentalStructure unavailable with the dynamic reason (TP53 311 entries cross-referenced, EGFR 385, INS 382, APOE 29, HBA1 355); predictedStructure available; pathwayView and associationView "not requested in dynamic mode" |
| Live run, PTEN | 12 requests, all 200 at the first attempt; resolve 358 ms; Ensembl 543, 164, 418, 90, 78, 89, 70 ms; UniProt 405; HGNC 166; AlphaFold 227 and 223; build 32 ms; total 2,938 ms; 404 codons; axe 0 (`phase9-e2e-p931-live.json`) |
| Phase 9 suite on the final build | 40 scenarios PASS, 0 failures, 0 axe violations (`phase9-e2e-p931-final.json`) |
| Phase 6, 5, 4 suites; accessibility | PASS; 0 violations on 14 screens (`a11y-p931-app.json`) |
| Unit tests, typecheck | helix-app 436 (425 before), helix-research 450 (436 before); clean |
| Bundle | main chunk +2.4 kB gzip; new worker chunk 80.9 kB gzip on the dynamic page only; scene chunk unchanged |
| Storage after a dynamic visit | 0 entries |

## What reality changed

Three generalisations, each from a measured fact and each leaving the curated sets byte-identical: T15 assumed a Chain feature (insulin has peptides instead); the UniProt adapter took the first MANE cross-reference (HBA1 and HBA2 share one entry); the HTTP client's truncation check compared the declared length with the body, which a browser hands over decompressed (AlphaFold declared 1,428 bytes, 7,183 arrived), so only a shortfall is a truncation now. The first live attempt was refused by that check; the second ran clean.

## Interpretation

The hypothesis holds, and the cost is small: three seconds of requests and a worker chunk loaded only when asked. The design decision that mattered was to give a dynamic set no structure selection rather than a guessed one: a visitor gets the DNA, the protein record and the prediction, and a sentence that says why the rest is missing. The follow-ups are recorded: a dbSNP id named by the visitor, the stacked switcher notes, and whether the dynamic manifest should record the browser's user agent at all.

## Failures

The live run's first attempt (the truncation check); recording INS took four attempts because Ensembl answered 500 and 503 twice (the client retried; no partial data). None in the final runs.
