import { createPaintedFireball } from './painted-fireball.js';

const hero = document.querySelector('.hero');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const delay = 650;
const duration = 4400;
let view;
let fireball;
let frame = 0;
let startedAt;
let slide = 0;
let finished = false;

function paint(flight) {
  const { group, update } = fireball;
  const halfHeight = Math.tan(view.camera.fov*Math.PI/360)*6;
  const halfWidth = halfHeight*view.camera.aspect;
  group.scale.setScalar(Math.min(.48,halfWidth*.23));
  group.position.set(halfWidth*(.52-.94*flight), 1.36-.44*flight, 0);
  update(flight*2, flight);
}

function tick(now) {
  frame = 0;
  startedAt ??= now;
  const flight = Math.max(0,Math.min(1,(now-startedAt-delay)/duration));
  if (flight >= 1 || slide >= .18) {
    finished = true;
    fireball.group.visible = false;
    return;
  }
  fireball.group.visible = now-startedAt >= delay;
  if (fireball.group.visible) paint(flight);
  frame = requestAnimationFrame(tick);
}

function start() {
  if (!fireball || frame || finished || document.body.classList.contains('is-loading')) return;
  if (reduced.matches) {
    fireball.group.visible = slide === 0;
    paint(.26);
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

hero.addEventListener('hero-meteor-ready',attach);
hero.addEventListener('hero-scroll-progress', event => {
  slide = event.detail;
  if (!fireball || slide < .18) return;
  fireball.group.visible = false;
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  finished = true;
});
const loadingObserver = new MutationObserver(() => {
  if (!document.body.classList.contains('is-loading')) {
    loadingObserver.disconnect();
    start();
  }
});
loadingObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
window.addEventListener('resize', () => {
  if (fireball?.group.visible && reduced.matches) paint(.26);
});
attach();
