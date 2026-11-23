const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:4173', 'http://127.0.0.1:5173'];

// The data changes at most every 6 hours, so 5 minutes of caching never lags.
export const CACHE_OK = 'public, max-age=300, stale-while-revalidate=3600';
const CACHE_NONE = 'no-store';

function allowedOrigins(env) {
  const site = String(env.SITE_ORIGIN ?? '')
    .trim()
    .replace(/\/+$/, '');
  return site ? [site, ...DEV_ORIGINS] : DEV_ORIGINS;
}

// No CORS headers for other origins: the browser blocks the read.
function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const headers = { Vary: 'Origin' };
  if (origin && allowedOrigins(env).includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

export function json(request, env, body, { status = 200, cache = status === 200 } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cache ? CACHE_OK : CACHE_NONE,
      'X-Content-Type-Options': 'nosniff',
      ...corsHeaders(request, env),
    },
  });
}

export function preflight(request, env) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Max-Age': '86400',
      ...corsHeaders(request, env),
    },
  });
}

export function methodNotAllowed(request, env) {
  const response = json(request, env, { error: 'method not allowed' }, { status: 405 });
  response.headers.set('Allow', 'GET, OPTIONS');
  return response;
}
