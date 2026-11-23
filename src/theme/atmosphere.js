import * as THREE from 'three';
import { THEMES, COLOR_KEYS, NUMBER_KEYS } from './themes.js';
import { setEnvironmentIntensity } from '../scene/environment.js';
import { setPageNight } from '../objects/books.js';

// Same curve as the CSS transition: cubic-bezier(.65,0,.35,1) ≈ easeInOutCubic.
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function toState(preset) {
  const state = {};
  COLOR_KEYS.forEach((k) => {
    state[k] = new THREE.Color(preset[k]);
  });
  NUMBER_KEYS.forEach((k) => {
    state[k] = preset[k];
  });
  return state;
}

function copyState(target, source) {
  COLOR_KEYS.forEach((k) => target[k].copy(source[k]));
  NUMBER_KEYS.forEach((k) => {
    target[k] = source[k];
  });
}

export function createAtmosphere({ renderer, scene, lights, room, table }) {
  const { lamps, window: view, sconces, wall, ceiling, floor } = room.userData.themeTargets;
  const { tableTop, tableDark } = table.userData.themeTargets;
  const current = toState(THEMES.night);
  const from = toState(THEMES.night);
  const to = toState(THEMES.night);
  let progress = 1,
    duration = 1;
  let dim = 1; // exposure scale while reading

  function apply() {
    const c = current;
    scene.background.copy(c.background);
    scene.fog.color.copy(c.background);
    scene.fog.density = c.fogDensity;
    renderer.toneMappingExposure = c.exposure * dim;
    setEnvironmentIntensity(c.envIntensity);
    lights.hemi.color.copy(c.hemiSky);
    lights.hemi.groundColor.copy(c.hemiGround);
    lights.hemi.intensity = c.hemiIntensity;
    lights.key.color.copy(c.keyColor);
    lights.key.intensity = c.keyIntensity;
    lights.fill.color.copy(c.fillColor);
    lights.fill.intensity = c.fillIntensity;
    lights.rim.color.copy(c.rimColor);
    lights.rim.intensity = c.rimIntensity;
    lights.cursor.userData.base = c.cursorIntensity; // scaled by pointer presence
    lamps.forEach((lamp) => {
      lamp.intensity = c.lampIntensity;
    });
    view.uniforms.uNight.value = c.windowNight;
    setPageNight(c.pageNight);
    sconces.wash.opacity = c.sconce;
    sconces.glow.emissiveIntensity = c.sconce * 1.1;
    wall.color.copy(c.wall);
    wall.emissive.copy(c.wallGlow);
    ceiling.color.copy(c.ceiling);
    floor.color.copy(c.floor);
    tableTop.color.copy(c.tableTop);
    tableDark.color.copy(c.tableDark);
  }

  // Starts from what is on screen, so reversing mid-transition eases back smoothly.
  function setMode(name, seconds = 0) {
    const preset = THEMES[name];
    if (!preset) return;
    copyState(from, current);
    copyState(to, toState(preset));
    if (seconds <= 0) {
      copyState(current, to);
      progress = 1;
      apply();
      return;
    }
    duration = seconds;
    progress = 0;
  }

  function update(dt) {
    if (progress >= 1) return;
    progress = Math.min(1, progress + dt / duration);
    const e = ease(progress);
    COLOR_KEYS.forEach((k) => current[k].lerpColors(from[k], to[k], e));
    NUMBER_KEYS.forEach((k) => {
      current[k] = from[k] + (to[k] - from[k]) * e;
    });
    apply();
  }

  // Only lit, tone-mapped materials respond; the reading pages are unlit.
  function setDim(value) {
    dim = value;
    renderer.toneMappingExposure = current.exposure * dim;
  }

  return { setMode, update, setDim };
}
