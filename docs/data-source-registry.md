<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# Data-source registry (P1.3.1)

**Status:** Phase 1. **All pages and endpoints accessed 2026-11-01.**

- **Policy text:** fetched from the official pages listed (by this session's research pass). Key licence sentences were re-checked with a second fetch.
- **Release values and CORS results:** live measurements, saved under `research/raw/` (`*/MANIFEST.tsv` for release headers, `cors/cors-results.txt` for CORS).
- **Labels:** "Inference" marks our reading of a policy. It is **not legal advice**.

## Summary for architecture

| Source | Release seen | Rate limit (documented) | Browser CORS (measured) | Data licence | Cached records in public repo / app bundle |
|---|---|---|---|---|---|
| Ensembl REST | 116 (REST 15.12) | 55,000 req/hour (~15/s); 429 + Retry-After | Yes: `*`, preflight OK, **no exposed headers** | Ensembl data "without restriction"; third-party content excepted | Yes (Inference), minus third-party content |
| UniProt REST | 2026_03 (2026-09-02) | Not stated | Yes: `*`, preflight OK, release headers exposed | CC BY 4.0 | Yes with attribution, licence link, change notice |
| RCSB Data API | n/a | "a handful of requests per second"; 429 | Yes: `*`, preflight OK | CC0 1.0 | Yes |
| RCSB files (files.rcsb.org) | weekly PDB release | static files "not restricted" | Simple GET yes; **preflight returns 403** | CC0 1.0 | Yes |
| RCSB ModelServer (models.rcsb.org) | | | Simple GET yes; **preflight lacks ACAO** | CC0 1.0 | Yes |
| AlphaFold DB | model v6 | Not stated (EMBL-EBI ToU) | Yes: `*` (API and files) | CC BY 4.0 + in-file disclaimer | Yes with attribution and disclaimer kept |
| NCBI E-utilities / ClinVar | ClinVar build 261025 (2026-10-25) | 3 req/s without key; >100 requests off-peak; `tool`/`email` | Yes: `*`, rate-limit headers exposed | Public domain (US Gov) + submitter caveat; disclaimer "must be evident" | Yes (Inference) with NCBI notice; no OMIM content |
| Reactome Content Service | 98 (seen 2026-11-01 and 2026-11-03) | Not stated | Yes: `*` | CC0 (data); CC BY 4.0 (diagrams, icons) | Yes (data); attribution for diagrams |
| Open Targets GraphQL | 26.09 (API 26.9.0) | No number; heavy use blocked; bulk via downloads | Yes: echoes Origin, credentials true; POST preflight OK | CC0 1.0 (platform); per-source terms | Core yes; check ChEMBL/HPA (CC BY-SA) and COSMIC fields |
| HGNC REST | lastModified 2026-10-30 | 10 req/s; 403 IP block | Simple GET yes (`*`); preflight returns no allow-headers | CC0 | Yes |
| NCBI Gene / RefSeq | (E-utilities) | as NCBI | as NCBI | as NCBI | as NCBI (RefSeq-specific statement not fetched) |
| PDBe API / SIFTS | weekly | "no hard limits" currently | Yes: `*` (documented) | CC0 + EMBL-EBI ToU | Yes; cite SIFTS |
| InterPro API | 110.0 | Not stated | Yes: `*`, version header exposed | CC0 for InterPro, Pfam, PRINTS, SFLD; members vary | InterPro yes; member signatures checked one by one |
| GO / QuickGO | GO release 2026-08-05 | Not stated | Yes: `*` | CC BY 4.0 | Yes with attribution, licence and **GO release date + DOI** |

### Architecture consequences

1. **A static app can call every listed API directly from the browser today** (measured 2026-11-01, Origin `https://helix-cors-test.example`). Constraints:
   - **Use simple GETs** (no custom request headers) for files.rcsb.org, models.rcsb.org and HGNC. Their preflights fail: 403, missing `Access-Control-Allow-Origin`, and no `Access-Control-Allow-Headers` respectively. For Ensembl, pass `content-type=application/json` as a **query parameter**, not a header. `Accept: application/json` is a CORS-safelisted header.
   - Browsers do not let page scripts set `User-Agent`, so the documented identification cannot be sent from the browser. NCBI asks for `tool` and `email` URL parameters. Putting the maintainer email in a public bundle exposes it; **Decision proposal:** send `tool=helix` only from the browser.
   - **Ensembl exposes no response headers**, so browser code cannot read `Retry-After` or the rate-limit headers. Back-off must be blind (exponential), not header-driven.
   - CORS is **documented** only by Ensembl and PDBe. For the others it is observed behaviour that can change without notice.
2. **The curated HBB journey must work with no network** (§4.2). Live calls are an enhancement of dynamic mode, behind adapters with timeouts, retries and back-off (§4.1).
3. Per-IP rate limits apply per visitor in a static app. One heavy page could still exceed NCBI's 3 req/s or Ensembl's 15 req/s. **Decision proposal:** a client-side token bucket per source, set below the documented limit (Ensembl 10/s, NCBI 2/s, HGNC 5/s, others 3/s).
4. **Redistribution is permitted for every source examined** (Inference), with conditions:
   - attribution for UniProt, AlphaFold DB, GO and Reactome diagrams
   - the NCBI disclaimer notice
   - GO release date and DOI
   - keep AlphaFold's in-file disclaimer
   - no third-party proprietary content: OMIM text, HGMD, COSMIC, and share-alike fields from Open Targets sources
   
   Curated bundles should keep only the fields HELIX uses (see `research/hbb-acquisition-plan.md`).

---

## 1. Ensembl REST

- **Docs and endpoints:**
  - https://rest.ensembl.org/ ("Ensembl REST API (Version 15.12)")
  - Used: `lookup/id/:id` (`expand`, `mane`, `utr`), `sequence/id/:id` (`type=cds|cdna|genomic|protein`), `map/cds/:id/:region`, `map/translation/:id/:region`, `variation/:species/:id`, `variant_recoder/:species/:id`, `vep/:species/hgvs/:hgvs`, `vep/:species/id/:id`, `xrefs/id/:id`, `info/data`, `info/rest`, `info/assembly/:species`
  - GRCh37 host: https://grch37.rest.ensembl.org
- **Versioning:** `info/data` returned `{"releases":[116]}`; `info/rest` returned `{"release":"15.12"}`. Stable IDs carry versions (ENSG00000244734.6 in release 116).
- **Rate limits:** https://github.com/Ensembl/ensembl-rest/wiki/Rate-Limits: "we are allowed 55000 requests over an hour (3600 seconds) meaning we can perform an average of 15 requests per second". On 429, "Any client should then refuse to query the service until this period has been exceeded." Live headers `x-ratelimit-limit: 55000`, `x-ratelimit-period: 3600`.
  - Note: that GitHub repository was archived on 2026-10-16 ("now read-only").
  - www.ensembl.org now serves a new site; legal pages redirect to `jun2026.archive.ensembl.org` (release 116).
  - Documentation location may move. Re-check at Phase 2.
- **CORS:**
  - Documented at https://github.com/Ensembl/ensembl-rest/wiki/CORS-And-JSONP: "Ensembl REST will return a Access-Control-Allow-Origin: * response header when any Origin request header is sent."
  - Measured: preflight 200 with `allow-origin *`, `allow-methods GET, POST, OPTIONS`, `allow-headers content-type`; GET 200 with `allow-origin *`; `access-control-expose-headers` empty. GRCh37 host identical.
- **Licence and terms:** https://jun2026.archive.ensembl.org/info/about/legal/disclaimer.html:
  - "Ensembl imposes no restrictions on access to, or use of, the data provided and the software used to analyse and present it."
  - "Some of the data and software included in the distribution may be subject to third-party constraints." Users are "solely responsible for establishing the nature of and complying with any such restrictions."
  - EMBL-EBI terms of use also apply (section 10).
  - Attribution is not stated as mandatory. **Decision:** we attribute anyway.
- **Redistribution:** Inference: allowed for Ensembl-generated records. Strip or review third-party content:
  - phenotype text from external sources
  - HGMD accessions in VEP `colocated_variants` (removed from the snapshot)
  - OMIM-derived synonyms in `variation/rs334` (removed from the snapshot)

## 2. UniProt REST

- **Docs and endpoints:**
  - https://www.uniprot.org/help/api (text served by https://rest.uniprot.org/help/api) and https://www.uniprot.org/api-documentation/
  - Used: `https://rest.uniprot.org/uniprotkb/{acc}.json` and `.fasta`
  - Help pages are readable as JSON at `https://rest.uniprot.org/help/{id}`
- **Versioning:** response headers `x-uniprot-release: 2026_03`, `x-uniprot-release-date: 02-September-2026` (documented at https://rest.uniprot.org/help/rest-api-headers). Entries carry `entryVersion` (219 for P68871) and `sequenceVersion` (2).
- **Rate limits:** not stated in help/api, programmatic_access or rest-api-headers. HTTP 503 means "try again later". EMBL-EBI terms apply.
- **CORS:** measured preflight 204 with `allow-origin *`; GET exposes `Link, X-Total-Results, X-UniProt-Release, X-UniProt-Release-Date, X-API-Deployment-Date`. Not documented.
- **Licence:** https://www.uniprot.org/help/license:
  - "We have chosen to apply the Creative Commons Attribution 4.0 International (CC BY 4.0) License to all copyrightable parts of our databases."
  - It also says it cannot "provide unrestricted permission regarding the use of the data, as some data may be covered by patents or other rights".
  - Medical information is "for research, educational and informational purposes only".
- **Redistribution:** yes under CC BY 4.0, with attribution, a licence link, and an indication of changes (trimmed fields).

## 3. RCSB PDB (Data API, files, ModelServer)

- **Docs and endpoints:**
  - https://www.rcsb.org/docs/programmatic-access/web-apis-overview
  - Used: `https://data.rcsb.org/rest/v1/core/entry/{id}`, `core/polymer_entity/{id}/{entity}`, `core/assembly/{id}/{n}`, `https://files.rcsb.org/download/{id}.cif`
  - GraphQL at `https://data.rcsb.org/graphql`
- **Versioning:** the archive updates weekly. Entries carry revision history: 2HBS revision 1.5, 2026-08-12.
- **Rate limits:** same overview page: "While access to static files is not restricted, all RCSB PDB APIs have rate limits in place. We recommend starting with a handful of requests per second. If you exceed the limit, the service will respond with a 429 HTTP error code". It recommends exponential back-off.
- **CORS:**
  - data.rcsb.org: preflight 200 and GET with `allow-origin *`.
  - files.rcsb.org: **preflight 403** (with `allow-origin *`); GET 200 with `allow-origin *`. A browser fetch with non-safelisted headers will fail; plain GET works.
  - models.rcsb.org: preflight 200 **without** `allow-origin`; GET 200 with `allow-origin *`.
  - Not documented.
- **Licence:**
  - https://www.rcsb.org/pages/usage-policy: "data files contained in the PDB archive are available under the CC0 1.0 Universal (CC0 1.0) Public Domain Dedication. All data provided by RCSB PDB programmatic APIs are available under the same license."
  - Attribution to original authors is "encouraged". "All other articles and text on the RCSB PDB site are copyrighted."
  - wwPDB: https://www.wwpdb.org/about/usage-policies.
- **Redistribution:** yes (CC0). Do not copy RCSB site text or images other than those under stated licences. Computed structure models served through RCSB (IDs starting `AF_` or `MA_`) carry their source's licence.

## 4. AlphaFold DB

- **Docs and endpoints:**
  - https://alphafold.ebi.ac.uk/api-docs (OpenAPI at https://alphafold.ebi.ac.uk/api/openapi.json)
  - Used: `https://alphafold.ebi.ac.uk/api/prediction/{uniprot}` and `https://alphafold.ebi.ac.uk/files/AF-{acc}-F1-model_v6.cif`; since Phase 9 (P9.1.1) also the PAE file the prediction record names, `https://alphafold.ebi.ac.uk/files/AF-{acc}-F1-predicted_aligned_error_v6.json` (recorded for P68871 on 2026-11-03: 44,028 bytes, a 147 by 147 matrix, maximum 31.75 Å stated by the file). Per-residue pLDDT is read from the model file's `_ma_qa_metric_local` table, never fetched separately.
- **Versioning:** P68871: `latestVersion` 6, `modelCreatedDate` 2025-08-01, `toolUsed` "AlphaFold Monomer v2.0 pipeline".
- **Rate limits:** not stated. EMBL-EBI terms of use apply.
- **CORS:** measured `allow-origin *` on the API (preflight and GET) and on files (preflight allows GET and Content-Type).
- **Licence:**
  - Site: "Data is available for academic and commercial use, under a CC-BY-4.0 licence." and "EMBL-EBI expects attribution".
  - The model file `_pdbx_data_usage` says "Data in this file is available under a CC-BY-4.0 license." plus the DeepMind copyright and disclaimer ("THEORETICAL MODELLING ONLY ... NOT INTENDED TO BE A SUBSTITUTE FOR PROFESSIONAL MEDICAL ADVICE"), verified in the saved `AF-P68871-F1-model_v6.cif`.
  - The FAQ page is a JavaScript app and was not readable by script.
- **Redistribution:** yes with attribution (DeepMind and EMBL-EBI), keeping the in-file notice, and always labelled "predicted".

## 5. NCBI ClinVar via E-utilities

- **Docs and endpoints:**
  - https://www.ncbi.nlm.nih.gov/clinvar/docs/programmatic_access/ (**not fetchable by script**: reCAPTCHA page)
  - Used: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=clinvar`, `esummary.fcgi?db=clinvar`, `einfo.fcgi?db=clinvar`
- **Versioning:**
  - `einfo` returned `dbbuild` Build261025-1250.1, last update 2026/10/25.
  - https://ftp.ncbi.nlm.nih.gov/pub/clinvar/README.txt: "Data on the ftp site are updated monthly and weekly", "Weekly releases are not archived", and "ClinVar may modify files after release to remove personally identifiable information".
  - Records are versioned (VCV000015333.183).
- **Rate limits:** https://www.ncbi.nlm.nih.gov/home/about/policies/: "Make no more than 3 requests every 1 second." and "Run retrieval scripts on weekends or between 9 pm and 5 am Eastern Time weekdays for any series of more than 100 requests." It asks for the `tool` and `email` parameters. Live header `x-ratelimit-limit: 3`. The 10 req/s with an API key is **unverified** (the E-utilities manual returned reCAPTCHA).
- **CORS:** measured preflight 200 and GET 200 with `allow-origin *`; GET exposes `X-RateLimit-Limit, X-RateLimit-Remaining`. Not documented.
- **Licence:** same policies page:
  - "NCBI itself places no restrictions on the use or distribution of the data contained therein."
  - Submitters "may claim patent, copyright, or other intellectual property rights".
  - "NCBI's Disclaimer and Copyright notice must be evident to users of your service."
  - US government works are public domain, with NLM acknowledgement requested.
  - ClinVar's own submitter-data statement: **unverified** (reCAPTCHA).
- **Redistribution:** Inference: allowed, with the NCBI notice shown in the app. Keep submitter attribution (SCV accessions). Exclude OMIM text.

## 6. Reactome Content Service

- **Docs and endpoints:**
  - https://reactome.org/dev/content-service
  - Used (Phase 9, P9.1.2, `packages/data-adapters/src/adapters/reactome.ts`, requests of 2026-11-03 for the HBB, CFTR and FAAH2 sets, user agent `helix-research`, no identifier other than the accession and stable ids in any URL): `https://reactome.org/ContentService/data/database/version` (plain text, `98`); `/data/mapping/UniProt/{acc}/pathways?species=9606` (the memberships); `/data/event/{stId}/ancestors` (once per membership); `/data/participants/{stId}` (once per candidate of the opening-pathway rule; the record keeps every candidate's participants).
  - Looked at once on 2026-11-03 and not used: `/data/participants/{stId}/participatingPhysicalEntities` (the plan's endpoint: it returns the physical entities without their members, so a complex such as "HbA [cytosol]" carries no accession) and `/data/participants/{stId}/referenceEntities` (flattened reference entities, but each reference gene product carries UniProt comment text in which MIM numbers appear inside sentences, which the Q-H-LIC-1 redaction does not remove). Neither was recorded.
- **Versioning:** database version **98** (seen 2026-11-01 and again 2026-11-03; `data/database/version`). Stable IDs are versioned (`stIdVersion`, e.g. R-HSA-1237044.5); the record keeps both.
- **Response shapes seen (2026-11-03, release 98):**
  - Memberships: a JSON array of event summaries with `dbId`, `stId`, `stIdVersion`, `displayName`, `name[]`, `speciesName`, `isInDisease`, `isInferred`, `hasDiagram`, `hasEHLD`, `maxDepth`, `releaseDate`, `schemaClass`, `className`, sometimes `doi` and `lastUpdatedDate`. `schemaClass` is `Pathway` for every HBB and FAAH2 membership and for ten of CFTR's eleven; the eleventh is `CellLineagePath` (R-HSA-9925563, "Developmental Lineage of Pancreatic Ductal Cells"), which the adapter accepts as a membership and the record labels. Every membership returned for species 9606 had `speciesName` "Homo sapiens". HBB 10 memberships (3949 bytes), CFTR 11 (4376 bytes), FAAH2 1 (398 bytes).
  - Ancestors: a JSON array of paths; each path is an array of event summaries from the event itself up to a `TopLevelPathway` (fields as above plus `oldStId`, `diagramWidth`, `diagramHeight`, `inferred`, `inDisease`). Every membership seen had exactly one path.
  - Participants (`/data/participants/{stId}`): a JSON array of `{ peDbId, displayName, schemaClass, refEntities[] }`, one per participating physical entity (`Complex`, `DefinedSet`, `CandidateSet`, `EntityWithAccessionedSequence`, `SimpleEntity`, ...); each `refEntities` entry has `dbId`, `stId` (`uniprot:P68871`, `chebi:16526`, ...), `identifier`, `schemaClass` (`ReferenceGeneProduct`, `ReferenceMolecule`, `ReferenceTherapeutic`, ...), `displayName` ("UniProt:P68871 HBB"), `icon` and `url`. No species field on either level. Sizes from 7.6 kB (an erythrocyte pathway, 18 entities) to 349 kB ("Neutrophil degranulation", 20 entities with large sets). No proprietary identifier was found in any recorded body (the redaction removed nothing).
  - Version: `text/plain;charset=UTF-8`, the two characters `98`.
- **Rate limits:** not stated; the client uses 3 requests per second (burst 3). The three sets needed 20, 21 and 4 requests.
- **CORS:** measured `allow-origin *` (the preflight response duplicates some headers, harmless).
- **Licence:** https://reactome.org/license:
  - "All data in the Reactome database and files derived from that data are licensed under the Creative Commons Public Domain Dedication (CC0)" and "Attribution is encouraged but not required."
  - Pathway illustrations, icons and art are CC BY 4.0. Software is Apache 2.0.
- **Redistribution:** yes (CC0 data). Reactome diagrams and icons need CC BY attribution; HELIX uses neither (Pathway World v1 draws its own plate from the record).
- **Fixtures:** `data/fixtures/{hbb,cftr,faah2}/reactome/` with MANIFEST.tsv rows; the earlier assessment's two files stay in `research/raw/reactome/` (the memberships body of 2026-11-01 has the same sha256 as the one recorded on 2026-11-03).

## 7. Open Targets Platform GraphQL

- **Docs and endpoints:**
  - https://platform-docs.opentargets.org/data-access/graphql-api
  - Used: `POST https://api.platform.opentargets.org/api/v4/graphql` with `meta` and `target(ensemblId)` (assessment, 2026-11-01); since P9.1.3 (2026-11-04 local time; the responses' retrieval times are 2026-11-03T23:05Z to 23:08Z) the one query per set, `OPEN_TARGETS_ASSOCIATIONS_QUERY` in `packages/data-adapters/src/adapters/opentargets.ts`: `meta { apiVersion { x y z } dataVersion { year month } } target(ensemblId: $ensemblId) { id approvedSymbol associatedDiseases(page: { index: 0, size: 25 }, orderByScore: "score desc") { count rows { disease { id name therapeuticAreas { id name } } score datatypeScores { id score } datasourceScores { id score } } } }`, the Ensembl gene id its only variable, `content-type: application/json`, user agent `helix-research`.
  - **The ordering argument.** The plan (phase-9-generalisation.md section 14 rule 1) wrote `orderByScore: true`; the live schema types it as a String and refused the Boolean with HTTP 400 on the first HBB request of 2026-11-04. Introspected the same day (`research/raw/opentargets/introspect-shapes.json`): "Ordering for the associations. Accepts a string with two words separated by a space. The first word is the column to sort by: either `score` to use the overall association score (default), a datasource id (e.g., `impc`), or a datatype id (e.g., `animal_model`). The second word is the order: `desc` (default) or `asc`." `Pagination` is `{ index: Int!, size: Int! }` ("Number of items per page [Default: 25, Max: 3000]"); `AssociatedDiseases` has `count` (Long), `rows` and `datasources`; `AssociatedDisease` has `disease`, `score`, `datatypeScores`, `datasourceScores` and `novelty`. The query uses `"score desc"`, the same meaning in the schema's words.
- **Versioning:** live `meta`: apiVersion 26.9.0, dataVersion 26/09 (2026-11-01 and again on every response of 2026-11-04; the record writes them as "26.9.0" and "26.09"). Release notes (https://platform-docs.opentargets.org/release-notes): 26.09, 24 September 2026.
- **Rate limits:**
  - The docs "discourage users from repeatedly querying the GraphQL API one entity at a time" and send bulk use to downloads or BigQuery.
  - Terms (https://platform-docs.opentargets.org/licence/terms-of-use): use "that prevents, or looks likely to prevent, Open Targets providing services to others, will result in the use being blocked."
- **CORS:** measured POST preflight 200, `allow-origin` echoes the request Origin, `allow-credentials true`. Not documented.
- **Licence:** https://platform-docs.opentargets.org/licence:
  - "Open Targets Platform is marked with CC0 1.0."
  - A per-source table includes ChEMBL and Human Protein Atlas (CC BY-SA 3.0), Cancer Gene Census ("Commercial use for Open Targets"), and Europe PMC (mixed).
  - It also says all listed sources "have agreed for their data to be used without restriction by all Open Targets users".
- **Redistribution:** platform core yes. **Decision (P9.1.3, 2026-11-04, plan section 14 rule 1):** the record keeps association scores and identifiers only (disease id and name, therapeutic areas, the overall score, the datatype scores, the kept datasource scores), and the `datasourceScores` entries of the share-alike or restricted sources of the table above are dropped at parse time (`EXCLUDED_DATASOURCES`), the record naming the dropped ids. The overall score and the datatype scores are the platform's aggregates over every datasource, the dropped ones included, and the record says so.
- **The exclusion list and how its ids were established.** The registry names the sources; the platform names them by datasource ids that no offline document of this repository lists, so the ids were read from the four responses recorded on 2026-11-04 (`data/fixtures/{hbb,cftr,faah2,brca1}/opentargets/api_v4_graphql.json`) before the list was fixed: `europepmc` appears in all four (Europe PMC, mixed licence) and `cancer_gene_census` in BRCA1's (Cancer Gene Census, commercial use restricted), both dropped; no `chembl` id appears in any response, and the clinical-precedence evidence, which the platform derives from ChEMBL, comes as `clinical_precedence` under the datatype `clinical` (HBB, CFTR), so `clinical_precedence` is dropped and `chembl` kept in the list for the id form the registry's name takes; the Human Protein Atlas (CC BY-SA 3.0 in the table) feeds target annotations, not associations, and no id of it appeared, so none is listed. The platform's own `associationDatasources` root field ("List of available evidence datasources and their datatypes") was queried the same day and came back empty (`research/raw/opentargets/association-datasources.json`), so it could not serve as the authority. Every datasource id seen: clingen, clinical_precedence, europepmc, eva, eva_somatic, gene_burden, genomics_england, gwas_credible_sets, impc, orphanet, uniprot_literature, uniprot_variants (HBB); the same without eva_somatic plus reactome (CFTR); europepmc, eva, gwas_credible_sets (FAAH2); cancer_biomarkers, cancer_gene_census, clingen, europepmc, eva, eva_somatic, gene2phenotype, gene_burden, genomics_england, impc, intogen, orphanet, reactome, uniprot_literature, uniprot_variants (BRCA1). A later release that renames a source again is caught by T50's detail, which quotes every id seen beside the list.
- **Requests made (P9.1.3, 2026-11-04).** One data request per set (HBB, CFTR, FAAH2, BRCA1; the responses are the fixtures and nothing asks again), one refused HBB request (400, no data served, the Boolean ordering) and six schema or meta requests that name no entity (`__type` introspections and the `associationDatasources` query), all under `research/raw/opentargets/` with MANIFEST rows. Dynamic mode will not call this source.

## 8. HGNC REST

- **Docs and endpoints:** https://www.genenames.org/help/rest/. Used: `https://rest.genenames.org/fetch/symbol/{symbol}` (Accept: application/json), `/info`.
- **Versioning:** no numbered release; `/info` lastModified 2026-10-30.
- **Rate limits:** "Please only send REST requests at a rate of 10 requests per second". Higher rates may get an IP block with 403.
- **CORS:** measured preflight 200 with `allow-origin *` but **no** allow-methods or allow-headers; GET 200 with `allow-origin *`. Use simple GETs only.
- **Licence:** https://www.genenames.org/about/license/: "released under the Creative Commons Public Domain (CC0) License. This means that any form of reuse of the content is permitted." Attribution recommended (Seal et al., NAR 2023).
- **Redistribution:** yes.

## 9. NCBI Gene and RefSeq

- **Endpoints:** E-utilities `db=gene`, `db=nuccore`, `db=protein`. Used: `esearch` (`HBB[sym] AND Homo sapiens[orgn]`, which returned GeneIDs 3043 and 85344; 85344 is KRT89P, a false hit) and `esummary` (3043).
- **Versioning, rate limits, CORS, licence:** as section 5. The RefSeq FAQ (https://www.ncbi.nlm.nih.gov/books/NBK50679/) returned reCAPTCHA; a RefSeq-specific usage statement is **unverified**.
- **Note:** esummary `genomicinfo` appears 0-based (5225463-5227070 vs Ensembl 1-based 5225464-5227071).

## 10. PDBe API and SIFTS

- **Docs and endpoints:**
  - https://www.ebi.ac.uk/pdbe/pdbe-rest-api (REST docs moved to `https://www.ebi.ac.uk/pdbe/api/v2/doc`)
  - Used: `https://www.ebi.ac.uk/pdbe/api/mappings/uniprot/{pdb}` and `mappings/uniprot_segments/{pdb}`
  - SIFTS: https://www.ebi.ac.uk/pdbe/docs/sifts/
- **Versioning:** "The information is updated and released every week concurrently with the release of new PDB entries" (SIFTS page).
- **Rate limits:** PDBe API FAQ: "Currently, there are no hard limits. Rate limiting may be introduced in future." POST batches up to 1000 IDs.
- **CORS:** documented ("CORS support is enabled on our servers"). Measured preflight 204 and GET 200 with `allow-origin *`.
- **Licence:**
  - https://www.ebi.ac.uk/pdbe/about/public-data-access-statement: data "in accordance with the Creative Commons Zero (CC0) designation".
  - SIFTS asks to cite Dana et al. NAR 2019 and Velankar et al. NAR 2013.
  - EMBL-EBI terms: https://www.ebi.ac.uk/about/terms-of-use (no additional restrictions beyond original owners; "EMBL-EBI expects attribution"; no implied endorsement; overuse may be blocked).
- **Redistribution:** yes, with SIFTS citation.

## 11. InterPro API

- **Docs and endpoints:** https://www.ebi.ac.uk/interpro/api/. Used: `/protein/uniprot/{acc}`.
- **Versioning:** response header `interpro-version: 110.0`.
- **Rate limits:** not stated. Bulk exports go to FTP (https://interpro-documentation.readthedocs.io/en/latest/download.html).
- **CORS:** measured `allow-origin *`, exposes `InterPro-Version`.
- **Licence:** https://interpro-documentation.readthedocs.io/en/latest/license.html: "All of the InterPro, Pfam, PRINTS and SFLD downloadable data provided on the InterPro website is freely available under CC0 1.0". "The included scanning tools and signature collections may be under different license terms."
- **Redistribution:** InterPro entries yes. Member-database signatures (PANTHER, SMART, CATH-Gene3D, PROSITE, etc.) are not confirmed; store only their accession IDs until each is checked.

## 12. Gene Ontology and QuickGO

- **Docs and endpoints:** https://www.ebi.ac.uk/QuickGO/api/index.html. Used: `https://www.ebi.ac.uk/QuickGO/services/annotation/search?geneProductId={acc}` and `https://current.geneontology.org/metadata/release-date.json`.
- **Versioning:** GO release 2026-08-05. The response body was `{date: 2026-08-05}`, which is **not valid JSON**; parse defensively.
- **Rate limits:** not stated.
- **CORS:** measured `allow-origin *` on QuickGO and current.geneontology.org.
- **Licence:** https://geneontology.org/docs/go-citation-policy/:
  - "Gene Ontology Consortium data and data products are licensed under the Creative Commons Attribution 4.0 Unported License".
  - Tools and services should provide "the GO release date and DOI along with the results".
- **Redistribution:** yes with attribution, licence notice, and GO release date and DOI. The GO release DOI was **not** retrieved in this session.

## Phase 2 use of conditional sources (2026-11-01)

The master prompt (§4) allows conditional sources "only for a specific scientific need". Phase 2 uses two:

- **PDBe SIFTS** (§10), for the UniProt to PDB residue mapping. The need: the 2HBS file's own `_struct_ref_seq` aligns P68871 in mature numbering (db_align_beg 1, where UniProt numbers that residue 2). Trusting it would put the HbS highlight on label 7, a glutamate, instead of label 6, the valine. SIFTS is the mapping of record; RCSB's `rcsb_polymer_entity_align` (provenance SIFTS) and a global alignment are cross-checks (`docs/scientific-validation.md`, T21, T22, T25). Licence CC0, with the SIFTS citation in each dataset's attribution.
- **HGNC** (§8), for approved symbols and alias resolution (for example "beta-globin"). Ensembl's `lookup/symbol/homo_sapiens/beta-globin` returned HTTP 400 "No valid lookup found for symbol beta-globin" (measured 2026-11-01), so Ensembl alone cannot resolve this alias. Licence CC0.

ClinVar (§5) is used for the variant's aggregate classification only. Requests carry `tool=helix-research` and no `email` parameter. Trait names and trait cross-references are not stored. Since Phase 6 (2026-11-02) the build also runs `esearch.fcgi?db=clinvar&term=<rsID>` (restricted to an rsID by the adapter) and summarises every returned record, so the curated `clinvar-hbs.json` can list the other records at the rsID (haplotypes, another allele) separately from the allele's own record, with their classification and review status only.

## Phase 9 use for a deletion (2026-11-03, P9.2.1)

Endpoints already registered, used with new inputs; shapes observed in the recorded CFTR fixtures (`data/fixtures/cftr/`):

- **Ensembl `variant_recoder/human/rs113993960`:** for an indel the alleles are keyed as Ensembl writes them with the base before (`TCTT` reference, `T` deletion, `TCTTCTT` insertion); the deletion entry lists `hgvsc` on the MANE transcript (`ENST00000003084.11:c.1521_1523del`), `hgvsg` in the 3' form (`NC_000007.14:g.117559592_117559594del`) and the SPDI in its contextual form (`NC_000007.14:117559590:TCTT:T`). `variation/human/rs113993960` maps the indel anchored on the base before (7:117559591-117559594, `allele_string` TCTT/T/TCTTCTT, `var_class` indel).
- **Ensembl `vep/human/hgvs/<ENST>.<version>:c.<start>_<end>del`:** accepted; the transcript consequence carries `protein_start`/`protein_end` (507/508), `cds_start`/`cds_end` (1521/1523), `cdna_start`, `amino_acids` `IF/I`, `codons` with the deleted bases in capitals (`atCTTt/att`), `hgvsp` `ENSP00000003084.6:p.Phe508del`, term `inframe_deletion`. The `colocated_variants` block (dropped by the schema) carried a `var_synonyms` key naming OMIM, redacted.
- **Ensembl `map/cds/<ENST>/1521..1523`:** one mapping over the span, strand 1.
- **NCBI ClinVar esearch/esummary (tool parameter only):** `esearch` by rsID returned 2 uids (7105, the VCV000007105 record; 634837, a haplotype). The esummary's `variation_set[].variation_loc` gives the left-aligned placement (GRCh38 117559591-117559593); `variation_xrefs[].db_source` and `germline_classification.trait_set[].trait_xrefs[].db_source` name OMIM and are redacted; `einfo` lists a MIM field and an OMIM link, redacted. ClinVar build seen: Build261101-1245.1.
- **RCSB / PDBe SIFTS for 5UAK (cryo-EM):** `_refine` absent, resolution in `_em_3d_reconstruction.resolution` (3.87); SIFTS maps P13569 1-1480 to entity 1, chain A, label 1-1480; 341 residues have no coordinates. 6MSM was fetched once by `check-structure-candidates.ts` (not kept as a fixture) and declares `_entity.pdbx_mutation` E1371Q.
- **UniProt P13569:** the natural variant VAR_000171 at 508 has an `alternativeSequence` block with no alternative sequence (a missing residue) and cites dbSNP rs113993960; five objects were redacted (three cross-references and two disease cross-references).

## Phase 9 use for a domain structure (2026-11-03, P9.2.2)

Endpoints already registered, used with a solution-NMR entry for the first time; shapes observed live on 2026-11-03 by `check-structure-candidates.ts --uniprot P38398 --residue 61 --entries 1JM7,7JZV,7LYB,8GRQ` (report `research/derived/structure-candidates-P38398-61.json`) and in the recorded BRCA1 fixtures (`data/fixtures/brca1/`):

- **RCSB files, 1JM7 (solution NMR):** no `_refine` and no `_em_3d_reconstruction`, so the reader's resolution is null; `atom_site` carries 14 models (`pdbx_PDB_model_num` 1 to 14) and deposits hydrogens (22,246 of 44,268 atom rows have `type_symbol` H), which the contact computation now excludes on both sides; `_pdbx_nmr_ensemble.conformers_calculated_total_number` 25 and `conformers_submitted_total_number` 14 (the dictionary names end in `_number`; `representative_conformer` is "?"); `_pdbx_nmr_representative.conformer_id` 2, `selection_criteria` "closest to the average". `_struct_ref` names entity 1 UNP P38398 and entity 2 UNP Q99728 (BARD1); `_struct_ref_seq_dif` lists residues 111 and 112 of chain A (GLY, LYS) and 116 and 117 of chain B as "cloning artifact". `pdbx_poly_seq_scheme` has no auth number for chain A residues 104 to 112 (unobserved in every model).
- **RCSB Data API, `core/entry/1JM7`:** `rcsb_entry_info.resolution_combined` is absent (the schema already made it optional); `exptl[0].method` "SOLUTION NMR"; revision history present as for every entry.
- **PDBe SIFTS, `mappings/uniprot/1jm7`:** P38398 one segment, entity 1, chain A, UniProt 1 to 110 onto label 1 to 110, identity 1.0, coverage 0.059; Q99728 entity 2, chain B, UniProt 26 to 140 onto label 1 to 115. The segment stops at 110 where the entity's cloning artifact begins.
- **UniProt P38398:** 33 PDB cross-references, four of which cover residue 61 by their `Chains` property (1JM7 NMR A=1-110; 7JZV EM 3.90 Å A=2-104; 7LYB EM 3.28 Å M=1-100; 8GRQ EM 3.87 Å K=6-97). The cryo-EM entries are nucleosome complexes in which 7JZV is a fusion construct declaring `_entity.pdbx_mutation` "UbcH5c C85K".
- **Ensembl `variant_recoder/human/rs28897672`:** three alternate alleles keyed on the forward strand (T, C, G); the gene is on the reverse strand, so c.181T>G (p.Cys61Gly) is the entry keyed "C" with SPDI `NC_000017.11:43106486:A:C`; `variation/human/rs28897672` is a SNP with `allele_string` A/C/G/T at 17:43106487 (GRCh38).
- **NCBI ClinVar esearch/esummary (tool parameter only):** `esearch` by rsID returned 3 uids (17661, the VCV000017661 record of c.181T>G; 54359 and 54360, the other two alleles c.181T>A and c.181T>C), each a single nucleotide variant; the C61G record's canonical SPDI is `NC_000017.11:43106486:A:C`, reviewed by expert panel.

## Not covered or unverified

- NCBI pages behind reCAPTCHA: ClinVar programmatic-access and data-use pages, the E-utilities manual (API-key limit), the RefSeq FAQ.
- UniProt and AlphaFold DB numeric rate limits: not documented on the pages read.
- Behaviour of CORS on error responses (429/5xx): not tested. If an error response lacks `Access-Control-Allow-Origin`, the browser reports a network error instead of 429.
- Ensembl "Image Reuse" and "name and logo" policies: listed in the legal index, not read.
