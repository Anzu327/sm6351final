export const stoneInks = ['#10195f', '#15217d', '#5a77c3', '#fff3d7', '#101550'];

export const specimenVertexShader = `
varying vec3 normalInView;
varying vec3 eye;
varying vec3 modelPoint;
varying vec2 surfaceUV;
void main() {
  vec4 point = modelViewMatrix * vec4(position, 1.);
  normalInView = normalize(normalMatrix * normal);
  eye = -point.xyz;
  modelPoint = position;
  surfaceUV = uv;
  gl_Position = projectionMatrix * point;
}
`;

export const specimenFragmentShader = `
uniform vec3 shadowInk, middleInk, lightInk, outlineInk;
uniform sampler2D surface;
#ifdef PRINT_INK
  uniform vec3 paintInk;
#endif
#ifdef SURFACE_WAKE
  uniform sampler2D wake, wakeFacets;
  uniform vec3 wakeCenter, wakeCream, wakeBlue;
  uniform float wakePatternScale;
#endif
varying vec3 normalInView, eye, modelPoint;
varying vec2 surfaceUV;

float inkNoise(vec3 p) {
  p = fract(p * .1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

#ifdef PENCIL_ARC
  uniform vec3 arcOrigin;

  float pencilStrokes(vec2 point, float seed) {
    float along = point.x + sin(point.y * .27 + seed) * 1.7;
    float across = point.y + sin(along * .21 + seed) * .18
                            + sin(along * .64 + point.y * .29) * .09;
    float row = floor(across);
    float offset = inkNoise(vec3(row, seed, 6.)) * 12.;
    float strokeIndex = floor((along + offset) / 8.);
    float pressure = inkNoise(vec3(row, strokeIndex, seed));
    float distanceToLead = abs(fract(across) - mix(.29,.71,pressure));
    float phase = fract((along + offset) / 8.);
    float ends = smoothstep(.015,.23,phase) * (1. - smoothstep(.48 + pressure*.26,.98,phase));
    float footprint = fwidth(across);
    float lead = 1. - smoothstep(.05,.15 + footprint*.42,distanceToLead);
    return lead * ends * mix(.42,1.,pressure) * (1. - smoothstep(.31,.92,footprint));
  }

  vec3 drawPencilArc(float light, float facing) {
    vec2 radial = modelPoint.xz + arcOrigin.xz;
    vec2 center = normalize(arcOrigin.xz);
    // Unwrap each segment around its own midpoint, so the marks rotate with the mesh.
    float travel = atan(dot(radial,vec2(-center.y,center.x)),dot(radial,center)) * .33;
    vec2 page = vec2(travel, length(radial) + modelPoint.y * .86);
    float seed = dot(arcOrigin.xz,vec2(19.,31.));
    vec2 firstStroke = mat2(.82,.57,-.57,.82) * page;
    vec2 secondStroke = mat2(.73,-.68,.68,.73) * page;
    float tooth = inkNoise(floor((modelPoint + arcOrigin) * 560.));
    float speckle = smoothstep(.72,.96,tooth);
    float pressure = .5 + .5 * sin(page.x*39. + sin(page.y*57.)*1.4 + seed);
    float shade = 1. - smoothstep(.46,.81,light);
    float first = pencilStrokes(firstStroke*136.,seed);
    float cross = pencilStrokes(secondStroke*181.,seed + 10.);
    vec3 pigment = mix(shadowInk,middleInk,smoothstep(.22,.58,light));
    pigment = mix(pigment,paintInk,smoothstep(.47,.74,light));
    pigment = mix(pigment,lightInk,smoothstep(.70,.98,light));
    pigment = mix(pigment,lightInk,speckle*(.10 + .07*pressure));

    float lead = first * (.21 + .37*shade) + cross * shade * .35;
    lead *= mix(.64,1.,tooth) * mix(.8,1.15,pressure);
    vec3 color = mix(pigment,outlineInk,lead);
    float contour = 1. - smoothstep(.055,.21,facing + (tooth-.5)*.15);
    float graphite = contour * (.24 + .53*smoothstep(.16,.81,tooth));
    return mix(color,outlineInk,graphite);
  }
#endif

void main() {
  vec3 n = normalize(normalInView);
  float diffuse = dot(n, normalize(vec3(-.56,.62,.63))) * .5 + .5;
  float facing = abs(dot(n, normalize(eye)));
  #ifdef PENCIL_ARC
    vec3 color = drawPencilArc(diffuse,facing);
  #else
  float contour = 1. - smoothstep(.05,.25,facing);
  float mapTone = dot(texture2D(surface, surfaceUV).rgb, vec3(.30,.59,.11));
  float pencil = inkNoise(floor(modelPoint * 455.));
  float flecks = inkNoise(floor(modelPoint * 172.));
  diffuse += (mapTone - .25) * .23 + (flecks - .5) * .058;
  vec3 color = mix(shadowInk, middleInk, smoothstep(.28,.53,diffuse));
  color = mix(color, lightInk, smoothstep(.58,.88,diffuse));
  color = mix(color, outlineInk, contour * .85);
  float hatching = sin(dot(modelPoint, vec3(115.,215.,87.)) + flecks * 1.7) * .5 + .5;
  float shaded = 1. - smoothstep(.34,.64,diffuse);
  color *= 1. - smoothstep(.65,.94,hatching) * .14 * shaded;
  color *= .91 + pencil * .18;
  #ifdef PRINT_INK
    // Soft, irregular borders between the printed inks retain the relief.
    float tone = diffuse + (mapTone - .25) * .13;
    color = mix(shadowInk, middleInk, smoothstep(.32,.44,tone));
    color = mix(color, paintInk, smoothstep(.52,.63,tone));
    color = mix(color, lightInk, smoothstep(.73,.91,tone));
    float band = max(1. - smoothstep(.006,.027,abs(tone-.53)),
                     1. - smoothstep(.005,.021,abs(tone-.73)));
    float grainCover = .68 + .32 * flecks;
    color = mix(color, outlineInk, max(contour * .62,band * .19) * grainCover);
  #endif
  #ifdef SURFACE_WAKE
    vec3 surfacePoint = normalize(modelPoint - wakeCenter);
    vec2 wakeUV = vec2(atan(surfacePoint.z,surfacePoint.x) * .15915494 + .5,
                      asin(clamp(surfacePoint.y,-1.,1.)) * .31830989 + .5);
    vec2 trace = texture2D(wake, wakeUV).rg;
    float rim = max(trace.g, 0.);
    float facets = texture2D(wakeFacets, surfaceUV * wakePatternScale).r;
    float veil = smoothstep(.035,.85,trace.r);
    float glint = smoothstep(.025,.55,rim);
    vec3 sheen = mix(wakeBlue, wakeCream, smoothstep(.31,.78,diffuse + .13 * glint));
    float opacity = veil * (.31 + .10 * pencil) + glint * (.40 + .22 * facets);
    color = mix(color, max(color, sheen), clamp(opacity, 0., .86));
  #endif
  #endif
  gl_FragColor = vec4(color, 1.);
  #include <colorspace_fragment>
}
`;
