import './style.css';
import { paintSky } from './sky.js';
import { createStage } from './stage.js';
import { archiveArrival, archiveSlide, clamp, ease, mix, passageEnd, passageRest, passageSpan, powerInOut, scrollRate } from './motion.js';
import { chapterTop, specimenView, storyAt } from './visitors-timeline.js';

const get = id => document.getElementById(id);
const experience = get('experience');
const canvas = get('stage');
const sky = get('sky');
const leaders = get('leaders');
const pen = leaders.getContext('2d');
const status = get('specimen-status');
const annotations = get('annotations');
const hitTarget = get('hit-target');
const explore = get('explore');
const scrollCue = get('scroll-cue');
const cueText = get('cue-text');
const detail = get('detail');
const detailModel = get('detail-model');
const detailScroll = get('detail-scroll');
const closeDetail = get('close-detail');
const labels = [get('sample'), get('classify'), explore];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const embedded = experience.hasAttribute('data-story-specimen');
const scrollLock = 'specimen-archive-lock';

const visibleAnnotationLimit = .325;
const opening = -1;

let stage;
let width = innerWidth;
let height = innerHeight;
let target = opening;
let buffered = opening;
let progress = opening;
let focus = 0;
let detailRequested = false;
let restoreFocus = null;
let openingPointer = { x: 0, y: 0 };
let lastFrame = 0;
let ambient = 0;
let touchY = null;
let ready = false;
let velocity = 0;
let settle = null;
let lastInput = Infinity;
let atEnd = false;
let closeTimer = 0;
let animationFrame = 0;
let storyView = null;
let archiveScrollY = null;
const pointer = { x: 0, y: 0 };
const aim = { x: 0, y: 0 };
let surfacePointer = null;
let pendingPointer = false;
let tracing = false;
let specimenPress = null;
let modelDrag = null;
const orbit = { yaw: 0, pitch: 0 };
const orbitTarget = { yaw: 0, pitch: 0 };

export function setStoryView(view) {
  storyView = view;
  if (detailRequested || detail.open) return;
  experience.hidden = !view.visible;
  experience.inert = !view.interactive;
  if (!view.interactive && surfacePointer) resetPointer();
}

function resize() {
  width = innerWidth;
  height = innerHeight;
  const dpr = Math.min(devicePixelRatio, 1.65);
  leaders.width = Math.round(width * dpr);
  leaders.height = Math.round(height * dpr);
  pen.setTransform(leaders.width / width, 0, 0, leaders.height / height, 0, 0);
  if (stage) stage.resize(width, height);
  else paintSky(sky, width, height, false, embedded);
}

function setView(value, isInput = false) {
  settle = null;
  lastInput = isInput ? performance.now() : Infinity;
  target = clamp(value, opening, passageEnd);
  if (reducedMotion.matches) progress = buffered = target;
}

function moveBy(pixels) {
  if (!stage) return;
  if (reducedMotion.matches) {
    const stops = [opening, 0, passageRest, passageEnd];
    const next = pixels > 0 ? stops.find(stop => stop > progress) ?? passageEnd :
      stops.findLast(stop => stop < progress) ?? opening;
    if (Math.abs(pixels) > 6) setView(next);
    return;
  }
  const limit = 750 * scrollRate;
  setView(clamp(target + pixels * scrollRate, progress - limit, progress + limit), true);
}

if (!embedded) experience.addEventListener('wheel', event => {
  if (event.ctrlKey || detailRequested || detail.open) return;
  event.preventDefault();
  const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1;
  moveBy(event.deltaY * units);
}, { passive: false });

if (!embedded) experience.addEventListener('touchstart', event => {
  touchY = event.touches.length === 1 ? event.touches[0].clientY : null;
}, { passive: true });
if (!embedded) experience.addEventListener('touchmove', event => {
  if (touchY === null || detailRequested || event.touches.length !== 1) return;
  const nextY = event.touches[0].clientY;
  moveBy((touchY - nextY) * 1.25);
  touchY = nextY;
}, { passive: true });

