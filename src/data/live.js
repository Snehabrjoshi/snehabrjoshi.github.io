// The cards render build-time data first; this only ever offers something
// fresher, and resolves to null on any failure so that data stays.

const BASE = String(import.meta.env.VITE_API_BASE ?? '')
  .trim()
  .replace(/\/+$/, '');
const TIMEOUT_MS = 3000;

// Only https links and images from the worker (it relays third-party data).
const https = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
};
const str = (value) => (typeof value === 'string' ? value.trim() : '');

function book(value) {
  if (!value || !str(value.title)) return null;
  return {
    title: str(value.title),
    author: str(value.author),
    link: https(value.link),
    cover: https(value.cover),
  };
}

const VALIDATE = {
  reading(body) {
    const books = ['lastRead', 'current', 'next'].map((key) => book(body?.[key]));
    return books.some(Boolean) ? { books } : null;
  },
  playlist(body) {
    if (!body || !str(body.name)) return null;
    const tracks = (Array.isArray(body.tracks) ? body.tracks : [])
      .filter((t) => t && str(t.title))
      .slice(0, 4)
      .map((t) => ({
        title: str(t.title),
        artists: (Array.isArray(t.artists) ? t.artists : []).map(str).filter(Boolean),
        album: str(t.album),
        image: https(t.image),
        url: https(t.url),
      }));
    return {
      name: str(body.name),
      url: https(body.url),
      cover: https(body.cover),
      total: Number.isFinite(body.total) ? body.total : null,
      tracks,
    };
  },
};

const settled = {};
const pending = {};

function load(name) {
  if (!BASE) return Promise.resolve(null);
  pending[name] ??= fetch(`${BASE}/${name}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    credentials: 'omit',
    headers: { Accept: 'application/json' },
  })
    .then((response) => (response.ok ? response.json() : null))
    .then((body) => VALIDATE[name](body))
    .catch(() => null) // offline, timeout, CORS, bad JSON: keep the build-time data
    .then((value) => (settled[name] = value));
  return pending[name];
}

// Started at boot, so the data is usually there before a card is opened.
export function prefetchLive() {
  load('reading');
  load('playlist');
}

export const liveNow = (name) => settled[name];
export const liveLater = (name) => load(name);
