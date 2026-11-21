import * as THREE from 'three';
import { bindComposition } from './composition.js';
import { loadSpecimen } from './specimen.js';
import { loadPrintPaper, printPaper } from './print-paper.js';
import { printSpecimenLayer } from './specimen-print.js';
import { specimenCurtain } from './specimen-curtain.js';
import { clamp, ease, mix, scrollRate } from './motion.js';

const canvas = document.querySelector('.composition__model');
const section = canvas.closest('#composition');
bindComposition(section);
const assetRoot = new URL('../', document.baseURI).href;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

async function mount() {
  const context = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: false });
  if (!context) throw new Error('WebGL 2 is unavailable.');

  const renderer = new THREE.WebGLRenderer({ canvas, context });
  renderer.setClearColor(0x000000, 0);
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    samples: Math.min(context.getParameter(context.MAX_SAMPLES), 4),
  });
  const camera = new THREE.PerspectiveCamera(45, 1, .07, 70);
  const scene = new THREE.Scene();
  const screen = new THREE.Scene();
  const screenCamera = new THREE.Camera();
  const uniforms = {
    model: { value: target.texture },
    pixelSize: { value: new THREE.Vector2() },
    aspect: { value: 1 },
    progress: { value: 0 },
    paperGrain: { value: null },
    grainReady: { value: 0 },
  };
  screen.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy,0.,1.);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D model;
      uniform vec2 pixelSize;
      uniform float aspect, progress;
      ${printSpecimenLayer}
      ${printPaper}
      ${specimenCurtain}
      vec4 sampleStone(vec2 uv) {
        vec4 foreground = texture2D(model,clamp(uv,0.,1.));
        return drawSpecimenInk(model,uv,pixelSize,foreground,foreground.rgb);
      }
      vec4 refractStone(vec2 uv, float bend) {
        vec3 sum = vec3(0.), weight = vec3(0.);
        float alpha = 0.;
        for (int i = 0; i < 5; i++) {
          float t = float(i) / 5.;
          vec3 w = spectrum(t);
          vec4 ink = sampleStone(splitUV(uv,bend,t));
          sum += w * ink.rgb;
          weight += w;
          alpha = max(alpha,ink.a);
        }
        return vec4(sum / max(weight,.001),alpha);
      }
      void main() {
        float grain = hash(floor(gl_FragCoord.xy));
        vec4 ink;
        if (abs(progress) < .0001 || abs(progress) >= 1.) {
          ink = sampleStone(vUv);
        } else {
          bool entering = progress < 0.;
          float curtain = entering ? 1. + progress : progress;
          vec2 outgoing, incoming;
          float cut, center, colorEdge;
          curtainLayers(vUv,aspect,curtain,outgoing,incoming,cut,center,colorEdge);
          float bend = 12. * center * (entering ? (1. - colorEdge) * (1. - grain) : colorEdge * grain);
          ink = refractStone(vUv,bend);
        }
        if (ink.a <= .001) discard;
        vec2 pixel = gl_FragCoord.xy;
        vec3 color = ink.rgb / ink.a;
        color = applyPaper(color,pixel,paperTooth(pixel),grain-.5);
        gl_FragColor = vec4(max(color,0.),ink.a);
        #include <colorspace_fragment>
      }
    `,
  })));

  const specimen = await loadSpecimen(renderer, true, assetRoot);
  scene.add(specimen.rock, specimen.lines);
  const modelScale = 2.73;
  const vertex = new THREE.Vector3();
  const modelVertices = [];
  let radiusSquared = 0;
  specimen.rock.traverse(mesh => {
    if (!mesh.isMesh) return;
    const positions = mesh.geometry.getAttribute('position');
    for (let index = 0; index < positions.count; index++) {
      vertex.fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld);
      modelVertices.push(vertex.clone());
      radiusSquared = Math.max(radiusSquared, vertex.lengthSq());
    }
  });
  // Fit across every rotation, including the original 40° FOV at full scroll speed.
  const maxScreenRadius = .88;
  const tightestHalfFov = THREE.MathUtils.degToRad(20);
  const viewHalfAngle = Math.atan(Math.tan(tightestHalfFov) * maxScreenRadius);
  const distance = Math.sqrt(radiusSquared) * modelScale / Math.sin(viewHalfAngle);
  const projection = new THREE.Matrix4();

  function centerSilhouette() {
    projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
      .multiply(specimen.rock.matrixWorld);
    let left = Infinity, top = -Infinity, right = -Infinity, bottom = Infinity;
    for (const point of modelVertices) {
      vertex.copy(point).applyMatrix4(projection);
      left = Math.min(left, vertex.x);
      right = Math.max(right, vertex.x);
      bottom = Math.min(bottom, vertex.y);
      top = Math.max(top, vertex.y);
    }
    const extent = Math.hypot(right - left, top - bottom) / 2;
    const fit = Math.min(1, .96 / extent);
    // Shift the projected silhouette to the canvas center as its outline changes.
    const matrix = camera.projectionMatrix.elements;
    matrix[0] *= fit;
    matrix[5] *= fit;
    matrix[8] += (left + right) / 2 * fit;
    matrix[9] += (bottom + top) / 2 * fit;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }
  const drawingSize = new THREE.Vector2();
  const cursor = new THREE.Vector2();
  const pointer = { x: 0, y: 0 };
  const orbit = { yaw: 0, pitch: 0 };
  let point = null;
  let pendingTrace = false;
  let frame = 0;
  let previousTime = 0;
  let seconds = 0;
  let progress = 0;
  let velocity = 0;
  let width = 1;
  let height = 1;
  let tracing = false;
  let visible = false;
  let suspended = false;
  let lost = false;

  function resize() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    if (!width || !height) return;
    const dpr = Math.min(devicePixelRatio, 1.65, Math.sqrt(2600000 / (width * height)));
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    renderer.getDrawingBufferSize(drawingSize);
    target.setSize(drawingSize.x, drawingSize.y);
    uniforms.pixelSize.value.set(1 / drawingSize.x, 1 / drawingSize.y);
    specimen.resize(dpr, drawingSize.y);
    camera.aspect = uniforms.aspect.value = width / height;
    schedule();
  }

  function onPointerMove(event) {
    if (event.pointerType !== 'mouse') return;
    point = { x: event.clientX, y: event.clientY };
    pendingTrace = true;
  }

  function clearPointer() {
    point = null;
    pendingTrace = false;
    tracing = false;
    specimen.trace(null);
  }

  function draw(now) {
    frame = 0;
    if (!visible || suspended || lost) return;

    const box = canvas.getBoundingClientRect();
    const elapsed = previousTime ? (now - previousTime) / 1000 : 1 / 60;
    const dt = Math.min(.05, elapsed);
    const motion = reducedMotion.matches ? 0 : 1;
    const delta = (innerHeight - box.height) / 2 - box.top;
    const entranceDistance = clamp(.85 * innerHeight, 580, 950);
    const targetProgress = clamp(delta < 0 ? delta / entranceDistance : delta * scrollRate, -1, 1);
    const previousProgress = progress;
    const scrollFollow = 1 - Math.exp(-Math.min(elapsed, .12) * 13);
    progress = motion ? (previousTime ? mix(progress, targetProgress, scrollFollow) : targetProgress) : 0;
    if (Math.abs(progress - targetProgress) < .0001 && motion) progress = targetProgress;
    velocity = previousTime && motion ? clamp((velocity + Math.abs(progress - previousProgress)) * .98 ** (60 * dt)) : 0;
    previousTime = now;
    const x = point ? (point.x - box.left) / box.width * 2 - 1 : 0;
    const y = point ? 1 - (point.y - box.top) / box.height * 2 : 0;
    const follow = 1 - Math.exp(-dt / .14);
    pointer.x = motion ? mix(pointer.x, clamp(x, -1, 1), follow) : 0;
    pointer.y = motion ? mix(pointer.y, clamp(y, -1, 1), follow) : 0;
    seconds += dt;

    specimen.pose(progress, pointer, motion, 0, 0, orbit);
    const pivot = specimen.rock.position;
    camera.fov = 45 - 5 * velocity;
    camera.updateProjectionMatrix();
    camera.position.set(pivot.x, pivot.y, pivot.z + distance);
    camera.lookAt(pivot);
    camera.updateMatrixWorld(true);
    centerSilhouette();
    const canTrace = !!(motion && point && Math.abs(progress) < .30 && x * x + y * y < 1);
    if (pendingTrace || tracing !== canTrace) {
      specimen.trace(canTrace ? specimen.intersect(camera, cursor.set(x, y)) : null);
      pendingTrace = false;
      tracing = canTrace;
    }
    const scan = 1 - ease(.13, .26, Math.abs(progress));
    specimen.update(seconds, scan * motion);
    uniforms.progress.value = progress;
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(screen, screenCamera);
    canvas.dataset.ready = 'true';
    if (motion) schedule();
  }

  function schedule() {
    if (visible && !suspended && !lost && !frame) frame = requestAnimationFrame(draw);
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
    clearPointer();
  }

  canvas.addEventListener('pointermove', onPointerMove, { passive: true });
  canvas.addEventListener('pointerleave', clearPointer);
  addEventListener('blur', clearPointer);
  reducedMotion.addEventListener('change', schedule);
  addEventListener('pagehide', () => {
    suspended = true;
    stop();
  });
  addEventListener('pageshow', () => {
    suspended = false;
    schedule();
  });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    lost = true;
    stop();
    canvas.hidden = true;
  });
  canvas.addEventListener('webglcontextrestored', () => location.reload());

  resize();
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) schedule();
    else stop();
  }).observe(canvas);

  loadPrintPaper(assetRoot).then(texture => {
    uniforms.paperGrain.value = texture;
    uniforms.grainReady.value = 1;
    schedule();
  }).catch(error => console.warn('Could not load the specimen paper texture', error));
}

const preload = new IntersectionObserver(([entry]) => {
  if (!entry.isIntersecting) return;
  preload.disconnect();
  mount().catch(error => {
    canvas.hidden = true;
    console.warn('Could not display the composition specimen', error);
  });
}, { rootMargin: '200px' });
preload.observe(canvas);
