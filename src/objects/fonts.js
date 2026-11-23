// Only needed to paint textures, so loaded off the critical path and subset to
// the glyphs the covers use.

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,·—&’/';
const FAMILIES = ['IBM+Plex+Mono:wght@500'];

export const SERIES_FONTS = {
  title: '600 {size} Fraunces, Georgia, serif',
  subtitle: 'italic 400 {size} Fraunces, Georgia, serif',
  numeral: '500 {size} "IBM Plex Mono", Menlo, monospace',
};

const monoUrl = () =>
  'https://fonts.googleapis.com/css2?' +
  FAMILIES.map((f) => `family=${f}`).join('&') +
  `&display=block&text=${encodeURIComponent(GLYPHS)}`;

export const COVER_FONT_FAMILIES = ['Fraunces', 'IBM Plex Mono'];
export function coverFontUrls() {
  const ui = document.querySelector(
    'link[href*="fonts.googleapis.com/css2?family=Fraunces"]',
  )?.href;
  return [ui, monoUrl()].filter(Boolean);
}

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((resolve) => setTimeout(resolve, ms))]);

// Resolves after `timeout` ms at most; textures then use the fallback stack.
export function loadCoverFonts(timeout = 3500) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = monoUrl();
  const sheet = new Promise((resolve) => {
    link.onload = resolve;
    link.onerror = resolve;
  });
  document.head.append(link);
  const faces = sheet.then(() =>
    Promise.all(
      Object.values(SERIES_FONTS).map((f) =>
        document.fonts.load(f.replace('{size}', '64px')).catch(() => null),
      ),
    ),
  );
  return withTimeout(faces, timeout);
}
