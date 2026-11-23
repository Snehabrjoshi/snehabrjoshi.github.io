import { gsap } from 'gsap';
import './style.css';
import {
  PORTFOLIO_BOOKS,
  PROFILE,
  LINKS,
  READING,
  PHOTOS,
  PLAYLIST,
  COLOPHON,
} from './data/portfolioData.js';
import { applyMotionTokens } from './config/motion.js';
import { applyPaletteTokens } from './config/palette.js';
import { webglAvailable } from './scene/webgl.js';
import { renderProfile } from './ui/profile.js';
import { createReader } from './ui/reader.js';
import { createCard } from './ui/card.js';
import { createContents } from './ui/contents.js';
import { createController } from './ui/controller.js';
import { initThemeToggle, currentMode, themeDuration } from './theme/themeToggle.js';
import { bookName } from './data/names.js';
import { prefetchLive } from './data/live.js';

applyMotionTokens();
applyPaletteTokens();
prefetchLive();
renderProfile(PROFILE, LINKS);

// ?capture (screenshot script only): follow real time even when software
// rendering stalls frames, slow motion down, and let the script pause it.
if (new URLSearchParams(location.search).has('capture')) {
  gsap.ticker.lagSmoothing(0);
  gsap.globalTimeline.timeScale(0.25);
  window.__capture = {
    pause: () => void gsap.globalTimeline.pause(),
    resume: () => void gsap.globalTimeline.resume(),
  };
}

const books = PORTFOLIO_BOOKS.map((book) =>
  book.id === 'about' ? { ...book, photos: PHOTOS.filter((photo) => photo.src) } : book,
);

const SECTIONS = [
  ...books.map((book) => ({
    id: book.id,
    kind: 'book',
    number: book.volume,
    name: bookName(book),
    blurb: book.blurb,
    data: book,
  })),
  {
    id: 'reading',
    kind: 'card',
    name: READING.title,
    blurb: 'From the glass',
    card: { type: 'reading', data: READING, label: 'From the glass', side: 'left' },
  },
  {
    id: 'playlist',
    kind: 'card',
    name: PLAYLIST.title,
    blurb: 'From the speaker',
    card: { type: 'playlist', data: PLAYLIST, label: 'From the speaker', side: 'right' },
  },
  {
    id: 'colophon',
    kind: 'card',
    name: 'Colophon',
    blurb: 'How this was built',
    card: { type: 'prose', data: COLOPHON, label: 'Colophon', side: 'centre' },
  },
];

const controller = createController({
  sections: new Map(SECTIONS.map((s) => [s.id, s])),
  reader: createReader({ onRequestClose: () => controller.close(), links: LINKS }),
  card: createCard({ onRequestClose: () => controller.close() }),
});
const contents = createContents({
  sections: SECTIONS,
  onSelect: (id, returnFocus) => controller.open(id, returnFocus),
});

let scene = null;
initThemeToggle(document.querySelector('#mode-toggle'), (mode) =>
  scene?.setMode(mode, themeDuration()),
);

function ready() {
  document.querySelector('#loading-screen').classList.add('hidden');
  controller.setPhase('idle');
}

if (webglAvailable()) {
  try {
    // Loaded on demand: without WebGL the three.js chunks are never fetched.
    const { createBookshop } = await import('./scene/bookshop.js');
    scene = await createBookshop({
      books,
      mode: currentMode(),
      onActivate: (id, returnFocus, event) => controller.open(id, returnFocus, event),
      isOpen: () => controller.isOpen,
    });
    controller.attachScene(scene);
  } catch (error) {
    console.error('3D scene failed to start; showing the contents instead.', error);
    scene = null;
  }
}
if (!scene) {
  document.documentElement.classList.add('no-webgl');
  contents.showStatic();
}
requestAnimationFrame(ready);
