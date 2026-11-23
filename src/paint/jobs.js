// The same jobs run in the texture worker and on the main thread (fallback),
// so the art is identical either way.
import { paintCoverImages, paintSpineImages } from './cover.js';
import { paintPageBlock, paintPrintedPage, paintReadingPage, paintWood } from './surfaces.js';
import { paintLeatherette, paintGrille } from './speaker.js';
import { paintCondensation, paintCoffee, paintCoaster } from './drink.js';
import { paintFar, paintMid, paintNear } from './garden.js';
import { paintSconceWash } from './sconceWash.js';

export const JOBS = {
  cover: paintCoverImages,
  spine: paintSpineImages,
  pageBlock: paintPageBlock,
  printedPage: paintPrintedPage,
  readingPage: paintReadingPage,
  wood: paintWood,
  leatherette: paintLeatherette,
  grille: paintGrille,
  condensation: paintCondensation,
  coffee: paintCoffee,
  coaster: paintCoaster,
  gardenFar: paintFar,
  gardenMid: paintMid,
  gardenNear: paintNear,
  sconceWash: paintSconceWash,
};

// These set type with the series fonts, which must be loaded first.
export const NEEDS_FONTS = new Set(['cover', 'spine']);
