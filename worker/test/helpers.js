import { readFileSync } from 'node:fs';

export const fixture = (name) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
export const fixtureJson = (name) => JSON.parse(fixture(name));

// An in-memory stand-in for a KV namespace (get with 'json', put, delete),
// recording the options of each put.
export function memoryKV(initial = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, JSON.stringify(v)]));
  const puts = [];
  return {
    store,
    puts,
    async get(key, type) {
      const value = store.get(key);
      if (value == null) return null;
      return type === 'json' ? JSON.parse(value) : value;
    },
    async put(key, value, options) {
      puts.push({ key, value, options });
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
  };
}

// A fetch that answers from a list of [match, response-factory] routes and
// records every request.
export function routedFetch(routes) {
  const calls = [];
  const impl = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    for (const [match, respond] of routes) {
      if (typeof match === 'string' ? url.includes(match) : match.test(url)) {
        return respond(url, init);
      }
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  impl.calls = calls;
  return impl;
}

export const env = (overrides = {}) => ({
  GOODREADS_USER_ID: '204912018',
  SPOTIFY_PLAYLIST_ID: '2ep3pk5VLPVoh6opRSkP79',
  SPOTIFY_CLIENT_ID: 'client-id',
  SPOTIFY_CLIENT_SECRET: 'client-secret',
  SPOTIFY_REFRESH_TOKEN: 'refresh-token',
  SITE_ORIGIN: '',
  CACHE: memoryKV(),
  ...overrides,
});

// parseWidget run inside workerd (Miniflare, installed with Wrangler), so the
// tests use the real HTMLRewriter rather than a stand-in. Returns
// { parse(js), dispose() }; parse resolves to what parseWidget returns.
export async function workerdParser() {
  const { Miniflare } = await import('miniflare');
  const source = readFileSync(new URL('../src/widget.js', import.meta.url), 'utf8');
  const mf = new Miniflare({
    workers: [
      {
        config: {
          name: 'parse',
          compatibilityDate: '2026-11-01',
          manifest: {
            mainModule: 'entry.mjs',
            modules: {
              'entry.mjs': {
                type: 'esm',
                contents: `import { parseWidget } from './widget.mjs';
export default { async fetch(request) { return Response.json(await parseWidget(await request.text())); } };`,
              },
              'widget.mjs': { type: 'esm', contents: source },
            },
          },
        },
      },
    ],
    logRequests: false,
  });
  return {
    parse: async (js) => {
      const response = await mf.dispatchFetch('http://parse.local/', { method: 'POST', body: js });
      return response.json();
    },
    dispose: () => mf.dispose(),
  };
}
