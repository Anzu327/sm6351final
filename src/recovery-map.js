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
const coordinates = ({ lon, lat }) => `${lat.toFixed(4)}°N · ${lon.toFixed(4)}°E`;

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
    .attr('role', 'button').attr('tabindex', -1).attr('aria-pressed', 'false')
    .attr('aria-label', point => `${point.title}, ${coordinates(point)}`);
  marks.append('circle').attr('class', 'recovery-map__hit').attr('r', 10);
  const markers = marks.append('g').attr('class', 'recovery-map__marker');
  markers.append('circle').attr('class', 'recovery-map__halo').attr('r', 8);
  markers.filter(point => !point.peak).append('circle').attr('class', 'recovery-map__dot').attr('r', 3.3);
  markers.filter(point => point.peak).append('path').attr('class', 'recovery-map__dot').attr('d', 'M0,-6L6,0L0,6L-6,0Z');

  let x, y, preview = null, pinned = null, displayed = null;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const visiblePoints = new Set();
  // Show the flight marker first, then reveal the finds from east to west.
  const revealOrder = [points.at(-1), ...locations];
  const pointElements = new Map(marks.nodes().map((element, index) => [points[index], element]));
  let revealFrame = null, startedAt = null, inView = false;

  function draw() {
    const width = plot.clientWidth;
    if (!width) return;
    const height = Math.max(280, Math.min(610, width * .54));
    const narrow = width < 440;
    const left = narrow ? 60 : 84, right = width - 12, top = 20;
    const bottom = height - 38;
    const lonSpan = 1.52, midLon = 60.96, midLat = 54.998;
    // Local equirectangular projection, with the latitude scale corrected at 55°N.
    const scale = Math.min((right-left)/lonSpan, (bottom-top)*Math.cos(55*Math.PI/180)/.45);
    const midX = (left+right)/2, midY = (top+bottom)/2;
    x = scaleLinear().domain([midLon, midLon+1]).range([midX, midX+scale]);
    y = scaleLinear().domain([midLat, midLat+1]).range([midY, midY-scale/Math.cos(55*Math.PI/180)]);
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    plot.style.aspectRatio = `${width} / ${height}`;
    grid.selectAll('*').remove();

    function label(text, px, py, anchor = 'start', className = 'recovery-map__axis') {
      grid.append('text').attr('class', className).attr('x', px).attr('y', py)
        .attr('text-anchor', anchor).text(text);
    }

    for (const lon of [60.5, 61, 61.5]) {
      const px = x(lon);
      grid.append('line').attr('x1', px).attr('x2', px).attr('y1', top).attr('y2', bottom);
      if (lon !== 61) label(`${lon.toFixed(1)}°E`, px, bottom + 25, 'middle');
    }
    for (const lat of [54.8, 55, 55.2]) {
      const py = y(lat);
      grid.append('line').attr('x1', left).attr('x2', right).attr('y1', py).attr('y2', py);
      if (lat !== 55) label(`${lat.toFixed(1)}°N`, left - 7, py + 4, 'end');
    }

    const lake = [x(60.3221), y(54.9594)];
    grid.append('circle').attr('class','recovery-map__lake').attr('cx', lake[0]).attr('cy', lake[1]).attr('r', 8);
    grid.append('circle').attr('class','recovery-map__place').attr('cx', lake[0]).attr('cy', lake[1]).attr('r', 3);
    label('Lake Chebarkul', narrow ? lake[0] : lake[0] + 15,
      narrow ? y(55) - 10 : lake[1] + 4, 'start', 'recovery-map__place-label');
    const city = [x(61.4045), y(55.1692)];
    grid.append('rect').attr('class','recovery-map__place').attr('x', city[0]-3).attr('y', city[1]-3).attr('width',6).attr('height',6);
    label('Chelyabinsk', city[0] - 12, city[1] + 5, 'end', 'recovery-map__place-label');

    clip.attr('x', left).attr('y', top).attr('width', right-left).attr('height', bottom-top);
    track.attr('d', line().x(event => x(event.lon)).y(event => y(event.lat))(flight));
    markers.select('circle.recovery-map__dot').attr('r', point => {
      const distance = Math.min(...locations.filter(other => other !== point).map(other =>
        Math.hypot(x(other.lon) - x(point.lon), y(other.lat) - y(point.lat))));
      return Math.max(1.5, Math.min(5.1, (distance - 0.8) / 2));
    });
    marks.attr('transform', point => `translate(${x(point.lon)},${y(point.lat)})`);
  }

  function renderSelection() {
    const selected = pinned || preview;
    const active = visiblePoints.has(selected) ? selected : null;
    marks.classed('is-active', point => point === active)
      .attr('aria-pressed', point => String(point === pinned));
    close.hidden = !pinned || !active;
    card.hidden = !active;
    if (displayed === active) return;
    displayed = active;
    readout.replaceChildren();
    if (!active) return;
    if (active.id || active.peak) {
      const title = document.createElement('strong');
      title.textContent = active.title;
      readout.append(title);
    }
    const location = document.createElement('span');
    location.textContent = coordinates(active);
    readout.append(location);
    if (active.id === 'C14') {
      const date = document.createElement('span');
      date.textContent = 'Found 23 Apr 2013';
      readout.append(date);
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
    for (const point of visiblePoints) {
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
  function showPoint(point) {
    visiblePoints.add(point);
    const element = pointElements.get(point);
    element.classList.add('is-shown');
    element.setAttribute('tabindex', 0);
    if (pinned === point) renderSelection();
  }

  function animateReveal(now) {
    revealFrame = null;
    startedAt ??= now;
    const count = Math.max(0, 1 + Math.floor((now - startedAt - 280) / 95));
    while (visiblePoints.size < Math.min(count, revealOrder.length)) {
      showPoint(revealOrder[visiblePoints.size]);
    }
    if (visiblePoints.size < revealOrder.length) revealFrame = requestAnimationFrame(animateReveal);
  }

  function resetReveal() {
    if (revealFrame !== null) cancelAnimationFrame(revealFrame);
    revealFrame = null;
    startedAt = null;
    figure.classList.remove('is-revealing');
    visiblePoints.clear();
    preview = null;
    marks.classed('is-shown', false).attr('tabindex', -1);
    renderSelection();
  }

  function startReveal() {
    if (reducedMotion.matches) {
      figure.classList.add('is-revealing');
      revealOrder.forEach(showPoint);
    } else if (inView && !document.body.classList.contains('is-loading') && startedAt === null && revealFrame === null) {
      figure.classList.add('is-revealing');
      revealFrame = requestAnimationFrame(animateReveal);
    }
  }

  // A direct link can scroll to the map while the opening still covers the page.
  if (document.body.classList.contains('is-loading')) {
    const intro = new MutationObserver(() => {
      if (document.body.classList.contains('is-loading')) return;
      intro.disconnect();
      startReveal();
    });
    intro.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }
  reducedMotion.addEventListener('change', () => {
    resetReveal();
    startReveal();
  });
  new ResizeObserver(draw).observe(plot);
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting && entry.intersectionRatio >= .25;
    if (!entry.isIntersecting && !reducedMotion.matches) resetReveal();
    if (inView) startReveal();
  }, { threshold: [0, .25] }).observe(plot);
  if (reducedMotion.matches) startReveal();
  draw();
}

document.querySelectorAll('.recovery-map').forEach(mountRecoveryMap);
