// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
// Extracts still frames of the Phase 12 demo recording for the report's figures, in headless Chrome (no ffmpeg on the
// build machine). Each frame is the decoded video at the given time, saved as PNG at the recording's size.
// Usage: node scripts/report/video_frames.mjs --puppeteer=<path to puppeteer-core> --video=<mp4> --out=<dir> name=seconds ...
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const opt = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const shots = process.argv.slice(2).filter((a) => !a.startsWith('--')).map((a) => a.split('='));
const puppeteer = createRequire(resolve(opt.puppeteer, 'package.json'))('puppeteer-core');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const dir = resolve(opt.out);
writeFileSync(resolve(dir, '_frames.html'), `<video muted preload="auto" src="${pathToFileURL(resolve(opt.video)).href}"></video>`);
await page.goto(pathToFileURL(resolve(dir, '_frames.html')).href);
for (const [name, t] of shots) {
  const data = await page.evaluate(async (t) => {
    const v = document.querySelector('video');
    v.pause();
    const until = (ev) => new Promise((r) => { v.addEventListener(ev, r, { once: true }); setTimeout(r, 15000); });
    if (v.readyState < 2) await until('loadeddata');
    const seeked = until('seeked');
    v.currentTime = t;
    await seeked;
    await new Promise((r) => setTimeout(r, 300));
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    return c.toDataURL('image/png');
  }, Number(t));
  const file = resolve(opt.out, `${name}.png`);
  writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
  console.log(`${name}: ${t} s -> ${file}`);
}
await browser.close();
