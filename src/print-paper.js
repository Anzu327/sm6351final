import { assetBase } from './asset-base.js';
import { RepeatWrapping, TextureLoader } from 'three';

let paper;
export function loadPrintPaper(assetRoot = assetBase) {
  paper ??= new TextureLoader().loadAsync(
    assetRoot + 'visitors/solar/paper-grain.webp',
  ).then(texture => {
    texture.wrapS = texture.wrapT = RepeatWrapping;
    return texture;
  });
  return paper;
}

export const printPaper = `
uniform sampler2D paperGrain;
uniform float grainReady;

float paperTooth(vec2 pixel) {
  return grainReady > .5 ? texture2D(paperGrain,pixel/vec2(1024.,512.)).r : .48;
}

vec3 applyPaper(vec3 color, vec2 pixel, float tooth, float fine) {
  float fiber = paperTooth(pixel*.54+vec2(1024.,512.)*.23);
  float paper = (tooth-.48)*.34+(fiber-.48)*.16+fine*.017;
  float luma = dot(color,vec3(.2126,.7152,.0722));
  return color + paper*(.45+.65*smoothstep(.02,.52,luma));
}
`;
