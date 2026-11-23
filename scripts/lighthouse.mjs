// Software WebGL makes the performance score a lower bound.
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { startPreview, BASE } from './lib.mjs';

mkdirSync('screenshots', { recursive: true });
const flags = '--headless=new --use-angle=swiftshader --enable-unsafe-swiftshader';
const stop = await startPreview();
const results = {};
try {
  for (const preset of ['desktop', 'mobile']) {
    const out = `screenshots/lighthouse-${preset}.json`;
    const args = [
      '-y',
      'lighthouse@12',
      BASE,
      '--only-categories=performance,accessibility',
      '--output=json',
      `--output-path=${out}`,
      `--chrome-flags=${flags}`,
      '--quiet',
    ];
    if (preset === 'desktop') args.push('--preset=desktop');
    execFileSync('npx', args, { stdio: 'inherit' });
    const report = JSON.parse(readFileSync(out, 'utf8'));
    const audit = (id) => report.audits[id]?.displayValue ?? '—';
    results[preset] = {
      performance: Math.round(report.categories.performance.score * 100),
      accessibility: Math.round(report.categories.accessibility.score * 100),
      FCP: audit('first-contentful-paint'),
      LCP: audit('largest-contentful-paint'),
      TBT: audit('total-blocking-time'),
      CLS: audit('cumulative-layout-shift'),
    };
  }
} finally {
  stop();
}
console.table(results);
