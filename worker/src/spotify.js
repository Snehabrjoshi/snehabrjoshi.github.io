// Since Spotify's February 2026 rules, playlist items are returned only to the
// owner, so the Worker uses the owner's refresh token (scripts/spotify-auth.mjs).

const ACCOUNTS = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1';
const OEMBED = 'https://open.spotify.com/oembed';
const TIMEOUT_MS = 8000;
const TOKEN_KEY = 'spotify:token';
const TOKEN_MARGIN_S = 300;
export const TRACK_COUNT = 4;
// A few more than shown, so episodes and removed tracks don't leave the card short.
const ITEMS_LIMIT = 10;

const signal = () => AbortSignal.timeout(TIMEOUT_MS);
const playlistUrl = (id) => `https://open.spotify.com/playlist/${id}`;

const basic = (env) => `Basic ${btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`)}`;

export async function getAccessToken(env, fetchImpl = fetch, now = Date.now) {
  const cached = await env.CACHE.get(TOKEN_KEY, 'json').catch(() => null);
  if (cached?.accessToken && cached.expiresAt - TOKEN_MARGIN_S * 1000 > now()) {
    return cached.accessToken;
  }
  for (const name of ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'SPOTIFY_REFRESH_TOKEN']) {
    if (!env[name]) throw new Error(`${name} is not set (see README → API Worker)`);
  }
  const response = await fetchImpl(ACCOUNTS, {
    method: 'POST',
    headers: {
      Authorization: basic(env),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: env.SPOTIFY_REFRESH_TOKEN,
    }),
    signal: signal(),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) {
    if (body.error === 'invalid_grant') {
      throw new Error(
        'Spotify rejected the refresh token (invalid_grant: expired after 6 months, revoked, ' +
          'or wrong). Run `npm run spotify:auth` in worker/ and update the ' +
          'SPOTIFY_REFRESH_TOKEN secret.',
      );
    }
    throw new Error(`Spotify token refresh: HTTP ${response.status} ${body.error ?? ''}`.trim());
  }
  if (body.refresh_token && body.refresh_token !== env.SPOTIFY_REFRESH_TOKEN) {
    // The old token may stop working; the Worker cannot update its own secret.
    console.warn(
      '[spotify] WARNING: Spotify issued a new refresh token. Update the secret now: ' +
        'run `npx wrangler secret put SPOTIFY_REFRESH_TOKEN` in worker/ and paste the new ' +
        'token from `npm run spotify:auth` (it is not logged here, on purpose).',
    );
  }
  const expiresIn = Number(body.expires_in) || 3600;
  const token = { accessToken: body.access_token, expiresAt: now() + expiresIn * 1000 };
  await env.CACHE.put(TOKEN_KEY, JSON.stringify(token), {
    expirationTtl: Math.max(60, expiresIn - TOKEN_MARGIN_S),
  });
  return token.accessToken;
}

export function plainText(html) {
  return String(html ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&#x2F;|&#47;/g, '/')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

export function pickImage(images, min) {
  const list = (images ?? []).filter((image) => image?.url);
  if (!list.length) return null;
  const sorted = [...list].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  const fit = sorted.filter((image) => (image.width ?? Infinity) >= min).pop();
  return (fit ?? sorted[0]).url;
}

export function mapPlaylist(playlist, items, id) {
  const tracks = (items?.items ?? [])
    .map((entry) => entry?.item ?? entry?.track) // `track` only in pre-2026 responses
    .filter((track) => track && track.type !== 'episode' && track.name)
    .slice(0, TRACK_COUNT)
    .map((track) => ({
      title: track.name,
      artists: (track.artists ?? []).map((artist) => artist.name).filter(Boolean),
      album: track.album?.name ?? '',
      image: pickImage(track.album?.images, 64),
      url: track.external_urls?.spotify ?? null,
      durationMs: track.duration_ms ?? null,
    }));
  return {
    name: playlist.name ?? '',
    description: plainText(playlist.description),
    url: playlist.external_urls?.spotify ?? playlistUrl(id),
    cover: pickImage(playlist.images, 240),
    total: playlist.items?.total ?? playlist.tracks?.total ?? items?.total ?? tracks.length,
    tracks,
  };
}

async function api(path, token, fetchImpl) {
  const response = await fetchImpl(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: signal(),
  });
  if (!response.ok) {
    const error = new Error(`Spotify ${path.split('?')[0]}: HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

// Also used by the site's build-time snapshot (scripts/playlist-snapshot.mjs).
export async function fromApi(env, fetchImpl = fetch, now = Date.now) {
  const id = encodeURIComponent(env.SPOTIFY_PLAYLIST_ID);
  const run = async () => {
    const token = await getAccessToken(env, fetchImpl, now);
    return Promise.all([
      api(
        `/playlists/${id}?fields=name,description,external_urls,images,items.total`,
        token,
        fetchImpl,
      ),
      api(`/playlists/${id}/items?limit=${ITEMS_LIMIT}&additional_types=track`, token, fetchImpl),
    ]);
  };
  let playlist, items;
  try {
    [playlist, items] = await run();
  } catch (error) {
    if (error.status !== 401) throw error;
    // A cached token revoked early: drop it and try once with a new one.
    await env.CACHE.delete(TOKEN_KEY);
    [playlist, items] = await run();
  }
  return mapPlaylist(playlist, items, env.SPOTIFY_PLAYLIST_ID);
}

async function fromOEmbed(env, fetchImpl = fetch) {
  const url = playlistUrl(env.SPOTIFY_PLAYLIST_ID);
  const response = await fetchImpl(`${OEMBED}?url=${encodeURIComponent(url)}`, {
    headers: { Accept: 'application/json' },
    signal: signal(),
  });
  if (!response.ok) throw new Error(`Spotify oEmbed: HTTP ${response.status}`);
  const body = await response.json();
  return {
    name: body.title ?? '',
    description: '',
    url,
    cover: body.thumbnail_url ?? null,
    total: null,
    tracks: [],
    source: 'oembed',
  };
}

// A partial (oEmbed) result never replaces full data.
export async function loadPlaylist(env, fetchImpl = fetch, now = Date.now) {
  if (!env.SPOTIFY_PLAYLIST_ID) throw new Error('SPOTIFY_PLAYLIST_ID is not set');
  try {
    return { data: await fromApi(env, fetchImpl, now), quality: 'full' };
  } catch (error) {
    console.error(`[playlist] Spotify API failed: ${error.message}; trying oEmbed`);
    const data = await fromOEmbed(env, fetchImpl);
    return { data, quality: 'partial', reason: error.message };
  }
}
