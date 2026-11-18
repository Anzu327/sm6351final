import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { illustrate } from './illustration.js';
import { archivePose, clamp, ease, mix } from './motion.js';
import { createPlexus } from './plexus.js';
import { createSurfaceTrail } from './surface-trail.js';

export function poseSpecimenCamera(camera, width, aspect, scroll, focus, velocity) {
  // One original cube slot advances the camera by 5.75 world units.
  const { center, approach, dock } = archivePose(focus);
  const travel = -5.75 * mix(scroll, 0, center);
  const compact = width <= 720;
  const zoom = Math.min(1, aspect * 1.25);
  const detailDistance = compact ? Math.max(3.8, 7.8 * zoom) : Math.max(3.95, 5.08 / aspect);
  const distance = mix(approach, detailDistance, dock);
  const fov = 45 - 5 * velocity * (1 - center);
  const screenHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(fov / 2)) / zoom;
  const panX = compact ? 0 : screenHeight * aspect * .245 * dock;
  const panY = compact ? -screenHeight * .235 * dock : 0;
  camera.fov = fov;
  camera.zoom = zoom;
  camera.updateProjectionMatrix();
  camera.position.set(panX, travel + panY, distance);
  camera.lookAt(panX, travel + panY, 0);
  camera.updateMatrixWorld(true);
  return { center, dock };
}

export async function loadSpecimen(renderer, print, assetRoot = import.meta.env.BASE_URL) {
  const loader = new GLTFLoader();
  const textureLoader = new THREE.TextureLoader();
  const [{ scene: model }, flow, facets] = await Promise.all([
    loader.loadAsync(assetRoot + 'models/chelyabinsk-main-mass.glb'),
    textureLoader.loadAsync(assetRoot + 'effects/surface-flow.png'),
    textureLoader.loadAsync(assetRoot + 'effects/surface-facets.png'),
  ]);
  flow.wrapS = flow.wrapT = facets.wrapS = facets.wrapT = THREE.RepeatWrapping;
  facets.colorSpace = THREE.SRGBColorSpace;
  facets.flipY = false;

  const wake = createSurfaceTrail(renderer, flow);
  const wakeScale = { value: 9 };
  const center = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
  model.traverse(node => {
    if (!node.isMesh) return;
    node.geometry.computeBoundingBox();
    const localCenter = node.geometry.boundingBox.getCenter(new THREE.Vector3());
    node.userData.wakeCenter = localCenter;
    node.material = illustrate(node.material, {
      field: wake.field, facets, center: localCenter, patternScale: wakeScale,
    }, print ? 'stone' : null);
  });
  model.position.copy(center).multiplyScalar(-1);
  const tilt = new THREE.Group();
  tilt.rotation.set(.02, .19, 1.10);
  tilt.add(model);
  const rock = new THREE.Group();
  rock.add(tilt);
  rock.updateMatrixWorld(true);

  const plexus = createPlexus(1.72);
  const cast = new THREE.Raycaster();
  const surfacePoint = new THREE.Vector3();
  const brushUV = new THREE.Vector2();
  const pointerTilt = new THREE.Euler(0, 0, 0, 'YXZ');
  const pointerRotation = new THREE.Quaternion();

  function pose(scroll, pointer, motion, center, dock, orbit) {
    const rotation = 1 - center;
    const distanceFromCenter = -scroll / 3;
    rock.position.set(-.035, .055, 0);
    rock.scale.setScalar(2.73);
    rock.rotation.set(
      11.2 * distanceFromCenter * rotation,
      -9.35 * distanceFromCenter * rotation,
      -4.95 * distanceFromCenter * rotation,
    );
    // Apply the same view-axis tilt in the ring, the full scene, and the archive.
    const amount = motion * rotation * (1 - ease(0, .38, scroll));
    pointerTilt.set(pointer.y * .094 * amount, -pointer.x * .128 * amount, 0);
    rock.quaternion.premultiply(pointerRotation.setFromEuler(pointerTilt));
    pointerTilt.set(orbit.pitch * dock, orbit.yaw * dock, 0);
    rock.quaternion.premultiply(pointerRotation.setFromEuler(pointerTilt));
    rock.updateMatrixWorld(true);
  }

  function intersect(camera, cursor) {
    cast.setFromCamera(cursor, camera);
    return cast.intersectObject(rock, true)[0];
  }

  function trace(hit) {
    if (!hit) {
      wake.trace(null);
      return;
    }
    hit.object.worldToLocal(surfacePoint.copy(hit.point));
    surfacePoint.sub(hit.object.userData.wakeCenter).normalize();
    brushUV.set(Math.atan2(surfacePoint.z, surfacePoint.x) / (2 * Math.PI) + .5,
      Math.asin(clamp(surfacePoint.y, -1, 1)) / Math.PI + .5);
    wake.trace(brushUV);
  }

  return {
    rock, pose, intersect, trace,
    lines: plexus.group,
    resize(dpr, drawingHeight) {
      plexus.setPixelRatio(dpr);
      wakeScale.value = 9 * Math.min(1, drawingHeight / 1300);
    },
    update(seconds, scan) {
      plexus.update(seconds, scan, rock);
      wake.tick(seconds);
    },
  };
}
