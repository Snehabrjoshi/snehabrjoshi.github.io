import * as THREE from 'three';

export function createPicker(camera) {
  const raycaster = new THREE.Raycaster();
  const targets = [];
  return {
    raycaster,
    add(hitMesh) {
      targets.push(hitMesh);
    },
    pick(ndc) {
      raycaster.setFromCamera(ndc, camera);
      return raycaster.intersectObjects(targets, false)[0]?.object.userData.target ?? null;
    },
  };
}
