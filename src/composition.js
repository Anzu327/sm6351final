import { altitudePlot, grainBoundaries, mineralRanges } from './composition-charts.js';

const popova = { label: 'Popova et al. · Science', url: 'https://doi.org/10.1126/science.1242642' };
const kaeter = { label: 'Kaeter et al. · Meteoritics & Planetary Science', url: 'https://doi.org/10.1111/maps.13027' };
const righter = { label: 'Righter et al. · Meteoritics & Planetary Science', url: 'https://doi.org/10.1111/maps.12511' };
const guideInk = '#849fe5';
const brightInk = '#fff0c9';

const topics = {
  orbit: {
    title: 'An Earth-crossing orbit',
    description: 'Calibrated fireball footage helped reconstruct the elongated orbit the object followed before reaching Earth.',
    source: popova,
    graphicLabel: 'Schematic of the meteoroid’s elongated orbit crossing Earth’s orbit',
    caption: 'Schematic paths',
    graphic: `<ellipse cx="138" cy="48" rx="101" ry="34" transform="rotate(-13 138 48)" fill="none" stroke="${brightInk}"/>
      <circle cx="64" cy="48" r="27" fill="none" stroke="${guideInk}"/><circle cx="64" cy="48" r="5" fill="${brightInk}"/>
      <circle cx="89" cy="38" r="3" fill="#a9bcff"/>
      <path d="M89 33V13H108" fill="none" stroke="${guideInk}"/><text x="112" y="16">Earth’s orbit</text>
      <text class="accent" x="117" y="94">1.76 AU semi-major axis</text>`,
  },
  drift: {
    title: 'A rock altered by impact',
    description: 'Impacts drove molten iron–nickel and troilite into grain boundaries, darkening parts of the rock.',
    source: righter,
    graphicLabel: 'Schematic of metal and sulfide melt flowing along rock grain boundaries',
    caption: 'Schematic · Melt along grain boundaries',
    graphic: grainBoundaries,
  },
  sun: {
    title: 'Grains from the early Solar System',
    description: 'Olivine and pyroxene survive inside rounded chondrules. Later heating recrystallized these minerals and helped plagioclase grow.',
    source: kaeter,
    graphicLabel: 'Schematic of silicate crystals inside a rounded chondrule',
    caption: 'Schematic cross-section',
    graphic: `<defs><clipPath id="chondrule-edge"><ellipse cx="89" cy="50" rx="48" ry="39" transform="rotate(-13 89 50)"/></clipPath></defs>
      <ellipse cx="89" cy="50" rx="48" ry="39" transform="rotate(-13 89 50)" fill="#344d9a" stroke="${brightInk}"/>
      <path d="M24 81 104 2M35 90 114 9M49 93 128 13M65 96 145 16M77 103 157 22M94 107 167 29" clip-path="url(#chondrule-edge)" stroke="${brightInk}" stroke-width="3" opacity=".73"/>
      <path d="M126 37h29l14-12h14" fill="none" stroke="${guideInk}"/><text x="185" y="28">Chondrule</text>`,
  },
  earth: {
    title: 'What survived the fall',
    description: 'Chelyabinsk is an LL5 ordinary chondrite. Its opaque minerals include iron–nickel, troilite and chromium-rich spinel.',
    source: kaeter,
    graphicLabel: 'Mineral proportions in studied fragments: olivine 50–60%, pyroxene 20–30%, plagioclase and glass 5–10%, opaque phases 5–10%',
    graphic: mineralRanges,
  },
  near: {
    title: 'First light at 97 km',
    description: 'The object entered at about 19 km/s. Calibrated footage helped establish the two altitudes.',
    source: popova,
    graphicLabel: 'Altitude comparison: first recorded at 97 km and brightest near 30 km',
    graphic: altitudePlot,
  },
  pass: {
    title: 'A skin made in the atmosphere',
    description: 'Atmospheric heating melted the surface. The melt cooled into a dark fusion crust around the rocky interior.',
    source: kaeter,
    graphicLabel: 'Schematic cross-section of a meteorite with a thin fusion crust and rocky interior',
    caption: 'Schematic · Crust thickness exaggerated',
    graphic: `<path d="m27 58 21-34 54-10 33 12 38 42-41 19-63 2Z" fill="#3f559e" stroke="${brightInk}" stroke-width="5"/>
      <path d="m37 58 18-27 49-9 26 11 31 33-33 14-57 2Z" fill="none" stroke="${guideInk}" stroke-dasharray="2 3"/>
      <path d="M128 24h45l14-13" fill="none" stroke="${guideInk}"/><text x="181" y="11">Fusion crust</text>
      <path d="M96 55h87" fill="none" stroke="${guideInk}"/><text x="186" y="59">Stone</text>`,
  },
};

