import * as THREE from 'three';
import { painted } from '../paint/painter.js';
import { imageTexture } from '../objects/coverArt.js';

export { WOOD_LIFT } from '../paint/surfaces.js';

function srgb(image, wrap = false) {
  const map = imageTexture(image);
  map.colorSpace = THREE.SRGBColorSpace;
  if (wrap) map.wrapS = map.wrapT = THREE.RepeatWrapping;
  return map;
}

export function createPageTexture() {
  return srgb(painted('page-block', 'pageBlock'), true);
}

// The roughness map is uniform: a 4 px canvas, not a full-size one.
let roughness;
export function createWoodTexture(size = 1024, floor = false) {
  const map = srgb(painted(`wood:${size}:${floor}`, 'wood', { size, floor }), true);
  map.anisotropy = 8;
  if (!roughness) {
    const c = document.createElement('canvas');
    c.width = c.height = 4;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#9b9b9b';
    ctx.fillRect(0, 0, 4, 4);
    roughness = c;
  }
  const roughnessMap = new THREE.CanvasTexture(roughness);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  return { map, roughnessMap };
}

export function createPrintedPageTexture() {
  const map = srgb(painted('printed-page', 'printedPage'));
  map.anisotropy = 4;
  return map;
}

export function createReadingPageTexture(key, params) {
  const map = srgb(painted(key, 'readingPage', params));
  map.anisotropy = 8;
  return map;
}
