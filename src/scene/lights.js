import * as THREE from 'three';

export function createLights(scene) {
  const hemi = new THREE.HemisphereLight('#f4d4a1', '#17100b', 0.72);

  const key = new THREE.SpotLight('#ffb55e', 22, 16, Math.PI / 3.4, 0.62, 1.45);
  key.position.set(-4.3, 5.1, 3.3);
  key.target.position.set(0.3, 0.65, 0.1);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 13;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.018;

  const fill = new THREE.DirectionalLight('#8ba3bb', 0.48);
  fill.position.set(-5, 4, -3);

  const rim = new THREE.DirectionalLight('#c98845', 0.34);
  rim.position.set(5, 3, -4);

  // Short range and held well above the table: no hotspot on the glossy top.
  const cursor = new THREE.PointLight('#ffd9a0', 0.35, 1.3, 2);
  cursor.position.set(0, 1.4, 1.2);

  scene.add(hemi, key, key.target, fill, rim, cursor);
  return { hemi, key, fill, rim, cursor };
}
