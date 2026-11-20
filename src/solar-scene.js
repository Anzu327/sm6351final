import { assetBase } from './asset-base.js';
import { cobalt, lightBlue, paper } from './palette.js';
import {
  BackSide, Color, CylinderGeometry, DoubleSide, Euler,
  Group, IcosahedronGeometry, LinearFilter, Mesh, MeshBasicMaterial,
  PlaneGeometry, Quaternion, RepeatWrapping, RingGeometry, ShaderMaterial,
  SphereGeometry, SRGBColorSpace, TextureLoader, Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clamp, ease, earthArrivalPose, powerInOut } from './motion.js';
import { makeSolarBelt, makeSolarComet, makeSolarParticles } from './solar-atmosphere.js';
import { earthLatitudePaint } from './earth-palette.js';
import { createSolarMeteorShowers } from './meteor-arrivals.js';

const radians = Math.PI / 180;
const orientation = (x, y, z) => new Quaternion().setFromEuler(
  new Euler(x * radians, y * radians, z * radians),
);

const noise = `
  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(19.2,73.1,41.7))) * 43758.54);
  }
  float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f*f*(3.-2.*f);
    return mix(
      mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),
          mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
      mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
          mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
`;

const deformVertex = `
  uniform float time, distortion;
  ${noise}
  vec3 deform(vec3 point) {
    float displacement = noise(point*.5+time*.1)*2.-1.;
    return point*(1.+displacement*distortion*distortion);
  }
`;

const bodyVertex = `
  ${deformVertex}
  varying vec3 surface, eyeNormal, eyePosition;
  varying vec2 texCoord;
  void main() {
    surface = position;
    texCoord = uv;
    eyeNormal = normalMatrix * normal;
    vec4 view = modelViewMatrix * vec4(deform(position),1.);
    eyePosition = view.xyz;
    gl_Position = projectionMatrix * view;
  }
`;

const earthGeography = `
  // Match the atlas: +Y is north, +X is Greenwich, and east points toward -Z.
  vec2 earthUV(vec3 point) {
    vec3 direction = normalize(point);
    return vec2(atan(-direction.z,direction.x)/6.2831853+.5,
      acos(clamp(direction.y,-1.,1.))/3.14159265);
  }
`;

