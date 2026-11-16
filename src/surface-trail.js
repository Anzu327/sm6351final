import * as THREE from 'three';

// A UV-space wake. The red channel stores coverage and green stores its growing rim.
export function createSurfaceTrail(renderer, flow) {
  const size = 512;
  const targets = [0, 1].map(() => new THREE.WebGLRenderTarget(size, size, {
    type: THREE.HalfFloatType, depthBuffer: false,
  }));
  const field = { value: targets[0].texture };
  const scene = new THREE.Scene();
  const view = new THREE.Camera();
  const material = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: {
      previous: { value: null },
      flow: { value: flow },
      from: { value: new THREE.Vector2() },
      to: { value: new THREE.Vector2() },
      radius: { value: 0 },
    },
    vertexShader: `
      varying vec2 sampleUV;
      void main() { sampleUV = uv; gl_Position = vec4(position.xy, 0., 1.); }
    `,
    fragmentShader: `
      uniform sampler2D previous, flow;
      uniform vec2 from, to;
      uniform float radius;
      varying vec2 sampleUV;
      void main() {
        const float pixel = 1. / 512.;
        vec2 current = sampleUV + pixel * (texture2D(flow, sampleUV * 3.).rg * 2. - 1.);
        float spread = max(max(texture2D(previous, current + vec2(pixel,0.)).r,
                               texture2D(previous, current - vec2(pixel,0.)).r),
                           max(texture2D(previous, current + vec2(0.,pixel)).r,
                               texture2D(previous, current - vec2(0.,pixel)).r));
        vec2 segment = to - from;
        float t = clamp(dot(sampleUV - from, segment) / max(dot(segment, segment), 1e-8), 0., 1.);
        float d = length(sampleUV - from - segment * t);
        float mark = radius > 0. ? pow(max(0., 1. - d / radius), 3.) : 0.;
        float coverage = min(1., (spread + mark) * .985);
        float rim = coverage - texture2D(previous, current).r;
        gl_FragColor = vec4(coverage, rim, 0., 1.);
      }
    `,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  scene.add(quad);
  const originalTarget = renderer.getRenderTarget();
  for (const target of targets) {
    renderer.setRenderTarget(target);
    renderer.clear();
  }
  renderer.setRenderTarget(originalTarget);

  const previousUV = new THREE.Vector2();
  const nextUV = new THREE.Vector2();
  let hasContact = false;
  let dirty = false;
  let lastMove = -Infinity;
  let lastTick = -Infinity;
  let lastMark = -Infinity;
  let targetVelocity = 0;
  let velocity = 0;
  let front = 0;
  let populated = false;

  function trace(uv) {
    if (!uv) {
      hasContact = dirty = false;
      targetVelocity = velocity = 0;
      return;
    }
    if (!hasContact) previousUV.copy(uv);
    hasContact = true;
    nextUV.copy(uv);
    dirty = true;
  }

  function tick(seconds) {
    if (seconds - lastTick < .015) return;
    lastTick = seconds;
    const delta = dirty ? previousUV.distanceTo(nextUV) : 0;
    const contiguous = seconds - lastMove <= .15 && delta <= .3;
    if (dirty && delta > 0) lastMove = seconds;
    if (!contiguous) {
      previousUV.copy(nextUV);
      targetVelocity = 0;
    }
    // The spherical coordinates cover fewer UV units per screen pixel than
    // the reference's unwrapped ice mesh. Match its brush response in view.
    targetVelocity = THREE.MathUtils.clamp((targetVelocity + (contiguous ? delta * 10.5 : 0)) * .88, 0, 1);
    velocity = THREE.MathUtils.lerp(velocity, 1 - (1 - targetVelocity) ** 5, .1);
    const radius = hasContact && seconds - lastMove < .15
      ? .05 * THREE.MathUtils.smoothstep(velocity, .025, .78)
      : 0;
    material.uniforms.from.value.copy(previousUV);
    material.uniforms.to.value.copy(nextUV);
    material.uniforms.radius.value = radius;
    previousUV.copy(nextUV);
    dirty = false;
    if (radius > 0) {
      lastMark = seconds;
      populated = true;
    }

    const returnTarget = renderer.getRenderTarget();
    if (seconds - lastMark > 7) {
      if (populated) {
        for (const target of targets) {
          renderer.setRenderTarget(target);
          renderer.clear();
        }
        renderer.setRenderTarget(returnTarget);
        populated = false;
      }
      return;
    }
    material.uniforms.previous.value = targets[front].texture;
    front = 1 - front;
    renderer.setRenderTarget(targets[front]);
    renderer.render(scene, view);
    renderer.setRenderTarget(returnTarget);
    field.value = targets[front].texture;
  }

  return { field, trace, tick };
}
