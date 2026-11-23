import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { parseShelf, loadReading, sameBook, shortTitle, USER_AGENT } from '../src/goodreads.js';
import { widgetUrl, widgetHtml, largerCover, bookLink } from '../src/widget.js';
import { fixture, routedFetch, env, workerdParser } from './helpers.js';

// parseWidget runs in workerd (Miniflare) so it uses the real HTMLRewriter.
let workerd;
beforeAll(async () => {
  workerd = await workerdParser();
}, 30000);
afterAll(() => workerd?.dispose());
const parse = (js) => workerd.parse(js);

describe('widget', () => {
  it('reads title, author, book link and a larger cover for each book', async () => {
    const books = await parse(fixture('widget-read.txt'));
    expect(books.length).toBe(5);
    expect(books[0]).toEqual({
      title: 'The Seven Husbands of Evelyn Hugo',
      author: 'Taylor Jenkins Reid',
      link: 'https://www.goodreads.com/book/show/32620332',
      cover:
        'https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/1664458703l/32620332._SX318_.jpg',
    });
  });

  it('decodes entities in titles', async () => {
    const [atomic] = await parse(fixture('widget-currently-reading.txt'));
    expect(atomic.title).toBe(
      'Atomic Habits: An Easy & Proven Way to Build Good Habits & Break Bad Ones',
    );
  });

  it('returns no books for an empty shelf', async () => {
    expect(await parse(fixture('widget-empty.txt'))).toEqual([]);
  });

  it('rejects a response that is not the widget', () => {
    expect(() => widgetHtml('<!DOCTYPE html><html><body>Sign in</body></html>')).toThrow(
      /no widget_code/,
    );
  });

  it('unescapes the JavaScript string', () => {
    expect(widgetHtml('var widget_code = \'<a href=\\"x\\">\\u00e9<\\/a>\\n\'')).toBe(
      '<a href="x">é</a>\n',
    );
  });

  it('upgrades covers, and treats the placeholder as none', () => {
    expect(largerCover('http://i.gr-assets.com/books/1l/9._SY75_.jpg')).toBe(
      'https://i.gr-assets.com/books/1l/9._SX318_.jpg',
    );
    expect(largerCover('https://s.gr-assets.com/assets/nophoto/book/50x75.png')).toBeNull();
  });

  it('links to the book page, or the review page without tracking when there is no cover', () => {
    expect(bookLink('https://x/books/1664458703l/32620332._SY75_.jpg', '')).toBe(
      'https://www.goodreads.com/book/show/32620332',
    );
    expect(
      bookLink('', 'https://www.goodreads.com/review/show/1?utm_medium=api&utm_source=w'),
    ).toBe('https://www.goodreads.com/review/show/1');
  });

  it('uses a distinct widget_id per shelf and per minute', () => {
    const now = Date.parse('2026-11-23T00:00:00Z');
    const id = (shelf, t = now) =>
      new URL(widgetUrl('204912018', shelf, 'date_added', t)).searchParams.get('widget_id');
    expect(id('read')).not.toBe(id('currently-reading'));
    expect(id('read')).toBe(id('read', now + 59_000));
    expect(id('read')).not.toBe(id('read', now + 60_000));
    const url = new URL(widgetUrl('204912018', 'read', 'date_read', now));
    expect(url.pathname).toBe('/review/custom_widget/204912018.Reading');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      shelf: 'read',
      sort: 'date_read',
      order: 'd',
      num_books: '5',
    });
  });
});

describe('parseShelf', () => {
  it('reads every book on a normal shelf', () => {
    const books = parseShelf(fixture('shelf-read.xml'));
    expect(books).toHaveLength(3);
    expect(books[1]).toEqual({
      title: 'The Seven Husbands of Evelyn Hugo',
      author: 'Taylor Jenkins Reid',
      link: 'https://www.goodreads.com/book/show/32620332',
      cover:
        'https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/1664458703i/32620332._SY475_.jpg',
      readAt: Date.parse('Sat, 08 Nov 2025 00:00:00 -0800'),
      addedAt: Date.parse('Fri, 05 Sep 2025 09:30:00 -0700'),
    });
  });

  it('uses the largest cover URL in the feed', () => {
    const [book] = parseShelf(fixture('shelf-currently-reading.xml'));
    expect(book.cover).toMatch(/_SY475_\.jpg$/);
  });

  it('returns no books for an empty shelf', () => {
    expect(parseShelf(fixture('shelf-empty.xml'))).toEqual([]);
  });

  it('gives a null cover when the feed only has the "nophoto" placeholder', () => {
    const atomic = parseShelf(fixture('shelf-to-read.xml')).find((b) => b.author === 'James Clear');
    expect(atomic.cover).toBeNull();
  });

  it('decodes entities and shortens subtitles', () => {
    const atomic = parseShelf(fixture('shelf-to-read.xml'))[0];
    expect(atomic.title).toBe('Atomic Habits');
    expect(shortTitle('Circe (Circe, #1)')).toBe('Circe');
    expect(shortTitle('Re: Zero')).toBe('Re: Zero');
  });

  it('rejects an HTML page (a private or missing profile)', () => {
    expect(() => parseShelf('<!DOCTYPE html><html><body>Sign in</body></html>')).toThrow(
      /not an RSS feed/,
    );
  });
});

