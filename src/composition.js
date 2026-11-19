import { atmosphericLine, crustBars, grainScatter, mineralRanges, orbitArea, veinRanges } from './composition-charts.js';

const topics = {
  orbit: [orbitArea, 'Area chart of modeled distance from the Sun, from 0.74 to 2.79 AU',
    'M2 13 6 10 9 4 12 9 16 12V15H2Z'],
  drift: [veinRanges, 'Impact melt vein widths on a log scale: fine 10 to 100, coarse 500 to 2,000 micrometers',
    'M2 5H9M7 12H16M2 3V7M9 3V7M7 10V14M16 10V14'],
  sun: [grainScatter, 'Scatterplot of magnesium-to-iron ratios in 13 paired olivine and chromite samples',
    'M4 12h.01M8 9h.01M9 5h.01M14 7h.01M15 3h.01'],
  earth: [mineralRanges, 'Modal mineral abundance: olivine 50–60%, pyroxene 20–30%, plagioclase and glass 5–10%, opaque minerals 5–10%',
    'M2 4H16M2 9H11M2 14H7'],
  near: [atmosphericLine, 'Altitude over time: first detected at 97.1 km, main brightness peak at 29.7 km, last detected at 13.6 km',
    'M2 3 6 7 9 6 12 11 16 14'],
  pass: [crustBars, 'Grouped bar chart of silicon, iron, and magnesium oxides in olivine from light lithology and fusion crust',
    'M2 15V8M6 15V4M11 15V6M15 15V10'],
};

