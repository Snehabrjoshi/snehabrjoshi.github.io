// Purely visual (aria-hidden): the object's button already carries the label.
export function createObjectTag(el) {
  const name = el.querySelector('.object-tag__name');
  const blurb = el.querySelector('.object-tag__blurb');
  let current = null;
  let width = 0;
  let height = 0;

  return {
    show(item) {
      if (item === current) return;
      current = item;
      el.classList.toggle('is-visible', Boolean(item));
      if (!item) return;
      name.textContent = item.name;
      blurb.textContent = item.blurb;
      // measured once per change, not per frame
      width = el.offsetWidth;
      height = el.offsetHeight;
    },
    update() {
      if (!current?.screen) return;
      const { x0, x1, y0 } = current.screen;
      const x = Math.min(Math.max(16, (x0 + x1) / 2 - width / 2), innerWidth - width - 16);
      const y = Math.max(16, y0 - height - 14);
      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    },
  };
}
