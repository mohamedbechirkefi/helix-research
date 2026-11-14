<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# Phase 12 hosting assessment (P12.1.1)

Free static hosts read against helix-app `docs/security-review.md` section 8, from each host's own documentation, pricing and terms pages, for the author's choice (question 102, D-H051). The assessment was delegated to an agent; the coordinator checked its three deciding claims against their pages on 2026-11-14: Cloudflare's `_headers` file for Workers static assets (custom headers, per-path rules, detach with `!`, 100 rules, 2,000 characters per line), Vercel Hobby's limits (100 GB transfer, 1,000,000 CDN requests, 1 hour of runtime logs) and Vercel's terms section 4 ("You shall only use the Services under a Hobby plan for your personal or non-commercial use."). No live site was probed: actual response headers are verified only by S30 against a real URL.

**Decision (D-H052, 2026-11-14):** the author chose Cloudflare ("I do not want to use vercel, let's use cloudflare instead"). Target: Cloudflare Workers static assets, the agent's first rank (Cloudflare's migration guide presents Workers as the platform Pages projects move to). The release build writes Cloudflare's `_headers` file and the local server applies that same file, so the local host check tests what would be deployed. The author creates any account; publishing waits for the gate (101 (a)).


All pages read on 2026-11-14 with WebFetch/WebSearch, documentation, pricing and terms pages only. No account was created, nothing was submitted, no site was probed. "Not established" means the host's own pages read here do not say; it is never a guess. Short labels in the tables refer to the source list at the end (S1, S2, ...).

Requirement reminders (section 8): HTTPS only with HSTS max-age=31536000; CSP_WEB as a response header on HTML and `assets/worker-*.js` (or everywhere); nosniff, Referrer-Policy, X-Frame-Options DENY, COOP same-origin, Permissions-Policy, no COEP; MIME types for .html .js .css .json .cif .woff2 .svg .png; `assets/*` immutable for a year, `index.html` and `data/*` no-cache; gzip or brotli; no cookies, analytics or server logic from the host; host's log policy stated. The build is 17 MB in 108 files (107 per section 4 at the time); at rest the start page transfers about 2 MB (security-review.md section 4).

## Table 1. Headers (hard requirement: CSP as a header)

| Host | Custom headers? | Mechanism | Limits / caveats | Source |
|---|---|---|---|---|
| GitHub Pages | No documented mechanism | none | Docs on limits, about and HTTPS never mention headers; community thread #54257 asks for CSP headers | S1, S2, S4, S5 |
| Cloudflare Pages | Yes, any header, can override or detach defaults | `_headers` file in output dir | 100 rules, 2,000 chars per line; not applied to Pages Functions responses (none here) | S6, S8 |
| Cloudflare Workers static assets | Yes, same format | `_headers` file in assets dir | 100 rules, 2,000 chars per line; not applied to Worker-code responses | S7 |
| Netlify | Yes | `_headers` file or `netlify.toml` `[[headers]]` | Ignored: Set-Cookie, Content-Encoding and a few others; CSP, HSTS not in the ignored list | S15 |
| Vercel | Yes, static files included | `vercel.json` `headers` (`source` pattern) | Each header entry counts as a route, 2,048 routes per deployment | S22, S24, S25 |
| GitLab Pages (GitLab.com) | No per-project headers | instance-wide `gitlab_pages['headers']` only (self-managed) | Issue #50: "It is not possible to set on GitLab.com" | S29, S30, S31 |
| Codeberg Pages | Partial: allowlist only | `_headers` (Netlify syntax) | Allowed: CSP, Content-Type, Permissions-Policy, Referrer-Policy, X-Frame-Options, ACAO, ACEH, X-Clacks-Overhead. Not allowed: HSTS, nosniff, COOP, Cache-Control | S33 |
| Render static sites | Yes, any name, value sent as-is | Render Dashboard (path globs) | CSP not named on the page but any header accepted; rules live in the dashboard, not the repo; render.yaml support not established | S37 |
| Firebase Hosting | Yes | `firebase.json` `headers` (glob or RE2 regex) | No disallowed list given; HSTS overwritten on `*.web.app` | S40 |

## Table 2. HTTPS and HSTS (hard requirement: HTTPS)

