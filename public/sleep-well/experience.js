const opening = document.querySelector('#sleep-well');
const visitors = document.querySelector('#visitors');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
let visitorsReady = false;
let activeChapter = opening;
let openingWindow;
let bridge;
let touchStart = null;
let pausedAudio = [];

function activate(chapter) {
  if (chapter === visitors) {
    opening.contentDocument.querySelectorAll("video").forEach(video => video.pause());
    pausedAudio = [...opening.contentDocument.querySelectorAll('audio')].filter(audio => !audio.paused);
    pausedAudio.forEach(audio => audio.pause());
  }
  const previous = activeChapter;
  activeChapter = chapter;
  previous.inert = true;
  previous.tabIndex = -1;
  previous.setAttribute('aria-hidden', 'true');
  chapter.inert = false;
  chapter.removeAttribute('tabindex');
  chapter.removeAttribute('aria-hidden');
  document.body.dataset.chapter = chapter.id;
  chapter.focus({ preventScroll: true });
  chapter.contentWindow.focus();
  if (chapter === opening) {
    pausedAudio.forEach(audio => audio.play().catch(() => {}));
    pausedAudio = [];
  }
}

function updateHandoff() {
  if (!bridge || activeChapter !== opening) return;
  const { top, height } = bridge.getBoundingClientRect();
  if (top < openingWindow.innerHeight * 3 && !visitors.hasAttribute('src')) {
    visitors.src = visitors.dataset.src;
  }
  if (!visitorsReady || !height) return;
  const progress = Math.min(1, Math.max(0, (openingWindow.innerHeight - top) / height));
  const arrived = top + height <= openingWindow.innerHeight + 2;
  const blend = progress * progress * (3 - 2 * progress);
  visitors.style.opacity = String(arrived ? 1 : reduceMotion.matches ? 0 : blend);
  if (arrived) activate(visitors);
}

function connectOpening() {
  openingWindow = opening.contentWindow;
  bridge = opening.contentDocument.querySelector('#chapter-bridge');
  if (!bridge) return;
  bridge.hidden = false;
  openingWindow.document.documentElement.style.overscrollBehaviorY = 'none';
  openingWindow.addEventListener('scroll', updateHandoff, { passive: true });
  openingWindow.addEventListener('resize', updateHandoff);
  updateHandoff();
}

function returnToOpening() {
  activate(opening);
  const top = bridge.getBoundingClientRect().top + openingWindow.scrollY;
  openingWindow.scrollTo(0, top - openingWindow.innerHeight - 20);
  updateHandoff();
}

function connectVisitors() {
  const view = visitors.contentWindow;
  if (!view.document.querySelector('#world')) return;
  visitorsReady = false;
  view.document.documentElement.style.overscrollBehaviorY = 'none';

  const canReturn = () => activeChapter === visitors && view.scrollY <= 1
    && !view.document.querySelector('dialog[open]');

  view.addEventListener('wheel', event => {
    if (!event.ctrlKey && event.deltaY < 0 && canReturn()) returnToOpening();
  }, { passive: true });

  view.addEventListener('touchstart', event => {
    touchStart = event.touches.length === 1 && canReturn() ? event.touches[0].clientY : null;
  }, { passive: true });
  view.addEventListener('touchmove', event => {
    if (touchStart === null || event.touches.length !== 1 || !canReturn()) return;
    if (event.touches[0].clientY - touchStart < 32) return;
    touchStart = null;
    returnToOpening();
  }, { passive: true });

  view.addEventListener('keydown', event => {
    if (!event.defaultPrevented && ['ArrowUp', 'PageUp'].includes(event.key)
        && !event.altKey && !event.ctrlKey && !event.metaKey && canReturn()) {
      event.preventDefault();
      returnToOpening();
    }
  });

  // The tunnel may still be loading its models when the iframe finishes loading.
  function revealPassage() {
    visitorsReady = true;
    updateHandoff();
  }
  if (view.document.body.dataset.passageReady) revealPassage();
  else view.addEventListener('passage-ready', revealPassage, { once: true });
}

visitors.addEventListener('load', connectVisitors);
if (opening.contentDocument?.querySelector('#chapter-bridge')) {
  connectOpening();
} else {
  opening.addEventListener('load', connectOpening, { once: true });
}
reduceMotion.addEventListener('change', updateHandoff);
