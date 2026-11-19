import { scaleLinear, scaleRadial } from 'd3-scale';
import { select } from 'd3-selection';
import { arc, pointRadial, stack } from 'd3-shape';
import './impact-timeline.css';

const methods = new Map([
  ['Ar–Ar', '#e8c58a'],
  ['U–Pb', '#a4d0df'],
  ['Sm–Nd', '#d58e70'],
  ['Rb–Sr', '#8f9fd8'],
  ['Pb–Pb', '#a5bd9c'],
  ['U–He', '#c88ba8'],
]);

// Four impacts and their listed isotope systems from Beard et al., Table 6.
// https://doi.org/10.1111/maps.13927
const impacts = [
  { age: 4.45, value: '4.45', unit: 'billion', label: '4.45 Ga', methods: ['Pb–Pb', 'U–Pb', 'Sm–Nd'] },
  { age: 2.55, value: '2.55', unit: 'billion', label: '2.55 Ga', methods: ['Ar–Ar', 'Sm–Nd', 'U–Pb'] },
  { age: 1.70, value: '1.70', unit: 'billion', label: '1.70 Ga', methods: ['Ar–Ar', 'Rb–Sr'] },
  { age: 0.025, value: '25', unit: 'million', label: '25 Ma', methods: ['Ar–Ar', 'Rb–Sr', 'Sm–Nd', 'U–Pb', 'U–He'] },
];

const chart = select('.impact-timeline');
const plot = chart.select('svg').append('g').attr('transform', 'translate(200,186)');
const ageToAngle = scaleLinear([4.6, 0], [-109, 109].map(degrees => degrees * Math.PI / 180));
const countToRadius = scaleRadial([0, 5], [59, 146]);
const halfBand = 0.26;
const sector = arc();

function band(impact, from, to) {
  const angle = ageToAngle(impact.age);
  return sector({
    innerRadius: from,
    outerRadius: to,
    startAngle: angle - halfBand,
    endAngle: angle + halfBand,
  });
}

const grid = plot.append('g').attr('aria-hidden', 'true');
grid.selectAll('path')
  .data([0, 1, 2, 3, 4, 5])
  .join('path')
  .attr('class', 'impact-timeline__grid')
  .attr('d', count => sector({
    innerRadius: countToRadius(count) - 0.5,
    outerRadius: countToRadius(count) + 0.5,
    startAngle: ageToAngle(4.6) - halfBand,
    endAngle: ageToAngle(0) + halfBand,
  }));

grid.selectAll('text')
  .data([1, 3, 5])
  .join('text')
  .attr('class', 'impact-timeline__tick')
  .attr('transform', count => {
    const [x, y] = pointRadial(-1, countToRadius(count));
    return `translate(${x},${y})`;
  })
  .text(count => count);

// As in Observable's radial stacked bars, stack assigns cumulative intervals
// and scaleRadial gives each equal count the same sector area.
const layers = stack().keys(methods.keys()).value((impact, method) => Number(impact.methods.includes(method)))(impacts);
const bars = plot.selectAll('.impact-timeline__bar')
  .data(impacts)
  .join('g')
  .attr('class', 'impact-timeline__bar')
  .attr('role', 'button')
  .attr('tabindex', 0)
  .attr('aria-label', impact => `Impact about ${impact.value} ${impact.unit} years ago. ${impact.methods.length} isotope systems: ${impact.methods.join(', ')}`)
  .on('click', (_, impact) => showImpact(impact))
  .on('keydown', (event, impact) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      showImpact(impact);
    }
  });

bars.selectAll('.impact-timeline__segment')
  .data((_, index) => layers.map(layer => ({ interval: layer[index], method: layer.key }))
    .filter(({ interval }) => interval[1] > interval[0]))
  .join('path')
  .attr('class', 'impact-timeline__segment')
  .attr('fill', entry => methods.get(entry.method))
  .attr('d', ({ interval }) => band(interval.data, countToRadius(interval[0]), countToRadius(interval[1])));

bars.append('path')
  .attr('class', 'impact-timeline__outline')
  .attr('d', impact => band(impact, countToRadius(0), countToRadius(impact.methods.length)));

bars.append('path')
  .attr('class', 'impact-timeline__leader')
  .attr('d', impact => {
    const angle = ageToAngle(impact.age);
    const start = pointRadial(angle, countToRadius(impact.methods.length) + 3);
    const end = pointRadial(angle, 153);
    return `M${start}L${end}`;
  });

bars.append('text')
  .attr('class', 'impact-timeline__label')
  .attr('transform', impact => {
    const [x, y] = pointRadial(ageToAngle(impact.age), 170);
    return `translate(${x},${y})`;
  })
  .text(impact => impact.label);

const legend = chart.select('.impact-timeline__legend')
  .selectAll('li')
  .data([...methods])
  .join('li')
  .style('--method-color', ([, color]) => color)
  .text(([name]) => name);

function showImpact(impact) {
  bars.attr('aria-pressed', entry => String(entry === impact));
  legend.classed('is-listed', ([name]) => impact.methods.includes(name));
  chart.select('[data-impact-age]').text(impact.value);
  chart.select('[data-impact-unit]').text(`${impact.unit} years ago`);
}

showImpact(impacts[0]);
