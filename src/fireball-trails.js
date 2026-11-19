import {
  BufferAttribute, BufferGeometry, Color, DoubleSide, DynamicDrawUsage, Mesh, ShaderMaterial,
} from 'three';

const segments = 32;
const verticesPerTrail = (segments + 1) * 2;

const vertexShader = /* glsl */ `
  attribute vec2 plume;
  varying vec2 vPlume;
  varying vec2 vUv;
  varying vec2 vPaper;

  void main() {
    vUv = uv;
    vPlume = plume;
    vPaper = (modelMatrix * vec4(position, 1.0)).xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 whiteHot, ember, smoke;
  uniform float opacity;
  varying vec2 vPlume;
  varying vec2 vUv;
  varying vec2 vPaper;

  float grain(vec2 cell) {
    vec3 p = fract(vec3(cell.xyx) * .1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  void main() {
    float age = vUv.x;
    float fleck = grain(floor(gl_FragCoord.xy));
    float brush = sin(vPaper.x * 51. + vPaper.y * 27.)
      * sin(vPaper.x * 17. - vPaper.y * 36.);
    float edge = abs(vUv.y * 2. - 1. + brush * (.10 + age * .26));
    float intensity = vPlume.x * opacity;
    // The thin incandescent core burns out before the feathered outer wake.
    float core = (1. - smoothstep(.01, .38, edge)) * (1. - smoothstep(.03, .42, age));
    float outer = (1. - smoothstep(.15, .83, edge)) * (1. - smoothstep(.18, 1., age));
    float alpha = intensity * smoothstep(0., .026, age)
      * (core * .76 + outer * .42) * (.76 + fleck * .24);
    if (alpha < .002) discard;

    vec3 hotColor = mix(ember, whiteHot, vPlume.y * core);
    vec3 pigment = mix(hotColor, smoke, age * age * .85);
    gl_FragColor = vec4(pigment, alpha);
    #include <colorspace_fragment>
  }
`;

export function createFireballTrails(tracks) {
  const vertexCount = tracks.length * verticesPerTrail;
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const plume = new Float32Array(vertexCount * 2);
  const indices = new Uint16Array(tracks.length * segments * 6);

  tracks.forEach((track, index) => {
    for (let section = 0; section <= segments; section++) {
      const left = index * verticesPerTrail + section * 2;
      const age = section / segments;
      uvs.set([age, 0, age, 1], left * 2);
      plume[left * 2 + 1] = track.heat;
      plume[left * 2 + 3] = track.heat;
      if (section < segments) {
        indices.set([left, left + 1, left + 2, left + 1, left + 3, left + 2],
          (index * segments + section) * 6);
      }
    }
  });

  const geometry = new BufferGeometry();
  geometry.setIndex(new BufferAttribute(indices, 1));
  const position = new BufferAttribute(positions, 3).setUsage(DynamicDrawUsage);
  const pigment = new BufferAttribute(plume, 2).setUsage(DynamicDrawUsage);
  geometry.setAttribute('position', position);
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  geometry.setAttribute('plume', pigment);

  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      whiteHot: { value: new Color('#fff2c1') },
      ember: { value: new Color('#f9945b') },
      smoke: { value: new Color('#a28cae') },
      opacity: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = 'fireball-wake';
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;

  const sample = { x: 0, y: 0, brightness: 0 };
  const centers = new Float32Array((segments + 1) * 2);

  function update(flight, motion, opacity) {
    material.uniforms.opacity.value = opacity;
    for (let index = 0; index < tracks.length; index++) {
      const track = tracks[index];
      for (let section = 0; section <= segments; section++) {
        const age = section / segments;
        const lag = age * track.lifetime;
        track.sample(flight - lag, sample);
        // Subtract the current fireball translation from the emission position.
        // The wake stays where it was emitted while the fireball moves on.
        const curl = Math.sin((flight - lag) * 62 + index * 1.7) * age * age * track.width;
        centers[section * 2] = sample.x + motion.x * lag;
        centers[section * 2 + 1] = sample.y + (motion.y - motion.bend * lag) * lag + curl;
        const left = index * verticesPerTrail + section * 2;
        plume[left * 2] = plume[left * 2 + 2] = sample.brightness;
      }

      for (let section = 0; section <= segments; section++) {
        const prev = Math.max(0, section - 1) * 2;
        const next = Math.min(segments, section + 1) * 2;
        const dx = centers[next] - centers[prev];
        const dy = centers[next + 1] - centers[prev + 1];
        const age = section / segments;
        const width = track.width * (.60 + 1.15 * age) / Math.max(.001, Math.hypot(dx, dy));
        const x = centers[section * 2];
        const y = centers[section * 2 + 1];
        const left = (index * verticesPerTrail + section * 2) * 3;
        positions[left] = x - dy * width;
        positions[left + 1] = y + dx * width;
        positions[left + 3] = x + dy * width;
        positions[left + 4] = y - dx * width;
      }
    }
    position.needsUpdate = true;
    pigment.needsUpdate = true;
  }

  return { mesh, update };
}
