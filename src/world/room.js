import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createWoodTexture } from './textures.js';
import { createWindowView } from './windowView.js';
import { WASH } from '../paint/sconceWash.js';
import { painted } from '../paint/painter.js';
import { imageTexture } from '../objects/coverArt.js';

// Instance colours are scaled by SHELF_VALUE so the series on the table stays the focus.
const JACKETS = [
  '#e0735a',
  '#d9a531',
  '#2f56b0',
  '#2a8c8a',
  '#e8a9a6',
  '#a48bc4',
  '#8fa77f',
  '#c9483a',
  '#5d6fb8',
  '#f0b9a0',
  '#4f9a6e',
];
const PAPERBACKS = ['#efe6d2', '#f4f1ea', '#e9dcc0', '#f2e7da'];
const SHELF_VALUE = 0.86;
function seeded(seed = 41) {
  let v = seed >>> 0;
  return () => (v = (Math.imul(1664525, v) + 1013904223) >>> 0) / 4294967296;
}

// Frame and books are one merged and one instanced mesh: two draw calls per case.
function shelfUnit(width, height, depth, seed, rows = 5) {
  const rand = seeded(seed);
  const g = new THREE.Group();
  const woodTex = createWoodTexture(512);
  const wood = new THREE.MeshStandardMaterial({
    map: woodTex.map,
    roughness: 0.76,
    color: '#7a5a44', // the texture is painted light and tinted here
  });
  const boards = [
    [-width / 2, 0, 0.16, height],
    [width / 2, 0, 0.16, height],
    [0, -height / 2, width, 0.16],
    [0, height / 2, width, 0.16],
  ];
  for (let r = 1; r < rows; r++) boards.push([0, -height / 2 + (r * height) / rows, width, 0.13]);
  const frameGeo = mergeGeometries(
    boards.map(([x, y, w, h]) => new RoundedBoxGeometry(w, h, depth, 2, 0.015).translate(x, y, 0)),
  );
  const frame = new THREE.Mesh(frameGeo, wood);
  frame.castShadow = true;
  frame.receiveShadow = true;
  g.add(frame);

  const rowHeight = height / rows - 0.16;
  const placements = [];
  const pick = (list) => list[Math.floor(rand() * list.length)];
  for (let r = 0; r < rows; r++) {
    const shelfY = -height / 2 + (r * height) / rows + (r ? 0.065 : 0.08);
    const right = width / 2 - 0.13;
    let x = -width / 2 + 0.13;
    while (x < right - 0.05) {
      const roll = rand();
      if (roll < 0.07) {
        x += 0.12 + rand() * 0.16;
        continue;
      }
      if (roll < 0.15 && right - x > 0.5) {
        const count = 2 + Math.floor(rand() * 3);
        const bw = 0.32 + rand() * 0.1;
        let y = shelfY;
        for (let i = 0; i < count; i++) {
          const bh = 0.045 + rand() * 0.035;
          const len = bw - rand() * 0.07;
          placements.push({
            x: x + bw / 2 + (rand() - 0.5) * 0.03,
            y: y + bh / 2,
            sx: len,
            sy: bh,
            sz: depth * (0.6 + rand() * 0.12),
            tilt: 0,
            colour: rand() < 0.3 ? pick(PAPERBACKS) : pick(JACKETS),
          });
          y += bh;
        }
        x += bw + 0.03;
        continue;
      }
      const paperback = rand() < 0.28;
      const bw = paperback ? 0.035 + rand() * 0.03 : 0.05 + rand() * 0.07;
      const bh = Math.min(paperback ? 0.32 + rand() * 0.1 : 0.4 + rand() * 0.28, rowHeight * 0.9);
      const lean = roll > 0.95 ? -(0.18 + rand() * 0.1) : (rand() - 0.5) * 0.04;
      const footprint = bw * Math.cos(lean) + bh * Math.abs(Math.sin(lean));
      placements.push({
        x: x + footprint / 2,
        y: shelfY + (bh * Math.cos(lean) + bw * Math.abs(Math.sin(lean))) / 2,
        sx: bw,
        sy: bh,
        sz: paperback ? depth * 0.55 : depth * (0.68 + rand() * 0.1),
        tilt: lean,
        colour: paperback ? pick(PAPERBACKS) : pick(JACKETS),
      });
      x += footprint + 0.004 + rand() * 0.01;
    }
  }
  const books = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1), // distant: bevels would cost ~50x the triangles unseen
    new THREE.MeshStandardMaterial({ roughness: 0.8 }),
    placements.length,
  );
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const colour = new THREE.Color();
  placements.forEach((p, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), p.tilt);
    m.compose(new THREE.Vector3(p.x, p.y, -0.02), q, new THREE.Vector3(p.sx, p.sy, p.sz));
    books.setMatrixAt(i, m);
    books.setColorAt(i, colour.set(p.colour).multiplyScalar(SHELF_VALUE));
  });
  books.castShadow = true;
  g.add(books);
  return g;
}

