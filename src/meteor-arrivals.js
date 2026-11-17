import { BufferAttribute, BufferGeometry, Color, Group, Points, ShaderMaterial, Vector3 } from 'three';
import { createLandingDensity } from './landing-density.js';

// Motion reference: https://mappa.js.org/docs/animated-meteorite-landings.html
// Catalogue coordinates determine the endpoints. Incoming paths and playback
// order are illustrative: neither trajectories nor fall times are reconstructed.
const interval = .115;
const flightSlots = 28;
const tailSamples = 22;
const surfaceRadius = 1.012;

const fraction = value => value - Math.floor(value);
const noise = index => fraction(Math.sin(index * 127.1 + 311.7) * 43758.5453);

function makeParticles(capacity) {
  const geometry = new BufferGeometry();
  for (const [name, size] of [['position', 3], ['alpha', 1], ['diameter', 1], ['heat', 1], ['ring', 1]]) {
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
      attribute float alpha, diameter, heat, ring;
      uniform float pixelRatio;
      varying float opacity, warmth, halo;
      void main() {
        opacity = alpha;
        warmth = heat;
        halo = ring;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
        gl_PointSize = diameter * pixelRatio;
      }
    `,
    fragmentShader: `
      uniform vec3 orange, cream;
      varying float opacity, warmth, halo;
      void main() {
        float radius = length(gl_PointCoord - .5);
        if (radius > .5 || opacity < .001) discard;
        float edge = 1. - smoothstep(.24, .5, radius);
        float annulus = smoothstep(.32, .39, radius) * (1. - smoothstep(.43, .5, radius));
        // Negative heat identifies records without a measured catalogue mass.
        vec3 ink = warmth < 0. ? vec3(.49, .55, .58)
          : mix(orange, cream, warmth * (1. - radius));
        gl_FragColor = vec4(ink, opacity * mix(edge, annulus, halo));
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
  let impacts = makeParticles(0);
  impacts.name = 'Mass-scaled landing halos';
  group.add(impacts);
  const density = createLandingDensity(group, pointOnSphere);
  let records = [];
  let batchSize = 1;
  let eventCount = 0;
  let samples = [];
  let countedBatches = new Uint8Array(0);
  let elapsed = 2.8;
  let previousTime = null;
  const point = new Vector3();

  function setRecords(rows) {
    records = rows.filter(row => row.layer === 'meteorites'
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
        const hasMass = Number.isFinite(row.value) && row.value > 0;
        // Fixed 10 g–1 t log domain: filtering must not change a record's look.
        // Recovered mass controls a visual accent, not physical impact energy.
        const strength = hasMass ? Math.max(0, Math.min(1, (Math.log10(row.value) - 1) / 5)) : .25;
        return {
          end, start, strength, hasMass, lat: row.lat, lon: row.lon,
          duration: 2.05 + noise(index + 109) * .7,
          diameter: 3 + strength * 4.8,
          tailSeconds: .1 + strength * .22,
          opacity: .5 + strength * .46,
          flashSeconds: .28 + strength * .65,
        };
      });
    // Reveal the entire catalogue in about 30 seconds. One flying trail is a
    // representative of a batch; every located record still enters the counts.
    batchSize = Math.max(1, Math.ceil(records.length / 260));
    eventCount = Math.ceil(records.length / batchSize);
    samples = Array.from({length: eventCount}, (_, index) => records[index * batchSize]);
    countedBatches = new Uint8Array(eventCount);
    for (const particles of [landings, impacts]) {
      group.remove(particles);
      particles.geometry.dispose();
      particles.material.dispose();
    }
    landings = makeParticles(eventCount);
    landings.name = 'Landed catalogue points';
    group.add(landings);
    impacts = makeParticles(eventCount);
    impacts.name = 'Mass-scaled landing halos';
    impacts.geometry.attributes.ring.array.fill(1);
    group.add(impacts);
    samples.forEach((record, index) => {
      record.end.toArray(landings.geometry.attributes.position.array, index * 3);
      record.end.toArray(impacts.geometry.attributes.position.array, index * 3);
    });
    elapsed = 2.8;
    previousTime = null;
    density.setRecords(records);
  }

  function update({ time, visible, pixelRatio }) {
    group.visible = visible && records.length > 0;
    const dt = group.visible && previousTime !== null ? Math.max(0, Math.min(.05, time - previousTime)) : 0;
    elapsed += dt;
    previousTime = time;
    if (!group.visible) return;
    flights.material.uniforms.pixelRatio.value = pixelRatio;
    landings.material.uniforms.pixelRatio.value = pixelRatio;
    impacts.material.uniforms.pixelRatio.value = pixelRatio;
    const flight = flights.geometry.attributes;
    const landed = landings.geometry.attributes;
    const impact = impacts.geometry.attributes;
    const cycleSlots = eventCount + Math.ceil(3.5 / interval);
    const cycle = cycleSlots * interval;
    const lastEvent = Math.floor(elapsed / interval);
    let count = 0;
    // Each slot represents a recently launched meteor. Sample its recent path
    // in seconds (not frames) to keep the short tail consistent at any FPS.
    for (let event = Math.max(0, lastEvent - flightSlots + 1); event <= lastEvent; event++) {
      const launch = event * interval;
      const index = (event % cycleSlots) * batchSize;
      if (index >= records.length) continue;
      const record = records[index];
      const age = elapsed - launch;
      if (age > record.duration + record.tailSeconds) continue;
      for (let sample = 0; sample < tailSamples; sample++) {
        const lag = sample / (tailSamples - 1);
        const progress = (age - lag * record.tailSeconds) / record.duration;
        if (progress < 0 || progress > 1) continue;
        // Accelerate into the surface, like the Mappa interpolation effect.
        point.copy(record.start).lerp(record.end, progress ** 1.75);
        point.toArray(flight.position.array, count * 3);
        flight.alpha.array[count] = record.opacity * (1 - lag) ** .85;
        flight.diameter.array[count] = record.diameter * (1 - lag * .8);
        flight.heat.array[count] = record.hasMass ? (1 - lag) ** 3 * (.35 + .6 * record.strength) : -1;
        count++;
      }
    }
    flights.geometry.setDrawRange(0, count);
    for (let index = 0; index < samples.length; index++) {
      const record = samples[index];
      const firstLanding = index * interval + record.duration;
      const sinceFirst = elapsed - firstLanding;
      if (sinceFirst >= 0 && !countedBatches[index]) {
        countedBatches[index] = 1;
        for (let row = index * batchSize; row < Math.min(records.length, (index + 1) * batchSize); row++) density.land(row);
      }
      const age = ((elapsed % cycle) - firstLanding + cycle) % cycle;
      const flash = sinceFirst >= 0 ? Math.max(0, 1 - age / record.flashSeconds) : 0;
      landed.alpha.array[index] = sinceFirst >= 0 ? .4 + record.strength * .25 + flash * .3 : 0;
      landed.diameter.array[index] = 1.8 + record.strength * 1.8 + flash * (3 + record.strength * 7);
      landed.heat.array[index] = record.hasMass ? flash * (.35 + record.strength * .65) : -1;
      // A restrained expanding ring gives larger records a distinct arrival.
      // This is an illustration of relative mass, not a simulated crater.
      impact.alpha.array[index] = record.hasMass && record.strength > .65
        ? flash * .55 * record.strength : 0;
      impact.diameter.array[index] = (6 + record.strength * 18) * (1 - flash * .7);
      impact.heat.array[index] = .6;
    }
    for (const attribute of Object.values(flight)) attribute.needsUpdate = true;
    for (const name of ['alpha', 'diameter', 'heat']) landed[name].needsUpdate = true;
    for (const name of ['alpha', 'diameter', 'heat']) impact[name].needsUpdate = true;
    density.update(dt);
  }

  function complete() {
    records.forEach((_, index) => density.land(index));
    countedBatches.fill(1);
    elapsed = Math.max(elapsed, eventCount * interval + 3.5);
    density.update(1);
  }

  return { setRecords, update, complete, get count() { return records.length; },
    get revealedCount() { return density.landedCount; } };
}
