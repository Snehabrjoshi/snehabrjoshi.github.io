import * as THREE from 'three';

export function createCursor({ orb, light, raycaster, canvas }) {
  // The orb stands in only for a mouse over the scene; elsewhere the native cursor shows.
  let overScene = false;
  addEventListener(
    'pointermove',
    (event) => {
      overScene = event.target === canvas && event.pointerType === 'mouse';
      orb.classList.toggle('is-away', !overScene);
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', () => (overScene = false));
  let presence = 0; // the glow fades in only while a mouse is over the scene
  const tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.2);
  const onTable = new THREE.Vector3();
  let x = innerWidth / 2;
  let y = innerHeight / 2;

  return {
    setHovering(on) {
      orb.classList.toggle('is-hovering', on);
    },
    setVisible(on) {
      orb.style.opacity = on ? '1' : '0';
    },
    // Call after raycaster.setFromCamera for this frame.
    update(client) {
      x += (client.x - x) * 0.25;
      y += (client.y - y) * 0.25;
      orb.style.transform = `translate3d(${x}px,${y}px,0)`;
      if (raycaster.ray.intersectPlane(tablePlane, onTable)) {
        onTable.x = THREE.MathUtils.clamp(onTable.x, -2.8, 2.8);
        onTable.z = THREE.MathUtils.clamp(onTable.z, -1.2, 2.2);
        light.position.lerp(onTable, 0.16);
        light.position.y = 1.45; // never closer than 0.45 to the table top
      }
      presence += ((overScene ? 1 : 0) - presence) * 0.08;
      light.intensity = (light.userData.base ?? 0) * presence;
    },
  };
}
