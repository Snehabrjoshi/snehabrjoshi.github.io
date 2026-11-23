import * as THREE from 'three';

// Keyboard and screen-reader path into the 3D scene. Pointer input still goes
// to the canvas, where raycasting is more precise.
export function createObjectButtons({ container, onActivate, onFocus }) {
  const entries = [];
  const box = new THREE.Box3();
  const corner = new THREE.Vector3();
  const rect = { x0: 0, y0: 0, x1: 0, y1: 0 };

  function move(from, delta) {
    const next = (from + delta + entries.length) % entries.length;
    entries[next].button.focus();
  }

  return {
    add(item) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'scene-target';
      button.setAttribute('aria-label', `${item.name}. ${item.blurb}`);
      const index = entries.length;
      button.addEventListener('click', () => onActivate(item));
      button.addEventListener('focus', () => onFocus(item));
      button.addEventListener('blur', () => onFocus(null));
      button.addEventListener('keydown', (event) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
        if (step) move(index, step);
        else if (event.key === 'Home') entries[0].button.focus();
        else if (event.key === 'End') entries[entries.length - 1].button.focus();
        else return;
        event.preventDefault();
      });
      container.append(button);
      if (!item.hit.geometry.boundingBox) item.hit.geometry.computeBoundingBox();
      entries.push({ item, button });
    },
    focus(item, options = { preventScroll: true }) {
      entries.find((e) => e.item === item)?.button.focus(options);
    },
    // Writes only transforms (no layout reads): runs every frame.
    update(camera) {
      for (const { item, button } of entries) {
        box.copy(item.hit.geometry.boundingBox);
        rect.x0 = rect.y0 = Infinity;
        rect.x1 = rect.y1 = -Infinity;
        for (let i = 0; i < 8; i++) {
          corner
            .set(
              i & 1 ? box.max.x : box.min.x,
              i & 2 ? box.max.y : box.min.y,
              i & 4 ? box.max.z : box.min.z,
            )
            .applyMatrix4(item.hit.matrixWorld)
            .project(camera);
          const x = ((corner.x + 1) / 2) * innerWidth;
          const y = ((1 - corner.y) / 2) * innerHeight;
          rect.x0 = Math.min(rect.x0, x);
          rect.x1 = Math.max(rect.x1, x);
          rect.y0 = Math.min(rect.y0, y);
          rect.y1 = Math.max(rect.y1, y);
        }
        item.screen = { ...rect };
        button.style.transform = `translate(${rect.x0}px, ${rect.y0}px)`;
        button.style.width = `${rect.x1 - rect.x0}px`;
        button.style.height = `${rect.y1 - rect.y0}px`;
      }
    },
  };
}