| Host | HTTPS on default domain | HTTP to HTTPS redirect | HSTS by default | HSTS settable | Source |
|---|---|---|---|---|---|
| GitHub Pages | Yes (github.io, sites after 2016-06-15) | "Enforce HTTPS" setting | Not established (not mentioned) | No (no headers) | S3 |
| Cloudflare Pages | Not established on the pages read | Not established | Not established (search results suggest not; unverified) | Yes, `_headers` | S6, S12 |
| Cloudflare Workers assets | Not established on the pages read | Not established | Not established | Yes, `_headers` | S7 |
| Netlify | Yes, "instantly secured" at netlify.app | Not established on the page read | Not established; docs say to add HSTS yourself for preload | Yes | S16 |
| Vercel | Yes | Not established on the page read | Yes: `max-age=63072000` (2 years) | Yes | S23 |
| GitLab Pages | Yes, "automatically secure" on default domain | Not established | Not established; HSTS only via instance-wide config | No on GitLab.com | S28, S30 |
| Codeberg Pages | Not established | Not established | Not established | No (not in allowlist) | S33 |
| Render | Yes, managed TLS | Yes, automatic | Not established | Yes, dashboard header | S36, S37 |
| Firebase | Not established on the pages read | Not established | Host "overwrites" HSTS on `*.web.app` (value not stated); custom domains serve the configured value | Only on a custom domain | S40 |

## Table 3. MIME, caching, compression

| Host | MIME types | Default Cache-Control | Per-path Cache-Control | Compression | Source |
|---|---|---|---|---|---|
| GitHub Pages | Not established (no MIME doc found) | Not established | No | Not established | S1 to S3 |
| Cloudflare Pages | Content-Type set, detection method not stated; overridable via `_headers` | `public, max-age=0, must-revalidate`, ETag on 200 | Yes (detach then re-set to avoid comma-joined values) | "Gzip and Brotli responses whenever possible" | S6, S9 |
| Cloudflare Workers assets | Wrangler sets type from extension at upload | `public, max-age=0, must-revalidate`, ETag | Yes | Not established for static assets specifically; Cloudflare edge compresses text/javascript, application/json, image/svg+xml (Free plan default Zstandard, gzip/brotli by Accept-Encoding) | S7, S11 |
| Netlify | Not established; Content-Type not in ignored list, so overridable | `public, max-age=0, must-revalidate`; CDN ignores shorter max-age | Yes via headers (downstream) | Brotli and gzip automatic (2020 announcement; no current doc page found) | S15, S17, S18 |
| Vercel | Not documented as overridable in vercel.json; Content-Type settable through `headers` | `public, max-age=0, must-revalidate` when CDN caching is directed | Yes (docs example: `/assets/(.*)` immutable) | Gzip and brotli, allowlist includes javascript, json, css, svg+xml; png/woff2 not compressed (already compressed) | S23, S24, S26 |
| GitLab Pages | Not established | Not established | No on GitLab.com | Serves precompressed `.br`/`.gz` if present; no on-the-fly compression | S28 |
| Codeberg Pages | Content-Type settable (allowlist) | Not established | No (Cache-Control not allowed) | Not established | S33 |
| Render | Not established | Not established (CDN invalidated on deploy) | Yes, dashboard | Brotli stated; gzip not stated | S36, S37 |
| Firebase | Not established | "default 1 hour browser cache" for static | Yes, glob rules | Brotli (2020 blog); current doc does not say | S40, S41, S42 |

Note on `.cif` (4 files): no host documents a type for it. The app reads it as bytes, so any type works, but Cloudflare, Netlify, Vercel, Render and Firebase can set `Content-Type: text/plain` by rule if wanted.

## Table 4. Deployment and free-tier limits

