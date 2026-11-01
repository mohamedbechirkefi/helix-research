// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
import { defineConfig } from "vite";

export default defineConfig({
  build: { target: "es2022" },
  worker: { format: "es" },
});
