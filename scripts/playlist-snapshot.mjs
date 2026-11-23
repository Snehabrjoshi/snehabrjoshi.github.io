// Uses the worker's own Spotify code with worker/.dev.vars; no token or secret is
// written. On any failure the existing snapshot stays.
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PLAYLIST } from '../src/data/portfolioData.js';
import { fromApi, TRACK_COUNT } from '../worker/src/spotify.js';

const DEV_VARS = 'worker/.dev.vars';
const SNAPSHOT = 'src/data/playlist.snapshot.json';
const COVERS = 'public/covers';
const NAMES = ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'SPOTIFY_REFRESH_TOKEN'];

export function readDevVars(file = DEV_VARS) {
  if (!existsSync(file)) return {};
  const vars = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) vars[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return vars;
}

const memoryKV = () => {
  const map = new Map();
  return {
    get: async (key, type) =>
      map.has(key) ? (type === 'json' ? JSON.parse(map.get(key)) : map.get(key)) : null,
    put: async (key, value) => void map.set(key, value),
    delete: async (key) => void map.delete(key),
  };
};

const trackId = (url) => url?.match(/\/track\/([A-Za-z0-9]+)/)?.[1] ?? null;

export async function snapshot({
  vars,
  fetchImpl = fetch,
  playlistId,
  snapshotFile = SNAPSHOT,
  coversDir = COVERS,
}) {
  const missing = NAMES.filter((name) => !vars[name]);
  if (missing.length) {
    throw new Error(`${missing.join(', ')} not set in ${DEV_VARS} (see README → API Worker)`);
  }
  const env = { ...vars, SPOTIFY_PLAYLIST_ID: playlistId, CACHE: memoryKV() };
  const playlist = await fromApi(env, fetchImpl);
  const tracks = playlist.tracks.slice(0, TRACK_COUNT);

  // Images first, so a failure leaves the old snapshot whole.
  const images = await Promise.all(
    tracks.map(async (track) => {
      const id = trackId(track.url);
      if (!track.image || !id) return null;
      const response = await fetchImpl(track.image, { signal: AbortSignal.timeout(15000) });
      if (!response.ok)
        throw new Error(`album image for "${track.title}": HTTP ${response.status}`);
      return { file: `track-${id}.jpg`, bytes: Buffer.from(await response.arrayBuffer()) };
    }),
  );

  const keep = new Set(images.filter(Boolean).map((image) => image.file));
  for (const file of readdirSync(coversDir)) {
    if (/^track-.+\.jpg$/.test(file) && !keep.has(file)) rmSync(`${coversDir}/${file}`);
  }
  for (const image of images) if (image) writeFileSync(`${coversDir}/${image.file}`, image.bytes);

  const data = {
    id: playlistId,
    total: playlist.total,
    tracks: tracks.map((track, i) => ({
      title: track.title,
      artists: track.artists,
      album: track.album,
      image: images[i] ? `covers/${images[i].file}` : null,
      url: track.url,
    })),
  };
  writeFileSync(snapshotFile, `${JSON.stringify(data, null, 2)}\n`);
  return `${tracks.length} of ${playlist.total} tracks → ${snapshotFile}, ${keep.size} album images → ${coversDir}/`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const playlistId = PLAYLIST.spotifyUrl?.match(/playlist\/([A-Za-z0-9]{22})/)?.[1];
  const kept = existsSync(SNAPSHOT)
    ? `the existing ${SNAPSHOT} is kept`
    : 'no snapshot yet; the card shows the cover only';
  try {
    if (!playlistId) throw new Error('PLAYLIST.spotifyUrl has no playlist id');
    console.log(`playlist:snapshot: ${await snapshot({ vars: readDevVars(), playlistId })}`);
  } catch (error) {
    console.log(`playlist:snapshot: skipped (${error.message}); ${kept}.`);
  }
}
