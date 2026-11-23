import { drawMotif } from '../paint/motif.js';

// Fixed-size two-sided card. The flip button sits outside the turning faces so
// focus never turns away with them; the hidden face is inert.

// Written by scripts/photos.mjs before each build.
const generated = import.meta.glob('../data/projects.generated.json', { eager: true });
const screenshots = Object.values(generated)[0]?.default ?? {};

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

let uid = 0;

const initials = (name) =>
  name
    .split(/\s+/)
    .filter((word) => /^[A-Z0-9]/.test(word))
    .map((word) => word[0])
    .join('')
    .slice(0, 3);

// Logos are shown as supplied on a neutral tile so they read on any card colour.
function logoTile(card) {
  const box = el('div', 'flip-card__logo');
  const img = el('img');
  img.alt = `${card.kicker} logo`;
  img.decoding = 'async';
  img.addEventListener(
    'error',
    () => {
      box.classList.add('is-initials');
      box.setAttribute('role', 'img');
      box.setAttribute('aria-label', `${card.kicker} logo`);
      box.replaceChildren(el('span', null, initials(card.kicker ?? card.title)));
      box.firstChild.setAttribute('aria-hidden', 'true');
    },
    { once: true },
  );
  img.src = card.logo;
  box.append(img);
  return box;
}

function illustration(card, motif) {
  if (card.logo) return logoTile(card);
  const box = el('div', 'flip-card__art');
  box.setAttribute('aria-hidden', 'true');
  const shot = card.id && screenshots[card.id];
  if (shot) {
    const img = el('img');
    img.src = shot;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    box.append(img);
    return box;
  }
  if (!motif) return null;
  const canvas = el('canvas');
  const size = 96;
  const ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = canvas.height = size * ratio;
  box.append(canvas);
  requestAnimationFrame(() => {
    const ctx = canvas.getContext('2d');
    const ink = getComputedStyle(box).color;
    ctx.scale(ratio, ratio);
    drawMotif(ctx, motif, 8, 8, size - 16, ink);
  });
  return box;
}

export function createFlipCard(card, { motif, action = 'Explore details' } = {}) {
  const id = `flip-${++uid}`;
  const root = el('article', 'flip-card');
  root.style.setProperty('--cloth', card.colour);
  root.setAttribute('aria-labelledby', `${id}-title`);

  const inner = el('div', 'flip-card__inner');
  const front = el('section', 'flip-face flip-face--front');
  front.id = `${id}-front`;
  const text = el('div', 'flip-card__text');
  if (card.kicker) text.append(el('p', 'flip-card__kicker', card.kicker));
  const title = el('h3', 'flip-card__title', card.title);
  title.id = `${id}-title`;
  text.append(title);
  if (card.meta) text.append(el('p', 'flip-card__meta', card.meta));
  if (card.summary) text.append(el('p', 'flip-card__summary', card.summary));
  front.append(text);
  const art = illustration(card, motif);
  if (art) front.append(art);

  const back = el('section', 'flip-face flip-face--back');
  back.id = `${id}-back`;
  back.append(el('p', 'flip-card__back-title', card.title));
  const scroll = el('div', 'flip-card__scroll');
  scroll.tabIndex = 0;
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', `${card.title} details`);
  if (card.details?.length) {
    const details = el('p', 'flip-card__details');
    details.append(
      el('span', 'flip-card__details-label', `${card.detailsLabel ?? 'Skills'}: `),
      card.details.join(' · '),
    );
    scroll.append(details);
  }
  if (card.bullets?.length) {
    const list = el('ul', 'flip-card__bullets');
    card.bullets.forEach((line) => {
      const [, lead, rest] = /^([^:\s][^:]{0,20}):\s+([\s\S]+)$/.exec(line) ?? [];
      const item = el('li');
      if (lead) item.append(el('strong', 'flip-card__lead', `${lead}:`), ` ${rest}`);
      else item.textContent = line;
      list.append(item);
    });
    scroll.append(list);
  }
  if (card.link?.href) {
    const a = el('a', 'flip-card__link', card.link.text ?? 'More →');
    a.href = card.link.href;
    a.target = '_blank';
    a.rel = 'noopener';
    scroll.append(a);
  }
  back.append(scroll);
  inner.append(front, back);

  const updateFade = () => {
    const more = scroll.scrollTop + scroll.clientHeight < scroll.scrollHeight - 2;
    scroll.classList.toggle('has-more', more);
  };
  scroll.addEventListener('scroll', updateFade, { passive: true });
  // Wheel scroll never reaches the page behind (and, through it, the camera).
  scroll.addEventListener(
    'wheel',
    (event) => {
      const { scrollTop, scrollHeight, clientHeight } = scroll;
      const atTop = scrollTop <= 0 && event.deltaY < 0;
      const atEnd = scrollTop + clientHeight >= scrollHeight - 1 && event.deltaY > 0;
      event.stopPropagation();
      if (scrollHeight <= clientHeight || atTop || atEnd) event.preventDefault();
    },
    { passive: false },
  );

  const toggle = el('button', 'flip-card__toggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-controls', `${id}-front ${id}-back`);
  toggle.setAttribute('aria-describedby', `${id}-title`);

  function render(flipped) {
    root.classList.toggle('is-flipped', flipped);
    toggle.setAttribute('aria-expanded', String(flipped));
    toggle.textContent = flipped ? '← Back to summary' : `${action} →`;
    front.inert = flipped;
    back.inert = !flipped;
    front.setAttribute('aria-hidden', String(flipped));
    back.setAttribute('aria-hidden', String(!flipped));
    if (flipped) requestAnimationFrame(updateFade);
  }
  toggle.addEventListener('click', () => render(!root.classList.contains('is-flipped')));
  render(false);

  root.append(inner, toggle);
  return root;
}
