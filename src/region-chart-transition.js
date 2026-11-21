import { clamp, ease } from './motion.js';
import { chartTransitionSpan, enableChartTransition } from './visitors-timeline.js';

export function createRegionChartTransition() {
  const anchor = document.getElementById('region-chord-anchor');
  if (!anchor || matchMedia('(prefers-reduced-motion: reduce)').matches) return () => null;

  const section = anchor.querySelector('#region-chord');
  const panel = section.querySelector('.chord-panel');
  const svg = panel.querySelector('svg');
  const frame = { progress: 0, x: 0, y: 0, radius: 0 };
  let span;
  let lastDistance;
  function resize() {
    anchor.style.setProperty('--chart-overlap', `${innerHeight}px`);
    span = chartTransitionSpan * innerHeight;
    lastDistance = undefined;
  }
  resize();
  anchor.classList.add('has-chart-transition');
  enableChartTransition();
  addEventListener('resize', resize);

  return function update() {
    const distance = anchor.getBoundingClientRect().top;
    if (distance === lastDistance) return frame.progress ? frame : null;
    lastDistance = distance;
    const progress = distance <= 1 ? 1 : clamp(1 - distance / span);
    const moving = progress > 0 && progress < 1;
    const wasMoving = frame.progress > 0 && frame.progress < 1;
    frame.progress = progress;
    if (moving !== wasMoving) {
      section.classList.toggle('is-bridging', moving);
      section.inert = moving;
    }

    if (!moving) return progress ? frame : null;
    const edge = ease(.72, .975, progress);
    const alpha = ease(.73, 1, progress);
    const styles = {
      '--chart-shift': `${-distance}px`,
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
