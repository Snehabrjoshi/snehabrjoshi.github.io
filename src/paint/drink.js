import { paintWood } from './surfaces.js';

function seeded(seed) {
  let v = seed >>> 0;
  return () => (v = (Math.imul(1664525, v) + 1013904223) >>> 0) / 4294967296;
}

export function paintCondensation() {
  const size = 512;
  const rand = seeded(5);
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 128;
    data[i + 1] = 128;
    data[i + 2] = 255;
    data[i + 3] = 255;
  }
  const drop = (cx, cy, r, stretch = 1) => {
    for (let y = Math.floor(cy - r * stretch); y <= cy + r * stretch; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const dx = (x - cx) / r;
        const dy = (y - cy) / (r * stretch);
        const d2 = dx * dx + dy * dy;
        if (d2 >= 1) continue;
        const nz = Math.sqrt(1 - d2);
        const px = ((x % size) + size) % size;
        const py = Math.min(size - 1, Math.max(0, y));
        const i = (py * size + px) * 4;
        data[i] = 128 + dx * 110;
        data[i + 1] = 128 - dy * 110;
        data[i + 2] = 128 + nz * 127;
      }
    }
  };
  for (let i = 0; i < 900; i++) {
    const y = size * Math.pow(rand(), 0.7); // more toward the bottom (flipY)
    drop(rand() * size, y, 1.5 + rand() * 3.5);
  }
  for (let i = 0; i < 14; i++)
    drop(rand() * size, size * (0.3 + rand() * 0.6), 2.5, 4 + rand() * 6);
  return { data, width: size, height: size };
}

// The top rows map onto the surface disc.
export function paintCoffee(make) {
  const [w, h] = [512, 512];
  const rand = seeded(11);
  const { canvas, ctx } = make(w, h);
  const g = ctx.createLinearGradient(0, h, 0, 0);
  g.addColorStop(0, '#2a170c');
  g.addColorStop(0.45, '#4a2a16');
  g.addColorStop(0.72, '#8a5a36');
  g.addColorStop(0.86, '#c49a72');
  g.addColorStop(1, '#e4cfb2');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 0.45;
  ctx.filter = 'blur(5px)'; // soft clouds of milk (ignored where unsupported)
  for (let i = 0; i < 22; i++) {
    const y0 = h * (0.05 + rand() * 0.5);
    const amp = 6 + rand() * 18;
    const width = 4 + rand() * 14;
    ctx.strokeStyle = rand() > 0.4 ? '#e9d8bf' : '#6a4024';
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let x = -20; x <= w + 20; x += 8) {
      const y = y0 + x * 0.12 + Math.sin((x / w) * Math.PI * 2 * 2 + i) * amp;
      if (x === -20) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
  return canvas;
}

export function paintCoaster(make) {
  const wood = paintWood(make, { size: 256 });
  const { canvas, ctx } = make(256, 256);
  ctx.drawImage(wood, 0, 0);
  // The top disc is the last fifth of the lathe's v; the ring sits just outside the foot.
  const y = (1 - 0.84) * 256;
  const band = ctx.createLinearGradient(0, y - 6, 0, y + 6);
  band.addColorStop(0, 'rgba(20,10,4,0)');
  band.addColorStop(0.5, 'rgba(20,10,4,.75)');
  band.addColorStop(1, 'rgba(20,10,4,0)');
  ctx.fillStyle = band;
  ctx.fillRect(0, y - 6, 256, 12);
  return canvas;
}
