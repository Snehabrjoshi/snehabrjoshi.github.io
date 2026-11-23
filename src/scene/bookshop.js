import * as THREE from 'three';
import { createRenderer, resizeRenderer } from './renderer.js';
import { createCamera } from './camera.js';
import { createLights } from './lights.js';
import { createEnvironment } from './environment.js';
import { computeLayout, faceToward, TABLE_TOP } from './layout.js';
import { createRoom } from '../world/room.js';
import { createTable } from '../world/table.js';
import {
  createBook,
  createBookRow,
  spineArcFor,
  readingPageKey,
  readingPageParams,
} from '../objects/books.js';
import { thicknessesFor } from '../objects/series.js';
import { loadCoverFonts, coverFontUrls, COVER_FONT_FAMILIES } from '../objects/fonts.js';
import { prepaint } from '../paint/painter.js';
import { createBookOpener } from '../objects/bookOpening.js';
import { createObjectReveal } from '../objects/objectReveal.js';
import { createIcedCoffee } from '../objects/icedCoffee.js';
import { createSpeaker } from '../objects/speaker.js';
import { createPointer } from '../interaction/pointer.js';
import { createPicker } from '../interaction/picker.js';
import { createCursor } from '../interaction/cursor.js';
import { createObjectButtons } from '../ui/objectButtons.js';
import { createObjectTag } from '../ui/objectTag.js';
import { createAtmosphere } from '../theme/atmosphere.js';
import { reducedMotion } from '../config/motion.js';
import { bookName } from '../data/names.js';

// Yielding between build stages keeps each main-thread task short.
const SPEAKER_SCALE = 0.75;
const yieldToMain = () => new Promise((resolve) => setTimeout(resolve, 0));

