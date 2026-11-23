import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  createPageTexture,
  createPrintedPageTexture,
  createReadingPageTexture,
} from '../world/textures.js';
import { PAPER, PAGE_NIGHT, pagePaper, darkPage } from '../config/palette.js';
import { paintCover, paintSpine } from './coverArt.js';
import { SERIES } from './series.js';
import { useEnvironment } from '../scene/environment.js';

const PAGE_COUNT = 7;
export const spineArcFor = (thickness) => thickness * 1.06;
const PULL = 0.17; // how far a book slides out of the row on hover/focus
const GAP = 0.006;

let shared;
function sharedMaterials() {
  if (!shared) {
    const block = createPageTexture();
    shared = {
      block: new THREE.MeshStandardMaterial({
        map: block,
        bumpMap: block,
        bumpScale: 0.003,
        roughness: 0.92,
        color: '#fff8e8',
      }),
      // A paper-coloured emissive keeps turning leaves cream under the warm key light.
      leaf: new THREE.MeshStandardMaterial({
        map: createPrintedPageTexture(),
        roughness: 0.95,
        emissive: PAPER,
        emissiveIntensity: 0.5,
        side: THREE.DoubleSide,
      }),
      endpaper: new THREE.MeshStandardMaterial({ color: '#e9dfcb', roughness: 0.9 }),
    };
  }
  return shared;
}

// Unlit and untone-mapped so the transparent HTML text layer above never
// shifts colour.
const readingMaterials = new Set();
const pageTint = new THREE.Color('#ffffff');
export const readingPageKey = (id, side) => `reading-page:${id}:${side}`;
export const readingPageParams = (book, side) =>
  side === 'left'
    ? { paper: darkPage(book.coverColor), side, dark: true }
    : { paper: pagePaper(book.coverColor), side };
function readingMaterial(book, side) {
  const material = new THREE.MeshBasicMaterial({
    map: createReadingPageTexture(readingPageKey(book.id, side), readingPageParams(book, side)),
    color: pageTint,
    toneMapped: false,
    fog: false,
    side: THREE.DoubleSide,
  });
  readingMaterials.add(material);
  return material;
}
const nightTint = new THREE.Color(PAGE_NIGHT);
const white = new THREE.Color('#ffffff');
export function setPageNight(amount) {
  pageTint.lerpColors(white, nightTint, amount);
  readingMaterials.forEach((m) => m.color.copy(pageTint));
}

const withoutUv = (g) => {
  const flat = g.index ? g.toNonIndexed() : g;
  flat.deleteAttribute('uv');
  return flat;
};

