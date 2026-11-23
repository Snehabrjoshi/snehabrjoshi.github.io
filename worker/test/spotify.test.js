import { describe, it, expect, vi, afterEach } from 'vitest';
import { mapPlaylist, getAccessToken, loadPlaylist, plainText, pickImage } from '../src/spotify.js';
import { fixtureJson, routedFetch, env, memoryKV } from './helpers.js';

const playlist = fixtureJson('spotify-playlist.json');
const items = fixtureJson('spotify-items.json');
const ok = (body) => () => Response.json(body);

afterEach(() => vi.restoreAllMocks());

describe('mapPlaylist', () => {
  it('maps the playlist and its first 4 tracks (total kept)', () => {
    const data = mapPlaylist(playlist, items, '2ep3pk5VLPVoh6opRSkP79');
    expect(data).toMatchObject({
      name: 'Quiet Hours',
      description: 'Piano & strings for reading / writing. More',
      url: 'https://open.spotify.com/playlist/2ep3pk5VLPVoh6opRSkP79',
      cover: 'https://mosaic.scdn.co/300/fixture-cover',
      total: 14,
    });
    expect(data.tracks).toHaveLength(4);
    expect(data.tracks[0]).toEqual({
      title: 'Clair de lune',
      artists: ['Claude Debussy', 'Pascal Rogé'],
      album: 'Suite bergamasque',
      image: items.items[0].item.album.images[2].url, // the 64 px one
      url: 'https://open.spotify.com/track/trk0000000000000000000',
      durationMs: 301000,
    });
  });

  it('skips episodes, removed tracks and empty entries; reads pre-2026 `track` too', () => {
    const mixed = {
      total: 3,
      items: [
        null,
        { item: null },
        { item: { type: 'episode', name: 'A podcast' } },
        { track: { type: 'track', name: 'Old shape', artists: [{ name: 'A' }], album: {} } },
      ],
    };
    const data = mapPlaylist({ name: 'x', images: [] }, mixed, 'id');
    expect(data.tracks.map((t) => t.title)).toEqual(['Old shape']);
    expect(data.tracks[0].image).toBeNull();
    expect(data.cover).toBeNull();
    expect(data.total).toBe(3);
    expect(data.url).toBe('https://open.spotify.com/playlist/id');
  });

  it('helpers: plain-text descriptions and image sizes', () => {
    expect(plainText('a &amp; b <i>c</i>')).toBe('a & b c');
    expect(plainText(null)).toBe('');
    const images = [
      { url: 'big', width: 640 },
      { url: 'mid', width: 300 },
      { url: 'small', width: 60 },
    ];
    expect(pickImage(images, 64)).toBe('mid');
    expect(pickImage(images, 1000)).toBe('big');
    expect(pickImage([{ url: 'unsized', width: null }], 64)).toBe('unsized');
  });
});

