import { cp, copyFile, readFile, rm, stat } from 'node:fs/promises';

await rm('.pages', { recursive: true, force: true });
await cp('dist', '.pages', { recursive: true });
await copyFile('dist/index.html', '.pages/specimen.html');
await copyFile('dist/visitors.html', '.pages/index.html');

for (const page of ['index.html', 'visitors.html', 'specimen.html']) {
  const html = await readFile('.pages/' + page, 'utf8');
  const assets = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)];
  if (!assets.some(([, path]) => path.endsWith('.js'))) {
    throw new Error(`Missing built script for ${page}`);
  }
  for (const [, path] of assets) await stat('.pages/' + path);
}
for (const path of [
  'models/chelyabinsk-main-mass.glb',
  'models/igloo-transition-rings.glb',
  'effects/surface-flow.png',
  'effects/surface-facets.png',
  'visitors/scene-atlas.png',
  'visitors/display.ttf',
]) await stat('.pages/' + path);
