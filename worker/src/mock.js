// Only used with MOCK_UPSTREAMS=1 (npm run dev:mock): fixtures, no network or secrets.
import widgetRead from '../test/fixtures/widget-read.txt';
import widgetCurrent from '../test/fixtures/widget-currently-reading.txt';
import widgetUpNext from '../test/fixtures/widget-up-next.txt';
import widgetToRead from '../test/fixtures/widget-to-read.txt';
import token from '../test/fixtures/spotify-token.json';
import playlist from '../test/fixtures/spotify-playlist.json';
import items from '../test/fixtures/spotify-items.json';
import oembed from '../test/fixtures/spotify-oembed.json';

const SHELVES = {
  read: widgetRead,
  'currently-reading': widgetCurrent,
  'up-next': widgetUpNext,
  'to-read': widgetToRead,
};

const js = (body) => new Response(body, { headers: { 'Content-Type': 'text/javascript' } });
const json = (body) => Response.json(body);

export async function mockFetch(input) {
  const url = new URL(typeof input === 'string' ? input : input.url);
  if (url.hostname === 'www.goodreads.com') {
    // The RSS answers 404, as it does for members-only shelves.
    const shelf = url.pathname.startsWith('/review/custom_widget/')
      ? SHELVES[url.searchParams.get('shelf')]
      : null;
    return shelf ? js(shelf) : new Response('not found', { status: 404 });
  }
  if (url.hostname === 'accounts.spotify.com') return json(token);
  if (url.hostname === 'api.spotify.com') {
    return url.pathname.endsWith('/items') ? json(items) : json(playlist);
  }
  if (url.hostname === 'open.spotify.com' && url.pathname === '/oembed') return json(oembed);
  return new Response('mock: no such upstream', { status: 502 });
}
