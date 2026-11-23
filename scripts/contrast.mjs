// WCAG contrast of text against what is actually rendered behind it: hide the
// text, screenshot, compare its colour with the pixels under its box.
import { startPreview, launchBrowser, BASE } from './lib.mjs';

const HUD = ['.hero-name', '.hero-role', '.hero-statement', '.hint', '.nav-item', '.mode-option'];
const PLATE = ['.plate-caption', '.plate-fig', '.plate-where', '.plate-count'];
const card = (root, part) => `${root} ${part}`;
const nth = (ns) => ns.map((n) => `.flip-card:nth-child(${n})`);
const PROJECT_CARDS = [
  '.reader-page--left .flip-card',
  '.reader-page--right .flip-card:nth-child(1)',
  '.reader-page--right .flip-card:nth-child(2)',
];
const cardFront = (ns) =>
  ns.flatMap((n) =>
    [
      '.flip-card__kicker',
      '.flip-card__title',
      '.flip-card__meta',
      '.flip-card__summary',
      '.flip-card__toggle',
    ].map((p) => card(n, p)),
  );
const cardBack = (ns) =>
  ns.flatMap((n) =>
    [
      '.flip-card__back-title',
      '.flip-card__details',
      '.flip-card__details-label',
      '.flip-card__bullets li',
      '.flip-card__lead',
      '.flip-card__link',
      '.flip-card__toggle',
    ].map((p) => card(n, p)),
  );
// Separate passes: on phones, scrolling to the right page's text would move the
// left page's boxes after they were measured.
const SKILLS_LEFT = [
  '.reader-page--left .skills-group__heading',
  '.reader-page--left .skills-chip',
  '.reader-page--left .skills-libs',
];
const SKILLS_RIGHT = [
  '.reader-page--right .skills-group__heading',
  '.reader-page--right .skills-chip',
  '.reader-page--right .skills-line',
];
const COLOPHON = ['.card-title', '.card-kicker', '.card-prose p', '.card-prose__source a'];

const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

async function measure(page, selectors, label, rows, meta) {
  const boxes = await page.evaluate((sels) => {
    return sels.flatMap((sel) =>
      [...document.querySelectorAll(sel)]
        .filter((el) => el.getClientRects().length && getComputedStyle(el).opacity !== '0')
        .slice(0, 1)
        .map((el) => {
          el.scrollIntoView({ block: 'nearest' });
          const r = el.getBoundingClientRect();
          // color(srgb …) (what color-mix() computes to) gives 0–1 channels, not 0–255.
          const css = getComputedStyle(el).color;
          const n = css.match(/[\d.]+/g).map(Number);
          const scale = css.startsWith('color(') ? 255 : 1;
          const c = [n[0] * scale, n[1] * scale, n[2] * scale, n[3] ?? 1];
          return { sel, x: r.x, y: r.y, w: r.width, h: r.height, color: c };
        }),
    );
  }, selectors);
  // No transitions: the Night/Day labels' colour transition would still show the text.
  await page.addStyleTag({
    content: `${selectors.join(',')}{color:transparent!important;transition:none!important}`,
  });
  await page.waitForTimeout(400);
  const shot = await page.screenshot({ type: 'png', timeout: 120000 });
  const pixels = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    return {
      w: img.width,
      h: img.height,
      data: Array.from(ctx.getImageData(0, 0, img.width, img.height).data),
    };
  }, shot.toString('base64'));
  for (const box of boxes) {
    const [r, g, b, a = 1] = box.color;
    const ratios = [];
    for (let y = Math.max(0, Math.floor(box.y)); y < Math.min(pixels.h, box.y + box.h); y += 2) {
      for (let x = Math.max(0, Math.floor(box.x)); x < Math.min(pixels.w, box.x + box.w); x += 2) {
        const i = (y * pixels.w + x) * 4;
        const bg = [pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]];
        const text = [r, g, b].map((v, k) => v * a + bg[k] * (1 - a));
        ratios.push(ratio(luminance(text), luminance(bg)));
      }
    }
    if (!ratios.length) continue;
    ratios.sort((p, q) => p - q);
    rows.push({
      ...meta,
      pass: label,
      sel: box.sel,
      median: +ratios[Math.floor(ratios.length / 2)].toFixed(2),
      worst: +ratios[Math.floor(ratios.length * 0.05)].toFixed(2),
    });
  }
}

async function openBook(browser, w, h, mode, i) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.addInitScript((m) => localStorage.setItem('bookshop-theme', m), mode);
  await page.goto(`${BASE}?capture`, { waitUntil: 'commit' });
  await page.waitForSelector('html[data-scene-state=idle]', { timeout: 120000 });
  if (i < 0) {
    await page.click('#contents-toggle');
    await page.click('.contents-item >> text=Colophon');
  } else {
    await page.focus('.scene-target');
    for (let k = 0; k < i; k++) await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
  }
  await page.waitForSelector('html[data-scene-state=open]', { timeout: 120000 });
  await page.waitForTimeout(1800);
  return page;
}

const stop = await startPreview();
const browser = await launchBrowser();
const rows = [];
try {
  for (const [w, h] of [
    [1440, 900],
    [390, 844],
  ]) {
    for (const mode of ['night', 'day']) {
      const meta = { viewport: `${w}x${h}`, mode };
      let page = await browser.newPage({ viewport: { width: w, height: h } });
      await page.addInitScript((m) => localStorage.setItem('bookshop-theme', m), mode);
      await page.goto(BASE, { waitUntil: 'commit' });
      await page.waitForSelector('html[data-scene-state=idle]', { timeout: 120000 });
      await page.waitForTimeout(2500);
      await measure(page, HUD, 'hud', rows, meta);
      await page.close();

      page = await browser.newPage({ viewport: { width: w, height: h } });
      await page.addInitScript((m) => localStorage.setItem('bookshop-theme', m), mode);
      await page.goto(`${BASE}?capture`, { waitUntil: 'commit' });
      await page.waitForSelector('html[data-scene-state=idle]', { timeout: 120000 });
      await page.focus('.scene-target');
      await page.keyboard.press('Enter');
      await page.waitForSelector('html[data-scene-state=open]', { timeout: 120000 });
      await page.waitForTimeout(1800);
      await measure(page, PLATE, 'about-plate', rows, meta);
      await page.close();

      for (const [book, label, ns] of [
        [1, 'experience', nth([1, 2])],
        [2, 'projects', PROJECT_CARDS],
      ]) {
        page = await openBook(browser, w, h, mode, book);
        await measure(page, cardFront(ns), `${label}-front`, rows, meta);
        await page.close();
        page = await openBook(browser, w, h, mode, book);
        for (const t of await page.locator('.flip-card__toggle').all()) await t.click();
        await page.waitForTimeout(1200);
        await measure(page, cardBack(ns), `${label}-back`, rows, meta);
        await page.close();
      }
      for (const [sels, label] of [
        [SKILLS_LEFT, 'skills-left'],
        [SKILLS_RIGHT, 'skills-right'],
      ]) {
        page = await openBook(browser, w, h, mode, 3);
        await measure(page, sels, label, rows, meta);
        await page.close();
      }
      page = await openBook(browser, w, h, mode, -1);
      await measure(page, COLOPHON, 'colophon', rows, meta);
      await page.close();
    }
  }
} finally {
  await browser.close();
  stop();
}
console.table(rows);
const failing = rows.filter((r) => r.worst < 4.5);
if (failing.length) {
  console.log(`Below 4.5:1 (5th percentile): ${failing.length}`);
  process.exitCode = 1;
}
