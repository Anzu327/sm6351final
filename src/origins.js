import { scaleLinear } from 'd3-scale';
import { pointer, select } from 'd3-selection';
import { Delaunay } from 'd3-delaunay';
import { arc, pie } from 'd3-shape';
import discoveryCounts from 'virtual:meteorite-discovery-counts';
import { flight, orbit, shockArrivals } from './origins-data.js';
import './origins.css';

const plots = new Map();
const flightSection = document.querySelector('.origins-flight');
const timeControl = document.querySelector('#origins-flight-time');
const flightName = document.querySelector('[data-flight-name]');
const flightValue = document.querySelector('[data-flight-value]');
const flightTimes = flight.map(event => event.time);
const flightScales = new Map();

function label(svg, value, x, y, style, anchor = 'start') {
  return svg.append('text').attr('class', style).attr('x', x).attr('y', y)
    .attr('text-anchor', anchor).text(value);
}

function line(svg, x1, y1, x2, y2, style, weight = 1) {
  return svg.append('line').attr('class', style).attr('stroke-width', weight)
    .attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2);
}

function dot(svg, x, y, radius, style) {
  return svg.append('circle').attr('class', style).attr('cx', x).attr('cy', y).attr('r', radius);
}

function horizontalAxis(svg, x, ticks, y, unit, startY, format = String) {
  for (const tick of ticks) {
    const px = x(tick);
    line(svg, px, startY, px, y, 'origin-grid');
    label(svg, format(tick), px, y + 23, 'origin-axis-text', 'middle');
  }
  const [start, end] = x.range();
  line(svg, start, y, end, y, 'origin-axis');
  if (unit) label(svg, unit, (start + end) / 2, y + 47, 'origin-axis-text', 'middle');
}

function rangeMark(svg, x, low, high, y, weight = 3) {
  line(svg, x(low), y, x(high), y, 'origin-measure', weight);
  for (const endpoint of [low, high]) {
    line(svg, x(endpoint), y - 8, x(endpoint), y + 8, 'origin-measure', 2);
  }
}

function target(svg, key, name, value, detail) {
  return svg.append('g').attr('class', 'origin-target').attr('data-mark', key)
    .datum({ key, name, value, detail });
}

function hitRect(group, x, y, width, height) {
  return group.append('rect').attr('class', 'origin-hit').attr('rx', 8)
    .attr('x', x).attr('y', y).attr('width', width).attr('height', height);
}

function chronology({ svg, width }) {
  const x = scaleLinear([4568, 4564], [45, width - 45]);
  horizontalAxis(svg, x, [4568, 4566, 4564], 261, 'Million years ago', 29);
  const solids = target(svg, 'solids', 'Earliest dated solids', '4,567.30', '±0.16 million years ago');
  hitRect(solids, 14, 23, width - 28, 99);
  label(solids, 'Earliest dated solids', 35, 56);
  rangeMark(solids, x, 4567.14, 4567.46, 92, 5);
  dot(solids, x(4567.3), 92, 8, 'origin-selected');
  const grains = target(svg, 'grains', 'Dated chondrules', '2.61 million', 'years between the dated endpoints');
  hitRect(grains, 14, 138, width - 28, 99);
  label(grains, 'Dated chondrules', 35, 172);
  line(grains, x(4567.32), 207, x(4564.71), 207, 'origin-measure', 7);
  rangeMark(grains, x, 4566.90, 4567.74, 207, 2);
  rangeMark(grains, x, 4564.41, 4565.01, 207, 2);
  for (const age of [4567.32, 4564.71]) dot(grains, x(age), 207, 7, 'origin-selected');
}

function minerals({ svg, width, height }) {
  const ranges = [
    ['Olivine', 50, 60],
    ['Pyroxene', 20, 30],
    ['Feldspar + glass', 5, 10],
    ['Opaque phases', 5, 10],
  ];
  const x = scaleLinear([0, 60], [34, width - 36]);
  const floor = height - 40;
  const spacing = (floor - 26) / ranges.length;
  horizontalAxis(svg, x, [0, 30, 60], floor, '', 22, value => `${value}%`);
  ranges.forEach(([name, low, high], index) => {
    const y = 20 + index * spacing;
    const row = target(svg, name, name, `${low}–${high}%`, 'of the studied rock');
    hitRect(row, 14, y, width - 28, spacing - 3);
    label(row, name, x(0), y + 27);
    line(row, x(0), y + 52, x(60), y + 52, 'origin-grid', 2);
    line(row, x(low), y + 52, x(high), y + 52, 'origin-measure', 9).attr('stroke-linecap', 'round');
  });
}

