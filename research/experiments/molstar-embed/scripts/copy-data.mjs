// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
// Copies the committed raw 2HBS mmCIF into public/data so Vite can serve it.
// The copy is git-ignored; the source of truth stays in research/raw/rcsb/.
import { mkdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../../../raw/rcsb/2HBS.cif');
const dst = resolve(here, '../public/data/2HBS.cif');
mkdirSync(dirname(dst), { recursive: true });
copyFileSync(src, dst);
console.log(`copied ${src} -> ${dst}`);
