import * as THREE from 'three';
import { accent, cobalt, ink, lightBlue, paper } from './palette.js';
import { specimenVertexShader, specimenFragmentShader, stoneInks } from '../public/sleep-well/meteorite/printed-material.js';

// Both meshes share the same inks, tonal bands and paper texture.
const uniforms = {
  shadowInk: { value: new THREE.Color(cobalt) },
  middleInk: { value: new THREE.Color('#617dc5') },
  lightInk: { value: new THREE.Color(paper) },
  outlineInk: { value: new THREE.Color(ink) },
};

const printInks = {
  stone: stoneInks,
  rings: [ink, accent, '#7293df', paper, '#101550'],
};

export function illustrate(material, wake = null, print = null, arcOrigin = null) {
  return new THREE.ShaderMaterial({
    defines: {
      ...(wake && { SURFACE_WAKE: 1 }),
      ...(print && { PRINT_INK: 1 }),
      ...(arcOrigin && { PENCIL_ARC: 1 }),
    },
    uniforms: {
      ...uniforms,
      surface: { value: material.map },
      ...(arcOrigin && { arcOrigin: { value: arcOrigin } }),
      ...(print && Object.fromEntries(
        ['shadowInk', 'middleInk', 'paintInk', 'lightInk', 'outlineInk'].map(
          (name, index) => [name, { value: new THREE.Color(printInks[print][index]) }],
        ),
      )),
      ...(wake ? {
        wake: wake.field,
        wakeFacets: { value: wake.facets },
        wakeCenter: { value: wake.center },
        wakePatternScale: wake.patternScale,
        wakeCream: { value: new THREE.Color('#fff0d4') },
        wakeBlue: { value: new THREE.Color(lightBlue) },
      } : {}),
    },
    side: THREE.FrontSide,
    vertexShader: specimenVertexShader,
    fragmentShader: specimenFragmentShader,
  });
}

export function createRingLight(print = false) {
  return new THREE.ShaderMaterial({
    defines: print ? { PRINT_INK: 1 } : {},
    uniforms: {
      glow: { value: 0 },
      time: { value: 0 },
      ink: { value: new THREE.Color(paper) },
      ...(print && { rimInk: { value: new THREE.Color(lightBlue) } }),
    },
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      varying vec2 paperUV;
      void main() {
        paperUV = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }
    `,
    fragmentShader: `
      uniform float glow, time;
      uniform vec3 ink;
      #ifdef PRINT_INK
        uniform vec3 rimInk;
      #endif
      varying vec2 paperUV;

      void main() {
        vec2 paper = (paperUV - .5) * 2.;
        float arc = atan(paper.y, paper.x);
        float r = length(paper);
        float uneven = sin(arc * 13. + time * .9) * .008 + cos(arc * 29.) * .004;
        float distanceToInk = abs(r - .703 + uneven);
        float halo = exp(-distanceToInk * 22.) * .51 + exp(-distanceToInk * 69.) * .48;
        vec2 lattice = paper * 17. + vec2(sin(paper.y * 13. + time * .3), cos(paper.x * 17.)) * .3;
        vec3 pencil = abs(fract(vec3(lattice.x, lattice.y, lattice.x + lattice.y)) - .5);
        float thread = 1. - smoothstep(.014, .045, min(pencil.x, min(pencil.y, pencil.z)));
        float innerRim = smoothstep(.36, .68, r) * (1. - smoothstep(.68, .73, r));
        float grain = fract(sin(dot(floor(gl_FragCoord.xy), vec2(33.19, 12.92))) * 31473.712);
        float alpha = (halo + thread * innerRim * .24) * (.75 + grain * .25) * glow;
        vec3 color = ink;
        #ifdef PRINT_INK
          float rim = exp(-abs(r - .721 + uneven) * 145.);
          float current = .5 + .5 * sin(arc * 3. - time * 1.4);
          color = mix(ink, rimInk, smoothstep(.69,.725,r) * .85);
          alpha = (halo * .48 + rim * (.38 + current * .30)
                 + thread * innerRim * .20) * (.63 + grain * .37) * glow;
        #endif
        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
      }
    `,
  });
}
