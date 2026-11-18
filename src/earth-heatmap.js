import { Color, Mesh, PlaneGeometry, RepeatWrapping, ShaderMaterial, TextureLoader, Vector2 } from 'three';
import { clamp, ease, mix } from './motion.js';

const turbo = ['#30123b', '#4662d7', '#28bbeb', '#48f18b', '#a4fc3c', '#f4e435', '#fb9a27', '#df4220', '#a01101'];

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
// From a sphere the longitude arcs straighten into a cylindrical equal-area map.
export function createEarthHeatmap(baseMap) {
  const assets = `${import.meta.env.BASE_URL}visitors/`;
  const density = new TextureLoader().load(`${assets}meteorite-heatmap.png`, texture => {
    texture.wrapS = RepeatWrapping;
    texture.needsUpdate = true;
  });
  const uniforms = {
    baseMap: { value: baseMap }, density: { value: density },
    ocean: { value: new Color('#0c192b') }, land: { value: new Color('#30485e') },
    colors: { value: turbo.map(color => new Color(color)) },
    morph: { value: 0 }, heat: { value: 0 }, radius: { value: 1 },
    mapSize: { value: new Vector2(1, .5) },
  };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: `
      uniform float morph, radius;
      uniform vec2 mapSize;
      varying vec2 geo;
      varying vec3 normalOnGlobe;
      void main() {
        geo = uv;
        float lon = (uv.x - .5) * 6.2831853;
        float lat = (uv.y - .5) * 3.14159265;
        normalOnGlobe = vec3(cos(lat)*sin(lon), sin(lat), cos(lat)*cos(lon));
        float bend = 1. - morph;
        float arc = bend > .001 ? sin(lon*bend)/bend : lon;
        vec3 p = vec3(
          arc * mix(radius*cos(lat), mapSize.x/6.2831853, morph),
          sin(lat) * mix(radius, mapSize.y*.5, morph),
          radius*cos(lat)*cos(lon*bend)*bend
        );
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
      }
    `,
    fragmentShader: `
      uniform sampler2D baseMap, density;
      uniform vec3 ocean, land, colors[9];
      uniform float heat, morph;
      varying vec2 geo;
      varying vec3 normalOnGlobe;
      void main() {
        vec3 paper = texture2D(baseMap, geo).rgb;
        float light = dot(normalize(normalOnGlobe), normalize(vec3(-.45,.8,1.)));
        float shade = .48 + .32*smoothstep(-.35,.05,light) + .2*smoothstep(.4,.75,light);
        float coast = smoothstep(.005, .23, paper.r - paper.b);
        vec3 night = mix(ocean, land, coast);
        vec3 base = mix(mix(vec3(.07,.064,.105),paper,shade),night,heat);
        float value = texture2D(density, geo).r;
        float rank = value*8.;
        vec3 ink = colors[0];
        for (int i=0; i<8; i++) {
          ink = mix(ink, colors[i+1], clamp(rank-float(i),0.,1.));
        }
        // Globe.gl uses the cube root of normalized density as opacity.
        float alpha = pow(value, 1./3.) * smoothstep(0.,.10,value) * heat;
        gl_FragColor = vec4(mix(base, ink, alpha), 1.);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new Mesh(new PlaneGeometry(2, 1, 144, 72), material);
  mesh.name = 'Meteorite density unfold';
  mesh.visible = false;
  mesh.frustumCulled = false;

  function update(pose, camera, earth) {
    mesh.visible = pose.surface;
    if (!mesh.visible) return;
    const height = 2 * camera.position.z * Math.tan(camera.fov * Math.PI / 360);
    const width = Math.min(height * camera.aspect * .92, height * 1.26);
    mesh.position.y = mix(earth.position.y, height * .015, pose.morph);
    uniforms.radius.value = earth.scale.x;
    uniforms.mapSize.value.set(width, width / 2);
    uniforms.morph.value = clamp(pose.morph);
    uniforms.heat.value = pose.heat;
  }

  return { mesh, update };
}
