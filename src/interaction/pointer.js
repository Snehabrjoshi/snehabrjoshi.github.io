import * as THREE from 'three';

// `ndc` starts off-screen so nothing is hovered before the first move.
export function createPointer() {
  const state = {
    ndc: new THREE.Vector2(4, 4),
    client: { x: innerWidth / 2, y: innerHeight / 2 },
  };
  state.set = (event) => {
    state.client.x = event.clientX;
    state.client.y = event.clientY;
    state.ndc.set((event.clientX / innerWidth) * 2 - 1, -(event.clientY / innerHeight) * 2 + 1);
  };
  addEventListener('pointermove', state.set, { passive: true });
  return state;
}
