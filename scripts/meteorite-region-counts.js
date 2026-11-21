import { mapPoint } from '../src/equal-earth.js';

function parseRings(path) {
  return path.match(/M[^Z]+/g).map(part => {
    const points = part.slice(1).split('L').map(point => point.split(',').map(Number));
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    return { points, bounds: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
  });
}

function contains({ points, bounds: [left, top, right, bottom] }, x, y) {
  if (x < left || x > right || y < top || y > bottom) return false;
  let inside = false;
  for (let i = 0, previous = points.length - 1; i < points.length; previous = i++) {
    const [ax, ay] = points[previous];
    const [bx, by] = points[i];
    if ((ay > y) !== (by > y) && x < ax + (bx - ax) * (y - ay) / (by - ay)) {
      inside = !inside;
    }
  }
  return inside;
}

export function meteoriteRegionCounts(catalogue, outlines) {
  const located = catalogue.rows.filter(row => Number.isFinite(row[6]) && Number.isFinite(row[7]));
  const frequencies = new Map();
  for (const [, , , , classification] of located) {
    if (classification && classification !== 'Unknown') {
      frequencies.set(classification, (frequencies.get(classification) ?? 0) + 1);
    }
  }
  const classes = [...frequencies]
    .sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b))
    .slice(0, 6)
    .map(([label]) => label);
  const other = classes.length;
  classes.push('Other classes', 'Unknown');
  const regions = outlines.map(({ name }) => name).concat('Unassigned');
  const geometry = outlines.map(({ path }) => parseRings(path));
  const counts = regions.map(() => classes.map(() => 0));

  for (const [, , , , classification, , lat, lon] of located) {
    const [x, y] = mapPoint(lon, lat);
    // The map uses even-odd fills, so rings representing holes cancel.
    const region = geometry.findIndex(rings =>
      rings.reduce((inside, ring) => contains(ring, x, y) ? !inside : inside, false));
    const classIndex = classes.indexOf(classification || 'Unknown');
    counts[region < 0 ? outlines.length : region][classIndex < 0 ? other : classIndex]++;
  }

  return { regions, classes, counts };
}
