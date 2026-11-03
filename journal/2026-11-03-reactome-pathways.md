# HX-P9-2026-11-03-reactome-pathways: P9.1.2 data side, the Reactome adapter and the pathways record for the three sets

```yaml
id:            HX-P9-2026-11-03-reactome-pathways
date:          2026-11-03
phase:         P9 (P9.1.2 Reactome and Pathway World v1, data side; plan section 12 rules 1 to 4 and 7, rule 3 amended the same day after the first run)
hypothesis:    Pathway membership can be added to every set as a class 2 annotation from Reactome Content Service requests (version, memberships, one ancestors request per membership, one participants request per candidate), with the pathway the world opens on chosen by the plan's rule from the responses alone, every candidate's participants kept for the visitor to open, the HBB output byte-identical apart from the new record and the capability line, and each committed set rebuilt offline with only the Reactome responses as new requests.
git_commit:    helix-research 40655bc (code, record, fixtures), d5ee859 and 088bb2a with 40655bc (the three sets rebuilt on clean trees), HEAD d2cc2d2; implemented by a delegated agent from plan section 12, verified by the coordinator (gates by exit code, identifier guard over 83 files, scans, the rule change D-H019)
config:        exploration with curl (user agent helix-research): version, memberships of the three accessions, ancestors and three participant views of R-HSA-1237044; then build-gene.ts --gene hbb --offline --live-sources=reactome --record-fixtures=live (20 live Reactome requests, everything else from the 2026-11-02 snapshot), --gene cftr --offline --live-sources=reactome --record-fixtures (21 requests; the build then failed on T42, see below), --gene faah2 --offline --live-sources=reactome --record-fixtures (4 requests); every later rebuild (the T42 correction, the rule-3 amendment) with --offline from the snapshots, no request (cftr and faah2 with --record-fixtures so that they keep citing the redacted bodies); compare-builds.ts for the HBB fixtures build before against after and for each committed set against its rebuild
seed:          n/a
data_version:  Reactome database version 98 (data/database/version, 2026-11-03); the snapshots of 2026-11-02 (HBB) and 2026-11-03 (CFTR, FAAH2) for everything else
hardware:      the development Mac
duration:      about two and a half hours of agent time, including the amendment
cost:          0
```

## What the responses said

| Quantity | HBB (P68871) | CFTR (P13569) | FAAH2 (Q6GMR7) |
|---|---|---|---|
| Memberships (species 9606) | 10 | 11 (one disease pathway, one CellLineagePath) | 1 |
| Candidates of the rule (non-disease, with a diagram), participants kept for each | 8 | 8 | 1 |
| Participants per candidate (physical entities; UniProt proteins) | R-HSA-983231 120 (160); R-HSA-1237044 25 (12); R-HSA-1247673 18 (8); R-HSA-6798695 20 (478); R-HSA-9613829 28 (22); R-HSA-9615710 8 (34); R-HSA-9707564 61 (59); R-HSA-9707616 64 (47) | R-HSA-382556 74 (90); R-HSA-5627083 5 (3); R-HSA-8856825 41 (105); R-HSA-8856828 96 (145); R-HSA-9613829 28 (22); R-HSA-9615710 8 (34); R-HSA-9646399 28 (44); R-HSA-9925563 5 (48) | R-HSA-2142753 174 (59) |
| The set's protein among each candidate's participants | all 8 | all 8 | yes |
| Opening pathway by the rule | R-HSA-9615710 Late endosomal microautophagy, 8 entities | R-HSA-5627083 RHO GTPases regulate CFTR trafficking, 5 (tied with R-HSA-9925563 at 5; lower stable id number) | R-HSA-2142753 Arachidonate metabolism, 174 |
| Top-level pathway of the opening one | R-HSA-9612973 | R-HSA-162582 | R-HSA-1430728 |
| Requests (version, memberships, ancestors, participants) | 1 + 1 + 10 + 8 = 20 | 1 + 1 + 11 + 8 = 21 | 1 + 1 + 1 + 1 = 4 |
| pathways.json size | 708 kB | 751 kB | 66 kB |
| Checks after the change | 59, 0 failed | 63, 0 failed | 27, 0 failed |
| pathwayView | available, class 2 | available, class 2 | available, class 2 |

