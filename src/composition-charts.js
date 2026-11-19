import { axisBottom, axisLeft } from 'd3-axis';
import { scaleBand, scaleLinear, scaleLog, scaleOrdinal, scalePoint } from 'd3-scale';
import { select } from 'd3-selection';
import { area, line } from 'd3-shape';
import { flight, orbit } from './origins-data.js';

// D3 / Observable chart examples, adapted to render into the existing SVG.
function chart(svg, height) {
  const centered = svg.parentElement.hasAttribute('data-centered');
  if (centered) height = 300;
  // Leave vertical room for the selected label and its leader on short desktop viewports.
  const scale = centered ? Math.min(1.4, Math.max(0.65, (innerHeight - 180) / height)) : 1;
  // Layout width stays stable while the panel itself is animating.
  const width = Math.floor(svg.clientWidth / scale);
  return { svg: select(svg).attr('viewBox', [0, 0, width, height]), width, height };
}

function label(svg, x, y, value, anchor = 'start', className = 'chart-label') {
  return svg.append('text').attr('x', x).attr('y', y)
    .attr('text-anchor', anchor).attr('class', className).text(value);
}

function axes(svg, { x, y, left, right, bottom, xAxis, yAxis, xLabel, yLabel }) {
  svg.append('g').attr('class', 'chart-axis').attr('transform', `translate(0,${bottom})`)
    .call(xAxis ?? axisBottom(x).ticks(5).tickSizeOuter(0));
  if (y) {
    svg.append('g').attr('class', 'chart-axis').attr('transform', `translate(${left},0)`)
      .call(yAxis ?? axisLeft(y).ticks(4).tickSizeOuter(0))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').clone().attr('x2', right - left).attr('class', 'chart-grid'));
  }
  if (yLabel) label(svg, left, 16, yLabel);
  if (xLabel) label(svg, (left + right) / 2, bottom + 40, xLabel, 'middle');
}

// https://observablehq.com/@d3/area-chart
// Popova et al., Science (2013), pre-atmospheric orbital elements.
export function orbitArea(element) {
  const { svg, width, height } = chart(element, 290);
  const left = 34, right = width - 16, bottom = height - 50;
  const { semiMajorAxis: a, eccentricity: e } = orbit;
  const data = Array.from({ length: 181 }, (_, i) => {
    const angle = i * 2;
    return { angle, distance: a * (1 - e * e) / (1 + e * Math.cos(angle * Math.PI / 180)) };
  });
  const x = scaleLinear([0, 360], [left, right]);
  const y = scaleLinear([0, 3.2], [bottom, 36]);
  const orbitalArea = area().x(d => x(d.angle)).y0(y(0)).y1(d => y(d.distance));
  svg.append('path').attr('class', 'chart-area').attr('d', orbitalArea(data));
  axes(svg, { x, y, left, right, bottom, xLabel: 'True anomaly (°)', yLabel: 'Distance from Sun (AU)',
    xAxis: axisBottom(x).tickValues([0, 90, 180, 270, 360]).tickSizeOuter(0) });
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
  const left = 39, right = width - 15, bottom = height - 50;
  const x = scaleLinear([0, 16], [left, right]);
  const y = scaleLinear([0, 110], [bottom, 36]);
  axes(svg, { x, y, left, right, bottom, xLabel: 'Time since first detection (s)', yLabel: 'Altitude (km)' });
  const altitude = line().x(d => x(d.time)).y(d => y(d.altitude));
  svg.append('path').attr('class', 'chart-line').attr('d', altitude(flight));
  svg.selectAll('circle').data(flight).join('circle').attr('class', 'chart-dot')
    .attr('cx', d => x(d.time)).attr('cy', d => y(d.altitude)).attr('r', 4)
    .append('title').text(d => `${d.name} · ${d.time} s · ${d.altitude.toFixed(1)} km`);
  label(svg, left + 10, y(97.1) - 10, 'First detected 97.1 km', 'start', 'chart-value');
  const peakX = x(11.4), peakY = y(29.7);
  svg.append('line').attr('class', 'chart-track').attr('x1', peakX).attr('x2', peakX)
    .attr('y1', peakY - 7).attr('y2', peakY - 36);
  label(svg, peakX, peakY - 42, 'Main peak 29.7 km', 'middle', 'chart-value');
  label(svg, right, y(13.6) + 20, '13.6 km', 'end', 'chart-value');
}

