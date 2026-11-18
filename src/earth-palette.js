// Cool coastal ink to the warmest pink accent in the solar-system artwork.
export const densityInk = [
  '#365469', '#45758b', '#599da9', '#80bac7', '#a2c7e0',
  '#aba6d8', '#c697d0', '#e19ecb', '#ffd4e8',
];

// Monolith's Earth uses local model Y to mix sRGB pigments before lighting.
export const earthLatitudePaint = `
  vec3 earthSeaPigment(float height) {
    return mix(vec3(156.,190.,218.),vec3(173.,150.,203.),height)/255.;
  }
  vec3 earthLandPigment(float height) {
    return mix(vec3(227.,222.,243.),vec3(178.,196.,230.),height)/255.;
  }
`;