function makeSolarMaterial(ink, {
  map = null, kind = 'albedo', geography = null, waterNormal = null, base = ink,
  clock, distortion = .2,
}) {
  return new ShaderMaterial({
    uniforms: {
      albedo: { value: map },
      geography: { value: geography },
      normalMap: { value: waterNormal },
      base: { value: new Color(base) },
      hasMap: { value: Boolean(map) },
      kind: { value: ['albedo', 'sun', 'land', 'sea'].indexOf(kind) },
      distortion: { value: distortion },
      time: clock,
    },
    vertexShader: bodyVertex,
    fragmentShader: `
      varying vec3 surface, eyeNormal, eyePosition;
      varying vec2 texCoord;
      uniform vec3 base;
      uniform float time;
      uniform sampler2D albedo, geography, normalMap;
      uniform bool hasMap;
      uniform int kind;
      ${earthGeography}
      ${earthLatitudePaint}

      vec3 waterBump(vec3 eye, vec3 normal, vec2 uv) {
        vec3 dx = dFdx(eye), dy = dFdy(eye);
        vec2 du = dFdx(uv), dv = dFdy(uv);
        vec3 tangent = normalize(dx*dv.y-dy*du.y);
        vec3 bitangent = normalize(dy*du.x-dx*dv.x);
        vec3 bump = texture2D(normalMap,uv).rgb*2.-1.;
        bump.xy *= 4.;
        return normalize(mat3(tangent,bitangent,normal)*bump);
      }

      // DeferredColorCorrect raises HSV saturation by .1. Preserve the
      // original hue and value while applying the same saturation increase.
      vec3 colorCorrect(vec3 color) {
        float value = max(max(color.r,color.g),color.b);
        float chroma = value-min(min(color.r,color.g),color.b);
        float saturation = chroma/max(value,.0001);
        return value-(value-color)*min(1.,saturation+.1)/max(saturation,.0001);
      }

      void main() {
        vec3 normal = normalize(eyeNormal);
        vec3 viewRay = normalize(eyePosition);
        // Monolith's color modules operate on the sRGB-authored paint.
        // Convert back to linear after shading for the VISITORS compositor.
        vec3 linearPaint = hasMap ? texture2D(albedo,texCoord).rgb : base;
        vec3 color = sRGBTransferOETF(vec4(linearPaint,1.)).rgb;
        if (kind == 1) {
          float fresnel = 1.-max(0.,dot(normal,-viewRay));
          color = mix(color,vec3(1.,.698,.525),fresnel*fresnel);
        } else if (kind == 2) {
          float coast = texture2D(geography,earthUV(surface)).r;
          if (coast < .5) discard;
          float shade = mix(.48,.534,smoothstep(.5,.62,coast));
          color = shade*earthLandPigment(surface.y)*1.4;
        } else if (kind == 3) {
          vec2 uv = texCoord;
          vec3 bump = (waterBump(-viewRay,normal,uv*2.+time*.01)
            +waterBump(viewRay,normal,uv*1.5-time*.005))*.5;
          vec3 waterDirection = (bump+normal)*.5;
          float rippleOffset = abs(dot(waterDirection,reflect(viewRay,waterDirection)))*.05;
          // Red is signed shore distance, green drives waves, blue is shelf shading.
          vec3 coast = texture2D(geography,earthUV(surface)).rgb;
          float land = coast.g;
          float ripple = fract(land*.5-time*.2);
          ripple *= smoothstep(0.,.5,ripple)*(1.-smoothstep(.95,1.,ripple))*smoothstep(0.,1.,land);
          float depth = floor(coast.b*5.+.5)/5.;
          color = earthSeaPigment(surface.y);
          color = mix(color,color*mix(1.,depth,.7)+ripple+rippleOffset,.5);
        }

        // SceneSolar's point light at the Sun, with two quantized bands.
        vec3 towardSun = viewMatrix[3].xyz-eyePosition;
        float distanceToSun = length(towardSun);
        float range = clamp(1.-pow(distanceToSun/300.,4.),0.,1.);
        float attenuation = range*range/max(pow(max(.01,distanceToSun),.0001),.01);
        float diffuse = (.5+.5*max(dot(normal,normalize(towardSun)),0.))*attenuation;
        color *= 1.+.5*(floor(diffuse*2.)/2.);
        color = colorCorrect(clamp(color,0.,1.));
        gl_FragColor = sRGBTransferEOTF(vec4(clamp(color,0.,1.),1.));
        #include <colorspace_fragment>
      }
    `,
  });
}

function makeOutlinedMesh(geometry, ink, options) {
  const outline = new ShaderMaterial({
    side: BackSide,
    uniforms: {
      ink: { value: new Color(ink) },
      time: options.clock,
      distortion: { value: options.distortion ?? .2 },
      clipToLand: { value: options.kind === 'land' },
      geography: { value: options.geography ?? null },
    },
    vertexShader: `
      ${deformVertex}
      varying vec3 surface;
      void main(){
        surface = position;
        float rough = sin(151.*position.x+74.*position.y+36.*position.z);
        gl_Position = projectionMatrix*modelViewMatrix*vec4(deform(position)+normal*(.005+rough*.002),1.);
      }
    `,
    fragmentShader: `
      uniform vec3 ink;
      uniform bool clipToLand;
      uniform sampler2D geography;
      varying vec3 surface;
      ${earthGeography}
      ${noise}
      void main(){
        if (clipToLand && texture2D(geography,earthUV(surface)).r < .5) discard;
        gl_FragColor = vec4(ink*(.58+.54*hash(vec3(gl_FragCoord.xy,1.))),1.);
        #include <colorspace_fragment>
      }
    `,
  });
  const group = new Group();
  group.add(new Mesh(geometry, makeSolarMaterial(ink, options)), new Mesh(geometry, outline));
  return group;
}