// Real proportions: the table top (y = 1) stands 75 cm, so one unit is 0.75 m.
const LAMP = { poleTop: 1.92, shadeBottom: 1.9, shadeHeight: 0.34 };
function floorLamp() {
  const g = new THREE.Group();
  const brass = new THREE.MeshStandardMaterial({
    color: '#8a6430',
    metalness: 0.72,
    roughness: 0.3,
  });
  const shade = new THREE.MeshStandardMaterial({
    color: '#e3c99a',
    roughness: 0.7,
    side: THREE.DoubleSide,
  });
  const base = new THREE.LatheGeometry(
    [
      [0, 0],
      [0.25, 0],
      [0.255, 0.025],
      [0.23, 0.055],
      [0.08, 0.085],
      [0.022, 0.095],
      [0, 0.095],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    40,
  );
  const pole = new THREE.CylinderGeometry(0.014, 0.017, LAMP.poleTop - 0.09, 12).translate(
    0,
    0.09 + (LAMP.poleTop - 0.09) / 2,
    0,
  );
  const stand = new THREE.Mesh(
    mergeGeometries([base.toNonIndexed(), pole.toNonIndexed()].map(plainGeometry)),
    brass,
  );
  stand.castShadow = true;
  g.add(stand);
  const cone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.42, LAMP.shadeHeight, 40, 1, true),
    shade,
  );
  cone.position.y = LAMP.shadeBottom + LAMP.shadeHeight / 2;
  g.add(cone);
  const bulb = new THREE.PointLight('#ffb862', 2.2, 4.4, 2);
  bulb.position.y = LAMP.shadeBottom + 0.1;
  g.add(bulb);
  g.userData.bulb = bulb;
  return g;
}

const plainGeometry = (geo) => {
  for (const name of Object.keys(geo.attributes)) {
    if (name !== 'position' && name !== 'normal') geo.deleteAttribute(name);
  }
  return geo;
};

function armchair(color = '#482a1d') {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.82 });
  const part = (geo, x, y, z, tilt = 0) => {
    geo.rotateX(tilt).translate(x, y, z);
    return plainGeometry(geo.index ? geo.toNonIndexed() : geo);
  };
  const geo = mergeGeometries([
    part(new RoundedBoxGeometry(1.05, 0.32, 0.85, 5, 0.1), 0, 0.52, 0),
    part(new RoundedBoxGeometry(1.08, 1.25, 0.27, 5, 0.11), 0, 1.05, -0.35, -0.1),
    ...[-0.55, 0.55].map((x) => part(new RoundedBoxGeometry(0.2, 0.48, 0.9, 4, 0.07), x, 0.72, 0)),
  ]);
  const chair = new THREE.Mesh(geo, mat);
  chair.castShadow = true;
  const g = new THREE.Group();
  g.add(chair);
  return g;
}

function plant(seed = 1) {
  const rand = seeded(seed),
    g = new THREE.Group();
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.25, 0.36, 18),
    new THREE.MeshStandardMaterial({ color: '#5b3826', roughness: 0.85 }),
  );
  pot.position.y = 0.18;
  pot.castShadow = true;
  g.add(pot);
  const leafMat = new THREE.MeshStandardMaterial({
    color: '#244b30',
    roughness: 0.82,
    side: THREE.DoubleSide,
  });
  // Leaves merged into one mesh (one draw call per plant).
  const leaves = [];
  const m = new THREE.Matrix4();
  for (let i = 0; i < 13; i++) {
    const a = rand() * Math.PI * 2;
    const r = 0.12 + rand() * 0.22;
    const size = 0.11 + rand() * 0.06;
    const y = 0.42 + rand() * 0.65;
    const tilt = (rand() - 0.5) * 1.4;
    m.compose(
      new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt),
      new THREE.Vector3(0.55, 1.5, 0.28),
    );
    leaves.push(new THREE.SphereGeometry(size, 12, 8).applyMatrix4(m));
  }
  const foliage = new THREE.Mesh(mergeGeometries(leaves), leafMat);
  foliage.castShadow = true;
  g.add(foliage);
  return g;
}

