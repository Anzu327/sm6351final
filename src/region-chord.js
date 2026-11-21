import { chord, ribbon } from 'd3-chord';
import { arc } from 'd3-shape';
import { select } from 'd3-selection';
import data from 'virtual:meteorite-region-counts';
import './region-chord.css';

const regionColors = ['#6e9eee', '#ee947b', '#ad91e6', '#f0bd6f', '#8ec979', '#e598b9', '#59c6cf', '#8997ab'];
const classColors = ['#8dc7f2', '#efa086', '#78c8ad', '#bb9ae4', '#e2bf7c', '#d895b3', '#adc1d9', '#8997ab'];
const format = new Intl.NumberFormat('en');
const sum = values => values.reduce((total, value) => total + value, 0);

function renderChord(section) {
  const { regions, classes, counts } = data;
  const labels = [...regions, ...classes];
  const colors = [...regionColors.slice(0, regions.length), ...classColors.slice(0, classes.length)];
  const size = labels.length;
  const split = regions.length;
  const matrix = labels.map(() => Array(size).fill(0));
  counts.forEach((row, region) => row.forEach((count, type) => {
    // Mirror each count so both ribbon ends have the same width.
    matrix[region][type + split] = count;
    matrix[type + split][region] = count;
  }));
  const totals = matrix.map(sum);
  const total = sum(totals.slice(0, split));
  const layout = chord().padAngle(.025).sortSubgroups((a, b) => b - a)(matrix);
  const groupArc = arc().innerRadius(192).outerRadius(204);
  const band = ribbon().radius(191);
  const chart = select(section.querySelector('.chord-chart')).append('g')
    .attr('transform', 'rotate(180)');
  const countLabel = section.querySelector('.chord-count');
  const reset = section.querySelector('.chord-reset');
  let selected = null;

  const ribbons = chart.append('g').selectAll('path')
    .data(layout).join('path')
    .attr('class', 'chord-ribbon')
    .attr('d', band)
    .attr('fill', ({ source, target }) => colors[Math.min(source.index, target.index)]);
  ribbons.append('title').text(({ source, target }) => {
    const region = Math.min(source.index, target.index);
    const type = Math.max(source.index, target.index);
    return `${labels[region]} · ${labels[type]} · ${format.format(matrix[region][type])} records`;
  });

  const arcs = chart.append('g').selectAll('path')
    .data(layout.groups).join('path')
    .attr('class', 'chord-arc')
    .attr('d', groupArc)
    .attr('fill', ({ index }) => colors[index])
    .on('click', (_, { index }) => toggle(index));
  arcs.append('title').text(({ index, value }) => `${labels[index]} · ${format.format(value)} records`);

  const buttons = labels.map((label, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.style.setProperty('--chord-color', colors[index]);
    const name = document.createElement('span');
    name.textContent = label;
    const count = document.createElement('span');
    count.className = 'chord-value';
    button.append(name, count);
    button.addEventListener('click', () => toggle(index));
    const side = index < split ? '.chord-regions' : '.chord-classes';
    section.querySelector(`${side} .chord-options`).append(button);
    return { button, count };
  });

  function toggle(index) {
    selected = selected === index ? null : index;
    update();
  }

  function update() {
    ribbons.classed('muted', ({ source, target }) =>
      selected !== null && source.index !== selected && target.index !== selected);
    arcs.classed('muted', ({ index }) =>
      selected !== null && selected !== index && matrix[selected][index] === 0);
    buttons.forEach(({ button, count }, index) => {
      const inSameGroup = selected !== null && (selected < split) === (index < split);
      const muted = inSameGroup && index !== selected;
      const value = selected === null || selected === index ? totals[index] : matrix[selected][index];
      button.classList.toggle('muted', muted);
      button.setAttribute('aria-pressed', String(index === selected));
      count.textContent = muted ? '' : format.format(value);
    });
    countLabel.textContent = `${format.format(selected === null ? total : totals[selected])} records`;
    reset.disabled = selected === null;
  }

  reset.addEventListener('click', () => {
    const previous = buttons[selected]?.button;
    selected = null;
    update();
    previous?.focus({ preventScroll: true });
  });
  update();
}

renderChord(document.getElementById('region-chord'));