function exposure({ svg, width }) {
  const x = scaleLinear([.6, 1.8], [30, width - 30]);
  const axis = 213;
  const midpoint = x(1.2);
  const low = x(1);
  const high = x(1.4);

  line(svg, x(.6), axis, x(1.8), axis, 'exposure-rail');
  for (let tenth = 6; tenth <= 18; tenth += 1) {
    const px = x(tenth / 10);
    line(svg, px, axis - 5, px, axis + 5, 'exposure-rail');
  }
  for (const end of [.6, 1.8]) {
    label(svg, end.toFixed(1), x(end), 276, 'origin-axis-text', 'middle');
  }
  label(svg, 'Million years', midpoint, 319, 'origin-axis-text', 'middle');

  const interval = target(svg, 'interval', 'Reported uncertainty', '1.0–1.4', 'million years');
  hitRect(interval, low - 24, axis - 24, high - low + 48, 110).attr('class', 'exposure-hit');
  interval.append('rect').attr('class', 'exposure-range').attr('rx', 4)
    .attr('x', low).attr('y', axis - 16).attr('width', high - low).attr('height', 32);
  for (let twentieth = 21; twentieth < 28; twentieth += 1) {
    const px = x(twentieth / 20);
    line(interval, px - 6, axis + 12, px + 6, axis - 12, 'exposure-hatch');
  }
  for (const [px, value, direction] of [[low, '1.0', 1], [high, '1.4', -1]]) {
    interval.append('path').attr('class', 'exposure-bracket')
      .attr('d', `M ${px + direction * 10} ${axis - 23} H ${px} v 46 h ${direction * 10}`);
    line(interval, px, axis + 23, px, 254, 'exposure-hatch');
    label(interval, value, px, 280, 'exposure-limit', 'middle');
  }

  const estimate = target(svg, 'estimate', 'Exposure age', '1.2 ± 0.2', 'million years');
  hitRect(estimate, midpoint - 52, 54, 104, 186).attr('class', 'exposure-hit');
  label(estimate, '1.2', midpoint, 132, 'exposure-value', 'middle');
  line(estimate, midpoint, 150, midpoint, axis - 26, 'exposure-stem');
  dot(estimate, midpoint, axis, 34, 'exposure-halo');
  dot(estimate, midpoint, axis, 22, 'exposure-ring');
  dot(estimate, midpoint, axis, 10, 'exposure-core');
}

function orbitPlot({ svg, width, height }) {
  const radians = Math.PI / 180;
  const { semiMajorAxis: a, eccentricity: e } = orbit;
  const omega = orbit.argumentOfPerihelion * radians;
  const inclination = orbit.inclination * radians;
  const node = orbit.ascendingNode * radians;
  // Rotate the ecliptic view so the major axis runs across the display.
  const rotation = -node - omega;
  function project(anomaly) {
    const r = a * (1 - e ** 2) / (1 + e * Math.cos(anomaly));
    const bearing = omega + anomaly;
    const u = r * Math.cos(bearing);
    const v = r * Math.sin(bearing) * Math.cos(inclination);
    const angle = rotation + node;
    return [u * Math.cos(angle) - v * Math.sin(angle), u * Math.sin(angle) + v * Math.cos(angle)];
  }

  const scale = Math.min((width - 46) / 4.28, (height - 106) / 3);
  const centerX = (width + 1.65 * scale) / 2;
  const centerY = (height + 8) / 2;
  const screen = ([x, y]) => [centerX + x * scale, centerY - y * scale];
  const points = Array.from({ length: 241 }, (_, index) => screen(project(index * Math.PI / 120)));
  const legendY = 30;
  line(svg, 20, legendY - 5, 44, legendY - 5, 'origin-measure', 2);
  label(svg, 'Fragment', 52, legendY);
  const earthLabelX = width > 420 ? 217 : width / 2 + 8;
  line(svg, earthLabelX, legendY - 5, earthLabelX + 20, legendY - 5, 'origin-axis', 2)
    .attr('stroke-dasharray', '4 4');
  label(svg, 'Earth orbit', earthLabelX + 26, legendY);
  dot(svg, centerX, centerY, scale, 'origin-axis').attr('fill', 'none')
    .attr('stroke-width', 1.5).attr('stroke-dasharray', '5 5');
  svg.append('polyline').attr('points', points.map(point => point.join(',')).join(' '))
    .attr('class', 'origin-measure').attr('fill', 'none').attr('stroke-width', 2.4);
  dot(svg, centerX, centerY, 6, 'origin-selected');
  label(svg, 'Sun', centerX, centerY + 25, '', 'middle');
  const markers = [
    [0, 'closest', 'Closest to the Sun', '0.74 AU', 'at perihelion'],
    [Math.PI, 'farthest', 'Farthest from the Sun', '2.79 AU', 'at aphelion'],
    [Math.PI - omega, 'encounter', 'Earth encounter', '15 Feb', '2013'],
  ];
  for (const [anomaly, key, name, value, detail] of markers) {
    const [x, y] = screen(project(anomaly));
    const mark = target(svg, key, name, value, detail);
    dot(mark, x, y, 21, 'origin-hit');
    dot(mark, x, y, 8, 'origin-selected');
  }
  const scaleY = height - 44;
  line(svg, 24, scaleY, 24 + scale, scaleY, 'origin-axis', 2);
  label(svg, '1 AU', 24 + scale / 2, scaleY + 23, 'origin-axis-text', 'middle');
}