// The light the sconces throw is painted onto the wall: no extra light sources.
function wallSconces() {
  const g = new THREE.Group();
  const brass = new THREE.MeshStandardMaterial({
    color: '#8a6430',
    metalness: 0.75,
    roughness: 0.3,
  });
  const glow = new THREE.MeshStandardMaterial({
    color: '#f3dfbf',
    emissive: '#ffcf8a',
    emissiveIntensity: 1,
    roughness: 0.8,
    side: THREE.DoubleSide,
  });
  const z = -6.5;
  const parts = [];
  const shades = [];
  for (const side of [-1, 1]) {
    const x = side * WASH.sconceX;
    parts.push(
      plainGeometry(
        new THREE.CylinderGeometry(0.07, 0.07, 0.02, 24).rotateX(Math.PI / 2).toNonIndexed(),
      ).translate(x, WASH.sconceY, z + 0.01),
      plainGeometry(
        new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8).rotateX(Math.PI / 2).toNonIndexed(),
      ).translate(x, WASH.sconceY, z + 0.09),
    );
    shades.push(
      new THREE.CylinderGeometry(0.075, 0.1, 0.16, 28, 1, true).translate(
        x,
        WASH.sconceY,
        z + 0.17,
      ),
    );
  }
  g.add(new THREE.Mesh(mergeGeometries(parts), brass));
  g.add(new THREE.Mesh(mergeGeometries(shades), glow));
  const washMap = imageTexture(painted('sconce-wash', 'sconceWash'));
  washMap.colorSpace = THREE.SRGBColorSpace;
  const washMaterial = new THREE.MeshBasicMaterial({
    map: washMap,
    color: '#ffb067',
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const wash = new THREE.Mesh(new THREE.PlaneGeometry(WASH.width, WASH.height), washMaterial);
  wash.position.set(0, WASH.centreY, z + 0.005);
  g.add(wash);
  g.userData = { glow, wash: washMaterial };
  return g;
}

export function createRoom() {
  const room = new THREE.Group();
  const floorTex = createWoodTexture(1024, true);
  floorTex.map.repeat.set(2.2, 2.2);
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex.map,
    roughness: 0.72,
    bumpMap: floorTex.map,
    bumpScale: 0.012,
    color: '#24150d', // set per theme; the texture is painted light
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 15), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -1.3;
  floor.receiveShadow = true;
  room.add(floor);
  const wallMat = new THREE.MeshStandardMaterial({ color: '#191713', roughness: 0.96 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(16, 7), wallMat);
  back.position.set(0, 3.5, -6.5);
  back.receiveShadow = true;
  room.add(back);
  const ceilingMat = new THREE.MeshStandardMaterial({ color: '#0b0a08', roughness: 1 });
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(16, 15), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 7, -1.3);
  room.add(ceiling);

  const leftShelf = shelfUnit(3.1, 5.6, 0.56, 12);
  leftShelf.position.set(-5.45, 2.9, -5.95);
  room.add(leftShelf);
  const rightShelf = shelfUnit(3.1, 5.6, 0.56, 31);
  rightShelf.position.set(5.45, 2.9, -5.95);
  room.add(rightShelf);
  const centerShelf = shelfUnit(4.6, 1.5, 0.48, 77, 2); // low: leaves plain wall for the hero
  centerShelf.position.set(0, 0.83, -6.05);
  room.add(centerShelf);

  const view = createWindowView({ width: 2.35, height: 3.55 });
  view.mesh.position.set(-3.35, 3.4, -6.34);
  room.add(view.mesh);
  const trimMat = new THREE.MeshStandardMaterial({ color: '#1e120c', roughness: 0.72 });
  const trim = new THREE.Mesh(
    mergeGeometries(
      [
        [-3.35, 3.4, 0.1, 3.8],
        [-4.55, 3.4, 0.12, 3.8],
        [-2.15, 3.4, 0.12, 3.8],
        [-3.35, 1.59, 2.5, 0.12],
        [-3.35, 5.21, 2.5, 0.12],
      ].map(([x, y, w, h]) => new THREE.BoxGeometry(w, h, 0.12).translate(x, y, -6.2)),
    ),
    trimMat,
  );
  trim.castShadow = true;
  room.add(trim);

  const chairL = armchair();
  chairL.position.set(-3.5, 0.02, -2.65);
  chairL.rotation.y = 0.35;
  room.add(chairL);
  const chairR = armchair('#27342c');
  chairR.position.set(3.75, 0.02, -2.85);
  chairR.rotation.y = -0.42;
  room.add(chairR);
  const lamp = floorLamp();
  lamp.position.set(-2.2, 0, -3.9);
  room.add(lamp);
  const lamp2 = floorLamp();
  lamp2.scale.setScalar(0.96);
  lamp2.position.set(3.1, 0, -4.2);
  room.add(lamp2);
  const p1 = plant(5);
  p1.position.set(-1.55, 0, -5.1);
  room.add(p1);
  const p2 = plant(9);
  p2.position.set(2.15, 0, -5.25);
  p2.scale.set(1.15, 1.15, 1.15);
  room.add(p2);

  const sconces = wallSconces();
  room.add(sconces);

  room.userData.themeTargets = {
    lamps: [lamp.userData.bulb, lamp2.userData.bulb],
    window: view,
    sconces: sconces.userData,
    floor: floorMat,
    wall: wallMat,
    ceiling: ceilingMat,
  };
  return room;
}
