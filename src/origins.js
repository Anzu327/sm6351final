import { scaleLinear } from 'd3-scale';
import { pointer, select } from 'd3-selection';
import { Delaunay } from 'd3-delaunay';
import classCounts from 'virtual:origins-class-counts';
import { cameras, flight, orbit, shockArrivals } from './origins-data.js';
import './origins.css';

const plots = new Map();
const flightSection = document.querySelector('.origins-flight');
const timeControl = document.querySelector('#origins-flight-time');
const flightName = document.querySelector('[data-flight-name]');
const flightValue = document.querySelector('[data-flight-value]');
const recordControls = document.querySelectorAll('[data-records]');
const formatCount = new Intl.NumberFormat('en');
let activeEvent = 2;
let previewEvent = null;
let countMode = 'official';

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
  const path = points.map(point => point.join(',')).join(' ');
  for (const style of ['speed-halo', 'speed-trail']) {
    svg.append('polyline').attr('class', style).attr('points', path).attr('fill', 'none');
  }
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
  const scale = Math.min((width - 83) / (7.2 * degreeRatio), (height - 76) / 3);
  const x = lon => width / 2 + 12 + (lon - 61.5) * scale * degreeRatio;
  const y = lat => height / 2 - 5 - (lat - 55.2) * scale;
  label(svg, 'Southern Urals', 17, 27);
  for (const lon of [58, 60, 62, 64]) {
    line(svg, x(lon), y(56.7), x(lon), y(53.7), 'origin-grid');
    label(svg, `${lon}°E`, x(lon), y(53.7) + 23, 'origin-axis-text', 'middle');
  }
  for (const lat of [54, 55, 56]) {
    line(svg, x(57.9), y(lat), x(65.1), y(lat), 'origin-grid');
    label(svg, `${lat}°N`, x(57.9) - 5, y(lat) + 5, 'origin-axis-text', 'end');
  }
  svg.append('polyline')
    .attr('points', flight.map(event => `${x(event.lon)},${y(event.lat)}`).join(' '))
    .attr('class', 'origin-measure').attr('fill', 'none').attr('stroke-width', 2);
  for (const [name, lat, lon, type] of cameras) {
    const site = type === 'shadow'
      ? svg.append('rect').attr('x', -3).attr('y', -3).attr('width', 6).attr('height', 6)
        .attr('transform', `translate(${x(lon)},${y(lat)}) rotate(45)`)
        .attr('fill', '#0c1853').attr('stroke', 'var(--origins-cream)')
      : dot(svg, x(lon), y(lat), 3.6, 'origin-point');
    site.append('title').text(name);
  }
  label(svg, 'Chelyabinsk', x(61.44473) + 10, y(55.16633) - 11);
  label(svg, 'Chebarkul', x(60.40024) - 9, y(54.99510) + 23, '', 'end');
  const points = flight.map(event => [x(event.lon), y(event.lat)]);
  const nearest = Delaunay.from(points);
  for (const [index, point] of points.entries()) {
    dot(svg, ...point, 4, 'origin-flight-dot').attr('data-flight-marker', index);
  }
  svg.insert('rect', ':first-child').attr('class', 'origin-flight-area')
    .attr('x', 0).attr('y', 38).attr('width', width).attr('height', height - 68);
  const closest = event => {
    const position = pointer(event, svg.node());
    const index = nearest.find(...position);
    return Math.hypot(position[0] - points[index][0], position[1] - points[index][1]) < 24 ? index : null;
  };
  svg.on('pointermove', function (event) {
    const index = closest(event);
    select(this).classed('is-near-track', index !== null);
    if (event.pointerType !== 'touch') previewFlight(index);
  }).on('pointerleave', () => previewFlight(null)).on('click', event => {
    const index = closest(event);
    if (index !== null) chooseEvent(index);
  });
}

function altitude({ svg, width, height }) {
  const x = scaleLinear([0, 16], [47, width - 30]);
  const y = scaleLinear([0, 100], [height - 60, 49]);
  label(svg, 'Altitude (km)', 16, 27);
  horizontalAxis(svg, x, [0, 8, 16], y(0), 'Seconds since first detection', y(100));
  for (const km of [0, 50, 100]) {
    line(svg, x(0), y(km), x(16), y(km), 'origin-grid');
    label(svg, km, x(0) - 8, y(km) + 5, 'origin-axis-text', 'end');
  }
  svg.append('polyline')
    .attr('points', flight.map(event => `${x(event.time)},${y(event.altitude)}`).join(' '))
    .attr('class', 'origin-measure').attr('fill', 'none').attr('stroke-width', 2);
  const cursor = line(svg, 0, y(100), 0, y(0), 'origin-flight-cursor', 1.5);
  cursor.attr('data-flight-cursor', '');
  for (const [index, event] of flight.entries()) {
    dot(svg, x(event.time), y(event.altitude), 5, 'origin-flight-dot')
      .attr('data-flight-marker', index);
  }
  svg.on('pointerleave', () => previewFlight(null));
  // Use time bands for pointer selection so closely spaced events remain selectable.
  for (const [index, event] of flight.entries()) {
    const start = index === 0 ? 0 : (flight[index - 1].time + event.time) / 2;
    const end = index === flight.length - 1 ? 16 : (event.time + flight[index + 1].time) / 2;
    svg.append('rect').attr('class', 'origin-hit').attr('data-flight-event', index)
      .attr('x', x(start) - (index === 0 ? 8 : 0)).attr('y', y(100) - 9)
      .attr('width', x(end) - x(start) + (index === 0 || index === flight.length - 1 ? 8 : 0))
      .attr('height', y(0) - y(100) + 9)
      .on('pointerenter', event => { if (event.pointerType !== 'touch') previewFlight(index); })
      .on('click', () => chooseEvent(index));
  }
}

