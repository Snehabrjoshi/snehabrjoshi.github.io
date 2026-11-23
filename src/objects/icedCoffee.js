import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { useEnvironment } from '../scene/environment.js';
import { painted } from '../paint/painter.js';
import { imageTexture } from './coverArt.js';
import { createFaceDownBook } from './faceDownBook.js';
import { READING } from '../data/portfolioData.js';
import { coverSlug } from '../data/names.js';

// The glass is the only transmissive material (three.js renders the opaque
// scene once more for it). Five draw calls.

const GLASS = [
  [0, 0],
  [0.158, 0],
  [0.168, 0.008],
  [0.172, 0.05],
  [0.19, 0.5],
  [0.191, 0.51],
  [0.186, 0.513],
  [0.181, 0.51],
  [0.164, 0.06],
  [0, 0.052],
];
const OUTER = new Set([2, 3, 4]);
const FLUTES = 22;
const FILL = 0.36;

function seeded(seed) {
  let v = seed >>> 0;
  return () => (v = (Math.imul(1664525, v) + 1013904223) >>> 0) / 4294967296;
}

function flutedGlass() {
  const segments = 132;
  const geo = new THREE.LatheGeometry(
    GLASS.map(([x, y]) => new THREE.Vector2(x, y)),
    segments,
  );
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    if (!OUTER.has(i % GLASS.length)) continue;
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const angle = Math.atan2(z, x);
    const rib = Math.sqrt(Math.abs(Math.cos((angle * FLUTES) / 2)));
    const k = 1 + 0.03 * (rib - 0.7);
    pos.setX(i, x * k);
    pos.setZ(i, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

function coasterMaterial() {
  const map = imageTexture(painted('coaster', 'coaster'));
  map.colorSpace = THREE.SRGBColorSpace;
  return useEnvironment(new THREE.MeshStandardMaterial({ map, color: '#5c4434', roughness: 0.5 }));
}

function iceCubes(rand = seeded(23)) {
  const cubes = [
    [-0.06, FILL - 0.03, 0.03, 0.115],
    [0.055, FILL - 0.015, -0.04, 0.105],
    [0.01, FILL - 0.07, 0.06, 0.1],
  ].map(([x, y, z, s]) => {
    const g = new RoundedBoxGeometry(s, s * 0.9, s, 2, s * 0.18);
    g.rotateX(rand() * 0.8 - 0.4);
    g.rotateY(rand() * Math.PI);
    g.rotateZ(rand() * 0.6 - 0.3);
    return g.translate(x, y, z);
  });
  return mergeGeometries(cubes);
}

// Measured from the "Currently reading" cover at build time (fetch-covers.mjs).
const generated = import.meta.glob('../data/covers.generated.json', { eager: true });
function currentBookColour() {
  const covers = Object.values(generated)[0]?.default?.books ?? {};
  const current = READING.entries.find((b) => b.label === 'Currently reading');
  return (current && covers[coverSlug(current)]?.colour) || '#d9694f';
}

export function createIcedCoffee() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const lift = 0.024;

  const dropletsImage = painted('condensation', 'condensation');
  const droplets = new THREE.DataTexture(
    dropletsImage.data,
    dropletsImage.width,
    dropletsImage.height,
  );
  droplets.wrapS = droplets.wrapT = THREE.RepeatWrapping;
  droplets.repeat.set(3, 1);
  droplets.generateMipmaps = true;
  droplets.minFilter = THREE.LinearMipmapLinearFilter;
  droplets.needsUpdate = true;

  const glassMaterial = useEnvironment(
    new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      transmission: 1,
      roughness: 0.06,
      thickness: 0.05,
      ior: 1.5,
      attenuationColor: '#e6efe9',
      attenuationDistance: 0.6,
      normalMap: droplets,
      normalScale: new THREE.Vector2(0.8, 0.8),
      specularIntensity: 1,
    }),
  );
  const glass = new THREE.Mesh(flutedGlass(), glassMaterial);
  glass.position.y = lift;

  const coffeeShape = [
    [0, 0.054],
    [0.163, 0.062],
    [0.177, FILL - 0.004],
    [0.17, FILL],
    [0, FILL],
  ];
  const coffeeMap = imageTexture(painted('coffee', 'coffee'));
  coffeeMap.colorSpace = THREE.SRGBColorSpace;
  coffeeMap.wrapS = THREE.RepeatWrapping;
  const coffeeMesh = new THREE.Mesh(
    new THREE.LatheGeometry(
      coffeeShape.map(([x, y]) => new THREE.Vector2(x, y)),
      64,
    ),
    useEnvironment(new THREE.MeshStandardMaterial({ map: coffeeMap, roughness: 0.25 })),
  );
  coffeeMesh.position.y = lift;

  const ice = new THREE.Mesh(
    iceCubes(),
    useEnvironment(
      new THREE.MeshStandardMaterial({
        color: '#8fa9b0',
        roughness: 0.03,
        metalness: 0.1,
        emissive: '#4d5f64',
        emissiveIntensity: 0.15,
      }),
    ),
  );
  ice.position.y = lift;

  const straw = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.05, 0.07, 0.02),
        new THREE.Vector3(0.06, 0.45, -0.05),
        new THREE.Vector3(0.1, 0.62, -0.08),
        new THREE.Vector3(0.13, 0.66, -0.06),
      ]),
      40,
      0.011,
      10,
    ),
    useEnvironment(
      new THREE.MeshStandardMaterial({ color: '#c9ccce', metalness: 0.9, roughness: 0.22 }),
    ),
  );
  straw.position.y = lift;

  const coaster = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        [0, 0],
        [0.255, 0],
        [0.262, 0.006],
        [0.262, 0.018],
        [0.255, 0.024],
        [0, 0.024],
      ].map(([x, y]) => new THREE.Vector2(x, y)),
      64,
    ),
    coasterMaterial(),
  );

  coffeeMesh.castShadow = straw.castShadow = coaster.castShadow = true;
  coaster.receiveShadow = coffeeMesh.receiveShadow = true;
  body.add(coaster, coffeeMesh, ice, straw, glass);

  const book = createFaceDownBook(currentBookColour());
  book.position.set(0.62, 0, -0.18);
  book.rotation.y = 0.9;
  group.add(book);

  const hit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.7, 16).translate(0, 0.35, 0),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  body.add(hit);

  const item = {
    kind: 'glass',
    id: 'reading',
    name: 'Currently reading',
    blurb: 'The book next to the coffee, and what’s next',
    slot: group,
    body,
    hit,
    hover: 0,
    lift: { y: 0.1, tilt: 0.08 },
    screenSide: 1,
    setLift(p) {
      body.position.y = p * 0.02;
    },
    update() {},
  };
  hit.userData.target = item;
  return item;
}
