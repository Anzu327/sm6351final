// The same Equal Earth equations as the map shader, with SVG's downward Y axis.
export function mapPoint(lon, lat) {
  const m = Math.sqrt(3) / 2;
  const a1 = 1.340264, a2 = -.081106, a3 = .000893, a4 = .003796;
  const theta = Math.asin(m * Math.sin(lat * Math.PI / 180));
  const t2 = theta * theta;
  const t6 = t2 * t2 * t2;
  return [
    lon * Math.PI / 180 * Math.cos(theta) / (m * (a1 + 3*a2*t2 + t6*(7*a3 + 9*a4*t2))),
    -theta * (a1 + a2*t2 + t6*(a3 + a4*t2)),
  ];
}
