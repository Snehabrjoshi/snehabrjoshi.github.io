// One-time Spotify authorisation: prints a refresh token for the Worker. Writes
// nothing to disk. Redirect URI: http://127.0.0.1:8888/callback.
import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HOST = '127.0.0.1';
const PORT = 8888;
const REDIRECT_URI = `http://${HOST}:${PORT}/callback`;
const SCOPES = 'playlist-read-private playlist-read-collaborative';
const TIMEOUT_MS = 5 * 60 * 1000;
const DEV_VARS = fileURLToPath(new URL('../.dev.vars', import.meta.url));

function fail(message) {
  console.error(`\nspotify-auth: ${message}\n`);
  process.exit(1);
}

function readDevVars() {
  if (!existsSync(DEV_VARS)) {
    fail(
      'worker/.dev.vars not found. Copy .dev.vars.example to .dev.vars and fill in the Client ID and Secret.',
    );
  }
  const vars = {};
  for (const line of readFileSync(DEV_VARS, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) vars[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return vars;
}

function openBrowser(url) {
  const [cmd, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : ['xdg-open', [url]];
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true })
      .on('error', () => {})
      .unref();
  } catch {
    // No browser to open: the URL is printed as well.
  }
}

const sameState = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

const page = (title, body) =>
  `<!doctype html><meta charset="utf-8"><title>${title}</title>` +
  `<body style="font:16px/1.5 system-ui;max-width:32em;margin:4em auto;padding:0 1em">` +
  `<h1 style="font-size:1.25em">${title}</h1><p>${body}</p></body>`;

const { SPOTIFY_CLIENT_ID: clientId, SPOTIFY_CLIENT_SECRET: clientSecret } = readDevVars();
if (!clientId || !clientSecret) {
  fail('SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must both be set in worker/.dev.vars.');
}

const state = randomBytes(24).toString('base64url');
const authorize = new URL('https://accounts.spotify.com/authorize');
authorize.search = new URLSearchParams({
  response_type: 'code',
  client_id: clientId,
  scope: SCOPES,
  redirect_uri: REDIRECT_URI,
  state,
}).toString();

async function exchange(code) {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.refresh_token) {
    throw new Error(
      `token exchange failed: HTTP ${response.status} ${body.error ?? ''} ${body.error_description ?? ''}`.trim(),
    );
  }
  return body;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  if (url.pathname !== '/callback') {
    res.writeHead(404).end();
    return;
  }
  const send = (status, title, body) => {
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' }).end(page(title, body));
  };
  const finish = (code) => {
    server.close();
    clearTimeout(timer);
    process.exitCode = code;
  };
  if (!sameState(url.searchParams.get('state'), state)) {
    send(400, 'State mismatch', 'This response was not for this request. Nothing was exchanged.');
    console.error("\nspotify-auth: the callback's state did not match; ignored it. Still waiting…");
    return;
  }
  const error = url.searchParams.get('error');
  if (error) {
    send(
      400,
      'Not authorised',
      `Spotify said: ${error.replace(/[<>&"]/g, '')}. You can close this tab.`,
    );
    console.error(`\nspotify-auth: Spotify returned "${error}". Run it again to retry.`);
    finish(1);
    return;
  }
  try {
    const tokens = await exchange(url.searchParams.get('code') ?? '');
    send(200, 'Done', 'The refresh token is in your terminal. You can close this tab.');
    console.log(`
Spotify authorised (scopes: ${tokens.scope ?? SCOPES}).

Your refresh token (treat it like a password; it is not saved anywhere):

  ${tokens.refresh_token}

Next steps, in worker/:

  1. Local dev: add this line to worker/.dev.vars (git-ignored):
       SPOTIFY_REFRESH_TOKEN=${tokens.refresh_token}

  2. Deployed Worker: store it as a secret (paste the token when asked):
       npx wrangler secret put SPOTIFY_REFRESH_TOKEN

Refresh tokens last about 6 months. When /playlist turns stale with an
"invalid_grant" error in the logs, run \`npm run spotify:auth\` again.
`);
    finish(0);
  } catch (err) {
    send(500, 'Exchange failed', 'See the terminal for details. You can close this tab.');
    console.error(`\nspotify-auth: ${err.message}`);
    finish(1);
  }
});

const timer = setTimeout(() => {
  server.close();
  fail('no callback within 5 minutes; run it again.');
}, TIMEOUT_MS);

server.on('error', (err) => fail(`cannot listen on ${HOST}:${PORT} (${err.message}).`));
server.listen(PORT, HOST, () => {
  console.log(`Listening on ${REDIRECT_URI}

Opening Spotify in your browser. If it doesn't open, visit:

  ${authorize}

Sign in as the playlist's owner and approve. Waiting for the callback (5 minutes)…`);
  openBrowser(authorize.toString());
});
