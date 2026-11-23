import * as THREE from 'three';
import { createWoodTexture } from './textures.js';

// The texture is painted light; the theme's material colour sets how dark it reads.
export function createTable() {
  const group = new THREE.Group();
  const wood = createWoodTexture();
  wood.map.repeat.set(1.4, 1.4);
  const top = new THREE.MeshStandardMaterial({
    map: wood.map,
    roughnessMap: wood.roughnessMap,
    roughness: 0.62,
    bumpMap: wood.map,
    bumpScale: 0.012,
  });
  const dark = new THREE.MeshStandardMaterial({ map: wood.map, roughness: 0.7 });

  const parts = [
    [new THREE.CylinderGeometry(3.05, 3.02, 0.18, 96), [dark, top, dark], 0.91],
    [new THREE.CylinderGeometry(2.85, 2.78, 0.26, 72), dark, 0.72],
    [new THREE.CylinderGeometry(0.46, 0.67, 0.86, 32), dark, 0.27],
    [new THREE.CylinderGeometry(1.15, 0.92, 0.16, 48), dark, -0.12],
  ];
  parts.forEach(([geometry, material, y], i) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = y;
    mesh.castShadow = true;
    mesh.receiveShadow = i === 0;
    group.add(mesh);
  });
  group.userData.themeTargets = { tableTop: top, tableDark: dark };
  return group;
}
