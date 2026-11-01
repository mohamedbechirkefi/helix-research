// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
//
// Drives the built page in the system Google Chrome (puppeteer-core) and records
// load time, read-back, API call log and frame times into results/.
// Usage: node scripts/measure.mjs [baseUrl] [--headed]
import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'node:fs';

const base = process.argv[2]?.startsWith('http') ? process.argv[2] : 'http://localhost:5181/';
const headed = process.argv.includes('--headed');
const uncapped = process.argv.includes('--uncapped');
const tag = `${headed ? 'headed' : 'headless'}${uncapped ? '-uncapped' : ''}`;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
mkdirSync('results', { recursive: true });
mkdirSync('screenshots', { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: !headed,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1280,800', ...(uncapped ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : [])],
  defaultViewport: { width: 1280, height: 800 },
});
const chromeVersion = await browser.version();
const runs = [
  { mode: 'imperative', source: 'local' },
  { mode: 'mvs', source: 'local' },
  { mode: 'imperative', source: 'rcsb' },
];
const all = { date: new Date().toISOString(), chromeVersion, headless: !headed, uncapped, base, runs: [] };
for (const r of runs) {
  const ctx = await browser.createBrowserContext(); // cold HTTP cache per run
  const page = await ctx.newPage();
  const consoleLines = [];
  page.on('console', (m) => consoleLines.push(`${m.type()}: ${m.text()}`.slice(0, 300)));
  const t0 = Date.now();
  await page.goto(`${base}?mode=${r.mode}&source=${r.source}`, { waitUntil: 'load' });
  await page.waitForFunction('window.__helix && (window.__helix.ready || window.__helix.error)', { timeout: 60000 });
  const wallToReadyMs = Date.now() - t0;
  await new Promise((res) => setTimeout(res, 400));
  await page.screenshot({ path: `screenshots/${r.mode}-${r.source}${uncapped ? '-uncapped' : ''}.jpg`, type: 'jpeg', quality: 70 });
  // Simulated user click at the canvas centre (the camera target is H:Val6) to exercise the click event.
  const eventsBefore = await page.evaluate(() => window.__helix.events.length);
  await page.mouse.click(470, 400);
  await new Promise((res) => setTimeout(res, 300));
  const clickEvents = await page.evaluate((n) => window.__helix.events.slice(n), eventsBefore);
  await page.waitForFunction('window.__helix.measured || window.__helix.error', { timeout: 60000 });
  const h = await page.evaluate(() => JSON.parse(JSON.stringify(window.__helix)));
  all.runs.push({ ...r, wallToReadyMs, clickEvents, helix: h, console: consoleLines.slice(0, 40) });
  console.log(r.mode, r.source, 'wall', wallToReadyMs, 'load', h.loadToFirstDrawMs, 'frames', JSON.stringify(h.frames), h.error ?? '', 'click->', JSON.stringify(clickEvents).slice(0, 300));
  await ctx.close();
}
writeFileSync(`results/measure-${tag}.json`, JSON.stringify(all, null, 1));
await browser.close();
