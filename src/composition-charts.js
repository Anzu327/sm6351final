import { axisBottom, axisLeft } from 'd3-axis';
import { scaleBand, scaleLinear, scaleLog, scaleOrdinal, scalePoint } from 'd3-scale';
import { select } from 'd3-selection';
import { area, line } from 'd3-shape';
import { flight, orbit } from './origins-data.js';

// D3 / Observable chart examples, adapted to render into the existing SVG.
function chart(svg, minHeight, maxHeight = minHeight + 96) {
  const width = svg.clientWidth;
  const height = Math.round(Math.min(maxHeight, minHeight + Math.max(0, width - 265) * .38));
  svg.replaceChildren();
  return { svg: select(svg).attr('viewBox', [0, 0, width, height]), width, height };
}

function label(svg, x, y, value, anchor = 'start', className = 'chart-label') {
  return svg.append('text').attr('x', x).attr('y', y)
    .attr('text-anchor', anchor).attr('class', className).text(value);
}

function axes(svg, { x, y, left, right, bottom, xAxis, yAxis, xLabel, yLabel }) {
  svg.append('g').attr('class', 'chart-axis').attr('transform', `translate(0,${bottom})`)
    .call(xAxis ?? axisBottom(x).ticks(right - left < 260 ? 4 : 5).tickSizeOuter(0));
  if (y) {
    svg.append('g').attr('class', 'chart-axis').attr('transform', `translate(${left},0)`)
      .call(yAxis ?? axisLeft(y).ticks(4).tickSizeOuter(0))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').clone().attr('x2', right - left).attr('class', 'chart-grid'));
  }
  if (yLabel) label(svg, left, 25, yLabel);
  if (xLabel) label(svg, (left + right) / 2, bottom + 45, xLabel, 'middle');
}

// https://observablehq.com/@d3/area-chart
// Popova et al., Science (2013), pre-atmospheric orbital elements.
export function orbitArea(element) {
  const { svg, width, height } = chart(element, 300, 530);
  const left = 42, right = width - 20, bottom = height - 56;
  const { semiMajorAxis: a, eccentricity: e } = orbit;
  const data = Array.from({ length: 181 }, (_, i) => {
    const angle = i * 2;
    return { angle, distance: a * (1 - e * e) / (1 + e * Math.cos(angle * Math.PI / 180)) };
  });
  const x = scaleLinear([0, 360], [left, right]);
  const y = scaleLinear([0, 3.2], [bottom, 43]);
  const orbitalArea = area().x(d => x(d.angle)).y0(y(0)).y1(d => y(d.distance));
  svg.append('path').attr('class', 'chart-area').attr('d', orbitalArea(data));
  axes(svg, { x, y, left, right, bottom, xLabel: 'True anomaly (°)', yLabel: 'Distance from Sun (AU)',
    xAxis: axisBottom(x).tickValues(width < 300 ? [0, 180, 360] : [0, 90, 180, 270, 360]).tickSizeOuter(0) });
  svg.append('line').attr('class', 'chart-reference').attr('x1', left).attr('x2', right)
    .attr('y1', y(1)).attr('y2', y(1));
  label(svg, left + 8, y(1) - 10, '1 AU reference');
  const apses = [data[0], data[90]];
  svg.selectAll('.chart-dot').data(apses).join('circle').attr('class', 'chart-dot')
    .attr('cx', d => x(d.angle)).attr('cy', d => y(d.distance)).attr('r', 4);
  label(svg, left + 7, y(apses[0].distance) + 17, `Perihelion ${apses[0].distance.toFixed(2)} AU`, 'start', 'chart-value');
  label(svg, x(180), y(apses[1].distance) - 12, `Aphelion ${apses[1].distance.toFixed(2)} AU`, 'middle', 'chart-value');
}

// https://observablehq.com/@d3/line-chart
// Popova et al., Table S1. Times are seconds since first detection.
export function atmosphericLine(element) {
  const { svg, width, height } = chart(element, 290);
  const left = 46, right = width - 18, bottom = height - 56;
  const x = scaleLinear([0, 16], [left, right]);
  const y = scaleLinear([0, 110], [bottom, 46]);
  axes(svg, { x, y, left, right, bottom, xLabel: 'Time since detection (s)', yLabel: 'Altitude (km)' });
  const altitude = line().x(d => x(d.time)).y(d => y(d.altitude));
  svg.append('path').attr('class', 'chart-line').attr('d', altitude(flight));
  svg.selectAll('circle').data(flight).join('circle').attr('class', 'chart-dot')
    .attr('cx', d => x(d.time)).attr('cy', d => y(d.altitude)).attr('r', 4)
    .append('title').text(d => `${d.name} · ${d.time} s · ${d.altitude.toFixed(1)} km`);
  label(svg, left + 10, y(97.1) - 10, width < 310 ? '97.1 km' : 'First detection · 97.1 km', 'start', 'chart-value');
  const peakX = x(11.4), peakY = y(29.7);
  const peakLabelY = peakY - 64;
  const narrow = width < 350;
  svg.append('line').attr('class', 'chart-track').attr('x1', peakX).attr('x2', peakX)
    .attr('y1', peakY - 7).attr('y2', peakLabelY + (narrow ? 26 : 7));
  label(svg, right, peakLabelY, narrow ? 'Peak light' : 'Peak light · 29.7 km', 'end', 'chart-value');
  if (narrow) label(svg, right, peakLabelY + 19, '29.7 km', 'end', 'chart-value');
  label(svg, right, y(13.6) + 20, '13.6 km', 'end', 'chart-value');
}

