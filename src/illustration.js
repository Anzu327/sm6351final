import * as THREE from 'three';

// Both meshes share the same inks, tonal bands and paper texture.
const uniforms = {
  shadowInk: { value: new THREE.Color('#4e4c69') },
  middleInk: { value: new THREE.Color('#8b8291') },
  lightInk: { value: new THREE.Color('#e4c5a6') },
  outlineInk: { value: new THREE.Color('#3c425b') },
};

export function illustrate(material, wake = null) {
  return new THREE.ShaderMaterial({
    defines: wake ? { SURFACE_WAKE: 1 } : {},
    uniforms: {
      ...uniforms,
      surface: { value: material.map },
      ...(wake ? {
        wake: wake.field,
        wakeFacets: { value: wake.facets },
        wakeCenter: { value: wake.center },
        wakePatternScale: wake.patternScale,
        wakeCream: { value: new THREE.Color('#fff0d4') },
        wakeLilac: { value: new THREE.Color('#ebd5f5') },
      } : {}),
    },
    side: THREE.FrontSide,
    vertexShader: `
      varying vec3 normalInView;
      varying vec3 eye;
      varying vec3 modelPoint;
      varying vec2 surfaceUV;
      void main() {
        vec4 point = modelViewMatrix * vec4(position, 1.);
        normalInView = normalize(normalMatrix * normal);
        eye = -point.xyz;
        modelPoint = position;
        surfaceUV = uv;
        gl_Position = projectionMatrix * point;
      }
    `,
    fragmentShader: `
      uniform vec3 shadowInk, middleInk, lightInk, outlineInk;
      uniform sampler2D surface;
      #ifdef SURFACE_WAKE
        uniform sampler2D wake, wakeFacets;
        uniform vec3 wakeCenter, wakeCream, wakeLilac;
        uniform float wakePatternScale;
      #endif
      varying vec3 normalInView, eye, modelPoint;
      varying vec2 surfaceUV;

      float inkNoise(vec3 p) {
        p = fract(p * .1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }

      void main() {
        vec3 n = normalize(normalInView);
        float mapTone = dot(texture2D(surface, surfaceUV).rgb, vec3(.30,.59,.11));
        float pencil = inkNoise(floor(modelPoint * 455.));
        float flecks = inkNoise(floor(modelPoint * 172.));
        float diffuse = dot(n, normalize(vec3(-.56,.62,.63))) * .5 + .5;
        diffuse += (mapTone - .25) * .23 + (flecks - .5) * .058;
        vec3 color = mix(shadowInk, middleInk, smoothstep(.28,.53,diffuse));
        color = mix(color, lightInk, smoothstep(.58,.88,diffuse));
        float contour = 1. - smoothstep(.05,.25,abs(dot(n, normalize(eye))));
        color = mix(color, outlineInk, contour * .85);
        float hatching = sin(dot(modelPoint, vec3(115.,215.,87.)) + flecks * 1.7) * .5 + .5;
        float shaded = 1. - smoothstep(.34,.64,diffuse);
        color *= 1. - smoothstep(.65,.94,hatching) * .14 * shaded;
        color *= .91 + pencil * .18;
        #ifdef SURFACE_WAKE
          vec3 surfacePoint = normalize(modelPoint - wakeCenter);
          vec2 wakeUV = vec2(atan(surfacePoint.z,surfacePoint.x) * .15915494 + .5,
                            asin(clamp(surfacePoint.y,-1.,1.)) * .31830989 + .5);
          vec2 trace = texture2D(wake, wakeUV).rg;
          float rim = max(trace.g, 0.);
          float facets = texture2D(wakeFacets, surfaceUV * wakePatternScale).r;
          float veil = smoothstep(.035,.85,trace.r);
          float glint = smoothstep(.025,.55,rim);
          vec3 sheen = mix(wakeLilac, wakeCream, smoothstep(.31,.78,diffuse + .13 * glint));
          float opacity = veil * (.31 + .10 * pencil) + glint * (.40 + .22 * facets);
          color = mix(color, max(color, sheen), clamp(opacity, 0., .86));
        #endif
        gl_FragColor = vec4(color, 1.);
        #include <colorspace_fragment>
      }
    `,
  });
}

export function createRingLight() {
  return new THREE.ShaderMaterial({
    uniforms: {
      glow: { value: 0 },
      time: { value: 0 },
      ink: { value: new THREE.Color('#ffe1ad') },
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
        gl_FragColor = vec4(ink, alpha);
        #include <colorspace_fragment>
      }
    `,
  });
}
