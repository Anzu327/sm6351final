import { select } from 'd3-selection';
import { arc, pie } from 'd3-shape';
import './inside-stone.css';

// Illustrative proportions from the previous Inside the Stone graphic.
const minerals = [
  {
    name: 'Olivine', value: 55, color: '#8599d2',
    description: 'The most abundant mineral, a silicate containing magnesium and iron.',
  },
  {
    name: 'Pyroxene', value: 25, color: '#a9c7be',
    description: 'A silicate found between the rounded chondrules.',
  },
  {
    name: 'Plagioclase + glass', value: 10, color: '#e2c99c',
    description: 'Feldspar and glass preserve traces of heating and melting.',
  },
  {
    name: 'Opaque minerals', value: 10, color: '#af91aa',
    description: 'Metal and sulfide grains appear dark in transmitted light.',
  },
];

const host = document.querySelector('#inside-stone-chart');
const detail = host.querySelector('.stone-chart__detail');
const description = detail.querySelector('p');
const close = detail.querySelector('button');

// Follow Observable's D3 pie chart: flat sectors with a contrasting stroke
// and a separate arc generator to position the labels inside each sector.
const sectors = pie().sort(null).value(mineral => mineral.value)(minerals);
const face = arc().innerRadius(0).outerRadius(145);
const labelPosition = arc().innerRadius(93).outerRadius(93);
const svg = select(host.querySelector('svg')).attr('viewBox', '-150 -150 300 300');

const buttons = svg.selectAll('g')
  .data(sectors)
  .join('g')
  .attr('class', 'stone-chart__sector')
  .attr('role', 'button')
  .attr('tabindex', 0)
  .attr('aria-label', ({ data }) => `${data.name}, ${data.value}%`)
  .attr('aria-expanded', 'false')
  .on('click', (_, sector) => toggle(sector))
  .on('keydown', (event, sector) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggle(sector);
  });

buttons.append('path')
  .attr('fill', ({ data }) => data.color)
  .attr('d', face);

buttons.append('text')
  .attr('aria-hidden', 'true')
  .attr('text-anchor', 'middle')
  .attr('dominant-baseline', 'central')
  .attr('transform', sector => `translate(${labelPosition.centroid(sector)})`)
  .text(({ data }) => `${data.value}%`);

select(host.querySelector('.stone-chart__legend'))
  .selectAll('li')
  .data(minerals)
  .join('li')
  .style('--mineral-color', mineral => mineral.color)
  .text(mineral => mineral.name);

let active = null;
function toggle(sector) {
  const previous = active;
  active = sector === previous ? null : sector;
  buttons.attr('aria-expanded', entry => String(entry === active));
  detail.hidden = active === null;
  if (active) {
    description.textContent = active.data.description;
  } else if (document.activeElement === close) {
    buttons.filter(entry => entry === previous).node()?.focus();
  }
}

close.addEventListener('click', () => toggle(null));
host.addEventListener('keydown', event => {
  if (event.key === 'Escape' && active) toggle(null);
});
