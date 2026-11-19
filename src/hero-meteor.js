import { createPaintedFireball } from './painted-fireball.js';

const hero = document.querySelector('.hero');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const delay = 650;
const duration = 4800;
const flightEnd = 1.35;
// The fireball flies behind the depth-writing hills in the opening model.
const skyDepth = -5.85;
const scrollExit = 0.22;
const stillFrame = 0.60;
let view;
let fireball;
let frame = 0;
let startedAt;
let slide = 0;
let finished = false;

function smoothStep(from, to, value) {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

function paint(flight, still = false) {
  const { group, update } = fireball;
  const { camera } = view;
  const distance = camera.position.z - skyDepth;
  const halfHeight = Math.tan(camera.fov * Math.PI / 360) * distance;
  const halfWidth = halfHeight * camera.aspect;
  const portrait = 1 - smoothStep(0.55, 1.25, camera.aspect);
  const entrance = still ? 1 : smoothStep(0, 0.16, flight);
  const scrollFade = 1 - smoothStep(0, scrollExit, slide);

  const scale = Math.min(0.08 * distance, halfWidth * 0.23);
  const horizontalTravel = (1.64 - 0.32 * portrait) * halfWidth;
  const verticalTravel = 0.26 * halfHeight;
  const bend = (0.78 + 0.26 * portrait) * halfHeight;
  group.scale.setScalar(scale);
  group.position.set(
    1.07 * halfWidth - horizontalTravel * flight,
    0.60 + 0.56 * halfHeight - (verticalTravel + bend * flight) * flight,
    skyDepth,
  );
  update(flight, entrance * scrollFade, scrollFade, {
    x: horizontalTravel / scale,
    y: (verticalTravel + 2 * bend * flight) / scale,
    bend: bend / scale,
  });
  group.visible = scrollFade > 0;
}

function tick(now) {
  frame = 0;
  startedAt ??= now;
  const flight = (now - startedAt - delay) / duration;
  if (flight >= flightEnd || slide >= scrollExit) {
    finished = true;
    fireball.group.visible = false;
    return;
  }

  if (flight >= 0) paint(flight);
  frame = requestAnimationFrame(tick);
}

function start() {
  if (!fireball || frame || finished || document.body.classList.contains('is-loading')) return;
  if (reduced.matches) {
    paint(stillFrame, true);
    return;
  }
  frame = requestAnimationFrame(tick);
}

function attach() {
  if (fireball || !hero.heroMeteorScene) return;
  view = hero.heroMeteorScene;
  fireball = createPaintedFireball();
  fireball.group.visible = false;
  view.parent.add(fireball.group);
  start();
}

hero.addEventListener('hero-meteor-ready', attach);
hero.addEventListener('hero-scroll-progress', event => {
  slide = event.detail;
  if (reduced.matches) start();
});

const loadingObserver = new MutationObserver(() => {
  if (!document.body.classList.contains('is-loading')) {
    loadingObserver.disconnect();
    start();
  }
});
loadingObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
window.addEventListener('resize', () => {
  if (reduced.matches) start();
});
attach();
