// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * Licence and attribution per source, as recorded in docs/data-source-registry.md
 * (policy pages read 2026-11-01). The registry is the authority; this table mirrors it.
 */
import type { LicenceId, SourceId } from "@helix/shared-types";

export const SOURCE_TERMS: Record<SourceId, { licence: LicenceId; attribution: string; policyUrl: string }> = {
  ensembl: {
    licence: "Ensembl-no-restrictions",
    attribution: "Ensembl (EMBL-EBI), https://www.ensembl.org. Ensembl imposes no restrictions on use of its data; third-party content is excluded from this dataset.",
    policyUrl: "https://jun2026.archive.ensembl.org/info/about/legal/disclaimer.html",
  },
  uniprot: {
    licence: "CC-BY-4.0",
    attribution: "UniProt Consortium, UniProtKB, https://www.uniprot.org, CC BY 4.0. Fields were selected and restructured by HELIX.",
    policyUrl: "https://www.uniprot.org/help/license",
  },
  rcsb: {
    licence: "CC0-1.0",
    attribution: "RCSB PDB (rcsb.org) Data API, CC0 1.0. Original structure authors are credited in the entry citation.",
    policyUrl: "https://www.rcsb.org/pages/usage-policy",
  },
  "rcsb-files": {
    licence: "CC0-1.0",
    attribution: "wwPDB archive file served by RCSB PDB (files.rcsb.org), CC0 1.0. Original structure authors are credited in the entry citation.",
    policyUrl: "https://www.rcsb.org/pages/usage-policy",
  },
  "pdbe-sifts": {
    licence: "CC0-1.0",
    attribution: "SIFTS via the PDBe API (EMBL-EBI), CC0. Cite Dana et al., NAR 2019 and Velankar et al., NAR 2013.",
    policyUrl: "https://www.ebi.ac.uk/pdbe/about/public-data-access-statement",
  },
  "ncbi-clinvar": {
    licence: "NCBI-public-domain",
    attribution: "NCBI ClinVar via E-utilities. NCBI places no restrictions on use of the data; submitters may claim rights in their submissions. See the NCBI disclaimer and copyright notice.",
    policyUrl: "https://www.ncbi.nlm.nih.gov/home/about/policies/",
  },
  hgnc: {
    licence: "CC0-1.0",
    attribution: "HUGO Gene Nomenclature Committee (HGNC), https://www.genenames.org, CC0. Seal et al., NAR 2023.",
    policyUrl: "https://www.genenames.org/about/license/",
  },
  alphafold: {
    licence: "CC-BY-4.0",
    attribution: "AlphaFold DB (Google DeepMind and EMBL-EBI), CC BY 4.0. Predicted model; the in-file disclaimer is kept.",
    policyUrl: "https://alphafold.ebi.ac.uk/",
  },
  reactome: {
    licence: "CC0-1.0",
    attribution: "Reactome Content Service, https://reactome.org, data CC0 (attribution encouraged). Pathway membership is a curated annotation; diagrams and icons (CC BY 4.0) are not used.",
    policyUrl: "https://reactome.org/license",
  },
};
