// White on black: the material tints it and sets its strength per theme.
export const WASH = { width: 6, height: 3, centreY: 2.0, sconceX: 1.45, sconceY: 1.98 };

export function paintSconceWash(makeCanvas) {
  const W = 1024;
  const H = 512;
  const { canvas, ctx } = makeCanvas(W, H);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  const px = (x) => ((x + WASH.width / 2) / WASH.width) * W;
  const py = (y) => H * (1 - (y - (WASH.centreY - WASH.height / 2)) / WASH.height);
  const pool = (x, y, rx, ry, a) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(0.45, `rgba(255,255,255,${a * 0.45})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  };
  ctx.globalCompositeOperation = 'lighter';
  pool(W / 2, py(1.95), W * 0.36, H * 0.2, 0.34);
  for (const side of [-1, 1]) {
    const x = px(side * WASH.sconceX);
    const y = py(WASH.sconceY);
    pool(x, y, 40, 40, 0.45); // the patch around the shade
    pool(x, y - 70, 70, 120, 0.32); // short cone up (kept below the hero text)
    pool(x, y + 110, 95, 170, 0.6); // longer cone down
  }
  return canvas;
}
