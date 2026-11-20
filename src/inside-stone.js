import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makeFragmentCarouselModel, poseFragment } from '../public/sleep-well/meteorite/fragment-model.js';
import './inside-stone.css';

const host = document.querySelector('.stone-chart');
const stage = host.querySelector('.stone-chart__stage');
const svg = stage.querySelector('svg');
const detail = host.querySelector('.stone-chart__detail');
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const compact = matchMedia('(max-width: 600px)');
const materials = [
  ['Olivine', 55, '#9fcfa0', 'A magnesium–iron silicate forming most of the stone.'],
  ['Pyroxene', 25, '#67ac86', 'A silicate mineral found between the rounded chondrules.'],
  ['Plagioclase + glass', 10, '#3d896d', 'Feldspar and glass preserve traces of heating and melting.'],
  ['Opaque minerals', 10, '#24634f', 'Metal and sulfide grains appear dark in transmitted light.'],
];

function element(parent, tag, attributes) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  parent.append(node);
  return node;
}

const tracking = element(svg, 'g', { class: 'stone-chart__tracking', 'aria-hidden': 'true' });
const line = element(tracking, 'path', { class: 'stone-chart__line', pathLength: 1 });
const nodes = [4, 4].map(r => element(tracking, 'circle', { r }));
const pie = element(svg, 'g', { class: 'stone-chart__pie' });
const leader = element(svg, 'path', { class: 'stone-chart__leader', 'aria-hidden': 'true' });
const close = detail.querySelector('button');

const startAngle = -Math.PI / 2;
let angle = startAngle;
let selected = null;
const slices = materials.map(([name, value, color, description], index) => {
  const start = angle;
  angle += value * Math.PI / 50;
  const group = element(pie, 'g', {
    class: 'stone-chart__sector',
    role: 'button',
    tabindex: -1,
    'aria-label': name + ' · ' + value + '%',
    'aria-expanded': false,
  });
  const visual = element(group, 'g', { class: 'stone-chart__solid' });
  const depth = element(visual, 'g', { class: 'stone-chart__depth', 'aria-hidden': 'true' });
  const walls = ['.59', '.68', '.52'].map(shade =>
    element(depth, 'path', { fill: color, style: 'filter:brightness(' + shade + ')' }));
  const face = element(visual, 'g', { class: 'stone-chart__face' });
  const path = element(face, 'path', { fill: color });
  const hit = element(group, 'path', { class: 'stone-chart__hit' });
  const label = element(face, 'text', { 'text-anchor': 'middle', 'aria-hidden': 'true' });
  const lines = index === 2 ? ['Plagioclase', '+ glass'] :
    index === 3 ? ['Opaque', 'minerals'] : [name];
  lines.push(value + '%');
  const labels = lines.map(text => {
    const row = element(label, 'tspan', {});
    row.textContent = text;
    return row;
  });

  const activate = () => select(selected === index ? null : index);
  group.addEventListener('click', activate);
  group.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    activate();
  });
  const slice = { start, end: angle, group, visual, walls, path, hit, label, labels,
    name, value, description, level: 0, hovered: false, focused: false };
  group.addEventListener('pointerenter', event => {
    if (event.pointerType === 'touch') return;
    slice.hovered = true;
    scheduleLift();
  });
  group.addEventListener('pointerleave', () => {
    slice.hovered = false;
    scheduleLift();
  });
  group.addEventListener('focus', () => {
    slice.focused = group.matches(':focus-visible');
    scheduleLift();
  });
  group.addEventListener('blur', () => {
    slice.focused = false;
    scheduleLift();
  });
  return slice;
});

function select(index) {
  const previous = selected;
  selected = index;
  for (const [i, slice] of slices.entries()) {
    slice.group.classList.toggle('is-selected', i === index);
    slice.group.setAttribute('aria-expanded', String(i === index));
  }
  detail.hidden = index === null;
  if (index !== null) {
    const { name, value, description } = slices[index];
    detail.querySelector('strong').textContent = name + ' · ' + value + '%';
    detail.querySelector('p').textContent = description;
  } else if (document.activeElement === close) {
    slices[previous]?.group.focus();
  }
  paintLeader();
  scheduleLift();
}

