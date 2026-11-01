// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
//
// P3.2.2 driver: system Google Chrome via puppeteer-core (no browser download).
//   1. WebGPU adapter info.
//   2. Mol* page (P1.4.1 build, served on :5181) in an iframe; frame intervals while it spins:
//      baseline, during model load, during generation.
//   3. Model load time (cold = fresh profile, so the weights are downloaded; warm = cached).
//   4. Download size = bytes in Cache Storage after load.
//   5. Schema-constrained generation on a 10-item benchmark subset, scored with @helix/ai-planning.
//   6. Peak resident memory of the Chrome process tree (ps), sampled every 500 ms.
//
// Usage: node scripts/measure.mjs --model Qwen3.5-2B-q4f16_1-MLC [--warm] [--worker] [--profile DIR]
import puppeteer from "puppeteer-core";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildMessages, contextForItem, planJsonSchema, scoreItem, aggregate, percentile, PROMPT_VERSION } from "../../../../packages/ai-planning/src/index.ts";
import { loadHbbContext, loadQuestions } from "../../../../scripts/ai-benchmark/lib.ts";

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const MODEL = opt("model", "Qwen3.5-2B-q4f16_1-MLC");
const WARM = args.includes("--warm");
const WORKER = args.includes("--worker");
const LOAD_ONLY = args.includes("--load-only"); // cold download + load + cache size only (no frames, no generation)
const PROFILE = resolve(opt("profile", "/Users/bechir/research/helix/.tools/chrome-webllm-profile"));
const PAGE = opt("page", "http://localhost:5182/");
const MOLSTAR = opt("molstar", "http://localhost:5181/?mode=imperative&source=local&measure=0");
const SUBSET = (opt("items", "S01,S09,S11,S14,F01,U01,U03,A01,I01,FR01")).split(",");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MAX_TOKENS = 700;

if (!WARM && existsSync(PROFILE)) rmSync(PROFILE, { recursive: true, force: true }); // cold: fresh profile, empty cache
mkdirSync(PROFILE, { recursive: true });
mkdirSync("results", { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  userDataDir: PROFILE,
  protocolTimeout: 10_800_000,
  args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--window-size=1100,800"],
  defaultViewport: { width: 1100, height: 800 },
});
const chromeVersion = await browser.version();
const rootPid = browser.process().pid;

// Memory of Chrome's process tree.
function treeRssKiB() {
  const out = execFileSync("ps", ["-axo", "pid=,ppid=,rss="], { encoding: "utf8" });
  const rows = out.trim().split("\n").map((l) => l.trim().split(/\s+/).map(Number));
  const kids = new Map();
  for (const [pid, ppid] of rows) kids.set(ppid, [...(kids.get(ppid) ?? []), pid]);
  const rss = new Map(rows.map(([pid, , r]) => [pid, r]));
  let total = 0;
  const stack = [rootPid];
  while (stack.length) {
    const p = stack.pop();
    total += rss.get(p) ?? 0;
    stack.push(...(kids.get(p) ?? []));
  }
  return total;
}
const mem = { phase: "start", peaks: {} };
const memTimer = setInterval(() => {
  try {
    const r = treeRssKiB();
    mem.peaks[mem.phase] = Math.max(mem.peaks[mem.phase] ?? 0, r);
  } catch {}
}, 500);

const page = await browser.newPage();
const consoleLines = [];
page.on("console", (m) => consoleLines.push(`${m.type()}: ${m.text()}`.slice(0, 300)));
page.on("pageerror", (e) => consoleLines.push(`pageerror: ${String(e).slice(0, 300)}`));
await page.goto(PAGE, { waitUntil: "load" });
await page.waitForFunction("window.__w && window.__w.ready");
const gpu = await page.evaluate(() => window.__w.gpuInfo());
const modelRecord = await page.evaluate((m) => window.__w.modelRecord(m), MODEL);
console.log("chrome", chromeVersion, "gpu", JSON.stringify(gpu));
const result = { date: new Date().toISOString(), chromeVersion, headless: true, model: MODEL, warm: WARM, worker: WORKER, gpu, modelRecord, promptVersion: PROMPT_VERSION, items: SUBSET, maxTokens: MAX_TOKENS };

