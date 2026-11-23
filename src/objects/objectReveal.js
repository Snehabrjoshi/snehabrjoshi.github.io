import * as THREE from 'three';
import { gsap } from 'gsap';
import { DURATION, EASE } from '../config/motion.js';

const DIM = 0.78;

export function createObjectReveal({ view, atmosphere }) {
  let current = null;
  let timeline = null;
  let settle = null;
  const dim = { value: 1 };
  const applyDim = () => atmosphere.setDim(dim.value);
  const world = new THREE.Vector3();

  return {
    open(item) {
      current = item;
      item.body.getWorldPosition(world);
      world.y += 0.25;
      const narrow = innerWidth < 720;
      const scale = item.slot.getWorldScale(new THREE.Vector3()).x;
      view.setFocus(world, {
        distance: (narrow ? 5.2 : 3.3) * scale,
        x: narrow ? 0 : 0.36 * item.screenSide,
        y: narrow ? 0.6 : 0,
      });
      const std = { duration: DURATION.slow, ease: EASE.standard.gsap };
      timeline = gsap
        .timeline()
        .to(item.body.position, { y: item.lift.y, ...std }, 0)
        .to(item.body.rotation, { x: item.lift.tilt, ...std }, 0)
        .to(view.state, { focus: 1, ...std }, 0)
        .to(dim, { value: DIM, ...std, onUpdate: applyDim }, 0);
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
    close() {
      const item = current;
      if (!item) return Promise.resolve();
      timeline?.kill();
      settle?.(false);
      settle = null;
      const back = { duration: 0.4, ease: EASE.standard.gsap };
      return new Promise((resolve) => {
        gsap
          .timeline({
            onComplete: () => {
              current = null;
              resolve();
            },
          })
          .to(item.body.position, { y: 0, ...back }, 0)
          .to(item.body.rotation, { x: 0, ...back }, 0)
          .to(view.state, { focus: 0, ...back }, 0)
          .to(dim, { value: 1, ...back, onUpdate: applyDim }, 0);
      });
    },
  };
}
