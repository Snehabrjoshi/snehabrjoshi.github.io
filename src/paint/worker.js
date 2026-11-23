// Bitmaps are flipped here because WebGL ignores UNPACK_FLIP_Y for ImageBitmap
// uploads; the main thread sets texture.flipY = false for them.
import { JOBS, NEEDS_FONTS } from './jobs.js';

const make = (width, height, readback = false) => {
  const canvas = new OffscreenCanvas(width, height);
  return { canvas, ctx: canvas.getContext('2d', { willReadFrequently: readback }) };
};

function flipped(canvas) {
  const out = new OffscreenCanvas(canvas.width, canvas.height);
  const ctx = out.getContext('2d');
  ctx.translate(0, canvas.height);
  ctx.scale(1, -1);
  ctx.drawImage(canvas, 0, 0);
  return out.transferToImageBitmap();
}

function pack(result, transfer) {
  if (result instanceof OffscreenCanvas) {
    const bitmap = flipped(result);
    transfer.push(bitmap);
    return bitmap;
  }
  if (result?.data instanceof Uint8ClampedArray) {
    transfer.push(result.data.buffer);
    return result;
  }
  const out = {};
  for (const [key, value] of Object.entries(result)) out[key] = pack(value, transfer);
  return out;
}

let fonts = Promise.resolve(false);
async function loadFonts(urls, families) {
  if (!self.fonts || typeof FontFace === 'undefined') return false;
  const faces = [];
  for (const url of urls) {
    const css = await fetch(url).then((r) => r.text());
    for (const block of css.match(/@font-face\s*{[^}]*}/g) ?? []) {
      const range = block.match(/unicode-range:\s*([^;]+);/)?.[1];
      if (range && !/U\+0000-00FF/i.test(range)) continue; // basic Latin only
      const family = block.match(/font-family:\s*'?([^;']+)'?;/)?.[1];
      const src = block.match(/src:\s*url\(([^)]+)\)/)?.[1];
      if (!family || !src || !families.includes(family)) continue;
      const face = new FontFace(family, `url(${src})`, {
        style: block.match(/font-style:\s*([^;]+);/)?.[1] ?? 'normal',
        weight: block.match(/font-weight:\s*([^;]+);/)?.[1] ?? '400',
        ...(range ? { unicodeRange: range } : {}),
      });
      faces.push(face.load().then((loaded) => self.fonts.add(loaded)));
    }
  }
  await Promise.all(faces);
  return faces.length > 0;
}

self.onmessage = async ({ data }) => {
  if (data.type === 'fonts') {
    fonts = loadFonts(data.urls, data.families).catch(() => false);
    return;
  }
  const { id, job, params } = data;
  try {
    if (NEEDS_FONTS.has(job) && !(await fonts)) throw new Error('fonts unavailable');
    const transfer = [];
    const result = pack(JOBS[job](make, params), transfer);
    self.postMessage({ id, result }, transfer);
  } catch (error) {
    self.postMessage({ id, error: String(error?.message ?? error) });
  }
};
