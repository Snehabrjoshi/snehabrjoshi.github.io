// Up-to-date outputs are skipped.
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import sharp from 'sharp';
import { PHOTOS } from '../src/data/portfolioData.js';

const OUT = 'public/photos/generated';
const WIDTHS = [480, 800, 1200];
const FORMATS = { avif: { quality: 50 }, webp: { quality: 74 } };
mkdirSync(OUT, { recursive: true });

const manifest = {};
for (const photo of PHOTOS) {
  if (!photo.src) continue;
  const input = join('public', photo.src);
  if (!existsSync(input)) {
    console.log(`photos: ${input} not found; the plate shows a placeholder`);
    continue;
  }
  const image = sharp(input).rotate(); // respect EXIF orientation
  const { width, height } = await image.metadata();
  const [w, h] = (await image.metadata()).orientation >= 5 ? [height, width] : [width, height];
  const widths = WIDTHS.filter((x) => x < w).concat(w <= WIDTHS.at(-1) ? [w] : []);
  const name = basename(photo.src, extname(photo.src));
  const sources = {};
  for (const [format, options] of Object.entries(FORMATS)) {
    sources[format] = [];
    for (const width of widths) {
      const file = `${OUT}/${name}-${width}.${format}`;
      if (!existsSync(file) || statSync(file).mtimeMs < statSync(input).mtimeMs) {
        await sharp(input).rotate().resize({ width })[format](options).toFile(file);
        console.log(`photos: wrote ${file}`);
      }
      sources[format].push(`${file.replace(/^public\//, '')} ${width}w`);
    }
    sources[format] = sources[format].join(', ');
  }
  manifest[photo.src] = { width: w, height: h, sources };
}
writeFileSync('src/data/photos.generated.json', `${JSON.stringify(manifest, null, 2)}\n`);

// Listed so cards never request a missing file.
const shots = {};
if (existsSync('public/projects')) {
  for (const file of readdirSync('public/projects')) {
    const match = file.match(/^([a-z0-9-]+)\.(jpe?g|png|webp)$/i);
    if (match) shots[match[1].toLowerCase()] = `projects/${file}`;
  }
}
writeFileSync('src/data/projects.generated.json', `${JSON.stringify(shots, null, 2)}\n`);
