// Motifs are data (portfolioData.js) on one shared 5×5 grid, line weight and
// ink, so the five books read as one system.

const GRID = 5;
const MORSE = {
  a: '.-',
  b: '-...',
  c: '-.-.',
  d: '-..',
  e: '.',
  f: '..-.',
  g: '--.',
  h: '....',
  i: '..',
  j: '.---',
  k: '-.-',
  l: '.-..',
  m: '--',
  n: '-.',
  o: '---',
  p: '.--.',
  q: '--.-',
  r: '.-.',
  s: '...',
  t: '-',
  u: '..-',
  v: '...-',
  w: '.--',
  x: '-..-',
  y: '-.--',
  z: '--..',
};

export function drawMotif(ctx, motif, x, y, size, ink) {
  const cell = size / GRID;
  const line = Math.max(1, size * 0.022);
  const inset = cell * 0.16;
  const box = (col, row, span = 1) =>
    ctx.fillRect(
      x + col * cell + inset,
      y + row * cell + inset,
      span * cell - inset * 2,
      cell - inset * 2,
    );
  const centre = (col, row) => [x + (col + 0.5) * cell, y + (row + 0.5) * cell];

  ctx.save();
  ctx.fillStyle = ctx.strokeStyle = ink;
  ctx.lineWidth = line;
  ctx.lineCap = 'square';
  ctx.strokeRect(x - cell * 0.18, y - cell * 0.18, size + cell * 0.36, size + cell * 0.36);

  if (motif.type === 'cells') {
    motif.rows.forEach((row, r) =>
      [...row].forEach((ch, c) => {
        if (ch === '#') box(c, r);
        else if (motif.outline) {
          ctx.strokeRect(
            x + c * cell + inset,
            y + r * cell + inset,
            cell - inset * 2,
            cell - inset * 2,
          );
        }
      }),
    );
  } else if (motif.type === 'gantt') {
    motif.bars.forEach(([row, start, length]) => box(start, row, length));
  } else if (motif.type === 'graph') {
    ctx.beginPath();
    motif.edges.forEach(([a, b]) => {
      ctx.moveTo(...centre(...motif.nodes[a]));
      ctx.lineTo(...centre(...motif.nodes[b]));
    });
    ctx.stroke();
    motif.nodes.forEach(([c, r]) => box(c, r));
  } else if (motif.type === 'morse') {
    const letters = [...motif.text.toLowerCase()].filter((ch) => MORSE[ch]);
    let row = Math.max(0, Math.floor((GRID - (letters.length * 2 - 1)) / 2));
    for (const letter of letters) {
      let col = 0;
      for (const symbol of MORSE[letter]) {
        const span = symbol === '-' ? 2 : 1;
        if (col + span > GRID) break;
        if (span === 2) box(col, row, 2);
        else {
          const [cx, cy] = centre(col, row);
          ctx.beginPath();
          ctx.arc(cx, cy, cell / 2 - inset, 0, Math.PI * 2);
          ctx.fill();
        }
        col += span;
      }
      row += 2;
    }
  }
  ctx.restore();
}
