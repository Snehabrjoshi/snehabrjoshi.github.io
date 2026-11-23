// index.html's inline script applies the saved mode before first paint.

import { DURATION, reducedMotion } from '../config/motion.js';

const STORAGE_KEY = 'bookshop-theme';
const MODES = ['night', 'day'];

function save(mode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* storage unavailable: mode lasts for this visit */
  }
}

export function currentMode() {
  const mode = document.documentElement.dataset.theme;
  return MODES.includes(mode) ? mode : 'night';
}

export function themeDuration() {
  return reducedMotion() ? 0 : DURATION.theme;
}

export function initThemeToggle(button, onChange) {
  let mode = currentMode();

  function placeRule() {
    const active = button.querySelector(`[data-mode="${mode}"]`);
    // Letter-spacing trails the last glyph; trim it so the rule matches the word.
    const tracking = parseFloat(getComputedStyle(active).letterSpacing) || 0;
    button.style.setProperty('--rule-x', `${active.offsetLeft}px`);
    button.style.setProperty('--rule-w', `${active.offsetWidth - tracking}px`);
  }

  function render() {
    button.setAttribute('aria-checked', String(mode === 'day'));
    placeRule();
  }

  button.addEventListener('click', () => {
    mode = mode === 'day' ? 'night' : 'day';
    document.documentElement.dataset.theme = mode;
    save(mode);
    render();
    onChange(mode);
  });

  render();
  // Enabled only after the first placement, so the rule doesn't slide in on load.
  requestAnimationFrame(() => {
    button.dataset.ready = '';
  });
  document.fonts.ready.then(placeRule);
  addEventListener('resize', placeRule);
}