| Host | Private repo on free tier | Deploy without repo | Bandwidth / requests | Files and size | Source |
|---|---|---|---|---|---|
| GitHub Pages | No: GitHub Free has Pages "in public repositories" only; private Pages needs Enterprise Cloud org | Actions artifact upload, still from a repo | 100 GB/month soft; 10 builds/hour soft | 1 GB site; no per-file limit stated | S1, S4, S5 |
| Cloudflare Pages | GitHub app can access selected repos; private repos not explicitly stated | Yes: Wrangler direct upload (20,000 files) or drag-and-drop (1,000 files) | No bandwidth limit listed; 500 builds/month | 20,000 files, 25 MiB per file, 100 projects | S8, S10, S13 |
| Cloudflare Workers assets | Not needed (Wrangler deploy) | Yes, Wrangler | "Requests to static assets are free and unlimited"; 100,000/day applies to Worker invocations | 20,000 files per version (Free), 25 MiB per file | S19, S20 |
| Netlify | Private projects "Owner only"; private-repo deploy on Free not explicit | Yes, `netlify deploy --prod --dir=...` | 300 credits/month hard cap: 20 credits/GB, 2 credits/10k requests, 15 credits per production deploy; site paused when exhausted | Not established | S14, S21, S43, S44 |
| Vercel | Personal repos yes; Git organisations not on Hobby | Yes, `vercel deploy --prod` (CLI) | 100 GB Fast Data Transfer, 1,000,000 CDN requests/month; over limit wait 30 days | 15,000 source files per CLI deploy; 100 MB CLI upload on Hobby; 100 deploys/day | S24, S25, S27 |
| GitLab Pages | Tier listed as Free; private project not explicitly confirmed | No (CI artifact) | Rate limits exist, values not given | 1 GB site / artifact | S28, S32 |
| Codeberg Pages | No: repo "must be public" | No | Not established | Not established | S34 |
| Render | Not established | Not established (deploys from a linked Git branch) | Hobby 5 GB/month bandwidth ($0.15/GB over), 500 build minutes | Not established | S36, S38, S39 |
| Firebase | Not needed (CLI) | Yes, Firebase CLI | Spark: 10 GB/month (quotas page) or 360 MB/day (pricing page); sites disabled after grace period | 10 GB storage, 2 GB per file | S45, S46 |

## Table 5. Terms, privacy, account

| Host | Fits personal non-commercial use? | Clauses that matter | Visitor logs and retention | Card needed for free | Source |
|---|---|---|---|---|---|
| GitHub Pages | Yes (not a free host for online business or SaaS) | none beyond ToS | Visitor IP "logged and stored for security purposes"; retention not established | Not established | S1, S2 |
| Cloudflare (both) | Yes, no personal-only restriction found | Terms 2.5.3: Cloudflare "may add cookies" or "add scripts" for some features, will make it clear and offer disable where possible; Web Analytics on Pages is opt-in and injects a script | End-user IP and traffic data, Cloudflare as processor ("Customer Logs"); no retention period stated | Card only for Paid Services (Terms 4.1) | S12, S47, S48 |
| Netlify | Yes ("individual use") | Hard cap pauses site; Self-Serve Subscription Agreement not read | Device data incl. IP, browser; retention "consistent with the original purpose"; processor role for customer data via DPA | Not established ("never charged for the Free plan") | S14, S43, S49, S50 |
| Vercel | Yes, and only that: "personal or non-commercial use" on Hobby | Vercel may "disable or remove any Project" on Hobby; may use the customer's name/logo in marketing (17.4) | End-user IP, IP-derived city/country, system info; Vercel as processor; retention "minimum necessary"; runtime logs kept 1 hour on Hobby | Not established | S27, S51, S52 |
| GitLab Pages | Not established (terms not read) | n/a (fails headers) | Not established | Not established | none |
| Codeberg Pages | No for this project: service open to FLOSS projects; public content must be under a free licence allowing commercial use (NC licences excluded) | Pages v2 closed to new users; migration to git-pages | Not established | Not established | S34, S35 |
| Render | Yes, no restriction found on pages read | Without a payment method, free services can be suspended for the month on bandwidth overage (stated for free web services; static sites not stated) | Not established | Not stated; payment method avoids suspension | S38 |
| Firebase | Not established (terms not read) | Request logs available via Cloud Logging (customer side) | "Hosting retains IP data for a few months" (abuse detection, usage analysis) | No: "No payment method needed" | S42, S46, S53 |

## Per host

**GitHub Pages.** Fails the hard CSP-header requirement: GitHub documents no way to set response headers, so CSP, HSTS, nosniff, COOP, Permissions-Policy and the cache rules are all unavailable. It also requires a public repository on GitHub Free (private Pages needs an Enterprise Cloud organisation), so helix-app could not publish from its private repo; a separate public deploy repo would be needed. HTTPS and enforcement are fine. Visitor IPs are logged for security, retention not stated. **Fails.**

**Cloudflare Pages.** Meets every header requirement through `_headers` (CSP, HSTS, nosniff, Referrer-Policy, XFO, COOP, Permissions-Policy, per-path Cache-Control with the detach rule). Gzip and brotli are documented. Direct upload with Wrangler needs no repo (20,000 files, 25 MiB per file, far above 108 files). No bandwidth cap listed, no personal-use restriction, card only for paid services. Caveats: HSTS is not documented as default, so it must be in `_headers`; Terms 2.5.3 lets Cloudflare add cookies or scripts for certain features (Web Analytics is opt-in); visitor log retention is not stated. 2025-2026: Cloudflare's migration guide (updated 2026-11-12) presents Workers as the broader platform and describes moving Pages projects to Workers; no deprecation date is stated on the pages read.

