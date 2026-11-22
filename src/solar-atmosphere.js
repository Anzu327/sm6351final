import {
  AdditiveBlending, BufferGeometry, Color, DoubleSide, Euler, Float32BufferAttribute, Group,
  InstancedMesh, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, Points,
  NormalBlending, Quaternion, ShaderMaterial, Sphere, Vector3,
} from 'three';

const turn = Math.PI * 2;
const radians = Math.PI / 180;
const starPigment = '#b2c6f2';
const random = seed => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

function direction(seed, target) {
  const y = 2 * random(seed * 3) - 1;
  const angle = turn * random(seed * 3 + 1);
  const horizontal = Math.sqrt(1 - y * y);
  return target.set(horizontal * Math.cos(angle), y, horizontal * Math.sin(angle));
}

function solarParticleData(sun) {
  const count = sun ? 1024 : 4096;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 2);
  const vertex = new Vector3();
  for (let index = 0; index < count; index++) {
    direction(index + 31, vertex).multiplyScalar(sun ? 1 : 80).toArray(positions, index * 3);
    seeds.set([random(index + 103), random(index + 1307)], index * 2);
  }
  return { positions, seeds };
}

// SceneSolar's Stars and Sun use prewarmed sphere emitters. Star positions
// stay fixed between cycles; each particle tapers in and out over its own life.
export function makeSolarParticles({ sun = false } = {}) {
  const { positions, seeds } = solarParticleData(sun);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('seed', new Float32BufferAttribute(seeds, 2));
  geometry.boundingSphere = new Sphere(new Vector3(), sun ? 1.3 : 80);
  return new Points(geometry, new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: sun ? AdditiveBlending : NormalBlending,
    uniforms: {
      pigment: { value: new Color(sun ? 15559029 : starPigment) },
      sun: { value: sun },
      time: { value: 0 },
      viewportScale: { value: 1 },
      emberMask: { value: null },
    },
    vertexShader: `
      uniform float time, viewportScale;
      uniform bool sun;
      attribute vec2 seed;
      varying float visibility;
      void main() {
        float life = sun ? 3. : 10.;
        float progress = fract(time/life+seed.x);
        float taper = min(1.,min(progress,1.-progress)/.1);
        vec3 point = position * (sun ? 1.+.1*life*progress : 1.);
        vec4 view = modelViewMatrix*vec4(point,1.);
        gl_Position = projectionMatrix*view;
        if (sun) {
          taper = 1.-smoothstep(.9,1.,abs(progress*2.-1.));
          float size = 1000./length(view.xyz)*seed.y*.6*(.25+seed.y*.75)*.1;
          gl_PointSize = max(1.,viewportScale*size*taper);
          visibility = (.5+.5*sin(time+seed.y*10.))*.5*taper;
        } else {
          gl_PointSize = max(1.,viewportScale*mix(2.,4.,seed.y)*taper);
          visibility = taper*.92;
        }
      }
    `,
    fragmentShader: `
      uniform vec3 pigment;
      uniform bool sun;
      uniform sampler2D emberMask;
      varying float visibility;
      void main() {
        float radius = length(gl_PointCoord-.5);
        if (radius > .5 || visibility < .015) discard;
        float alpha = 1.-smoothstep(.36,.50,radius);
        vec3 color = pigment;
        if (sun) {
          vec4 ember = texture2D(emberMask,gl_PointCoord);
          alpha = ember.a;
          color *= ember.r;
        }
        gl_FragColor = vec4(color,visibility*alpha);
        #include <colorspace_fragment>
      }
    `,
  }));
}

const beltPath = [
  [-40, 0, .1], [0, -40, .8], [40, 0, 2], [0, 40, .8],
];
const beltBasis = new Quaternion().setFromEuler(new Euler(90 * radians, -5 * radians, 0));

function catmullRom(previous, start, end, next, t, tension) {
  const startTangent = (end - previous) * tension;
  const endTangent = (next - start) * tension;
  return ((2 * start - 2 * end + startTangent + endTangent) * t
    + (-3 * start + 3 * end - 2 * startTangent - endTangent)) * t * t + startTangent * t + start;
}