experience.addEventListener('pointermove', event => {
  if (event.pointerType === 'touch' || detailRequested) return;
  aim.x = clamp((event.clientX / width - .5) * 2, -1, 1);
  aim.y = clamp((.5 - event.clientY / height) * 2, -1, 1);
  surfacePointer = { x: event.clientX, y: event.clientY };
  pendingPointer = true;
  if (specimenPress && event.buttons &&
    Math.hypot(event.clientX - specimenPress.x, event.clientY - specimenPress.y) > 8) {
    specimenPress.dragged = true;
  }
});
function resetPointer() {
  aim.x = aim.y = 0;
  surfacePointer = null;
  pendingPointer = true;
}

experience.addEventListener('pointerleave', resetPointer);
addEventListener('blur', resetPointer);

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && detailRequested && !detail.open) {
    event.preventDefault();
    exitArchive();
    return;
  }
  if (embedded) return;
  if (detail.open || detailRequested || event.altKey || event.metaKey || event.ctrlKey) return;
  const movements = { ArrowDown: 150, ArrowUp: -150, PageDown: height * .83, PageUp: height * -.83 };
  if (event.key in movements) {
    event.preventDefault();
    moveBy(movements[event.key]);
  } else if (stage && (event.key === 'Home' || event.key === 'End')) {
    event.preventDefault();
    setView(event.key === 'Home' ? opening : passageEnd);
  }
});

function openArchive(from) {
  if (detailRequested || detail.open || (stage && explore.disabled)) return;
  restoreFocus = from === hitTarget ? explore : from;
  history.pushState({ ...history.state, specimenArchive: true }, '', '#specimen');
  syncArchive(true);
}

function syncArchive(open) {
  detailRequested = open;
  experience.classList.toggle('archive-active', open);
  if (embedded && open && archiveScrollY === null) {
    archiveScrollY = scrollY;
    scrollTo({ top: archiveScrollY, behavior: 'instant' });
    document.body.classList.add(scrollLock);
  }
  clearTimeout(closeTimer);
  if (open) {
    setView(progress);
    buffered = progress;
    openingPointer = { ...pointer };
    if (detail.open) {
      detail.classList.add('is-open');
      return;
    }
    if (!stage || reducedMotion.matches) showArchivePanel();
    return;
  }

  detail.classList.remove('is-open');
  endModelDrag();
  const finishClose = () => {
    if (detail.open) detail.close();
    if (embedded) {
      document.body.classList.remove(scrollLock);
      if (archiveScrollY !== null) {
        scrollTo({ top: archiveScrollY, behavior: 'instant' });
        archiveScrollY = null;
      }
      if (storyView) setStoryView(storyView);
    }
  };
  if (detail.open) closeTimer = setTimeout(finishClose, reducedMotion.matches ? 0 : 600);
  else finishClose();
}

function showArchivePanel() {
  detail.showModal();
  detailScroll.scrollTop = 0;
  closeDetail.focus({ preventScroll: true });
  requestAnimationFrame(() => {
    if (detailRequested) detail.classList.add('is-open');
  });
}

function exitArchive() {
  if (history.state?.specimenArchive) history.back();
  else {
    history.replaceState(history.state, '', location.pathname + location.search);
    syncArchive(false);
  }
}

closeDetail.addEventListener('click', exitArchive);
detail.addEventListener('cancel', event => {
  event.preventDefault();
  exitArchive();
});
addEventListener('popstate', () => {
  if (location.hash === '#specimen') {
    recoverArchiveView();
    syncArchive(true);
  } else if (detailRequested || detail.open) syncArchive(false);
});
explore.addEventListener('click', () => openArchive(explore));
hitTarget.addEventListener('pointerdown', event => {
  specimenPress = { x: event.clientX, y: event.clientY, dragged: false };
});
hitTarget.addEventListener('click', event => {
  const dragged = specimenPress?.dragged || (specimenPress &&
    Math.hypot(event.clientX - specimenPress.x, event.clientY - specimenPress.y) > 8);
  specimenPress = null;
  if (!dragged && stage?.hitTest(event.clientX, event.clientY)) openArchive(hitTarget);
});