function speedPlot({ svg, width, height }) {
  const x = scaleLinear([0, 16], [62, width - 36]);
  const bottom = height - 65;
  const y = scaleLinear([0, 20], [bottom, 50]);
  horizontalAxis(svg, x, [0, 4, 8, 12, 16], bottom, 'Seconds since first detection', 50);
  for (const speed of [5, 10, 15, 20]) {
    const row = y(speed);
    line(svg, x(0), row, x(16), row, 'origin-grid');
    label(svg, speed, x(0) - 12, row + 5, 'origin-axis-text', 'end');
  }
  label(svg, 'Speed · km/s', 20, 28, 'origin-axis-text');
  const points = flight.map(event => [x(event.time), y(event.speed)]);
  const lastBeforeSlowdown = 3; // End of thermal cloud formation in Table S1.
  const earlyPoints = points.slice(0, lastBeforeSlowdown + 1);
  const slowdownPoints = points.slice(lastBeforeSlowdown);
  svg.append('polyline').attr('class', 'speed-early')
    .attr('points', earlyPoints.join(' ')).attr('fill', 'none');
  for (const style of ['speed-halo', 'speed-trail']) {
    svg.append('polyline').attr('class', style).attr('points', slowdownPoints.join(' ')).attr('fill', 'none');
  }
  const earlyLabelX = (x(0) + earlyPoints.at(-1)[0]) / 2;
  label(svg, '≈19.2 km/s', earlyLabelX, y(19.2) + 35, 'origin-axis-text', 'middle');
  const hitAreas = Delaunay.from(points).voronoi([x(0) - 16, y(20) - 16, width, bottom]);
  flight.forEach((event, index) => {
    const [px, py] = points[index];
    const mark = target(svg, String(index), event.name, `${event.speed} km/s`, `${event.altitude} km above the ground`);
    mark.append('path').attr('class', 'speed-hit').attr('d', hitAreas.renderCell(index));
    line(mark, px, py, px, bottom, 'speed-guide');
    dot(mark, px, py, 11, 'speed-ring');
    dot(mark, px, py, 4, 'speed-core');
  });
}

