<!-- SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0 -->
# HX-P1-2026-11-01-hbs-mapping: HbS from genome coordinate to 2HBS residue

Retrospective entry written 2026-11-01 from the recorded evidence; not contemporaneous.

```yaml
id:            HX-P1-2026-11-01-hbs-mapping
date:          2026-11-01
hypothesis:    The sickle-cell allele can be mapped without any hand-typed position from the
               GRCh38 genome through the MANE Select transcript and UniProt P68871 to a residue in
               PDB 2HBS, and every layer of that mapping can be confirmed by at least two
               independent records. Contradicted if two records disagree with no documented reason.
git_commit:    43ef20b
config:        scripts/research/inspect_hbs_mapping.py (offline, reads research/raw/)
seeds:         n/a, deterministic
data_version:  research/raw/ snapshot of 2026-11-01 (entry HX-P1-2026-11-01-raw-snapshot)
hardware:      Apple M1 Pro, 10 cores, 16 GB, macOS 15.3.1 (reference Mac, ROADMAP)
duration:      not recorded
cost:          0
software:      Python 3.12.1, Biopython 1.88 (uv.lock)
```

## Methods

- The script reads the raw Ensembl, UniProt, RCSB, PDBe/SIFTS and ClinVar records.
- It translates the CDS with Biopython, aligns the 2HBS beta entity sequence to UniProt, and reads `pdbx_poly_seq_scheme` and `atom_site` from the deposited mmCIF.
- It writes `research/derived/hbs_mapping_2HBS.json`.
- The mapping and its sources are written up in `research/hbs-mapping-note.md`.

## Raw results + uncertainty

| Layer | Value | Agreeing records |
|---|---|---|
| Gene | HBB ENSG00000244734.6, GRCh38 chr11:5225464-5229395, strand -1 | Ensembl lookup |
| Transcript | ENST00000335295.4 = NM_000518.5, MANE Select, 628 nt, exons 142 + 223 + 263 | Ensembl, HGNC, UniProt cross-reference |
| CDS | 444 nt; codon 7 = GAG; c.20 = A; cDNA position 70 | Ensembl sequence, VEP |
| Genome | c.20 = GRCh38 11:5227002 (codon 7 = 5227001-5227003) | Ensembl `map/cds`, `map/translation`, variant_recoder |
| Allele | rs334 is multi-allelic (T/A/C/G). Only A gives HbS: NC_000011.10:g.5227002T>A, c.20A>T, p.Glu7Val | Ensembl variant_recoder, ClinVar VCV000015333.183 |
| Protein | Translation equals ENSP00000333994.3 and UniProt P68871 (147 aa); VAR_002863 at position 7 | Biopython, Ensembl, UniProt |
| Mature numbering | Initiator Met removed, chain 2-147, so p.7 = mature 6 ("E6V") | UniProt features, 2HBS `pdbx_mutation` |
| Structure | 2HBS entity 2, chains B, D, F, H: label_seq_id 6 = auth_seq_id 6 = VAL | SIFTS (unp 2-147 to residue 1-146), RCSB alignment, UniProt PDB xref, `atom_site` |

ClinVar classification for VCV000015333.183: Pathogenic (criteria provided, multiple submitters, no conflicts), ClinVar build of 2026-10-25.

Uncertainty: not applicable. Each value is a recorded identifier or position, confirmed by the agreeing records listed.

## Failures

- **Negative finding: the mmCIF's own reference numbering is off by one.** The 2HBS file's `_struct_ref_seq` aligns the beta chains to P68871 positions 1-146, and `_struct_ref_seq_dif` gives the variant at P68871 position 6. Current UniProt numbers that Glu as 7. A parser that trusts these categories would highlight the wrong residue: label 7, GLU. SIFTS, RCSB and UniProt agree with each other and disagree with the file. `_struct_ref_seq` is rejected as a mapping source, and SIFTS is the mapping of record.
- Stale statement found while writing this entry: `research/hbs-mapping-note.md` §4 says both `variant_recoder` attempts are in the manifest. The HTTP 500 attempt was later deleted (`research/raw/README.md`), so the note is out of date on that point.

## Limits / confounders

- The rule `label_seq_id = auth_seq_id = UniProt position - 1` holds for P68871 positions 2-147 in 2HBS entity 2 only. It is a property of this entry, not a general rule.
- label = auth for every polymer atom in 2HBS is a coincidence of this entry. For non-polymers the two schemes differ: heme label J = auth B 153.
- Version lag between resources on the same day: the UniProt cross-reference names ENSG00000244734.5 while Ensembl serves .6; VEP names P68871.216 while UniProt serves entry version 219.
- Not fetched: a VCF line for HbS, and the GRCh37 HGVS g. string. Only the GRCh37 position, 5248232, was returned.

## Interpretation

Supported within the tested perimeter. Every layer is confirmed by two or more records, and the one disagreement (the file's `_struct_ref_seq`) has a documented cause: the file's legacy mature numbering.

## Decision

**Continue.** Phase 2 encodes the mapping as code. The selection follows SIFTS, the mature index is derived from the UniProt Chain feature, and a check records what `_struct_ref_seq` would have selected (T25). See entry HX-P2-2026-11-01-hbb-dataset-build.

## Artifacts

- `research/hbs-mapping-note.md`, `research/derived/hbs_mapping_2HBS.json`, `scripts/research/inspect_hbs_mapping.py`
- `docs/scientific-model-and-coordinate-mapping.md` (§9, pitfalls)