function makeGasRing(radius, clock, { nearEarth = false } = {}) {
  const geometry = new CylinderGeometry(radius, radius, .26, 256, 1, true, 10*radians, 340*radians);
  const ring = new Mesh(geometry, new ShaderMaterial({
    side: DoubleSide,
    transparent: true,
    uniforms: {
      noiseMap: { value: null },
      time: clock,
      ready: { value: false },
      light: { value: new Color(nearEarth ? lightBlue : paper) },
      shadow: { value: new Color(nearEarth ? '#658bdf' : '#7493d5') },
      ink: { value: new Color('#314ca1') },
    },
    vertexShader: `
      varying vec2 track;
      void main() {
        track = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
      }
    `,
    fragmentShader: `
      uniform sampler2D noiseMap;
      uniform bool ready;
      uniform float time;
      uniform vec3 light, shadow, ink;
      varying vec2 track;
      ${noise}

      vec3 readNoise(vec2 coord) {
        return ready ? texture2D(noiseMap,coord).rgb : vec3(noise(vec3(coord,1.)));
      }

      void main() {
        // GasLineMaterial combines two scrolling noise samples and draws a
        // round-ended strip on the side of the open cylinder.
        vec2 coord = track*vec2(5.,.01);
        float a = readNoise(coord*1.1-time*.01).r;
        float b = readNoise(coord*-.2).r;
        float k = clamp(.5+(b-a),0.,1.);
        float flow = mix(b,a,k)-.5*k*(1.-k);
        vec3 sketch = readNoise(coord+vec2(0.,2.*flow));
        float width = .75+flow*.1-abs(sin(track.x))*.1;
        float amplitude = sketch.r*.2;
        float bend = sin(track.x*4.*flow);
        float low = 1.-width+bend*amplitude;
        float high = width-(bend+.25)*amplitude;
        float roundRadius = max((high-low)*.5,.02);
        vec2 capA = vec2(roundRadius*2.,.5);
        vec2 capB = vec2(1.-roundRadius*2.,.5);
        vec2 capAxis = capB-capA;
        float capProgress = clamp(dot(track-capA,capAxis)/max(dot(capAxis,capAxis),.0001),0.,1.);
        float cap = roundRadius-length(track-capA-capProgress*capAxis);
        float edge = min(cap,min(track.y-low,high-track.y));
        float fleck = hash(vec3(gl_FragCoord.xy,1.));
        float roughEdge = edge-(fleck-.5)*.034;
        float alpha = smoothstep(-.005,.018,roughEdge);
        if (alpha < .10) discard;
        vec3 paint = gl_FrontFacing ? light : shadow;
        vec3 color = mix(ink,paint,smoothstep(.005,.039,roughEdge));
        gl_FragColor = vec4(color,alpha);
        #include <colorspace_fragment>
      }
    `,
  }));
  ring.rotation.y = Math.PI / 2;
  return ring;
}

function makeSunGlow() {
  return new Mesh(new PlaneGeometry(2.7, 2.7), new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { glow: { value: null }, time: { value: 0 } },
    vertexShader: `
      varying vec2 coord;
      void main() {coord=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
    `,
    fragmentShader: `
      uniform sampler2D glow;
      uniform float time;
      varying vec2 coord;
      void main() {
        float mask=texture2D(glow,coord).r;
        float pulse=fract(mask*4.+time*.1);
        pulse*=smoothstep(0.,.1,pulse)*(1.-smoothstep(.2,1.,pulse));
        gl_FragColor=vec4(1.,.49,.31,mask*pulse*.57);
        #include <colorspace_fragment>
      }
    `,
  }));
}

const visualFiles = [
  'sun', 'venus', 'mercury', 'mars', 'jupiter', 'saturn', 'outer-planet',
  'earth-geography', 'earth-clouds',
  'asteroids', 'orbit-noise', 'solar-glow', 'comet-noise', 'ember', 'earth-flare', 'earth-water-normal',
];

const solarAssets = assetBase + 'visitors/solar/';

async function loadSolarArt() {
  const textures = new TextureLoader();
  const [model, maps] = await Promise.all([
    new GLTFLoader().loadAsync(solarAssets + 'solar-geometry.glb'),
    Promise.all(visualFiles.map(async name => {
      const texture = await textures.loadAsync(solarAssets + name + '.webp');
      texture.flipY = false;
      const isNoise = name.endsWith('-noise') || name === 'earth-water-normal';
      const isGeography = name === 'earth-geography';
      const data = isGeography || isNoise || name === 'solar-glow';
      if (!data) texture.colorSpace = SRGBColorSpace;
      if (isNoise) texture.wrapS = texture.wrapT = RepeatWrapping;
      if (isGeography) {
        texture.wrapS = RepeatWrapping;
        // Sample the same coastline on both sides of the longitude seam.
        texture.generateMipmaps = false;
        texture.minFilter = LinearFilter;
      }
      return [name, texture];
    })),
  ]);
  const meshes = new Map();
  model.scene.traverse(object => { if (object.isMesh) meshes.set(object.name, object.geometry); });
  return { meshes, maps: new Map(maps) };
}

