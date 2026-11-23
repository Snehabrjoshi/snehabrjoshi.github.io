import { describe, it, expect, vi, afterEach } from 'vitest';
import worker from '../src/index.js';
import { CACHE_OK } from '../src/http.js';
import { KEYS } from '../src/store.js';
import { env, fixture, fixtureJson, memoryKV, routedFetch } from './helpers.js';

const BASE = 'https://portfolio-api.example.workers.dev';
const get = (path, headers = {}, method = 'GET') =>
  new Request(`${BASE}${path}`, { method, headers });

const upstreams = () =>
  routedFetch([
    // The widget down, so these run through the RSS fallback (the widget
    // path is covered in goodreads.test.js with the real HTMLRewriter).
    ['custom_widget', () => new Response('gone', { status: 404 })],
    [/shelf=up-next$/, () => new Response(fixture('shelf-empty.xml'))],
    [/shelf=read$/, () => new Response(fixture('shelf-read.xml'))],
    [/shelf=currently-reading$/, () => new Response(fixture('shelf-currently-reading.xml'))],
    [/shelf=to-read$/, () => new Response(fixture('shelf-to-read.xml'))],
    ['accounts.spotify.com', () => Response.json(fixtureJson('spotify-token.json'))],
    ['/items?', () => Response.json(fixtureJson('spotify-items.json'))],
    ['api.spotify.com', () => Response.json(fixtureJson('spotify-playlist.json'))],
  ]);

afterEach(() => vi.unstubAllGlobals());

describe('routes', () => {
  it('KV empty → fetches live once, stores, returns; then serves from KV', async () => {
    const fetchImpl = upstreams();
    vi.stubGlobal('fetch', fetchImpl);
    const e = env();
    const first = await worker.fetch(get('/reading'), e);
    expect(first.status).toBe(200);
    expect(first.headers.get('Content-Type')).toMatch(/application\/json/);
    expect(first.headers.get('Cache-Control')).toBe(CACHE_OK);
    const body = await first.json();
    expect(body.current.title).toBe('Anxious People');
    expect(body.stale).toBe(false);
    expect(Date.parse(body.updatedAt)).not.toBeNaN();
    // widget, then RSS, for read, currently-reading and up-next; up-next is
    // empty, so both again for to-read
    const live = fetchImpl.calls.length;
    expect(live).toBe(8);

    const second = await worker.fetch(get('/reading'), e);
    expect((await second.json()).current.title).toBe('Anxious People');
    expect(fetchImpl.calls).toHaveLength(live); // no new upstream requests
  });

  it('/playlist returns the mapped playlist', async () => {
    vi.stubGlobal('fetch', upstreams());
    const body = await (await worker.fetch(get('/playlist'), env())).json();
    expect(body).toMatchObject({ name: 'Quiet Hours', total: 14, stale: false });
    expect(body.tracks).toHaveLength(4);
  });

  it('serves the last good value, stale, when the cron could not refresh it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('fetch', upstreams());
    const e = env();
    await worker.fetch(get('/reading'), e);
    vi.stubGlobal('fetch', async () => new Response('down', { status: 500 }));
    const waits = [];
    await worker.scheduled({}, e, { waitUntil: (p) => waits.push(p) });
    await Promise.all(waits);
    const body = await (await worker.fetch(get('/reading'), e)).json();
    expect(body.current.title).toBe('Anxious People');
    expect(body.stale).toBe(true);
  });

  it('503 with JSON when there is nothing stored and the upstream fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', async () => new Response('down', { status: 500 }));
    const response = await worker.fetch(get('/reading'), env());
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ error: 'reading unavailable' });
  });

  it('/health reports each dataset without touching the upstreams', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('no network');
    });
    const e = env({
      CACHE: memoryKV({
        [KEYS.reading]: { data: {}, updatedAt: new Date().toISOString(), stale: false },
      }),
    });
    const body = await (await worker.fetch(get('/health'), e)).json();
    expect(body.ok).toBe(true);
    expect(body.reading.stale).toBe(false);
    expect(body.playlist).toBeNull();
  });

  it('404 and 405 are JSON; only GET and OPTIONS are allowed', async () => {
    const e = env();
    const missing = await worker.fetch(get('/nope'), e);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'not found' });
    for (const method of ['POST', 'PUT', 'DELETE', 'HEAD']) {
      const response = await worker.fetch(get('/reading', {}, method), e);
      expect(response.status).toBe(405);
      expect(response.headers.get('Allow')).toBe('GET, OPTIONS');
    }
  });
});

describe('CORS', () => {
  const kv = () =>
    memoryKV({ [KEYS.reading]: { data: {}, updatedAt: new Date().toISOString(), stale: false } });

  it('allows the dev origins and SITE_ORIGIN, nothing else', async () => {
    const e = env({ CACHE: kv(), SITE_ORIGIN: 'https://example.github.io/' });
    for (const origin of [
      'http://localhost:5173',
      'http://localhost:4173',
      'http://127.0.0.1:5173',
      'https://example.github.io',
    ]) {
      const response = await worker.fetch(get('/reading', { Origin: origin }), e);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
      expect(response.headers.get('Vary')).toBe('Origin');
    }
    for (const origin of ['https://evil.example', 'http://localhost:3000', 'null']) {
      const response = await worker.fetch(get('/reading', { Origin: origin }), e);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    }
  });

  it('an empty SITE_ORIGIN allows only the dev origins', async () => {
    const response = await worker.fetch(
      get('/reading', { Origin: 'https://example.github.io' }),
      env({ CACHE: kv() }),
    );
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('answers the preflight', async () => {
    const response = await worker.fetch(
      get('/reading', { Origin: 'http://localhost:5173' }, 'OPTIONS'),
      env(),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
  });
});
