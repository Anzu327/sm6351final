import { visitorsRoot } from './visitors-dom.js';
import { assetBase } from './asset-base.js';
import { mapPoint } from './equal-earth.js';
import catalogue from './data/meteorite-catalogue.json';
import { featuredMeteorites } from './data/featured-meteorites.js';
import featuredPhotos from './data/featured-photos.json';

const svgNamespace = 'http://www.w3.org/2000/svg';
const massFormat = new Intl.NumberFormat('en', { maximumSignificantDigits: 4 });

export function createContinentMeteorites(overlay) {
  const pins = overlay.querySelector('#meteorite-pins');
  const card = visitorsRoot.querySelector('#meteorite-card');
  const leader = visitorsRoot.querySelector('#meteorite-leader');
  const line = leader.querySelector('path');
  const end = leader.querySelector('circle');
  const closeButton = card.querySelector('button');
  const kind = card.querySelector('.meteorite-card-kind');
  const title = card.querySelector('h3');
  const subtitle = card.querySelector('.meteorite-card-subtitle');
  const location = card.querySelector('.meteorite-card-location');
  const facts = card.querySelector('.meteorite-card-facts');
  const story = card.querySelector('.meteorite-card-story');
  const photo = card.querySelector('.meteorite-photo img');
  const caption = card.querySelector('.meteorite-photo figcaption');
  let active = null;
  let shown = [];
  let lastFrame = '';

  const entries = featuredMeteorites.flatMap(record => {
    if (!featuredPhotos[record.id]) return [];
    const row = catalogue.rows.find(([id]) => id === record.id);
    if (!row || !Number.isFinite(row[6]) || !Number.isFinite(row[7])) return [];
    const [, name, year, mass, classification, status, lat, lon, , place] = row;
    const position = mapPoint(lon, lat);
    const displayTitle = record.title ?? name;
    const marker = document.createElementNS(svgNamespace, 'g');
    marker.classList.add('meteorite-pin');
    marker.setAttribute('role', 'button');
    marker.setAttribute('tabindex', '0');
    marker.setAttribute('aria-label', displayTitle);
    marker.setAttribute('aria-controls', card.id);
    marker.setAttribute('aria-expanded', 'false');
    marker.innerHTML = `
      <circle class="pin-hit" r="14"/>
      <path class="pin-drop" d="M0 0C-3 -4 -8 -8 -8 -13A8 8 0 1 1 8 -13C8 -8 3 -4 0 0Z"/>
      <circle class="pin-center" cy="-13" r="2.3"/>`;
    const tooltip = document.createElementNS(svgNamespace, 'title');
    tooltip.textContent = displayTitle;
    marker.append(tooltip);
    const hit = marker.querySelector('.pin-hit');
    const entry = {
      ...record,
      title: displayTitle,
      date: record.date ?? String(year),
      location: record.location ?? place,
      classification, status, mass, lat, lon, position, marker, hit,
    };
    marker.addEventListener('click', () => open(entry));
    marker.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      open(entry);
    });
    return [entry];
  });

  function close(restoreFocus = false) {
    const previous = active;
    active = null;
    card.hidden = true;
    leader.setAttribute('hidden', '');
    previous?.marker.classList.remove('selected');
    previous?.marker.setAttribute('aria-expanded', 'false');
    if (restoreFocus) previous?.marker.focus({ preventScroll: true });
    return Boolean(previous);
  }

  function open(entry) {
    close();
    active = entry;
    kind.textContent = entry.status === 'Fell' ? 'OBSERVED FALL' : 'RECORDED FIND';
    title.textContent = entry.title;
    subtitle.textContent = entry.chinese ?? '';
    subtitle.hidden = !entry.chinese;
    location.textContent = `${entry.date} · ${entry.location} · ${entry.classification}`;
    const coordinates = `${Math.abs(entry.lat).toFixed(2)}° ${entry.lat < 0 ? 'S' : 'N'}, ${Math.abs(entry.lon).toFixed(2)}° ${entry.lon < 0 ? 'W' : 'E'}`;
    const mass = entry.mass >= 1000 ? `${massFormat.format(entry.mass / 1000)} kg` : `${massFormat.format(entry.mass)} g`;
    facts.textContent = [entry.mass > 0 ? `Catalogue mass: ${mass}` : '', coordinates].filter(Boolean).join(' · ');
    story.textContent = entry.story ?? '';
    story.hidden = !entry.story;
    const image = featuredPhotos[entry.id];
    photo.alt = image.alt;
    photo.src = `${assetBase}visitors/featured/${entry.id}.webp`;
    caption.textContent = [image.label, image.author, image.license, 'Resized to WebP'].filter(Boolean).join(' · ');
    entry.marker.classList.add('selected');
    entry.marker.setAttribute('aria-expanded', 'true');
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
      : Math.min(box.bottom - 12, photo.getBoundingClientRect().top + 24);
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
    for (const { marker } of shown) marker.removeAttribute('transform');
    pins.replaceChildren(...shown.map(entry => entry.marker));
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
