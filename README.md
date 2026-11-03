# Helix: research

Helix is a nonclinical, research-grounded exploration of genes, variants and proteins, in which real scientific data drives an interactive environment. This repository holds its **research phase**:

- scientific and technology research
- data adapters for public resources (Ensembl, UniProt, RCSB PDB and others)
- the validated scientific core (identifier, coordinate and residue mapping, provenance)
- curated datasets with provenance manifests
- the evaluation of free AI models for grounded, typed action plans

**Not medical:** Helix is not a clinical diagnostic, variant classification or medical advice tool, and it never collects personal genetic or health data.

**Zero spend:** everything here runs on free software, free public data and free models.

**Status:** Phase 2 (data core). The HBB (beta-globin) slice is built from live Ensembl, UniProt, RCSB PDB, PDBe SIFTS, ClinVar, HGNC and AlphaFold records into `data/curated/hbb/`, with a provenance manifest. See `docs/data-core.md` (layout, choices, how to run) and `docs/scientific-validation.md` (every check and its last result).

```
npm install && npm test        # Node >= 22.18
npm run build:hbb              # live rebuild of data/curated/hbb (wrapper around build-gene.ts --gene hbb)
npm run build:gene -- --gene hbb --fixtures --out /tmp/hbb   # any gene with a data/specs/<gene>.json, from the recorded fixtures
```

## License

Source-available for non-commercial research under the [Helix Source-Available Non-Commercial Research License v1.0](LICENSE). This is not OSI open source. See [NOTICE.md](NOTICE.md) for which material is under which license, and [LICENSE_HISTORY.md](LICENSE_HISTORY.md) for the history. Data from public scientific resources keep their providers' terms.

Contributions are welcome under the [CLA](CLA.md); see [CONTRIBUTING.md](CONTRIBUTING.md).