**Cloudflare Workers static assets.** Same `_headers` format and defaults as Pages, static asset requests "free and unlimited" on the Free plan, 20,000 files per version, 25 MiB per file, Wrangler deploy from the local `dist/` without a repo. Assets-only (no Worker code) keeps "no server logic". Compression for static assets is not documented on the Workers pages themselves; Cloudflare's edge compression page lists the relevant types. This is the direction Cloudflare is pointing new projects in, so it is the more durable of the two Cloudflare options.

**Netlify.** Technically complete: `_headers` or `netlify.toml`, brotli and gzip, CLI deploy without a repo. The constraint is the credit-based Free plan (introduced 2025): 300 credits per month with a hard limit, after which every site on the team is paused ("Site not available") until the next cycle. Planning estimate, not a measurement: at about 2 MB per first visit (20 credits/GB, so about 0.04 credits) plus 15 credits per production deploy, the allowance covers a few thousand first visits a month. HSTS must be added by hand.

**Vercel.** HSTS sent by default with two years, headers through `vercel.json` (static files included, path patterns), gzip and brotli with JS, JSON, CSS and SVG in the allowlist, CLI deploy of the built folder, 100 GB transfer and 1,000,000 CDN requests per month on Hobby. The Hobby terms limit use to "personal or non-commercial use", which matches this demo but would be breached if it ever became commercial; Vercel may remove Hobby deployments. Runtime logs are kept 1 hour on Hobby; general privacy retention is "minimum necessary", no figure.

**GitLab Pages.** Fails the hard CSP-header requirement on GitLab.com: headers can only be set instance-wide on a self-managed GitLab, and the tracking issue says it "is not possible to set on GitLab.com". Compression only of precompressed files. **Fails.**

**Codeberg Pages.** Allows CSP, Referrer-Policy, XFO and Permissions-Policy in `_headers`, but its allowlist excludes HSTS, nosniff, COOP and Cache-Control, so section 8 items 1, 3 and 5 cannot be met. Repos must be public, Pages v2 is closed to new users, and Codeberg's terms admit only FLOSS projects with licences that allow commercial use, which a custom non-commercial licence does not meet. **Fails** (HSTS, cache rules, terms).

