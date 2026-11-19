// Fireball and fragment shapes from the local Chelyabinsk reconstruction.
import {
  BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Line,
  LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, PlaneGeometry,
  ShaderMaterial, Shape, ShapeGeometry, Vector3,
} from 'three';
import { createFireballTrails } from './fireball-trails.js';

const fragmentCount = 30;
const glowGeometry = new PlaneGeometry(.9, .9);
const phaseAt = flight => .14 + .88 * flight;

function random(seed) {
  const value = Math.sin(seed * 127.1 + 19.7) * 43758.54;
  return value - Math.floor(value);
}

function fade(start, end, value) {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

function makeGlow() {
  return new Mesh(glowGeometry, new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { color: { value: new Color('#ffe1a4') }, strength: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform vec3 color;
      uniform float strength;
      void main() {
        float d = length((vUv - .5) * vec2(.7, 1.));
        float alpha = exp(-d*d*30.) * .38 * (1. - smoothstep(.3, .5, d));
        gl_FragColor = vec4(color, alpha * strength);
        #include <colorspace_fragment>
      }
    `,
  }));
}

function pigment(color) {
  return new MeshBasicMaterial({ color, side: DoubleSide, transparent: true, opacity: 0, depthWrite: false });
}

function createFragment(index) {
  const part = new Group();
  const angle = .275 + (random(index + 54) - .5) * .14;
  const speed = .9 + random(index + 81) * 3.9;
  const driftX = -Math.cos(angle) * speed;
  const driftY = -Math.sin(angle) * speed + (random(index + 37) - .5) * 1.4;
  const delay = random(index + 61) * .105;
  part.rotation.z = angle;

  const shape = new Shape();
  [[-.15, -.025], [-.06, .1], [.08, .075], [.13, -.025], [.01, -.1]].forEach(([x, y], point) => {
    const variation = .8 + random(index * 9 + point) * .4;
    if (point === 0) shape.moveTo(x * variation, y * variation);
    else shape.lineTo(x * variation, y * variation);
  });
  shape.closePath();
  const body = new Mesh(new ShapeGeometry(shape), pigment(['#ffe184', '#ffab55', '#f87842'][index % 3]));
  body.position.z = .07;
  body.renderOrder = 9;
  body.scale.setScalar((index < 7 ? .43 : .17) + random(index + 28) * .16);
  body.material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec2 vEmber;\n' + shader.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEmber = position.xy;');
    shader.fragmentShader = 'varying vec2 vEmber;\n' + shader.fragmentShader.replace(
      '#include <opaque_fragment>', /* glsl */ `
        vec2 grainCell = floor(vEmber * 210.);
        float grain = fract(sin(dot(grainCell, vec2(41.7, 73.1))) * 43758.54);
        float brushEdge = length(vEmber / vec2(.162, .107));
        float feather = 1. - smoothstep(.46, 1.05, brushEdge + grain * .13);
        outgoingLight *= .76 + grain * .24;
        diffuseColor.a *= feather;
        #include <opaque_fragment>
      `,
    );
  };
  const glow = makeGlow();
  glow.scale.setScalar(.74);
  glow.position.z = .055;
  glow.renderOrder = 7;
  part.add(body, glow);

  function sample(flight, point) {
    const phase = phaseAt(flight);
    const travel = fade(.335 + delay, .94, phase);
    point.x = driftX * travel;
    point.y = driftY * travel;
    point.brightness = fade(.335 + delay, .385 + delay, phase) *
      (.82 + .18 * Math.sin(flight * 16 + index * 2.1));
  }

  return {
    part, body, glow,
    track: {
      sample,
      width: index < 7 ? .079 : .036,
      heat: index < 7 ? .67 : .44,
      lifetime: .12 + random(index + 18) * .13,
    },
  };
}

export function createPaintedFireball() {
  const group = new Group();
  group.name = 'painted-fireball';

  const shape = new Shape();
  shape.moveTo(-.22, -.025);
  shape.bezierCurveTo(-.17, -.16, .12, -.16, .21, .025);
  shape.bezierCurveTo(.1, .15, -.1, .14, -.22, -.025);
  const body = new Mesh(new ShapeGeometry(shape), pigment('#fff1c7'));
  body.rotation.z = .275;
  body.position.z = .08;
  body.renderOrder = 5;
  const glow = makeGlow();
  glow.position.set(-.02, 0, .065);
  glow.renderOrder = 4;
  group.add(body, glow);

  const cracks = new Group();
  for (const line of [
    [[-.13, .09], [.01, .015], [-.02, -.11]],
    [[.01, .015], [.14, .08]],
    [[.01, .015], [.14, -.07]],
  ]) {
    const geometry = new BufferGeometry().setFromPoints(line.map(([x, y]) => new Vector3(x, y, .095)));
    const crack = new Line(geometry, new LineBasicMaterial({
      color: '#946c76', transparent: true, opacity: 0, depthWrite: false,
    }));
    crack.renderOrder = 8;
    cracks.add(crack);
  }
  group.add(cracks);

  const fragments = new Group();
  fragments.name = 'fireball-fragments';
  const pieces = Array.from({ length: fragmentCount }, (_, index) => createFragment(index));
  for (const piece of pieces) fragments.add(piece.part);
  group.add(fragments);

  const flash = makeGlow();
  flash.position.z = .12;
  flash.renderOrder = 10;
  const rays = [];
  for (let index = 0; index < 12; index++) {
    const angle = index / 12 * Math.PI * 2;
    const length = .48 + random(index + 72) * .55;
    rays.push(Math.cos(angle) * .15, Math.sin(angle) * .1, .1,
      Math.cos(angle) * length, Math.sin(angle) * length * .65, .1);
  }
  const rayGeometry = new BufferGeometry();
  rayGeometry.setAttribute('position', new Float32BufferAttribute(rays, 3));
  const flashRays = new LineSegments(rayGeometry, new LineBasicMaterial({
    color: '#fff0bd', transparent: true, opacity: 0, depthWrite: false,
  }));
  flashRays.renderOrder = 11;
  group.add(flash, flashRays);

  const mainTrail = {
    width: .27,
    heat: 1,
    lifetime: .35,
    sample(flight, point) {
      const phase = phaseAt(flight);
      point.x = 0;
      point.y = 0;
      point.brightness = fade(0, .12, flight) * (1 - fade(.33, .43, phase));
    },
  };
  const wake = createFireballTrails([mainTrail, ...pieces.map(piece => piece.track)]);
  group.add(wake.mesh);

  const sample = { x: 0, y: 0, brightness: 0 };
  function update(flight, bodyOpacity, trailOpacity, motion) {
    const phase = phaseAt(flight);
    const intact = 1 - fade(.34, .405, phase);
    const flare = Math.sin(Math.PI * fade(.34, .46, phase)) ** 2;
    const crackStrength = fade(.27, .34, phase) * (1 - fade(.36, .41, phase));
    group.userData.phase = phase < .27 ? 'intact' : phase < .34 ? 'cracking' :
      phase < .46 ? 'breaking' : 'fragments';
    body.visible = intact > .001;
    body.material.opacity = intact * bodyOpacity;
    body.scale.setScalar((1 + Math.sin(flight * 6) * .035) * (1 + flare * .32));
    glow.material.uniforms.strength.value = (intact + flare * .78) * bodyOpacity;
    glow.scale.setScalar(1 + flare * 1.6);
    cracks.visible = crackStrength > .001;
    for (const crack of cracks.children) crack.material.opacity = crackStrength * .9 * bodyOpacity;

    fragments.visible = phase > .335 && bodyOpacity > 0;
    if (fragments.visible) {
      pieces.forEach(({ part, body, glow, track }, index) => {
        track.sample(flight, sample);
        const brightness = sample.brightness * bodyOpacity;
        part.position.set(sample.x, sample.y, .02 + index % 3 * .012);
        body.material.opacity = brightness;
        glow.material.uniforms.strength.value = brightness * (index < 7 ? .85 : .38);
      });
    }
    flash.visible = flashRays.visible = flare > .001;
    flash.material.uniforms.strength.value = flare * 1.3 * bodyOpacity;
    flash.scale.setScalar(1.4 + flare * 1.3);
    flashRays.material.opacity = flare * .12 * bodyOpacity;
    flashRays.scale.setScalar(.65 + flare * .7);
    wake.update(flight, motion, trailOpacity);
  }

  return { group, update };
}
