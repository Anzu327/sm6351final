import { cluster, hierarchy } from 'd3-hierarchy';
import { scaleSqrt } from 'd3-scale';
import { select } from 'd3-selection';
import { arc, curveBundle, lineRadial } from 'd3-shape';
import data from 'virtual:meteorite-region-counts';
import './region-chord.css';

const format = new Intl.NumberFormat('en');
const sum = values => values.reduce((total, value) => total + value, 0);
const halfTurn = Math.PI;
const degrees = angle => angle * 180 / halfTurn;
const radians = angle => angle * halfTurn / 180;
const radius = 330;

function renderBundling(section) {
  const { regions, classes, counts } = data;
  const labels = [...regions, ...classes];
  const split = regions.length;
  const totals = [...counts.map(sum), ...classes.map((_, i) => sum(counts.map(row => row[i])))];
  const total = sum(totals.slice(0, split));
  const isRegion = index => index < split;
  const regionGroup = name => {
    if (name === 'North America' || name === 'South America') return 'Americas';
    if (['Europe', 'Africa', 'Asia'].includes(name)) return 'Europe, Africa & Asia';
    return 'Other locations';
  };
  const classGroup = name => {
    if (/^H\d+$/.test(name)) return 'H chondrites';
    if (/^L{1,2}\d+$/.test(name)) return 'L & LL chondrites';
    return 'Other & unknown';
  };
  const groups = [
    ['H chondrites', '#b8c0c9', 8, 34],
    ['L & LL chondrites', '#969fa9', 47, 77],
    ['Other & unknown', '#cecece', 93, 116],
    ['Other locations', '#a8ff1a', 134, 257],
    ['Europe, Africa & Asia', '#e74044', 274, 318],
    ['Americas', '#ed7256', 334, 350],
  ].map(([name, color, start, end]) => ({ name, color, start, end, children: [] }));
  const groupsByName = new Map(groups.map(group => [group.name, group]));
  labels.forEach((name, i) => {
    const groupName = isRegion(i) ? regionGroup(name) : classGroup(name);
    groupsByName.get(groupName).children.push({ name, i });
  });

  // Keep the reference's cluster depths and arrange sectors along its asymmetric ring.
  const root = cluster().size([2 * halfTurn, radius])(
    hierarchy({ children: groups.filter(group => group.children.length) }),
  );
  root.children.forEach(group => {
    const { start, end } = group.data;
    group.x = radians((start + end) / 2);
    group.children.forEach((node, i, siblings) => {
      node.x = siblings.length === 1 ? group.x : radians(start + (end - start) * i / (siblings.length - 1));
    });
  });
  const leaves = root.leaves();
  const nodes = new Map(leaves.map(node => [node.data.i, node]));
  const links = counts.flatMap((row, region) => row.flatMap((count, type) => count > 0
    ? [{ region, type: type + split, count }]
    : []));
  links.sort((a, b) => b.count - a.count);
  const weightDomain = [0, links[0]?.count || 1];
  const width = scaleSqrt().domain(weightDomain).range([.65, 3.45]);
  const opacity = scaleSqrt().domain(weightDomain).range([.26, .53]);
  const bundle = lineRadial().curve(curveBundle.beta(.85)).angle(node => node.x).radius(node => node.y);
  const chart = select(section.querySelector('.chord-chart'));
  const countLabel = section.querySelector('.chord-count');
  const reset = section.querySelector('.chord-reset');
  let selected = null;
  let hovered = null;
  let selectionControl = null;

  chart.append('circle').attr('class', 'chord-ring').attr('r', radius);
  chart.append('text').attr('class', 'chord-center-label').attr('text-anchor', 'middle')
    .attr('dy', '.35em').text('REGION × CLASS');

  const edges = chart.append('g').attr('aria-hidden', 'true').selectAll('path')
    .data(links).join('path')
    .attr('class', 'chord-edge')
    .attr('pathLength', 1)
    .attr('d', ({ region, type }) => bundle(nodes.get(region).path(nodes.get(type))))
    .attr('stroke', ({ region }) => nodes.get(region).parent.data.color)
    .attr('stroke-width', ({ count }) => width(count))
    .attr('stroke-opacity', ({ count }) => opacity(count));
  edges.append('title').text(({ region, type, count }) =>
    `${labels[region]} · ${labels[type]} · ${format.format(count)} records`);

  const sectors = root.children.map(group => {
    const startAngle = group.children[0].x - .045;
    const endAngle = group.children.at(-1).x + .045;
    return { ...group.data, startAngle, endAngle, angle: (startAngle + endAngle) / 2 };
  });
  const sectorArc = arc().innerRadius(radius - 13).outerRadius(radius - 9);
  const ring = chart.append('g').attr('class', 'chord-sectors').attr('aria-hidden', 'true')
    .selectAll('g').data(sectors).join('g');
  ring.append('path').attr('d', sectorArc).attr('fill', group => group.color);
  ring.append('text').attr('class', 'chord-group-label').attr('text-anchor', 'middle')
    .attr('transform', ({ angle }) => {
      const distance = radius + 168;
      const flip = angle > halfTurn / 2 && angle < halfTurn * 1.5 ? 180 : 0;
      return `translate(${Math.sin(angle) * distance},${-Math.cos(angle) * distance}) rotate(${degrees(angle) + flip})`;
    })
    .text(group => group.name);

  const radialNodes = chart.append('g').selectAll('g').data(leaves).join('g')
    .attr('class', 'chord-node')
    .attr('data-index', node => node.data.i)
    .attr('transform', node => `rotate(${degrees(node.x) - 90}) translate(${radius},0)`)
    .attr('role', 'button').attr('tabindex', 0)
    .attr('aria-label', ({ data: { i, name } }) => `${name}, ${format.format(totals[i])} records`)
    .on('pointerenter', (_, node) => showHover(node.data.i))
    .on('pointerleave', () => showHover(null))
    .on('focus', (_, node) => showHover(node.data.i))
    .on('blur', () => showHover(null))
    .on('click', (event, node) => toggle(node.data.i, event.currentTarget))
    .on('keydown', (event, node) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      toggle(node.data.i, event.currentTarget);
    });
  radialNodes.append('line').attr('x1', -20).attr('x2', 3)
    .attr('stroke', node => node.parent.data.color);
  radialNodes.append('text').attr('dy', '.32em')
    .attr('x', node => node.x < halfTurn ? 10 : -10)
    .attr('text-anchor', node => node.x < halfTurn ? 'start' : 'end')
    .attr('transform', node => node.x < halfTurn ? null : 'rotate(180)')
    .text(node => node.data.name);

  const buttons = labels.map((label, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.style.setProperty('--chord-color', nodes.get(i).parent.data.color);
    const name = document.createElement('span');
    name.textContent = label;
    const count = document.createElement('span');
    count.className = 'chord-value';
    button.append(name, count);
    button.addEventListener('click', () => toggle(i, button));
    const side = isRegion(i) ? '.chord-regions' : '.chord-classes';
    section.querySelector(`${side} .chord-options`).append(button);
    return { button, count };
  });

  function between(a, b) {
    if (isRegion(a) === isRegion(b)) return 0;
    return isRegion(a) ? counts[a][b - split] : counts[b][a - split];
  }

  function showConnections() {
    const active = selected ?? hovered;
    edges.classed('muted', ({ region, type }) => active !== null && region !== active && type !== active)
      .classed('highlighted', ({ region, type }) => region === active || type === active);
    radialNodes.classed('muted', ({ data: { i } }) => active !== null && active !== i && between(active, i) === 0)
      .classed('highlighted', ({ data: { i } }) => i === active);
  }

  function showHover(index) {
    hovered = index;
    showConnections();
  }

  function toggle(index, control) {
    selected = selected === index ? null : index;
    selectionControl = selected === null ? null : control;
    update();
  }

  function update() {
    showConnections();
    radialNodes.attr('aria-pressed', ({ data: { i } }) => String(i === selected));
    buttons.forEach(({ button, count }, index) => {
      const muted = selected !== null && selected !== index && isRegion(selected) === isRegion(index);
      const value = selected === null || selected === index ? totals[index] : between(selected, index);
      button.classList.toggle('muted', muted);
      button.setAttribute('aria-pressed', String(index === selected));
      count.textContent = muted ? '' : format.format(value);
    });
    countLabel.textContent = selected === null
      ? `${format.format(total)} records`
      : `${labels[selected]} · ${format.format(totals[selected])} records`;
    reset.disabled = selected === null;
  }

  function clearSelection(restoreFocus) {
    const control = selectionControl;
    selected = hovered = selectionControl = null;
    update();
    if (restoreFocus && control) {
      control.focus({ preventScroll: true });
      showHover(null);
    }
  }

  reset.addEventListener('click', () => clearSelection(true));
  section.addEventListener('keydown', event => {
    if (event.key === 'Escape' && selected !== null) {
      event.preventDefault();
      event.stopPropagation();
      clearSelection(false);
    }
  });
  update();
}

renderBundling(document.getElementById('region-chord'));
