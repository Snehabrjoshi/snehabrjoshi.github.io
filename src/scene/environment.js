import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Reflections for the hero objects only, so the room keeps its night-time dark.
const materials = new Set();
let texture = null;
let intensity = 1;

export function createEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  texture = pmrem.fromScene(room, 0.04).texture;
  room.dispose?.();
  pmrem.dispose();
  materials.forEach((m) => (m.envMap = texture));
}

export function useEnvironment(material) {
  materials.add(material);
  material.envMap = texture;
  material.envMapIntensity = intensity;
  return material;
}

export function setEnvironmentIntensity(value) {
  intensity = value;
  materials.forEach((m) => (m.envMapIntensity = value));
}
