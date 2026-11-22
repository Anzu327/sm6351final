import { chartReturnSpan, clamp, ease, mix } from './motion.js';
import { storyStage } from './visitors-dom.js';
import { chartHoldSpan, chartTransitionSpan, enableChartTransition } from './visitors-timeline.js';

export function createRegionChartTransition() {
  const anchor = document.getElementById('region-chord-anchor');
  const outro = document.getElementById('chelyabinsk-outro');
  if (!anchor || !outro || matchMedia('(prefers-reduced-motion: reduce)').matches) return () => null;

  const section = anchor.querySelector('#region-chord');
  const panel = section.querySelector('.chord-panel');
  const svg = panel.querySelector('svg');
  const frame = { progress: 0, returning: 0, x: 0, y: 0, radius: 0 };
  let span;
  let returnSpan;
  let lastDistance;
  let sectionHeight = 0;
  const labelRevealStart = .86;
  function resize() {
    sectionHeight = section.offsetHeight;
    anchor.style.setProperty('--chart-overlap', `${innerHeight}px`);
    span = chartTransitionSpan * innerHeight;
    returnSpan = chartReturnSpan * innerHeight;
    anchor.style.setProperty('--chart-tail', `${returnSpan + chartHoldSpan * innerHeight}px`);
    lastDistance = undefined;
  }
  anchor.classList.add('has-chart-transition');
  resize();
  enableChartTransition();
  outro.dataset.sharedSky = '';
  addEventListener('resize', resize);
  new ResizeObserver(resize).observe(section);

  return function update() {
    const distance = anchor.getBoundingClientRect().top;
    if (distance === lastDistance) return frame.progress ? frame : null;
    lastDistance = distance;
    const entry = distance <= 1 ? 1 : clamp(1 - distance / span);
    const pinTop = Math.min(0, innerHeight - sectionHeight);
    const returning = clamp((pinTop - chartHoldSpan * innerHeight - distance) / returnSpan);
    const leaving = returning > 0 && returning < 1;
    const finished = returning === 1;
    const closing = finished && outro.getBoundingClientRect().bottom > 0;
    const moving = leaving || (entry > 0 && entry < 1);
    const progress = leaving || closing ? mix(1, .64, ease(0, .51, returning)) : entry;
    frame.progress = progress;
    frame.returning = leaving || closing ? returning : 0;
    storyStage?.classList.toggle('is-chart-bridging', moving || closing);
    section.classList.toggle('is-bridging', moving);
    anchor.classList.toggle('is-returned', finished);
    // Labels become interactive as soon as they start to appear, in either direction.
    section.inert = progress <= labelRevealStart || finished;
    let shift = finished ? 0 : Math.max(0, pinTop - distance);
    if (moving && !leaving) {
      shift = -distance;
    }
    section.style.setProperty('--chart-shift', `${shift}px`);
    if (finished && !closing) {
      frame.progress = 0;
      return null;
    }
    if (!moving && !closing) return entry ? frame : null;
    const edge = ease(.72, .975, progress);
    const alpha = ease(.73, 1, progress);
    const styles = {
      '--chart-background-alpha': alpha,
      '--chart-ring-alpha': ease(.64, .85, progress),
      '--chart-edge-alpha': ease(.70, .83, progress),
      '--chart-edge-offset': 1 - edge,
      '--chart-label-alpha': ease(labelRevealStart, 1, progress),
    };
    for (const [name, value] of Object.entries(styles)) section.style.setProperty(name, value);

    const bounds = panel.getBoundingClientRect();
    const ring = svg.querySelector('.chord-ring');
    frame.x = bounds.left + bounds.width / 2;
    const center = bounds.top + bounds.height / 2;
    frame.y = leaving ? mix(center, innerHeight / 2, ease(.22, .45, returning)) : center;
    frame.radius = bounds.width * Number(ring?.getAttribute('r') ?? 330) / svg.viewBox.baseVal.width;
    return frame;
  };
}
