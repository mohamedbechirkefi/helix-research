// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/**
 * The constants of dynamic mode (Phase 9, P9.3.1) that need no adapter: kept apart from
 * slice/dynamic.ts so that a page which only names the steps or validates a query (the app's main
 * bundle) does not pull the HGNC adapter in; the worker, which resolves and builds, imports dynamic.ts.
 */
import type { SourceId } from "@helix/shared-types";

/** The dataset id of a dynamic set: "dynamic-" and the approved symbol, lower-cased ("dynamic-tp53"). */
export const DYNAMIC_DATASET_PREFIX = "dynamic-";
export const dynamicDatasetId = (symbol: string): string => `${DYNAMIC_DATASET_PREFIX}${symbol.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`;

/** The five non-curated genes of plan section 16 rule 5, chosen once; their fixtures are test inputs under data/fixtures/dynamic/<symbol>/, never curated sets. */
export const DYNAMIC_FIXTURE_GENES = ["TP53", "EGFR", "INS", "APOE", "HBA1"] as const;

/** The sources a dynamic build calls, and no other (plan section 16 rules 1 and 2). */
export const DYNAMIC_SOURCES: readonly SourceId[] = ["hgnc", "ensembl", "uniprot", "alphafold"];

/** What a visitor may type: a symbol or alias of 2 to 10 characters, letters, digits and hyphens, starting with a letter. */
export const DYNAMIC_QUERY = /^[A-Za-z][A-Za-z0-9-]{1,9}$/;

/** The manifest generator fields of a dynamic set (plan section 16 rule 2). */
export const DYNAMIC_GENERATOR_SCRIPT = "dynamic (browser)";
export const DYNAMIC_MODE = "dynamic" as const;

/**
 * The requests a dynamic build makes, in order, named as `acquireSlice` logs them: the gauge of the
 * app lists them before the first response. The HGNC resolution precedes them (one request for a
 * symbol, two for an alias) and `acquireSlice` fetches the symbol's record again as input H1.
 */
export const DYNAMIC_STEPS: readonly { id: string; source: SourceId; label: string }[] = [
  { id: "resolve", source: "hgnc", label: "HGNC: resolve the symbol" },
  { id: "E1", source: "ensembl", label: "Ensembl: release" },
  { id: "E2", source: "ensembl", label: "Ensembl: assembly" },
  { id: "E3", source: "ensembl", label: "Ensembl: gene and transcripts" },
  { id: "E4", source: "ensembl", label: "Ensembl: MANE Select transcript" },
  { id: "E5", source: "ensembl", label: "Ensembl: CDS" },
  { id: "E6", source: "ensembl", label: "Ensembl: cDNA" },
  { id: "E7", source: "ensembl", label: "Ensembl: protein" },
  { id: "U1", source: "uniprot", label: "UniProt: entry" },
  { id: "H1", source: "hgnc", label: "HGNC: gene record" },
  { id: "A1", source: "alphafold", label: "AlphaFold DB: prediction" },
  { id: "A1-model", source: "alphafold", label: "AlphaFold DB: model file" },
];