function classification({ svg, width, height }) {
  const max = countMode === 'official' ? 13000 : 200;
  const ticks = countMode === 'official' ? [0, 6000, 12000] : [0, 100, 200];
  const x = scaleLinear([0, max], [66, width - 62]);
  const floor = height - 57;
  horizontalAxis(svg, x, ticks, floor, 'Catalogue entries', 22, value => formatCount.format(value));
  classCounts.forEach((entry, index) => {
    const y = 45 + index * (floor - 43) / classCounts.length;
    const end = x(entry[countMode]);
    const count = formatCount.format(entry[countMode]);
    const row = target(svg, entry.name, entry.name, count, countMode === 'official' ? 'official records' : 'observed falls');
    hitRect(row, 9, y - 25, width - 18, 51);
    label(row, entry.name, 18, y + 7);
    row.append('rect').attr('x', x(0)).attr('y', y - 13).attr('width', end - x(0))
      .attr('height', 26).attr('rx', 3).attr('class', 'origin-selected');
  });
  svg.attr('aria-label', classCounts.map(entry => `${entry.name} ${formatCount.format(entry[countMode])}`).join(', '));
}

const charts = {
  chronology: [chronology, 323, 'Ages of the earliest dated solids and chondrules, in millions of years before present'],
  minerals: [minerals, 332, 'Olivine 50–60%, pyroxene 20–30%, feldspar and glass 5–10%, opaque phases 5–10%'],
  exposure: [exposure, 348, 'Cosmic-ray exposure age, 1.2 plus or minus 0.2 million years'],
  orbit: [orbitPlot, 410, 'Chelyabinsk and approximate Earth orbits, projected onto the ecliptic plane'],
  speed: [speedPlot, 398, 'Reported speed over time at seven fireball events'],
  shock: [shockPlot, 398, 'Time from the main brightness peak to the shock wave at four observation sites'],
  cameras: [cameraPlot, 350, 'Calibrated fireball camera positions, shadow measurements and reconstructed fireball positions'],
  altitude: [altitude, 350, 'Reconstructed fireball altitude from 97.1 km at first detection to 13.6 km at 16 seconds'],
  classification: [classification, 276, 'Catalogue counts by class'],
};

const defaultMark = { exposure: 'estimate', orbit: 'encounter', speed: '6', shock: 'Chelyabinsk', classification: 'LL5' };

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
  const height = name === 'orbit' ? Math.min(targetHeight, Math.round(Math.max(248, width * .76))) : targetHeight;
  const svg = plot.svg.attr('viewBox', `0 0 ${width} ${height}`).attr('aria-label', description);
  svg.on('pointerleave pointermove click', null).selectAll('*').remove();
  draw({ svg, width, height });
  bindMarks(plot, name);
  if (name === 'altitude' || name === 'cameras') updateFlight();
}

function updateFlight() {
  const index = previewEvent ?? activeEvent;
  const event = flight[index];
  const selected = flight[activeEvent];
  timeControl.value = selected.time;
  timeControl.setAttribute('aria-valuetext', `${selected.name}, ${selected.time} seconds, ${selected.altitude} kilometers`);
  flightName.textContent = event.name;
  flightValue.textContent = `${event.time} s · ${event.altitude} km`;
  flightSection.dataset.flightTime = event.time;
  for (const name of ['altitude', 'cameras']) {
    const svg = plots.get(name)?.svg;
    if (!svg) continue;
    const markers = svg.selectAll('[data-flight-marker]');
    markers.classed('is-active', (_, i) => i === index)
      .attr('r', (_, i) => i === index ? 9 : 4)
      .attr('data-active-time', (_, i) => i === index ? event.time : null);
    const point = markers.nodes()[index];
    if (point) {
      const x = point.getAttribute('cx');
      svg.select('[data-flight-cursor]').attr('x1', x).attr('x2', x);
    }
  }
}

function previewFlight(index) {
  if (previewEvent === index) return;
  previewEvent = index;
  updateFlight();
}

function chooseEvent(index) {
  activeEvent = index;
  previewEvent = null;
  updateFlight();
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
chooseEvent(activeEvent);
timeControl.addEventListener('input', () => {
  const target = Number(timeControl.value);
  const closest = flight.reduce((best, event, index) =>
    Math.abs(event.time - target) < Math.abs(flight[best].time - target) ? index : best, 0);
  chooseEvent(closest);
});
timeControl.addEventListener('keydown', event => {
  const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[event.key];
  if (!step) return;
  event.preventDefault();
  chooseEvent(Math.max(0, Math.min(flight.length - 1, activeEvent + step)));
});

for (const button of recordControls) {
  button.addEventListener('click', () => {
    countMode = button.dataset.records;
    for (const control of recordControls) {
      control.setAttribute('aria-pressed', String(control === button));
    }
    redraw('classification');
  });
}
