import { startPreview, launchBrowser, BASE } from './lib.mjs';

const stop = await startPreview();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.addInitScript(() => localStorage.setItem('bookshop-theme', 'night'));
  await page.goto(BASE, { waitUntil: 'commit' });
  await page.waitForSelector('html[data-scene-state=idle]', { timeout: 120000 });
  await page.addStyleTag({ content: '.masthead,.hint,#cursor-orb{display:none!important}' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'public/og-image.png' });
  console.log('public/og-image.png');
} finally {
  await browser.close();
  stop();
}
