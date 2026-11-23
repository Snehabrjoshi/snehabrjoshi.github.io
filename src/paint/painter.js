// prepaint() sends every job to the texture worker at once; painted() returns
// the worker's result, or paints on this thread when the worker couldn't.
import { JOBS } from './jobs.js';

const cache = new Map();

const make = (width, height, readback = false) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext('2d', { willReadFrequently: readback }) };
};

function supported() {
  try {
    return (
      typeof Worker !== 'undefined' &&
      typeof OffscreenCanvas !== 'undefined' &&
      Boolean(new OffscreenCanvas(1, 1).getContext('2d'))
    );
  } catch {
    return false;
  }
}

export async function prepaint(requests, { fontUrls = [], fontFamilies = [] } = {}) {
  if (!supported() || new URLSearchParams(location.search).has('no-worker')) return 'main';
  let worker;
  try {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  } catch {
    return 'main';
  }
  worker.postMessage({ type: 'fonts', urls: fontUrls, families: fontFamilies });
  const pending = new Map();
  worker.onmessage = ({ data }) => {
    const done = pending.get(data.id);
    pending.delete(data.id);
    if (data.result) cache.set(done.key, data.result);
    done.resolve();
  };
  worker.onerror = () => pending.forEach((p) => p.resolve()); // fall back for the rest
  await Promise.all(
    requests.map(
      ({ key, job, params }, id) =>
        new Promise((resolve) => {
          pending.set(id, { key, resolve });
          worker.postMessage({ id, job, params });
        }),
    ),
  );
  worker.terminate();
  return cache.size === requests.length ? 'worker' : 'mixed';
}

export function painted(key, job, params) {
  if (cache.has(key)) return cache.get(key);
  const result = JOBS[job](make, params);
  cache.set(key, result); // the same art is asked for more than once (wood)
  return result;
}
