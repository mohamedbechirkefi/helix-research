// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5182, strictPort: true },
  build: { chunkSizeWarningLimit: 8000, reportCompressedSize: true },
});
