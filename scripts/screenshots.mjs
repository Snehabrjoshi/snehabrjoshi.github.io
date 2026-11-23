// Web3Forms and the Spotify embed are intercepted: the run never posts or plays.
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { startPreview, launchBrowser, BASE, watchConsole } from './lib.mjs';

const OUT = 'screenshots';
mkdirSync(OUT, { recursive: true });
const BOOKS = ['about', 'experience', 'projects', 'skills', 'contact'];
const problems = [];

const state = (page, s) => page.waitForSelector(`html[data-scene-state=${s}]`, { timeout: 120000 });
const frames = (page, n = 2) =>
  page.evaluate(
    (count) =>
      new Promise((resolve) => {
        let left = count;
        const tick = () => (--left ? requestAnimationFrame(tick) : resolve());
        requestAnimationFrame(tick);
      }),
    n,
  );
const visible = (page, selector) =>
  page.waitForFunction(
    (sel) => getComputedStyle(document.querySelector(sel)).opacity === '1',
    selector,
    { timeout: 60000 },
  );
const shot = async (page, name, clip) => {
  await frames(page);
  await page.screenshot({ path: `${OUT}/${name}.png`, ...(clip ? { clip } : {}) });
  console.log(`  ${OUT}/${name}.png`);
};
const STUB = `<body style="margin:0;height:100vh;display:grid;place-items:center;
  background:#282828;color:#b3b3b3;font:14px system-ui">Spotify player (stubbed in screenshots)</body>`;

async function newPage(browser, { width, height, mode, query = '', scale = 1 }) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  watchConsole(page, problems);
  await page.route('https://api.web3forms.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' }),
  );
  await page.route('https://open.spotify.com/embed/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: STUB }),
  );
  await page.addInitScript((m) => localStorage.setItem('bookshop-theme', m), mode);
  await page.goto(`${BASE}?capture${query}`, { waitUntil: 'commit' });
  await state(page, 'idle');
  await page.waitForTimeout(1500);
  return page;
}

async function focusObject(page, i) {
  await page.focus('.scene-target');
  for (let k = 0; k < i; k++) await page.keyboard.press('ArrowRight');
}

async function flipShots(page, i, name, count) {
  await focusObject(page, i);
  await page.keyboard.press('Enter');
  await state(page, 'open');
  await visible(page, '.reader-bar');
  await shot(page, `${name}-front`);
  const toggles = await page.locator('.flip-card__toggle').all();
  for (const toggle of toggles.slice(0, count)) await toggle.click();
  await page.waitForTimeout(1600); // the 0.45 s turn at capture speed
  await shot(page, `${name}-flipped`);
  await page.keyboard.press('Escape');
  await state(page, 'idle');
  await page.waitForTimeout(300);
}

async function openAndShoot(page, i, name, selector) {
  await focusObject(page, i);
  await page.keyboard.press('Enter');
  await state(page, 'open');
  await visible(page, selector);
  await shot(page, name);
  await page.keyboard.press('Escape');
  await state(page, 'idle');
  await page.waitForTimeout(300);
}

