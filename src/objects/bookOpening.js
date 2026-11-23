import * as THREE from 'three';
import { gsap } from 'gsap';
import { DURATION, EASE } from '../config/motion.js';

const OPEN = -Math.PI; // the open spread lies flat, square to the camera
const CLOSE = { shut: 0.2, slide: 0.28 }; // + the reader's 0.12 s text fade = 0.6 s
const DIM = 0.7;
const NARROW = 720; // below this width: no dolly, a full-screen paper page instead
const BAR = 52;

// Only transforms, the camera dolly and exposure are animated (no layout).
export function createBookOpener({ scene, view, atmosphere }) {
  const { camera } = view;
  let timeline = null;
  let current = null;
  let settle = null;
  const dim = { value: 1 };
  const applyDim = () => atmosphere.setDim(dim.value);

  function readingLayout(item) {
    const scale = item.slot.getWorldScale(new THREE.Vector3()).x;
    const w = item.width * scale;
    const h = item.height * scale;
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const tanH = tanV * camera.aspect;
    const narrow = innerWidth < NARROW;
    const near = Math.max((2 * w) / (0.8 * 2 * tanH), h / (0.8 * 2 * tanV));
    const far = narrow ? Math.max((2 * w) / (0.92 * 2 * tanH), h / (0.6 * 2 * tanV)) : near * 1.45;
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().lookAt(
        view.basePosition,
        view.basePosition.clone().add(view.forward),
        camera.up,
      ),
    );
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
    const closed = view.basePosition.clone().addScaledVector(view.forward, far);
    closed.addScaledVector(up, -((BAR / 2 / innerHeight) * 2 * (narrow ? far : near) * tanV));
    return {
      closed,
      open: closed.clone().addScaledVector(right, w / 2),
      quaternion,
      dolly: narrow ? 0 : far - near,
    };
  }

  function restPose(item) {
    item.slot.updateWorldMatrix(true, false);
    return {
      position: item.rest.clone().applyMatrix4(item.slot.matrixWorld),
      quaternion: item.slot.getWorldQuaternion(new THREE.Quaternion()),
    };
  }

  const slerpTo = (body, to, vars) => {
    const p = { t: 0 };
    let from;
    return gsap.to(p, {
      t: 1,
      ...vars,
      onStart: () => (from = body.quaternion.clone()),
      onUpdate: () => body.quaternion.slerpQuaternions(from, to, p.t),
    });
  };

  function openTimeline(item) {
    const { body, frontPivot, pagePivots, rightPage } = item;
    const layout = readingLayout(item);
    const out = body.position
      .clone()
      .add(new THREE.Vector3(0, 0.04, 0.5).applyQuaternion(item.slot.parent.quaternion));
    const std = { duration: DURATION.slow, ease: EASE.standard.gsap };
    const tl = gsap.timeline();
    const slide = DURATION.base;
    tl.to(body.position, { ...xyz(out), duration: slide, ease: EASE.out.gsap }, 0);
    tl.to(body.position, { ...xyz(layout.closed), ...std }, slide);
    tl.add(slerpTo(body, layout.quaternion, std), slide);

    const coverAt = slide + DURATION.slow * 0.85;
    tl.to(frontPivot.rotation, { y: OPEN, ...std }, coverAt);
    tl.to(body.position, { ...xyz(layout.open), ...std }, coverAt);

    let at = coverAt + DURATION.slow * 0.35;
    const n = pagePivots.length - 1;
    let end = at;
    pagePivots.forEach((pivot, i) => {
      const s = (i / n) ** 2;
      const vars = { duration: 0.2 + 0.45 * s, ease: i === n ? EASE.out.gsap : 'power1.inOut' };
      tl.to(pivot.rotation, { y: OPEN, ...vars }, at);
      tl.to(pivot.position, { z: pivot.userData.flatZ, ...vars }, at);
      end = at + vars.duration;
      at += 0.04 + 0.16 * s;
    });
    tl.to(rightPage.position, { z: rightPage.userData.flatZ, duration: 0.12 }, end);

    const dollyAt = coverAt + 0.15;
    const dollyFor = end - dollyAt;
    tl.to(
      view.state,
      { dolly: layout.dolly, duration: dollyFor, ease: EASE.standard.gsap },
      dollyAt,
    );
    tl.to(
      dim,
      { value: DIM, duration: dollyFor, ease: EASE.standard.gsap, onUpdate: applyDim },
      dollyAt,
    );
    return tl;
  }

  const corner = new THREE.Vector3();
  function rectOf(mesh) {
    const box =
      mesh.geometry.boundingBox ?? (mesh.geometry.computeBoundingBox(), mesh.geometry.boundingBox);
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      corner
        .set(
          i & 1 ? box.max.x : box.min.x,
          i & 2 ? box.max.y : box.min.y,
          i & 4 ? box.max.z : box.min.z,
        )
        .applyMatrix4(mesh.matrixWorld)
        .project(camera);
      const x = ((corner.x + 1) / 2) * innerWidth;
      const y = ((1 - corner.y) / 2) * innerHeight;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  }

  return {
    get narrow() {
      return innerWidth < NARROW;
    },
    open(item) {
      current = item;
      scene.attach(item.body); // keep the world transform, leave the row
      item.openParts.forEach((part) => (part.visible = true));
      timeline = openTimeline(item);
      if (window.__capture) window.__capture.timeline = timeline;
      return new Promise((resolve) => {
        settle = resolve;
        timeline.eventCallback('onComplete', () => {
          settle = null;
          resolve(true);
        });
      });
    },
    finish() {
      timeline?.progress(1);
    },
    relayout() {
      if (!current) return;
      const layout = readingLayout(current);
      current.body.position.copy(layout.open);
      current.body.quaternion.copy(layout.quaternion);
      view.state.dolly = layout.dolly;
      view.resetParallax();
    },
    pageRects() {
      if (!current) return null;
      view.sync(); // the dolly tween may have ended after the last frame
      current.body.updateMatrixWorld(true);
      camera.updateMatrixWorld();
      return { left: rectOf(current.leftPage), right: rectOf(current.rightPage) };
    },
    close() {
      const item = current;
      if (!item) return Promise.resolve();
      timeline?.kill();
      timeline = null;
      settle?.(false);
      settle = null;
      const { body, frontPivot, pagePivots, rightPage } = item;
      const rest = restPose(item);
      const back = CLOSE.shut + CLOSE.slide;
      const tl = gsap.timeline();
      rightPage.position.z = rightPage.userData.restZ; // under the cover again
      tl.to(
        [frontPivot.rotation, ...pagePivots.map((p) => p.rotation)],
        {
          y: 0,
          duration: CLOSE.shut,
          ease: EASE.in.gsap,
        },
        0,
      );
      pagePivots.forEach((p) =>
        tl.to(p.position, { z: p.userData.restZ, duration: CLOSE.shut, ease: EASE.in.gsap }, 0),
      );
      tl.to(
        body.position,
        { ...xyz(rest.position), duration: CLOSE.slide, ease: EASE.standard.gsap },
        CLOSE.shut,
      );
      tl.add(
        slerpTo(body, rest.quaternion, { duration: CLOSE.slide, ease: EASE.standard.gsap }),
        CLOSE.shut,
      );
      tl.to(view.state, { dolly: 0, duration: back, ease: EASE.standard.gsap }, 0);
      tl.to(dim, { value: 1, duration: back, ease: EASE.standard.gsap, onUpdate: applyDim }, 0);
      return new Promise((resolve) => {
        tl.eventCallback('onComplete', () => {
          item.slot.attach(body);
          body.quaternion.identity();
          item.setLift(item.hover);
          item.openParts.forEach((part) => (part.visible = false));
          current = null;
          resolve();
        });
      });
    },
  };
}

const xyz = (v) => ({ x: v.x, y: v.y, z: v.z });