// Mol* iframe and a frame sampler inside it.
let molFrame = null;
if (!LOAD_ONLY) try {
  await page.evaluate((src) => window.__w.addFrame(src), MOLSTAR);
  molFrame = page.frames().find((f) => f.url().startsWith(MOLSTAR.split("?")[0]));
  await molFrame.waitForFunction("window.__helix && (window.__helix.ready || window.__helix.error)", { timeout: 60000 });
  await molFrame.evaluate(() => {
    const p = window.__plugin;
    p.canvas3d.setProps({ trackball: { animate: { name: "spin", params: { speed: 0.5, axis: [0, 1, 0] } } } });
    window.__fs = { deltas: [], running: false };
    window.__fsStart = () => {
      window.__fs = { deltas: [], running: true };
      let last = performance.now();
      const tick = (now) => {
        window.__fs.deltas.push(now - last);
        last = now;
        if (window.__fs.running) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    window.__fsStop = () => {
      window.__fs.running = false;
      const s = window.__fs.deltas.slice(3).sort((a, b) => a - b);
      const q = (x) => (s.length ? +s[Math.min(s.length - 1, Math.floor(x * s.length))].toFixed(2) : null);
      return { frames: s.length, p50Ms: q(0.5), p95Ms: q(0.95), p99Ms: q(0.99), maxMs: s.length ? +s[s.length - 1].toFixed(2) : null, over20ms: s.filter((x) => x > 20).length, over50ms: s.filter((x) => x > 50).length, meanMs: s.length ? +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(2) : null };
    };
  });
  result.molstar = { error: await molFrame.evaluate(() => window.__helix.error ?? null) };
} catch (e) {
  result.molstar = { error: `iframe setup failed: ${e.message}` };
  molFrame = null;
}
const frames = {};
const sampleStart = async () => molFrame && molFrame.evaluate(() => window.__fsStart());
const sampleStop = async (name) => {
  if (molFrame) frames[name] = await molFrame.evaluate(() => window.__fsStop());
};

// Baseline: Mol* spinning, no model.
mem.phase = "baseline";
await sampleStart();
await new Promise((r) => setTimeout(r, 6000));
await sampleStop("baseline");

// Load.
mem.phase = "load";
await sampleStart();
try {
  result.load = await page.evaluate((m, w) => window.__w.load(m, w), MODEL, WORKER);
} catch (e) {
  result.load = { error: String(e.message ?? e).slice(0, 500) };
}
await sampleStop("load");
console.log("load", JSON.stringify(result.load));
result.cache = await page.evaluate(() => window.__w.cacheBytes());
console.log("cache", JSON.stringify(result.cache));

// Idle with the model resident.
mem.phase = "resident-idle";
await sampleStart();
await new Promise((r) => setTimeout(r, 4000));
await sampleStop("residentIdle");

// Generation on the subset.
const ctxBase = loadHbbContext();
const all = loadQuestions();
const items = SUBSET.map((id) => all.find((i) => i.id === id)).filter(Boolean);
const schema = JSON.stringify(planJsonSchema());
const extraBody = /qwen3/i.test(MODEL) ? { enable_thinking: false } : null;
result.extraBody = extraBody;
const rows = [];
if (!result.load.error && !LOAD_ONLY) {
  mem.phase = "generate";
  await sampleStart();
  for (const it of items) {
    const ctx = contextForItem(ctxBase, it);
    const messages = buildMessages(it.query, ctx);
    let out;
    try {
      out = await page.evaluate((m, s, ex, mt) => window.__w.gen(m, s, 0, ex, mt), messages, schema, extraBody, MAX_TOKENS);
    } catch (e) {
      out = { raw: "", error: String(e.message ?? e).slice(0, 500), firstTokenMs: null, totalMs: null, usage: null };
    }
    const score = scoreItem(it, out.raw, ctx).score;
    rows.push({ item: it.id, category: it.category, ...out, score });
    console.log(it.id, score.correctAndValid ? "OK " : score.schemaValid ? "val" : "BAD", Math.round(out.totalMs ?? 0), "ms", JSON.stringify(out.usage?.extra ?? out.usage ?? {}).slice(0, 160), score.issues.slice(0, 2).join(" "), out.error ?? "");
  }
  await sampleStop("generate");
}
mem.phase = "end";
clearInterval(memTimer);

const scores = rows.map((r) => r.score);
const dec = rows.map((r) => r.usage?.extra?.decode_tokens_per_s).filter((x) => typeof x === "number");
const pre = rows.map((r) => r.usage?.extra?.prefill_tokens_per_s).filter((x) => typeof x === "number");
result.generation = {
  n: rows.length,
  aggregate: rows.length ? aggregate(scores) : null,
  latencyMs: { firstToken: { p50: percentile(rows.map((r) => r.firstTokenMs).filter((x) => x != null), 50), p95: percentile(rows.map((r) => r.firstTokenMs).filter((x) => x != null), 95) }, total: { p50: percentile(rows.map((r) => r.totalMs).filter((x) => x != null), 50), p95: percentile(rows.map((r) => r.totalMs).filter((x) => x != null), 95) } },
  decodeTokensPerSec: { p50: percentile(dec, 50), min: dec.length ? Math.min(...dec) : null, max: dec.length ? Math.max(...dec) : null },
  prefillTokensPerSec: { p50: percentile(pre, 50) },
  errors: rows.filter((r) => r.error).length,
};
result.frames = frames;
result.memoryPeakMiB = Object.fromEntries(Object.entries(mem.peaks).map(([k, v]) => [k, Math.round(v / 1024)]));
result.console = consoleLines.slice(0, 60);
const tag = `${MODEL}-${WARM ? "warm" : "cold"}${WORKER ? "-worker" : ""}${LOAD_ONLY ? "-loadonly" : ""}`;
result.loadOnly = LOAD_ONLY;
writeFileSync(join("results", `measure-${tag}.json`), JSON.stringify(result, null, 1) + "\n");
writeFileSync(join("results", `raw-${tag}.jsonl`), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
console.log(JSON.stringify({ load: result.load?.loadMs ?? result.load, cacheMB: Math.round((result.cache?.bytes ?? 0) / 1e6), frames, gen: result.generation, mem: result.memoryPeakMiB }, null, 1));
await browser.close();