// https://observablehq.com/@d3/grouped-bar-chart
// Kaeter et al., Table 1. Mean oxide concentrations in olivine, wt%.
export function crustBars(element) {
  const { svg, width, height } = chart(element, 330);
  const left = 42, right = width - 12, bottom = height - 36;
  const data = [
    { oxide: 'SiO₂', values: [38.04, 40.50] },
    { oxide: 'FeO', values: [25.16, 10.29] },
    { oxide: 'MgO', values: [36.78, 46.22] },
  ];
  const series = ['Light lithology', 'Fusion crust'];
  const compact = width < 340;
  const fx = scaleBand(data.map(d => d.oxide), [left, right]).paddingInner(0.24).paddingOuter(0.1);
  const x = scaleBand(series, [0, fx.bandwidth()]).padding(0.12);
  const y = scaleLinear([0, 55], [bottom, compact ? 108 : 70]);
  const color = scaleOrdinal(series, ['#8daafe', '#fff0c9']);
  axes(svg, { x: fx, y, left, right, bottom, yLabel: 'Oxides in olivine (wt%)',
    xAxis: axisBottom(fx).tickSizeOuter(0), yAxis: axisLeft(y).ticks(5).tickSizeOuter(0) });
  const bars = svg.append('g').selectAll('g').data(data).join('g')
    .attr('transform', d => `translate(${fx(d.oxide)},0)`)
    .selectAll('g').data(d => d.values.map((value, i) => ({
      value, name: series[i], pairPeak: Math.max(...d.values), index: i,
    }))).join('g');
  bars.append('rect').attr('x', d => x(d.name)).attr('y', d => y(d.value))
    .attr('width', x.bandwidth()).attr('height', d => y(0) - y(d.value))
    .attr('fill', d => color(d.name));
  bars.append('text').attr('class', 'chart-bar-value').attr('text-anchor', 'middle')
    .attr('x', d => x(d.name) + x.bandwidth() / 2)
    .attr('y', d => compact ? y(d.pairPeak) - 8 - d.index * 21 : y(d.value) - 8)
    .text(d => d.value.toFixed(1)).append('title').text(d => `${d.name}: ${d.value.toFixed(2)} wt%`);
  const legend = svg.append('g').selectAll('g').data(series).join('g')
    .attr('transform', (_, i) => compact
      ? `translate(${left},${37 + 24 * i})`
      : `translate(${left + (right - left) * .46 * i},35)`);
  legend.append('rect').attr('width', 12).attr('height', 12).attr('y', 2).attr('fill', color);
  legend.append('text').attr('x', 19).attr('y', 14).text(d => d);
}

// https://observablehq.com/@d3/dot-plot
// Righter et al., Petrography and Mineralogy. Both ranges converted to µm.
export function veinRanges(element) {
  const { svg, width, height } = chart(element, 250);
  const left = 15, right = width - 19, bottom = height - 56;
  const data = [
    { name: 'Fine veins', low: 10, high: 100, range: '10–100' },
    { name: 'Coarse veins', low: 500, high: 2000, range: '500–2,000' },
  ];
  const x = scaleLog([8, 2500], [left, right]);
  const y = scalePoint(data.map(d => d.name), [70, 144]);
  axes(svg, { x, left, right, bottom,
    xLabel: 'Vein width (µm, log scale)',
    xAxis: axisBottom(x).tickValues(width < 340 ? [10, 100, 500, 2000] : [10, 50, 100, 500, 2000])
      .tickFormat(d => d.toLocaleString('en')).tickSizeOuter(0) });
  const row = svg.append('g').selectAll('g').data(data).join('g')
    .attr('transform', d => `translate(0,${y(d.name)})`);
  row.append('line').attr('class', 'chart-range').attr('x1', d => x(d.low)).attr('x2', d => x(d.high));
  row.selectAll('circle').data(d => [d.low, d.high]).join('circle')
    .attr('cx', x).attr('r', 5).attr('class', 'chart-dot');
  row.append('text').attr('x', left).attr('y', -17).text(d => d.name);
  row.append('text').attr('class', 'chart-value').attr('x', right).attr('y', -17)
    .attr('text-anchor', 'end').text(d => d.range);
}