close.addEventListener('click', () => select(null));
host.addEventListener('keydown', event => {
  if (event.key === 'Escape' && selected !== null) select(null);
});

let layout;
let progress = 0;
const unit = value => Math.max(0, Math.min(1, value));
const smooth = value => value * value * (3 - 2 * value);
const reveal = (from, to) => smooth(unit((progress - from) / (to - from)));

function place(node, [x, y]) {
  node.setAttribute('cx', x);
  node.setAttribute('cy', y);
}

function resize() {
  layout = compact.matches
    ? { width: 500, height: 365, stone: [416, 171], center: [174, 171], radius: 132,
        trace: [[363, 171], [314, 171]] }
    : { width: 920, height: 412, stone: [746, 206], center: [258, 206], radius: 155,
        trace: [[652, 206], [421, 206]] };
  const { width, height, stone, trace } = layout;
  svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
  stage.style.setProperty('--stone-x', stone[0] / width * 100 + '%');
  stage.style.setProperty('--stone-y', stone[1] / height * 100 + '%');
  place(nodes[0], trace[0]);
  host.style.setProperty('--card-x', layout.center[0] / width * 100 + '%');
  paint();
  paintLift();
}

function paintLeader() {
  if (selected === null) {
    leader.removeAttribute('d');
    return;
  }
  const { center: [x, y], radius, height } = layout;
  const slice = slices[selected];
  const mid = (slice.start + slice.end) / 2;
  const side = Math.sign(Math.cos(mid));
  const [dx, dy] = liftOffset(mid, slice.level);
  const anchor = [x + Math.cos(mid) * radius + dx, y + Math.sin(mid) * radius + dy];
  const outerX = x + side * (radius + 31);
  leader.setAttribute('d', 'M' + anchor + ' H' + outerX + ' V' + (height - 12) +
    ' H' + x + ' V' + height);
}

// Moving along the bisector clears both neighbors before the side wall becomes visible.
function liftOffset(mid, level) {
  return [Math.cos(mid) * 24 * level, (Math.sin(mid) * 24 - 4) * level];
}

function paintLift() {
  const { center, radius } = layout;
  for (const { start, end, level, visual, walls } of slices) {
    const mid = (start + end) / 2;
    const offset = liftOffset(mid, level);
    visual.setAttribute('transform', 'translate(' + offset.join(' ') + ')');
    const thickness = 8 * level;
    const polar = angle => [
      center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius,
    ];
    const lower = ([x, y]) => [x, y + thickness];
    const edge = point => 'M' + center + ' L' + point + ' L' + lower(point) +
      ' L' + lower(center) + ' Z';

    // Only the walls facing the viewer are visible in this projection.
    const from = Math.max(start, 0);
    const to = Math.min(end, Math.PI);
    const arc = radius + ',' + radius + ' 0 0 ';
    walls[0].setAttribute('d', thickness && from < to
      ? 'M' + polar(from) + ' A' + arc + '1 ' + polar(to) + ' L' + lower(polar(to)) +
        ' A' + arc + '0 ' + lower(polar(from)) + ' Z'
      : '');
    walls[1].setAttribute('d', thickness && Math.cos(start) < 0 ? edge(polar(start)) : '');
    walls[2].setAttribute('d', thickness && Math.cos(end) > 0 ? edge(polar(end)) : '');
  }
  const { trace } = layout;
  const [chartOffset] = liftOffset((slices[0].start + slices[0].end) / 2, slices[0].level);
  const chartEnd = [trace[1][0] + chartOffset, trace[1][1]];
  place(nodes[1], chartEnd);
  line.setAttribute('d', 'M' + trace[0] + ' L' + chartEnd);
  paintLeader();
}

