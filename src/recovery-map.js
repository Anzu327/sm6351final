import { scaleLinear } from 'd3-scale';
import { pointer, select } from 'd3-selection';
import { line } from 'd3-shape';
import { flight } from './origins-data.js';
import './recovery-map.css';

// The subset of recorded locations used in the recovery preview (Popova et al., Table S13).
const locations = [
  [61.2756, 54.8022], [61.1701, 54.8371], [61.1594, 54.8273], [61.1356, 54.8617],
  [61.1241, 54.8388], [61.1036, 54.8420], [61.1017, 54.8732], [61.0879, 54.8331],
  [61.0828, 54.8427], [61.0575, 54.8550], [61.0209, 54.8514], [60.9931, 54.8807],
  [60.9782, 54.8760], [60.9672, 54.8698], [60.9551, 54.8752], [60.9348, 54.8598, 'C14'],
  [60.9002, 54.8744], [60.8533, 54.8711], [60.8233, 54.8742], [60.8176, 54.8845],
].map(([lon, lat, id]) => ({ lon, lat, id, title: id ? 'C14 · 1.8 kg' : 'Recovery location' }));

const peak = flight.find(event => event.name === 'Main brightness peak');
const points = [...locations, { lon: peak.lon, lat: peak.lat, title: 'Peak brightness', peak: true }];
const coordinates = ({lon, lat}) => `${lat.toFixed(4)}°N · ${lon.toFixed(4)}°E`;

