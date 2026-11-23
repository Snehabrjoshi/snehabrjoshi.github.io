import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const HALF = 0.3;
const DEPTH = 0.46;
const RISE = 0.065;
const BOARD = 0.012;

export function createFaceDownBook(cloth = '#d9694f') {
  const angle = Math.asin(RISE / HALF);
  const half = (side) => {
    const pages = new THREE.BoxGeometry(HALF - 0.02, 0.05, DEPTH - 0.03).translate(
      (side * (HALF - 0.02)) / 2,
      -0.025 - BOARD,
      0,
    );
    const board = new THREE.BoxGeometry(HALF, BOARD, DEPTH).translate(
      (side * HALF) / 2,
      -BOARD / 2,
      0,
    );
    const tilt = new THREE.Matrix4()
      .makeTranslation(0, RISE, 0)
      .multiply(new THREE.Matrix4().makeRotationZ(-side * angle));
    return [pages.applyMatrix4(tilt), board.applyMatrix4(tilt)];
  };
  const [pagesL, boardL] = half(-1);
  const [pagesR, boardR] = half(1);
  const spine = new THREE.CylinderGeometry(0.02, 0.02, DEPTH, 12, 1, true, 0, Math.PI)
    .rotateX(Math.PI / 2)
    .rotateZ(-Math.PI / 2)
    .translate(0, RISE - 0.004, 0);

  const group = new THREE.Group();
  const covers = new THREE.Mesh(
    mergeGeometries(
      [boardL, boardR, spine.toNonIndexed()].map((g) => (g.index ? g.toNonIndexed() : g)),
    ),
    new THREE.MeshStandardMaterial({ color: cloth, roughness: 0.8 }),
  );
  const pages = new THREE.Mesh(
    mergeGeometries([pagesL, pagesR]),
    new THREE.MeshStandardMaterial({ color: '#efe6d2', roughness: 0.9 }),
  );
  covers.castShadow = pages.castShadow = true;
  covers.receiveShadow = pages.receiveShadow = true;
  group.add(covers, pages);
  return group;
}
