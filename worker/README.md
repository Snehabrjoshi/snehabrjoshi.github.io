# portfolio-api

A small Cloudflare Worker (free plan) that serves the live data for two cards:

| Route           | What                                                               |
| --------------- | ------------------------------------------------------------------ |
| `GET /reading`  | Last read, currently reading and up next, from Goodreads           |
| `GET /playlist` | The playlist's name, cover, total and first 4 tracks, from Spotify |
| `GET /health`   | Liveness and when each dataset was last updated                    |

A cron (every 6 hours) refreshes both into Workers KV; requests are answered from KV. If
Goodreads or Spotify fails, the last good data is served with `"stale": true`. The site renders
its build-time data first and swaps in the Worker's when it arrives (3 s timeout); with no
`VITE_API_BASE` or an unreachable Worker it keeps the build-time data.

You need Node 22.12+ for `worker/` (`nvm use` there reads `worker/.nvmrc`), a free Cloudflare
account, and your Spotify app's Client ID and Secret (developer.spotify.com → Dashboard → your
app → Settings; the redirect URI `http://127.0.0.1:8888/callback` must be registered there).

## Set up (once)

All commands run in `worker/`.

1. **Install**

   ```bash
   cd worker
   nvm use          # Node 22
   npm install
   npm test         # 38 unit tests, no network
   ```

2. **Log in to Cloudflare**: `npx wrangler login` (opens the browser).

3. **Create the KV namespace**: `npx wrangler kv namespace create CACHE`. It prints an `id`;
   paste it into `wrangler.toml` under `[[kv_namespaces]]`.

4. **Local secrets**: `cp .dev.vars.example .dev.vars`, then fill in `SPOTIFY_CLIENT_ID` and
   `SPOTIFY_CLIENT_SECRET` (`.dev.vars` is git-ignored).

5. **Spotify refresh token**: `npm run spotify:auth`. It opens Spotify; sign in as the playlist's
   owner and approve. The terminal prints your refresh token: add it to `.dev.vars` as
   `SPOTIFY_REFRESH_TOKEN=…`.

6. **Secrets for the deployed Worker** (each asks for the value; paste it):

   ```bash
   npx wrangler secret put SPOTIFY_CLIENT_ID
   npx wrangler secret put SPOTIFY_CLIENT_SECRET
   npx wrangler secret put SPOTIFY_REFRESH_TOKEN
   ```

7. **Track snapshot for the site** (run in the repository root, not `worker/`):
   `npm run playlist:snapshot`. It uses the same credentials from `worker/.dev.vars` to save the
   first 4 tracks and their album art into `src/data/playlist.snapshot.json` and
   `public/covers/track-*.jpg` (no tokens). Commit both; rerun whenever the playlist changes. The
   speaker card shows them when the Worker isn't reachable.

8. **Try it locally**: `npx wrangler dev`, then open http://localhost:8787/health,
   http://localhost:8787/reading and http://localhost:8787/playlist. (`npm run dev:mock` runs the
   same Worker against saved test data, with no secrets or network.)

9. **Deploy**: `npx wrangler deploy`. It prints the Worker's URL, e.g.
   `https://portfolio-api.<your-subdomain>.workers.dev`.

10. **Point the site at it**:

- locally: in the site's `.env`, `VITE_API_BASE=https://portfolio-api.<your-subdomain>.workers.dev`
  (no trailing slash), then `npm run dev`;
- deployed site: GitHub → Settings → Secrets and variables → Actions → New repository secret,
  name `VITE_API_BASE`, the same URL. (Add `VITE_WEB3FORMS_KEY` there too if you haven't.)
  The deploy workflow passes both to the build.

11. **Once the site is live**, set `SITE_ORIGIN` in `worker/wrangler.toml` to its origin, e.g.
    `"https://snehabrjoshi.github.io"` (scheme and host only, no path or trailing slash), and run
    `npx wrangler deploy` again. Until then only `localhost:5173`, `localhost:4173` and
    `127.0.0.1:5173` may read the API from a browser.

The first request after a deploy fills KV (one live fetch); after that the cron keeps it fresh.
`npx wrangler tail` shows the Worker's logs, including any refresh failures.

## Force a refresh

After changing your Goodreads shelves or the playlist, clear the cached copies so the next request
fetches fresh data instead of waiting for the cron:

```bash
cd worker
npm run refresh            # both: data:reading and data:playlist
npm run refresh:reading    # just the reading list
npm run refresh:playlist   # just the playlist
```

Each runs `wrangler kv key delete <key> --binding CACHE --remote` (you need to be logged in with
`npx wrangler login`). The next `/reading` or `/playlist` request fetches live and stores the
result. Browsers may keep their copy for up to 5 minutes (`max-age=300`). If a key is already
gone, wrangler still exits cleanly.

## Rotate secrets

- **Spotify refresh token** (lasts about 6 months; also if the logs warn that Spotify issued a
  new one, or `/playlist` turns stale with `invalid_grant`): `npm run spotify:auth`, then
  `npx wrangler secret put SPOTIFY_REFRESH_TOKEN` and update `.dev.vars`. No redeploy needed.
- **Spotify client secret** (Dashboard → your app → Settings → Rotate): `npx wrangler secret put
SPOTIFY_CLIENT_SECRET`, update `.dev.vars`, then run `npm run spotify:auth` again and update
  the refresh token as above.
- **Cached access token**: it expires on its own within the hour; to drop it at once,
  `npx wrangler kv key delete --binding CACHE spotify:token --remote`.

## Goodreads

Goodreads needs no key. `/reading` reads each shelf through Goodreads' public custom widget
(`/review/custom_widget/{user}.Reading?shelf=…`), which works even when the shelves are visible to
members only; the shelf RSS is the fallback if a widget fails. Last read is the most recently
read book on "read", current the most recently added on "currently-reading", and next the most
recently added on the custom shelf "up-next" (or "to-read" when "up-next" is empty). The same
book never appears twice (compared by book page, or short title and author so other editions
count too): current skips last read, and next skips both, taking the next book on its shelf, or
from "to-read" when "up-next" has nothing else.
