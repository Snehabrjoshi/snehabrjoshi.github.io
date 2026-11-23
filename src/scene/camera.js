import * as THREE from 'three';

// Backs off just far enough for the layout's half-width to fit, so every
// aspect ratio shows the same objects without cropping.
export function createCamera() {
  const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 60);
  const basePos = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const offset = new THREE.Vector2();
  const target = new THREE.Vector2();
  const state = { dolly: 0, focus: 0 };
  const focusEye = new THREE.Vector3();
  const focusAim = new THREE.Vector3();
  const eye = new THREE.Vector3();
  const aim = new THREE.Vector3();

  function frame({ halfWidth, elevation, fov, focusY }) {
    camera.fov = fov;
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    const halfH = THREE.MathUtils.degToRad(fov / 2);
    const halfHFov = Math.atan(Math.tan(halfH) * camera.aspect);
    const distance = Math.max(halfWidth / Math.tan(halfHFov), 4.9);
    lookAt.set(0, focusY, 0);
    basePos.set(0, focusY + Math.sin(elevation) * distance, Math.cos(elevation) * distance);
    forward.subVectors(lookAt, basePos).normalize();
    apply();
  }

  function apply() {
    eye.set(basePos.x + offset.x, basePos.y + offset.y, basePos.z);
    eye.addScaledVector(forward, state.dolly);
    aim.set(lookAt.x + offset.x * 0.18, lookAt.y + offset.y * 0.08, lookAt.z);
    aim.addScaledVector(forward, state.dolly);
    if (state.focus > 0) {
      eye.lerp(focusEye, state.focus);
      aim.lerp(focusAim, state.focus);
    }
    camera.position.copy(eye);
    camera.lookAt(aim);
    camera.updateMatrixWorld();
  }

  return {
    camera,
    frame,
    state,
    setFocus(point, { distance, x = 0, y = 0 }) {
      const back = basePos.clone().sub(point).normalize();
      focusEye.copy(point).addScaledVector(back, distance);
      const view = back.clone().negate();
      const right = new THREE.Vector3().crossVectors(view, camera.up).normalize();
      const up = new THREE.Vector3().crossVectors(right, view);
      const halfH = distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const halfW = halfH * camera.aspect;
      focusAim
        .copy(point)
        .addScaledVector(right, -x * halfW)
        .addScaledVector(up, -y * halfH);
    },
    get basePosition() {
      return basePos;
    },
    get forward() {
      return forward;
    },
    setParallax(x, y) {
      target.set(x * 0.12, y * 0.06);
    },
    // Drop the parallax at once, so a pose computed now stays exact.
    resetParallax() {
      target.set(0, 0);
      offset.set(0, 0);
      apply();
    },
    update() {
      offset.lerp(target, 0.055);
      apply();
    },
    // Projections taken right after a tween ends need the final pose now.
    sync: apply,
  };
}
