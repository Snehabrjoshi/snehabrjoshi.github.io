// Pure canvas painting (no three.js) so it runs in the texture worker or, as a
// fallback, on the main thread.
import { SERIES } from '../objects/series.js';
import { SERIES_FONTS } from '../objects/fonts.js';
import { drawMotif } from './motif.js';

const LAYERS = ['albedo', 'bump', 'rough', 'metal'];
const FOIL = [SERIES.foil, '#e4e4e4', '#585858', '#d4d4d4'];
const GROUND = { bump: '#808080', rough: '#ececec', metal: '#000000' };

function seeded(seed) {
  let value = seed >>> 0;
  return () => (value = (Math.imul(1664525, value) + 1013904223) >>> 0) / 4294967296;
}

// Manual letter-spacing: ctx.letterSpacing is not universal.
function text(ctx, str, x, y, { font, size, tracking = 0, align = 'center', maxWidth }) {
  let px = size;
  const measure = () => {
    ctx.font = font.replace('{size}', `${px}px`);
    const glyphs = [...str].map((ch) => ctx.measureText(ch).width);
    return { glyphs, width: glyphs.reduce((a, b) => a + b, 0) + tracking * px * (str.length - 1) };
  };
  let m = measure();
  if (maxWidth && m.width > maxWidth) {
    px = Math.floor((px * maxWidth) / m.width);
    m = measure();
  }
  let cursor = align === 'center' ? x - m.width / 2 : align === 'right' ? x - m.width : x;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  [...str].forEach((ch, i) => {
    ctx.fillText(ch, cursor, y);
    cursor += m.glyphs[i] + tracking * px;
  });
  return px;
}

function fitSize(ctx, str, { font, size, tracking = 0, maxWidth }) {
  ctx.font = font.replace('{size}', `${size}px`);
  const width =
    [...str].reduce((sum, ch) => sum + ctx.measureText(ch).width, 0) +
    tracking * size * (str.length - 1);
  return maxWidth && width > maxWidth ? Math.floor((size * maxWidth) / width) : size;
}

function weave(ctx, W, H, layer, base, rand) {
  if (layer !== 'albedo' && layer !== 'bump') return;
  const pitch = Math.max(2, Math.round(H / 420));
  ctx.fillStyle = layer === 'albedo' ? base : GROUND.bump;
  ctx.fillRect(0, 0, W, H);
  const light = layer === 'albedo' ? 'rgba(255,255,255,.045)' : 'rgba(255,255,255,.2)';
  const dark = layer === 'albedo' ? 'rgba(0,0,0,.06)' : 'rgba(0,0,0,.2)';
  for (let y = 0; y < H; y += pitch) {
    ctx.fillStyle = (y / pitch) % 2 ? light : dark;
    ctx.fillRect(0, y, W, Math.max(1, pitch * 0.45));
  }
  for (let x = 0; x < W; x += pitch) {
    ctx.fillStyle = (x / pitch) % 2 ? dark : light;
    ctx.fillRect(x, 0, Math.max(1, pitch * 0.45), H);
  }
  for (let i = 0; i < 50; i++) {
    ctx.fillStyle = rand() > 0.5 ? light : dark;
    ctx.fillRect(0, rand() * H, W, pitch * 0.7);
  }
}

function rule(ctx, x, y, w, weight) {
  ctx.fillRect(x, y - weight / 2, w, weight);
}

