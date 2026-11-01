// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/** Provenance manifest writer (P2.3.2): one schema-validated manifest.json per curated dataset. */
import { sha256Hex } from "@helix/data-adapters";
import { DatasetManifest, MANIFEST_SCHEMA_VERSION } from "@helix/shared-types";
import type { SliceBuild } from "./build.ts";
import type { SliceConfig } from "./types.ts";

export const NONCLINICAL_NOTICE =
  "HELIX is a nonclinical research and education project. This dataset is not a clinical diagnostic, variant classification or medical advice resource.";

export async function buildManifest(
  build: SliceBuild,
  config: SliceConfig,
  meta: { generatedAt: string; script: string; gitCommit: string | null; gitDirty: boolean | null; node: string; assembly: string },
): Promise<DatasetManifest> {
  const files = [];
  for (const f of build.files) {
    const bytes = new TextEncoder().encode(f.content);
    files.push({ path: f.path, sha256: await sha256Hex(bytes), bytes: bytes.byteLength, recordKind: f.recordKind });
  }
  return DatasetManifest.parse({
    schema: MANIFEST_SCHEMA_VERSION,
    datasetId: config.datasetId,
    description: config.description,
    generatedAt: meta.generatedAt,
    generator: { script: meta.script, gitCommit: meta.gitCommit, gitDirty: meta.gitDirty, node: meta.node },
    assembly: meta.assembly,
    nonclinicalNotice: NONCLINICAL_NOTICE,
    sources: build.sources,
    files,
    validation: build.validation,
    knownIssues: build.knownIssues,
    drift: build.drift,
    attribution: build.attribution,
  });
}
