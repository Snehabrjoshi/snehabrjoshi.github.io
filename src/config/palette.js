// Shared by the 3D scene and the HTML: the reading pages are unlit in PAPER so
// the 3D paper and the HTML text layer on it match in both themes.
export const PAPER = '#f4eddf';
const INK = '#211a14';

// Wall colour: flip between the two options here ('sage' or 'lilac').
const WALL_CHOICE = 'lilac';

// Night values are the same hue under warm lamplight, never grey.
export const WALLS = {
  sage: {
    day: { wall: '#d0ddc0', wallGlow: '#6a7a5c', ceiling: '#c3cdb6' },
    night: { wall: '#4a5a3c', wallGlow: '#14160c', ceiling: '#141710' },
  },
  lilac: {
    day: { wall: '#dccfe4', wallGlow: '#73667e', ceiling: '#cbc0d2' },
    night: { wall: '#58435e', wallGlow: '#181016', ceiling: '#17121a' },
  },
};

// `?wall=lilac` previews the other option without a rebuild (screenshots).
export function wallChoice() {
  const asked = new URLSearchParams(globalThis.location?.search ?? '').get('wall');
  return WALLS[asked] ? asked : WALL_CHOICE;
}

// The 3D page texture and the HTML paper page use the same values.
const PAGE_TINT = 0.72; // how far from PAPER toward the pastel
export const PAGE_NIGHT = '#f6efe6';

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

function hue(hex) {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (!d) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
function hslToRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map((n) => 255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
}

export function pagePaper(cloth, amount = PAGE_TINT) {
  const pastel = hslToRgb(hue(cloth), 0.45, 0.915);
  return toHex(rgb(PAPER).map((v, i) => v + (pastel[i] - v) * amount));
}

export function multiply(hex, by) {
  const [a, b] = [rgb(hex), rgb(by)];
  return toHex(a.map((v, i) => (v * b[i]) / 255));
}

// Darkened only if needed to keep ON_DARK_SOFT text ≥ 4.6:1 at the brightest
// lamp-lit point under a card's light wash.
export const ON_DARK_SOFT = '#e6dac5';
const channel = (c) =>
  (c = Math.min(255, c) / 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
export function darkPage(cloth) {
  const text = luminance(rgb(ON_DARK_SOFT));
  let c = rgb(cloth);
  for (let i = 0; i < 40; i++) {
    const lit = c.map((v) => v * 1.07);
    const washed = lit.map((v) => v + (255 - v) * 0.07);
    if ((text + 0.05) / (luminance(washed) + 0.05) >= 4.6) break;
    c = c.map((v) => v * 0.96);
  }
  return toHex(c);
}

export function applyPaletteTokens(root = document.documentElement) {
  root.style.setProperty('--paper', PAPER);
  root.style.setProperty('--ink', INK);
}