function shockPlot({ svg, width, height }) {
  const gap = width >= 420 ? 65 : 47;
  const outer = Math.min(151, width * .22, Math.max(24, (width - 216) / 2));
  const cx = Math.min(width * .36, width - outer - gap - 140);
  const cy = height * .52;
  const inner = outer * .46;
  const textX = cx + outer + gap;
  const end = 5 * Math.PI / 3;
  const angle = scaleLinear([0, 180], [0, end]);
  const point = (radius, theta) => [cx + radius * Math.sin(theta), cy - radius * Math.cos(theta)];
  const arc = (radius, theta) => {
    const [startX, startY] = point(radius, 0);
    const [endX, endY] = point(radius, theta);
    return `M ${startX} ${startY} A ${radius} ${radius} 0 ${Number(theta > Math.PI)} 1 ${endX} ${endY}`;
  };
  for (const seconds of [0, 60, 120, 180]) {
    const theta = angle(seconds);
    const [sx, sy] = point(inner - 13, theta);
    const [ex, ey] = point(outer + 8, theta);
    line(svg, sx, sy, ex, ey, 'shock-grid');
    const [tx, ty] = point(outer + 23, theta);
    label(svg, `${seconds} s`, tx, ty + (seconds ? 4 : -2), 'origin-axis-text', 'middle');
  }
  dot(svg, cx, cy, 27, 'shock-flash-halo');
  dot(svg, cx, cy, 6, 'shock-flash');
  label(svg, 'Flash', cx, cy + 36, '', 'middle');

  shockArrivals.forEach(({ name, delay, detection }, index) => {
    const radius = outer - (outer - inner) * index / (shockArrivals.length - 1);
    const theta = angle(delay);
    const [px, py] = point(radius, theta);
    const mark = target(svg, name, name, `${delay.toFixed(1)} s`, 'after peak brightness')
      .datum({ key: name, name, value: `${delay.toFixed(1)} s`, detail: 'after peak brightness', context: detection });
    mark.append('path').attr('class', 'shock-track').attr('d', arc(radius, end));
    mark.append('path').attr('class', 'shock-arc').attr('d', arc(radius, theta));
    mark.append('path').attr('class', 'shock-hit').attr('d', arc(radius, end));
    dot(mark, px, py, 6, 'shock-tip');
    const row = 103 + index * 58;
    hitRect(mark, textX - 8, row - 27, width - textX, 42).attr('class', 'shock-label-hit');
    label(mark, name, textX, row, 'shock-city');
  });
}

function cameraPlot({ svg, width, height }) {
  const degreeRatio = Math.cos(55 * Math.PI / 180);
  const left = 55;
  const right = width - 20;
  const top = 65;
  const bottom = height - 44;
  const scale = Math.min((right - left) / (7.4 * degreeRatio), (bottom - top) / 3);
  const x = lon => (left + right) / 2 + (lon - 61.4) * scale * degreeRatio;
  const y = lat => (top + bottom) / 2 - (lat - 55.2) * scale;
  label(svg, 'Path across the Southern Urals', 18, 36);
  for (const lon of [58, 60, 62, 64]) {
    line(svg, x(lon), y(56.7), x(lon), y(53.7), 'origin-grid');
    label(svg, `${lon}°E`, x(lon), y(53.7) + 27, 'origin-axis-text', 'middle');
  }
  for (const lat of [54, 55, 56]) {
    line(svg, x(57.7), y(lat), x(65.1), y(lat), 'origin-grid');
    label(svg, `${lat}°N`, x(57.7) - 8, y(lat) + 6, 'origin-axis-text', 'end');
  }

  for (const [name, lon, lat, dy] of [
    ['Chelyabinsk', 61.44473, 55.16633, -14],
    ['Chebarkul', 60.40024, 54.99510, 50],
  ]) {
    line(svg, x(lon), y(lat), x(lon), y(lat) + dy - (dy > 0 ? 19 : -4), 'origin-grid');
    dot(svg, x(lon), y(lat), 3, 'origin-city-dot');
    label(svg, name, Math.max(74, x(lon)), y(lat) + dy, 'origin-city-label', 'middle');
  }

  drawFlightTrack(svg, 'cameras', x, y, 'lon', 'lat');
}

function altitude({ svg, width, height }) {
  const x = scaleLinear([0, 16], [55, width - 28]);
  const y = scaleLinear([0, 100], [height - 81, 70]);
  label(svg, 'Altitude (km)', 18, 36);
  horizontalAxis(svg, x, [0, 4, 8, 12, 16], y(0), 'Seconds since first detection', y(100));
  for (const km of [0, 25, 50, 75, 100]) {
    line(svg, x(0), y(km), x(16), y(km), 'origin-grid');
    label(svg, km, x(0) - 8, y(km) + 6, 'origin-axis-text', 'end');
  }

  line(svg, x(0), y(100), x(0), y(0), 'origin-flight-cursor', 1.5);
  drawFlightTrack(svg, 'altitude', x, y, 'time', 'altitude');
  for (const event of flight) {
    dot(svg, x(event.time), y(event.altitude), 4, 'origin-flight-sample');
  }
  svg.select('.origin-flight-dot').raise();
  svg.append('rect').attr('class', 'origin-hit')
    .attr('x', x(0) - 8).attr('y', y(100) - 8)
    .attr('width', x(16) - x(0) + 16).attr('height', y(0) - y(100) + 16)
    .on('click', event => {
      const [px] = pointer(event, svg.node());
      const closest = flightTimes.reduce((best, time) =>
        Math.abs(px - x(time)) < Math.abs(px - x(best)) ? time : best);
      timeControl.value = Math.abs(px - x(closest)) <= 6 ? closest : x.invert(px);
      updateFlight();
    });
}

