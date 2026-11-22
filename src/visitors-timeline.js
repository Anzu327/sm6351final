import { clamp, ease, mix, passageEntryProgress, passageSpan, scrollRate } from './motion.js';
import { storySection, visitorsRoot } from './visitors-dom.js';

// The legacy renderer still reads its original story coordinates. Only the stone
// interval gets extra space so the existing passage can play at its own pace.
const stone = {
  enter: .68,
  display: 1.19,
  system: 2.30,
};
const finalRingEntry = .42 * passageSpan;
const finalRingExit = .52 * passageSpan;
export const earthReady = 3.96;
const earthStop = 4;
const earthHold = .85;
const chapterStops = [0, stone.display, 2.50, earthStop, 5.32];
const mapHold = .58;
export const chartTransitionSpan = 2.50;
export const chartHoldSpan = .32;
let chartTransitionEnabled = false;
export const startsInPassage = Boolean(storySection) || new URLSearchParams(window.location.search).get('entry') === 'passage';

function timeline() {
  const height = window.innerHeight;
  const enter = .935 * height;
  const display = enter + clamp(.85 * height, 580, 950);
  const system = display + finalRingExit / scrollRate;
  return [
    [0, 0],
    [stone.enter, enter],
    [stone.display, display],
    [stone.system, system],
    [2.95, system + 2.8 * height],
    [3.58, system + 6.2 * height],
    [3.82, system + 7.4 * height],
    [earthStop, system + 8.8 * height],
    [4.19, system + (9.45 + earthHold) * height],
    [5.32, system + (11.25 + earthHold) * height],
  ];
}

function mapTimeline(value, from, to) {
  const stops = timeline();
  const index = stops.findIndex(stop => stop[from] >= value);
  if (index === 0) return 0;
  if (index === -1) return stops.at(-1)[to];
  const start = stops[index - 1];
  const end = stops[index];
  return mix(start[to], end[to], (value - start[from]) / (end[from] - start[from]));
}

// The opening leads into the tunnel at its first fully revealed frame.
const passageEntry = mix(stone.display, stone.system, passageEntryProgress / finalRingExit);
const entryOffset = () => startsInPassage ? mapTimeline(passageEntry, 0, 1) : 0;
const sectionTop = () => storySection ? scrollY + storySection.getBoundingClientRect().top : 0;
const localTop = position => Math.max(0, mapTimeline(position, 0, 1) - entryOffset());
export const storyAt = pixels => mapTimeline(Math.max(0, pixels - sectionTop()) + entryOffset(), 1, 0);
export const storyTop = position => sectionTop() + localTop(position);
export const chapterTop = chapter => storyTop(chapterStops[chapter]);

export function installStoryScrollStops() {
  const chart = document.getElementById('region-chord-anchor');
  const chartSection = chart?.querySelector('#region-chord');
  const settleDelay = 180;
  let previousY = scrollY;
  let direction = 0;
  let active = false;
  let touching = false;
  let timer;

  function isScrollLocked() {
    return document.body.matches('.visitors-atlas-open, .specimen-archive-lock') ||
      visitorsRoot.querySelector('dialog[open]');
  }

  function nearbyStop(y) {
    const down = direction > 0;
    const earthEdge = storyTop(down ? earthReady : 4.19);
    if (down ? y < earthEdge && earthEdge - y <= .30 * innerHeight :
      y > earthEdge && y - earthEdge <= .18 * innerHeight) {
      return storyTop(down ? earthReady + .006 : 4.185);
    }

    if (chartTransitionEnabled && chartSection) {
      const chartTop = y + chart.getBoundingClientRect().top;
      if (down && y < chartTop - 1 && chartTop - y <= .24 * innerHeight) return chartTop;
      const overflow = Math.max(0, chartSection.offsetHeight - innerHeight);
      const chartEnd = chartTop + overflow + chartHoldSpan * innerHeight;
      if (!down && y > chartEnd && y - chartEnd <= .16 * innerHeight) return chartEnd - 2;
    }
  }

  function cancelAlignment() {
    clearTimeout(timer);
    active = false;
    touching = false;
    direction = 0;
  }

  function waitForRest() {
    clearTimeout(timer);
    if (!active || touching) return;
    timer = setTimeout(() => {
      const top = direction ? nearbyStop(scrollY) : undefined;
      cancelAlignment();
      // Only settle a gesture that actually ended just outside an interactive range.
      if (top == null || isScrollLocked() || Math.abs(scrollY - top) < 1) return;
      window.scrollTo({ top, behavior: 'instant' });
      window.dispatchEvent(new Event('visitors:scroll-stop'));
    }, settleDelay);
  }

  window.addEventListener('wheel', event => {
    if (event.ctrlKey || !event.deltaY || event.defaultPrevented || isScrollLocked()) return;
    active = true;
    waitForRest();
  }, { capture: true, passive: true });

  window.addEventListener('touchstart', event => {
    cancelAlignment();
    active = touching = event.touches.length === 1 && !isScrollLocked();
  }, { passive: true });
  function endTouch() {
    touching = false;
    waitForRest();
  }
  window.addEventListener('touchend', endTouch, { passive: true });
  window.addEventListener('touchcancel', endTouch, { passive: true });

  // Mouse drags (including the scrollbar) and keyboard navigation stay native.
  window.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') cancelAlignment();
  }, { capture: true });
  window.addEventListener('keydown', cancelAlignment, { capture: true });
  window.addEventListener('blur', cancelAlignment);

  window.addEventListener('scroll', () => {
    const y = scrollY;
    if (active && y !== previousY) {
      direction = Math.sign(y - previousY);
      waitForRest();
    }
    previousY = y;
  }, { passive: true });
}

export function specimenView(position, paused) {
  const progress = position <= stone.display
    ? clamp((position - stone.enter) / (stone.display - stone.enter) - 1, -1, 0)
    : finalRingExit * clamp((position - stone.display) / (stone.system - stone.display));
  const portal = ease(finalRingEntry, finalRingExit, progress);
  const visible = position > stone.enter && position < stone.system;
  return {
    visible,
    progress,
    portal,
    coversBackdrop: visible && progress >= 0 && portal === 0,
    interactive: visible && progress >= -.3 && portal === 0,
    paused,
  };
}

export function resizeStory() {
  const section = storySection ?? visitorsRoot.getElementById('scroll-story');
  const tail = chartTransitionEnabled ? 1 + mapHold + chartTransitionSpan : 1;
  section.style.height = `${localTop(chapterStops.at(-1)) + tail * innerHeight}px`;
}

export function enableChartTransition() {
  chartTransitionEnabled = true;
  resizeStory();
}
