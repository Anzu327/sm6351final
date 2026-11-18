export const printSpecimenLayer = `
vec4 drawSpecimenInk(sampler2D model, vec2 uv, vec2 pixelSize, vec4 foreground, vec3 color) {
  // Offset the two inks on opposite sides of the silhouette.
  vec2 pixel = floor(uv / pixelSize);
  vec2 seed = fract(pixel * vec2(123.34,456.21));
  seed += dot(seed,seed + 45.32);
  float tooth = fract(seed.x * seed.y);
  vec2 shift = pixelSize * vec2(1.4,-.72) * (.65 + tooth);
  vec4 leftInk = texture2D(model,clamp(uv-shift,0.,1.));
  vec4 rightInk = texture2D(model,clamp(uv+shift,0.,1.));
  float outside = max(leftInk.a,rightInk.a) * (1.-foreground.a);
  vec3 fringe = mix(vec3(.15,.28,.63),vec3(.011,.027,.22),step(leftInk.a,rightInk.a));
  color = mix(color,fringe,outside * .72);
  float edge = foreground.a * (1.-min(leftInk.a,rightInk.a));
  color = mix(color,vec3(.010,.015,.11),edge * (.42 + tooth*.20));
  float coverage = mix(foreground.a,1.,outside * .72);
  return vec4(color,coverage);
}
`;
