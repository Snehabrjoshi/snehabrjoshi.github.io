// Canvas 2D only, so it runs in the texture worker. Every layer tiles in x: a
// shape crossing an edge is painted again on the other side from the same seed.

const LAYER_SIZE = [
  [2048, 1024], // far
  [2048, 1024], // mid
  [2048, 512], // near
];
export const LAYERS = [
  { depth: 16, width: 7, bottom: 0.5, top: 5.5, wind: 0.25 }, // far tree line
  { depth: 5, width: 5, bottom: 0.6, top: 5.0, wind: 1 }, // trees, fence, hedge
  { depth: 1.4, width: 3.2, bottom: 1.0, top: 2.6, wind: 0.6 }, // flower beds
];

const SUN = normalise(-0.62, -0.78); // toward the sun, canvas axes (y down)

function normalise(x, y) {
  const l = Math.hypot(x, y);
  return [x / l, y / l];
}
function seeded(seed) {
  let v = seed >>> 0;
  return () => (v = (Math.imul(1664525, v) + 1013904223) >>> 0) / 4294967296;
}
const lit = (dx, dy) => dx * SUN[0] + dy * SUN[1]; // > 0 faces the sun

function tiled(ctx, width, x, reach, seed, fn) {
  for (const dx of [0, -width, width]) {
    if (dx && (x + dx + reach < 0 || x + dx - reach > width)) continue;
    ctx.save();
    ctx.translate(x + dx, 0);
    fn(seeded(seed));
    ctx.restore();
  }
}

function leaf(ctx, x, y, size, angle, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, size, size * 0.62, angle, 0, Math.PI * 2);
  ctx.fill();
}