let liftFrame = 0;
let lastLiftTime = null;
function scheduleLift() {
  if (!liftFrame) liftFrame = requestAnimationFrame(animateLift);
}

function animateLift(now) {
  liftFrame = 0;
  const delta = Math.min(40, now - (lastLiftTime ?? now - 16));
  lastLiftTime = now;
  let moving = false;
  slices.forEach((slice, i) => {
    const target = Number(slice.hovered || slice.focused || i === selected);
    const remaining = target - slice.level;
    if (reduce.matches || Math.abs(remaining) < .006) {
      slice.level = target;
    } else {
      slice.level += remaining * (1 - Math.exp(-delta / 62));
      moving = true;
    }
  });
  paintLift();
  if (moving) scheduleLift();
  else lastLiftTime = null;
}

function paint() {
  const { center, radius } = layout;
  const stone = reveal(0, .23);
  const track = reveal(.22, .54);
  const sweep = startAngle + reveal(.52, .92) * Math.PI * 2;
  stage.style.setProperty('--stone-opacity', stone);
  stage.style.setProperty('--stone-offset', (1 - stone) * 14 + 'px');
  line.style.strokeDashoffset = 1 - track;
  nodes[0].style.opacity = reveal(.19, .26);
  nodes[1].style.opacity = reveal(.49, .55);

  const polar = (a, r) => [center[0] + Math.cos(a) * r, center[1] + Math.sin(a) * r];
  for (const { start, end, group, path, hit, label, labels } of slices) {
    const visibleEnd = Math.min(end, sweep);
    const span = visibleEnd - start;
    const faceShape = span > 0
      ? 'M' + center + ' L' + polar(start, radius) + ' A' + radius + ',' + radius +
        ' 0 ' + Number(span > Math.PI) + ' 1 ' + polar(visibleEnd, radius) + ' Z'
      : '';
    path.setAttribute('d', faceShape);
    hit.setAttribute('d', faceShape);
    const narrowSlice = end - start < 1;
    const [x, y] = polar((start + end) / 2, radius * (narrowSlice ? .76 : .69));
    const lineHeight = compact.matches ? 18 : 17;
    labels.forEach((row, index) => {
      row.setAttribute('x', x);
      row.setAttribute('y', y + (index - (labels.length - 1) / 2) * lineHeight + 6);
      // The first line of the 10% plagioclase wedge has the least horizontal room.
      if (row.textContent === 'Plagioclase') {
        row.setAttribute('textLength', compact.matches ? '53' : '64');
        row.setAttribute('lengthAdjust', 'spacingAndGlyphs');
      }
    });
    label.style.opacity = unit((sweep - end + .11) / .11);
    group.style.pointerEvents = progress >= .92 ? '' : 'none';
    group.setAttribute('tabindex', progress >= .92 ? '0' : '-1');
  }
}

let ready = false;
let entered = false;
let started = false;
function play() {
  if (!ready || !entered || started || document.body.classList.contains('is-loading')) return;
  started = true;
  let start;
  function frame(now) {
    start ??= now;
    progress = reduce.matches ? 1 : unit((now - start) / 1850);
    paint();
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

resize();
compact.addEventListener('change', resize);
reduce.addEventListener('change', scheduleLift);
new IntersectionObserver(([entry]) => {
  entered = entry.isIntersecting;
  play();
}, { threshold: .18 }).observe(stage);
new MutationObserver(play).observe(document.body, { attributes: true, attributeFilter: ['class'] });

async function renderStone() {
  const canvas = host.querySelector('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(220, 220, false);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 20);
  camera.position.z = 2.3;
  const asset = new URL('../models/chelyabinsk-main-mass.glb', document.baseURI);
  const { scene: specimen } = await new GLTFLoader().loadAsync(asset.href);
  const stone = makeFragmentCarouselModel(THREE, specimen);
  poseFragment(stone, 6);
  scene.add(stone);
  renderer.render(scene, camera);
}


renderStone()
  .catch(error => console.error('Could not render the composition specimen', error))
  .finally(() => {
    ready = true;
    play();
  });
