<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HX-P12-2026-11-14-p1211: release build, Cloudflare headers, host and contents checks

```yaml
id:            HX-P12-2026-11-14-p1211
date:          2026-11-14
phase:         P12 (P12.1.1 static build and hosting; P12.1.3 version, identifier and zod; decisions D-H051, D-H052)
hypothesis:    The release build can leave out the concept prototypes, carry version 1.0.0, send no CSP report, and be served with every header of helix-app docs/security-review.md section 8 from one Cloudflare `_headers` file, with the no-model product intact on that server.
git_commit:    helix-app 4a42829 to cd2a35d (delegated build: pins then changes), 96c9fb8 (coordinator: S19 --web-port, verification); research pin e390be0 unchanged
config:        helix-app docs/reviews/phase-12-p1211-run/ (the agent's scripts and exits), verify/ (the coordinator's)
seed:          none
data_version:  the five curated sets at e390be0
hardware:      Apple M1 Pro, 16 GB, macOS 15.3.1; Chrome 157 headless; Node 22.23.3
duration:      about 40 min of runs (agent 17:10 to 17:26, coordinator 17:27 to 17:30)
cost:          0 (no account, no deploy)
```

## Method

Delegated build (one agent, model opus), each behaviour pinned by a failing test or check before the change; the coordinator read the diff and reran the release build and the checks independently. Host target Cloudflare Workers static assets (D-H052): the release build writes `dist/_headers` in Cloudflare's format from `apps/web/host-headers.ts` and `csp-policy.ts`; `e2e/static-host.mjs` (Node built-ins only) applies that file with Cloudflare's rules (file order, one splat, comma-joined duplicates, `!` detach) and serves br or gzip; S30 (`e2e/host-check.mjs`) checks section 8 against a URL; S31 (`e2e/release-contents.mjs`) checks the built folder.

## Results

| Check | Exit | Result | File (helix-app `apps/web/e2e/results/`) |
|---|---|---|---|
| App tests, typecheck, pin | 0, 0, 0 | 650 tests | `docs/reviews/phase-12-p1211-run/` |
| Release build | 0 | 94 files (108 in the Phase 11 build), concept prototypes and their four font families compiled out (`__HELIX_CONCEPTS__` false under `HELIX_RELEASE=1`) | `release-contents-p1211.json` |
| S31 release contents | 0 | concepts, concept fonts, source maps, 5 fonts in the notices, manifest of 94 files, `_headers` (2 rules, longest line 357 characters, CSP equal to CSP_WEB), version 1.0.0 | `release-contents-p1211.json`, `-p1211v.json` |
| S30 on the local static host | 0 | pass: CSP on the page and the worker, nosniff, referrer, frame, COOP, permissions, no COEP, MIME on 94 responses, cache (12 assets immutable; `/`, `/index.html` and 79 data files no-cache), compression, sha256 of 93 files, no cookies, `_headers` not served; not applicable on loopback: HTTPS, HSTS (sent), logs | `host-check-p1211.json`, `-p1211v.json` |
| S30 negative control on vite preview (no headers) | 1 | 11 requirements fail, as expected | `docs/reviews/phase-12-p1211-run/` |
| CSP reports, classified | 0 | 3 reports, all 3 the security suite's deliberate probes; 0 from zod (Phase 11: zod's probe reported on every page load) | `csp-p1211-csp.json` |
| Bytes at rest, 3 starts, gzip | 0 | 1,970,226 (Phase 11 gate 1,975,305) | `security-bytes-p1211-preview.json`, `-static-gzip.json` |
| Bytes at rest, static host, brotli quality 5 | 0 | 1,786,664 | `security-bytes-p1211-static-br.json` |
| S21 on the static host | 0 | | `a11y-p1211-static.json` |
| S6 model-free scenarios on the static host | 0 | fallback, follow-up, unsupported, cancel-camera | `e2e-p1211-static-nomodel-*.json` |
| S19 web half on the static host (coordinator) | 0 | 0 failures, every set's questions executed by the rules, no request to a model | `nollm-p1211v-static-web.json` |
| cargo test, clippy, desktop build | 0, 0, 0 | identifier `io.github.mohamedbechirkefi.helix`, version 1.0.0; no DMG built | `docs/reviews/phase-12-p1211-run/` |

## Failures

- The agent's first runs of the whole S6 and S19 against the static host exited 1 (`nollm-p1211-static.json`): on 127.0.0.1 the page counts as a development page and calls the local model, which the served policy refuses (42 failures, all that call). A public host never serves a development page, so these runs did not test the release build. The coordinator added `--web-port` to S19 so its web half (a non-development host name) runs against the static host; S6's model scenarios stay with the development preview. The plan's S30 is amended accordingly.
- Setting zod's flag as the first import of `main.tsx` did not remove the reports (the shared chunk holding zod ran first); every `zod` import now resolves to a module that sets the flag first.
- The agent's intermediate bytes reading after the zod change alone was not kept in a result file; only the final readings above are reported.

## Interpretation

The release build meets the licence decision and the version decision, sends no policy report, and one generated `_headers` file gives every section 8 header on a server that applies Cloudflare's rules. Not shown: what Cloudflare itself sends (its MIME types, its compression, whether its default `Cache-Control` combines with the file's), HTTPS and HSTS, which only a real URL can show; S30 must be rerun there before any announcement.

## Next action

P12.1.2 and P12.1.3: the D-H043 usability items, gene-name recognition (rules version 7), the Safari diagnosis.