function mountRecoveryMap(figure) {
  const plot = figure.querySelector('svg');
  const svg = select(plot);
  const card = figure.querySelector('.recovery-map__card');
  const readout = figure.querySelector('.recovery-map__readout');
  const close = figure.querySelector('.recovery-map__close');
  const grid = svg.append('g').attr('aria-hidden', 'true');
  const clip = svg.append('defs').append('clipPath').attr('id', 'recovery-map-track-clip').append('rect');
  const track = svg.append('g').attr('clip-path', 'url(#recovery-map-track-clip)').attr('aria-hidden', 'true')
    .append('path').attr('class', 'recovery-map__track');
  const marks = svg.append('g').selectAll('g').data(points).join('g')
    .attr('class', point => `recovery-map__point${point.id ? ' is-c14' : ''}${point.peak ? ' is-peak' : ''}`)
    .attr('role', 'button').attr('tabindex', 0).attr('aria-pressed', 'false')
    .attr('aria-label', point => `${point.title}, ${coordinates(point)}`)
    .style('--delay', (_, index) => `${index * 64 + 260}ms`);
  marks.append('circle').attr('class', 'recovery-map__hit').attr('r', 10);
  const markers = marks.append('g').attr('class', 'recovery-map__marker');
  markers.append('circle').attr('class', 'recovery-map__halo').attr('r', 7);
  markers.filter(point => !point.peak).append('circle').attr('class', 'recovery-map__dot').attr('r', 3.3);
  markers.filter(point => point.peak).append('path').attr('class', 'recovery-map__dot').attr('d', 'M0,-4L4,0L0,4L-4,0Z');

  let x, y, preview = null, pinned = null, displayed = null;

  function draw() {
    const width = plot.clientWidth;
    if (!width) return;
    const height = Math.max(265, Math.min(460, width * .57));
    const left = 16, right = width - 22, top = 16, bottom = height - 38;
    const lonSpan = 1.52, midLon = 60.96, midLat = 54.998;
    // Local equirectangular projection, with the latitude scale corrected at 55°N.
    const scale = Math.min((right-left)/lonSpan, (bottom-top)*Math.cos(55*Math.PI/180)/.45);
    const midX = (left+right)/2, midY = (top+bottom)/2;
    x = scaleLinear().domain([midLon, midLon+1]).range([midX, midX+scale]);
    y = scaleLinear().domain([midLat, midLat+1]).range([midY, midY-scale/Math.cos(55*Math.PI/180)]);
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    plot.style.aspectRatio = `${width} / ${height}`;
    grid.selectAll('*').remove();

    function label(text, px, py, anchor = 'start') {
      grid.append('text').attr('x', px).attr('y', py).attr('text-anchor', anchor).text(text);
    }

    for (const lon of [60.5, 61, 61.5]) {
      const px = x(lon);
      grid.append('line').attr('x1', px).attr('x2', px).attr('y1', top).attr('y2', bottom);
      label(`${lon.toFixed(1)}°E`, px, bottom + 20, 'middle');
    }
    for (const lat of [54.8, 55, 55.2]) {
      const py = y(lat);
      grid.append('line').attr('x1', left).attr('x2', right).attr('y1', py).attr('y2', py);
      label(`${lat.toFixed(1)}°N`, left, py - 6);
    }

    const lake = [x(60.3221), y(54.9594)];
    grid.append('circle').attr('class','recovery-map__lake').attr('cx', lake[0]).attr('cy', lake[1]).attr('r', 6);
    grid.append('circle').attr('class','recovery-map__place').attr('cx', lake[0]).attr('cy', lake[1]).attr('r', 2);
    label('Lake Chebarkul', lake[0] + 10, lake[1] - 9);
    const city = [x(61.4045), y(55.1692)];
    grid.append('rect').attr('class','recovery-map__place').attr('x', city[0]-2).attr('y', city[1]-2).attr('width',4).attr('height',4);
    label('Chelyabinsk', city[0] - 7, city[1] + 4, 'end');

    clip.attr('x', left).attr('y', top).attr('width', right-left).attr('height', bottom-top);
    track.attr('d', line().x(event => x(event.lon)).y(event => y(event.lat))(flight));
    marks.attr('transform', point => `translate(${x(point.lon)},${y(point.lat)})`);
  }

  function renderSelection() {
    const active = pinned || preview;
    marks.classed('is-active', point => point === active)
      .attr('aria-pressed', point => String(point === pinned));
    close.hidden = !pinned;
    card.hidden = !active;
    if (displayed === active) return;
    displayed = active;
    readout.replaceChildren();
    if (!active) return;
    const rows = [active.title, coordinates(active)];
    if (active.id === 'C14') rows.push('Found 23 Apr 2013');
    for (const text of rows) {
      const row = document.createElement('span');
      row.textContent = text;
      readout.append(row);
    }
  }

  function clearSelection() {
    pinned = null;
    preview = null;
    renderSelection();
  }

  function toggle(point) {
    if (!point || pinned === point) return clearSelection();
    pinned = point;
    preview = null;
    renderSelection();
  }

  function nearest(event, radius) {
    if (!x) return null;
    const [px, py] = pointer(event, plot);
    let match = null;
    for (const point of points) {
      const distance = Math.hypot(px-x(point.lon), py-y(point.lat));
      if (distance < radius) {
        match = point;
        radius = distance;
      }
    }
    return match;
  }

  svg.on('pointermove', event => {
    if (event.pointerType === 'touch') return;
    const next = nearest(event, 10);
    if (preview === next) return;
    preview = next;
    renderSelection();
  }).on('pointerleave', () => {
    preview = null;
    renderSelection();
  }).on('click', event => toggle(nearest(event, event.pointerType === 'touch' ? 17 : 11)));

  marks.on('focus', (_, point) => {
    preview = point;
    renderSelection();
  }).on('blur', () => {
    preview = null;
    renderSelection();
  }).on('keydown', (event, point) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggle(point);
  });

  close.addEventListener('click', clearSelection);
  figure.addEventListener('keydown', event => {
    if (event.key === 'Escape' && (preview || pinned)) {
      event.stopPropagation();
      clearSelection();
    }
  });
  function reveal() {
    figure.classList.add('is-revealed');
  }
  svg.on('focusin.reveal', reveal);
  new ResizeObserver(draw).observe(plot);
  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    reveal();
    observer.disconnect();
  }, { threshold: .35 });
  observer.observe(plot);
  draw();
}

document.querySelectorAll('.recovery-map').forEach(mountRecoveryMap);