Every membership returned for species 9606 named Homo sapiens; every ancestors response had exactly one path ending in a TopLevelPathway; the redaction removed nothing from the Reactome bodies.

## What reality changed

- The plan's participants endpoint (`participatingPhysicalEntities`) returns complexes and sets without their members: for R-HSA-1237044 the haemoglobin appears only inside "HbA [cytosol]" and its relatives, with no accession anywhere. `data/participants/{stId}` returns the same 25 entities each with its reference entities (identifier, `uniprot:` stable id, display name), which is the flattened form the plan wanted; it is the endpoint used. `referenceEntities` was looked at and rejected: UniProt comment text with MIM numbers inside sentences.
- The rule ranks by participant count and the membership list carries none, so the participants of every candidate are requested; after the amendment the record keeps them all (`participantsByPathway`).
- Reactome lists a `CellLineagePath` among CFTR's pathways; the first CFTR build was refused by the new T42 (which accepted only classes ending in "Pathway") and the check now accepts that class and the record labels it. The snapshot had already kept the 21 responses, so the rerun made no request.
- The rule's HBB choice is the microautophagy pathway (haemoglobin is one of sixteen substrates in a set), not an erythrocyte pathway (18 and 25 entities). Reported to the coordinator, this changed plan section 12 rule 3 the same day: the rule stays mechanical but names only the pathway the world opens on, stated as the rule's choice and never as importance; the record keeps every candidate's participants so the visitor can open any membership; no field or sentence calls a pathway primary (the record fields are `openingPathway`, `participantsByPathway`, `isOpening`; the capability reason reads "N Reactome memberships; opens on <name>, <stable id> (the rule's choice: fewest participants among non-disease pathways with a diagram)"; a test fails on the word).
- Recording for HBB needed a merge: its fixture set is the frozen research/raw snapshot plus hand-listed extras, and its committed manifest cites the live bodies unredacted, so `--record-fixtures=live` (new) records and redacts only the live-fetched sources and merges them into the existing index. FAAH2's re-recording also brought two MANIFEST rows to the recorder's current wording ("proprietary database identifiers removed"), which the P9.2.1 change had introduced after that set was recorded.
- A plain `--offline` rebuild of CFTR or FAAH2 cites the snapshot's unredacted bodies, which their committed manifests do not (they were recorded); the compare showed six raw-body hashes moving. Those two sets are rebuilt with `--offline --record-fixtures` (no request), which restored the hashes.

## Byte-identity

HBB fixtures build before against after (`journal/results/compare-hbb-pathways-record-2026-11-03.txt`): 16 files, 162 allowed timestamp differences, 18 other differences, all the new record, its manifest rows (sources, files, validation, attribution), the capability entry and `derivedFrom`, and the generator fields (`gitDirty`, and `gitCommit` since the plan amendment was committed between the two builds). Committed sets against their rebuilds (`compare-{hbb,cftr,faah2}-committed-vs-pathways-rebuild-2026-11-03.txt`): HBB 18, CFTR 17, FAAH2 16 other differences of the same kinds plus the generator's commit (and FAAH2's mode string, live against offline); no raw-body hash changed. Details and the explanation of each line: `docs/scientific-validation.md` section 4.

## Failures

The first CFTR build, refused by T42 on the CellLineagePath (above); corrected and rerun without a request. The first HBB record after the amendment still carried the word "primary" in an evidence limitation ("no membership is primary"); the guard test caught it and the sentence now reads "no membership ranks above the others". The test of the committed HBB set (`dataset.test.ts`, `generator.gitDirty` false) fails on this working tree because the rebuilt manifests record a dirty tree; an offline rebuild of the three sets on the clean tree after the commit (no request: the snapshots hold the Reactome bodies; cftr and faah2 with `--record-fixtures`) restores it.
