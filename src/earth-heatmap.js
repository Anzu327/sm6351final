import { assetBase } from './asset-base.js';
import { Color, Mesh, PlaneGeometry, RepeatWrapping, ShaderMaterial, TextureLoader } from 'three';
import { clamp, ease, mix } from './motion.js';
import { earthLatitudePaint, heatmapInk } from './earth-palette.js';
import { createContinentMap } from './continent-map.js';

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

export function heatmapToChartPose(progress) {
  return {
    turn: 1,
    morph: 1 - ease(.065, .43, progress),
    heat: 1 - .68 * ease(.24, .67, progress),
    surface: true,
    globeYaw: -Math.PI * .72 * ease(.43, .93, progress),
    globeTilt: -.16 * ease(.40, .60, progress),
  };
}

// A single surface carries the coastline and density through the unfold.
// The longitude arcs unfurl into the curved outline of the Equal Earth projection.
export function createEarthHeatmap(baseMap, geography) {
  const continentMap = createContinentMap();
  const assets = `${assetBase}visitors/`;
  const density = new TextureLoader().load(`${assets}meteorite-heatmap.png`, texture => {
    texture.wrapS = RepeatWrapping;
    texture.needsUpdate = true;
  });
  const paint = {
    baseMap: { value: baseMap }, geography, hasGeography: { value: false },
    coastInk: { value: new Color('#c7d7f0') }, outline: { value: new Color('#415c74') },
  };
  const uniforms = {
    ...paint, density: { value: density },
    colors: { value: heatmapInk.map(color => new Color(color)) },
    morph: { value: 0 }, heat: { value: 0 }, radius: { value: 1 },
    mapScale: { value: 1 },
  };
  const fragmentShader = `
    uniform sampler2D baseMap, geography;
    uniform bool hasGeography;
    uniform vec3 coastInk, outline;
    uniform float morph;
    varying vec2 geo;
    varying vec3 eyeNormal;
    #ifdef DENSITY
      uniform sampler2D density;
      uniform vec3 colors[9];
      uniform float heat;
    #endif
    ${earthLatitudePaint}
    void main() {
      // Solar's geography texture stores signed shore distance in red.
      vec3 surface = hasGeography ? texture2D(geography,vec2(geo.x,1.-geo.y)).rgb : vec3(0.);
      vec3 fallback = hasGeography ? vec3(0.) : texture2D(baseMap,geo).rgb;
      float land = hasGeography ? smoothstep(.48,.52,surface.r) : smoothstep(.005,.23,fallback.r-fallback.b);
      float coast = hasGeography ? (1.-smoothstep(.012,.054,abs(surface.r-.5))) : 0.;
      vec3 n = normalize(eyeNormal);
      // Keep the solar sea mesh's local height range through the map projection.
      float height = .84668*sin((geo.y-.5)*3.14159265);
      float light = dot(n,normalize(vec3(-.95,-.30,.08)));
      float illumination = mix(smoothstep(-.02,.04,light),.45,morph);
      vec3 sea = earthSeaPigment(height)*mix(vec3(.62,.61,.68),vec3(.79,.75,.86),illumination);
      vec3 ground = earthLandPigment(height)*mix(vec3(.73,.72,.80),vec3(.89,.84,.94),illumination);
      vec3 base = sRGBTransferEOTF(vec4(clamp(mix(sea,ground,land),0.,1.),1.)).rgb;
      base = mix(base,coastInk,coast*mix(.69,.42,morph));
      float rim = (1.-smoothstep(.01,.12,n.z))*(1.-morph);
      base = mix(base,outline,rim*.64);
      #ifdef DENSITY
        vec3 nightSea = mix(vec3(.027,.063,.114),vec3(.055,.113,.174),surface.b*.45);
        vec3 nightLand = mix(vec3(.066,.123,.191),vec3(.117,.191,.271),surface.r);
        vec3 night = mix(nightSea,nightLand,land);
        night = mix(night,vec3(.24,.35,.48),coast*.22);
        base = mix(base,sRGBTransferEOTF(vec4(night,1.)).rgb,heat);
        float value = texture2D(density,geo).r;
        float rank = value*8.;
        vec3 ink = colors[0];
        for (int i=0; i<8; i++) {
          ink = mix(ink,colors[i+1],clamp(rank-float(i),0.,1.));
        }
        // Fade the sparse blue halo into the base map and keep the cores saturated.
        float alpha = pow(smoothstep(0.,.50,value),.62)*heat;
        base = mix(base,ink,alpha);
        vec2 margin = min(geo,1.-geo)/max(fwidth(geo),vec2(.00001));
        float edge = 1.-smoothstep(.15,1.3,min(margin.x,margin.y));
        base = mix(base,outline,edge*smoothstep(.78,1.,morph)*.42);
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

  function update(pose, camera, earth, dt) {
    paint.hasGeography.value = Boolean(geography.value);
    mesh.visible = pose.surface;
    const worldScale = Math.min(camera.aspect * .92 / equalEarthWidth, .63 / equalEarthHeight);
    const frame = continentMap.update(pose.morph, camera.aspect, worldScale, dt);
    if (!mesh.visible) return;
    const height = 2 * camera.position.z * Math.tan(camera.fov * Math.PI / 360);
    mesh.position.x = mix(pose.globeYaw === undefined ? 0 : earth.position.x, height * frame.x, pose.morph);
    mesh.position.y = mix(earth.position.y, height * frame.y, pose.morph);
    mesh.rotation.set(0, pose.globeYaw ?? 0, pose.globeTilt ?? 0);
    uniforms.radius.value = earth.scale.x;
    uniforms.mapScale.value = height * frame.scale;
    uniforms.morph.value = clamp(pose.morph);
    uniforms.heat.value = pose.heat;
  }

  return { globeMaterial, mesh, update };
}
