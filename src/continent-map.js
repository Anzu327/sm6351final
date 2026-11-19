import regions from './data/continent-outlines.json';
import { ease, mix } from './motion.js';

const svgNamespace = 'http://www.w3.org/2000/svg';
const centerY = .015;

export function createContinentMap() {
  const panel = document.querySelector('#continent-controls');
  const menu = document.querySelector('#continent-menu');
  const detail = document.querySelector('#continent-detail');
  const label = detail.querySelector('strong');
  const back = detail.querySelector('button');
  const overlay = document.querySelector('#continent-overlay');
  const group = overlay.querySelector('g');
  const legend = document.querySelector('#heatmap-legend strong');
  const overviewLegend = legend.textContent;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let selected = null;
  let ready = false;
  let view;
  let lastAspect;
  let lastTransform;

  const choices = regions.map(region => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = region.name;
    const path = document.createElementNS(svgNamespace, 'path');
    path.setAttribute('d', region.path);
    path.setAttribute('fill-rule', 'evenodd');
    path.setAttribute('vector-effect', 'non-scaling-stroke');
    const title = document.createElementNS(svgNamespace, 'title');
    title.textContent = region.name;
    path.append(title);
    group.append(path);
    menu.append(button);
    const choice = { ...region, button, path };
    button.addEventListener('click', () => select(choice));
    path.addEventListener('click', () => select(choice));
    button.addEventListener('focus', () => path.classList.add('highlighted'));
    button.addEventListener('blur', () => path.classList.remove('highlighted'));
    return choice;
  });

  function select(choice, moveFocus = true) {
    const previous = selected;
    selected = choice;
    menu.hidden = Boolean(choice);
    detail.hidden = !choice;
    label.textContent = choice?.name ?? '';
    legend.textContent = choice ? 'GLOBAL DENSITY SCALE' : overviewLegend;
    overlay.toggleAttribute('data-focused', Boolean(choice));
    for (const item of choices) item.path.classList.toggle('selected', item === choice);
    if (moveFocus) (choice ? back : previous?.button)?.focus({ preventScroll: true });
  }

  back.addEventListener('click', () => select(null));
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !selected || !ready) return;
    event.preventDefault();
    select(null);
  });

  function update(morph, aspect, worldScale, dt) {
    const unfolded = morph >= .999;
    if (ready !== unfolded) {
      ready = unfolded;
      panel.hidden = !ready;
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
    }
    return framed;
  }

  return { update };
}
