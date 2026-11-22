import { visitorsRoot } from './visitors-dom.js';
import regions from './data/continent-outlines.json';
import { ease, mix } from './motion.js';
import { createContinentMeteorites } from './continent-meteorites.js';

const svgNamespace = 'http://www.w3.org/2000/svg';
const centerY = .015;

export function createContinentMap() {
  const hint = visitorsRoot.querySelector('#continent-hint');
  const overlay = visitorsRoot.querySelector('#continent-overlay');
  const group = overlay.querySelector('#continent-regions');
  const meteorites = createContinentMeteorites(overlay);
  const legend = visitorsRoot.querySelector('#heatmap-legend strong');
  const overviewLegend = legend.textContent;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let selected = null;
  let ready = false;
  let view;
  let lastAspect;
  let lastTransform;

  const choices = regions.map(region => {
    const path = document.createElementNS(svgNamespace, 'path');
    path.setAttribute('d', region.path);
    path.setAttribute('fill-rule', 'evenodd');
    path.setAttribute('vector-effect', 'non-scaling-stroke');
    path.setAttribute('role', 'button');
    path.setAttribute('tabindex', '0');
    path.setAttribute('aria-label', region.name);
    path.setAttribute('aria-pressed', 'false');
    const title = document.createElementNS(svgNamespace, 'title');
    title.textContent = region.name;
    path.append(title);
    group.append(path);
    const choice = { ...region, path };
    path.addEventListener('click', () => select(selected === choice ? null : choice));
    path.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      select(selected === choice ? null : choice);
    });
    return choice;
  });

  function select(choice, moveFocus = true) {
    if (choice === selected) return;
    const previous = selected;
    selected = choice;
    hint.textContent = choice
      ? `${choice.name} · Select it again or press Esc for the world map.`
      : 'World map.';
    meteorites.showRegion(choice?.name);
    legend.textContent = choice ? 'GLOBAL DENSITY SCALE' : overviewLegend;
    overlay.toggleAttribute('data-focused', Boolean(choice));
    for (const item of choices) {
      item.path.setAttribute('aria-pressed', String(item === choice));
    }
    if (moveFocus) (choice?.path ?? previous?.path)?.focus({ preventScroll: true });
  }

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !selected || !ready) return;
    event.preventDefault();
    if (!meteorites.close(true)) select(null);
  });

  function update(morph, aspect, worldScale, dt) {
    const unfolded = morph >= .999;
    if (ready !== unfolded) {
      ready = unfolded;
      overlay.toggleAttribute('hidden', !ready);
      if (!ready && selected) select(null, false);
    }
    const target = { x: 0, y: centerY, scale: worldScale };
    if (selected) {
      const [left, top, right, bottom] = selected.bounds;
      const height = aspect < .85 ? .50 : .61;
      target.scale = Math.max(worldScale, Math.min(aspect * .86 / (right - left), height / (bottom - top)));
      target.x = -(right + left) / 2 * target.scale;
      target.y += (top + bottom) / 2 * target.scale;
    }
    if (!view || morph === 0 || reducedMotion.matches) view = target;
    else {
      const follow = 1 - Math.exp(-Math.min(dt, .1) * 12);
      for (const key of ['x', 'y', 'scale']) {
        view[key] = Math.abs(view[key] - target[key]) < .00005
          ? target[key] : mix(view[key], target[key], follow);
      }
    }
    const strength = ease(.82, 1, morph);
    const framed = {
      x: view.x * strength,
      y: mix(centerY, view.y, strength),
      scale: mix(worldScale, view.scale, strength),
    };
    if (ready) {
      if (lastAspect !== aspect) {
        overlay.setAttribute('viewBox', `${-aspect / 2} -.5 ${aspect} 1`);
        lastAspect = aspect;
      }
      const transform = `translate(${framed.x} ${-framed.y}) scale(${framed.scale})`;
      if (lastTransform !== transform) {
        group.setAttribute('transform', transform);
        lastTransform = transform;
      }
      meteorites.update(framed);
    }
    return framed;
  }

  return { update };
}
