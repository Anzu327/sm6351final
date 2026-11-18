import { Delaunay } from 'd3-delaunay';
import { scaleLinear } from 'd3-scale';
import { select } from 'd3-selection';

function chart(svg, height) {
  return select(svg).attr('viewBox', `0 0 352 ${height}`);
}

function linearPlot(svg, height, domain, lastRow, unit) {
  const root = chart(svg, height);
  const x = scaleLinear().domain(domain).range([16, 336]);
  const [min, max] = domain;
  const ticks = root.append('g').selectAll('g').data([min, (min + max) / 2, max]).join('g')
    .attr('transform', value => `translate(${x(value)},0)`);
  ticks.append('line').attr('y1', 26).attr('y2', lastRow).attr('class', 'chart-grid');
  ticks.append('text').attr('y', height - 6).attr('text-anchor', value =>
    value === domain[0] ? 'start' : value === domain[1] ? 'end' : 'middle')
    .attr('class', 'chart-axis').text(value => `${value}${unit}`);
  return { root, x };
}

export function mineralRanges(svg) {
  const ranges = [
    { name: 'Olivine', low: 50, high: 60 },
    { name: 'Pyroxene', low: 20, high: 30 },
    { name: 'Feldspar + glass', low: 5, high: 10 },
    { name: 'Opaque phases', low: 5, high: 10 },
  ];
  const { root, x } = linearPlot(svg, 190, [0, 60], 166, '%');
  const row = root.selectAll('.mineral-row').data(ranges).join('g')
    .attr('class', 'mineral-row').attr('transform', (_, index) => `translate(0,${index * 40})`);
  row.append('text').attr('x', 16).attr('y', 18).attr('class', 'chart-label').text(d => d.name);
  row.append('text').attr('x', 336).attr('y', 18).attr('text-anchor', 'end')
    .attr('class', 'chart-value').text(d => `${d.low}–${d.high}%`);
  row.append('line').attr('x1', x(0)).attr('x2', x(60)).attr('y1', 30).attr('y2', 30)
    .attr('class', 'chart-track');
  row.append('line').attr('x1', d => x(d.low)).attr('x2', d => x(d.high))
    .attr('y1', 30).attr('y2', 30).attr('class', 'chart-range');
}

export function altitudePlot(svg) {
  const events = [
    { label: 'First recorded light', altitude: 97, value: '97 km' },
    { label: 'Peak brightness', altitude: 30, value: '≈30 km' },
  ];
  const { root, x } = linearPlot(svg, 124, [0, 100], 100, '');
  const row = root.selectAll('.altitude-row').data(events).join('g')
    .attr('class', 'altitude-row').attr('transform', (_, index) => `translate(0,${index * 44})`);
  row.append('text').attr('x', 16).attr('y', 18).attr('class', 'chart-label').text(d => d.label);
  row.append('text').attr('x', 336).attr('y', 18).attr('text-anchor', 'end')
    .attr('class', 'chart-value').text(d => d.value);
  row.append('line').attr('x1', x(0)).attr('x2', x(100)).attr('y1', 34).attr('y2', 34)
    .attr('class', 'chart-track');
  row.append('circle').attr('cx', d => x(d.altitude)).attr('cy', 34).attr('r', 5)
    .attr('class', 'chart-dot');
}

export function grainBoundaries(svg) {
  const height = 108;
  const root = chart(svg, height);
  const sites = [
    [12, 25], [59, 16], [103, 32], [154, 17], [222, 14], [268, 28], [321, 13], [350, 45],
    [22, 75], [72, 69], [132, 72], [186, 59], [229, 77], [285, 71], [327, 94],
    [8, 134], [55, 121], [103, 116], [155, 119], [202, 124], [259, 121], [302, 130], [347, 128],
  ];
  const cells = Delaunay.from(sites, d => d[0], d => d[1] * height / 136).voronoi([0, 0, 352, height]);
  root.selectAll('path').data(sites).join('path')
    .attr('d', (_, index) => cells.renderCell(index)).attr('class', 'chart-grain');
  const boundaries = [[10, 11], [10, 18], [11, 12], [12, 19], [12, 13]];
  const edges = boundaries.map(([a, b]) => {
    const neighbor = cells.cellPolygon(b);
    return cells.cellPolygon(a).slice(0, -1).filter(([x, y]) => neighbor.some(([nx, ny]) =>
      Math.abs(nx - x) < .001 && Math.abs(ny - y) < .001));
  }).filter(edge => edge.length === 2);
  root.selectAll('.chart-melt').data(edges).join('line').attr('class', 'chart-melt')
    .attr('x1', d => d[0][0]).attr('y1', d => d[0][1])
    .attr('x2', d => d[1][0]).attr('y2', d => d[1][1]);
}
