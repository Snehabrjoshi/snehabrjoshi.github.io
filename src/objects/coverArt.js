import * as THREE from 'three';
import { painted } from '../paint/painter.js';

// orm: half-resolution packed map, R = bump, G = roughness, B = metalness.
function textures({ albedo, orm }) {
  const map = imageTexture(albedo);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const ormMap = imageTexture(orm);
  ormMap.anisotropy = 4;
  return { map, orm: ormMap };
}

// ImageBitmaps arrive already flipped: WebGL ignores flipY for bitmaps.
export function imageTexture(image) {
  const texture = new THREE.Texture(image);
  if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

export function paintCover(book) {
  return textures(painted(`cover:${book.id}`, 'cover', book));
}

export function paintSpine(book, arc) {
  return textures(painted(`spine:${book.id}`, 'spine', { book, arc }));
}
