import { cp, copyFile, readFile, rm, stat, writeFile } from 'node:fs/promises';

await rm('.pages', { recursive: true, force: true });
await cp('dist', '.pages', { recursive: true });
await copyFile('dist/index.html', '.pages/specimen.html');
const integrated = await readFile('dist/sleep-well/index.html', 'utf8');
if (!integrated.includes('<head>')) {
  throw new Error('Missing document head in the integrated entry');
}
await writeFile('.pages/index.html', integrated.replace('<head>', '<head>\n  <base href="./sleep-well/">'));

for (const page of ['visitors.html', 'specimen.html', 'sleep-well/opening.html']) {
  const url = new URL('../.pages/' + page, import.meta.url);
  const html = await readFile(url, 'utf8');
  const assets = [...html.matchAll(/(?:src|href)="(\.{1,2}\/assets\/[^"]+)"/g)];
  if (!assets.some(([, path]) => path.endsWith('.js'))) {
    throw new Error(`Missing built script for ${page}`);
  }
  for (const [, path] of assets) await stat(new URL(path, url));
}
for (const path of [
  'models/chelyabinsk-main-mass.glb',
  'models/igloo-transition-rings.glb',
  'effects/surface-flow.png',
  'effects/surface-facets.png',
  'visitors/scene-atlas.png',
  'visitors/display.ttf',
  'sleep-well/experience.css',
  'sleep-well/experience.js',
  'sleep-well/meteorite/falling-ball.js',
]) await stat('.pages/' + path);