describe('getAccessToken', () => {
  const now = () => 1_800_000_000_000;

  it('refreshes from the refresh token and caches until shortly before expiry', async () => {
    const e = env();
    const fetchImpl = routedFetch([
      ['accounts.spotify.com', ok(fixtureJson('spotify-token.json'))],
    ]);
    expect(await getAccessToken(e, fetchImpl, now)).toBe('fixture-access-token');
    const [call] = fetchImpl.calls;
    expect(call.init.method).toBe('POST');
    expect(call.init.headers.Authorization).toBe(`Basic ${btoa('client-id:client-secret')}`);
    expect(String(call.init.body)).toBe('grant_type=refresh_token&refresh_token=refresh-token');
    const put = e.CACHE.puts.find((p) => p.key === 'spotify:token');
    expect(put.options.expirationTtl).toBe(3300);
    expect(JSON.parse(put.value).expiresAt).toBe(now() + 3600_000);

    // Cached: no second request.
    expect(await getAccessToken(e, fetchImpl, () => now() + 3000_000)).toBe('fixture-access-token');
    expect(fetchImpl.calls).toHaveLength(1);
  });

  it('refreshes again inside the last five minutes', async () => {
    const e = env({
      CACHE: memoryKV({ 'spotify:token': { accessToken: 'old', expiresAt: now() + 120_000 } }),
    });
    const fetchImpl = routedFetch([
      ['accounts.spotify.com', ok({ access_token: 'new', expires_in: 3600 })],
    ]);
    expect(await getAccessToken(e, fetchImpl, now)).toBe('new');
  });

  it('warns (without logging the token) when Spotify issues a new refresh token', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchImpl = routedFetch([
      [
        'accounts.spotify.com',
        ok({ access_token: 'a', expires_in: 3600, refresh_token: 'rotated-secret' }),
      ],
    ]);
    await getAccessToken(env(), fetchImpl, now);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toMatch(/wrangler secret put SPOTIFY_REFRESH_TOKEN/);
    expect(warn.mock.calls[0][0]).not.toContain('rotated-secret');
  });

  it('explains an invalid_grant', async () => {
    const fetchImpl = routedFetch([
      ['accounts.spotify.com', () => Response.json({ error: 'invalid_grant' }, { status: 400 })],
    ]);
    await expect(getAccessToken(env(), fetchImpl, now)).rejects.toThrow(/spotify:auth/);
  });

  it('names a missing secret', async () => {
    await expect(getAccessToken(env({ SPOTIFY_REFRESH_TOKEN: '' }), fetch, now)).rejects.toThrow(
      /SPOTIFY_REFRESH_TOKEN is not set/,
    );
  });
});

describe('loadPlaylist', () => {
  it('uses the current endpoints with the bearer token', async () => {
    const fetchImpl = routedFetch([
      ['accounts.spotify.com', ok(fixtureJson('spotify-token.json'))],
      ['/items?', ok(items)],
      ['/playlists/2ep3pk5VLPVoh6opRSkP79?', ok(playlist)],
    ]);
    const { data, quality } = await loadPlaylist(env(), fetchImpl);
    expect(quality).toBe('full');
    expect(data.tracks).toHaveLength(4);
    const urls = fetchImpl.calls.map((c) => c.url);
    expect(urls).toContain(
      'https://api.spotify.com/v1/playlists/2ep3pk5VLPVoh6opRSkP79/items?limit=10&additional_types=track',
    );
    const api = fetchImpl.calls.filter((c) => c.url.includes('api.spotify.com'));
    for (const c of api) expect(c.init.headers.Authorization).toBe('Bearer fixture-access-token');
  });

  it('retries once with a new token after a 401', async () => {
    let first = true;
    const fetchImpl = routedFetch([
      ['accounts.spotify.com', ok({ access_token: 'fresh', expires_in: 3600 })],
      [
        'api.spotify.com',
        (url, init) => {
          if (first && init.headers.Authorization === 'Bearer stale') {
            first = false;
            return new Response('', { status: 401 });
          }
          return Response.json(url.includes('/items') ? items : playlist);
        },
      ],
    ]);
    const e = env({
      CACHE: memoryKV({
        'spotify:token': { accessToken: 'stale', expiresAt: Date.now() + 3600_000 },
      }),
    });
    const { quality } = await loadPlaylist(e, fetchImpl);
    expect(quality).toBe('full');
  });

  it('falls back to oEmbed (name and cover only, marked partial) when the API fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchImpl = routedFetch([
      ['accounts.spotify.com', ok(fixtureJson('spotify-token.json'))],
      ['api.spotify.com', () => new Response('', { status: 403 })],
      ['open.spotify.com/oembed', ok(fixtureJson('spotify-oembed.json'))],
    ]);
    const result = await loadPlaylist(env(), fetchImpl);
    expect(result.quality).toBe('partial');
    expect(result.data).toEqual({
      name: 'Quiet Hours',
      description: '',
      url: 'https://open.spotify.com/playlist/2ep3pk5VLPVoh6opRSkP79',
      cover: 'https://image-cdn-fa.spotifycdn.com/image/fixture-oembed-cover',
      total: null,
      tracks: [],
      source: 'oembed',
    });
  });
});
