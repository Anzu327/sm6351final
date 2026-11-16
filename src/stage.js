import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { paintSky } from './sky.js';

import { createRingLight, illustrate } from './illustration.js';
import { archivePose, clamp, ease, mix, passagePose, passageSpan } from './motion.js';
import { createPlexus } from './plexus.js';
import { createSurfaceTrail } from './surface-trail.js';

const compositeShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0., 1.);
    }
  `,
  fragmentShader: `
    uniform sampler2D specimen;
    uniform sampler2D passage;
    uniform sampler2D paperA;
    uniform sampler2D paperB;
    uniform float curtain;
    uniform float ringPulse;
    uniform float paperTravel;
    uniform bool transparentOpening;
    uniform float portal;
    uniform vec2 drift;
    uniform float aspectRatio;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3. - 2. * f);
      return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x),
                 mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
    }
    float sweep(float value, float limit, float width, float p) {
      float edge = mix(-width, limit, p);
      return 1. - clamp((value - edge) / width, 0., 1.);
    }
    vec3 layer(sampler2D model, sampler2D sky, vec2 uv, vec2 offset) {
      vec3 background = texture2D(sky, (uv - .5) * .88 + .5 + offset).rgb;
      vec4 foreground = texture2D(model, clamp(uv, 0., 1.));
      return background * (1. - foreground.a) + foreground.rgb;
    }
    vec2 portalDistort(vec2 uv, float grain) {
      vec2 p = (uv - .5) * vec2(aspectRatio, 1.);
      float angle = ringPulse * .3 * (grain - .5);
      p = mat2(cos(angle), sin(angle), -sin(angle), cos(angle)) * p;
      return p / vec2(aspectRatio, 1.) + .5;
    }
    vec2 splitUV(vec2 uv, float bend, float tap) {
      vec2 radial = uv - .5;
      return uv + radial * dot(radial, radial) * bend * tap;
    }
    vec3 spectrum(float t) {
      float green = 1. - abs(2. * clamp((t - 1./6.) * 1.5, 0., 1.) - 1.);
      return pow(vec3(t <= .5 ? 1. - green : 0., green, t > .5 ? 1. - green : 0.), vec3(.4545));
    }
    vec3 refractLayer(sampler2D model, sampler2D sky, vec2 uv, vec2 driftUV, float bend) {
      vec3 sum = vec3(0.), weight = vec3(0.);
      for (int i = 0; i < 5; i++) {
        float t = float(i) / 5.;
        vec3 w = spectrum(t);
        sum += w * layer(model, sky, splitUV(uv, bend, t), driftUV);
        weight += w;
      }
      return sum / max(weight, .001);
    }
    void main() {
      vec2 uv = vUv;
      float grain = hash(floor(gl_FragCoord.xy));
      vec2 paperDrift = drift + vec2(0., .055 * paperTravel);
      vec3 color;
      float alpha = 1.;
      if (curtain <= 0.) {
        color = layer(specimen, paperA, uv, drift);
        if (transparentOpening) alpha = 0.;
      } else if (curtain >= 1.) {
        color = layer(passage, paperB, portalDistort(uv, grain), paperDrift);
      } else {
        vec2 field = (uv - .5) * vec2(aspectRatio, 1.) + .5;
        float blocks = noise(floor(field * vec2(24., 42.)));
        float cracks = noise(field * 34.) * .35 + noise(field * 9.) * .65;
        float warp = (noise(field * 13.) - .5) * .8;
        float slope = .20 * aspectRatio;
        float diagonal = uv.y + (uv.x + warp) * slope;
        float limit = 1. + slope;
        float colorEdge = sweep(diagonal, limit, 2., curtain);
        float displacement = sweep(blocks, 1., 1., sweep(diagonal, limit, .9, curtain));
        float cut = sweep(cracks, 1., 2., sweep(diagonal, limit, .2, curtain));
        // The reference samples the outgoing and incoming layers on opposite vertical offsets.
        vec2 outgoing = uv - vec2(0., .4 * pow(curtain, 3.) + .025 * displacement);
        vec2 incoming = uv + vec2(0., .4 * pow(1. - curtain, 3.) + .025 * (1. - displacement));
        incoming = portalDistort(incoming, grain);
        float center = 1. - smoothstep(.7, 1., abs(uv.x * 2. - 1.));
        center *= 1. - smoothstep(.7, 1., abs(uv.y * 2. - 1.));
        vec3 a = vec3(0.), b = vec3(0.);
        if (!transparentOpening && cut < 1.) a = refractLayer(specimen, paperA, outgoing, drift, 12. * center * colorEdge * grain);
        if (cut > 0.) b = refractLayer(passage, paperB, incoming, paperDrift, 12. * center * (1. - colorEdge) * (1. - grain));
        color = transparentOpening ? b : mix(a, b, cut);
        if (transparentOpening) alpha = cut;
      }
      if (portal > 0.) {
        // Uncover the solar system from the center of the last ring.
        vec2 aspect = vec2(aspectRatio, 1.);
        float distance = length((uv - .5) * aspect) / length(.5 * aspect);
        float edge = mix(-.14, 1.14, portal);
        alpha *= (1. - .35 * portal) * smoothstep(edge - .14, edge + .14, distance);
      }
      color = mix(color, vec3(.81,.65,.50), ringPulse * .075);
      vec2 pos = vUv - vec2(.53, .53);
      color *= 1. - dot(pos, pos) * .17;
      color = max(color + (grain - .5) * .034, 0.);
      gl_FragColor = vec4(color, alpha);
      #include <colorspace_fragment>
    }
  `,
};

export async function createStage(canvas, fallbackSky, embedded = false) {
  const context = canvas.getContext('webgl2', {
    alpha: embedded,
    antialias: false,
    premultipliedAlpha: !embedded,
  });
  if (!context) throw new Error('WebGL 2 is unavailable.');
  const renderer = new THREE.WebGLRenderer({ canvas, context });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const specimenScene = new THREE.Scene();
  const passageScene = new THREE.Scene();
  const specimenCamera = new THREE.PerspectiveCamera(45, 1, .07, 70);
  const passageCamera = new THREE.PerspectiveCamera(22, 1, .045, 50);

  const renderOptions = { samples: Math.min(context.getParameter(context.MAX_SAMPLES), 4), type: THREE.HalfFloatType };
  const specimenTarget = new THREE.WebGLRenderTarget(1, 1, renderOptions);
  const passageTarget = new THREE.WebGLRenderTarget(1, 1, renderOptions);
  const paperA = new THREE.CanvasTexture(fallbackSky);
  const paperCanvasB = document.createElement('canvas');
  const paperB = new THREE.CanvasTexture(paperCanvasB);
  paperA.colorSpace = paperB.colorSpace = THREE.SRGBColorSpace;
  const openingPaper = new THREE.DataTexture(new Uint8Array([189, 194, 180, 255]), 1, 1);
  openingPaper.colorSpace = THREE.SRGBColorSpace;
  openingPaper.needsUpdate = true;
  const empty = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  empty.needsUpdate = true;

  const composite = new THREE.ShaderMaterial({
    ...compositeShader,
    uniforms: {
      specimen: { value: specimenTarget.texture },
      passage: { value: passageTarget.texture },
      paperA: { value: paperA },
      paperB: { value: paperB },
      curtain: { value: 0 },
      ringPulse: { value: 0 },
      paperTravel: { value: 0 },
      transparentOpening: { value: false },
      portal: { value: 0 },
      drift: { value: new THREE.Vector2() },
      aspectRatio: { value: 1 },
    },
    depthTest: false,
    depthWrite: false,
  });
  const screen = new THREE.Scene();
  screen.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), composite));
  const screenCamera = new THREE.Camera();

  const loader = new GLTFLoader();
  const textureLoader = new THREE.TextureLoader();
  const [meteorite, ringAsset, flow, facets] = await Promise.all([
    loader.loadAsync(import.meta.env.BASE_URL + 'models/chelyabinsk-main-mass.glb'),
    loader.loadAsync(import.meta.env.BASE_URL + 'models/igloo-transition-rings.glb'),
    textureLoader.loadAsync(import.meta.env.BASE_URL + 'effects/surface-flow.png'),
    textureLoader.loadAsync(import.meta.env.BASE_URL + 'effects/surface-facets.png'),
  ]);
  for (const texture of [flow, facets]) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  facets.colorSpace = THREE.SRGBColorSpace;
  facets.flipY = false;

  const rock = new THREE.Group();
  const wake = createSurfaceTrail(renderer, flow);
  const wakeScale = { value: 9 };
  const surfacePoint = new THREE.Vector3();
  const brushUV = new THREE.Vector2();
  const box = new THREE.Box3().setFromObject(meteorite.scene);
  const center = box.getCenter(new THREE.Vector3());
  meteorite.scene.traverse(node => {
    if (!node.isMesh) return;
    node.geometry.computeBoundingBox();
    const localCenter = node.geometry.boundingBox.getCenter(new THREE.Vector3());
    node.userData.wakeCenter = localCenter;
    node.material = illustrate(node.material, {
      field: wake.field, facets, center: localCenter, patternScale: wakeScale,
    });
  });
  meteorite.scene.position.copy(center).multiplyScalar(-1);
  const specimenTilt = new THREE.Group();
  specimenTilt.rotation.set(.02, .19, 1.10);
  specimenTilt.add(meteorite.scene);
  rock.add(specimenTilt);
  specimenScene.add(rock);
  const plexus = createPlexus(1.72);
  specimenScene.add(plexus.group);
  rock.updateMatrixWorld(true);

  const anchorCaster = new THREE.Raycaster();
  const anchors = [
    new THREE.Vector3(-.11, .22, .2),
    new THREE.Vector3(.14, .16, .2),
    new THREE.Vector3(.10, -.17, .2),
  ].map(anchor => {
    anchorCaster.set(new THREE.Vector3(anchor.x, anchor.y, 2), new THREE.Vector3(0, 0, -1));
    const rayHit = anchorCaster.intersectObject(rock, true)[0];
    return rayHit?.point ?? anchor;
  });

  const ringRig = new THREE.Group();
  const lightGeometry = new THREE.PlaneGeometry(.82, .82);
  passageScene.add(ringRig);
  const ringLayers = [0, 1, 2].map(index => {
    const groupName = 'Ring 0' + (index + 1);
    const ring = ringAsset.scene.children.find(node => node.name.replaceAll('_', ' ') === groupName);
    if (!ring?.children.length) throw new Error('A segmented ring is missing from the model.');
    ring.position.set(0, -1.65 - index * 2.5, 0);
    ringRig.add(ring);
    const arcs = ring.children.map((mesh, arcIndex) => {
      mesh.material = illustrate(mesh.material);
      const seed = (arcIndex + 1) * 92.671 + index * 147.53;
      return {
        mesh, rest: mesh.position.clone(),
        axis: new THREE.Vector3(Math.sin(seed), Math.sin(seed * 2.17), Math.cos(seed * 1.43)).normalize(),
        variation: (Math.sin(seed * .47) + 1) / 2,
      };
    });
    const light = new THREE.Mesh(lightGeometry, createRingLight());
    light.position.y = .062;
    light.rotation.x = -Math.PI * .5;
    ring.add(light);
    return { ring, arcs, light, index };
  });
  const tiltedBounds = new THREE.Box3().setFromObject(rock);
  const viewTarget = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const ringTiltAxis = new THREE.Vector3(0, 0, -1);
  const ringTilt = new THREE.Quaternion();
  const pointerTilt = new THREE.Euler(0, 0, 0, 'YXZ');
  const pointerRotation = new THREE.Quaternion();
  let specimenParallax = 0;

  let width = 1;
  let height = 1;
  let aspect = 1;
  const world = new THREE.Vector3();
  const cast = new THREE.Raycaster();
  const cursor = new THREE.Vector2();
  const local = tiltedBounds;
  const corners = [local.min.x, local.max.x].flatMap(x =>
    [local.min.y, local.max.y].flatMap(y =>
      [local.min.z, local.max.z].map(z => new THREE.Vector3(x, y, z))));
  const projectedCorner = {};
  const modelCenter = new THREE.Vector3();
  const projectedCenter = {};
  const labelPoints = anchors.map(() => ({}));
  const projectedBounds = { left: 0, top: 0, right: 0, bottom: 0 };
  const labelGeometry = { points: labelPoints, bounds: projectedBounds, center: projectedCenter };

  function project(local, output = {}) {
    world.copy(local);
    rock.localToWorld(world);
    world.project(specimenCamera);
    output.x = (world.x * .5 + .5) * width;
    output.y = (.5 - world.y * .5 - specimenParallax) * height;
    return output;
  }

  function resize(w, h) {
    width = w;
    height = h;
    aspect = w / h;
    composite.uniforms.aspectRatio.value = aspect;
    const dpr = Math.min(devicePixelRatio, 1.65, Math.sqrt(2600000 / (w * h)));
    renderer.setPixelRatio(dpr);
    plexus.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    const targetSize = renderer.getDrawingBufferSize(new THREE.Vector2());
    wakeScale.value = 9 * Math.min(1, targetSize.y / 1300);
    specimenTarget.setSize(targetSize.x, targetSize.y);
    passageTarget.setSize(targetSize.x, targetSize.y);
    for (const camera of [specimenCamera, passageCamera]) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }
    paintSky(fallbackSky, w, h);
    paintSky(paperCanvasB, w, h, true);
    paperA.needsUpdate = paperB.needsUpdate = true;
  }

  function poseSpecimen(scroll, focus, pointer, motion, velocity, orbit) {
    // One original cube slot advances the camera by 5.75 world units.
    const { center, approach, dock } = archivePose(focus);
    const travel = -5.75 * mix(scroll, 0, center);
    const distanceFromCenter = -scroll / 3;
    const compact = width <= 720;
    const zoom = Math.min(1, aspect * 1.25);
    const detailDistance = compact ? Math.max(3.8, 7.8 * zoom) : Math.max(3.95, 5.08 / aspect);
    const distance = mix(approach, detailDistance, dock);
    const fov = 45 - 5 * velocity * (1 - center);
    const screenHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(fov / 2)) / zoom;
    const panX = compact ? 0 : screenHeight * aspect * .245 * dock;
    const panY = compact ? -screenHeight * .235 * dock : 0;
    specimenCamera.fov = fov;
    specimenCamera.zoom = zoom;
    specimenCamera.updateProjectionMatrix();
    specimenCamera.position.set(panX, travel + panY, distance);
    specimenCamera.lookAt(panX, travel + panY, 0);
    specimenCamera.updateMatrixWorld(true);

    const rotation = 1 - center;
    rock.position.set(-.035, .055, 0);
    rock.scale.setScalar(2.73);
    rock.rotation.set(
      11.2 * distanceFromCenter * rotation,
      -9.35 * distanceFromCenter * rotation,
      -4.95 * distanceFromCenter * rotation,
    );
    // Apply the pointer tilt about the view axes, including when the specimen
    // already has a different pose along the scroll timeline.
    const amount = motion * rotation * (1 - ease(0, .38, scroll));
    pointerTilt.set(pointer.y * .094 * amount, -pointer.x * .128 * amount, 0);
    rock.quaternion.premultiply(pointerRotation.setFromEuler(pointerTilt));
    pointerTilt.set(orbit.pitch * dock, orbit.yaw * dock, 0);
    rock.quaternion.premultiply(pointerRotation.setFromEuler(pointerTilt));
    rock.updateMatrixWorld(true);
  }

  function posePassage(scroll, pointer, seconds, motion) {
    const { cameraY, cameraZ, lookY, lookZ, roll, level, fov, pulse } = passagePose(scroll);
    const progress = scroll / passageSpan;
    passageCamera.fov = fov;
    passageCamera.zoom = Math.min(1, aspect * 1.5);
    passageCamera.updateProjectionMatrix();
    passageCamera.position.set(pointer.x * .026 * motion, cameraY, cameraZ);
    passageCamera.up.set(-Math.sin(roll), 0, -Math.cos(roll)).lerp(up, level).normalize();
    viewTarget.set(0, lookY, lookZ);
    passageCamera.lookAt(viewTarget);
    passageCamera.updateMatrixWorld(true);

    for (const { ring, arcs, light, index } of ringLayers) {
      const start = [.10, .25, .36][index];
      const end = [.34, .43, .52][index];
      ring.visible = progress < end;
      const distance = passageCamera.position.distanceTo(ring.position);
      const front = index === 0 ? clamp(-cameraZ * .8) : 0;
      const approach = 1 - ease(2, 10, distance);
      const twist = ease(2, 10, distance) * Math.PI * .30 + ring.position.y * .25 + 1.5;
      const planeTilt = ease(2.5, 7.5, distance) * Math.PI * .30;
      ringTilt.setFromAxisAngle(ringTiltAxis, planeTilt);
      ring.quaternion.setFromAxisAngle(up, -roll * .4 - twist).multiply(ringTilt);
      const glow = ease(start, start + .13, progress) * (1 - ease(end - .042, end, progress));
      light.visible = glow > .001;
      light.material.uniforms.glow.value = glow;
      light.material.uniforms.time.value = seconds * motion;
      for (const { mesh, rest, axis, variation } of arcs) {
        const tremor = Math.sin(seconds * .5 + variation * 5 + (rest.x + rest.z) * 15) * .035 * motion;
        mesh.position.copy(rest).multiplyScalar(1 + (.075 + .075 * variation + tremor) * approach + .15 * front);
        mesh.quaternion.setFromAxisAngle(axis, .5 * ease(1.5, 12, distance) + front * .5);
      }
    }
    composite.uniforms.ringPulse.value = pulse;
    composite.uniforms.paperTravel.value = progress;
  }

  function render(scroll, focus, pointer, seconds, motion, velocity, orbit, portal = 0) {
    const sceneScroll = mix(scroll, 0, ease(0, .56, focus));
    const opening = sceneScroll < 0;
    const curtain = clamp(opening ? sceneScroll + 1 : sceneScroll);
    const effects = composite.uniforms;
    specimenParallax = opening ? -.4 * (1 - curtain) ** 3 : .4 * curtain ** 3;
    effects.curtain.value = curtain;
    effects.transparentOpening.value = embedded && opening;
    effects.portal.value = portal;
    effects.specimen.value = opening ? empty : specimenTarget.texture;
    effects.passage.value = opening ? specimenTarget.texture : passageTarget.texture;
    effects.paperA.value = opening ? openingPaper : paperA;
    effects.paperB.value = opening ? paperA : paperB;
    effects.drift.value.set(pointer.x * .004 * motion * curtain, pointer.y * .005 * motion * curtain);
    effects.ringPulse.value = 0;
    effects.paperTravel.value = 0;

    if (scroll > -1 && scroll < 1) {
      poseSpecimen(scroll, focus, pointer, motion, velocity, orbit);
      const scan = (1 - ease(.13, .26, Math.abs(scroll))) * (1 - ease(0, .35, focus));
      plexus.update(seconds, scan * motion, rock);
      wake.tick(seconds);
      renderer.setRenderTarget(specimenTarget);
      renderer.render(specimenScene, specimenCamera);
    }
    if (!opening && curtain > 0) {
      posePassage(scroll, pointer, seconds, motion);
      renderer.setRenderTarget(passageTarget);
      renderer.render(passageScene, passageCamera);
    }
    renderer.setRenderTarget(null);
    renderer.render(screen, screenCamera);
  }

  function getLabelsGeometry() {
    project(modelCenter, projectedCenter);
    anchors.forEach((anchor, index) => project(anchor, labelPoints[index]));
    projectedBounds.left = projectedBounds.top = Infinity;
    projectedBounds.right = projectedBounds.bottom = -Infinity;
    for (const corner of corners) {
      const point = project(corner, projectedCorner);
      projectedBounds.left = Math.min(projectedBounds.left, point.x);
      projectedBounds.top = Math.min(projectedBounds.top, point.y);
      projectedBounds.right = Math.max(projectedBounds.right, point.x);
      projectedBounds.bottom = Math.max(projectedBounds.bottom, point.y);
    }
    return labelGeometry;
  }

  function intersect(x, y) {
    cursor.set(x / width * 2 - 1, 1 - (y / height + specimenParallax) * 2);
    cast.setFromCamera(cursor, specimenCamera);
    return cast.intersectObject(rock, true)[0];
  }

  function tracePointer(x, y, enabled) {
    const hit = enabled ? intersect(x, y) : null;
    if (hit) {
      // The original uses a second, continuous UV set for the wake. Build the
      // same kind of coordinate on our mesh without touching its painted UVs.
      hit.object.worldToLocal(surfacePoint.copy(hit.point));
      surfacePoint.sub(hit.object.userData.wakeCenter).normalize();
      brushUV.set(Math.atan2(surfacePoint.z, surfacePoint.x) / (2 * Math.PI) + .5,
        Math.asin(clamp(surfacePoint.y, -1, 1)) / Math.PI + .5);
      wake.trace(brushUV);
    } else {
      wake.trace(null);
    }
    return Boolean(hit);
  }

  return { resize, render, getLabelsGeometry, tracePointer, hitTest: (x, y) => Boolean(intersect(x, y)) };
}
