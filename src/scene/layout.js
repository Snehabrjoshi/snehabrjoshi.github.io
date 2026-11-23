import * as THREE from 'three';

export const TABLE_TOP = 1.0;

const VARIANTS = {
  wide: {
    row: [0, -0.15],
    rowScale: 1,
    objectScale: 1,
    glass: [-1.55, 0.5],
    speaker: [1.6, -0.35],
    halfWidth: 2.15,
    elevation: THREE.MathUtils.degToRad(9),
    fov: 30,
    focusY: 1.95,
  },
  compact: {
    row: [0, -0.3],
    rowScale: 1.35, // spines ≥ 24 px wide at 390 px: tappable and legible
    objectScale: 0.75,
    glass: [-0.95, 0.95],
    speaker: [0.98, 0.88],
    halfWidth: 1.45,
    elevation: THREE.MathUtils.degToRad(15),
    fov: 44,
    focusY: 2.3,
  },
};

export function computeLayout(aspect) {
  const v = aspect < 0.95 ? VARIANTS.compact : VARIANTS.wide;
  return {
    variant: v === VARIANTS.compact ? 'compact' : 'wide',
    row: { x: v.row[0], z: v.row[1], scale: v.rowScale },
    objectScale: v.objectScale,
    glass: { x: v.glass[0], z: v.glass[1] },
    speaker: { x: v.speaker[0], z: v.speaker[1] },
    camera: { halfWidth: v.halfWidth, elevation: v.elevation, fov: v.fov, focusY: v.focusY },
  };
}

export function faceToward(x, z, cx, cz) {
  return Math.atan2(cx - x, cz - z);
}
