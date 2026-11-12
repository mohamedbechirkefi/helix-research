# HX-P11-2026-11-12-security: security, privacy and supply-chain review, web part (P11.3.2)

```yaml
id:            HX-P11-2026-11-12-security
date:          2026-11-12
phase:         P11 (P11.3.2, security, privacy and supply-chain review; suite S25, web part; carried item C15)
hypothesis:    The web build takes no untrusted input into HTML, URLs or code without validation, executes no generated code, sends nothing about the visitor, has no known advisory in anything that ships, and runs unchanged under a Content Security Policy with no inline script, no eval and no inline style, enforced.
git_commit:    helix-app edb56b0 to d9bda9e (harness 5165d8e, bc31a77; results and the review page d9bda9e), pinned unchanged to helix-research 62d45de; helix-research docs, results and this entry in the commit of this entry; by a delegated agent on Opus 5.5
config:        helix-app e2e/security.mjs (page checks, --bytes, --classify), the preview's CSP test switch (HELIX_CSP=dev|web, HELIX_CSP_ALL, HELIX_CSP_REPORTS in apps/web/vite.config.ts; the suites' static hosts through e2e/lib.mjs cspStatic); under the policy: budgets.mjs, a11y.mjs --all-sets (S21), nollm.mjs (S19), phase10-replay.mjs (S15 and S16), layout.mjs --axe=1 (S29), phase10-final-checks.mjs --only=prompts,web (S17 without its model spot checks); npm audit (npm 10.9.9) in both repositories and the four experiments, all and --omit=dev
seed:          none
data_version:  the five curated sets at helix-research 62d45de, unchanged; the TP53 dynamic fixtures of data/fixtures/dynamic/tp53
hardware:      Apple M1 Pro, the development Mac; Chrome 157 headless; Node 22.23.3
duration:      about 4 hours of wall-clock (the two suite campaigns about 25 minutes each, the S29 rerun about 10 minutes)
cost:          0 (no model call, no live API call; npm audit's registry queries only)
```

## Measurements

Raw results: helix-app `apps/web/e2e/results/*p11sec*` (`security-p11sec.json`, `security-p11sec-csp.json`, `security-bytes-p11sec-{none,web,web-all,dev,dev-reports}.json`, `csp-p11sec-csp.json`, the suite files of both tags, `npm-audit-p11sec.json` and `-prod`); helix-research `journal/results/npm-audit-p11sec-*.json` (helix-research and the four experiments, all and `-prod`). Review: helix-app `docs/security-review.md`.

| Measurement | Value |
|---|---|
| `npm audit`, all and `--omit=dev` | 0 info, low, moderate, high or critical in helix-app (396 dependencies), helix-research (72), molstar-embed (301), molstar-r3f-bridge (320), tauri-shell (55), webllm-browser (67); 12 runs, exit 0 each |
| C15 body-parser | 2.4.0 in helix-app (root override, lockfile and installed) and both Mol* experiments; absent elsewhere; not in the bundle |
| Manifests | 16 tracked `package.json` files: no `^`, `~` or range except one peer `react >=19` (design-system); every npm tree and the Tauri crate graph have a committed lockfile |
| CLA action | pinned by a 40-character SHA (`ca4a40a7...`, v2.6.1); the only action in either repository |
| Node toolchain | tarball sha256 `23b25245...2f53` equals its SHASUMS256 line; installed `bin/node` identical to the tarball's; the checksum file is unsigned |
| HTML sinks and dynamic code in Helix's source | 0; in the bundle: React DOM's own handling, Mol*'s interface (its hover readout reachable, from curated hash-checked files), zod's `Function("")` probe |
| A question carrying markup | shown as text; no element created, nothing ran |
| A 100,000-character question | 2,503 ms to the end of its executed plan; 100,000 of one letter 61 ms; no page error |
| Privacy run (TP53 dynamic from fixtures, one question) | 34 requests: 21 to the app, 12 to the four APIs (all from fixtures), 1 refused model probe; only browser headers; Referer the origin only; no cookie; storage, IndexedDB and caches empty |
| Bytes at rest, default preview | 1,999,973 (3 starts); the same with the policy header on the documents and worker, on every response, and with the development policy; 2,000,573 with a report endpoint (two 300-byte report entries) |
| A `<meta>` policy | +367 bytes in an uncompressed document: 2,000,340, over the 2,000 kB budget |
| Suites under the policy, enforced | budgets 18/18 ok; S21 82 screens 0 violations; S29 245 screens 0 overlap 0 axe violations; S19 14/14; S15 and S16 as allowlisted; S17 prompts and web; page checks; all exit 0 |
| CSP reports | 791 over 68 pages: 786 zod's probe (two copies, 394 each), 5 deliberate (enforcement probe page), 0 unexpected |
| Scratch variants (not shipped) | zod deduplicated: 1,975,376 bytes (-24,597), one probe report per page; `jitless` set in `main.tsx`: still two reports per page, -64 bytes; `maxLength={500}`: 1,999,978 (+5) |
| Default suites (final) | budgets, page checks, S21, S19, both replays exit 0; unit tests 574 (app) and 542 + 5 skipped (research), typechecks, check:pin, web:build exit 0 |

## Interpretation

Every point of the plan's section 7 holds for the web build, and nothing found needed a change to shipped code. The supply chain is clean on the day of the audit, C15 is closed, and the only remaining supply-chain observation is structural: the research packages, linked by path, bring their own copy of zod into the bundle. The security properties rest on design rather than on the model: typed actions on semantic targets, validation against the trusted context, the split rule that keeps retrieved text away from the model, and rendering as text. The one place where markup is rendered from data is Mol*'s hover label, whose input is curated and hash-checked. The Content Security Policy is the main new artefact: strict (no inline script, no eval, no inline style), it ran the main suites unchanged, and the measurement settles the bytes question: as a header it is free on the budget metric, because Chrome counts a fixed 300 bytes of headers per response, while a report endpoint is not. Two consequences for Phase 12 follow: the host must send the header, and HTTPS is required both for integrity and because the data check needs a secure context. The review is AI-run and automated: no penetration test, no second reviewer, Chrome only for the policy runs, recorded fixtures rather than live APIs, and the desktop part not yet done.

## Failures

The first S29 run under the policy exited 1 on 95 screens because `layout.mjs` injected axe-core as an inline script element, which the policy refused (harness, not app; fixed in bc31a77 and rerun, exit 0; the failing run kept as `layout-p11sec-csp-addscripttag.json` and its reports as `csp-p11sec-csp-layout-addscripttag.json`). In trials before any recorded run, `security.mjs` tested eval with `Function("")` inside a DevTools evaluation, which the page's policy does not govern (replaced by a string handed to `setTimeout`), and read host names from redacted URLs. The first byte measurement under the policy read 2,000,873 because the policy then always carried a report endpoint and each report is a resource entry; the endpoint is now only added when reports are collected. The first `maxLength` variant did not apply (the transform ran after JSX compilation) and was rebuilt with the transform first. The zod `jitless` attempt did not remove the probe; recorded as found.