// https://observablehq.com/@d3/grouped-bar-chart
// Kaeter et al., Table 1. Mean oxide concentrations in olivine, wt%.
export function crustBars(element) {
  const { svg, width, height } = chart(element, 290);
  const left = 34, right = width - 10, bottom = height - 34;
  const data = [
    { oxide: 'SiO₂', values: [38.04, 40.50] },
    { oxide: 'FeO', values: [25.16, 10.29] },
    { oxide: 'MgO', values: [36.78, 46.22] },
  ];
  const series = ['Light lithology', 'Fusion crust'];
  const fx = scaleBand(data.map(d => d.oxide), [left, right]).paddingInner(0.24).paddingOuter(0.1);
  const x = scaleBand(series, [0, fx.bandwidth()]).padding(0.12);
  const y = scaleLinear([0, 55], [bottom, 62]);
  const color = scaleOrdinal(series, ['#8daafe', '#fff0c9']);
  axes(svg, { x: fx, y, left, right, bottom, yLabel: 'Oxides in olivine (wt%)',
    xAxis: axisBottom(fx).tickSizeOuter(0), yAxis: axisLeft(y).ticks(5).tickSizeOuter(0) });
  const bars = svg.append('g').selectAll('g').data(data).join('g')
    .attr('transform', d => `translate(${fx(d.oxide)},0)`)
    .selectAll('g').data(d => d.values.map((value, i) => ({ value, name: series[i] }))).join('g');
  bars.append('rect').attr('x', d => x(d.name)).attr('y', d => y(d.value))
    .attr('width', x.bandwidth()).attr('height', d => y(0) - y(d.value))
    .attr('fill', d => color(d.name));
  bars.append('text').attr('class', 'chart-bar-value').attr('text-anchor', 'middle')
    .attr('x', d => x(d.name) + x.bandwidth() / 2).attr('y', d => y(d.value) - 6)
    .text(d => d.value.toFixed(1)).append('title').text(d => `${d.name}: ${d.value.toFixed(2)} wt%`);
  const legend = svg.append('g').selectAll('g').data(series).join('g')
    .attr('transform', (_, i) => `translate(${left + 145 * i},28)`);
  legend.append('rect').attr('width', 10).attr('height', 10).attr('y', 1).attr('fill', color);
  legend.append('text').attr('x', 15).attr('y', 11).text(d => d);
}

// https://observablehq.com/@d3/dot-plot
// Righter et al., Petrography and Mineralogy. Both ranges converted to µm.
export function veinRanges(element) {
  const { svg, width, height } = chart(element, 250);
  const left = 13, right = width - 13, bottom = height - 50;
  const data = [
    { name: 'Fine veins', low: 10, high: 100, range: '10–100' },
    { name: 'Coarse veins', low: 500, high: 2000, range: '500–2,000' },
  ];
  const x = scaleLog([8, 2500], [left, right]);
  const y = scalePoint(data.map(d => d.name), [70, 144]);
  axes(svg, { x, left, right, bottom, xLabel: 'Impact melt vein width (µm, log scale)',
    xAxis: axisBottom(x).tickValues([10, 50, 100, 500, 2000]).tickFormat(d => d.toLocaleString('en')).tickSizeOuter(0) });
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
  const left = 12, right = width - 12, bottom = height - 50;
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
    xAxis: axisBottom(x).tickValues([0, 10, 20, 30, 40, 50, 60]).tickSizeOuter(0) });
}

// https://observablehq.com/@d3/scatterplot
// Kaeter et al., Table 2. Mg/Fe in 13 coexisting olivine–chromite pairs.
export function grainScatter(element) {
  const { svg, width, height } = chart(element, 290);
  const left = 42, right = width - 15, bottom = height - 50;
  const data = [
    [2.5896, 0.1141], [2.5890, 0.2499], [2.5841, 0.1254], [2.6473, 0.1101],
    [2.6067, 0.1124], [2.5915, 0.1300], [2.5949, 0.1197], [2.6742, 0.1099],
    [2.6040, 0.1508], [2.5994, 0.4049], [3.5262, 0.1185], [2.6288, 0.1163], [2.6411, 0.1251],
  ];
  const x = scaleLinear([2.5, 3.6], [left, right]);
  const y = scaleLinear([0.08, 0.45], [bottom, 35]);
  axes(svg, { x, y, left, right, bottom, xLabel: 'Olivine Mg/Fe', yLabel: 'Chromite Mg/Fe' });
  svg.append('g').selectAll('circle').data(data).join('circle')
    .attr('class', 'chart-scatter').attr('cx', d => x(d[0])).attr('cy', d => y(d[1]))
    .attr('r', 4).append('title').text(d => `Olivine ${d[0].toFixed(4)} · Chromite ${d[1].toFixed(4)}`);
}
