// SwiftShader is forced so WebGL renders headless.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

export const PORT = 4183;
export const BASE = `http://localhost:${PORT}/`;

// Runs Vite's CLI directly (not through npx) so stop() ends the server itself.
export async function startPreview() {
  const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
  const proc = spawn(process.execPath, [vite, 'preview', '--port', String(PORT), '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite preview did not start')), 15000);
    proc.stdout.on('data', (chunk) => {
      if (String(chunk).includes(String(PORT))) {
        clearTimeout(timer);
        resolve();
      }
    });
    proc.stderr.on('data', (chunk) => {
      clearTimeout(timer);
      reject(new Error(`vite preview: ${chunk}`));
    });
    proc.on('exit', (code) => reject(new Error(`vite preview exited (${code})`)));
  });
  return () => proc.kill();
}

export async function launchBrowser() {
  return chromium.launch({
    channel: 'chrome',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
}

// SwiftShader's "GL Driver Message … ReadPixels" comes from screenshot readback:
// it is tagged so it can be told apart from app problems.
export function watchConsole(page, sink) {
  page.on('console', (msg) => {
    if (msg.type() !== 'error' && msg.type() !== 'warning') return;
    const text = msg.text();
    if (/Failed to load resource/.test(text)) return; // reported with its URL below
    const tag = /GL Driver Message.*ReadPixels/.test(text) ? 'capture-noise' : msg.type();
    sink.push(`[${tag}] ${text}`);
  });
  page.on('pageerror', (err) => sink.push(`[pageerror] ${err.message}`));
  page.on('response', (res) => {
    if (res.status() >= 400) sink.push(`[http ${res.status()}] ${res.url()}`);
  });
  page.on('requestfailed', (req) => sink.push(`[requestfailed] ${req.url()}`));
}

// Wraps the WebGL draw calls so they can be counted without hooks in the app.
export const glCounterInit = () => {
  const stats = { calls: 0, triangles: 0, frames: 0 };
  const tri = (mode, count, instances = 1) =>
    (mode === 4 ? count / 3 : mode === 5 || mode === 6 ? Math.max(count - 2, 0) : 0) * instances;
  const wrap = (proto) => {
    if (!proto) return;
    const { drawElements, drawArrays, drawElementsInstanced, drawArraysInstanced } = proto;
    proto.drawElements = function (m, c, ...rest) {
      stats.calls++;
      stats.triangles += tri(m, c);
      return drawElements.call(this, m, c, ...rest);
    };
    proto.drawArrays = function (m, f, c) {
      stats.calls++;
      stats.triangles += tri(m, c);
      return drawArrays.call(this, m, f, c);
    };
    if (drawElementsInstanced) {
      proto.drawElementsInstanced = function (m, c, t, o, n) {
        stats.calls++;
        stats.triangles += tri(m, c, n);
        return drawElementsInstanced.call(this, m, c, t, o, n);
      };
    }
    if (drawArraysInstanced) {
      proto.drawArraysInstanced = function (m, f, c, n) {
        stats.calls++;
        stats.triangles += tri(m, c, n);
        return drawArraysInstanced.call(this, m, f, c, n);
      };
    }
  };
  wrap(window.WebGL2RenderingContext?.prototype);
  wrap(window.WebGLRenderingContext?.prototype);
  const tick = () => {
    stats.frames++;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.__glStats = stats;
};