function drawFlightTrack(svg, name, x, y, horizontalKey, verticalKey) {
  const project = (horizontal, vertical) => [x(horizontal), y(vertical)];
  const point = event => project(event[horizontalKey], event[verticalKey]);
  const points = flight.map(point);
  const interpolateX = scaleLinear(flightTimes, flight.map(event => event[horizontalKey]));
  const interpolateY = scaleLinear(flightTimes, flight.map(event => event[verticalKey]));
  flightScales.set(name, time => project(interpolateX(time), interpolateY(time)));

  svg.append('polyline').attr('class', 'origin-flight-track')
    .attr('points', points.join(' '));
  svg.append('polyline').attr('class', 'origin-flight-travel');
  dot(svg, ...points[0], 8, 'origin-flight-dot');
}

const charts = {
  chronology: [chronology, 323, 'Ages of the earliest dated solids and chondrules, in millions of years before present'],
  minerals: [minerals, 332, 'Olivine 50–60%, pyroxene 20–30%, feldspar and glass 5–10%, opaque phases 5–10%'],
  exposure: [exposure, 348, 'Cosmic-ray exposure age, 1.2 plus or minus 0.2 million years'],
  orbit: [orbitPlot, 410, 'Chelyabinsk and approximate Earth orbits, projected onto the ecliptic plane'],
  speed: [speedPlot, 398, 'Reported speed over time at seven fireball events'],
  shock: [shockPlot, 398, 'Time from the main brightness peak to the shock wave at four observation sites'],
  cameras: [cameraPlot, 470, 'Reconstructed fireball path across the Southern Urals, from east to west'],
  altitude: [altitude, 470, 'Reconstructed fireball altitude from 97.1 km at first detection to 13.6 km at 16 seconds'],
};

const defaultMark = { exposure: 'estimate', orbit: 'encounter', speed: '6', shock: 'Chelyabinsk' };

function bindMarks(plot, name) {
  const marks = plot.svg.selectAll('.origin-target');
  if (marks.empty()) return;
  const reading = plot.figure.parentElement.querySelector('.origins-reading');
  const byKey = new Map(marks.data().map(mark => [mark.key, mark]));
  const initial = defaultMark[name] ?? marks.datum().key;
  let hover = null;
  let focus = null;

  function update() {
    const key = hover ?? focus ?? plot.pinned ?? initial;
    const { name, value, detail, context } = byKey.get(key);
    marks.classed('is-active', d => d.key === key)
      .attr('aria-pressed', d => String(d.key === plot.pinned));
    for (const [field, text] of [['name', name], ['value', value], ['detail', detail]]) {
      const node = reading.querySelector(`[data-reading-${field}]`);
      if (node.textContent !== text) node.textContent = text;
    }
    if (context) reading.parentElement.querySelector('.origins-context').textContent = context;
    plot.figure.dataset.activeMark = key;
  }

  function toggle(key) {
    plot.pinned = plot.pinned === key ? null : key;
    update();
  }

  marks.attr('role', 'button').attr('tabindex', 0)
    .attr('aria-label', d => `${d.name}, ${d.value} ${d.detail}`)
    .on('pointerenter', (event, d) => {
      if (event.pointerType === 'touch') return;
      hover = d.key;
      update();
    }).on('pointerleave', () => {
      hover = null;
      update();
    }).on('focus', (event, d) => {
      if (!event.currentTarget.matches(':focus-visible')) return;
      focus = d.key;
      update();
    }).on('blur', () => {
      focus = null;
      update();
    }).on('click', (_, d) => toggle(d.key))
    .on('keydown', (event, d) => {
      if (event.key === 'Escape') {
        plot.pinned = null;
        update();
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggle(d.key);
      }
    });
  update();
}

function redraw(name) {
  const plot = plots.get(name);
  const width = Math.round(plot.figure.clientWidth);
  if (!width) return;
  const [draw, targetHeight, description] = charts[name];
  let height = targetHeight;
  if (name === 'orbit') height = Math.min(targetHeight, Math.round(Math.max(248, width * .76)));
  if (name === 'cameras' || name === 'altitude') {
    height = Math.round(Math.max(320, Math.min(targetHeight, width * .82)));
  }
  const svg = plot.svg.attr('viewBox', `0 0 ${width} ${height}`).attr('aria-label', description);
  svg.on('pointerleave pointermove click', null).selectAll('*').remove();
  draw({ svg, width, height });
  bindMarks(plot, name);
  if (name === 'altitude' || name === 'cameras') updateFlight();
}

