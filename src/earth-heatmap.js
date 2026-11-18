import { Color, Mesh, PlaneGeometry, RepeatWrapping, ShaderMaterial, TextureLoader } from 'three';
import { clamp, ease, mix } from './motion.js';
import { densityInk } from './earth-palette.js';

// Full projected spans at the equator and between the poles, for a unit sphere.
const equalEarthWidth = 5.41326;
const equalEarthHeight = 2.63473;

export const heatmapStart = 4.19;
export const heatmapEnd = 5.32;

export function heatmapPose(position) {
  return {
    turn: ease(heatmapStart, 4.55, position),
    morph: ease(4.61, 5.24, position),
    heat: ease(4.48, 4.92, position),
    surface: position >= 4.55,
  };
}

// A single surface carries the coastline and density through the unfold.
// The longitude arcs unfurl into the curved outline of the Equal Earth projection.
export function createEarthHeatmap(baseMap, geography) {
  const assets = `${import.meta.env.BASE_URL}visitors/`;
  const density = new TextureLoader().load(`${assets}meteorite-heatmap.png`, texture => {
    texture.wrapS = RepeatWrapping;
    texture.needsUpdate = true;
  });
  const paint = {
    baseMap: { value: baseMap }, geography, hasGeography: { value: false },
    oceanLit: { value: new Color('#689dac') }, oceanShade: { value: new Color('#57537e') },
    landLit: { value: new Color('#dfa9d2') }, landShade: { value: new Color('#7c729b') },
    coastInk: { value: new Color('#c7d7f0') }, outline: { value: new Color('#415c74') },
    oceanFlat: { value: new Color('#6c93a6') }, landFlat: { value: new Color('#a093b6') },
  };
  const uniforms = {
    ...paint, density: { value: density },
    colors: { value: densityInk.map(color => new Color(color)) },
    morph: { value: 0 }, heat: { value: 0 }, radius: { value: 1 },
    mapScale: { value: 1 },
  };
  const fragmentShader = `
    uniform sampler2D baseMap, geography;
    uniform bool hasGeography;
    uniform vec3 oceanLit, oceanShade, landLit, landShade, coastInk, outline, oceanFlat, landFlat;
    uniform float morph;
    varying vec2 geo;
    varying vec3 eyeNormal;
    #ifdef DENSITY
      uniform sampler2D density;
      uniform vec3 colors[9];
      uniform float heat;
    #endif
    void main() {
      // Solar's geography texture stores signed shore distance in red.
      vec3 surface = hasGeography ? texture2D(geography,vec2(geo.x,1.-geo.y)).rgb : vec3(0.);
      vec3 fallback = hasGeography ? vec3(0.) : texture2D(baseMap,geo).rgb;
      float land = hasGeography ? smoothstep(.48,.52,surface.r) : smoothstep(.005,.23,fallback.r-fallback.b);
      float coast = hasGeography ? (1.-smoothstep(.012,.054,abs(surface.r-.5))) : 0.;
      vec3 n = normalize(eyeNormal);
      float light = dot(n,normalize(vec3(-.86,-.36,.36)));
      float band = .24*smoothstep(-.88,.5,light)+.76*smoothstep(.01,.07,light);
      vec3 sea = mix(oceanShade,oceanLit,band);
      vec3 ground = mix(landShade,landLit,band);
      vec3 base = mix(mix(sea,oceanFlat,morph),mix(ground,landFlat,morph),land);
      base = mix(base,coastInk,coast*mix(.69,.42,morph));
      float rim = (1.-smoothstep(.01,.12,n.z))*(1.-morph);
      base = mix(base,outline,rim*.64);
      #ifdef DENSITY
        float value = texture2D(density,geo).r;
        float rank = value*8.;
        vec3 ink = colors[0];
        for (int i=0; i<8; i++) {
          ink = mix(ink,colors[i+1],clamp(rank-float(i),0.,1.));
        }
        // Keep the density texture and the globe.gl cube-root opacity curve.
        float alpha = pow(value,1./3.)*smoothstep(0.,.10,value)*heat;
        base = mix(base,ink,alpha);
        vec2 margin = min(geo,1.-geo)/max(fwidth(geo),vec2(.00001));
        float edge = 1.-smoothstep(.15,1.3,min(margin.x,margin.y));
        base = mix(base,outline,edge*smoothstep(.78,1.,morph)*.81);
      #endif
      gl_FragColor = vec4(base,1.);
      #include <colorspace_fragment>
    }
  `;
  const globeMaterial = new ShaderMaterial({
    uniforms: { ...paint, morph: { value: 0 } },
    fragmentShader,
    vertexShader: `
      varying vec2 geo;
      varying vec3 eyeNormal;
      void main() {
        geo = uv;
        eyeNormal = normalMatrix * normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
      }
    `,
  });
  const material = new ShaderMaterial({
    defines: { DENSITY: 1 },
    uniforms,
    fragmentShader,
    vertexShader: `
      uniform float morph, radius, mapScale;
      varying vec2 geo;
      varying vec3 eyeNormal;
      void main() {
        geo = uv;
        float lon = (uv.x - .5) * 6.2831853;
        float lat = (uv.y - .5) * 3.14159265;
        vec3 normalOnGlobe = vec3(cos(lat)*sin(lon), sin(lat), cos(lat)*cos(lon));
        eyeNormal = normalMatrix * normalOnGlobe;
        float bend = 1. - morph;
        float arc = bend > .001 ? sin(lon*bend)/bend : lon;
        // Equal Earth uses this polynomial for northing and its derivative for easting.
        const float m = .8660254038;
        const float a1 = 1.340264, a2 = -.081106, a3 = .000893, a4 = .003796;
        float theta = asin(m*sin(lat));
        float t2 = theta*theta;
        float t6 = t2*t2*t2;
        float northing = theta*(a1 + a2*t2 + t6*(a3 + a4*t2));
        float eastingPerRadian = cos(theta)/(m*(a1 + 3.*a2*t2 + t6*(7.*a3 + 9.*a4*t2)));
        vec3 p = vec3(
          arc * mix(radius*cos(lat), mapScale*eastingPerRadian, morph),
          mix(radius*sin(lat), mapScale*northing, morph),
          radius*cos(lat)*cos(lon*bend)*bend
        );
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
      }
    `,
  });
  const mesh = new Mesh(new PlaneGeometry(2, 1, 144, 72), material);
  mesh.name = 'Meteorite density unfold';
  mesh.visible = false;
  mesh.frustumCulled = false;

  function update(pose, camera, earth) {
    paint.hasGeography.value = Boolean(geography.value);
    mesh.visible = pose.surface;
    if (!mesh.visible) return;
    const height = 2 * camera.position.z * Math.tan(camera.fov * Math.PI / 360);
    mesh.position.y = mix(earth.position.y, height * .015, pose.morph);
    uniforms.radius.value = earth.scale.x;
    uniforms.mapScale.value = Math.min(height * camera.aspect * .92 / equalEarthWidth, height * .63 / equalEarthHeight);
    uniforms.morph.value = clamp(pose.morph);
    uniforms.heat.value = pose.heat;
  }

  return { globeMaterial, mesh, update };
}
