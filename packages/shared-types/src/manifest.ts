// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/** Dataset manifest (P2.3.2): one manifest.json per curated dataset. */
import { z } from "zod";
import { DriftReport, KnownIssue } from "./entities.ts";
import { Provenance, ValidationResult } from "./provenance.ts";

export const MANIFEST_SCHEMA_VERSION = "helix-dataset-manifest/1" as const;

export const DatasetManifest = z.object({
  schema: z.literal(MANIFEST_SCHEMA_VERSION),
  datasetId: z.string().regex(/^[a-z0-9-]+$/),
  description: z.string(),
  generatedAt: z.iso.datetime(),
  generator: z.object({ script: z.string(), gitCommit: z.string().nullable(), gitDirty: z.boolean().nullable(), node: z.string() }),
  assembly: z.string(),
  nonclinicalNotice: z.string(),
  sources: z.array(Provenance).min(1),
  files: z
    .array(
      z.object({
        path: z.string(),
        sha256: z.string().regex(/^[0-9a-f]{64}$/),
        bytes: z.number().int().min(0),
        recordKind: z.string(),
      }),
    )
    .min(1),
  validation: z.array(ValidationResult),
  knownIssues: z.array(KnownIssue),
  drift: z.array(DriftReport),
  attribution: z.array(z.object({ source: z.string(), licence: z.string(), text: z.string() })),
});
export type DatasetManifest = z.infer<typeof DatasetManifest>;