function endModelDrag(event) {
  if (!modelDrag || (event && event.pointerId !== modelDrag.id)) return;
  const { id } = modelDrag;
  modelDrag = null;
  detailModel.classList.remove('is-dragging');
  if (detailModel.hasPointerCapture(id)) detailModel.releasePointerCapture(id);
}

function turnModel(yaw, pitch) {
  orbitTarget.yaw += yaw;
  orbitTarget.pitch = clamp(orbitTarget.pitch + pitch, -1.18, 1.18);
}

detailModel.addEventListener('pointerdown', event => {
  if (modelDrag || event.button !== 0 || !detailRequested || focus < .88 ||
      !stage?.hitTest(event.clientX, event.clientY)) return;
  modelDrag = { id: event.pointerId, x: event.clientX, y: event.clientY };
  detailModel.focus({ preventScroll: true });
  detailModel.setPointerCapture(event.pointerId);
  detailModel.style.cursor = '';
  detailModel.classList.add('is-dragging');
  event.preventDefault();
});

detailModel.addEventListener('pointermove', event => {
  if (!modelDrag) {
    const visibleModel = detailRequested && focus >= .88 && stage?.hitTest(event.clientX, event.clientY);
    detailModel.style.cursor = visibleModel ? 'grab' : '';
    return;
  }
  if (event.pointerId !== modelDrag.id) return;
  const sensitivity = Math.PI / Math.max(200, Math.min(width * .51, height * .70));
  turnModel((event.clientX - modelDrag.x) * sensitivity, (event.clientY - modelDrag.y) * sensitivity);
  modelDrag.x = event.clientX;
  modelDrag.y = event.clientY;
});

for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  detailModel.addEventListener(event, endModelDrag);
}

detailModel.addEventListener('keydown', event => {
  const direction = {
    ArrowLeft: [-.19, 0], ArrowRight: [.19, 0], ArrowUp: [0, -.15], ArrowDown: [0, .15],
  }[event.key];
  if (!direction || !detailRequested) return;
  event.preventDefault();
  turnModel(...direction);
});

get('home')?.addEventListener('click', () => setView(opening));
scrollCue?.addEventListener('click', () =>
  setView(progress < -.02 ? 0 : progress < 1 ? passageRest : atEnd ? opening : passageEnd));


function labelPosition(label, x, y) {
  const boxWidth = label.offsetWidth;
  const boxHeight = label.offsetHeight;
  const left = clamp(Math.round(x), 22, width - boxWidth - 22);
  const top = Math.round(y);
  label.style.transform = `translate3d(${left}px, ${top}px, 0)`;
  return { x: left, y: top, width: boxWidth, height: boxHeight };
}

function leader(label, point, right, hot) {
  const y = label.y + label.height - .5;
  const x = label.x + (right ? 0 : label.width);
  const elbow = x + (right ? -1 : 1) * 14;
  pen.strokeStyle = hot ? '#9b4450' : '#394155a6';
  pen.lineWidth = hot ? 1.35 : .8;
  pen.beginPath();
  pen.moveTo(x, y);
  pen.lineTo(elbow, y);
  pen.lineTo(point.x, point.y);
  pen.stroke();
  pen.beginPath();
  pen.moveTo(point.x - 4, point.y);
  pen.lineTo(point.x + 4, point.y);
  pen.moveTo(point.x, point.y - 4);
  pen.lineTo(point.x, point.y + 4);
  pen.stroke();
}

