import catalogue from './data/meteorite-catalogue.json';
import { featuredMeteorites } from './data/featured-meteorites.js';

const svgNamespace = 'http://www.w3.org/2000/svg';

// The same Equal Earth equations as the map shader, with SVG's downward Y axis.
function mapPoint(lon, lat) {
  const m = Math.sqrt(3) / 2;
  const a1 = 1.340264, a2 = -.081106, a3 = .000893, a4 = .003796;
  const theta = Math.asin(m * Math.sin(lat * Math.PI / 180));
  const t2 = theta * theta;
  const t6 = t2 * t2 * t2;
  return [
    lon * Math.PI / 180 * Math.cos(theta) / (m * (a1 + 3*a2*t2 + t6*(7*a3 + 9*a4*t2))),
    -theta * (a1 + a2*t2 + t6*(a3 + a4*t2)),
  ];
}

export function createContinentMeteorites(overlay) {
  const pins = overlay.querySelector('#meteorite-pins');
  const list = document.querySelector('#continent-featured');
  const card = document.querySelector('#meteorite-card');
  const closeButton = card.querySelector('button');
  const title = card.querySelector('h3');
  const subtitle = card.querySelector('.meteorite-card-subtitle');
  const location = card.querySelector('.meteorite-card-location');
  const story = card.querySelector('.meteorite-card-story');
  const source = card.querySelector('a');
  let active = null;
  let shown = [];
  let lastFrame = '';

  const entries = featuredMeteorites.flatMap(record => {
    const row = catalogue.rows.find(([id]) => id === record.id);
    if (!row || !Number.isFinite(row[6]) || !Number.isFinite(row[7])) return [];
    const position = mapPoint(row[7], row[6]);
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = record.title;
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', card.id);
    const marker = document.createElementNS(svgNamespace, 'g');
    marker.classList.add('meteorite-pin');
    marker.innerHTML = '<circle class="pin-hit" r="13"/><circle class="pin-ring" r="6"/><circle class="pin-core" r="2"/>';
    const tooltip = document.createElementNS(svgNamespace, 'title');
    tooltip.textContent = record.title;
    marker.append(tooltip);
    const entry = { ...record, classification: row[4], position, button, marker };
    button.addEventListener('click', () => open(entry));
    marker.addEventListener('click', () => open(entry));
    button.addEventListener('focus', () => marker.classList.add('highlighted'));
    button.addEventListener('blur', () => marker.classList.remove('highlighted'));
    return [entry];
  });

  function close(restoreFocus = false) {
    const previous = active;
    active = null;
    card.hidden = true;
    previous?.marker.classList.remove('selected');
    previous?.button.setAttribute('aria-expanded', 'false');
    if (restoreFocus) previous?.button.focus({ preventScroll: true });
    return Boolean(previous);
  }

  function open(entry) {
    close();
    active = entry;
    title.textContent = entry.title;
    subtitle.textContent = entry.chinese;
    location.textContent = `${entry.date} · ${entry.location} · ${entry.classification}`;
    story.textContent = entry.story;
    source.href = entry.source;
    source.textContent = `${entry.sourceLabel} ↗`;
    entry.marker.classList.add('selected');
    entry.button.setAttribute('aria-expanded', 'true');
    card.hidden = false;
    closeButton.focus({ preventScroll: true });
  }

  function showRegion(name) {
    close();
    shown = entries.filter(entry => entry.region === name);
    list.replaceChildren(...shown.map(entry => entry.button));
    pins.replaceChildren(...shown.map(entry => entry.marker));
    list.hidden = shown.length === 0;
    lastFrame = '';
  }

  function update(frame) {
    const pixel = 1 / innerHeight;
    const key = `${frame.x},${frame.y},${frame.scale},${pixel}`;
    if (!shown.length || key === lastFrame) return;
    lastFrame = key;
    for (const { position: [x, y], marker } of shown) {
      marker.setAttribute('transform', `translate(${frame.x + x * frame.scale} ${y * frame.scale - frame.y}) scale(${pixel})`);
    }
  }

  closeButton.addEventListener('click', () => close(true));
  return { close, showRegion, update };
}
