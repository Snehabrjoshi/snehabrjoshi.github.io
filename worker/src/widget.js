// Unlike the shelf RSS, the widget answers for members-only shelves. It has no
// dates, so order comes from `sort`. No imports, so tests can load it in workerd.

// Goodreads caches the widget per widget_id and ignores the other parameters on
// a hit: one id per shelf, renewed every minute so a refresh sees current shelves.
const SHELF_IDS = { read: 1, 'currently-reading': 2, 'up-next': 3, 'to-read': 4 };
const PERIOD_MS = 60 * 1000;

export function widgetUrl(userId, shelf, sort, now = Date.now()) {
  const id = (SHELF_IDS[shelf] ?? 9) * 1e6 + (Math.floor(now / PERIOD_MS) % 1e6);
  const query = new URLSearchParams({ shelf, num_books: '5', order: 'd', sort, widget_id: id });
  return `https://www.goodreads.com/review/custom_widget/${encodeURIComponent(userId)}.Reading?${query}`;
}

export function widgetHtml(js) {
  const match = /var\s+widget_code\s*=\s*'((?:[^'\\]|\\[\s\S])*)'/.exec(js);
  if (!match) throw new Error('Goodreads widget response has no widget_code');
  return match[1].replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\s\S])/g, (_, c) => {
    if (c[0] === 'u' && c.length === 5) return String.fromCharCode(parseInt(c.slice(1), 16));
    if (c[0] === 'x' && c.length === 3) return String.fromCharCode(parseInt(c.slice(1), 16));
    return { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', 0: '\0' }[c] ?? c;
  });
}

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });

const https = (url) => url.replace(/^http:\/\//, 'https://');

export function largerCover(src) {
  if (!/^https?:\/\//.test(src) || /nophoto/i.test(src)) return null;
  return https(src.replace(/\._S[XY]\d+_\./, '._SX318_.'));
}

// The book id is in the cover's file name; otherwise the review link, untracked.
export function bookLink(src, href) {
  const id = /\/books\/\d+[a-z]?\/(\d+)[._]/.exec(src)?.[1];
  if (id) return `https://www.goodreads.com/book/show/${id}`;
  if (!/^https?:\/\//.test(href)) return null;
  const url = new URL(https(href));
  url.search = '';
  return url.href;
}

export async function parseWidget(js, Rewriter = globalThis.HTMLRewriter) {
  if (!Rewriter) throw new Error('HTMLRewriter is not available');
  const html = widgetHtml(js);
  const raw = [];
  let book = null;
  const each = 'div[class^="gr_custom_each_container"]';
  await new Rewriter()
    .on(each, {
      element() {
        book = { title: '', text: '', author: '', href: '', src: '' };
        raw.push(book);
      },
    })
    .on(`${each} div[class^="gr_custom_book_container"] a`, {
      element(el) {
        book.title ||= el.getAttribute('title') ?? '';
        book.href ||= el.getAttribute('href') ?? '';
      },
    })
    .on(`${each} div[class^="gr_custom_book_container"] img`, {
      element(el) {
        book.src ||= el.getAttribute('src') ?? '';
      },
    })
    .on(`${each} div[class^="gr_custom_title"] a`, {
      text(chunk) {
        book.text += chunk.text;
      },
    })
    .on(`${each} div[class^="gr_custom_author"] a`, {
      text(chunk) {
        book.author += chunk.text;
      },
    })
    .transform(new Response(html))
    .text();
  return raw
    .map((b) => ({
      title: decode(b.title || b.text).trim(),
      author: decode(b.author).trim(),
      link: bookLink(decode(b.src), decode(b.href)),
      cover: largerCover(decode(b.src)),
    }))
    .filter((b) => b.title);
}
