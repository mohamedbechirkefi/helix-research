// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
// Copies committed raw records into public/data (git-ignored) so Vite can serve them.
import { mkdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
for (const [src, name] of [['rcsb/2HBS.cif', '2HBS.cif'], ['ensembl/seq_ENST00000335295_cds.fa', 'seq_ENST00000335295_cds.fa']]) {
  const from = resolve(here, '../../../raw', src);
  const to = resolve(here, '../public/data', name);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  console.log(`copied ${from} -> ${to}`);
}
