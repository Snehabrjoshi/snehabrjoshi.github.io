import { reducedMotion } from '../config/motion.js';

// Opening and closing sections, with or without the 3D scene.
// idle → opening → open → closing → idle, published as data-scene-state.
export function createController({ sections, reader, card }) {
  const root = document.documentElement;
  const setPhase = (value) => (root.dataset.sceneState = value);
  const phase = () => root.dataset.sceneState;
  let scene = null;
  let open = null;
  let openingEvent = null;

  function readingRects(item) {
    if (!scene || !item || reducedMotion() || scene.narrow) return null;
    return scene.readingRects();
  }

  async function openSection(id, returnFocus, triggerEvent = null) {
    const section = sections.get(id);
    if (!section || open) return;
    const item = scene?.items.get(id) ?? null;
    open = { section, item, returnFocus };
    openingEvent = triggerEvent;
    setPhase('opening');
    scene?.beginOpen();
    const opened = item && !reducedMotion() ? await scene.openMotion(item) : true;
    if (!opened || open?.section !== section) return; // closed before it finished
    if (section.kind === 'book') await reader.open(section.data, readingRects(item));
    else await card.open(section.card);
    if (open?.section === section && phase() === 'opening') setPhase('open');
  }

  async function close() {
    if (!open || phase() === 'closing') return;
    setPhase('closing');
    const { section, item, returnFocus } = open;
    await (section.kind === 'book' ? reader.hide() : card.hide()); // text first
    if (item && !reducedMotion()) await scene.closeMotion(item);
    open = null;
    setPhase('idle');
    scene?.endOpen();
    returnFocus?.focus({ preventScroll: true });
  }

  addEventListener('pointerup', (event) => {
    if (phase() === 'opening' && event !== openingEvent && open?.item)
      scene.finishMotion(open.item);
  });
  addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && phase() === 'opening') close();
  });
  addEventListener('resize', () => {
    if (phase() === 'open' && open?.section.kind === 'book' && open.item && !reducedMotion()) {
      scene.relayoutOpen();
      reader.place(readingRects(open.item));
    }
  });

  return {
    open: openSection,
    close,
    get isOpen() {
      return Boolean(open);
    },
    attachScene(value) {
      scene = value;
    },
    setPhase,
  };
}
