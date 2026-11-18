import { clamp, ease, mix, passageSpan, scrollRate } from './motion.js';

// The legacy renderer still reads its original story coordinates. Only the stone
// interval gets extra space so the existing passage can play at its own pace.
const stone = {
  enter: .68,
  display: 1.19,
  system: 2.30,
};
const finalRingEntry = .42 * passageSpan;
const finalRingExit = .52 * passageSpan;
const chapterStops = [0, stone.display, 2.50, 3.98, 5.32];
export const startsInPassage = new URLSearchParams(window.location.search).get('entry') === 'passage';

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
    [4, system + 8.8 * height],
    [4.19, system + 9.45 * height],
    [5.32, system + 11.25 * height],
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

// The book leads into the existing tunnel at its first fully revealed frame.
const passageEntry = stone.display + (stone.system - stone.display) / finalRingExit;
const entryOffset = () => startsInPassage ? mapTimeline(passageEntry, 0, 1) : 0;
export const storyAt = pixels => mapTimeline(pixels + entryOffset(), 1, 0);
export const storyTop = position => Math.max(0, mapTimeline(position, 0, 1) - entryOffset());
export const chapterTop = chapter => storyTop(chapterStops[chapter]);

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
  document.getElementById('scroll-story').style.height = `${storyTop(chapterStops.at(-1)) + innerHeight}px`;
}
