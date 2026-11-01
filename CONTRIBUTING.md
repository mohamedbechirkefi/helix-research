# Contributing to Helix (research)

Thank you for your interest in Helix.

Helix is an independent, source-available research project maintained by Mohamed Bechir Kefi. This repository holds its research phase: scientific data acquisition and validation, coordinate and residue mapping, provenance, and AI model evaluation for grounded, typed visual actions.

We welcome technical suggestions, bug reports, reproducibility results, scientific corrections and Pull Requests.

The project is available for non-commercial research under its current license (the Helix Source-Available Non-Commercial Research License). It is not OSI-approved open-source software.

Helix is nonclinical. It is not a diagnostic, variant classification or medical advice tool, and contributions must not add personal genetic or health data.

## 1. How to contribute

Contributions are welcome in these areas:

- Scientific correctness: identifiers, assemblies, transcripts, HGVS, residue and structure mapping
- Data adapters for public scientific resources, and their provenance
- Validation tests and reproducibility
- AI model benchmarking for structured, grounded action plans
- Performance measurements
- Documentation and research discussions

For major architectural changes, please open an Issue before starting implementation.

Any change to data processing or mapping must keep the scientific validation tests green and must record provenance (source, identifier and version, retrieval date, transformations). Never add a scientific value that does not come from a cited source record.

## 2. Non-commercial research

The current LICENSE permits downloading, running, testing, benchmarking and locally modifying the licensed material for non-commercial research and educational purposes.

Commercial use, incorporation into other products and general redistribution are not permitted without separate authorization.

The repository's initial MIT commit retains its original permissions. See NOTICE.md.

Third-party scientific data keep their providers' terms (see NOTICE.md and `docs/data-source-registry.md`).

## 3. Pull Request requirements

Before submitting a Pull Request, please ensure that:

- Your contribution is original or appropriately licensed.
- You have the necessary rights to submit the work.
- Your code does not contain credentials, secrets, confidential information or personal data.
- You have included relevant tests, scientific validation tests in particular.
- You have described any performance or research results.
- You have identified third-party dependencies, data sources and their licenses or terms.
- New files carry the header `SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0` where the format allows.
- You are prepared to accept the Contributor License Agreement (CLA) before your contribution is merged.

## 3a. Development conventions

**Commands** (Node 22.18 or later):

```
npm install
npm test             # unit and scientific validation tests, offline (fixtures)
npm run typecheck    # tsc over every package
npm run test:live    # live API tests (HELIX_LIVE=1); uses the network, run deliberately
npm run build:hbb    # live rebuild of data/curated/hbb with its provenance manifest
```

Python research scripts run through `uv` with the locked environment (`uv.lock`).

**Architecture decisions** are recorded in `docs/adr/NNNN-short-title.md`. Each record has:

- date and status;
- context;
- decision;
- alternatives rejected and why;
- consequences.

A later change amends or supersedes the earlier record, and says so.

**Provenance rules:**

- Every scientific value comes from a cited source record: source, identifier and version, retrieval date, the transformations applied and the validation result.
- Curated data is rebuilt by script, never edited by hand.
- Identifiers from sources Helix may not redistribute (for example OMIM or HGMD) are filtered out of curated data and fixtures.
- Licence and attribution notes go in `docs/data-source-registry.md` and `docs/license-attribution-cost-audit.md`.

**File headers.** New source and documentation files start with `SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0`, as a comment where the format allows.

**Prose.** Documentation is in English. External claims cite a URL and the access date, and assumptions are marked as such.

**Privacy.** Never put an email address, a name or any other personal identifier in a request header, a URL parameter, a log, a fixture or a committed file:

- Scripted requests send the User-Agent `helix-research`.
- NCBI requests send `tool` only, never `email`.
- Before committing, check your changes for addresses, for example with `git grep -nE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"`.

## 4. Contributor License Agreement

A recorded acceptance of the Contributor License Agreement (CLA.md) is required before merging copyrightable code or documentation contributions.

**How to sign:** when you open a Pull Request, an automated "CLA Assistant" check comments on it. Read the CLA, then post this exact comment on your Pull Request:

    I have read the Helix CLA v1.0 and I hereby sign it

The check records your signature: your public GitHub username and account ID, the date and the PR. It then turns green. You sign once, and it covers your later contributions too. If the check does not update, comment `recheck`.

The CLA allows the maintainer to use, modify, distribute, relicense and commercially exploit accepted contributions. Contributors retain copyright in their original contributions, and submitting a Pull Request does not automatically transfer ownership of your code.

Checking a Pull Request checkbox is not, by itself, a signature of the CLA; the signing comment above is.

## 5. Attribution

Contributors may be recognized through:

- git commit history
- Pull Request records
- release notes
- contributor acknowledgments

Attribution does not create ownership of the repository or confer additional commercial licensing rights.

## 6. Project governance

Mohamed Bechir Kefi is the project owner and lead maintainer. Only the maintainer can change the protected `main` branch.

The maintainer retains responsibility for:

- project direction and roadmap
- acceptance or rejection of contributions
- release management
- repository administration
- licensing decisions for material the maintainer owns or has sufficient rights to relicense

## 7. Responsible disclosure

Please avoid publicly disclosing sensitive security issues before they can be addressed. Use GitHub's private vulnerability reporting feature when available, or request a private contact method.

## 8. Questions and suggestions

Open a GitHub Issue to discuss technical ideas, experiments or proposed improvements.

Repository: https://github.com/mohamedbechirkefi/helix-research

Thank you for contributing to Helix research.