export function createBook(data, thickness) {
  const { width: w, height: h, board: b, overhang } = SERIES;
  const t = thickness;
  const mats = sharedMaterials();
  const cover = paintCover(data);
  const spineArc = spineArcFor(t);
  const spineArt = paintSpine(data, spineArc);

  const cloth = useEnvironment(
    new THREE.MeshStandardMaterial({ color: data.coverColor, roughness: 0.86 }),
  );
  const artMaterial = (art) =>
    useEnvironment(
      new THREE.MeshStandardMaterial({
        map: art.map,
        bumpMap: art.orm,
        bumpScale: 1.4,
        roughnessMap: art.orm,
        roughness: 1,
        metalnessMap: art.orm,
        metalness: 1,
      }),
    );

  const slot = new THREE.Group();
  slot.rotation.y = Math.PI / 2; // local -X (the spine) faces the row's front
  const body = new THREE.Group();
  const rest = new THREE.Vector3(0, h / 2, 0);
  body.position.copy(rest);
  slot.add(body);

  const boardGeo = new RoundedBoxGeometry(w, h, b, 2, 0.005);
  const back = new THREE.Mesh(boardGeo, cloth);
  back.position.z = -t / 2 + b / 2;

  const spine = new THREE.Mesh(
    new THREE.CylinderGeometry(t / 2, t / 2, h, 24, 1, true, Math.PI, Math.PI).scale(0.32, 1, 1),
    artMaterial(spineArt),
  );
  spine.position.x = -w / 2;

  const spineInset = b * 1.4;
  const blockW = w - overhang - spineInset;
  const block = new THREE.Mesh(
    new RoundedBoxGeometry(blockW, h - overhang * 2, t - b * 2, 2, 0.003),
    mats.block,
  );
  block.position.x = -w / 2 + spineInset + blockW / 2;

  const frontPivot = new THREE.Group();
  frontPivot.position.set(-w / 2, 0, t / 2 - b / 2);
  const front = new THREE.Mesh(boardGeo, cloth);
  front.position.x = w / 2;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.003, h - 0.003), artMaterial(cover));
  face.position.set(w / 2, 0, b / 2 + 0.0006);
  frontPivot.add(front, face);

  [back, spine, block, front].forEach((m) => {
    m.castShadow = true;
    m.receiveShadow = true;
  });
  face.receiveShadow = true;
  body.add(back, spine, block, frontPivot);

  // Leaves rise as they turn so the turned stack lies above the endpaper; the
  // right-hand page then rises to the same plane, making the spread flat.
  const pageH = h - overhang * 2 - 0.006;
  const leafW = spineInset + blockW - 0.006;
  const leafGeo = new THREE.PlaneGeometry(leafW, pageH).translate(leafW / 2 + 0.001, 0, 0);
  const restZ = t / 2 - b + 0.0015;
  const flatZ = t / 2 + 0.002;
  const pagePivots = [];
  for (let i = 0; i < PAGE_COUNT; i++) {
    const pivot = new THREE.Group();
    pivot.position.set(-w / 2, 0, restZ + i * 0.0003);
    pivot.userData.restZ = pivot.position.z;
    pivot.userData.flatZ = flatZ + i * 0.0004;
    const last = i === PAGE_COUNT - 1;
    pivot.add(new THREE.Mesh(leafGeo, last ? readingMaterial(data, 'left') : mats.leaf));
    body.add(pivot);
    pagePivots.push(pivot);
  }
  const rightPage = new THREE.Mesh(leafGeo, readingMaterial(data, 'right'));
  rightPage.position.set(-w / 2, 0, restZ - 0.0005);
  rightPage.userData.restZ = rightPage.position.z;
  rightPage.userData.flatZ = flatZ + PAGE_COUNT * 0.0004;
  const endpaper = new THREE.Mesh(
    new THREE.PlaneGeometry(w - 0.02, h - 0.02).rotateY(Math.PI),
    mats.endpaper,
  );
  endpaper.position.set(w / 2, 0, -b / 2 - 0.0005);
  frontPivot.add(endpaper);
  body.add(rightPage);
  const openParts = [rightPage, endpaper, ...pagePivots];
  openParts.forEach((part) => (part.visible = false));

  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.02, h + 0.02, t),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  body.add(hit);

  const item = {
    kind: 'book',
    id: data.id,
    data,
    thickness: t,
    width: w,
    height: h,
    slot,
    body,
    frontPivot,
    pagePivots,
    rightPage,
    leftPage: pagePivots[PAGE_COUNT - 1].children[0],
    openParts,
    rest,
    hit,
    hover: 0,
    setLift(p) {
      body.position.set(rest.x - p * PULL, rest.y + p * 0.01, rest.z);
    },
  };
  hit.userData.target = item;
  return item;
}

export function createBookRow(items) {
  const group = new THREE.Group();
  const total = items.reduce((sum, item) => sum + item.thickness, 0) + GAP * (items.length - 1);
  let x = -total / 2;
  items.forEach((item, i) => {
    x += item.thickness / 2;
    item.slot.position.set(x, 0, [0.004, -0.006, 0.002, -0.003, 0.005][i % 5]);
    group.add(item.slot);
    x += item.thickness / 2 + GAP;
  });

  const walnut = new THREE.MeshStandardMaterial({ color: '#3b2517', roughness: 0.45 });
  const end = mergeGeometries([
    withoutUv(new RoundedBoxGeometry(0.075, SERIES.height * 0.62, 0.52, 3, 0.012)).translate(
      0,
      SERIES.height * 0.31,
      0,
    ),
    withoutUv(new RoundedBoxGeometry(0.2, 0.024, 0.52, 3, 0.008)).translate(-0.0625, 0.012, 0),
  ]);
  const ends = new THREE.InstancedMesh(end, walnut, 2);
  const m = new THREE.Matrix4();
  [-1, 1].forEach((side, i) => {
    m.makeTranslation(side * (total / 2 + 0.05), 0, 0.02);
    if (side > 0) m.multiply(new THREE.Matrix4().makeRotationY(Math.PI));
    ends.setMatrixAt(i, m);
  });
  ends.castShadow = true;
  ends.receiveShadow = true;
  group.add(ends);
  return { group, width: total + 0.2 };
}