export async function createBookshop({ books: bookData, mode, onActivate, isOpen }) {
  const canvas = document.querySelector('#webgl-canvas');
  const renderer = createRenderer(canvas);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#090705');
  scene.fog = new THREE.FogExp2('#090705', 0.028);
  createEnvironment(renderer);

  // Textures are painted in a worker; any job that fails there is painted here.
  const thicknesses = thicknessesFor(bookData);
  const painting = await prepaint(
    [
      ...bookData.flatMap((book, i) => [
        { key: `cover:${book.id}`, job: 'cover', params: book },
        ...['left', 'right'].map((side) => ({
          key: readingPageKey(book.id, side),
          job: 'readingPage',
          params: readingPageParams(book, side),
        })),
        {
          key: `spine:${book.id}`,
          job: 'spine',
          params: { book, arc: spineArcFor(thicknesses[i]) },
        },
      ]),
      { key: 'page-block', job: 'pageBlock' },
      { key: 'printed-page', job: 'printedPage' },
      { key: 'wood:512:false', job: 'wood', params: { size: 512, floor: false } },
      { key: 'wood:1024:false', job: 'wood', params: { size: 1024, floor: false } },
      { key: 'wood:1024:true', job: 'wood', params: { size: 1024, floor: true } },
      { key: 'leatherette', job: 'leatherette' },
      { key: 'grille', job: 'grille' },
      { key: 'condensation', job: 'condensation' },
      { key: 'coffee', job: 'coffee' },
      { key: 'coaster', job: 'coaster' },
      { key: 'gardenFar', job: 'gardenFar' },
      { key: 'gardenMid', job: 'gardenMid' },
      { key: 'gardenNear', job: 'gardenNear' },
      { key: 'sconce-wash', job: 'sconceWash' },
    ],
    { fontUrls: coverFontUrls(), fontFamilies: COVER_FONT_FAMILIES },
  );
  document.documentElement.dataset.painter = painting;

  await yieldToMain();
  const room = createRoom();
  await yieldToMain();
  const table = createTable();
  scene.add(room, table);
  const outside = room.userData.themeTargets.window;
  const view = createCamera();
  const { camera } = view;
  const lights = createLights(scene);
  const atmosphere = createAtmosphere({ renderer, scene, room, table, lights });
  atmosphere.setMode(mode);

  const pointer = createPointer();
  const picker = createPicker(camera);
  const cursor = createCursor({
    orb: document.querySelector('#cursor-orb'),
    light: lights.cursor,
    raycaster: picker.raycaster,
    canvas,
  });
  const tag = createObjectTag(document.querySelector('#object-tag'));
  const opener = createBookOpener({ scene, view, atmosphere });
  const reveal = createObjectReveal({ view, atmosphere });
  const motionFor = (item) => (item.kind === 'book' ? opener : reveal);

  const items = new Map();
  let hovered = null;
  let focused = null;
  const buttons = createObjectButtons({
    container: document.querySelector('#scene-targets'),
    onActivate: (item) => onActivate(item.id, buttonFor(item)),
    onFocus: (item) => (focused = item),
  });
  const buttonFor = (item) => ({ focus: (options) => buttons.focus(item, options) });

  // Covers painted here (the fallback) need the fonts on this thread too.
  if (painting !== 'worker') await loadCoverFonts();
  const books = [];
  for (const [i, data] of bookData.entries()) {
    await yieldToMain();
    const item = createBook(data, thicknesses[i]);
    item.name = bookName(data);
    item.blurb = data.blurb;
    books.push(item);
  }
  await yieldToMain();
  const row = createBookRow(books);
  scene.add(row.group);
  const drink = createIcedCoffee();
  await yieldToMain();
  const speaker = createSpeaker();
  scene.add(drink.slot, speaker.slot);
  for (const item of [...books, drink, speaker]) {
    items.set(item.id, item);
    picker.add(item.hit);
    buttons.add(item);
  }

  function applyLayout() {
    const layout = computeLayout(innerWidth / innerHeight);
    view.frame(layout.camera);
    const cam = view.basePosition;
    const face = (x, z) => faceToward(x, z, cam.x, cam.z);
    room.updateMatrixWorld(true);
    outside.setViewOrigin(cam);
    row.group.position.set(layout.row.x, TABLE_TOP, layout.row.z);
    row.group.rotation.y = face(layout.row.x, layout.row.z);
    row.group.scale.setScalar(layout.row.scale);
    drink.slot.position.set(layout.glass.x, TABLE_TOP + 0.01, layout.glass.z);
    drink.slot.rotation.y = face(layout.glass.x, layout.glass.z) - THREE.MathUtils.degToRad(40);
    drink.slot.scale.setScalar(layout.objectScale);
    speaker.slot.position.set(layout.speaker.x, TABLE_TOP, layout.speaker.z);
    // Square to the camera: a yaw at the frame's edge made the box look tilted.
    speaker.slot.rotation.set(0, face(layout.speaker.x, layout.speaker.z), 0);
    speaker.slot.scale.setScalar(layout.objectScale * SPEAKER_SCALE);
  }
  applyLayout();

  // Compiled up front so the first opening doesn't stall on shader compilation.
  books.forEach((b) => b.openParts.forEach((part) => (part.visible = true)));
  await yieldToMain();
  renderer.compile(scene, camera);
  books.forEach((b) => b.openParts.forEach((part) => (part.visible = false)));

  addEventListener(
    'pointermove',
    () => {
      if (!isOpen()) view.setParallax(pointer.ndc.x, pointer.ndc.y);
    },
    { passive: true },
  );
  canvas.addEventListener('pointerup', (event) => {
    if (isOpen()) return;
    pointer.set(event);
    const item = picker.pick(pointer.ndc);
    if (item) onActivate(item.id, buttonFor(item), event);
  });
  addEventListener('resize', () => {
    applyLayout();
    resizeRenderer(renderer);
  });

  function updateItems() {
    const open = isOpen();
    const next = open ? null : picker.pick(pointer.ndc);
    if (next !== hovered) {
      hovered = next;
      cursor.setHovering(Boolean(hovered));
    }
    for (const item of items.values()) {
      if (item === current) continue;
      const target = !open && (item === hovered || item === focused) ? 1 : 0;
      item.hover = THREE.MathUtils.lerp(item.hover, target, 0.12);
      item.setLift(item.hover);
    }
    tag.show(open ? null : (focused ?? hovered));
  }

  let current = null;
  const clock = new THREE.Clock();
  let last = 0;
  renderer.setAnimationLoop(() => {
    const elapsed = clock.getElapsedTime();
    const dt = Math.min(elapsed - last, 0.1);
    last = elapsed;
    atmosphere.update(dt);
    view.update();
    picker.raycaster.setFromCamera(pointer.ndc, camera);
    cursor.update(pointer.client);
    updateItems();
    outside.uniforms.uTime.value = elapsed;
    outside.uniforms.uMotion.value = reducedMotion() ? 0 : 1;
    speaker.update(elapsed);
    renderer.render(scene, camera);
    buttons.update(camera);
    tag.update();
  });

  return {
    items,
    get narrow() {
      return opener.narrow;
    },
    setMode(value, seconds) {
      atmosphere.setMode(value, seconds);
    },
    beginOpen() {
      hovered = null;
      view.resetParallax();
      cursor.setVisible(false);
    },
    endOpen() {
      cursor.setVisible(true);
    },
    openMotion(item) {
      current = item;
      return motionFor(item).open(item);
    },
    async closeMotion(item) {
      await motionFor(item).close();
      current = null;
    },
    finishMotion(item) {
      motionFor(item).finish();
    },
    readingRects: () => opener.pageRects(),
    relayoutOpen: () => opener.relayout(),
  };
}
