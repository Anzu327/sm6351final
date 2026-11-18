export const specimenCurtain = `
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x),
             mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
}
float sweep(float value, float limit, float width, float p) {
  float edge = mix(-width, limit, p);
  return 1. - clamp((value - edge) / width, 0., 1.);
}
vec2 splitUV(vec2 uv, float bend, float tap) {
  vec2 radial = uv - .5;
  return uv + radial * dot(radial, radial) * bend * tap;
}
vec3 spectrum(float t) {
  float green = 1. - abs(2. * clamp((t - 1./6.) * 1.5, 0., 1.) - 1.);
  return pow(vec3(t <= .5 ? 1. - green : 0., green, t > .5 ? 1. - green : 0.), vec3(.4545));
}
// Stage and the analysis diagram use the same displaced cut between layers.
void curtainLayers(vec2 uv, float aspectRatio, float curtain,
    out vec2 outgoing, out vec2 incoming, out float cut, out float center, out float colorEdge) {
  vec2 field = (uv - .5) * vec2(aspectRatio, 1.) + .5;
  float blocks = noise(floor(field * vec2(24., 42.)));
  float cracks = noise(field * 34.) * .35 + noise(field * 9.) * .65;
  float warp = (noise(field * 13.) - .5) * .8;
  float slope = .20 * aspectRatio;
  float diagonal = uv.y + (uv.x + warp) * slope;
  float limit = 1. + slope;
  colorEdge = sweep(diagonal, limit, 2., curtain);
  float displacement = sweep(blocks, 1., 1., sweep(diagonal, limit, .9, curtain));
  cut = sweep(cracks, 1., 2., sweep(diagonal, limit, .2, curtain));
  // The reference samples the outgoing and incoming layers on opposite vertical offsets.
  outgoing = uv - vec2(0., .4 * pow(curtain, 3.) + .025 * displacement);
  incoming = uv + vec2(0., .4 * pow(1. - curtain, 3.) + .025 * (1. - displacement));
  center = 1. - smoothstep(.7, 1., abs(uv.x * 2. - 1.));
  center *= 1. - smoothstep(.7, 1., abs(uv.y * 2. - 1.));
}
`;
