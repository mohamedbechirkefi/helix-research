// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts", "scripts/data-preparation/test/**/*.test.ts", "scripts/ai-benchmark/test/**/*.test.ts"],
    environment: "node",
    testTimeout: 20_000,
  },
});
