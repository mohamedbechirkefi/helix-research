// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
// Counts WebGL contexts created on the page. Imported first, before Mol* and R3F.
export const glContexts: { kind: string; canvasId: string; at: number }[] = [];
const orig = HTMLCanvasElement.prototype.getContext;
const seen = new WeakMap<HTMLCanvasElement, string>();
let n = 0;
(HTMLCanvasElement.prototype as any).getContext = function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
  const ctx = (orig as any).call(this, kind, ...rest);
  if (ctx && /webgl/.test(kind) && !seen.has(this)) {
    const id = `canvas#${++n}${this.dataset.role ? ':' + this.dataset.role : ''}`;
    seen.set(this, id);
    glContexts.push({ kind, canvasId: id, at: +performance.now().toFixed(1) });
  }
  return ctx;
};
