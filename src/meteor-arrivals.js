import { BufferAttribute, BufferGeometry, Color, Group, Points, ShaderMaterial, Vector3 } from 'three';
import { createLandingDensity } from './landing-density.js';
import { densityInk } from './earth-palette.js';

// Motion reference: https://mappa.js.org/docs/animated-meteorite-landings.html
// Catalogue coordinates determine the endpoints. Incoming paths and playback
// order are illustrative: neither trajectories nor fall times are reconstructed.
const interval = .115;
const flightSlots = 28;
const tailSamples = 40;
const surfaceRadius = 1.012;

const fraction = value => value - Math.floor(value);
const noise = index => fraction(Math.sin(index * 127.1 + 311.7) * 43758.5453);

function makeParticles(capacity, flying = false) {
  const geometry = new BufferGeometry();
  for (const [name, size] of [['position', 3], ['alpha', 1], ['diameter', 1], ['heat', 1], ['ring', 1]]) {
    geometry.setAttribute(name, new BufferAttribute(new Float32Array(capacity * size), size));
  }
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      pixelRatio: { value: 1 },
      visibility: { value: 1 },
      flying: { value: flying },
      trail: { value: new Color(densityInk[5]).multiplyScalar(.66) },
      flare: { value: new Color('#fff0f7') },
      unmeasured: { value: new Color('#7d98a8') },
      flightCore: { value: new Color('#fff7dc') },
      flightGlow: { value: new Color('#ffd286') },
      flightEmber: { value: new Color('#b45a2c') },
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
      uniform vec3 trail, flare, unmeasured;
      uniform vec3 flightCore, flightGlow, flightEmber;
      uniform bool flying;
      uniform float visibility;
      varying float opacity, warmth, halo;
      void main() {
        float radius = length(gl_PointCoord - .5);
        if (radius > .5 || opacity < .001) discard;
        float edge = 1. - smoothstep(.24, .5, radius);
        float annulus = smoothstep(.32, .39, radius) * (1. - smoothstep(.43, .5, radius));
        vec3 ink;
        float shape;
        if (flying) {
          float head = warmth;
          vec3 glow = mix(flightEmber, flightGlow, 1. - smoothstep(.20, .42, radius));
          ink = mix(glow, flightCore, head * (1. - smoothstep(.10, .24, radius)));
          shape = mix(edge, 1. - smoothstep(.15, .5, radius), head);
        } else {
          // Negative heat identifies records without a measured catalogue mass.
          ink = warmth < 0. ? unmeasured : mix(trail, flare, warmth * (1. - radius));
          ink = mix(ink, flightEmber, halo * .55);
          shape = mix(edge, annulus, halo);
        }
        gl_FragColor = vec4(ink, visibility * opacity * shape);
        #include <colorspace_fragment>
      }
    `,
  });
  const points = new Points(geometry, material);
  // Positions change every frame and the flight shell extends beyond Earth.
  points.frustumCulled = false;
  return points;
}

function writeFlightTrail(attributes, count, point, record, age) {
  for (let sample = tailSamples - 1; sample >= 0; sample--) {
    const lag = sample / (tailSamples - 1);
    const progress = (age - lag * record.tailSeconds) / record.duration;
    if (progress < 0 || progress > 1) continue;
    // Sample in seconds to keep the tail consistent across frame rates.
    point.lerpVectors(record.start, record.end, progress ** 1.75);
    point.toArray(attributes.position.array, count * 3);
    attributes.alpha.array[count] = record.opacity * (sample === 0 ? 1 : .38 * (1 - lag) ** 1.4);
    attributes.diameter.array[count] = record.diameter * (sample === 0 ? 1 : .56 * (1 - lag * .85));
    attributes.heat.array[count] = sample === 0 ? 1 : 0;
    count++;
  }
  return count;
}

export function createSolarMeteorShowers(surfaceRadius) {
  const desktopSlots = 16;
  const mobileSlots = 12;
  const cycle = 2.65;
  const flashSeconds = .18;
  const points = makeParticles(desktopSlots * (tailSamples + 1), true);
  points.name = 'Solar Earth meteor showers';
  points.visible = false;
  // The planet selector walks the Earth's descendants.
  points.raycast = () => {};
  const attributes = points.geometry.attributes;
  const pathPoint = new Vector3();
  const paths = Array.from({length: desktopSlots * 4}, (_, index) => {
    const y = 1 - 2 * (index + .5) / (desktopSlots * 4);
    const angle = index * Math.PI * (3 - Math.sqrt(5));
    const horizontal = Math.sqrt(1 - y * y);
    const normal = new Vector3(Math.cos(angle) * horizontal, y, Math.sin(angle) * horizontal);
    const tangent = new Vector3(-normal.z, 0, normal.x).normalize();
    const side = new Vector3().crossVectors(normal, tangent);
    const heading = noise(index + 23) * Math.PI * 2;
    return {
      end: normal.clone().multiplyScalar(surfaceRadius),
      start: normal.multiplyScalar(surfaceRadius * (1.85 + noise(index + 31) * .75))
        .addScaledVector(tangent, Math.cos(heading) * surfaceRadius * .54)
        .addScaledVector(side, Math.sin(heading) * surfaceRadius * .54),
      duration: 1.95 + noise(index + 57) * .22,
      tailSeconds: .32 + noise(index + 79) * .16,
      opacity: .85 + noise(index + 101) * .15,
      diameter: 0,
    };
  });

  function update({ time, mobile, visibility, pixelRatio, projectedRadius }) {
    points.visible = visibility > .001 && projectedRadius > 0;
    if (!points.visible) return;
    points.material.uniforms.pixelRatio.value = pixelRatio;
    points.material.uniforms.visibility.value = visibility;
    const slots = mobile ? mobileSlots : desktopSlots;
    const scale = Math.min(1, Math.max(.65, projectedRadius / 29));
    let count = 0;
    for (let slot = 0; slot < slots; slot++) {
      const offset = time + cycle * (slot + noise(slot + 149) * .65) / slots;
      const lap = Math.floor(offset / cycle);
      const age = offset - lap * cycle;
      const index = (slot * 17 + lap * 11) % paths.length;
      const path = paths[index];
      path.diameter = (4.4 + noise(index + 179) * 1.3) * scale;
      count = writeFlightTrail(attributes, count, pathPoint, path, age);
      const sinceLanding = age - path.duration;
      if (sinceLanding >= 0 && sinceLanding < flashSeconds) {
        const fade = 1 - sinceLanding / flashSeconds;
        path.end.toArray(attributes.position.array, count * 3);
        attributes.alpha.array[count] = fade ** 2 * .9;
        attributes.diameter.array[count] = path.diameter * (1.4 - fade * .45);
        attributes.heat.array[count] = 1;
        count++;
      }
    }
    points.geometry.setDrawRange(0, count);
    for (const name of ['position', 'alpha', 'diameter', 'heat']) attributes[name].needsUpdate = true;
  }

  return { points, update };
}

export function createMeteorArrivals(earth, pointOnSphere) {
  const group = new Group();
  group.name = 'Meteorite arrivals';
  group.visible = false;
  earth.add(group);
  const flights = makeParticles(flightSlots * tailSamples, true);
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
          end, start, strength, hasMass, row,
          duration: 2.05 + noise(index + 109) * .7,
          diameter: 6 + strength * 5,
          tailSeconds: .24 + strength * .24,
          opacity: .76 + strength * .24,
          flashSeconds: .16 + strength * .18,
          ringSeconds: .34 + strength * .36,
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
    density.setRecords(records.map(record => record.row));
  }

  function update({ time, visible, pixelRatio, visibility = 1, interactionDt, reducedMotion = false,
    viewportWidth = 1, viewportHeight = 1 }) {
    group.visible = visible && records.length > 0;
    const dt = group.visible && previousTime !== null ? Math.max(0, Math.min(.05, time - previousTime)) : 0;
    elapsed += dt;
    previousTime = time;
    if (!group.visible) return;
    flights.material.uniforms.pixelRatio.value = pixelRatio;
    landings.material.uniforms.pixelRatio.value = pixelRatio;
    impacts.material.uniforms.pixelRatio.value = pixelRatio;
    for (const points of [flights, landings, impacts]) points.material.uniforms.visibility.value = visibility;
    const flight = flights.geometry.attributes;
    const landed = landings.geometry.attributes;
    const impact = impacts.geometry.attributes;
    const cycleSlots = eventCount + Math.ceil(3.5 / interval);
    const cycle = cycleSlots * interval;
    const lastEvent = Math.floor(elapsed / interval);
    let count = 0;
    // Each slot represents a recently launched meteor.
    for (let event = Math.max(0, lastEvent - flightSlots + 1); event <= lastEvent; event++) {
      const launch = event * interval;
      const index = (event % cycleSlots) * batchSize;
      if (index >= records.length) continue;
      const record = records[index];
      const age = elapsed - launch;
      if (age > record.duration + record.tailSeconds) continue;
      count = writeFlightTrail(flight, count, point, record, age);
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
      const flash = sinceFirst >= 0 ? Math.max(0, 1 - age / record.flashSeconds) ** 2 : 0;
      landed.alpha.array[index] = sinceFirst >= 0 ? .4 + record.strength * .2 + flash * .4 : 0;
      landed.diameter.array[index] = 1.8 + record.strength * 1.8 + flash * (4 + record.strength * 8);
      landed.heat.array[index] = flash > 0 ? flash : record.hasMass ? 0 : -1;
      // Begin the ring as the initial flash fades.
      // This is an illustration of relative mass, not a simulated crater.
      const ringProgress = (age - record.flashSeconds * .45) / record.ringSeconds;
      const ringFade = ringProgress >= 0 && ringProgress < 1
        ? Math.min(1, ringProgress * 10) * (1 - ringProgress) ** 1.4 : 0;
      impact.alpha.array[index] = sinceFirst >= 0 ? ringFade * (.40 + .42 * record.strength) : 0;
      impact.diameter.array[index] = (9 + record.strength * 19) * (.44 + .56 * Math.min(1, Math.max(0, ringProgress)));
      impact.heat.array[index] = .85;
    }
    for (const attribute of Object.values(flight)) attribute.needsUpdate = true;
    for (const name of ['alpha', 'diameter', 'heat']) landed[name].needsUpdate = true;
    for (const name of ['alpha', 'diameter', 'heat']) impact[name].needsUpdate = true;
    density.setViewport(viewportWidth, viewportHeight);
    density.update(dt, visibility, interactionDt, reducedMotion);
  }

  function complete() {
    records.forEach((_, index) => density.land(index));
    countedBatches.fill(1);
    elapsed = Math.max(elapsed, eventCount * interval + 3.5);
    density.update(1);
  }

  return { setRecords, update, complete, pickRegion: density.pick, hoverRegion: density.hover,
    regionForCell: density.regionForCell, selectRegion: density.select,
    get count() { return records.length; },
    get revealedCount() { return density.landedCount; } };
}
