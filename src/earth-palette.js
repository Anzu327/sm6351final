// Cool coastal ink to the warmest pink accent in the solar-system artwork.
export const densityInk = [
  '#365469', '#45758b', '#599da9', '#80bac7', '#a2c7e0',
  '#aba6d8', '#c697d0', '#e19ecb', '#ffd4e8',
];

// Warm YlOrRd swatches for regional counts.
export const radialLineInk = [
  '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#bd0026',
];

export const heatmapInk = [
  '#080e22', '#292b83', '#244ac5', '#168fde', '#17c7ac',
  '#87db3a', '#f3e238', '#ff8c20', '#df240b',
];

// The Earth shader uses local model Y to mix sRGB pigments before lighting.
export const earthLatitudePaint = `
  vec3 earthSeaPigment(float height) {
    return mix(vec3(156.,190.,218.),vec3(173.,150.,203.),height)/255.;
  }
  vec3 earthLandPigment(float height) {
    return mix(vec3(227.,222.,243.),vec3(178.,196.,230.),height)/255.;
  }
`;
