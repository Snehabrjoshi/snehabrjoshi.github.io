import { DURATION } from '../config/motion.js';
import { coverSlug } from '../data/names.js';
import { liveNow, liveLater } from '../data/live.js';
// Written by scripts/fetch-covers.mjs before each build; absent in a fresh checkout.
const generated = import.meta.glob('../data/covers.generated.json', { eager: true });
const covers = Object.values(generated)[0]?.default ?? { books: {}, playlistCover: null };
const oembedFile = import.meta.glob('../data/playlist.oembed.json', { eager: true });
const oembed = Object.values(oembedFile)[0]?.default ?? null;
// Written by `npm run playlist:snapshot` (committed).
const snapshotFile = import.meta.glob('../data/playlist.snapshot.json', { eager: true });
const snapshot = Object.values(snapshotFile)[0]?.default ?? null;
const TRACKS = 4;

const wait = (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

const CLOTH = ['#173f32', '#652b2e', '#755025', '#293458', '#174750'];
const clothFor = (title) =>
  CLOTH[[...title].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % CLOTH.length];

function typeCover(book) {
  const cover = el('div', 'book-cover book-cover--type');
  cover.style.setProperty('--cloth', clothFor(book.title));
  cover.setAttribute('aria-hidden', 'true'); // title and author are printed beside it
  cover.append(
    el('span', 'book-cover__title', book.title),
    el('span', 'book-cover__author', book.author),
  );
  return cover;
}

// Falls back to the next source (a local file, then a typographic cover) on error.
function image(src, { className, alt, width, height, fallback }) {
  const img = el('img', className);
  img.src = src;
  img.alt = alt;
  img.width = width;
  img.height = height;
  img.loading = 'lazy';
  img.decoding = 'async';
  if (fallback) img.addEventListener('error', () => img.replaceWith(fallback()), { once: true });
  return img;
}

function bookCover(book) {
  const local = covers.books?.[coverSlug(book)]?.src;
  const options = {
    className: 'book-cover',
    alt: `Cover of ${book.title} by ${book.author}`,
    width: 120,
    height: 180,
  };
  const fromLocal = () =>
    local ? image(local, { ...options, fallback: () => typeCover(book) }) : typeCover(book);
  return book.cover ? image(book.cover, { ...options, fallback: fromLocal }) : fromLocal();
}

function bookEntry(book) {
  const li = el('li', 'book-entry');
  const text = el('div', 'book-entry__text');
  const title = el('span', 'book-entry__title');
  if (book.link) {
    const a = el('a', null, book.title);
    a.href = book.link;
    a.target = '_blank';
    a.rel = 'noopener';
    title.append(a);
  } else {
    title.textContent = book.title;
  }
  text.append(
    el('span', 'book-entry__label', book.label),
    title,
    el('span', 'book-entry__author', book.author),
  );
  if (book.note) text.append(el('span', 'book-entry__note', book.note));
  li.append(bookCover(book), text);
  return li;
}

// Live data laid over the build-time data. A build-time note stays only with
// the same book; an empty live shelf keeps the build-time book.
const MERGE = {
  reading(data, live) {
    const entries = data.entries.map((entry, i) => {
      const book = live?.books?.[i];
      if (!book) return { ...entry, cover: null, link: null };
      const same = book.title.toLowerCase() === entry.title.toLowerCase();
      return { label: entry.label, note: same ? entry.note : '', ...book };
    });
    return { ...data, entries };
  },
  playlist(data, live) {
    const base = {
      ...data,
      name: oembed?.name || data.name,
      cover: null,
      total: snapshot?.total ?? null,
      tracks: (snapshot?.tracks ?? []).slice(0, TRACKS),
    };
    if (!live) return base;
    return {
      ...base,
      name: live.name,
      cover: live.cover,
      total: live.total ?? base.total,
      // The worker's oEmbed-only answer has no tracks: keep the snapshot's.
      tracks: live.tracks.length ? live.tracks.slice(0, TRACKS) : base.tracks,
      spotifyUrl: live.url ?? data.spotifyUrl,
    };
  },
};

const BUILDERS = {
  reading(data) {
    const list = el('ul', 'book-list');
    data.entries.forEach((book) => list.append(bookEntry(book)));
    const nodes = [list];
    if (data.goodreads) {
      const more = el('a', 'card-more', 'More on Goodreads →');
      more.href = data.goodreads;
      more.target = '_blank';
      more.rel = 'noopener';
      nodes.push(more);
    }
    return nodes;
  },
  playlist(data) {
    const id = data.spotifyUrl?.match(/playlist\/([A-Za-z0-9]+)/)?.[1];
    const tracks = data.tracks ?? [];
    const localCover = oembed?.cover ?? covers.playlistCover;
    const options = {
      className: 'book-cover playlist-cover',
      alt: `Cover of the playlist ${data.name}`,
      width: 144,
      height: 144,
    };
    const fromLocal = () =>
      localCover
        ? image(localCover, options)
        : Object.assign(typeCover({ title: data.name, author: 'Playlist' }), {
            className: 'book-cover book-cover--type playlist-cover',
          });
    const cover = data.cover ? image(data.cover, { ...options, fallback: fromLocal }) : fromLocal();

    const head = el('div', 'playlist-head');
    const meta = el('div', 'playlist-meta');
    meta.append(
      el('span', 'playlist-name', data.name),
      el('span', 'playlist-count', data.total ? `${data.total} tracks` : 'On Spotify'),
    );
    head.append(cover, meta);

    // One fixed height for the track list or the player, so nothing moves.
    const stage = el('div', 'playlist-stage');
    if (tracks.length) {
      const list = el('ol', 'playlist-tracks');
      tracks.forEach((track) => {
        const li = el('li', 'playlist-track');
        const row = el(track.url ? 'a' : 'span', 'playlist-track__row');
        if (track.url) {
          row.href = track.url;
          row.target = '_blank';
          row.rel = 'noopener';
        }
        const blank = () => el('span', 'playlist-track__art');
        const art = track.image
          ? image(track.image, {
              className: 'playlist-track__art',
              alt: `${track.album || track.title} album art`,
              width: 80,
              height: 80,
              fallback: blank,
            })
          : blank();
        const text = el('span', 'playlist-track__text');
        text.append(el('span', 'playlist-track__title', track.title));
        if (track.artists?.length) {
          text.append(el('span', 'playlist-track__artist', track.artists.join(', ')));
        }
        row.append(art, text);
        li.append(row);
        list.append(li);
      });
      stage.append(list);
    } else if (data.spotifyUrl) {
      stage.classList.add('playlist-stage--empty');
      const a = el('a', 'card-more', 'See the tracks on Spotify ↗');
      a.href = data.spotifyUrl;
      a.target = '_blank';
      a.rel = 'noopener';
      stage.append(a);
    }

    // Always present (empty when there is nothing more) so the card keeps its height.
    const more = el('p', 'playlist-more');
    const extra = data.total && tracks.length ? data.total - tracks.length : 0;
    if (extra > 0 && data.spotifyUrl) {
      const a = el('a', 'card-more', `+${extra} more on Spotify`);
      a.href = data.spotifyUrl;
      a.target = '_blank';
      a.rel = 'noopener';
      more.append(a);
    }

    const nodes = [head];
    if (id) {
      // No third-party request, cookie or audio until the visitor asks for it.
      const actions = el('div', 'playlist-actions');
      const play = el('button', 'playlist-play', 'Play on Spotify');
      play.type = 'button';
      const open = el('a', 'card-more', 'Open in Spotify ↗');
      open.href = data.spotifyUrl;
      open.target = '_blank';
      open.rel = 'noopener';
      play.addEventListener('click', () => {
        const night = document.documentElement.dataset.theme !== 'day';
        const frame = el('iframe', 'card-embed');
        frame.src = `https://open.spotify.com/embed/playlist/${id}?utm_source=generator${night ? '&theme=0' : ''}`;
        frame.title = `${data.name}: Spotify player`;
        frame.allow = 'clipboard-write; encrypted-media; fullscreen; picture-in-picture';
        frame.loading = 'eager';
        stage.classList.remove('playlist-stage--empty');
        stage.replaceChildren(frame);
        play.disabled = true;
        frame.focus();
      });
      actions.append(play, open);
      nodes.push(actions);
    }
    nodes.push(stage, more);
    return nodes;
  },
  prose(data) {
    const body = el('div', 'card-prose');
    body.innerHTML = data.html; // authored in portfolioData.js, never visitor input
    return [body];
  },
};

export function createCard({ onRequestClose }) {
  let generation = 0;
  const dialog = document.querySelector('#card');
  const title = dialog.querySelector('#card-title');
  const kicker = dialog.querySelector('#card-kicker');
  const intro = dialog.querySelector('#card-intro');
  const body = dialog.querySelector('#card-body');

  dialog.querySelector('.card-close').addEventListener('click', onRequestClose);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) onRequestClose();
  });
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    onRequestClose();
  });

  return {
    get isOpen() {
      return dialog.open;
    },

    open({ type, data, label, side = 'centre' }) {
      kicker.textContent = label;
      title.textContent = data.title;
      intro.textContent = data.intro ?? '';
      intro.hidden = !data.intro;
      const opened = ++generation;
      const merge = MERGE[type];
      const model = (live) => (merge ? merge(data, live) : data);
      const shown = model(merge ? liveNow(type) : undefined);
      body.replaceChildren(...BUILDERS[type](shown));
      dialog.dataset.side = side;
      dialog.dataset.type = type;
      dialog.style.setProperty('--card-fade', `${DURATION.reveal * 1000}ms`);
      dialog.showModal();
      dialog.querySelector('.card-sheet').scrollTop = 0;
      requestAnimationFrame(() => dialog.classList.add('is-visible'));
      if (merge && liveNow(type) === undefined) {
        // Swap in late data only while the card is untouched (its sizes don't
        // depend on the data, so nothing moves).
        liveLater(type).then((live) => {
          if (!live || opened !== generation || !dialog.open) return;
          if (body.contains(document.activeElement) || body.querySelector('iframe')) return;
          const next = model(live);
          if (JSON.stringify(next) !== JSON.stringify(shown)) {
            body.replaceChildren(...BUILDERS[type](next));
          }
        });
      }
      return wait(DURATION.reveal);
    },
    async hide() {
      if (!dialog.open) return;
      generation += 1;
      dialog.style.setProperty('--card-fade', `${DURATION.fade * 1000}ms`);
      dialog.classList.remove('is-visible');
      await wait(DURATION.fade);
      dialog.close();
    },
  };
}
