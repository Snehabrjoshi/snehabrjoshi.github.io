import { DURATION } from '../config/motion.js';

// Written by scripts/photos.mjs before each build; absent in a fresh checkout.
const generated = import.meta.glob('../data/photos.generated.json', { eager: true });
const manifest = Object.values(generated)[0]?.default ?? {};

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

function picture(photo) {
  const entry = manifest[photo.src];
  const pic = el('picture', 'plate-photo');
  const img = el('img');
  img.alt = photo.alt;
  img.decoding = 'async';
  if (entry) {
    img.width = entry.width;
    img.height = entry.height;
  }
  const sizes = '(max-width: 719px) 90vw, 30vw';
  return {
    node: pic,
    // Sources are set just before a photo is shown, so opening downloads one image.
    load() {
      if (img.src) return;
      for (const format of ['avif', 'webp']) {
        if (!entry?.sources[format]) continue;
        const source = el('source');
        source.type = `image/${format}`;
        source.srcset = entry.sources[format];
        source.sizes = sizes;
        pic.append(source);
      }
      pic.append(img);
      img.src = photo.src.replace(/^\//, ''); // relative: the site may live under a subpath
      img.addEventListener('load', () =>
        pic.dispatchEvent(new Event('plate:resize', { bubbles: true })),
      );
    },
  };
}

// The wheel is only taken over the photo itself, never the page around it.
export function createPlate(photos) {
  const root = el('figure', 'plate');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-roledescription', 'carousel');
  root.setAttribute('aria-label', 'Photographs');
  const frame = el('div', 'plate-frame');
  frame.tabIndex = 0;
  const caption = el('figcaption', 'plate-caption');
  caption.setAttribute('aria-live', 'polite');
  const controls = el('div', 'plate-controls');
  const prev = el('button', 'plate-step', '←');
  const next = el('button', 'plate-step', '→');
  prev.type = next.type = 'button';
  prev.setAttribute('aria-label', 'Previous photograph');
  next.setAttribute('aria-label', 'Next photograph');
  const count = el('span', 'plate-count');
  controls.append(prev, count, next);
  root.append(frame, caption, controls);
  controls.hidden = photos.length < 2;

  const slides = photos.map((photo) => {
    const p = picture(photo);
    p.node.setAttribute('aria-hidden', 'true');
    frame.append(p.node);
    return p;
  });
  let index = 0;

  function captionFor(i) {
    const photo = photos[i];
    const where = [photo.place, photo.date].filter(Boolean).join(', ');
    const nodes = [el('span', 'plate-fig', `Fig. ${i + 1}`), ` ${photo.caption}`];
    if (where) nodes.push(el('span', 'plate-where', ` · ${where}`));
    return nodes;
  }

  function show(i, animate = true) {
    index = (i + photos.length) % photos.length;
    slides.forEach((s, k) => {
      const active = k === index;
      s.node.classList.toggle('is-active', active);
      s.node.toggleAttribute('aria-hidden', !active);
    });
    slides[index].load();
    requestAnimationFrame(align);
    slides[(index + 1) % slides.length].load();
    count.textContent = `${index + 1} / ${photos.length}`;
    frame.setAttribute(
      'aria-label',
      `Photograph ${index + 1} of ${photos.length}${photos.length > 1 ? '; left and right arrow keys change it' : ''}`,
    );
    if (!animate) {
      caption.replaceChildren(...captionFor(index));
      return;
    }
    caption.classList.add('is-changing');
    setTimeout(() => {
      caption.replaceChildren(...captionFor(index));
      caption.classList.remove('is-changing');
    }, DURATION.fade * 1000);
  }

  prev.addEventListener('click', () => show(index - 1));
  next.addEventListener('click', () => show(index + 1));
  frame.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') show(index + 1);
    else if (event.key === 'ArrowLeft') show(index - 1);
    else return;
    event.preventDefault();
  });

  // Wheel: one step per gesture (trackpads send dozens of small events).
  let wheel = 0;
  let resting = true;
  let quiet = null;
  frame.addEventListener(
    'wheel',
    (event) => {
      if (photos.length < 2) return;
      event.preventDefault();
      clearTimeout(quiet);
      quiet = setTimeout(() => {
        wheel = 0;
        resting = true;
      }, 220);
      if (!resting) return;
      wheel += Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      if (Math.abs(wheel) > 40) {
        show(index + Math.sign(wheel));
        resting = false;
      }
    },
    { passive: false },
  );

  // Swipe (touch or pen); vertical movement is left to the page.
  let start = null;
  frame.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse') start = { x: event.clientX, y: event.clientY };
  });
  frame.addEventListener('pointerup', (event) => {
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) show(index + (dx < 0 ? 1 : -1));
  });
  frame.addEventListener('pointercancel', () => (start = null));

  // Aligned with the photo itself (mat included), not the wider frame.
  function align() {
    const node = slides[index].node;
    const target = node.querySelector('img') ?? node;
    const frameBox = frame.getBoundingClientRect();
    const box = target.getBoundingClientRect();
    if (!box.width) return;
    root.style.setProperty('--plate-x', `${box.left - frameBox.left}px`);
    root.style.setProperty('--plate-w', `${box.width}px`);
  }
  root.addEventListener('plate:resize', align);
  new ResizeObserver(align).observe(frame);

  show(0, false);
  return root;
}