describe('sameBook', () => {
  const book = { title: 'Atomic Habits', author: 'James Clear', link: 'https://x/book/show/1' };
  it('matches the same page, or another edition by short title and author', () => {
    expect(sameBook(book, { ...book, title: 'other' })).toBe(true);
    expect(
      sameBook(book, {
        title: 'Atomic Habits: An Easy & Proven Way to Build Good Habits & Break Bad Ones',
        author: 'James  Clear',
        link: 'https://x/book/show/2',
      }),
    ).toBe(true);
    expect(sameBook(book, { ...book, author: 'Someone Else', link: null })).toBe(false);
    expect(sameBook(book, null)).toBe(false);
  });
});

describe('loadReading', () => {
  const widget = (name) => () => new Response(fixture(name));
  const widgets = (extra = []) =>
    routedFetch([
      ...extra,
      [/custom_widget.*shelf=read&/, widget('widget-read.txt')],
      [/custom_widget.*shelf=currently-reading&/, widget('widget-currently-reading.txt')],
      [/custom_widget.*shelf=up-next&/, widget('widget-up-next.txt')],
      [/custom_widget.*shelf=to-read&/, widget('widget-to-read.txt')],
    ]);

  it('reads the widgets: last read by date read, current, next from up-next', async () => {
    const fetchImpl = widgets([[/custom_widget.*shelf=up-next&/, widget('widget-to-read.txt')]]);
    const { data, quality } = await loadReading(env(), fetchImpl, { parse });
    expect(quality).toBe('full');
    expect(data.next.title).toBe('Think and Grow Rich'); // up-next's first
    expect(data.lastRead).toMatchObject({
      title: 'The Seven Husbands of Evelyn Hugo',
      author: 'Taylor Jenkins Reid',
    });
    expect(data.current.title).toBe('Atomic Habits'); // most recently added on currently-reading
    expect(Object.keys(data.next)).toEqual(['title', 'author', 'link', 'cover']);
    const shelves = fetchImpl.calls.map((c) => new URL(c.url).searchParams.get('shelf')).sort();
    expect(shelves).toEqual(['currently-reading', 'read', 'up-next']); // to-read not needed
    const read = fetchImpl.calls.find((c) => c.url.includes('shelf=read&'));
    expect(new URL(read.url).searchParams.get('sort')).toBe('date_read');
    for (const { init } of fetchImpl.calls) {
      expect(init.headers['User-Agent']).toBe(USER_AGENT);
      expect(init.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it('never shows the same book twice', async () => {
    // The real shelves: Atomic Habits is first on currently-reading and the
    // only book on up-next, and up-next's turn falls to to-read.
    const real = await loadReading(env(), widgets(), { parse });
    expect(real.data.current.title).toBe('Atomic Habits');
    expect(real.data.next.title).toBe('Think and Grow Rich');

    // currently-reading and up-next both start with the last read book:
    // current takes the shelf's next book; next skips both.
    const fetchImpl = widgets([
      [/custom_widget.*shelf=currently-reading&/, widget('widget-read.txt')],
      [/custom_widget.*shelf=up-next&/, widget('widget-read.txt')],
    ]);
    const { data } = await loadReading(env(), fetchImpl, { parse });
    expect(data.lastRead.title).toBe('The Seven Husbands of Evelyn Hugo');
    expect(data.current.title).toBe('The Midnight Train');
    expect(data.next.title).toBe('The Great Gatsby');
    const titles = [data.lastRead, data.current, data.next].map((b) => b.title);
    expect(new Set(titles).size).toBe(3);
  });

  it('falls back to to-read when up-next is empty', async () => {
    const fetchImpl = widgets([[/custom_widget.*shelf=up-next&/, widget('widget-empty.txt')]]);
    const { data } = await loadReading(env(), fetchImpl, { parse });
    expect(data.next.title).toBe('Think and Grow Rich');
  });

  it('uses the shelf RSS when a widget fails', async () => {
    const fetchImpl = widgets([
      [/custom_widget.*shelf=currently-reading&/, () => new Response('busy', { status: 503 })],
      [
        /list_rss.*shelf=currently-reading$/,
        () => new Response(fixture('shelf-currently-reading.xml')),
      ],
    ]);
    const { data } = await loadReading(env(), fetchImpl, { parse });
    expect(data.current.author).toBe('Fredrik Backman');
  });

  it('fails as a whole when a shelf fails on both sources', async () => {
    const fetchImpl = widgets([
      [/custom_widget.*shelf=read&/, () => new Response('busy', { status: 503 })],
      [/list_rss.*shelf=read$/, () => new Response('nope', { status: 404 })],
    ]);
    await expect(loadReading(env(), fetchImpl, { parse })).rejects.toThrow(
      /widget "read": HTTP 503; RSS: .*"read": HTTP 404/,
    );
  });

  it('fails when every shelf is empty (a hidden profile), so the last good data stays', async () => {
    const empty = widget('widget-empty.txt');
    const fetchImpl = routedFetch([['custom_widget', empty]]);
    await expect(loadReading(env(), fetchImpl, { parse })).rejects.toThrow(/no books on any shelf/);
  });
});
