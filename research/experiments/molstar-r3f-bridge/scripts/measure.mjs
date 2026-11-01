// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
//
// Drives the bridge page in system Chrome: R3F->Mol* click, Mol*->R3F click,
// WebGL context count and frame times. Usage: node scripts/measure.mjs [--uncapped] [--headed]
import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'node:fs';

const base = 'http://localhost:5182/';
const uncapped = process.argv.includes('--uncapped');
const headed = process.argv.includes('--headed');
mkdirSync('results', { recursive: true }); mkdirSync('screenshots', { recursive: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: !headed,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', ...(uncapped ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : [])],
  defaultViewport: { width: 1400, height: 820 },
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { date: new Date().toISOString(), chrome: await browser.version(), uncapped, headless: !headed, runs: [] };

async function open(query) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const consoleLines = [];
  page.on('console', (m) => consoleLines.push(`${m.type()}: ${m.text()}`.slice(0, 200)));
  const t0 = Date.now();
  await page.goto(base + query, { waitUntil: 'load' });
  await page.waitForFunction('window.__helix && (window.__helix.ready || window.__helix.error)', { timeout: 60000 });
  return { ctx, page, wallToReadyMs: Date.now() - t0, consoleLines };
}
const H = (page, expr, ...args) => page.evaluate(expr, ...args);

for (const layout of ['side', 'overlay']) {
  const { ctx, page, wallToReadyMs, consoleLines } = await open(`?layout=${layout}`);
  await sleep(2500); // R3F camera settles on the overview
  const run = { layout, wallToReadyMs };
  run.basics = await H(page, () => ({ loadMs: window.__helix.loadMs, cds: window.__helix.cds, glContexts: window.__helix.glContexts, mappingCheck: window.__helix.mappingCheck, error: window.__helix.error }));
  await page.screenshot({ path: `screenshots/${layout}-overview.jpg`, type: 'jpeg', quality: 65 });

  // 1) R3F -> Mol*: real pointer click on codon 7 in the R3F canvas.
  const pos = await H(page, () => window.__helix.codonScreenPos(7));
  const n0 = await H(page, () => window.__helix.events.length);
  await page.mouse.click(pos.x, pos.y);
  await sleep(1500);
  run.r3fToMolstar = await H(page, (n) => ({ clickAt: null, events: window.__helix.events.slice(n), lastSync: window.__helix.lastSync }), n0);
  run.r3fToMolstar.clickAt = pos;
  await page.screenshot({ path: `screenshots/${layout}-codon7.jpg`, type: 'jpeg', quality: 65 });

  // 2) Mol* -> R3F: point the Mol* camera at chain H residue 10 (camera only), then click the Mol* canvas centre.
  // In the side layout reset first; in the overlay we stay in the protein phase (Mol* owns the pointer).
  if (layout === 'side') await H(page, () => window.__helix.back());
  run.molstarToR3f = [];
  for (const seq of [2, 3, 5, 6, 8, 10, 12, 13]) {
    await page.evaluate((seq) => window.__helix.focusResidueCameraOnly('H', seq), seq);
    await sleep(300);
    const molRect = await page.evaluate(() => {
      const c = [...document.querySelectorAll('canvas')].find((x) => x.dataset.role !== 'r3f');
      const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    const n1 = await H(page, () => window.__helix.events.length);
    await page.mouse.click(molRect.x, molRect.y);
    await sleep(700);
    const ev = await H(page, (n) => window.__helix.events.slice(n), n1);
    const picked = ev.find((e) => e.type === 'molstar.click')?.residue;
    const stores = ev.filter((e) => e.type === 'store').map((e) => `${e.source}:${e.codon}`);
    run.molstarToR3f.push({ aimedAt: `H${seq}`, picked: picked ? `${picked.label_comp_id} ${picked.label_asym_id}${picked.label_seq_id}` : null, storeUpdates: stores });
    if (seq === 10) await page.screenshot({ path: `screenshots/${layout}-molstar-click.jpg`, type: 'jpeg', quality: 65 });
  }

  // 3) Frame times with both canvases alive.
  run.frames = [];
  for (const o of [{ molSpin: false, r3fSpin: false }, { molSpin: true, r3fSpin: false }, { molSpin: false, r3fSpin: true }, { molSpin: true, r3fSpin: true }]) {
    run.frames.push(await page.evaluate((o) => window.__helix.measure(4000, o), o));
  }
  run.console = consoleLines.filter((l) => !l.startsWith('log')).slice(0, 20);
  out.runs.push(run);
  console.log(layout, JSON.stringify({ gl: run.basics.glContexts, sync: run.r3fToMolstar.lastSync, m2r: run.molstarToR3f, r2mEvents: run.r3fToMolstar.events.filter((e) => e.type === 'store').map((e) => `${e.source}:${e.codon}`) }).slice(0, 900));
  for (const f of run.frames) console.log('  ', JSON.stringify(f));
  await ctx.close();
}
// Baselines: each canvas alone.
for (const q of ['?layout=side&r3f=0', '?layout=side&molstar=0']) {
  const { ctx, page } = await open(q);
  await sleep(1500);
  const gl = await H(page, () => window.__helix.glContexts);
  const f = await page.evaluate(() => window.__helix.measure(4000, { molSpin: true, r3fSpin: true }));
  out.runs.push({ baseline: q, glContexts: gl, frames: [f] });
  console.log(q, gl.length, JSON.stringify(f));
  await ctx.close();
}
writeFileSync(`results/measure-${headed ? 'headed' : 'headless'}${uncapped ? '-uncapped' : ''}.json`, JSON.stringify(out, null, 1));
await browser.close();
