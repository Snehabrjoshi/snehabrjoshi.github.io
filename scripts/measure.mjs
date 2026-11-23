import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { startPreview, launchBrowser, BASE, glCounterInit } from './lib.mjs';

// Software WebGL renders a frame in seconds; sample long enough to count some.
const SAMPLE_MS = +(process.env.SAMPLE_MS ?? 12000);
const stop = await startPreview();
const browser = await launchBrowser();
const results = {};
try {
  for (const mode of ['night', 'day']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.addInitScript(glCounterInit);
    await page.addInitScript((m) => localStorage.setItem('bookshop-theme', m), mode);
    await page.goto(BASE, { waitUntil: 'commit' });
    await page.waitForSelector('html[data-scene-state=idle]', { timeout: 120000 });
    await page.waitForTimeout(4000); // past the first frames and shader compiles
    const sample = await page.evaluate(async (ms) => {
      const s = window.__glStats;
      const start = { ...s };
      await new Promise((r) => setTimeout(r, ms));
      const frames = s.frames - start.frames;
      return {
        frames,
        drawCallsPerFrame: Math.round((s.calls - start.calls) / frames),
        trianglesPerFrame: Math.round((s.triangles - start.triangles) / frames),
      };
    }, SAMPLE_MS);
    results[mode] = sample;
    await page.close();
  }
} finally {
  await browser.close();
  stop();
}

const assets = join('dist', 'assets');
results.bundle = readdirSync(assets)
  .filter((f) => /\.(js|css)$/.test(f))
  .map((f) => {
    const buf = readFileSync(join(assets, f));
    return {
      file: f,
      kb: +(buf.length / 1024).toFixed(1),
      gzipKb: +(gzipSync(buf).length / 1024).toFixed(1),
    };
  });

console.log(JSON.stringify(results, null, 2));
const out = process.argv.indexOf('--json');
if (out > 0) writeFileSync(process.argv[out + 1], JSON.stringify(results, null, 2));
