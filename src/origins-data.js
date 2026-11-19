// Popova et al. (2013), Table S1. Seconds relative to 03:20:20.8 UTC.
export const flight = [
  { name: 'First detection', time: 0, lat: 54.445, lon: 64.565, altitude: 97.1, speed: 19.16 },
  { name: 'First brightness peak', time: 9, lat: 54.764, lon: 62.109, altitude: 43.9, speed: 19.2 },
  { name: 'Main brightness peak', time: 11.4, lat: 54.845, lon: 61.412, altitude: 29.7, speed: 19.2 },
  { name: 'Thermal cloud formed', time: 11.85, lat: 54.859, lon: 61.278, altitude: 27.0, speed: 19.2 },
  { name: 'Secondary breakup', time: 12.6, lat: 54.876, lon: 61.128, altitude: 23.9, speed: 16.8 },
  { name: 'Third breakup', time: 13.9, lat: 54.905, lon: 60.865, altitude: 18.5, speed: 12.1 },
  { name: 'Last detection', time: 16, lat: 54.931, lon: 60.625, altitude: 13.6, speed: 4.9 },
];

// Popova et al. (2013), Table S12. Seconds after 03:20:32.2 UTC.
export const shockArrivals = [
  { name: 'Pervomayskiy', delay: 75.6, detection: 'Car shook' },
  { name: 'Korkino', delay: 88.6, detection: 'Car shook' },
  { name: 'Kopeysk', delay: 142.6, detection: 'Cable swung' },
  { name: 'Chelyabinsk', delay: 144.8, detection: 'Camera shook' },
];

// Popova et al. (2013), Tables S2 and S3. Coordinates are latitude, longitude.
export const cameras = [
  ['Pervomayskiy', 54.87060, 61.17369],
  ['Korkino', 54.89089, 61.39966],
  ['Beloretsk', 53.95277, 58.41020],
  ['Snezhinsk', 56.07940, 60.74271],
  ['Kamensk-Uralskiy', 56.41500, 61.91858],
  ['Chelyabinsk · Savina Street', 55.16633, 61.44473],
  ['Chebarkul', 54.99510, 60.40024],
  ['Yemanzhelinsk', 54.75664, 61.30380],
  ['Yemanzhelinsk · bus depot', 54.75538, 61.31534],
  ['Etkul', 54.82193, 61.58429],
  ['Chelyabinsk · building', 55.143436, 61.414183, 'shadow'],
  ['Chebarkul · light fixture', 54.977272, 60.370341, 'shadow'],
  ['Chelyabinsk · sign', 55.172211, 61.453558, 'shadow'],
  ['Chelyabinsk · lamppost', 55.160144, 61.402573, 'shadow'],
  ['Chelyabinsk · billboard', 55.167406, 61.443214, 'shadow'],
];

// Popova et al. (2013), nominal solution in the text preceding Table S5B.
export const orbit = {
  semiMajorAxis: 1.763270,
  eccentricity: 0.580953,
  inclination: 4.928787,
  argumentOfPerihelion: 108.301927,
  ascendingNode: 326.442018,
};