export function bindComposition(section) {
  const diagram = section.querySelector('.composition');
  const buttons = [...diagram.querySelectorAll('[data-topic]')];
  const note = diagram.querySelector('.composition__note');
  const title = note.querySelector('h3');
  const graphic = note.querySelector('.composition__graphic');
  const caption = note.querySelector('figcaption');
  const description = note.querySelector('.composition__description');
  const source = note.querySelector('a');
  const ring = diagram.querySelector('.composition__ring');
  const ink = diagram.querySelector('.composition__leader-ink');
  const hit = diagram.querySelector('.composition__leader-hit');
  const compact = matchMedia('(max-width: 1059px)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let active = null;
  let pinned = null;
  let closeTimer = 0;

  function position() {
    const diagramBox = diagram.getBoundingClientRect();
    const word = active.getBoundingClientRect();
    const onRight = word.left + word.width / 2 >= diagramBox.left + diagramBox.width / 2;
    const ringBox = ring.getBoundingClientRect();
    const center = ringBox.left + ringBox.width / 2;
    const gutter = 24;
    const sideSpace = Math.min(center - diagramBox.left, diagramBox.right - center) - ringBox.width / 2;
    const useBelow = compact.matches || sideSpace < 325;
    note.style.setProperty('--note-available', useBelow ? '100%' : `${Math.floor(sideSpace - gutter * 2)}px`);
    note.style.removeProperty('--note-height');
    const nx = note.offsetWidth;
    const x0 = (onRight ? word.right + 3 : word.left - 3) - diagramBox.left;
    const y0 = word.top + word.height / 2 - diagramBox.top;
    let x, y, path;
    if (useBelow) {
      const labelsBottom = Math.max(...buttons.map(button => button.getBoundingClientRect().bottom)) - diagramBox.top;
      x = (diagramBox.width - nx) / 2;
      y = Math.max(labelsBottom, ringBox.bottom - diagramBox.top) + 20;
      const column = onRight ? diagramBox.width - 10 : 10;
      const end = onRight ? x + nx - 24 : x + 24;
      path = `M${x0},${y0} H${column} V${y - 10} H${end} V${y}`;
    } else {
      const spaceBeyondWord = onRight ? diagramBox.right - word.right : word.left - diagramBox.left;
      const inset = Math.max(gutter, Math.min((diagramBox.width - 1810) / 2,
        sideSpace - nx - gutter, spaceBeyondWord - nx - 18));
      x = onRight ? diagramBox.width - inset - nx : inset;
      const viewTop = Math.max(0, -diagramBox.top + 18);
      const viewBottom = Math.min(diagramBox.height, innerHeight - diagramBox.top - 18);
      const overlapsWord = onRight ? x < x0 + 18 : x + nx > x0 - 18;
      if (overlapsWord) {
        const wordTop = word.top - diagramBox.top;
        const wordBottom = word.bottom - diagramBox.top;
        const above = wordTop - 14 - viewTop;
        const below = viewBottom - wordBottom - 14;
        const placeBelow = above < note.offsetHeight && below >= above;
        note.style.setProperty('--note-height', `${Math.max(140, placeBelow ? below : above)}px`);
        y = placeBelow ? wordBottom + 14 : wordTop - 14 - note.offsetHeight;
        const wordCenter = word.left + word.width / 2 - diagramBox.left;
        const endX = Math.min(x + nx - 16, Math.max(x + 16, wordCenter));
        const startY = placeBelow ? wordBottom + 3 : wordTop - 3;
        const endY = placeBelow ? y : y + note.offsetHeight;
        path = `M${wordCenter},${startY} L${endX},${endY}`;
      } else {
        const ny = note.offsetHeight;
        y = Math.max(viewTop, Math.min(y0 - ny * .42, viewBottom - ny));
        const end = onRight ? x : x + nx;
        const y1 = Math.min(y + ny - 20, Math.max(y + 20, y0));
        const bend = (x0 + end) / 2;
        path = `M${x0},${y0} H${bend} L${end},${y1}`;
      }
    }
    note.style.left = `${x}px`;
    note.style.top = `${y}px`;
    ink.setAttribute('d', path);
    hit.setAttribute('d', path);
  }

  function show(button) {
    clearTimeout(closeTimer);
    if (active === button) return;
    active?.removeAttribute('data-active');
    active = button;
    diagram.toggleAttribute('data-reading', Boolean(active));
    note.getAnimations().forEach(animation => animation.cancel());
    ink.getAnimations().forEach(animation => animation.cancel());
    if (!button) {
      note.hidden = true;
      ink.removeAttribute('d');
      hit.removeAttribute('d');
      return;
    }
    const topic = topics[button.dataset.topic];
    button.setAttribute('data-active', '');
    title.textContent = topic.title;
    description.textContent = topic.description;
    graphic.setAttribute('aria-label', topic.graphicLabel);
    if (typeof topic.graphic === 'function') {
      graphic.replaceChildren();
      topic.graphic(graphic);
    } else {
      graphic.setAttribute('viewBox', '0 0 260 100');
      graphic.innerHTML = topic.graphic;
    }
    caption.textContent = topic.caption ?? '';
    caption.hidden = !topic.caption;
    source.href = topic.source.url;
    source.textContent = topic.source.label;
    note.hidden = false;
    position();
    if (reducedMotion.matches) return;
    ink.animate([{ strokeDasharray: '1', strokeDashoffset: '1' }, { strokeDasharray: '1', strokeDashoffset: '0' }],
      { duration: 240, easing: 'ease-out' });
    note.animate([{ opacity: 0 }, { opacity: 1 }], { delay: 125, duration: 180, fill: 'backwards' });
  }

  function setPinned(button) {
    pinned?.setAttribute('aria-pressed', 'false');
    pinned = button;
    pinned?.setAttribute('aria-pressed', 'true');
    show(button);
  }

  function leave() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => show(pinned), 220);
  }

  for (const button of buttons) {
    button.setAttribute('aria-controls', note.id);
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse') show(button);
    });
    button.addEventListener('pointerleave', leave);
    button.addEventListener('focus', () => {
      if (button.matches(':focus-visible')) show(button);
    });
    button.addEventListener('blur', leave);
    button.addEventListener('click', () => {
      setPinned(pinned === button ? null : button);
      const belowViewport = note.getBoundingClientRect().bottom + 12 - innerHeight;
      if (pinned && belowViewport > 0) {
        scrollBy({ top: belowViewport, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
      }
    });
  }
  for (const target of [note, hit]) {
    target.addEventListener('pointerenter', () => clearTimeout(closeTimer));
    target.addEventListener('pointerleave', leave);
  }
  note.addEventListener('focusin', () => clearTimeout(closeTimer));
  note.addEventListener('focusout', leave);
  section.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !active) return;
    if (note.contains(document.activeElement)) active.focus();
    setPinned(null);
  });
  document.addEventListener('pointerdown', event => {
    if (pinned && !event.target.closest('[data-topic], .composition__note')) setPinned(null);
  });
  addEventListener('resize', () => {
    if (!active) return;
    if (active.offsetWidth) position();
    else setPinned(null);
  });
}