export function createSolarScene(scene, camera) {
  scene.background = new Color(cobalt);
  const earthGeographyMap = { value: null };
  camera.fov = 30;
  camera.near = .1;
  camera.far = 150;
  camera.updateProjectionMatrix();

  const clock = { value: 0 };
  const stars = makeSolarParticles();
  const placeholder = new SphereGeometry(.852, 40, 32);
  const sun = new Group();
  const ember = makeSolarParticles({ sun: true });
  ember.visible = false;
  const glow = makeSunGlow();
  glow.visible = false;
  const comet = makeSolarComet();
  const earthFlare = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({
    color: '#ffedc0',
    alphaTest: .5,
    depthWrite: false,
  }));
  earthFlare.visible = false;
  const belt = new Group();
  const nearEarth = makeGasRing(4.05, clock, { nearEarth: true });
  nearEarth.position.x = -1.45;
  nearEarth.scale.x = .62;
  nearEarth.rotation.z = -.12;
  nearEarth.visible = false;
  scene.add(stars, sun, ember, glow, comet, earthFlare, belt, nearEarth);

  const planets = [
    ['VENUS', 'venus', 2.2, .14, '#eface9', 11494018, -.26, .010],
    ['EARTH', null, 4.5, .35, '#79c1cb', 4022647, -.38, -.024],
    ['MARS', 'mars', 5.85, .075, '#86e6f6', 1997207, -1.2, .013],
    ['JUPITER', 'jupiter', 6.75, .45, '#d576c7', 5331867, 2.02, .004],
    ['SATURN', 'saturn', 8.7, .37, '#e65e9b', 3354696, 1.28, -.003],
    ['', 'mercury', 8.4, .28, '#76d7f0', 2789041, -.53, .004],
    ['', 'outer-planet', 8.2, .16, '#8f9fe8', 6129115, 3.45, .006],
  ].map(([name, texture, radius, size, base, ink, phase, speed]) => {
    const body = new Group();
    body.scale.setScalar(size / .852);
    scene.add(body);
    return { name, texture, radius, size, base, ink, phase, speed, body };
  });
  const saturnRing = new Mesh(new RingGeometry(1.20, 1.40, 64),
    new MeshBasicMaterial({ color: 15385253, side: DoubleSide }));
  saturnRing.rotation.set(.95, -.24, 0);
  planets[4].body.add(saturnRing);
  const earth = planets[1];
  // Just above the detailed globe's raised coastline in globe-local units.
  const meteorShowers = createSolarMeteorShowers(.876);

  const gasRings = [5.85, 8.4, 11.7].map(radius => makeGasRing(radius, clock));
  scene.add(...gasRings);
  function setBodies(meshes, maps) {
    const sphere = meshes?.get('BaseModel') ?? placeholder;
    sun.clear().add(makeOutlinedMesh(sphere, 10113060, { map: maps?.get('sun'), kind: 'sun', base: '#fb6170', clock }));
    for (const planet of planets) {
      if (planet.name === 'SATURN') planet.body.clear().add(saturnRing);
      else planet.body.clear();
      if (planet === earth) planet.body.add(meteorShowers.points);
      if (planet.texture || !meshes) {
        planet.body.add(makeOutlinedMesh(sphere, planet.ink, { base: planet.base, map: maps?.get(planet.texture), clock }));
        continue;
      }
      const seaSphere = meshes.get('cubeSea');
      const geography = maps.get('earth-geography');
      const water = makeOutlinedMesh(seaSphere, planet.ink, {
        kind: 'sea', geography,
        waterNormal: maps.get('earth-water-normal'), clock, distortion: 0,
      });
      const continent = makeOutlinedMesh(seaSphere, planet.ink, {
        kind: 'land', geography, clock, distortion: 0,
      });
      continent.scale.setScalar(1.015);
      const cloud = makeOutlinedMesh(meshes.get('Retopo_Cube007'), planet.ink, {
        map: maps.get('earth-clouds'), clock, distortion: .4,
      });
      cloud.rotation.set(-1.031, -.232, -1.073);
      cloud.scale.setScalar(1.05);
      planet.body.add(water, continent, cloud);
    }
  }
  setBodies();
  const placeholderRock = new IcosahedronGeometry(.50, 0);
  let rocks = makeSolarBelt([placeholderRock, placeholderRock, placeholderRock], null);
  belt.add(rocks.group);
  loadSolarArt().then(({ meshes, maps }) => {
    if (!['BaseModel', 'Retopo_Cube007', 'cubeSea', 'rock006', 'rock010', 'rock003']
      .every(name => meshes.has(name))) throw new Error('Missing mesh in the solar geometry pack');
    for (const body of [sun, ...planets.map(planet => planet.body)]) {
      body.traverse(object => {
        if (object.isMesh && object !== saturnRing) object.material.dispose();
      });
    }
    setBodies(meshes, maps);
    earthGeographyMap.value = maps.get('earth-geography');
    placeholder.dispose();
    rocks.dispose();
    placeholderRock.dispose();
    rocks = makeSolarBelt(['rock006', 'rock010', 'rock003'].map(name => meshes.get(name)), maps.get('asteroids'));
    belt.clear().add(rocks.group);
    comet.material.uniforms.noiseMap.value = maps.get('comet-noise');
    comet.visible = true;
    ember.material.uniforms.emberMask.value = maps.get('ember');
    ember.visible = true;
    earthFlare.material.map = maps.get('earth-flare');
    earthFlare.visible = true;
    glow.material.uniforms.glow.value = maps.get('solar-glow');
    glow.visible = true;
    for (const gasRing of [...gasRings, nearEarth]) {
      gasRing.material.uniforms.noiseMap.value = maps.get('orbit-noise');
      gasRing.material.uniforms.ready.value = true;
    }
  }).catch(error => console.error('Solar artwork failed to load', error));

  // Keep the Sun-to-Earth flight, then orbit into a centered, full-frame Earth.
  const openingPosition = new Vector3(0, 1.65, 16);
  const arrivalOffset = new Vector3(3, 1.1, 1.86);
  const openingRotation = orientation(-6, -.5, -13);
  const arrivalRotation = orientation(-28, 55, 0);
  const hover = new Euler(0, 0, 0, 'YXZ');
  const orbitAngles = new Euler(0, 0, 0, 'YXZ');
  const orbitFrame = new Quaternion();
  const orbitTarget = new Quaternion();
  const hoverFrame = new Quaternion();
  const hoverPose = new Quaternion();
  const shotRotation = new Quaternion();
  const basePosition = new Vector3();
  const hoverPosition = new Vector3();
  let exploration = 0;
  const oldRotation = new Quaternion();
  const arrivalPosition = new Vector3();
  const arrivalDirection = arrivalOffset.clone().normalize();
  const closeDirection = new Vector3();
  const frontDirection = new Vector3(0, 0, 1);
  const earthTarget = new Vector3();
  const earthView = new Vector3();
  const flareOffset = new Vector3();

  function update({ p, time, mobile, yaw, pitch, step, dt, paused, pointer, orbit }) {
    clock.value = time;
    sun.rotation.y = time * .10;
    const viewportScale = Math.min(devicePixelRatio, 1.6) * (innerHeight / 900);
    stars.material.uniforms.time.value = time;
    stars.material.uniforms.viewportScale.value = viewportScale;
    ember.material.uniforms.time.value = time;
    ember.material.uniforms.viewportScale.value = viewportScale;
    rocks.update(time);
    const travel = clamp((time % 22) / 20);
    const traverse = 1 - (1 - travel) ** 2;
    comet.position.set(-13 + 30 * traverse, 15 - 30 * traverse, -15);
    comet.material.uniforms.time.value = Math.floor(time * 12) / 12;
    nearEarth.visible = step === 3;

    for (const planet of planets) {
      const angle = planet.phase + time * planet.speed;
      const height = planet.texture === 'mercury' ? .42 : 0;
      planet.body.position.set(Math.cos(angle) * planet.radius, height, Math.sin(angle) * planet.radius);
      planet.body.rotation.set(.12, time * .10 + planet.phase, -.21);
    }

    // Map Monolith's 1 → 3.75 → 4.5 scroll beats onto this chapter's portal
    // reveal and atlas handoff. The scene stays fully scrub-able in reverse.
    exploration += (Number(orbit.active) - exploration) * (1 - Math.exp(-dt / .115));
    const storyWeight = 1 - exploration;
    const flight = powerInOut(clamp((p - 2.55) / (3.34 - 2.55)), 3) * storyWeight;
    const arrival = earthArrivalPose(p, camera.aspect);
    const center = arrival.center * storyWeight;
    const approach = arrival.approach * storyWeight;
    earthTarget.copy(earth.body.position);
    arrivalPosition.copy(arrivalOffset).add(earthTarget);
    const hoverEase = 1 - Math.exp(-dt / .25);
    const ambient = !mobile && !paused && !orbit.dragging;
    hover.x += ((ambient ? pointer.y * .05 : 0) - hover.x) * hoverEase;
    hover.y += ((ambient ? -pointer.x * .10 : 0) - hover.y) * hoverEase;
    hoverFrame.setFromEuler(hover);
    basePosition.copy(openingPosition);
    if (mobile) {
      // Keep Earth and its incoming trails inside the narrow overview.
      basePosition.x = earthTarget.x * .48;
      basePosition.z = Math.max(21.5, 11.1 / camera.aspect);
    }
    // Rotate the camera position and its pose together about the Sun. Blending
    // inside the orbit keeps the camera outside the scene during a wide reset.
    if (orbit.active) orbitTarget.setFromEuler(orbitAngles.set(orbit.pitch, orbit.yaw, 0));
    else orbitTarget.identity();
    const orbitDelay = orbit.dragging ? .045 : .15;
    orbitFrame.slerp(orbitTarget, 1 - Math.exp(-dt / orbitDelay));
    hoverFrame.premultiply(orbitFrame);
    hoverPosition.copy(basePosition).applyQuaternion(hoverFrame);
    hoverPose.copy(hoverFrame).multiply(openingRotation);
    camera.position.lerpVectors(hoverPosition, arrivalPosition, flight);
    shotRotation.slerpQuaternions(hoverPose, arrivalRotation, flight);

    // Stay outside the surface. The projected sphere exceeds the diagonal;
    // no background or second globe is exposed during the material handoff.
    const coverDistance = earth.size * Math.sqrt(1 + 1 / (Math.tan(15 * radians) * arrival.cover) ** 2);
    const distance = arrivalOffset.length() * (coverDistance / arrivalOffset.length()) ** approach;
    closeDirection.copy(arrivalDirection).lerp(frontDirection, center).normalize();
    arrivalPosition.copy(earthTarget).addScaledVector(closeDirection, distance);
    camera.position.lerp(arrivalPosition, center);
    camera.lookAt(earthTarget);
    oldRotation.copy(camera.quaternion);
    camera.quaternion.copy(shotRotation).slerp(oldRotation, center);

    earth.body.rotation.x += (.15 + pitch - earth.body.rotation.x) * center;
    earth.body.rotation.y += (-2.6 + yaw + arrival.turn - earth.body.rotation.y) * center;
    earth.body.rotation.z *= 1 - center;
    camera.updateMatrixWorld();

    const depth = -earthView.copy(earthTarget).applyMatrix4(camera.matrixWorldInverse).z;
    meteorShowers.update({
      time, mobile, pixelRatio: Math.min(devicePixelRatio, 1.6),
      projectedRadius: depth > camera.near ? earth.size * camera.projectionMatrix.elements[5] * innerHeight / (2 * depth) : 0,
      visibility: paused ? 0 : ease(2.30, 2.50, p) * (1 - ease(3.34, 3.62, p)),
    });

    // Monolith's LensFlare follows a two-second cycle sampled in 24 steps.
    const flarePhase = Math.floor((time % 2) * 12) / 12;
    const flareBeat = flarePhase < 1 ? flarePhase ** 3 : 1 - (2 - flarePhase) ** 3;
    const openingBeat = flarePhase < 1 ? flareBeat : 1 - flareBeat;
    const flareTurn = Math.PI * (flarePhase < 1 ? flareBeat : 1 + flareBeat);
    flareOffset.set(-earth.size * .5, -earth.size * .5, earth.size).applyQuaternion(camera.quaternion);
    earthFlare.position.copy(earthTarget).add(flareOffset);
    earthFlare.quaternion.copy(camera.quaternion);
    earthFlare.rotateZ(15 * radians + flareTurn);
    earthFlare.scale.setScalar(.2 * (1 + openingBeat));

    glow.quaternion.copy(camera.quaternion);
    glow.material.uniforms.time.value = time;
    scene.updateMatrixWorld();
  }

  return { planets: planets.filter(planet => planet.name), belt, update, earthGeographyMap };
}