// Radial gradient rather than a blur filter (cheaper, and works in the worker).
function castShadow(ctx, x, y, rx, ry, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(24,52,30,${alpha})`);
  g.addColorStop(0.6, `rgba(24,52,30,${alpha * 0.6})`);
  g.addColorStop(1, 'rgba(24,52,30,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function branch(ctx, x0, y0, x1, y1, w0, w1, fill) {
  const a = Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2;
  const [cx, cy] = [Math.cos(a), Math.sin(a)];
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x0 + cx * w0, y0 + cy * w0);
  ctx.lineTo(x1 + cx * w1, y1 + cy * w1);
  ctx.lineTo(x1 - cx * w1, y1 - cy * w1);
  ctx.lineTo(x0 - cx * w0, y0 - cy * w0);
  ctx.fill();
}

// Each leaf is toned by how it faces the sun, within its cluster and the whole
// crown, so clusters read as separate rounded masses.
function canopy(ctx, rand, cx, cy, rx, ry, tones, { leafSize, clusters = 9, skip = 0.12 }) {
  const list = [];
  for (let i = 0; i < clusters; i++) {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * 0.62;
    list.push({
      x: cx + Math.cos(a) * rx * d,
      y: cy + Math.sin(a) * ry * d,
      r: Math.min(rx, ry) * (0.34 + rand() * 0.16),
    });
  }
  for (const c of list) leafMass(ctx, rand, c, leafSize * 1.1, () => tones.gap, 0);
  return { clusters: list, paint: () => list.sort((a, b) => b.y - a.y) };

  function leafMass(context, r, c, size, colour, holes) {
    const n = Math.round((c.r * c.r) / (size * size)) * 2.2;
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r());
      const x = c.x + Math.cos(a) * c.r * d;
      const y = c.y + Math.sin(a) * c.r * d;
      if (holes && r() < holes) continue;
      leaf(context, x, y, size * (0.7 + r() * 0.6), r() * Math.PI, colour(x, y, d, a));
    }
  }
}

function paintCanopy(ctx, rand, cx, cy, rx, ry, tones, opts) {
  const crown = canopy(ctx, rand, cx, cy, rx, ry, tones, opts);
  opts.branches?.();
  const size = opts.leafSize;
  for (const c of crown.paint()) {
    const n = Math.round(((c.r * c.r) / (size * size)) * 2.4);
    const leaves = [];
    for (let k = 0; k < n; k++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand());
      const x = c.x + Math.cos(a) * c.r * d;
      const y = c.y + Math.sin(a) * c.r * d;
      if (rand() < (opts.skip ?? 0.12) * (1 + lit(x - c.x, y - c.y) / -c.r)) continue;
      const t =
        0.62 * lit((x - c.x) / c.r, (y - c.y) / c.r) +
        0.38 * lit((x - cx) / rx, (y - cy) / ry) +
        (rand() - 0.5) * 0.22;
      leaves.push({ x, y, t, s: size * (0.75 + rand() * 0.5), a: rand() * Math.PI });
    }
    leaves.sort((p, q) => p.t - q.t);
    for (const l of leaves) {
      const fill =
        l.t > 0.42 ? tones.high : l.t > 0.08 ? tones.lit : l.t > -0.32 ? tones.mid : tones.shade;
      leaf(ctx, l.x, l.y, l.s, l.a, fill);
    }
  }
}

const BROAD = {
  gap: '#1d3a26',
  shade: '#2c5a36',
  mid: '#447f43',
  lit: '#76ad4c',
  high: '#a9cf68',
};
const CYPRESS = {
  gap: '#16301f',
  shade: '#21452d',
  mid: '#356a40',
  lit: '#5d9149',
  high: '#86b25a',
};
const HEDGE = {
  gap: '#1f3d26',
  shade: '#2f5c35',
  mid: '#467f40',
  lit: '#6fa548',
  high: '#98c35f',
};
const BARK = '#4a3428';
const BARK_LIT = '#6e5240';

function broadTree(ctx, rand, ground, top, crownR) {
  const cy = top + crownR * 0.82;
  castShadow(ctx, crownR * 0.55, ground + 6, crownR * 1.15, crownR * 0.16, 0.38);
  const forkY = cy + crownR * 0.35;
  paintCanopy(ctx, rand, 0, cy, crownR, crownR * 0.86, BROAD, {
    leafSize: crownR * 0.085,
    clusters: 10,
    skip: 0.16,
    branches() {
      branch(ctx, 0, ground, 0, forkY, crownR * 0.085, crownR * 0.06, BARK);
      branch(
        ctx,
        -crownR * 0.03,
        ground,
        -crownR * 0.03,
        forkY,
        crownR * 0.03,
        crownR * 0.02,
        BARK_LIT,
      );
      for (const [dx, dy, w] of [
        [-0.45, -0.55, 0.035],
        [0.5, -0.45, 0.032],
        [0.05, -0.75, 0.03],
        [-0.7, -0.15, 0.022],
        [0.72, -0.05, 0.02],
      ]) {
        branch(ctx, 0, forkY, dx * crownR, cy + dy * crownR, crownR * 0.05, crownR * w * 0.6, BARK);
      }
    },
  });
}

function cypress(ctx, rand, ground, top, half) {
  const height = ground - top;
  castShadow(ctx, half * 1.2, ground + 4, half * 1.6, half * 0.22, 0.34);
  branch(ctx, 0, ground, 0, ground - height * 0.12, half * 0.14, half * 0.12, BARK);
  const widthAt = (f) =>
    half * Math.pow(Math.sin(Math.PI * Math.min(1, f * 1.45 + 0.04)), 0.7) * (1 - f * 0.25);
  const leaves = [];
  const n = Math.round((height * half) / 26);
  for (let i = 0; i < n; i++) {
    const f = 0.06 + rand() * 0.94; // 0 at the foot, 1 at the tip
    const w = widthAt(1 - f);
    const u = rand() * 2 - 1; // across the width
    const x = u * w;
    const y = ground - height * 0.08 - f * height * 0.92;
    const t = lit(u, -0.35) + (rand() - 0.5) * 0.3;
    leaves.push({
      x,
      y,
      t,
      s: half * (0.16 + rand() * 0.1),
      a: Math.PI / 2 + (rand() - 0.5) * 0.9,
    });
  }
  leaves.sort((p, q) => p.t - q.t);
  for (const l of leaves) {
    const fill =
      l.t > 0.55
        ? CYPRESS.high
        : l.t > 0.15
          ? CYPRESS.lit
          : l.t > -0.35
            ? CYPRESS.mid
            : CYPRESS.shade;
    leaf(ctx, l.x, l.y, l.s, l.a, fill);
  }
}

function jacaranda(ctx, rand, ground, top, crownR) {
  const blossom = { shade: '#6d58ad', mid: '#8c76cc', lit: '#ab98e3', high: '#cfc2f3' };
  castShadow(ctx, crownR * 0.5, ground + 6, crownR * 1.1, crownR * 0.15, 0.3);
  for (let i = 0; i < 120; i++) {
    const x = (rand() - 0.3) * crownR * 2;
    const y = ground - 2 + rand() * 14;
    leaf(ctx, x, y, 2 + rand() * 2.5, rand() * Math.PI, rand() > 0.4 ? '#b7a3e6' : '#9c88d6');
  }
  const tips = [];
  const limb = (x, y, angle, length, width, depth) => {
    const x1 = x + Math.cos(angle) * length;
    const y1 = y + Math.sin(angle) * length;
    branch(ctx, x, y, x1, y1, width, width * 0.62, depth < 2 ? BARK : '#3a2a22');
    if (depth >= 4) {
      tips.push([x1, y1]);
      return;
    }
    const spread = 0.42 + rand() * 0.25;
    limb(x1, y1, angle - spread, length * (0.68 + rand() * 0.12), width * 0.62, depth + 1);
    limb(x1, y1, angle + spread, length * (0.68 + rand() * 0.12), width * 0.62, depth + 1);
    if (rand() > 0.6) tips.push([x1, y1]);
  };
  const trunkTop = top + crownR * 1.55;
  branch(ctx, 0, ground, 0, trunkTop, crownR * 0.07, crownR * 0.055, BARK);
  limb(0, trunkTop, -Math.PI / 2 - 0.35, crownR * 0.48, crownR * 0.05, 0);
  limb(0, trunkTop, -Math.PI / 2 + 0.4, crownR * 0.5, crownR * 0.05, 0);
  const cx = 0;
  const cy = top + crownR * 0.75;
  for (const [tx, ty] of tips) {
    const r = crownR * (0.09 + rand() * 0.07);
    const flowers = [];
    for (let k = 0; k < 34; k++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand());
      const x = tx + Math.cos(a) * r * d;
      const y = ty + Math.sin(a) * r * d * 0.8;
      const t =
        0.6 * lit(Math.cos(a) * d, Math.sin(a) * d) +
        0.4 * lit((x - cx) / crownR, (y - cy) / crownR);
      flowers.push({ x, y, t: t + (rand() - 0.5) * 0.25, s: crownR * (0.022 + rand() * 0.018) });
    }
    flowers.sort((p, q) => p.t - q.t);
    for (const f of flowers) {
      const fill =
        f.t > 0.4
          ? blossom.high
          : f.t > 0.05
            ? blossom.lit
            : f.t > -0.3
              ? blossom.mid
              : blossom.shade;
      leaf(ctx, f.x, f.y, f.s, rand() * Math.PI, fill);
    }
  }
}

function hedge(ctx, rand, ground, length, height) {
  castShadow(ctx, length / 2 + height * 0.4, ground + 4, length * 0.6, height * 0.18, 0.32);
  ctx.fillStyle = HEDGE.gap;
  ctx.beginPath();
  ctx.roundRect(0, ground - height, length, height, height * 0.35);
  ctx.fill();
  const size = height * 0.11;
  const leaves = [];
  const n = Math.round(((length * height) / (size * size)) * 1.6);
  for (let i = 0; i < n; i++) {
    const x = rand() * length;
    const y = ground - rand() * height;
    const fromTop = (y - (ground - height)) / height;
    const t = 0.55 - fromTop * 1.1 + lit((x - length / 2) / length, 0) * 0.3 + (rand() - 0.5) * 0.3;
    leaves.push({ x, y, t });
  }
  leaves.sort((p, q) => p.t - q.t);
  for (const l of leaves) {
    const fill =
      l.t > 0.45 ? HEDGE.high : l.t > 0.1 ? HEDGE.lit : l.t > -0.3 ? HEDGE.mid : HEDGE.shade;
    leaf(ctx, l.x, l.y, size * (0.7 + rand() * 0.6), rand() * Math.PI, fill);
  }
}

function fence(ctx, width, ground, height) {
  const post = height * 0.12;
  const pitch = height * 0.42;
  ctx.fillStyle = 'rgba(24,52,30,0.28)'; // shadow along the grass
  ctx.fillRect(0, ground, width, 5);
  for (let x = 0; x < width; x += pitch) {
    ctx.fillStyle = '#e9e3d6';
    ctx.beginPath();
    ctx.moveTo(x, ground);
    ctx.lineTo(x, ground - height + post);
    ctx.lineTo(x + post / 2, ground - height);
    ctx.lineTo(x + post, ground - height + post);
    ctx.lineTo(x + post, ground);
    ctx.fill();
    ctx.fillStyle = '#c4bba8'; // the shadow side of each picket
    ctx.fillRect(x + post * 0.62, ground - height + post, post * 0.38, height - post);
  }
  for (const f of [0.3, 0.72]) {
    ctx.fillStyle = '#ded7c6';
    ctx.fillRect(0, ground - height * f, width, post * 0.55);
  }
}

function rows(layer, height) {
  return (y) => height * (1 - (y - layer.bottom) / (layer.top - layer.bottom));
}

export function paintFar(makeCanvas) {
  const [W, H] = LAYER_SIZE[0];
  const { canvas, ctx } = makeCanvas(W, H);
  const row = rows(LAYERS[0], H);
  const rand = seeded(17);
  const band = row(2.1);
  const meadow = ctx.createLinearGradient(0, band, 0, H);
  meadow.addColorStop(0, '#86b268');
  meadow.addColorStop(1, '#6fa14f');
  ctx.fillStyle = meadow;
  ctx.fillRect(0, band, W, H - band);
  const haze = {
    gap: '#6f9a8e',
    shade: '#7aa292',
    mid: '#8bb196',
    lit: '#a3c597',
    high: '#b7d39d',
  };
  ctx.fillStyle = haze.mid;
  ctx.fillRect(0, band - 30, W, 34);
  for (let x = 0; x < W; x += 70 + rand() * 60) {
    const r = 60 + rand() * 45;
    const seed = Math.floor(rand() * 1e6);
    const cy = band - r * (0.35 + rand() * 0.35); // rooted on the band
    tiled(ctx, W, x, r * 1.3, seed, (rr) =>
      paintCanopy(ctx, rr, 0, cy, r * 1.15, r * 0.8, haze, {
        leafSize: r * 0.15,
        clusters: 5,
        skip: 0.05,
      }),
    );
  }
  return canvas;
}

export function paintMid(makeCanvas) {
  const [W, H] = LAYER_SIZE[1];
  const { canvas, ctx } = makeCanvas(W, H);
  const row = rows(LAYERS[1], H);
  const ground = row(1.7);
  const lawn = ctx.createLinearGradient(0, ground, 0, H);
  lawn.addColorStop(0, '#669e3f');
  lawn.addColorStop(1, '#548c36');
  ctx.fillStyle = lawn;
  ctx.fillRect(0, ground, W, H - ground);

  // The camera sees roughly x 0–1250 of this layer, so the variety sits there.
  const plants = [
    ['broad', 130, 4.0, 210],
    ['cypress', 420, 4.25, 62],
    ['cypress', 530, 3.8, 52],
    ['jacaranda', 790, 3.85, 200],
    ['broad', 1120, 4.3, 235],
    ['broad', 1560, 3.9, 200],
    ['cypress', 1840, 4.1, 58],
  ];
  plants.forEach(([type, x, top, size], i) => {
    const t = row(top);
    tiled(ctx, W, x, size * 1.6, 100 + i, (rand) => {
      if (type === 'broad') broadTree(ctx, rand, ground, t, size);
      else if (type === 'cypress') cypress(ctx, rand, ground, t, size);
      else jacaranda(ctx, rand, ground, t, size);
    });
  });
  fence(ctx, W, ground + 14, 46);
  for (const [x, len] of [
    [80, 420],
    [1160, 300],
  ]) {
    tiled(ctx, W, x + len / 2, len, 300 + x, (rand) => {
      ctx.translate(-len / 2, 0);
      hedge(ctx, rand, ground + 30, len, 58);
    });
  }
  return canvas;
}

export function paintNear(makeCanvas) {
  const [W, H] = LAYER_SIZE[2];
  const { canvas, ctx } = makeCanvas(W, H);
  const row = rows(LAYERS[2], H);
  const ground = row(1.55);
  const rand = seeded(43);
  ctx.fillStyle = '#35602f';
  ctx.fillRect(0, ground, W, H - ground);
  for (let x = 0; x < W; x += 90 + rand() * 80) {
    const r = 50 + rand() * 30;
    tiled(ctx, W, x, r * 1.3, Math.floor(rand() * 1e6), (rr) =>
      paintCanopy(ctx, rr, 0, ground - r * 0.25, r * 1.2, r * 0.55, HEDGE, {
        leafSize: r * 0.13,
        clusters: 4,
        skip: 0.06,
      }),
    );
  }
  const kinds = [
    { petal: ['#e0735a', '#f09a80'], size: 9, stem: 70 }, // coral
    { petal: ['#d9a531', '#efc35a'], size: 7, stem: 56 }, // mustard
    { petal: ['#9b82d2', '#bfa9ec'], size: 5, stem: 86 }, // lilac spires
    { petal: ['#efece4', '#ffffff'], size: 6, stem: 48 }, // white
  ];
  let k = 0;
  for (let x = 30; x < W; x += 120 + rand() * 90, k++) {
    const kind = kinds[(k + Math.floor(rand() * 2)) % kinds.length];
    const seed = Math.floor(rand() * 1e6);
    tiled(ctx, W, x, 90, seed, (rr) => drift(ctx, rr, ground, kind));
  }
  return canvas;
}

function drift(ctx, rand, ground, kind) {
  const n = 9 + Math.floor(rand() * 8);
  const heads = [];
  for (let i = 0; i < n; i++) {
    const x = (rand() - 0.5) * 140;
    const h = kind.stem * (0.6 + rand() * 0.5);
    const y = ground - 6 - h;
    ctx.strokeStyle = '#3f7436';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, ground);
    ctx.quadraticCurveTo(x + (rand() - 0.5) * 12, ground - h * 0.5, x, y);
    ctx.stroke();
    leaf(ctx, x + 6, ground - h * 0.35, 7, -0.6, '#4c8a3e');
    leaf(ctx, x - 6, ground - h * 0.55, 6, 0.6, '#5d9a46');
    heads.push([x, y]);
  }
  for (const [x, y] of heads) {
    const s = kind.size * (0.8 + rand() * 0.5);
    if (kind.size <= 5) {
      for (let j = 0; j < 6; j++) {
        leaf(
          ctx,
          x + (rand() - 0.5) * 3,
          y + j * s * 1.1,
          s * (1 - j * 0.08),
          rand(),
          j < 2 ? kind.petal[1] : kind.petal[0],
        );
      }
    } else {
      leaf(ctx, x + s * 0.2, y + s * 0.25, s, 0, kind.petal[0]); // shadow side
      leaf(ctx, x - s * 0.15, y - s * 0.1, s * 0.82, 0, kind.petal[1]); // lit side
      leaf(ctx, x - s * 0.05, y + s * 0.02, s * 0.28, 0, '#7a4f20'); // centre
    }
  }
}
