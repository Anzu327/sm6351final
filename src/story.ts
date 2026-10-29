export const heroes = {
  sikhote: { id: 'nasa:23593', name: 'Sikhote-Alin', lat: 46.16, lng: 134.65333, source: 'https://www.amnh.org/exhibitions/permanent/meteorites/meteorite-impacts/sikhote-alin' },
  fukang: { id: 'nasa:34491', name: 'Fukang', lat: 44.43333, lng: 87.63333, source: 'https://www.lpi.usra.edu/meteor/metbull.cfm?code=34491' },
  beauty: { id: 'nasa:54831', name: 'Black Beauty', lat: null, lng: null, source: 'https://science.nasa.gov/resource/black-beauty-mars-meteorite/' }
} as const;
export const originalChapters = [
  { slug: 'fragment', short: 'The fragment', title: 'One small<br><em>fragment.</em>', plainTitle: 'One small fragment.', hero: 'sikhote', camera: {lat:46.16,lng:134.65333,altitude:2.9}, text: 'It fits in a hand. Its story spans a Solar System.<br>This is a fragment of Sikhote-Alin: iron from space, shaped by an extraordinary arrival.', note: 'Sikhote-Alin · Iron, IIAB · Observed fall, 1947', prompt: 'Drag the stone to turn it. Scroll to follow its story.' },
  { slug: 'arrival', short: 'The arrival', title: 'A violent<br><em>arrival.</em>', plainTitle: 'A violent arrival.', hero: 'sikhote', camera: {lat:46.16,lng:134.65333,altitude:2.9}, text: 'On 12 February 1947, a fireball crossed the sky over eastern Russia. The incoming body broke apart. Iron fragments reached the ground; some shattered again on impact.', note: 'One event. Many fragments. Different endings.', prompt: 'Scroll to follow a fragment back to Earth.' },
  { slug: 'many', short: 'The bigger picture', title: 'One among<br><em>many.</em>', plainTitle: 'One among many.', hero: 'sikhote', camera: {lat:46.16,lng:134.65333,altitude:2.3}, text: 'The fragment becomes a point in a much larger record.<br>Each light marks a documented meteorite location—not every rock that has ever reached Earth.', note: 'The highlighted point is the Sikhote-Alin catalog record, not an individual fragment.', prompt: 'Keep scrolling. Two very different visitors are waiting.' },
  { slug: 'inside', short: 'The hidden interior', title: 'A window<br><em>inside.</em>', plainTitle: 'A window inside.', hero: 'fukang', camera: {lat:44.43333,lng:87.63333,altitude:2.5}, text: 'An unassuming exterior. A remarkable interior.<br>Found near Fukang, China, in 2000, this pallasite contains olivine crystals set in iron-nickel metal. A polished cut makes that contrast visible.', note: 'Fukang · Pallasite, PMG · Found, 2000', prompt: 'Switch the surface. Drag to examine the slice.' },
  { slug: 'beauty', short: 'A visitor from Mars', title: 'Black<br><em>Beauty.</em>', plainTitle: 'Black Beauty.', hero: 'beauty', camera: {lat:20,lng:0,altitude:2.5}, text: 'A memorable nickname. An even better origin story.<br>Northwest Africa 7034 is a Martian meteorite. This small, dark rock brings a piece of another planet into a laboratory on Earth.', note: 'NWA 7034 · Martian basaltic breccia · Found, 2011', prompt: 'Its catalog has no reliable coordinates. We will not invent a pin.' },
  { slug: 'world', short: 'Your exploration', title: 'Explore<br><em>their world.</em>', plainTitle: 'Explore their world.', hero: 'sikhote', camera: {lat:25,lng:20,altitude:2.3}, text: 'A witnessed arrival. A crystalline interior. A piece of Mars.<br>Three stories open a much larger archive. Now follow your own curiosity.', note: 'What we find depends on where—and how—we look.', prompt: 'Enter the atlas to rotate the Earth, compare records and inspect the evidence.' }
] as const;
export const sources = [
  ['Meteorite catalog', 'https://data.nasa.gov/dataset/meteorite-landings'],
  ['Fireball API', 'https://ssd-api.jpl.nasa.gov/doc/fireball.html'],
  ['Sikhote-Alin', heroes.sikhote.source],
  ['Fukang', heroes.fukang.source],
  ['Black Beauty', heroes.beauty.source],
  ['Geography: Natural Earth / world-atlas', 'https://github.com/topojson/world-atlas']
] as const;

export const chapters = [
 { ...originalChapters[2], title: 'One among <em>many.</em>', text: 'On 12 February 1947, a fireball crossed eastern Russia. The incoming body broke apart; fragments of Sikhote-Alin reached the ground. The stone you met is one fragment of that event.<br><br>Now it becomes a point in a larger archive. Each light is a catalog record—not every meteorite that ever reached Earth.' },
 { ...originalChapters[3], title: 'A window <em>inside.</em>' },
 { ...originalChapters[4], title: 'Black <em>Beauty.</em>' },
 { ...originalChapters[5], title: 'Follow your <em>curiosity.</em>' }
] as const;
export const introTiming = { join: [.35,1.45], hold: [1.45,1.8], leave: [1.8,2.8], handoff: [2.3,2.95], earth: [2.95,3.8], end: 4 } as const;