const only = process.env.ONLY;
const stop = await startPreview();
const browser = await launchBrowser();
try {
  for (const mode of only ? [] : ['night', 'day']) {
    console.log(`${mode} 1440×900`);
    let page = await newPage(browser, { width: 1440, height: 900, mode });
    await shot(page, `${mode}-1440-idle`);
    await focusObject(page, 1);
    await page.waitForTimeout(900);
    await shot(page, `${mode}-1440-focus-book`);
    for (const [i, id] of BOOKS.entries()) {
      await openAndShoot(page, i, `${mode}-1440-open-${id}`, '.reader-bar');
    }
    await openAndShoot(page, 5, `${mode}-1440-glass-card`, '.card-sheet');
    await flipShots(page, 1, `${mode}-1440-experience`, 2);
    await flipShots(page, 2, `${mode}-1440-projects`, 3);

    await focusObject(page, 0);
    await page.keyboard.press('Enter');
    await state(page, 'open');
    await visible(page, '.reader-bar');
    await page.focus('.plate-frame');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(600);
    await shot(page, `${mode}-1440-about-plate-2`);
    await page.keyboard.press('Escape');
    await state(page, 'idle');

    await focusObject(page, 4);
    await page.keyboard.press('Enter');
    await state(page, 'open');
    await visible(page, '.reader-bar');
    const toForm = () => page.$eval('#modal-body', (b) => (b.scrollTop = b.scrollHeight));
    await toForm();
    await shot(page, `${mode}-1440-contact-empty`);
    await page.click('.note-send');
    await toForm();
    await shot(page, `${mode}-1440-contact-error`);
    await page.fill('#note-name', 'Ada');
    await page.fill('#note-email', 'ada@example.org');
    await page.fill('#note-message', 'Hello! A note from the screenshot script.');
    await page.waitForTimeout(3100); // past the minimum fill time
    await page.click('.note-send');
    await page.waitForSelector('.note-sent');
    await toForm();
    await shot(page, `${mode}-1440-contact-sent`);
    await page.keyboard.press('Escape');
    await state(page, 'idle');

    await focusObject(page, 6);
    await page.keyboard.press('Enter');
    await state(page, 'open');
    await visible(page, '.card-sheet');
    await shot(page, `${mode}-1440-speaker-card`);
    await page.click('.playlist-play');
    await page.waitForSelector('.card-embed');
    await page.waitForTimeout(800);
    await shot(page, `${mode}-1440-speaker-embed`);
    await page.keyboard.press('Escape');
    await state(page, 'idle');

    await page.click('#contents-toggle');
    await shot(page, `${mode}-1440-contents`);
    await page.click('.contents-item >> text=Colophon');
    await state(page, 'open');
    await visible(page, '.card-sheet');
    await shot(page, `${mode}-1440-colophon`);
    await page.keyboard.press('Escape');
    await state(page, 'idle');

    await focusObject(page, 2);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => (window.__capture.timeline?.time() ?? 0) > 1.45, null, {
      timeout: 120000,
    });
    await page.evaluate(() => window.__capture.pause());
    await shot(page, `${mode}-1440-mid-fan`);
    await page.evaluate(() => window.__capture.resume());
    await state(page, 'open');
    await visible(page, '.reader-bar');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(900);
    await page.evaluate(() => window.__capture.pause());
    await shot(page, `${mode}-1440-mid-close`);
    await page.evaluate(() => window.__capture.resume());
    await state(page, 'idle');
    await page.close();

    console.log(`${mode} 390×844`);
    page = await newPage(browser, { width: 390, height: 844, mode });
    await shot(page, `${mode}-390-idle`);
    for (const [i, id] of BOOKS.entries()) {
      await openAndShoot(page, i, `${mode}-390-open-${id}`, '.reader-bar');
    }
    await flipShots(page, 1, `${mode}-390-experience`, 2);
    await flipShots(page, 2, `${mode}-390-projects`, 3);
    await openAndShoot(page, 5, `${mode}-390-glass-card`, '.card-sheet');
    await page.close();
  }

  for (const mode of only ? [] : ['night', 'day']) {
    console.log(`${mode} close-ups (DPR 2)`);
    let page = await newPage(browser, { width: 1440, height: 900, mode, scale: 2 });
    await shot(page, `${mode}-window`, { x: 0, y: 52, width: 460, height: 320 });
    await shot(page, `${mode}-glass`, { x: 30, y: 540, width: 520, height: 330 });
    await page.close();
    for (const wall of ['lilac', 'sage']) {
      page = await newPage(browser, { width: 1440, height: 900, mode, query: `&wall=${wall}` });
      await shot(page, `${mode}-1440-wall-${wall}`);
      await page.close();
    }
  }

  console.log('no-webgl');
  const plain = await chromium.launch({
    channel: 'chrome',
    args: ['--disable-webgl', '--disable-3d-apis'],
  });
  const page = await plain.newPage({ viewport: { width: 1440, height: 900 } });
  watchConsole(page, problems);
  await page.goto(BASE, { waitUntil: 'commit' });
  await state(page, 'idle');
  await page.waitForTimeout(800); // let the loading screen finish fading
  await shot(page, 'no-webgl-1440');
  await page.click('.contents-item >> nth=0');
  await state(page, 'open');
  await visible(page, '.reader-bar');
  await shot(page, 'no-webgl-1440-open-about');
  await page.keyboard.press('Escape');
  await state(page, 'idle');
  await page.click('.contents-item >> nth=4');
  await state(page, 'open');
  await visible(page, '.reader-bar');
  await page.$eval('.note-card', (card) => card.scrollIntoView());
  await shot(page, 'no-webgl-1440-contact-form');
  await page.keyboard.press('Escape');
  await state(page, 'idle');
  await page.click('.contents-item >> nth=1');
  await state(page, 'open');
  await visible(page, '.reader-bar');
  await page.locator('.flip-card__toggle').first().click();
  await page.waitForTimeout(600);
  await shot(page, 'no-webgl-1440-experience-flipped');
  await plain.close();
} finally {
  await browser.close();
  stop();
}

const real = [...new Set(problems)].filter((p) => !p.startsWith('[capture-noise]'));
console.log(real.length ? `\nConsole problems:\n${real.join('\n')}` : '\nConsole: clean');
process.exitCode = real.length ? 1 : 0;
