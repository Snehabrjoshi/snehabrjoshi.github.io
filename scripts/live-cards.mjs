// The worker is mocked with its own parsing code and fixtures, so these are the
// exact shapes it serves.
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import sharp from 'sharp';
import { chromium } from 'playwright';
import { startPreview, launchBrowser, BASE, watchConsole } from './lib.mjs';
import { parseShelf, pickReading } from '../worker/src/goodreads.js';
import { mapPlaylist } from '../worker/src/spotify.js';

const API = 'https://api.screenshot.invalid';
const OUT = 'screenshots';
mkdirSync(OUT, { recursive: true });
const fixture = (name) => readFileSync(`worker/test/fixtures/${name}`, 'utf8');

const now = new Date().toISOString();
const READING = {
  ...pickReading({
    read: parseShelf(fixture('shelf-read.xml')),
    current: parseShelf(fixture('shelf-currently-reading.xml')),
    toRead: parseShelf(fixture('shelf-to-read.xml')),
  }),
  updatedAt: now,
  stale: false,
};
const PLAYLIST = {
  ...mapPlaylist(
    JSON.parse(fixture('spotify-playlist.json')),
    JSON.parse(fixture('spotify-items.json')),
    '2ep3pk5VLPVoh6opRSkP79',
  ),
  updatedAt: now,
  stale: false,
};

const covers = Object.fromEntries(
  readdirSync('public/covers')
    .filter((f) => f.endsWith('.jpg'))
    .map((f) => [f, readFileSync(`public/covers/${f}`)]),
);
const coverFor = (url) => {
  if (url.includes('32620332'))
    return covers['the-seven-husbands-of-evelyn-hugo-taylor-jenkins-reid.jpg'];
  if (url.includes('49127718')) return covers['anxious-people-fredrik-backman.jpg'];
  return Object.entries(covers).find(([f]) => f.startsWith('playlist-'))?.[1];
};
const TILES = [
  '#173f32',
  '#652b2e',
  '#755025',
  '#293458',
  '#174750',
  '#8a5a44',
  '#4f5d3a',
  '#5b4a6b',
];
const tile = (url) => {
  const n = Number.parseInt(url.slice(-2), 16) || 0;
  return sharp({
    create: { width: 64, height: 64, channels: 3, background: TILES[n % TILES.length] },
  })
    .jpeg()
    .toBuffer();
};

const CARDS = [
  [5, 'glass'],
  [6, 'speaker'],
].filter(([, name]) => !process.env.CARDS || process.env.CARDS.split(',').includes(name));
const TAG = process.env.TAG ?? '';
const STUB = `<body style="margin:0;height:100vh;display:grid;place-items:center;
  background:#282828;color:#b3b3b3;font:14px system-ui">Spotify player (stubbed in screenshots)</body>`;

const problems = [];
const state = (page, s) => page.waitForSelector(`html[data-scene-state=${s}]`, { timeout: 120000 });
const visible = (page) =>
  page.waitForFunction(
    () => getComputedStyle(document.querySelector('.card-sheet')).opacity === '1',
    null,
    {
      timeout: 60000,
    },
  );

async function routes(page, { api, delay = 0 }) {
  await page.route(`${API}/**`, async (route) => {
    if (api === 'offline') return route.abort('connectionrefused');
    if (delay) await new Promise((r) => setTimeout(r, delay));
    const body = route.request().url().endsWith('/reading') ? READING : PLAYLIST;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': BASE.replace(/\/$/, '') },
      body: JSON.stringify(body),
    });
  });
  await page.route('https://open.spotify.com/embed/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: STUB }),
  );
  await page.route('https://i.gr-assets.com/**', (route) =>
    route.fulfill({ contentType: 'image/jpeg', body: coverFor(route.request().url()) }),
  );
  await page.route('https://mosaic.scdn.co/**', (route) =>
    route.fulfill({ contentType: 'image/jpeg', body: coverFor(route.request().url()) }),
  );
  await page.route('https://i.scdn.co/**', async (route) =>
    route.fulfill({ contentType: 'image/jpeg', body: await tile(route.request().url()) }),
  );
}

