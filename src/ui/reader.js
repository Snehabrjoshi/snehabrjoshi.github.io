import { DURATION, reducedMotion } from '../config/motion.js';
import { createPlate } from './plate.js';
import { createContactPage } from './contact.js';
import { createFlipCard } from './flipCard.js';
import { createSkills } from './skills.js';
import { PAGE_NIGHT, multiply, pagePaper, darkPage } from '../config/palette.js';
import { bookName } from '../data/names.js';

function timeline(cards) {
  const list = document.createElement('ol');
  list.className = 'timeline';
  list.setAttribute('aria-label', 'Roles');
  for (const card of cards) {
    const item = document.createElement('li');
    const role = document.createElement('span');
    role.className = 'timeline__role';
    role.textContent = card.title;
    const org = document.createElement('span');
    org.className = 'timeline__org';
    org.textContent = card.kicker ?? '';
    item.append(role, org);
    list.append(item);
  }
  return list;
}

const wait = (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));

// HTML pages laid over the 3D pages (the HTML is transparent, so the paper is
// the 3D paper): real text, selectable and readable by screen readers.
export function createReader({ onRequestClose, links = {} }) {
  const modal = document.querySelector('#book-modal');
  const pages = {
    left: modal.querySelector('.reader-page--left'),
    right: modal.querySelector('.reader-page--right'),
  };
  const fields = {
    section: document.querySelector('#reader-section'),
    volume: document.querySelector('#modal-volume'),
    title: document.querySelector('#modal-title'),
    subtitle: document.querySelector('#modal-subtitle'),
    lead: document.querySelector('#modal-lead'),
    body: document.querySelector('#modal-body'),
  };
  const folios = {
    left: modal.querySelector('.reader-folio--left'),
    right: modal.querySelector('.reader-folio--right'),
  };

  document.querySelector('#close-modal').addEventListener('click', onRequestClose);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) onRequestClose();
  });
  modal.addEventListener('cancel', (event) => {
    event.preventDefault(); // Escape runs the closing sequence instead
    onRequestClose();
  });

  const updateFade = () => {
    const { scrollTop, scrollHeight, clientHeight } = fields.body;
    fields.body.classList.toggle('has-more', scrollTop + clientHeight < scrollHeight - 4);
  };
  fields.body.addEventListener('scroll', updateFade, { passive: true });

  return {
    get isOpen() {
      return modal.open;
    },
    place(rects) {
      modal.classList.toggle('is-paper', !rects);
      for (const side of ['left', 'right']) {
        const el = pages[side];
        const r = rects?.[side];
        const style = r
          ? `left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px;--pw:${r.width}px`
          : '';
        el.style.cssText = style;
        folios[side].style.cssText = style;
      }
      updateFade();
    },
    open(data, rects) {
      const name = bookName(data);
      const paper = pagePaper(data.coverColor);
      modal.style.setProperty('--book', data.coverColor);
      modal.style.setProperty('--book-page', darkPage(data.coverColor));
      modal.style.setProperty('--page-paper-day', paper);
      modal.style.setProperty('--page-paper-night', multiply(paper, PAGE_NIGHT));
      fields.section.textContent = `Volume ${data.volume} · ${name}`;
      fields.volume.textContent = `${data.volume} / ${data.spineTitle ?? data.title}`;
      fields.title.textContent = name;
      fields.subtitle.textContent = data.subtitle;
      fields.lead.textContent = data.lead;
      // Volume n opens on pages 2n+4 and 2n+5, after the front matter.
      const first = Number(data.volume) * 2 + 4;
      folios.left.textContent = String(first).padStart(2, '0');
      folios.right.textContent = String(first + 1).padStart(2, '0');

      pages.left
        .querySelectorAll('.plate, .flip-stack, .timeline, .skills')
        .forEach((n) => n.remove());
      pages.left.classList.toggle('has-plate', Boolean(data.photos?.length));
      if (data.timeline && data.cards?.length) pages.left.append(timeline(data.cards));
      if (data.photos?.length) pages.left.append(createPlate(data.photos));
      fields.body.innerHTML = data.html;
      if (data.contact) fields.body.append(...createContactPage(links));
      if (data.skillGroups?.length) {
        const split = data.skillsOnLeft ?? 0;
        if (split) pages.left.append(createSkills(data.skillGroups.slice(0, split)));
        fields.body.append(createSkills(data.skillGroups.slice(split)));
      }
      if (data.cards?.length) {
        const stack = (cards) => {
          const node = document.createElement('div');
          node.className = 'flip-stack';
          node.append(
            ...cards.map((card) =>
              createFlipCard(card, { motif: data.motif, action: data.cardAction }),
            ),
          );
          return node;
        };
        const onLeft = data.cardLayout === 'spread' ? data.cards.slice(0, 1) : [];
        if (onLeft.length) pages.left.append(stack(onLeft));
        fields.body.append(stack(data.cards.slice(onLeft.length)));
      }
      fields.body.scrollTop = 0;
      modal.style.setProperty('--reader-fade', `${DURATION.reveal * 1000}ms`);
      modal.showModal();
      this.place(rects);
      requestAnimationFrame(() => modal.classList.add('is-visible'));
      return wait(DURATION.reveal);
    },
    async hide() {
      if (!modal.open) return;
      modal.style.setProperty('--reader-fade', `${DURATION.fade * 1000}ms`);
      modal.classList.remove('is-visible');
      await wait(DURATION.fade);
      modal.close();
    },
    reducedMotion,
  };
}
