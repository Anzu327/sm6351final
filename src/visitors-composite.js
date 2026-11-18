import { printPaper } from './print-paper.js';

export const visitorsComposite = `
varying vec2 vUv;
uniform sampler2D a, b, solarDepth;
uniform vec2 pixelSize;
uniform float blend, aspect, portal, solarWeight, solarTime;
${printPaper}

float hash(vec2 p) {
  return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);
}

float viewDepth(vec2 coord) {
  float z = texture2D(solarDepth,coord).r;
  return .1*150./(150.-z*149.9);
}

vec3 drawSolar(vec2 uv, float tooth) {
  vec2 pixel = gl_FragCoord.xy;
  // Keep the pencil tooth fixed to the paper as geometry moves across it.
  float fleck = hash(floor(pixel*.78));
  // DeferredChromaticAberration uses three barrel samples with a .03 maximum.
  vec2 radial = uv-.5;
  vec2 spread = radial*dot(radial,radial)*.01;
  vec3 center = texture2D(a,uv).rgb;
  vec3 first = texture2D(a,uv+spread).rgb;
  vec3 second = texture2D(a,uv+spread*2.).rgb;
  const float spectrumWeight = .72974005;
  vec3 printColor = vec3((center.r+first.r*spectrumWeight)/(1.+spectrumWeight),
                        (first.g+second.g)*.5,second.b);

  // DeferredOutline updates its displacement at 4 fps. Its depth kernel runs
  // on the displaced sample while the underlying color and paper stay still.
  float inkTime = floor(solarTime*4.)*.25;
  vec2 displacement = vec2(sin(pixel.y*.05+inkTime*4.),cos(pixel.x*.05+inkTime*4.));
  vec2 point = uv+displacement*pixelSize*(fleck*1.5);
  vec2 dx = vec2(pixelSize.x,0.)*(.85+.55*fleck);
  vec2 dy = vec2(0.,pixelSize.y)*(1.35-.46*fleck);
  float depth = viewDepth(point);
  float closest = min(min(viewDepth(point-dx),viewDepth(point+dx)),
                      min(viewDepth(point-dy),viewDepth(point+dy)));
  float silhouette = smoothstep(.014,.078,(depth-closest)/max(closest,1.));
  vec3 colorX = texture2D(a,point+dx).rgb;
  vec3 colorY = texture2D(a,point+dy).rgb;
  float colorBreak = max(length(center-colorX),length(center-colorY));
  float stroke = max(silhouette*.66,smoothstep(.075,.37,colorBreak)*.38);
  vec3 pigment = min(center,min(colorX,colorY));
  float warm = smoothstep(.07,.28,pigment.r-pigment.b);
  vec3 ink = mix(vec3(.055,.125,.205),vec3(.30,.13,.043),warm);
  float pressure = clamp(.52+fleck*.46+(tooth-.48)*1.4,.25,1.);
  return mix(printColor,ink,stroke*pressure);
}

void main() {
  vec2 xy = (vUv-.5)*vec2(aspect,1.);
  float angle = atan(xy.y,xy.x);
  float rough = sin(angle*13.)*.006+sin(angle*31.)*.002;
  float d = length(xy)+rough;
  vec2 pixel = gl_FragCoord.xy;
  float fine = hash(floor(pixel))-.5;
  float t;
  if (solarWeight > 0. && blend > 0.) {
    // MixTextureLine moves a full-screen strip from y=-2 to 0. The
    // leading edge rotates by up to 12 degrees at mid-transition.
    float halfway = 1.-abs(blend*2.-1.);
    float turn = radians(12.)*(1.-pow(1.-halfway,3.));
    vec2 screen = vUv*2.-1.;
    screen.y += 2.*(1.-blend);
    float localY = -sin(turn)*screen.x+cos(turn)*screen.y;
    float edge = max(fwidth(localY),.003);
    t = 1.-smoothstep(1.-edge,1.+edge,localY);
  } else if (portal > .5) {
    t = 1.-smoothstep(blend*1.6-.04,blend*1.6+.04,d);
  } else {
    t = smoothstep(vUv.y*.3,vUv.y*.3+.7,blend);
  }
  if (blend < .001) t = 0.;
  if (blend > .999) t = 1.;

  vec3 outgoing = texture2D(a,vUv).rgb;
  float grain = fine*.035;
  if (solarWeight > 0.) {
    float tooth = paperTooth(pixel);
    vec3 pigment = drawSolar(vUv,tooth);
    if (viewDepth(vUv) > 149.) {
      // Modulate the dark paper so its blue does not wash out in linear light.
      float fiber = paperTooth(pixel*.54+vec2(1024.,512.)*.23);
      outgoing = pigment * (1. + (tooth-.48)*.92 + (fiber-.48)*.38 + fine*.12);
    } else {
      outgoing = applyPaper(pigment,pixel,tooth,fine);
    }
    grain *= t;
  }

  vec3 color = mix(outgoing,texture2D(b,vUv).rgb,t);
  color += grain * smoothstep(.015,.45,dot(color,vec3(.2126,.7152,.0722)));
  gl_FragColor = vec4(color,1.);
  #include <colorspace_fragment>
}
`;
