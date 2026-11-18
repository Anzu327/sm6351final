import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { paintSky } from './sky.js';
import { loadPrintPaper, printPaper } from './print-paper.js';
import { printSpecimenLayer } from './specimen-print.js';
import { specimenCurtain } from './specimen-curtain.js';

import { createRingLight, illustrate } from './illustration.js';
import { clamp, ease, mix, passagePose, passageSpan } from './motion.js';
import { loadSpecimen, poseSpecimenCamera } from './specimen.js';

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
    #ifdef PRINT_INK
      ${printPaper}
      ${printSpecimenLayer}
      uniform vec2 pixelSize;
    #endif

    ${specimenCurtain}
    #ifdef PRINT_INK
      float ringCoverage(sampler2D model, vec2 uv) {
        return smoothstep(.62,.97,texture2D(model,clamp(uv,0.,1.)).a);
      }

      vec3 printRingOutline(sampler2D model, vec2 uv, vec3 color) {
        vec2 pixel = uv / pixelSize;
        float grain = hash(floor(pixel));
        float pressure = noise(pixel * .34);
        vec2 offset = vec2(noise(pixel * .52),noise(pixel * .52 + 19.3)) - .5;
        // Shift the contour lookup before detecting the edge, as in a rough print.
        vec2 point = uv + offset * (3.2 + grain * 1.6) * pixelSize;
        vec2 sampleStep = pixelSize * mix(.75,2.15,pressure);
        float left = ringCoverage(model,point - vec2(sampleStep.x,0.));
        float right = ringCoverage(model,point + vec2(sampleStep.x,0.));
        float above = ringCoverage(model,point + vec2(0.,sampleStep.y));
        float below = ringCoverage(model,point - vec2(0.,sampleStep.y));
        float edge = length(vec2(right - left,above - below));
        float stroke = smoothstep(.20,.74,edge);
        float deposit = smoothstep(.25,.67,pressure*.59 + grain*.41);
        vec3 ink = mix(vec3(.032,.027,.086),vec3(.097,.092,.21),pressure);
        return mix(color,ink,stroke * deposit * .93);
      }
    #endif

    vec3 layer(sampler2D model, sampler2D sky, vec2 uv, vec2 offset, bool rings) {
      vec3 background = texture2D(sky, (uv - .5) * .88 + .5 + offset).rgb;
      vec4 foreground = texture2D(model, clamp(uv, 0., 1.));
      vec3 color = background * (1. - foreground.a) + foreground.rgb;
      #ifdef PRINT_INK
        if (rings) return printRingOutline(model,uv,color);
        return drawSpecimenInk(model, uv, pixelSize, foreground, color).rgb;
      #endif
      return color;
    }
    vec2 portalDistort(vec2 uv, float grain) {
      vec2 p = (uv - .5) * vec2(aspectRatio, 1.);
      float angle = ringPulse * .3 * (grain - .5);
      p = mat2(cos(angle), sin(angle), -sin(angle), cos(angle)) * p;
      return p / vec2(aspectRatio, 1.) + .5;
    }
    vec3 refractLayer(sampler2D model, sampler2D sky, vec2 uv, vec2 driftUV, float bend, bool rings) {
      vec3 sum = vec3(0.), weight = vec3(0.);
      for (int i = 0; i < 5; i++) {
        float t = float(i) / 5.;
        vec3 w = spectrum(t);
        sum += w * layer(model, sky, splitUV(uv, bend, t), driftUV, rings);
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
        color = layer(specimen, paperA, uv, drift, false);
        if (transparentOpening) alpha = 0.;
      } else if (curtain >= 1.) {
        color = layer(passage, paperB, portalDistort(uv, grain), paperDrift, true);
      } else {
        vec2 outgoing, incoming;
        float cut, center, colorEdge;
        curtainLayers(uv, aspectRatio, curtain, outgoing, incoming, cut, center, colorEdge);
        incoming = portalDistort(incoming, grain);
        vec3 a = vec3(0.), b = vec3(0.);
        if (!transparentOpening && cut < 1.) a = refractLayer(specimen, paperA, outgoing, drift, 12. * center * colorEdge * grain, false);
        if (cut > 0.) b = refractLayer(passage, paperB, incoming, paperDrift, 12. * center * (1. - colorEdge) * (1. - grain), !transparentOpening);
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
      #ifdef PRINT_INK
        color = mix(color, vec3(.34,.47,.85), ringPulse * .045);
        vec2 pixel = gl_FragCoord.xy;
        float tooth = paperTooth(pixel);
        float fiber = paperTooth(pixel*.54+vec2(1024.,512.)*.23);
        float luma = dot(color,vec3(.2126,.7152,.0722));
        vec3 darkPaper = color * (1. + (tooth-.48)*1.1 + (fiber-.48)*.48 + (grain-.5)*.15);
        color = mix(darkPaper,applyPaper(color,pixel,tooth,grain-.5),smoothstep(.03,.13,luma));
      #else
        color = mix(color, vec3(.34,.47,.85), ringPulse * .075);
        vec2 pos = vUv - vec2(.53, .53);
        color *= 1. - dot(pos, pos) * .17;
        color += (grain - .5) * .034;
      #endif
      color = max(color, 0.);
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
    defines: embedded ? { PRINT_INK: 1 } : {},
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
      ...(embedded && {
        pixelSize: { value: new THREE.Vector2(1, 1) },
        paperGrain: { value: null },
        grainReady: { value: 0 },
      }),
    },
    depthTest: false,
    depthWrite: false,
  });
  if (embedded) {
    loadPrintPaper().then(texture => {
      composite.uniforms.paperGrain.value = texture;
      composite.uniforms.grainReady.value = 1;
    }).catch(error => console.error('Could not load the specimen paper texture', error));
  }
  const screen = new THREE.Scene();
  screen.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), composite));
  const screenCamera = new THREE.Camera();

  const loader = new GLTFLoader();
  const [specimen, ringAsset] = await Promise.all([
    loadSpecimen(renderer, embedded),
    loader.loadAsync(import.meta.env.BASE_URL + 'models/igloo-transition-rings.glb'),
  ]);
  const { rock } = specimen;
  specimenScene.add(rock, specimen.lines);

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
      const rest = mesh.position.clone();
      mesh.material = illustrate(mesh.material, null, embedded ? 'rings' : null, embedded ? rest : null);
      const seed = (arcIndex + 1) * 92.671 + index * 147.53;
      return {
        mesh, rest,
        axis: new THREE.Vector3(Math.sin(seed), Math.sin(seed * 2.17), Math.cos(seed * 1.43)).normalize(),
        variation: (Math.sin(seed * .47) + 1) / 2,
      };
    });
    const light = new THREE.Mesh(lightGeometry, createRingLight(embedded));
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
  let specimenParallax = 0;

  let width = 1;
  let height = 1;
  let aspect = 1;
  const world = new THREE.Vector3();
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
    renderer.setSize(w, h, false);
    const targetSize = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (embedded) composite.uniforms.pixelSize.value.set(1 / targetSize.x, 1 / targetSize.y);
    specimen.resize(dpr, targetSize.y);
    specimenTarget.setSize(targetSize.x, targetSize.y);
    passageTarget.setSize(targetSize.x, targetSize.y);
    for (const camera of [specimenCamera, passageCamera]) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }
    paintSky(fallbackSky, w, h, false, embedded);
    paintSky(paperCanvasB, w, h, true, embedded);
    paperA.needsUpdate = paperB.needsUpdate = true;
  }

  function poseSpecimen(scroll, focus, pointer, motion, velocity, orbit) {
    const { center, dock } = poseSpecimenCamera(specimenCamera, width, aspect, scroll, focus, velocity);
    specimen.pose(scroll, pointer, motion, center, dock, orbit);
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

  function render(scroll, focus, pointer, seconds, motion, velocity, orbit, portal = 0, showSpecimen = true) {
    const sceneScroll = mix(scroll, 0, ease(0, .56, focus));
    const opening = sceneScroll < 0;
    const curtain = clamp(opening ? sceneScroll + 1 : sceneScroll);
    const effects = composite.uniforms;
    specimenParallax = opening ? -.4 * (1 - curtain) ** 3 : .4 * curtain ** 3;
    effects.curtain.value = curtain;
    effects.transparentOpening.value = embedded && opening;
    effects.portal.value = portal;
    effects.specimen.value = opening || !showSpecimen ? empty : specimenTarget.texture;
    effects.passage.value = opening ? (showSpecimen ? specimenTarget.texture : empty) : passageTarget.texture;
    effects.paperA.value = opening ? openingPaper : paperA;
    effects.paperB.value = opening ? paperA : paperB;
    effects.drift.value.set(pointer.x * .004 * motion * curtain, pointer.y * .005 * motion * curtain);
    effects.ringPulse.value = 0;
    effects.paperTravel.value = 0;

    if (showSpecimen && scroll > -1 && scroll < 1) {
      poseSpecimen(scroll, focus, pointer, motion, velocity, orbit);
      const scan = (1 - ease(.13, .26, Math.abs(scroll))) * (1 - ease(0, .35, focus));
      specimen.update(seconds, scan * motion);
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
    return specimen.intersect(specimenCamera, cursor);
  }

  function tracePointer(x, y, enabled) {
    const hit = enabled ? intersect(x, y) : null;
    specimen.trace(hit);
    return Boolean(hit);
  }

  return { resize, render, getLabelsGeometry, tracePointer, hitTest: (x, y) => Boolean(intersect(x, y)) };
}
