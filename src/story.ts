export const heroes = {
  chelyabinsk: { id: 'nasa:57165', name: 'Chelyabinsk', lat: 54.81667, lng: 61.11667, source: 'https://www.lpi.usra.edu/meteor/?code=57165' },
  fukang: { id: 'nasa:34491', name: 'Fukang', lat: 44.43333, lng: 87.63333, source: 'https://www.lpi.usra.edu/meteor/?code=34491' },
  hoba: { id: 'nasa:11890', name: 'Hoba', lat: -19.58333, lng: 17.91667, source: 'https://iugs-geoheritage.org/geoheritage_sites/the-hoba-meteorite/' }
} as const;

export const chelyabinskFireballId = 'jpl:2013-02-15 03:20:26';
export const blackBeautyId = 'nasa:54831';

export const chapters = [
  { slug: 'many', short: 'The arrival', title: 'One among <em>many.</em>', hero: 'chelyabinsk', altitude: 1.95,
    text: 'On 15 February 2013, a fireball crossed the sky over Chelyabinsk, Russia. The incoming body broke apart in the atmosphere. The stone you met represents one of the fragments recovered on Earth.',
    note: 'Chelyabinsk · LL5 ordinary chondrite · Witnessed fall, 2013' },
  { slug: 'inside', short: 'The hidden interior', title: 'A window <em>inside.</em>', hero: 'fukang', altitude: 1.95,
    text: 'Found near Fukang, China, in 2000, this pallasite contains olivine crystals set in iron-nickel metal. A polished cut makes that contrast visible.',
    note: 'Fukang · Pallasite, PMG · Found, 2000' },
  { slug: 'hoba', short: 'A change of scale', title: 'A change of <em>scale.</em>', hero: 'hoba', altitude: 2.1,
    text: 'Hoba is the largest known intact meteorite. The broad iron slab was discovered in Namibia in 1920. It is about three metres across and has a catalog mass of 60 tonnes.',
    note: 'Hoba · Iron, IVB · Found, 1920' },
  { slug: 'world', short: 'Your exploration', title: 'Follow your <em>curiosity.</em>', hero: null, altitude: 2.1,
    text: 'A witnessed arrival, a crystalline interior and an iron slab open a much larger archive. Enter the atlas to explore meteorites and recorded fireballs.',
    note: 'The map reflects where and how people look.' }
] as const;

export const sources = [
  ['Meteorite catalog', 'https://data.nasa.gov/dataset/meteorite-landings'],
  ['Fireball API', 'https://ssd-api.jpl.nasa.gov/doc/fireball.html'],
  ['Chelyabinsk', heroes.chelyabinsk.source],
  ['Fukang', heroes.fukang.source],
  ['Hoba site and dimensions', heroes.hoba.source],
  ['Hoba catalog record', 'https://www.lpi.usra.edu/meteor/?code=11890'],
  ['Geography: Natural Earth / world-atlas', 'https://github.com/topojson/world-atlas']
] as const;