const altitudeAtTime = scaleLinear(flightTimes, flight.map(event => event.altitude));

function updateFlight() {
  const time = Number(timeControl.value);
  const event = flight.find(event => event.time === time);
  const altitude = altitudeAtTime(time).toFixed(1);
  const detail = event?.name ?? 'Interpolated position';
  timeControl.setAttribute('aria-valuetext', `${time} seconds, ${altitude} kilometers, ${detail}`);
  flightName.textContent = detail;
  flightValue.textContent = `${time} s · ${altitude} km`;
  flightSection.dataset.flightTime = time;

  const passedTimes = flightTimes.filter(sampleTime => sampleTime < time);
  for (const [name, positionAt] of flightScales) {
    const svg = plots.get(name).svg;
    const [x, y] = positionAt(time);
    svg.select('.origin-flight-dot').attr('cx', x).attr('cy', y);
    svg.select('.origin-flight-cursor').attr('x1', x).attr('x2', x);
    svg.select('.origin-flight-travel')
      .attr('points', [...passedTimes, time].map(positionAt).join(' '));
  }
}

const resize = new ResizeObserver(entries => {
  for (const { target } of entries) {
    const plot = plots.get(target.dataset.chart);
    if (plot.width === target.clientWidth) continue;
    plot.width = target.clientWidth;
    redraw(target.dataset.chart);
  }
});

for (const figure of document.querySelectorAll('[data-chart]')) {
  const name = figure.dataset.chart;
  const svg = select(figure).insert('svg', ':first-child').attr('role', ['altitude', 'cameras'].includes(name) ? 'img' : 'group');
  plots.set(name, { figure, svg, width: figure.clientWidth });
  redraw(name);
  resize.observe(figure);
}
timeControl.addEventListener('input', updateFlight);

const discovery = document.querySelector('.origins-discovery');
const discoveryButtons = [...discovery.querySelectorAll('[data-discovery]')];
const discoveryKinds = discoveryButtons.map(button => ({
  key: button.dataset.discovery,
  name: button.querySelector('span').textContent,
  count: discoveryCounts[button.dataset.discovery],
  button,
}));
const discoveryTotal = discoveryKinds.reduce((sum, kind) => sum + kind.count, 0);
const witnessed = discoveryCounts.Fell;
const discoveryReading = discovery.querySelector('.origins-discovery-reading');
const discoveryIcon = discoveryReading.querySelector('use');
const discoveryShare = discovery.querySelector('[data-discovery-share]');
const discoveryDescription = discovery.querySelector('[data-discovery-description]');
const formatShare = new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 1 });
const formatCount = new Intl.NumberFormat('en');
const discoveryArc = arc().innerRadius(111).outerRadius(152);
const discoveryPaths = select(discovery.querySelector('.origins-discovery-chart > svg')).append('g')
  .attr('transform', 'translate(160,160)')
  .selectAll('path')
  .data(pie().sort(null).value(kind => kind.count)(discoveryKinds))
  .join('path')
  .attr('data-kind', slice => slice.data.key)
  .attr('d', discoveryArc);

let selectedDiscovery = null;

function updateDiscovery(kind = null) {
  selectedDiscovery = kind === selectedDiscovery ? null : kind;
  const iconKind = selectedDiscovery?.key ?? 'Fell';
  discoveryReading.dataset.kind = iconKind;
  discoveryIcon.setAttribute('href', `#discovery-icon-${iconKind}`);
  discoveryShare.textContent = selectedDiscovery
    ? formatShare.format(selectedDiscovery.count / discoveryTotal)
    : `≈ 1 in ${formatCount.format(Math.round(discoveryTotal / witnessed))}`;
  discoveryDescription.textContent = selectedDiscovery
    ? selectedDiscovery.name
    : 'of these meteorites were seen falling';
  discoveryPaths.classed('is-muted', slice => Boolean(selectedDiscovery && selectedDiscovery !== slice.data));
  for (const entry of discoveryKinds) {
    entry.button.setAttribute('aria-pressed', String(selectedDiscovery === entry));
  }
}

for (const kind of discoveryKinds) {
  kind.button.querySelector('[data-discovery-count]').textContent = formatCount.format(kind.count);
  kind.button.addEventListener('click', () => updateDiscovery(kind));
}
discoveryPaths.on('click', (_event, slice) => updateDiscovery(slice.data));
updateDiscovery();
