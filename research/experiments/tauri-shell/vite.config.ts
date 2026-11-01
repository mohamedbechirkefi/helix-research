// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
// Builds src/shell.ts as one IIFE file that the Rust side injects as a webview initialization script.
import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    outDir: 'dist-shell', emptyOutDir: true, minify: false,
    lib: { entry: 'src/shell.ts', formats: ['iife'], name: 'HelixShell', fileName: () => 'shell.js' },
  },
});
