<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HX-P1-2026-11-01-val6-contacts: inter-chain contacts of beta Val6 in 2HBS

Retrospective entry written 2026-11-01 from the recorded evidence; not contemporaneous.

```yaml
id:            HX-P1-2026-11-01-val6-contacts
date:          2026-11-01
hypothesis:    The deposited 2HBS coordinates show the mutant valine touching another haemoglobin
               tetramer, the lateral contact described by the structure's primary citation. Supported
               if at least one beta Val6 side chain lies within 4.5 A of another chain.
git_commit:    43ef20b
config:        scripts/research/val6_contacts.py; cutoff 4.5 A; atoms CG1/CG2 of beta Val6;
               scope: asymmetric unit, model 1, no symmetry mates
seeds:         n/a, deterministic
data_version:  research/raw/rcsb/2HBS.cif (revision 1.5; sha256 in research/raw/rcsb/MANIFEST.tsv)
hardware:      Apple M1 Pro, 10 cores, 16 GB, macOS 15.3.1 (reference Mac, ROADMAP)
duration:      not recorded
cost:          0
software:      Python 3.12.1, Biopython 1.88
```

## Methods

The script finds all atoms of other chains within 4.5 A of the CG1 and CG2 atoms of residue 6 in each beta chain (B, D, F, H), in auth numbering, inside the deposited asymmetric unit.

## Raw results + uncertainty

From `research/derived/val6_contacts_2HBS.json`:

| Beta chain | Residue | Contacts within 4.5 A |
|---|---|---|
| B | VAL | none |
| D | VAL | none |
| F | VAL | none |
| H | VAL | chain B: ALA 70, ASP 73, THR 84, PHE 85, LEU 88; waters B 232 and B 302 |

Uncertainty: the cutoff is a fixed choice. Sensitivity to it was not tested.

## Failures

**Negative finding:** three of the four Val6 residues have no inter-chain contact in the file. Assembly 1 (chains A to D) contains Val6 in chains B and D but **no** lateral contact, because the H-to-B contact lies between the two tetramers of the asymmetric unit.

## Limits / confounders

- Crystal symmetry mates were not generated. The contacts of the B, D and F valines with neighbouring tetramers in the crystal are therefore unknown, not absent.
- **Inference, not verified:** the H-to-B contact is the lateral contact that the primary citation describes ("the mutant valine interacting with a pocket between the E and F helices on another tetramer"; Harrington, Adachi and Royer 1997, abstract read through Europe PMC).
- A contact in a crystal is not a demonstration of the fibre contact in cells.

## Interpretation

Supported for one valine, inside the asymmetric unit only. Any HELIX label for this view must say it is a contact in the crystal's asymmetric unit.

## Decision

**Continue.** Phase 2 recomputes the contacts in TypeScript (check T28) and compares them with this Biopython result; they match (`docs/data-core.md` §3). The curated contacts record labels the symmetry-mate possibility as evidence class 4, inference (`docs/scientific-validation.md` §6).

## Artifacts

`research/derived/val6_contacts_2HBS.json`, `scripts/research/val6_contacts.py`, `research/hbs-mapping-note.md` §6