function coverDesign(ctx, W, H, layer, foil, book) {
  weave(ctx, W, H, layer, book.coverColor, seeded(Number(book.volume) * 7919));
  const line = W * 0.006;
  ctx.fillStyle = ctx.strokeStyle = foil;
  ctx.lineWidth = line;
  const inset = W * 0.07;
  ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
  text(ctx, `${book.volume} / 05`, W / 2, H * 0.135, {
    font: SERIES_FONTS.numeral,
    size: W * 0.045,
    tracking: 0.08,
  });
  const motif = W * 0.44;
  drawMotif(ctx, book.motif, (W - motif) / 2, H * 0.22, motif, foil);
  // A two-word title too wide for one line takes two, both at the tighter size.
  const title = { font: SERIES_FONTS.title, size: W * 0.12, tracking: 0.1, maxWidth: W * 0.74 };
  const words = book.title.split(' ');
  const oneLine = fitSize(ctx, book.title, title);
  if (words.length > 1 && oneLine < title.size * 0.8) {
    const size = Math.min(...words.map((w) => fitSize(ctx, w, title)));
    text(ctx, words[0], W / 2, H * 0.665, { ...title, size, maxWidth: null });
    text(ctx, words.slice(1).join(' '), W / 2, H * 0.665 + size * 1.05, {
      ...title,
      size,
      maxWidth: null,
    });
    text(ctx, book.subtitle, W / 2, H * 0.665 + size * 1.05 + W * 0.1, {
      font: SERIES_FONTS.subtitle,
      size: W * 0.068,
    });
  } else {
    text(ctx, book.title, W / 2, H * 0.715, title);
    text(ctx, book.subtitle, W / 2, H * 0.785, { font: SERIES_FONTS.subtitle, size: W * 0.068 });
  }
  rule(ctx, W * 0.44, H * 0.86, W * 0.12, line);
}

function spineDesign(ctx, W, H, layer, foil, book) {
  weave(ctx, W, H, layer, book.coverColor, seeded(Number(book.volume) * 104729));
  const line = Math.max(2, H * 0.0022);
  ctx.fillStyle = ctx.strokeStyle = foil;
  const margin = W * 0.14;
  rule(ctx, margin, H * 0.04, W - margin * 2, line);
  rule(ctx, margin, H * 0.048, W - margin * 2, line);
  const motif = Math.min(W * 0.56, H * 0.075);
  drawMotif(ctx, book.motif, (W - motif) / 2, H * 0.085, motif, foil);
  // Letter tops toward the front cover (the English convention).
  ctx.save();
  ctx.translate(W / 2, H * 0.53);
  ctx.rotate(Math.PI / 2);
  const size = Math.min(W * 0.42, H * 0.05);
  text(ctx, book.spineTitle ?? book.title, 0, size * 0.36, {
    font: SERIES_FONTS.title,
    size,
    tracking: 0.14,
    maxWidth: H * 0.56,
  });
  ctx.restore();
  text(ctx, book.volume, W / 2, H * 0.915, {
    font: SERIES_FONTS.numeral,
    size: Math.min(W * 0.3, H * 0.03),
  });
  rule(ctx, margin, H * 0.952, W - margin * 2, line);
  rule(ctx, margin, H * 0.96, W - margin * 2, line);
}

// Readback canvases are read with getImageData, so they are kept CPU-backed.
function paint(make, design, W, H, book) {
  const albedo = make(W, H);
  design(albedo.ctx, W, H, 'albedo', FOIL[0], book);

  const w = W >> 1;
  const h = H >> 1;
  const layers = {};
  ['bump', 'rough', 'metal'].forEach((layer) => {
    const c = make(w, h, true);
    c.ctx.fillStyle = GROUND[layer];
    c.ctx.fillRect(0, 0, w, h);
    c.ctx.scale(0.5, 0.5);
    design(c.ctx, W, H, layer, FOIL[LAYERS.indexOf(layer)], book);
    layers[layer] = c.ctx.getImageData(0, 0, w, h).data;
  });
  const orm = make(w, h);
  const packed = orm.ctx.createImageData(w, h);
  for (let i = 0; i < packed.data.length; i += 4) {
    packed.data[i] = layers.bump[i];
    packed.data[i + 1] = layers.rough[i];
    packed.data[i + 2] = layers.metal[i];
    packed.data[i + 3] = 255;
  }
  orm.ctx.putImageData(packed, 0, 0);
  return { albedo: albedo.canvas, orm: orm.canvas };
}

export function paintCoverImages(make, book) {
  const H = 2048;
  return paint(make, coverDesign, Math.round((H * SERIES.width) / SERIES.height), H, book);
}
export function paintSpineImages(make, { book, arc }) {
  const H = 2048;
  return paint(make, spineDesign, Math.max(64, Math.round((H * arc) / SERIES.height)), H, book);
}
