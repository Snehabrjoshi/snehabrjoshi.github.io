// Requests are answered from KV (refreshed by the cron), so they never wait on
// Goodreads or Spotify; a failed refresh serves the last good data as stale.
import { json, preflight, methodNotAllowed } from './http.js';
import { readRecord, refresh, present } from './store.js';
import { loadReading } from './goodreads.js';
import { loadPlaylist } from './spotify.js';

async function upstreamFetch(env) {
  if (env.MOCK_UPSTREAMS !== '1') return fetch;
  const { mockFetch } = await import('./mock.js');
  return mockFetch;
}

async function loaders(env) {
  const fetchImpl = await upstreamFetch(env);
  if (env.MOCK_UPSTREAMS === '1') {
    env = {
      SPOTIFY_CLIENT_ID: 'mock',
      SPOTIFY_CLIENT_SECRET: 'mock',
      SPOTIFY_REFRESH_TOKEN: 'mock',
      ...env,
    };
  }
  return {
    reading: () => loadReading(env, fetchImpl),
    playlist: () => loadPlaylist(env, fetchImpl),
  };
}

async function dataset(request, env, name) {
  let record = await readRecord(env, name);
  if (!record) {
    try {
      record = await refresh(env, name, (await loaders(env))[name]);
    } catch (error) {
      return json(
        request,
        env,
        { error: `${name} unavailable`, detail: error.message },
        {
          status: 503,
        },
      );
    }
  }
  return json(request, env, present(record));
}

async function health(request, env) {
  const [reading, playlist] = await Promise.all([
    readRecord(env, 'reading'),
    readRecord(env, 'playlist'),
  ]);
  const status = (record) =>
    record ? { updatedAt: record.updatedAt, stale: present(record).stale } : null;
  return json(
    request,
    env,
    {
      ok: true,
      time: new Date().toISOString(),
      reading: status(reading),
      playlist: status(playlist),
    },
    { cache: false },
  );
}

const ROUTES = {
  '/reading': (r, e) => dataset(r, e, 'reading'),
  '/playlist': (r, e) => dataset(r, e, 'playlist'),
  '/health': health,
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return preflight(request, env);
    if (request.method !== 'GET') return methodNotAllowed(request, env);
    const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
    const route = ROUTES[path];
    if (!route) return json(request, env, { error: 'not found' }, { status: 404 });
    return route(request, env);
  },

  // Independently: one failing doesn't stop the other.
  async scheduled(controller, env, ctx) {
    const load = await loaders(env);
    ctx.waitUntil(
      Promise.allSettled(
        Object.keys(load).map((name) =>
          refresh(env, name, load[name]).then((record) =>
            console.log(`[cron] ${name}: ${record.stale ? 'stale (kept last good)' : 'refreshed'}`),
          ),
        ),
      ),
    );
  },
};