export function bindComposition(section) {
  const diagram = section.querySelector('.composition');
  const stage = diagram.querySelector('.composition__stage');
  const buttons = [...stage.querySelectorAll('[data-topic]')];
  const note = diagram.querySelector('.composition__note');
  const graphic = note.querySelector('.composition__graphic');
  const leader = diagram.querySelector('.composition__leader');
  const leaderLabel = diagram.querySelector('.composition__leader-label');
  const ink = diagram.querySelector('.composition__leader-ink');
  const hit = diagram.querySelector('.composition__leader-hit');
  const desktop = matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let active = null;
  let pinned = null;
  let closeTimer = 0;
  let positionFrame = 0;
  let leaderFrame = 0;
  let previewing = false;
  let pointerOverChart = false;

  function draw() {
    graphic.replaceChildren();
    const [render, label] = topics[active.dataset.topic];
    graphic.setAttribute('aria-label', label);
    render(graphic);
  }

  function setLeader(path) {
    for (const leader of [ink, hit]) {
      if (path) leader.setAttribute('d', path);
      else leader.removeAttribute('d');
    }
  }

  function edge(rect, toward) {
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const dx = toward.left + toward.width / 2 - x;
    const dy = toward.top + toward.height / 2 - y;
    const length = Math.max(Math.abs(dx) / (rect.width / 2), Math.abs(dy) / (rect.height / 2));
    return length ? [x + dx / length, y + dy / length] : [x, y];
  }

  function updateCenteredLeader() {
    if (!active || !note.hasAttribute('data-centered')) return;
    const word = active.getBoundingClientRect();
    if (word.bottom <= 0 || word.top >= innerHeight) {
      active.removeAttribute('data-leader-relocated');
      leaderLabel.hidden = true;
      setLeader(null);
      return;
    }
    const chart = note.getBoundingClientRect();
    // Use the panel's settled bounds to keep the label stable during entry.
    const left = (innerWidth - note.offsetWidth) / 2;
    const top = (innerHeight - note.offsetHeight) / 2;
    const right = innerWidth - left;
    const bottom = innerHeight - top;
    const gap = 22;
    const covered = word.right > left && word.left < right && word.bottom > top && word.top < bottom;
    active.toggleAttribute('data-leader-relocated', covered);
    leaderLabel.hidden = !covered;
    let anchor = word;
    if (covered) {
      const width = leaderLabel.offsetWidth;
      const height = leaderLabel.offsetHeight;
      const centerX = word.left + word.width / 2;
      const centerY = word.top + word.height / 2;
      const onLeft = centerX < innerWidth / 2;
      // Repeat the selected label outside the chart if the original is obscured.
      if (left >= width + gap + 12) {
        leaderLabel.style.left = `${onLeft ? left - gap - width : right + gap}px`;
        leaderLabel.style.top = `${Math.max(top, Math.min(centerY - height / 2, bottom - height))}px`;
      } else {
        const above = centerY < innerHeight / 2;
        leaderLabel.style.left = `${Math.max(left, Math.min(centerX - width / 2, right - width))}px`;
        leaderLabel.style.top = `${above ? Math.max(8, top - gap - height) : Math.min(innerHeight - height - 8, bottom + gap)}px`;
      }
      anchor = leaderLabel.getBoundingClientRect();
    }
    const [x1, y1] = edge(anchor, chart);
    const [x2, y2] = edge(chart, anchor);
    setLeader(`M${x1},${y1} L${x2},${y2}`);
  }

  function queueCenteredLeader() {
    if (leaderFrame || !active || !note.hasAttribute('data-centered')) return;
    leaderFrame = requestAnimationFrame(() => {
      leaderFrame = 0;
      updateCenteredLeader();
      if (note.getAnimations().some(animation => animation.playState === 'running')) queueCenteredLeader();
    });
  }

  function position() {
    const centered = desktop.matches;
    note.toggleAttribute('data-centered', centered);
    note.toggleAttribute('data-below', !centered);
    const parent = centered ? document.body : diagram;
    if (note.parentElement !== parent) parent.append(leader, leaderLabel, note);
    leader.toggleAttribute('data-centered', centered);
    draw();
    if (centered) {
      updateCenteredLeader();
      return;
    }
    active.removeAttribute('data-leader-relocated');
    leaderLabel.hidden = true;

    const bounds = stage.getBoundingClientRect();
    const word = active.getBoundingClientRect();
    const centerX = (word.left + word.right) / 2;
    const centerY = (word.top + word.bottom) / 2;
    const onRight = centerX >= (bounds.left + bounds.right) / 2;
    const noteBox = note.getBoundingClientRect();
    const endX = (onRight ? noteBox.right - 16 : noteBox.left + 16) - bounds.left;
    const endY = noteBox.top - bounds.top;
    const column = onRight ? bounds.width - 8 : 8;
    const startX = (onRight ? word.right : word.left) - bounds.left;
    setLeader(`M${startX},${centerY - bounds.top} H${column} V${endY - 8} H${endX} V${endY}`);
  }

  function show(button, fromMouse = false) {
    clearTimeout(closeTimer);
    if (fromMouse) previewing = true;
    if (active === button) return;
    previewing = fromMouse;
    pointerOverChart = false;
    const opening = !active;
    active?.removeAttribute('data-active');
    active?.removeAttribute('data-leader-relocated');
    active = button;
    if (!button) {
      note.getAnimations().forEach(animation => animation.cancel());
      note.hidden = true;
      leaderLabel.hidden = true;
      setLeader(null);
      return;
    }
    button.setAttribute('data-active', '');
    leaderLabel.replaceChildren(...[...button.childNodes].map(node => node.cloneNode(true)));
    note.setAttribute('aria-label', `${button.textContent.trim()} chart`);
    note.hidden = false;
    position();
    if (!opening || !fromMouse || reducedMotion.matches || !desktop.matches) return;
    const word = button.getBoundingClientRect();
    const chart = note.getBoundingClientRect();
    const x = (word.left + word.width / 2 - chart.left - chart.width / 2) * 0.1;
    const y = (word.top + word.height / 2 - chart.top - chart.height / 2) * 0.1;
    note.animate([
      { transform: `translate(${x}px, ${y}px) scale(0.93)`, opacity: 0 },
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
    ], { duration: 220, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
    queueCenteredLeader();
  }

  function setPinned(button) {
    pinned?.setAttribute('aria-pressed', 'false');
    pinned = button;
    pinned?.setAttribute('aria-pressed', 'true');
    note.toggleAttribute('data-pinned', Boolean(pinned));
    show(button);
  }

  function leave() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (!pointerOverChart) show(pinned);
    }, 220);
  }

  for (const button of buttons) {
    button.insertAdjacentHTML('afterbegin', `<svg class="composition__topic-icon" viewBox="0 0 18 18" aria-hidden="true"><path d="${topics[button.dataset.topic][2]}"/></svg>`);
    button.setAttribute('aria-controls', note.id);
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse') show(button, true);
    });
    button.addEventListener('pointerleave', leave);
    button.addEventListener('focus', () => {
      if (button.matches(':focus-visible')) show(button);
    });
    button.addEventListener('blur', leave);
    button.addEventListener('click', () => {
      setPinned(pinned === button ? null : button);
      if (pinned && note.hasAttribute('data-below')) {
        note.scrollIntoView({ block: 'nearest', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
      }
    });
  }
  for (const target of [note, hit]) {
    target.addEventListener('pointerenter', () => clearTimeout(closeTimer));
    target.addEventListener('pointerleave', leave);
  }
  // The centered preview lets pointer events through to the six underlying buttons.
  document.addEventListener('pointermove', event => {
    if (!previewing || !active || pinned || !desktop.matches || event.pointerType !== 'mouse') return;
    const rect = note.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right &&
      event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (inside === pointerOverChart) return;
    pointerOverChart = inside;
    if (inside) clearTimeout(closeTimer);
    else if (!active.contains(event.target)) leave();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && active) setPinned(null);
  });
  document.addEventListener('pointerdown', event => {
    if (active && !event.target.closest('[data-topic], .composition__note')) setPinned(null);
  });
  addEventListener('scroll', queueCenteredLeader, { passive: true });
  addEventListener('resize', () => {
    cancelAnimationFrame(positionFrame);
    positionFrame = requestAnimationFrame(() => {
      if (!active) return;
      if (active.offsetWidth) position();
      else setPinned(null);
    });
  });
}
