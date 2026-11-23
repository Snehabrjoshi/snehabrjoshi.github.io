// The only place durations and easing curves are defined, for CSS and GSAP alike.

export const DURATION = {
  fast: 0.16, // hover, focus, small state changes
  base: 0.32, // panels and fades
  slow: 0.56, // object moves (lift, cover swing)
  flip: 0.45, // a card turning over
  theme: 1.1, // day/night blend
  fade: 0.12, // opacity-only fade-outs; kept under reduced motion
  reveal: 0.2, // opacity-only fade-ins (reading text); kept under reduced motion
};

// Opacity fades don't involve motion, so reduced motion keeps them.
const KEPT_UNDER_REDUCED_MOTION = new Set(['fade', 'reveal']);

export const EASE = {
  standard: { css: 'cubic-bezier(0.65, 0, 0.35, 1)', gsap: 'power2.inOut' },
  out: { css: 'cubic-bezier(0.33, 1, 0.68, 1)', gsap: 'power2.out' },
  in: { css: 'cubic-bezier(0.32, 0, 0.67, 0)', gsap: 'power2.in' },
};

const query = matchMedia('(prefers-reduced-motion: reduce)');
export const reducedMotion = () => query.matches;

export function applyMotionTokens(root = document.documentElement) {
  const write = () => {
    for (const [name, seconds] of Object.entries(DURATION)) {
      const zero = reducedMotion() && !KEPT_UNDER_REDUCED_MOTION.has(name);
      root.style.setProperty(`--dur-${name}`, `${zero ? 0 : seconds * 1000}ms`);
    }
    for (const [name, { css }] of Object.entries(EASE)) {
      root.style.setProperty(`--ease-${name}`, css);
    }
  };
  write();
  query.addEventListener('change', write);
}