// https://observablehq.com/@d3/horizontal-bar-chart
// Kaeter et al., Petrography. Modal proportions remain ranges.
export function mineralRanges(element) {
  const { svg, width, height } = chart(element, 300);
  const left = 12, right = width - 12, bottom = height - 56;
  const data = [
    { name: 'Olivine', low: 50, high: 60 },
    { name: 'Pyroxene', low: 20, high: 30 },
    { name: 'Plagioclase + glass', low: 5, high: 10 },
    { name: 'Opaque minerals', low: 5, high: 10 },
  ];
  const x = scaleLinear([0, 65], [left, right]);
  const y = scaleBand(data.map(d => d.name), [16, bottom - 7]).paddingInner(0.14);
  const row = svg.append('g').selectAll('g').data(data).join('g')
    .attr('transform', d => `translate(0,${y(d.name)})`);
  row.append('text').attr('x', left).attr('y', 14).text(d => d.name);
  row.append('text').attr('x', right).attr('y', 14).attr('class', 'chart-value')
    .attr('text-anchor', 'end').text(d => `${d.low}–${d.high}%`);
  row.append('line').attr('class', 'chart-track').attr('x1', left).attr('x2', right)
    .attr('y1', 32).attr('y2', 32);
  row.append('rect').attr('class', 'chart-interval').attr('x', d => x(d.low)).attr('y', 25)
    .attr('width', d => x(d.high) - x(d.low)).attr('height', 14);
  axes(svg, { x, left, right, bottom, xLabel: 'Modal abundance (%)',
    xAxis: axisBottom(x).tickValues(width < 300 ? [0, 20, 40, 60] : [0, 10, 20, 30, 40, 50, 60]).tickSizeOuter(0) });
}

// Kaeter et al., Table 2. Mg/Fe in 13 coexisting olivine–chromite pairs.
const grainPairs = [
  ['FL 1', 2.5896, 0.1141], ['FL 2', 2.5890, 0.2499], ['FL 3', 2.5841, 0.1254],
  ['FL 4', 2.6473, 0.1101], ['FL 5', 2.6067, 0.1124], ['FL 6', 2.5915, 0.1300],
  ['FL 7', 2.5949, 0.1197], ['FL 8', 2.6742, 0.1099], ['FL 9', 2.6040, 0.1508],
  ['FL 10', 2.5994, 0.4049], ['FL 11', 3.5262, 0.1185],
  ['LK 1', 2.6288, 0.1163], ['LK 2', 2.6411, 0.1251],
].map(([id, olivine, chromite]) => ({ id, olivine, chromite }));

export function bindMineralBalance(figure) {
  const table = select(figure).select('table');
  const controls = table.selectAll('button[data-mineral]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const minerals = ['olivine', 'chromite'];
  // Convert Mg/Fe to Mg/(Mg + Fe) so both minerals share a linear balance with equality at 50%.
  const magnesiumPercent = ratio => (100 * ratio) / (1 + ratio);
  for (const key of minerals) {
    const values = grainPairs.map(pair => pair[key]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const track = figure.querySelector(`[data-range="${key}"]`);
    const comparison = min > 1 ? 'More magnesium than iron in every pair.'
      : max < 1 ? 'More iron than magnesium in every pair.' : '';
    track.setAttribute('aria-label', `Magnesium-to-iron ratios range from ${min.toFixed(4)} to ${max.toFixed(4)}. ${comparison}`.trim());
    track.style.setProperty('--range-start', `${magnesiumPercent(min)}%`);
    track.style.setProperty('--range-end', `${magnesiumPercent(max)}%`);
  }

  const rows = table.select('tbody').selectAll('tr').data(grainPairs, pair => pair.id).join('tr');
  rows.append('th').attr('scope', 'row').text(pair => pair.id);
  rows.selectAll('td').data(pair => minerals.map(key => pair[key]))
    .join('td').text(value => value.toFixed(4));

  let active = '';
  let direction = -1;
  controls.on('click', function () {
    const key = this.dataset.mineral;
    direction = key === active ? -direction : -1;
    active = key;
    controls.each(function () {
      const selected = this.dataset.mineral === active;
      if (selected) this.parentElement.setAttribute('aria-sort', direction < 0 ? 'descending' : 'ascending');
      else this.parentElement.removeAttribute('aria-sort');
      this.querySelector('span').textContent = selected ? (direction < 0 ? '↓' : '↑') : '↕';
    });

    // Save the current visual positions so rapid re-sorts can continue mid-animation.
    const nodes = rows.nodes();
    const tops = nodes.map(row => row.getBoundingClientRect().top);
    nodes.forEach(row => row.getAnimations().forEach(animation => animation.cancel()));
    rows.sort((a, b) => direction * (a[key] - b[key]));
    if (reducedMotion.matches) return;
    const offsets = nodes.map((row, index) => tops[index] - row.getBoundingClientRect().top);
    nodes.forEach((row, index) => {
      if (Math.abs(offsets[index]) < 1) return;
      row.animate([{ transform: `translateY(${offsets[index]}px)` }, { transform: 'translateY(0)' }],
        { duration: 560, easing: 'cubic-bezier(.22, .75, .26, 1)' });
    });
  });
}