function updateLabels() {
  const [sample, classification, action] = labels;
  const opacity = ease(-.30, -.13, progress) *
    (1 - ease(.21, visibleAnnotationLimit, progress)) * (1 - ease(0, .42, focus));
  const showLabels = opacity > .01;
  const canExplore = (ready || experience.classList.contains('fallback')) && showLabels &&
    !detailRequested && !detail.open && (!embedded || storyView?.interactive);
  annotations.hidden = !showLabels;
  annotations.style.opacity = opacity;
  explore.disabled = !canExplore;
  hitTarget.hidden = !stage || !canExplore;
  hitTarget.disabled = hitTarget.hidden;
  if (canExplore && !detail.open && restoreFocus) {
    restoreFocus.focus({ preventScroll: true });
    restoreFocus = null;
  }
  pen.clearRect(0, 0, width, height);
  if (!showLabels || !stage) return;

  const { points, bounds, center } = stage.getLabelsGeometry();
  const compact = width <= 760;
  const sampleX = center.x - width * (compact ? .34 : .177);
  const sampleY = center.y - height * .366;
  const classX = center.x + width * .107;
  const exploreX = center.x + width * (compact ? .07 : .058);

  const labelBoxes = [
    labelPosition(sample, sampleX, embedded && compact ? Math.max(sampleY, 88) : sampleY),
    labelPosition(classification, classX, center.y - height * .229),
    labelPosition(action, exploreX, center.y + height * .12),
  ];
  const hot = experience.classList.contains('is-hovered') || explore.matches(':hover, :focus-visible');
  pen.globalAlpha = opacity;
  leader(labelBoxes[0], points[0], false, hot);
  if (!compact) leader(labelBoxes[1], points[1], true, false);
  leader(labelBoxes[2], points[2], true, hot);

  hitTarget.style.transform = `translate3d(${bounds.left}px, ${bounds.top}px, 0)`;
  hitTarget.style.width = `${bounds.right - bounds.left}px`;
  hitTarget.style.height = `${bounds.bottom - bounds.top}px`;
}

function updateCue() {
  const end = progress > passageEnd - .02;
  if (end === atEnd) return;
  atEnd = end;
  cueText.textContent = end ? 'RETURN' : 'SCROLL';
  scrollCue.querySelector('.arrow').textContent = end ? '↺' : '↓';
}

function updateScroll(now, ticks) {
  const previous = progress;
  if (!settle && now - lastInput > 1400) {
    lastInput = Infinity;
    if (target > opening + .01 && target < -.01) {
      const next = target < -.5 ? opening : 0;
      settle = { from: progress, to: next, start: now, duration: next === opening ? 2000 : 2400 };
    } else if (target > .01 && target < 1) {
      const next = target < .5 ? 0 : passageRest;
      settle = { from: progress, to: next, start: now, duration: next === 0 ? 2000 : 2600 };
    } else if (target >= 1 && progress < passageEnd - .01) {
      // Preserve the reference's forward drift through the tunnel until the last requested ring.
      const next = .76 * passageSpan;
      settle = { from: progress, to: next, start: now, duration: clamp((next - progress) * 4, 2, 20) * 1000 };
    }
  }
  if (settle) {
    const t = clamp((now - settle.start) / settle.duration);
    progress = buffered = target = Math.min(passageEnd, mix(settle.from, settle.to, powerInOut(t, 3)));
    if (t === 1 || progress === passageEnd) settle = null;
  } else {
    const filtered = (target - buffered) * (1 - .925 ** ticks);
    const limit = 100 * scrollRate * ticks;
    buffered += clamp(filtered, -limit, limit);
    progress = mix(progress, buffered, 1 - .85 ** ticks);
    if (Math.abs(target - progress) < .1 * scrollRate) progress = buffered = target;
  }
  velocity = clamp((velocity + Math.abs(progress - previous)) * .98 ** ticks);
}