**Render static sites.** Headers can be set (any name, values as-is) and HTTP is redirected to HTTPS; brotli is stated. Headers live in the dashboard rather than a reviewable file. The Hobby plan includes only 5 GB of bandwidth per month (a third-party source dates the cut to 2026-08-01; Render's own page shows 5 GB), overage billed, and deploys come from a linked Git repo (no-repo deploy not established).

**Firebase Hosting.** Headers via `firebase.json`, CLI deploy, no card on Spark, stated IP retention ("a few months"). Weak points: HSTS is overwritten on `*.web.app` with an unstated value, so section 8 item 1 is only guaranteed on a custom domain; free transfer is small and documented inconsistently (10 GB per month on the quotas page, 360 MB per day on the pricing page), with sites disabled after a grace period; compression is documented only in a 2020 blog post.

## Ranking against section 8

| Rank | Host | Verdict | Main reason |
|---|---|---|---|
| 1 | Cloudflare Workers static assets (or Cloudflare Pages) | Meets all items by configuration | Every header and cache rule via `_headers`; unlimited free static requests; no commercial-use clause; no-repo deploy. Set HSTS explicitly; keep Web Analytics off; log retention not stated |
| 2 | Vercel (Hobby) | Meets all items by configuration | HSTS on by default; `vercel.json` headers; brotli; 100 GB. Hobby is personal/non-commercial only, which fits; retention not stated |
| 3 | Netlify (Free) | Meets items, fragile availability | Credit hard cap pauses the site; HSTS by hand |
| 4 | Firebase Hosting (Spark) | Meets items on a custom domain only | HSTS overwritten on web.app; small, inconsistently documented transfer quota; best stated log retention |
| 5 | Render (Hobby) | Meets header items | 5 GB/month bandwidth; headers only in dashboard; Git deploy |
| Fail | Codeberg Pages | Fails HSTS, nosniff, COOP, cache items; fails terms | Header allowlist; FLOSS-only terms; public repo required |
| Fail | GitLab Pages (GitLab.com) | Fails CSP header (hard) | No per-project headers on GitLab.com |
| Fail | GitHub Pages | Fails CSP header (hard) | No custom headers; private-repo Pages not on Free |

Whatever host is chosen, section 8 item 6 requires the bytes budget to be re-measured on it before launch, and the actual response headers must be checked once a site exists (no site was probed here).

## Sources (all read 2026-11-14)

- S1 https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- S2 https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages
- S3 https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https
- S4 https://docs.github.com/en/get-started/learning-about-github/githubs-plans
- S5 https://github.com/orgs/community/discussions/54257 (seen in search results only, not opened) and https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- S6 https://developers.cloudflare.com/pages/configuration/headers/
- S7 https://developers.cloudflare.com/workers/static-assets/headers/
- S8 https://developers.cloudflare.com/pages/platform/limits/
- S9 https://developers.cloudflare.com/pages/configuration/serving-pages/
- S10 https://developers.cloudflare.com/pages/get-started/direct-upload/
- S11 https://developers.cloudflare.com/speed/optimization/content/compression/
- S12 https://developers.cloudflare.com/pages/how-to/web-analytics/ ; HSTS-default search: WebSearch "Cloudflare pages.dev HSTS" (no official Pages statement found)
- S13 https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/
- S14 https://www.netlify.com/pricing/
- S15 https://docs.netlify.com/manage/routing/headers/
- S16 https://docs.netlify.com/manage/domains/secure-domains-with-https/https-ssl/
- S17 https://docs.netlify.com/build/caching/caching-overview/
- S18 https://www.netlify.com/blog/2020/05/20/gain-instant-performance-boosts-as-brotli-comes-to-netlify-edge
- S19 https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- S20 https://developers.cloudflare.com/workers/platform/limits/
- S21 https://docs.netlify.com/api-and-cli-guides/cli-guides/get-started-with-cli/
- S22 https://vercel.com/docs/headers
- S23 https://vercel.com/docs/headers/response-headers
- S24 https://vercel.com/docs/project-configuration/vercel-json
- S25 https://vercel.com/docs/limits
- S26 https://vercel.com/docs/how-vercel-cdn-works/compression
- S27 https://vercel.com/docs/plans/hobby and https://vercel.com/docs/cli/deploy and https://vercel.com/docs/limits/fair-use-guidelines
- S28 https://docs.gitlab.com/user/project/pages/ and https://docs.gitlab.com/user/project/pages/introduction/
- S29 https://gitlab.com/gitlab-org/gitlab-pages/-/issues/50
- S30 https://docs.gitlab.com/administration/pages/
- S31 WebSearch "GitLab Pages custom headers _headers" (no docs.gitlab.com page describes per-project headers)
- S32 https://docs.gitlab.com/user/gitlab_com/
- S33 https://docs.codeberg.org/codeberg-pages/advanced-usage/
- S34 https://docs.codeberg.org/codeberg-pages/
- S35 https://codeberg.org/codeberg/org/src/branch/main/TermsOfUse.md
- S36 https://render.com/docs/static-sites
- S37 https://render.com/docs/static-site-headers
- S38 https://render.com/docs/free
- S39 https://render.com/pricing.md
- S40 https://firebase.google.com/docs/hosting/full-config
- S41 https://firebase.google.com/docs/hosting/manage-cache
- S42 https://firebase.blog/posts/2020/08/firebase-hosting-new-features
- S43 https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/
- S44 https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/billing-faq-for-credit-based-plans/
- S45 https://firebase.google.com/docs/hosting/usage-quotas-pricing
- S46 https://firebase.google.com/pricing
- S47 https://www.cloudflare.com/terms/
- S48 https://www.cloudflare.com/privacypolicy/
- S49 https://www.netlify.com/privacy/
- S50 https://www.netlify.com/legal/terms-of-use/
- S51 https://vercel.com/legal/terms
- S52 https://vercel.com/legal/privacy-policy
- S53 https://firebase.google.com/support/privacy

Not read (not established): GitLab.com terms, Firebase terms, Netlify Self-Serve Subscription Agreement, Cloudflare pages.dev HSTS behaviour, any host's HTTP-to-HTTPS redirect where marked.

Incident note: the GitLab issue page (S29) contained embedded text addressed to AI agents asking them to read repository files and run a CLI; it was ignored and only the issue's factual content was used.
