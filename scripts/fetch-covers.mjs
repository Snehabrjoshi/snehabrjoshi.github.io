// Covers are downloaded at build time (and committed) so the site never requests
// a third-party image at runtime; offline, cards use typographic covers.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { READING, PLAYLIST } from '../src/data/portfolioData.js';
import { coverSlug } from '../src/data/names.js';

const DIR = 'public/covers';
mkdirSync(DIR, { recursive: true });
const timeout = () => AbortSignal.timeout(15000);
// One retry: Open Library drops the odd connection.
const fetchRetry = (url, options) =>
  fetch(url, options).catch(() => fetch(url, { ...options, signal: timeout() }));
async function coverUrl(book) {
  const isbn = String(book.isbn ?? '').replace(/[^0-9Xx]/g, '');
  if (isbn) return `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`;
  const query = new URLSearchParams({
    title: book.title,
    author: book.author,
    fields: 'cover_i,title,author_name',
    limit: '5',
  });
  const res = await fetchRetry(`https://openlibrary.org/search.json?${query}`, {
    signal: timeout(),
  });
  if (!res.ok) throw new Error(`search HTTP ${res.status}`);
  const hit = (await res.json()).docs?.find((d) => d.cover_i);
  if (!hit) throw new Error('no cover in search results');
  return `https://covers.openlibrary.org/b/id/${hit.cover_i}-M.jpg?default=false`;
}

const books = {};
for (const book of READING.entries ?? []) {
  const slug = coverSlug(book);
  const file = `${DIR}/${slug}.jpg`;
  if (!existsSync(file)) {
    try {
      const res = await fetchRetry(await coverUrl(book), { signal: timeout() });
      if (!res.ok) throw new Error(`cover HTTP ${res.status}`);
      writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      console.log(`covers: saved ${file}`);
    } catch (error) {
      console.log(`covers: ${book.title}: ${error.message}; typographic cover`);
    }
  }
  if (existsSync(file)) {
    const { dominant } = await sharp(file).stats();
    const hex = (v) => v.toString(16).padStart(2, '0');
    books[slug] = {
      src: file.replace(/^public\//, ''),
      colour: `#${hex(dominant.r)}${hex(dominant.g)}${hex(dominant.b)}`,
    };
  }
}

const OEMBED_FILE = 'src/data/playlist.oembed.json';
const playlistId = PLAYLIST.spotifyUrl?.match(/playlist\/([A-Za-z0-9]{22})/)?.[1];
let playlistCover = null;
if (playlistId) {
  const file = `${DIR}/playlist-${playlistId}.jpg`;
  const saved = existsSync(OEMBED_FILE) ? JSON.parse(readFileSync(OEMBED_FILE, 'utf8')) : null;
  if (!existsSync(file) || saved?.id !== playlistId) {
    try {
      const meta = await fetchRetry(
        `https://open.spotify.com/oembed?url=${encodeURIComponent(PLAYLIST.spotifyUrl)}`,
        { signal: timeout() },
      ).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))));
      const image = await fetchRetry(meta.thumbnail_url, { signal: timeout() });
      if (!image.ok) throw new Error(`HTTP ${image.status}`);
      writeFileSync(file, Buffer.from(await image.arrayBuffer()));
      writeFileSync(
        OEMBED_FILE,
        `${JSON.stringify({ id: playlistId, name: meta.title ?? '', cover: file.replace(/^public\//, '') }, null, 2)}\n`,
      );
      console.log(`covers: saved ${file} and ${OEMBED_FILE} (playlist)`);
    } catch (error) {
      console.log(`covers: no playlist oEmbed (${error.message}); typographic cover`);
    }
  }
  if (existsSync(file)) playlistCover = file.replace(/^public\//, '');
}

writeFileSync(
  'src/data/covers.generated.json',
  `${JSON.stringify({ books, playlistCover }, null, 2)}\n`,
);