async function newPage(browser, { width, height, mode, api }) {
  const page = await browser.newPage({ viewport: { width, height } });
  watchConsole(page, problems);
  await routes(page, { api });
  await page.addInitScript((m) => localStorage.setItem('bookshop-theme', m), mode);
  await page.goto(`${BASE}?capture`, { waitUntil: 'commit' });
  await state(page, 'idle');
  await page.waitForTimeout(1500);
  return page;
}

async function openCard(page, i) {
  await page.focus('.scene-target');
  for (let k = 0; k < i; k++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await state(page, 'open');
  await visible(page);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
}

async function closeCard(page) {
  await page.keyboard.press('Escape');
  await state(page, 'idle');
  await page.waitForTimeout(300);
}

const sheetBox = (page) => page.locator('.card-sheet').boundingBox();
const sizes = [];

const stop = await startPreview();
const browser = await launchBrowser();
try {
  for (const mode of ['night', 'day']) {
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
    ]) {
      for (const api of TAG ? ['offline'] : ['live', 'offline']) {
        const page = await newPage(browser, { width, height, mode, api });
        for (const [i, name] of CARDS) {
          await openCard(page, i);
          const label = api === 'offline' && TAG ? `offline-${TAG}` : api;
          const file = `${OUT}/${mode}-${width}-${name}-${label}.png`;
          await page.screenshot({ path: file });
          console.log(`  ${file}`);
          const box = await sheetBox(page);
          sizes.push({
            mode,
            width,
            name,
            api: label,
            w: Math.round(box.width),
            h: Math.round(box.height),
          });
          if (name === 'speaker') {
            await page.click('.playlist-play');
            await page.waitForSelector('.card-embed');
            await page.waitForTimeout(600);
            const played = `${OUT}/${mode}-${width}-${name}-${label}-player.png`;
            await page.screenshot({ path: played });
            console.log(`  ${played}`);
            const after = await sheetBox(page);
            const same = after.width === box.width && after.height === box.height;
            sizes.push({
              mode,
              width,
              name,
              api: `${label}, player`,
              w: Math.round(after.width),
              h: Math.round(after.height),
            });
            if (!same)
              problems.push(`[layout] the player changed the ${name} card's size (${label})`);
          }
          await closeCard(page);
        }
        await page.close();
      }
    }
  }

  // Arrives 2 s after the boot-time request, inside the site's 3 s timeout.
  const plain = await chromium.launch({
    channel: 'chrome',
    args: ['--disable-webgl', '--disable-3d-apis'],
  });
  for (const [nth, name, selector] of [
    [5, 'glass', '.book-entry__title a'],
    [6, 'speaker', '.playlist-track__row[href*="trk0"]'],
  ].filter(([, name]) => !TAG && CARDS.some(([, n]) => n === name))) {
    const page = await plain.newPage({ viewport: { width: 1440, height: 900 } });
    watchConsole(page, problems);
    await routes(page, { api: 'live', delay: 2000 });
    await page.goto(BASE, { waitUntil: 'commit' });
    await state(page, 'idle');
    await page.click(`.contents-item >> nth=${nth}`);
    await visible(page);
    const before = await sheetBox(page);
    const early = await page.locator(selector).count();
    await page.waitForSelector(selector, { timeout: 10000 });
    await page.waitForTimeout(300);
    const after = await sheetBox(page);
    const same = before.width === after.width && before.height === after.height;
    console.log(
      `  late swap, ${name}: live before open ${early ? 'yes (not late!)' : 'no'}; sheet ` +
        `${Math.round(before.width)}×${Math.round(before.height)} → ` +
        `${Math.round(after.width)}×${Math.round(after.height)} ${same ? '(same)' : '(CHANGED)'}`,
    );
    if (!same || early) problems.push(`[layout] late swap on the ${name} card`);
    await page.close();
  }
  await plain.close();
} finally {
  await browser.close();
  stop();
}

console.table(sizes);
const real = [...new Set(problems)].filter(
  (p) => !p.startsWith('[capture-noise]') && !p.includes(API), // the offline runs abort on purpose
);
console.log(real.length ? `\nConsole problems:\n${real.join('\n')}` : '\nConsole: clean');
process.exitCode = real.length ? 1 : 0;
