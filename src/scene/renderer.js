import * as THREE from 'three';

const pixelRatio = () => Math.min(devicePixelRatio, innerWidth < 720 ? 1.35 : 2);

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(pixelRatio());
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.03;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

export function resizeRenderer(renderer) {
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(pixelRatio());
}
