// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
//
// P1.5.2: injected by the Tauri shell into the unchanged P1.4.1 page.
// Waits for the Mol* page to be ready, then records:
//   - the page's own WebGL2/WebGPU probe and Mol* read-back,
//   - a Mol* viewport screenshot (proof that WKWebView rendered 2HBS),
//   - three ways to reach a local Ollama server: direct fetch, the Tauri HTTP plugin, a Rust command,
//   - a plain GET to files.rcsb.org from the tauri:// origin,
// and hands the report to Rust, which writes it to disk.
import { invoke } from '@tauri-apps/api/core';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

if (window.top === window) {
  const OLLAMA = 'http://localhost:11434';
  const schema = {
    type: 'object',
    properties: {
      intent: { type: 'string' },
      actions: { type: 'array', items: { type: 'object', properties: { type: { type: 'string', enum: ['enterWorld', 'loadStructure', 'highlightResidue', 'focusCamera', 'revealEvidence'] }, pdbId: { type: 'string' }, note: { type: 'string' } }, required: ['type'] } },
    },
    required: ['intent', 'actions'],
  };
  const body = JSON.stringify({
    model: 'llama3.1', stream: false, format: schema, options: { temperature: 0, seed: 7 },
    messages: [
      { role: 'system', content: 'You plan visual actions for a molecular viewer. Reply with JSON only. Allowed action types: enterWorld, loadStructure, highlightResidue, focusCamera, revealEvidence. Do not invent residue numbers.' },
      { role: 'user', content: 'Show me where the sickle-cell mutation affects hemoglobin.' },
    ],
  });
  const timed = async (name: string, fn: () => Promise<unknown>) => {
    const t = performance.now();
    try { return { name, ok: true, ms: +(performance.now() - t).toFixed(0), result: await fn().then((r) => r), msTotal: +(performance.now() - t).toFixed(0) }; }
    catch (e) { return { name, ok: false, msTotal: +(performance.now() - t).toFixed(0), error: String(e) }; }
  };
  const parseChat = (j: any) => { const content = j?.message?.content; let parsed: unknown = null; try { parsed = JSON.parse(content); } catch { /* keep raw */ } return { model: j?.model, total_duration_ms: j?.total_duration ? Math.round(j.total_duration / 1e6) : null, eval_count: j?.eval_count, content, parsed }; };

  const run = async () => {
    const t0 = performance.now();
    while (!(window as any).__helix?.ready && !(window as any).__helix?.error && performance.now() - t0 < 60000) await new Promise((r) => setTimeout(r, 200));
    const H = (window as any).__helix ?? {};
    await new Promise((r) => setTimeout(r, 1200)); // camera animation settles
    const report: Record<string, unknown> = {
      date: new Date().toISOString(), location: location.href, userAgent: navigator.userAgent,
      pageReady: !!H.ready, pageError: H.error ?? null, gpu: H.gpu, readback: H.readback,
      pluginInitMs: H.pluginInitMs, callLog: H.callLog, navStart: performance.timing ? performance.now() : null, loadToFirstDrawMs: H.loadToFirstDrawMs, actionToDrawMs: H.actionToDrawMs, camera: H.camera,
    };
    try {
      const uri: string = await (window as any).__plugin.helpers.viewportScreenshot.getImageDataUri();
      await invoke('save_file', { name: 'webview-molstar.png', base64: uri.split(',')[1] });
      report.screenshot = 'webview-molstar.png';
    } catch (e) { report.screenshot = 'failed: ' + e; }
    // Wait for the page's frame measurement (runs after ready).
    const t1 = performance.now();
    while (!H.measured && performance.now() - t1 < 15000) await new Promise((r) => setTimeout(r, 200));
    report.frames = H.frames ?? null;

    report.rcsbPlainGet = await timed('fetch https://files.rcsb.org/header/2HBS.cif', async () => { const r = await fetch('https://files.rcsb.org/header/2HBS.cif'); return { status: r.status, bytes: (await r.text()).length }; });
    report.ollama = [
      await timed('webview fetch (direct, CORS)', async () => parseChat(await (await fetch(`${OLLAMA}/api/chat`, { method: 'POST', body })).json())),
      await timed('tauri-plugin-http fetch', async () => parseChat(await (await tauriFetch(`${OLLAMA}/api/chat`, { method: 'POST', body, headers: { 'Content-Type': 'application/json' } })).json())),
      await timed('Rust command ollama_chat', async () => parseChat(JSON.parse(await invoke<string>('ollama_chat', { body })))),
      await timed('tauri-plugin-http to a URL outside the scope (expected: refused)', async () => { const r = await tauriFetch('https://example.org/'); return { status: r.status }; }),
    ];
    await invoke('save_file', { name: 'webview-report.json', base64: btoa(unescape(encodeURIComponent(JSON.stringify(report, null, 1)))) });
    await invoke('done');
  };
  window.addEventListener('load', () => { run().catch((e) => invoke('save_file', { name: 'webview-error.txt', base64: btoa(String(e)) })); });
}
