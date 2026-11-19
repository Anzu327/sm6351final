import catalogue from './data/meteorite-catalogue.json';
import { featuredMeteorites } from './data/featured-meteorites.js';
import featuredPhotos from './data/featured-photos.json';

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
  const leader = document.querySelector('#meteorite-leader');
  const line = leader.querySelector('path');
  const end = leader.querySelector('circle');
  const closeButton = card.querySelector('button');
  const title = card.querySelector('h3');
  const subtitle = card.querySelector('.meteorite-card-subtitle');
  const location = card.querySelector('.meteorite-card-location');
  const story = card.querySelector('.meteorite-card-story');
  const source = card.querySelector('.meteorite-card-source');
  const photo = card.querySelector('.meteorite-photo img');
  const credit = card.querySelector('.meteorite-photo-credit');
  const license = card.querySelector('.meteorite-photo-license');
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
    const hit = marker.querySelector('.pin-hit');
    const entry = { ...record, classification: row[4], position, button, marker, hit };
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
    leader.setAttribute('hidden', '');
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
    const image = featuredPhotos[entry.id];
    photo.alt = image.alt;
    photo.src = `${import.meta.env.BASE_URL}visitors/featured/${entry.id}.webp`;
    credit.href = image.source;
    credit.textContent = image.author;
    license.href = image.licenseUrl;
    license.textContent = image.license;
    source.href = entry.source;
    source.textContent = `${entry.sourceLabel} ↗`;
    entry.marker.classList.add('selected');
    entry.button.setAttribute('aria-expanded', 'true');
    card.hidden = false;
    updateLeader();
    closeButton.focus({ preventScroll: true });
  }

  function updateLeader() {
    if (!active) return;
    const marker = active.hit.getBoundingClientRect();
    const x = marker.left + marker.width / 2;
    const y = marker.top + marker.height / 2;
    if (!marker.width || x < 0 || y < 0 || x > innerWidth || y > innerHeight) {
      leader.setAttribute('hidden', '');
      return;
    }
    const narrow = innerWidth <= 760;
    const dock = narrow
      ? (y > innerHeight * .52 ? 'top' : 'bottom')
      : (x < innerWidth / 2 ? 'right' : 'left');
    if (card.dataset.dock !== dock) card.dataset.dock = dock;
    const box = card.getBoundingClientRect();
    const endX = narrow
      ? box.left + (x < innerWidth / 2 ? .65 : .35) * box.width
      : (dock === 'right' ? box.left : box.right);
    const endY = narrow
      ? (dock === 'top' ? box.bottom : box.top)
      : Math.min(box.bottom - 12, photo.getBoundingClientRect().top + 38);
    const path = narrow
      ? `M${x} ${y} L${endX} ${endY + (dock === 'top' ? 14 : -14)} V${endY}`
      : `M${x} ${y} L${endX + (dock === 'right' ? -18 : 18)} ${endY} H${endX}`;
    line.setAttribute('d', path);
    end.setAttribute('cx', endX);
    end.setAttribute('cy', endY);
    leader.setAttribute('viewBox', `0 0 ${innerWidth} ${innerHeight}`);
    leader.removeAttribute('hidden');
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
    const key = `${frame.x},${frame.y},${frame.scale},${pixel},${innerWidth}`;
    if (!shown.length || key === lastFrame) return;
    lastFrame = key;
    for (const { position: [x, y], marker } of shown) {
      marker.setAttribute('transform', `translate(${frame.x + x * frame.scale} ${y * frame.scale - frame.y}) scale(${pixel})`);
    }
    updateLeader();
  }

  closeButton.addEventListener('click', () => close(true));
  new ResizeObserver(updateLeader).observe(card);
  return { close, showRegion, update };
}