// PositionSetSpline gives each particle a fixed offset in a sphere and uses a
// fourth spline channel to control that offset's spread. RotationSetRandom
// spins each rock around its own axis as it follows the closed path.
export function makeSolarBelt(geometries, map) {
  const group = new Group();
  group.rotation.z = -30 * radians;
  group.position.y = -10;
  const material = new MeshBasicMaterial({ color: '#6e90dd', map });
  const dimensions = 3;
  const maximumLife = 200;
  const rate = Math.floor((1024 / geometries.length) / maximumLife);
  const count = rate * maximumLife;
  const bodies = geometries.map((geometry, variant) => {
    const mesh = new InstancedMesh(geometry, material, count);
    mesh.boundingSphere = new Sphere(new Vector3(), 46);
    group.add(mesh);
    const particles = Array.from({ length: count }, (_, index) => {
      const seed = 530 + variant * count + index;
      const life = 20 + 180 * random(seed + 91);
      return {
        phase: ((maximumLife - index / rate) / life) % 1,
        life,
        offset: direction(seed + 303, new Vector3()).multiplyScalar(2),
        axis: direction(seed + 746, new Vector3()),
      };
    });
    return { mesh, particles };
  });

  const rock = new Object3D();
  rock.scale.setScalar(.32);
  const pathPosition = new Float32Array(dimensions);
  function update(time) {
    for (const { mesh, particles } of bodies) {
      particles.forEach(({ phase, life, offset, axis }, index) => {
        const step = ((time * .2 / life + phase) % 1) * 4;
        const segment = Math.floor(step);
        const t = step - segment;
        const previous = beltPath[(segment + 3) % 4];
        const start = beltPath[segment];
        const end = beltPath[(segment + 1) % 4];
        const next = beltPath[(segment + 2) % 4];
        for (let axisIndex = 0; axisIndex < dimensions; axisIndex++) {
          pathPosition[axisIndex] = catmullRom(previous[axisIndex], start[axisIndex],
            end[axisIndex], next[axisIndex], t, axisIndex === 2 ? 1 : .5);
        }
        rock.position.copy(offset).multiplyScalar(pathPosition[2]);
        rock.position.x += pathPosition[0];
        rock.position.y += pathPosition[1];
        rock.position.applyQuaternion(beltBasis);
        rock.quaternion.setFromAxisAngle(axis, (time * .2 + phase * life) * 1.5);
        rock.updateMatrix();
        mesh.setMatrixAt(index, rock.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
  update(0);

  function dispose() {
    for (const { mesh } of bodies) mesh.dispose();
    material.dispose();
  }

  return { group, update, dispose };
}

// CometTrail's two animated noise samples, four-level color bands, and
// SceneSolar's 20-second traverse followed by a two-second offscreen hold.
export function makeSolarComet() {
  const mesh = new Mesh(new PlaneGeometry(10, 1), new ShaderMaterial({
    depthWrite: false,
    side: DoubleSide,
    uniforms: {
      time: { value: 0 },
      noiseMap: { value: null },
      ice: { value: new Color('#abbef6') },
      blue: { value: new Color('#86b6ff') },
      cream: { value: new Color('#fceecd') },
    },
    vertexShader: `
      varying vec2 trail;
      void main() {
        trail=uv;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      }
    `,
    fragmentShader: `
      varying vec2 trail;
      uniform float time;
      uniform sampler2D noiseMap;
      uniform vec3 ice, blue, cream;
      void main() {
        vec2 signedUV = trail*2.-1.;
        vec2 shape = abs(signedUV);
        shape = mix(sqrt(shape),shape,.8);
        shape.x = max(0.,shape.x-.5);
        float distanceFromFlame = length(shape)-mix(.1,.5,trail.x);

        vec2 noiseUV = signedUV*vec2(1.,.75)+time*vec2(1.4,.5);
        vec3 noiseColor = texture2D(noiseMap,noiseUV).rgb;
        vec3 inputColor = vec3(signedUV,0.);
        vec3 linearLight = mix(max(inputColor+2.*noiseColor-1.,0.),
                               min(inputColor+2.*noiseColor-1.,1.),step(.5,noiseColor));
        float taper = mix(1.,.2,trail.x);
        float flame = 1.-min(length(mix(inputColor,linearLight,taper))+distanceFromFlame,1.);
        float secondNoise = texture2D(noiseMap,vec2(trail.x+time*.5,trail.y*noiseColor.r)).r;
        flame = mix(flame,flame*secondNoise,taper);
        if (flame < .1) discard;

        float band = floor(fract(flame*2.)*4.+.5)/4.;
        vec3 color = mix(ice,blue,mix(flame,band,1.-trail.x));
        gl_FragColor = vec4(mix(color,cream,(1.-taper)*(1.-taper)),1.);
        #include <colorspace_fragment>
      }
    `,
  }));
  mesh.rotation.z = -45 * radians;
  mesh.scale.setScalar(.3);
  mesh.visible = false;
  return mesh;
}
