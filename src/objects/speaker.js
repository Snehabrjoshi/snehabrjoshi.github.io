import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { useEnvironment } from '../scene/environment.js';
import { painted } from '../paint/painter.js';
import { imageTexture } from './coverArt.js';

const W = 0.92;
const H = 0.66;
const D = 0.34;
const R = 0.05;

function leatherette() {
  const map = imageTexture(painted('leatherette', 'leatherette'));
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 2);
  return map;
}

function perforated() {
  const map = imageTexture(painted('grille', 'grille'));
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(7, 4.4);
  map.anisotropy = 8;
  return map;
}

function roundedRectPath(w, h, r) {
  const path = new THREE.CurvePath();
  const p = (x, y) => new THREE.Vector3(x, y, 0);
  const x0 = -w / 2;
  const x1 = w / 2;
  const y0 = -h / 2;
  const y1 = h / 2;
  const line = (a, b) => path.add(new THREE.LineCurve3(a, b));
  const arc = (a, c, b) => path.add(new THREE.QuadraticBezierCurve3(a, c, b));
  line(p(x0 + r, y0), p(x1 - r, y0));
  arc(p(x1 - r, y0), p(x1, y0), p(x1, y0 + r));
  line(p(x1, y0 + r), p(x1, y1 - r));
  arc(p(x1, y1 - r), p(x1, y1), p(x1 - r, y1));
  line(p(x1 - r, y1), p(x0 + r, y1));
  arc(p(x0 + r, y1), p(x0, y1), p(x0, y1 - r));
  line(p(x0, y1 - r), p(x0, y0 + r));
  arc(p(x0, y0 + r), p(x0, y0), p(x0 + r, y0));
  return path;
}

function knurledKnob(radius, height) {
  const g = new THREE.CylinderGeometry(radius * 0.9, radius, height, 36, 1);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const len = Math.hypot(x, z);
    if (len < radius * 0.5) continue;
    const k = Math.round((Math.atan2(z, x) / (Math.PI * 2)) * 36) % 2 ? 1.07 : 1;
    pos.setX(i, x * k);
    pos.setZ(i, z * k);
  }
  g.computeVertexNormals();
  return g.translate(0, height / 2, 0);
}

const plain = (g) => {
  const flat = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(flat.attributes)) {
    if (name !== 'position' && name !== 'normal') flat.deleteAttribute(name);
  }
  return flat;
};

export function createSpeaker() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const grain = leatherette();
  // Sheen keeps the black box's silhouette against the dark table at night.
  const leather = useEnvironment(
    new THREE.MeshPhysicalMaterial({
      color: '#121110',
      roughness: 0.62,
      bumpMap: grain,
      bumpScale: 0.6,
      sheen: 0.6,
      sheenRoughness: 0.45,
      sheenColor: '#8c8278',
    }),
  );
  const brass = useEnvironment(
    new THREE.MeshStandardMaterial({ color: '#b8904f', metalness: 0.9, roughness: 0.3 }),
  );
  const grilleMap = perforated();
  const cloth = useEnvironment(
    new THREE.MeshStandardMaterial({
      map: grilleMap,
      bumpMap: grilleMap,
      bumpScale: 0.8,
      metalness: 0.55,
      roughness: 0.48,
    }),
  );
  const strapLeather = useEnvironment(
    new THREE.MeshStandardMaterial({ color: '#4a2c1a', roughness: 0.55 }),
  );
  const ledMaterial = new THREE.MeshBasicMaterial({ color: '#ffb35c', toneMapped: false });

  const y = H / 2 + 0.012;
  const box = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 5, R), leather);
  box.position.y = y;

  const grilleW = W - 0.12;
  const grilleH = H - 0.17;
  const grilleY = y - 0.03;
  const grille = new THREE.Mesh(new THREE.PlaneGeometry(grilleW, grilleH), cloth);
  grille.position.set(0, grilleY, D / 2 + 0.001);

  // One mesh for all the brass parts (one draw call).
  const front = D / 2 - 0.004;
  const brassParts = [
    new THREE.TubeGeometry(
      roundedRectPath(W - 0.012, H - 0.012, R * 0.9),
      160,
      0.0045,
      6,
      true,
    ).translate(0, y, front),
    new THREE.TubeGeometry(
      roundedRectPath(grilleW + 0.006, grilleH + 0.006, 0.012),
      120,
      0.003,
      6,
      true,
    ).translate(0, grilleY, D / 2 + 0.001),
    new RoundedBoxGeometry(W * 0.62, 0.008, 0.075, 2, 0.003).translate(0, H + 0.012, D / 2 - 0.06),
    ...[-0.16, 0, 0.16].map((x, i) =>
      knurledKnob(i === 0 ? 0.04 : 0.034, 0.046).translate(x + 0.08, H + 0.016, D / 2 - 0.06),
    ),
    new THREE.TorusGeometry(0.016, 0.0045, 8, 20)
      .rotateY(Math.PI / 2)
      .translate(-(W / 2 + 0.006), H - 0.045, 0),
  ];
  const trim = new THREE.Mesh(mergeGeometries(brassParts.map(plain)), brass);

  const led = new THREE.Mesh(new THREE.CircleGeometry(0.007, 16), ledMaterial);
  led.rotation.x = -Math.PI / 2;
  led.position.set(-0.24 + 0.0, H + 0.0175, D / 2 - 0.06);

  const side = -(W / 2 + 0.012);
  const strapCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(side, H - 0.045, -0.01),
      new THREE.Vector3(side - 0.05, H - 0.1, 0.0),
      new THREE.Vector3(side - 0.075, H - 0.22, 0.05),
      new THREE.Vector3(side - 0.03, H - 0.13, 0.07),
      new THREE.Vector3(side, H - 0.045, 0.02),
    ],
    true,
  );
  const strap = new THREE.Mesh(
    new THREE.TubeGeometry(strapCurve, 48, 0.011, 8, true),
    strapLeather,
  );

  [box, trim, strap].forEach((m) => {
    m.castShadow = true;
    m.receiveShadow = true;
  });
  grille.receiveShadow = true;
  body.add(box, grille, trim, led, strap);

  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(W + 0.1, H + 0.06, D + 0.04).translate(0, H / 2 + 0.03, 0),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  body.add(hit);

  const ledColour = new THREE.Color('#ffb35c');
  const item = {
    kind: 'speaker',
    id: 'playlist',
    name: 'Playlist',
    blurb: 'What’s playing while I work',
    slot: group,
    body,
    hit,
    hover: 0,
    lift: { y: 0.1, tilt: -0.07 },
    screenSide: -1,
    setLift(p) {
      body.position.y = p * 0.015;
    },
    update(time) {
      const breath = 0.55 + 0.25 * (0.5 + 0.5 * Math.sin(time * 1.4));
      ledMaterial.color.copy(ledColour).multiplyScalar(breath + item.hover * 0.4);
      const beat = Math.max(0, Math.sin(time * 9.5)) ** 3;
      grille.position.z = D / 2 + 0.001 + item.hover * beat * 0.0025;
      grille.scale.setScalar(1 + item.hover * beat * 0.003);
    },
  };
  hit.userData.target = item;
  return item;
}