function frame(now) {
  const dt = lastFrame ? Math.min(.05, (now - lastFrame) / 1000) : 1 / 60;
  lastFrame = now;
  const ticks = 60 * dt;
  const motion = reducedMotion.matches || storyView?.paused ? 0 : 1;
  animationFrame = requestAnimationFrame(frame);
  if (embedded && !storyView?.visible && !detailRequested && !detail.open) return;
  if (!detailRequested && !detail.open && focus === 0) {
    if (embedded && storyView) {
      const previous = progress;
      progress = stage ? storyView.progress : 0;
      velocity = motion ? clamp((velocity + Math.abs(progress - previous)) * .98 ** ticks) : 0;
    } else if (motion) updateScroll(now, ticks);
  }
  const focusDuration = detailRequested ? archiveArrival : 1.25;
  focus = motion ? clamp(focus + (detailRequested ? dt : -dt) / focusDuration) : Number(detailRequested);
  if (focus < .001) focus = 0;
  if (focus > .999) focus = 1;
  if (detailRequested && !detail.open && (!stage || focus >= archiveSlide / archiveArrival)) {
    showArchivePanel();
  }
  if (focus === 0 && !detailRequested) {
    orbit.yaw = orbit.pitch = orbitTarget.yaw = orbitTarget.pitch = 0;
  }
  const dragFollow = motion ? 1 - Math.exp(-dt / .075) : 1;
  orbit.yaw = mix(orbit.yaw, orbitTarget.yaw, dragFollow);
  orbit.pitch = mix(orbit.pitch, orbitTarget.pitch, dragFollow);
  if (detailRequested || detail.open) {
    Object.assign(pointer, openingPointer);
  } else {
    // Frame-rate independent damping with no overshoot when the pointer stops.
    const follow = 1 - Math.exp(-dt / .14);
    pointer.x = mix(pointer.x, aim.x, follow);
    pointer.y = mix(pointer.y, aim.y, follow);
    ambient += dt;
  }
  const canTrace = Boolean(stage && motion && !detailRequested && !detail.open && Math.abs(progress) < .30);
  if (pendingPointer || tracing !== canTrace) {
    const hit = stage?.tracePointer(surfacePointer?.x, surfacePointer?.y, Boolean(canTrace && surfacePointer));
    hitTarget.style.cursor = hit ? 'pointer' : 'default';
    experience.classList.toggle('is-hovered', Boolean(hit));
    pendingPointer = false;
    tracing = canTrace;
  }
  stage?.render(progress, focus, pointer, ambient, motion, velocity, orbit, storyView?.portal);
  updateLabels();
  if (scrollCue) updateCue();
}

function showFallback(message) {
  stage = null;
  canvas.hidden = true;
  leaders.hidden = true;
  status.textContent = message;
  document.body.classList.add('no-model');
  experience.classList.add('fallback');
  if (scrollCue) scrollCue.disabled = true;
  target = buffered = progress = 0;
}

addEventListener('resize', resize);
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  showFallback('3D VIEW INTERRUPTED · RELOAD TO RETRY');
});
canvas.addEventListener('webglcontextrestored', () => location.reload());
resize();
function recoverArchiveView() {
  if (embedded && (!storyView?.interactive || Math.abs(storyView.progress) > .21)) {
    scrollTo({ top: chapterTop(1), behavior: 'instant' });
    setStoryView(specimenView(storyAt(scrollY), reducedMotion.matches));
  }
}

function openInitialArchive() {
  if (location.hash !== '#specimen') return;
  recoverArchiveView();
  target = buffered = progress = 0;
  syncArchive(true);
}

createStage(canvas, sky, embedded).then(result => {
  stage = result;
  resize();
  ready = true;
  status.hidden = true;
  openInitialArchive();
  animationFrame = requestAnimationFrame(frame);
}).catch(error => {
  console.error(error);
  showFallback('3D VIEW UNAVAILABLE · THE SPECIMEN RECORD IS STILL OPENABLE');
  openInitialArchive();
  animationFrame = requestAnimationFrame(frame);
});
addEventListener('pagehide', () => cancelAnimationFrame(animationFrame));
addEventListener('pageshow', event => {
  if (event.persisted) animationFrame = requestAnimationFrame(frame);
});
