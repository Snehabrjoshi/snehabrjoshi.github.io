function seeded(seed) {
  let v = seed >>> 0;
  return () => (v = (Math.imul(1664525, v) + 1013904223) >>> 0) / 4294967296;
}

export function paintLeatherette(make) {
  const { canvas, ctx } = make(512, 512);
  const rand = seeded(311);
  ctx.fillStyle = '#7a7a7a';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 5200; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const r = 1.6 + rand() * 3.2;
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,.55)');
    g.addColorStop(1, 'rgba(0,0,0,.18)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

export function paintGrille(make) {
  const { canvas, ctx } = make(256, 256);
  ctx.fillStyle = '#6e6a63';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#100e0c';
  const pitch = 16;
  for (let y = 0, row = 0; y < 256 + pitch; y += pitch * 0.866, row++) {
    for (let x = row % 2 ? pitch / 2 : 0; x < 256 + pitch; x += pitch) {
      ctx.beginPath();
      ctx.arc(x, y, pitch * 0.32, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return canvas;
}
