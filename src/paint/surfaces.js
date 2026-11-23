// Painted dark, then lifted, so materials can choose how dark it reads (a colour
// multiplier can only darken a texture).
export const WOOD_LIFT = 2.5;
function lift(ctx, size) {
  const image = ctx.getImageData(0, 0, size, size);
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.min(255, d[i] * WOOD_LIFT);
    d[i + 1] = Math.min(255, d[i + 1] * WOOD_LIFT);
    d[i + 2] = Math.min(255, d[i + 2] * WOOD_LIFT);
  }
  ctx.putImageData(image, 0, 0);
}

function seeded(seed) {
  let value = seed >>> 0;
  return () => (value = (Math.imul(1664525, value) + 1013904223) >>> 0) / 4294967296;
}

export function paintPageBlock(make) {
  const { canvas, ctx } = make(256, 256),
    rand = seeded(211);
  ctx.fillStyle = '#eee3cf';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) {
    const shade = 205 + Math.floor(rand() * 34);
    ctx.fillStyle = `rgb(${shade + 16},${shade + 8},${shade - 6})`;
    ctx.fillRect(0, y, 256, 1);
  }
  return canvas;
}

export function paintWood(make, { size = 1024, floor = false } = {}) {
  const { canvas, ctx } = make(size, size, true),
    rand = seeded(floor ? 904 : 412);
  ctx.fillStyle = floor ? '#342014' : '#3b2112';
  ctx.fillRect(0, 0, size, size);
  const boards = floor ? 10 : 1;
  for (let b = 0; b < boards; b++) {
    const x = (b * size) / boards;
    if (floor) {
      ctx.fillStyle = '#120a0655';
      ctx.fillRect(x, 0, 2, size);
    }
    for (let i = 0; i < 140; i++) {
      const y = rand() * size;
      const wave = Math.sin(y * 0.035 + b) * 6;
      const [red, green, blue] = [50 + rand() * 40, 24 + rand() * 25, 10 + rand() * 15];
      ctx.strokeStyle = `rgba(${red},${green},${blue},${0.12 + rand() * 0.3})`;
      ctx.lineWidth = 0.5 + rand() * 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(
        x + (size / boards) * 0.3,
        y + wave,
        x + (size / boards) * 0.7,
        y - wave,
        x + size / boards,
        y + rand() * 4,
      );
      ctx.stroke();
    }
  }
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = '#12090635';
    ctx.fillRect(rand() * size, rand() * size, 6 + rand() * 34, 0.6 + rand());
  }
  lift(ctx, size);
  return canvas;
}

// Grey bars for lines of text: pages flipping past read as pages, not as text.
export function paintPrintedPage(make) {
  const { canvas, ctx } = make(512, 720);
  const rand = seeded(97);
  ctx.fillStyle = '#f3ecdd';
  ctx.fillRect(0, 0, 512, 720);
  ctx.fillStyle = 'rgba(60,48,36,.18)';
  let y = 92;
  while (y < 650) {
    const paragraph = 3 + Math.floor(rand() * 6);
    for (let i = 0; i < paragraph && y < 650; i++, y += 15) {
      const last = i === paragraph - 1;
      ctx.fillRect(64, y, last ? 120 + rand() * 200 : 384, 5);
    }
    y += 14;
  }
  ctx.fillStyle = 'rgba(60,48,36,.3)';
  ctx.fillRect(64, 56, 150, 9);
  return canvas;
}

// Local x = 0 is the hinge on both leaves (the left page is seen from its back
// once turned, so on screen it is mirrored).
const READING_PAGE = [768, 1096];
export function paintReadingPage(make, { paper, side = 'right', dark = false }) {
  const [W, H] = READING_PAGE;
  const { canvas, ctx } = make(W, H, true);
  const rand = seeded(side === 'left' ? 53 : 59);
  const base = [1, 3, 5].map((i) => parseInt(paper.slice(i, i + 2), 16));
  const image = ctx.createImageData(W, H);
  const d = image.data;
  const gauss = (x, mu, s) => Math.exp(-(((x - mu) / s) ** 2));
  const smooth = (e0, e1, x) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W; // 0 at the hinge, 1 at the fore-edge
      const sx = side === 'left' ? 0.5 * (1 - u) : 0.5 + 0.5 * u; // across the spread
      const lamp =
        1 +
        0.035 * gauss(sx, 0.25, 0.32) * (1.05 - 0.25 * v) -
        0.055 * smooth(0.55, 1, sx) -
        0.02 * smooth(0.55, 1, v);
      const warm = 0.03 * gauss(sx, 0.25, 0.35); // the lit side leans warm
      const gutter = 1 - 0.13 * Math.pow(Math.max(0, 1 - u / 0.11), 2);
      const grain = (rand() - 0.5) * (dark ? 3 : 5);
      const k = lamp * gutter;
      const i = (y * W + x) * 4;
      d[i] = Math.min(255, base[0] * k * (1 + warm) + grain);
      d[i + 1] = Math.min(255, base[1] * k * (1 + warm * 0.4) + grain);
      d[i + 2] = Math.min(255, base[2] * k * (1 - warm * 0.6) + grain);
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = dark
      ? `rgba(255,236,200,${0.02 + rand() * 0.03})` // pale fibres in dark stock
      : `rgba(110,86,52,${0.018 + rand() * 0.03})`;
    const x = rand() * W;
    const y = rand() * H;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rand() - 0.5) * 1.2);
    ctx.fillRect(0, 0, 4 + rand() * 16, 0.7);
    ctx.restore();
  }
  ctx.fillStyle = dark ? 'rgba(255,236,200,0.08)' : 'rgba(96,72,44,0.13)';
  ctx.beginPath();
  ctx.moveTo(W, 0);
  for (let y = 0; y <= H; y += 6) ctx.lineTo(W - 1.5 - rand() * 3.5, y);
  ctx.lineTo(W, H);
  ctx.fill();
  for (const edge of [0, H]) {
    ctx.beginPath();
    ctx.moveTo(0, edge);
    for (let x = 0; x <= W; x += 6) ctx.lineTo(x, edge + (edge ? -1 : 1) * (1.5 + rand() * 3));
    ctx.lineTo(W, edge);
    ctx.fill();
  }
  return canvas;
}
