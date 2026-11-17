import { BufferAttribute, BufferGeometry, Color, Group, Points, ShaderMaterial, Vector3 } from 'three';

// Motion reference: https://mappa.js.org/docs/animated-meteorite-landings.html
// Catalogue coordinates determine the endpoints. Incoming paths and playback
// order are illustrative: neither trajectories nor fall times are reconstructed.
const interval = .115;
const flightSlots = 28;
const tailSamples = 22;
const tailSeconds = .22;
const surfaceRadius = 1.012;

const fraction = value => value - Math.floor(value);
const noise = index => fraction(Math.sin(index * 127.1 + 311.7) * 43758.5453);

function makeParticles(capacity) {
  const geometry = new BufferGeometry();
  for (const [name, size] of [['position', 3], ['alpha', 1], ['diameter', 1], ['heat', 1]]) {
    geometry.setAttribute(name, new BufferAttribute(new Float32Array(capacity * size), size));
  }
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      pixelRatio: { value: 1 },
      orange: { value: new Color('#ffae43') },
      cream: { value: new Color('#fff0bb') },
    },
    vertexShader: `
      attribute float alpha, diameter, heat;
      uniform float pixelRatio;
      varying float opacity, warmth;
      void main() {
        opacity = alpha;
        warmth = heat;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
        gl_PointSize = diameter * pixelRatio;
      }
    `,
    fragmentShader: `
      uniform vec3 orange, cream;
      varying float opacity, warmth;
      void main() {
        float radius = length(gl_PointCoord - .5);
        if (radius > .5 || opacity < .001) discard;
        float edge = 1. - smoothstep(.24, .5, radius);
        vec3 ink = mix(orange, cream, warmth * (1. - radius));
        gl_FragColor = vec4(ink, opacity * edge);
        #include <colorspace_fragment>
      }
    `,
  });
  const points = new Points(geometry, material);
  // Positions change every frame and the flight shell extends beyond Earth.
  points.frustumCulled = false;
  return points;
}

export function createMeteorArrivals(earth, pointOnSphere) {
  const group = new Group();
  group.name = 'Meteorite arrivals';
  group.visible = false;
  earth.add(group);
  const flights = makeParticles(flightSlots * tailSamples);
  flights.name = 'Incoming short trails';
  group.add(flights);
  let landings = makeParticles(0);
  landings.name = 'Landed catalogue points';
  group.add(landings);
  let records = [];
  let elapsed = 2.8;
  let previousTime = null;
  const point = new Vector3();

  function setRecords(rows) {
    records = rows.filter(row => row.layer === 'meteorites' && row.status === 'Fell'
      && Number.isFinite(row.lat) && Math.abs(row.lat) <= 90
      && Number.isFinite(row.lon) && Math.abs(row.lon) <= 180
      && (row.lat !== 0 || row.lon !== 0));
    // Spread successive arrivals around the globe instead of following the
    // catalogue's alphabetical order. This is not a historical timeline.
    records = records.map((row, index) => ({ row, order: noise(index + 1) }))
      .sort((a, b) => a.order - b.order)
      .map(({ row }, index) => {
        const end = pointOnSphere(row.lat, row.lon, surfaceRadius);
        const normal = end.clone().normalize();
        const tangent = new Vector3(-normal.z, 0, normal.x);
        if (tangent.lengthSq() < .001) tangent.set(1, 0, 0);
        tangent.normalize();
        const cross = new Vector3().crossVectors(normal, tangent);
        const angle = noise(index + 31) * Math.PI * 2;
        const start = normal.clone().multiplyScalar(2.35 + noise(index + 67) * .6)
          .addScaledVector(tangent, Math.cos(angle) * .65)
          .addScaledVector(cross, Math.sin(angle) * .65);
        const mass = Number.isFinite(row.value) ? Math.max(0, row.value) : 0;
        return {
          end, start,
          duration: 2.05 + noise(index + 109) * .7,
          diameter: 4.8 + Math.min(1.8, Math.log10(1 + mass) * .3),
        };
      });
    group.remove(landings);
    landings.geometry.dispose();
    landings.material.dispose();
    landings = makeParticles(records.length);
    landings.name = 'Landed catalogue points';
    group.add(landings);
    records.forEach((record, index) => record.end.toArray(landings.geometry.attributes.position.array, index * 3));
    elapsed = 2.8;
    previousTime = null;
  }

  function update({ time, visible, pixelRatio }) {
    group.visible = visible && records.length > 0;
    if (group.visible && previousTime !== null) elapsed += Math.max(0, Math.min(.05, time - previousTime));
    previousTime = time;
    if (!group.visible) return;
    flights.material.uniforms.pixelRatio.value = pixelRatio;
    landings.material.uniforms.pixelRatio.value = pixelRatio;
    const flight = flights.geometry.attributes;
    const landed = landings.geometry.attributes;
    const cycleSlots = records.length + Math.ceil(3.5 / interval);
    const cycle = cycleSlots * interval;
    const lastEvent = Math.floor(elapsed / interval);
    let count = 0;
    // Each slot represents a recently launched meteor. Sample its recent path
    // in seconds (not frames) to keep the short tail consistent at any FPS.
    for (let event = Math.max(0, lastEvent - flightSlots + 1); event <= lastEvent; event++) {
      const launch = event * interval;
      const index = event % cycleSlots;
      if (index >= records.length) continue;
      const record = records[index];
      const age = elapsed - launch;
      if (age > record.duration + tailSeconds) continue;
      for (let sample = 0; sample < tailSamples; sample++) {
        const lag = sample / (tailSamples - 1);
        const progress = (age - lag * tailSeconds) / record.duration;
        if (progress < 0 || progress > 1) continue;
        // Accelerate into the surface, like the Mappa interpolation effect.
        point.copy(record.start).lerp(record.end, progress ** 1.75);
        point.toArray(flight.position.array, count * 3);
        flight.alpha.array[count] = .92 * (1 - lag) ** .85;
        flight.diameter.array[count] = record.diameter * (1 - lag * .8);
        flight.heat.array[count] = (1 - lag) ** 3 * .85;
        count++;
      }
    }
    flights.geometry.setDrawRange(0, count);
    for (let index = 0; index < records.length; index++) {
      const record = records[index];
      const firstLanding = index * interval + record.duration;
      const sinceFirst = elapsed - firstLanding;
      const age = ((elapsed % cycle) - firstLanding + cycle) % cycle;
      const flash = sinceFirst >= 0 ? Math.max(0, 1 - age / .65) : 0;
      landed.alpha.array[index] = sinceFirst >= 0 ? .62 + flash * .35 : 0;
      landed.diameter.array[index] = 2.8 + flash * 6;
      landed.heat.array[index] = flash;
    }
    for (const attribute of Object.values(flight)) attribute.needsUpdate = true;
    for (const name of ['alpha', 'diameter', 'heat']) landed[name].needsUpdate = true;
  }

  return { setRecords, update, get count() { return records.length; } };
}
