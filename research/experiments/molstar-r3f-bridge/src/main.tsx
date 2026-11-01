// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
import './gl-count'; // must run before Mol* and R3F create their contexts
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<App />);
