// Reference units: one scroll unit blends the specimen and passage cameras.
export const scrollRate = .00075;
export const passageSpan = 6.5;
export const passageEnd = .54 * passageSpan;
export const passageRest = .20 * passageSpan;
export const passageEntryProgress = 1;
export const archivePush = 1.25;
export const archiveSlide = 1.34;
export const archiveArrival = 2.16;
export const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
export const mix = (a, b, t) => a + (b - a) * t;
const fraction = (time, start, duration) => clamp((time - start) / duration);
export const ease = (start, end, value) => {
  const t = fraction(value, start, end - start);
  return t * t * (3 - 2 * t);
};
export const powerInOut = (t, power) => t < .5 ? (2 * t) ** power / 2 : 1 - (2 - 2 * t) ** power / 2;

export const chartReturnSpan = 2.65;
export const outroFlightStart = -1.86;
export const outroFlightEnd = .66;
export const outroFlightProgress = scroll => fraction(scroll, outroFlightStart, outroFlightEnd - outroFlightStart);

export function outroFlightPoint(progress, landingX, landingY) {
  const bank = 1 - (1 - clamp(progress / .95)) ** 1.6;
  const descent = 1 - (1 - progress) ** 1.2;
  return [mix(1.12, landingX, bank), mix(-.09, landingY, descent)];
}

// Both Earth scenes meet at full coverage before the archive pulls back.
// Use the viewport diagonal so the globe also covers the corners on wide screens.
export function earthArrivalPose(position, aspect) {
  return {
    center: ease(3.24, 3.50, position),
    approach: ease(3.34, 3.62, position),
    blend: ease(3.64, 3.72, position),
    reveal: ease(3.74, 3.96, position),
    turn: -Math.PI * .85 * (1 - ease(3.30, 3.96, position)),
    cover: Math.hypot(aspect, 1) * 1.12,
  };
}

export function archivePose(progress) {
  const seconds = progress * archiveArrival;
  const push = clamp(seconds / archivePush) ** 4;
  const dock = ease(archiveSlide, archiveArrival, seconds);
  return {
    center: ease(0, .76, seconds),
    approach: 5 - 3.5 * push,
    dock,
  };
}

function cubic(a, b, c, d, t) {
  return mix(mix(mix(a, b, t), mix(b, c, t), t), mix(mix(b, c, t), mix(c, d, t), t), t);
}

function bezier(segments, x) {
  const segment = segments.find(item => x <= item[6]) ?? segments.at(-1);
  const [x0, y0, x1, y1, x2, y2, x3, y3] = segment;
  let lo = 0, hi = 1;
  for (let step = 0; step < 15; step++) {
    const t = (lo + hi) * .5;
    if (cubic(x0, x1, x2, x3, t) < x) lo = t;
    else hi = t;
  }
  if (x === 0 || x === 1) return x;
  return cubic(y0, y1, y2, y3, (lo + hi) * .5);
}

const descent = [
  [0, 0, .272, 0, .472, .454, .496, .496],
  [.496, .496, .66, .79, .685, 1, 1, 1],
];
const upright = [
  [0, 0, .358, 0, .336, .209, .442, .519],
  [.442, .519, .59, .952, .768, .918, 1, 1],
];

const pulseStarts = [2, 2.95, 3.8];
export function passagePose(scroll) {
  const time = 9.2 * clamp(scroll / passageSpan);
  const slide = 1 - (1 - fraction(time, 0, 2.5)) ** 3;
  const level = bezier(upright, fraction(time, 3.5, 3.7));
  const roll = Math.PI * powerInOut(fraction(time, 1, 5.25), 4);
  const pulse = Math.max(...pulseStarts.map((start, i) =>
    time < start + .5
      ? fraction(time, start, .5) ** 2
      : (1 - fraction(time, start + .5, i === 2 ? .6 : .4)) ** 2
  ));
  return {
    cameraY: mix(1.5, -9.83, bezier(descent, fraction(time, .2, 7))),
    cameraZ: mix(-2, 0, slide) - 1.5 * level,
    lookY: mix(-2.5, -10, powerInOut(fraction(time, .2, 3), 2))
      + .19 * powerInOut(fraction(time, 3.2, 2.5), 2),
    lookZ: mix(-1, 0, slide),
    roll,
    level,
    fov: mix(22, 30, powerInOut(fraction(time, 0, 7.2), 2)),
    pulse,
  };
}
