// Every value here is blended numerically by atmosphere.js: nothing that would
// force a shader recompile (shadows, light count, texture swaps) belongs here.

import { WALLS, wallChoice } from '../config/palette.js';

const wall = WALLS[wallChoice()];

export const THEMES = {
  night: {
    background: '#090705',
    fogDensity: 0.028,
    exposure: 1.03,
    hemiSky: '#f4d4a1',
    hemiGround: '#17100b',
    hemiIntensity: 0.72,
    keyColor: '#ffb55e',
    keyIntensity: 22,
    fillColor: '#8ba3bb',
    fillIntensity: 0.48,
    rimColor: '#c98845',
    rimIntensity: 0.34,
    cursorIntensity: 0.35,
    lampIntensity: 1.5,
    windowNight: 1,
    pageNight: 1, // reading pages: warmer and dimmer at night
    sconce: 0.55, // wall sconces: wash strength (the shades glow with it)
    ...wall.night,
    envIntensity: 0.25,
    tableTop: '#2b190e',
    tableDark: '#110905',
    floor: '#24150d',
  },
  day: {
    background: '#a49b8b',
    fogDensity: 0.018,
    exposure: 1.1,
    hemiSky: '#e6e1d7',
    hemiGround: '#3a2c20',
    hemiIntensity: 1.15,
    keyColor: '#fff0dc',
    keyIntensity: 20,
    fillColor: '#dfe6ea',
    fillIntensity: 1.8,
    rimColor: '#d8c3a2',
    rimIntensity: 0.55,
    cursorIntensity: 0.2,
    lampIntensity: 0.35,
    windowNight: 0,
    pageNight: 0,
    sconce: 0,
    // wall, wallGlow (daylight on the plaster behind the hero, which keeps
    // its text at WCAG AA) and ceiling come from the palette's wall choice
    ...wall.day,
    envIntensity: 0.5,
    tableTop: '#8c99a6',
    tableDark: '#5a5e66',
    floor: '#9aa6b0',
  },
};

export const COLOR_KEYS = [
  'background',
  'hemiSky',
  'hemiGround',
  'keyColor',
  'fillColor',
  'rimColor',
  'wall',
  'wallGlow',
  'ceiling',
  'tableTop',
  'tableDark',
  'floor',
];
export const NUMBER_KEYS = [
  'fogDensity',
  'exposure',
  'hemiIntensity',
  'keyIntensity',
  'fillIntensity',
  'rimIntensity',
  'cursorIntensity',
  'lampIntensity',
  'windowNight',
  'pageNight',
  'sconce',
  'envIntensity',
];
