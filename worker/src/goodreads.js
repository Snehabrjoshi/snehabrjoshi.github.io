import { XMLParser } from 'fast-xml-parser';
import { parseWidget, widgetUrl } from './widget.js';

// The widget (widget.js) answers even when shelves are members-only; the shelf
// RSS is the fallback. No book appears twice across the three slots.

export const USER_AGENT = 'portfolio-api/1.0 (Cloudflare Worker; personal site reading list)';
const TIMEOUT_MS = 8000;

const feedUrl = (userId, shelf) =>
  `https://www.goodreads.com/review/list_rss/${encodeURIComponent(userId)}?shelf=${shelf}`;

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false, // keep every value a string (ISBNs, ids)
  trimValues: true,
  processEntities: true,
  isArray: (name, jpath) => jpath === 'rss.channel.item',
});

const text = (value) => (value == null ? '' : String(value).trim());

const isCover = (url) => /^https?:\/\//.test(url) && !/nophoto/i.test(url);

function largestCover(item) {
  const url = [
    item.book_large_image_url,
    item.book_medium_image_url,
    item.book_image_url,
    item.book_small_image_url,
  ]
    .map(text)
    .find(isCover);
  return url ? url.replace(/^http:\/\//, 'https://') : null;
}

// Goodreads titles carry the series and subtitle; the card prints the short title.
export function shortTitle(title) {
  return title
    .replace(/\s*\([^()]*#\s*[\d.]+\)\s*$/, '')
    .replace(/^([^:]{3,}?):\s.+$/, '$1')
    .trim();
}

const time = (value) => {
  const ms = Date.parse(text(value));
  return Number.isNaN(ms) ? 0 : ms;
};

// Throws on HTML: Goodreads answers a private or missing profile with a page.
export function parseShelf(xml) {
  let doc;
  try {
    doc = parser.parse(xml);
  } catch (error) {
    throw new Error(`Goodreads feed is not valid XML (${error.message})`);
  }
  const channel = doc?.rss?.channel;
  if (!channel) throw new Error('Goodreads response is not an RSS feed');
  return (channel.item ?? []).map((item) => {
    const bookId = text(item.book_id);
    return {
      title: shortTitle(text(item.title)),
      author: text(item.author_name),
      link: bookId ? `https://www.goodreads.com/book/show/${bookId}` : text(item.link) || null,
      cover: largestCover(item),
      readAt: time(item.user_read_at),
      addedAt: time(item.user_date_added) || time(item.pubDate),
    };
  });
}

const publicBook = (book) =>
  book && {
    title: shortTitle(book.title),
    author: book.author,
    link: book.link,
    cover: book.cover,
  };

// Another edition counts as the same book: same page, or same title and author.
const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
export function sameBook(a, b) {
  if (!a || !b) return false;
  if (a.link && a.link === b.link) return true;
  return (
    norm(shortTitle(a.title)) === norm(shortTitle(b.title)) && norm(a.author) === norm(b.author)
  );
}

const firstOther = (books, ...taken) =>
  books.find((book) => !taken.some((t) => sameBook(t, book))) ?? null;

function rssOrder(books, sort) {
  if (sort !== 'date_read') return [...books].sort((a, b) => b.addedAt - a.addedAt);
  const read = books.filter((b) => b.readAt).sort((a, b) => b.readAt - a.readAt);
  return read.length ? read : [...books].sort((a, b) => b.addedAt - a.addedAt);
}

const headers = (accept) => ({ 'User-Agent': USER_AGENT, Accept: accept });

async function fetchText(url, accept, fetchImpl, label) {
  const response = await fetchImpl(url, {
    headers: headers(accept),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`);
  return response.text();
}

async function fetchShelf(env, shelf, sort, { fetchImpl, parse, now }) {
  const id = env.GOODREADS_USER_ID;
  try {
    const js = await fetchText(
      widgetUrl(id, shelf, sort, now()),
      'application/javascript, text/javascript;q=0.9, */*;q=0.1',
      fetchImpl,
      `Goodreads widget "${shelf}"`,
    );
    return await parse(js);
  } catch (widgetError) {
    try {
      const xml = await fetchText(
        feedUrl(id, shelf),
        'application/rss+xml, application/xml;q=0.9, */*;q=0.1',
        fetchImpl,
        `Goodreads shelf "${shelf}"`,
      );
      return rssOrder(parseShelf(xml), sort);
    } catch (rssError) {
      throw new Error(`${widgetError.message}; RSS: ${rssError.message}`);
    }
  }
}

// Any shelf failing (or all empty, as a hidden profile looks) fails the whole
// refresh, so the last good set is kept rather than a mix.
export async function loadReading(env, fetchImpl = fetch, options = {}) {
  if (!env.GOODREADS_USER_ID) throw new Error('GOODREADS_USER_ID is not set');
  const opts = { fetchImpl, parse: parseWidget, now: Date.now, ...options };
  const [read, current, upNext] = await Promise.all([
    fetchShelf(env, 'read', 'date_read', opts),
    fetchShelf(env, 'currently-reading', 'date_added', opts),
    fetchShelf(env, 'up-next', 'date_added', opts),
  ]);
  const lastRead = read[0] ?? null;
  const now = firstOther(current, lastRead);
  const next =
    firstOther(upNext, lastRead, now) ??
    firstOther(await fetchShelf(env, 'to-read', 'date_added', opts), lastRead, now);
  if (!lastRead && !now && !next) throw new Error('Goodreads returned no books on any shelf');
  return {
    data: { lastRead: publicBook(lastRead), current: publicBook(now), next: publicBook(next) },
    quality: 'full',
  };
}
