import { atmosphericLine, crustBars, grainScatter, mineralRanges, orbitArea, veinRanges } from './composition-charts.js';
import { ease } from './motion.js';

const topics = {
  orbit: [orbitArea, 'Area chart of modeled distance from the Sun, from 0.74 to 2.79 AU'],
  drift: [veinRanges, 'Impact melt vein widths on a log scale: fine 10 to 100, coarse 500 to 2,000 micrometers'],
  sun: [grainScatter, 'Scatterplot of magnesium-to-iron ratios in 13 paired olivine and chromite samples'],
  earth: [mineralRanges, 'Modal mineral abundance: olivine 50–60%, pyroxene 20–30%, plagioclase and glass 5–10%, opaque minerals 5–10%'],
  near: [atmosphericLine, 'Altitude over time: first detected at 97.1 km, main brightness peak at 29.7 km, last detected at 13.6 km'],
  pass: [crustBars, 'Grouped bar chart of silicon, iron, and magnesium oxides in olivine from light lithology and fusion crust'],
};

export function bindComposition(section) {
  const chartResize = new ResizeObserver(entries => {
    for (const { target } of entries) {
      const width = target.clientWidth;
      if (!width || target.dataset.chartWidth === String(width)) continue;

      const [render] = topics[target.parentElement.dataset.topic];
      render(target);
      target.dataset.chartWidth = width;
    }
  });

  for (const panel of section.querySelectorAll('.composition__chart')) {
    const graphic = panel.querySelector('.composition__graphic');
    const [, label] = topics[panel.dataset.topic];
    graphic.setAttribute('aria-label', label);
    chartResize.observe(graphic);
  }

  const track = section.querySelector('.composition');
  const rail = track.querySelector('.composition__specimen');
  const steps = [...track.querySelectorAll('.composition__step')];
  const scenes = steps.map(step => step.firstElementChild);
  const previous = section.previousElementSibling;
  const source = previous.querySelector('[data-composition-link]');
  const bridge = section.querySelector('.composition__bridge');
  const ink = bridge.querySelector('linearGradient');
  const path = bridge.querySelector('path');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;

  function drawBridge() {
    const matrix = source.getScreenCTM();
    if (!matrix) return;
    const length = source.getTotalLength();
    // Begin under the fading tail of the previous chapter's center line.
    const start = source.getPointAtLength(length * .83).matrixTransform(matrix);
    const end = source.getPointAtLength(length).matrixTransform(matrix);
    const origin = section.getBoundingClientRect();
    const top = Math.floor(start.y - origin.top);
    const trackTop = track.getBoundingClientRect().top - origin.top - top;
    const railBox = rail.getBoundingClientRect();
    const x = end.x - origin.left;
    const railX = railBox.left + railBox.width / 2 - origin.left;
    const startY = start.y - origin.top - top;
    const endY = end.y - origin.top - top;
    const bend = Math.max(0, (trackTop - endY) * .55);
    bridge.style.top = `${top}px`;
    bridge.style.height = `${Math.ceil(trackTop) + 2}px`;
    ink.setAttribute('y1', startY);
    ink.setAttribute('y2', endY);
    path.setAttribute('d', `M${x} ${startY} V${endY} C${x} ${endY + bend} ${railX} ${trackTop - bend} ${railX} ${trackTop + 1}`);
  }

  function renderSteps() {
    frame = 0;
    const viewport = innerHeight;
    const readingLine = viewport * .52;
    const transition = Math.min(140, viewport * .16);
    const hold = Math.min(40, viewport * .045);
    const bounds = steps.map(step => step.getBoundingClientRect());
    scenes.forEach((scene, index) => {
      const { top, bottom } = bounds[index];
      const isLast = index === steps.length - 1;
      const enterAt = index === 0 ? viewport : readingLine;
      const entering = ease(0, transition, enterAt - top);
      const leaving = isLast ? 1 : ease(0, transition, bottom - readingLine);
      const offset = top + Math.min(70, Math.max(0, (bottom - top - viewport) / 2));
      const holdWeight = 1 - ease(hold, transition, Math.abs(offset));
      // Let the final scene share the rail's natural upward movement when it unpins.
      const exitWeight = isLast ? ease(0, transition, bottom - viewport) : 1;
      const y = (leaving - entering) * 24 - offset * holdWeight * exitWeight;
      scene.style.opacity = Math.min(entering, leaving);
      scene.style.transform = `translateY(${y}px)`;
    });
  }

  function queueSteps() {
    if (!frame && !reducedMotion.matches) frame = requestAnimationFrame(renderSteps);
  }

  function syncMotion() {
    if (reducedMotion.matches) {
      cancelAnimationFrame(frame);
      frame = 0;
      for (const scene of scenes) {
        scene.style.removeProperty('opacity');
        scene.style.removeProperty('transform');
      }
    }
    queueSteps();
  }

  const layout = new ResizeObserver(() => {
    drawBridge();
    queueSteps();
  });
  for (const element of [previous, section, track]) layout.observe(element);
  addEventListener('resize', drawBridge, { passive: true });
  addEventListener('scroll', queueSteps, { passive: true });
  reducedMotion.addEventListener('change', syncMotion);
  syncMotion();
}
