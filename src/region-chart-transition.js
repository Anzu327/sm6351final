import { chartReturnSpan, clamp, ease, mix } from './motion.js';
import { storyStage } from './visitors-dom.js';
import { chartTransitionSpan, enableChartTransition } from './visitors-timeline.js';

export function createRegionChartTransition() {
  const anchor = document.getElementById('region-chord-anchor');
  if (!anchor || matchMedia('(prefers-reduced-motion: reduce)').matches) return () => null;

  const section = anchor.querySelector('#region-chord');
  const panel = section.querySelector('.chord-panel');
  const svg = panel.querySelector('svg');
  const frame = { progress: 0, returning: 0, x: 0, y: 0, radius: 0 };
  let span;
  let returnSpan;
  let lastDistance;
  let sectionHeight = 0;
  function resize() {
    sectionHeight = section.offsetHeight;
    anchor.style.setProperty('--chart-overlap', `${innerHeight}px`);
    span = chartTransitionSpan * innerHeight;
    returnSpan = chartReturnSpan * innerHeight;
    anchor.style.setProperty('--chart-return-span', `${returnSpan + .28 * innerHeight}px`);
    lastDistance = undefined;
  }
  anchor.classList.add('has-chart-transition');
  resize();
  enableChartTransition();
  addEventListener('resize', resize);
  new ResizeObserver(resize).observe(section);

  return function update() {
    const distance = anchor.getBoundingClientRect().top;
    if (distance === lastDistance) return frame.progress ? frame : null;
    lastDistance = distance;
    const entry = distance <= 1 ? 1 : clamp(1 - distance / span);
    const returning = clamp((-distance - Math.max(0, sectionHeight - innerHeight) - .28 * innerHeight) / returnSpan);
    const leaving = returning > 0 && returning < 1;
    const finished = returning === 1;
    const moving = leaving || (entry > 0 && entry < 1);
    const progress = leaving ? mix(1, .64, ease(0, .51, returning)) : entry;
    frame.progress = progress;
    frame.returning = leaving ? returning : 0;
    storyStage?.classList.toggle('is-chart-bridging', moving);
    section.classList.toggle('is-bridging', moving);
    anchor.classList.toggle('is-returned', finished);
    anchor.classList.toggle('is-returning', leaving);
    anchor.style.setProperty('--chart-return-fade', ease(.92, 1, returning));
    section.inert = moving || finished;
    const pinTop = Math.min(0, innerHeight - sectionHeight);
    let shift = finished ? 0 : Math.max(0, pinTop - distance);
    if (leaving) {
      const bounds = panel.getBoundingClientRect();
      const chartCenter = bounds.top + bounds.height / 2 - section.getBoundingClientRect().top;
      shift += (innerHeight / 2 - chartCenter - pinTop) * ease(0, .27, returning);
    } else if (moving) {
      shift = -distance;
    }
    section.style.setProperty('--chart-shift', `${shift}px`);
    if (!moving) {
      return entry ? frame : null;
    }
    const edge = ease(.72, .975, progress);
    const alpha = ease(.73, 1, progress);
    const styles = {
      '--chart-background-alpha': alpha,
      '--chart-ring-alpha': ease(.64, .85, progress),
      '--chart-edge-alpha': ease(.70, .83, progress),
      '--chart-edge-offset': 1 - edge,
      '--chart-label-alpha': ease(.86, 1, progress),
    };
    for (const [name, value] of Object.entries(styles)) section.style.setProperty(name, value);

    const bounds = panel.getBoundingClientRect();
    const ring = svg.querySelector('.chord-ring');
    frame.x = bounds.left + bounds.width / 2;
    frame.y = bounds.top + bounds.height / 2;
    frame.radius = bounds.width * Number(ring?.getAttribute('r') ?? 330) / svg.viewBox.baseVal.width;
    return frame;
  };
}
