import {test,expect, type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const screenshot=async(page:Page,name:string)=>{await mkdir('qa-screenshots',{recursive:true});await page.screenshot({path:'qa-screenshots/'+name+'.png',timeout:30000});};
async function ready(page:Page){await page.goto('/');await expect(page.locator('body')).toHaveAttribute('data-data','ready');await expect(page.locator('#space')).toHaveAttribute('data-ready','true');await expect(page.locator('#space')).toHaveAttribute('data-texture','ready');await expect(page.locator('#space')).toHaveAttribute('data-materials','ready');}
test.use({ video: 'on' });
test.describe('recorded story walkthroughs', () => {
 test('single fragment, reversible handoff and chapter previews', async ({page}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
   if (message.type() === 'error' && /THREE.WebGLProgram|Shader Error/i.test(message.text())) errors.push(message.text());
  });
  await ready(page);
  const space = page.locator('#space');
  await expect(page.locator('#header')).toBeHidden();
  await expect(page.locator('#scroll-hint')).toBeVisible();
  await expect(page.locator('#many h1')).not.toBeInViewport();
  await screenshot(page, 'opening-desktop');
  await page.mouse.move(720, 450);
  await page.mouse.down();
  await page.mouse.move(850, 500, {steps: 8});
  await page.mouse.up();
  await expect(space).toHaveAttribute('data-rotation', /.+/);
  await page.evaluate(() => scrollTo({top: innerHeight * 1.33, behavior: 'instant'}));
  await expect(space).toHaveAttribute('data-phase', 'handoff');
  await screenshot(page, 'fragment-to-pin');
  await page.evaluate(() => scrollTo({top: innerHeight * 1.95, behavior: 'instant'}));
  await expect(space).toHaveAttribute('data-phase', 'earth');
  await screenshot(page, 'earth-handoff');
  await page.evaluate(() => scrollTo({top: 0, behavior: 'instant'}));
  await expect(space).toHaveAttribute('data-intro', '0.000');
  await expect(page.locator('#header')).toBeHidden();
  await page.locator('#scroll-hint').click();
  await expect(space).toHaveAttribute('data-chapter', '0');
  await expect(page.locator('#story-heroes')).toBeHidden();
  await expect(space).toHaveAttribute('data-preview', '');
  await page.getByRole('button', {name: 'Peak brightness'}).click();
  await expect(page.locator('#arrival-location')).toContainText('Altitude: 23.3 km');
  await expect(page.getByRole('button', {name: 'Peak brightness'})).toHaveAttribute('aria-pressed', 'true');
  await screenshot(page, 'chelyabinsk-peak-brightness');
  await page.getByRole('button', {name: 'Ground record'}).click();
  await expect(page.locator('#arrival-location')).toContainText('54.817° N, 61.117° E');
  await page.locator('[data-chapter="1"]').click();
  await expect(space).toHaveAttribute('data-chapter', '1');
  await page.getByRole('button', {name: 'Inspect the cut'}).click();
  await expect(space).toHaveAttribute('data-preview', 'nasa:34491');
  await screenshot(page, 'fukang-chapter');
  await page.keyboard.press('Escape');
  await expect(space).toHaveAttribute('data-preview', '');
  await page.locator('[data-chapter="2"]').click();
  await expect(space).toHaveAttribute('data-chapter', '2');
  await page.getByRole('button', {name: 'Compare the scale'}).click();
  await expect(page.locator('#hoba-scale')).toContainText('2.95 m');
  await expect(page.locator('#hoba-scale')).toBeVisible();
  await expect(space).toHaveAttribute('data-preview', 'nasa:11890');
  await screenshot(page, 'hoba-chapter');
  await page.locator('[data-chapter="0"]').click();
  await expect(space).toHaveAttribute('data-chapter', '0');
  await expect(space).toHaveAttribute('data-preview', '');
  await expect(page.getByRole('button', {name: 'Ground record'})).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
 });

 test.describe('touch', () => {
  test.use({ viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true });
  test('touch walkthrough and off-center selection', async ({page}) => {
   await ready(page);
   await screenshot(page, 'opening-mobile');
   await page.locator('#scroll-hint').tap();
   await expect(page.locator('#space')).toHaveAttribute('data-chapter', '0');
   await expect(page.getByRole('button', {name: 'Peak brightness'})).toBeInViewport();
   await page.getByRole('button', {name: 'Peak brightness'}).tap();
   await page.locator('#many').evaluate(section => section.scrollIntoView({behavior: 'instant'}));
   await expect(page.locator('#arrival-location')).toContainText('23.3 km');
   await screenshot(page, 'chelyabinsk-mobile');
   await page.locator('#header [data-enter]').tap();
   await page.locator('#search').fill('Fukang');
   await expect(page.locator('#counts')).toHaveText('1 matching records');
   await page.locator('#record-list button').tap();
   await expect(page.locator('#details h2')).toHaveText('Fukang');
   await page.waitForTimeout(650);
   // The mobile camera's view offset puts the center of the globe at 30% height.
   await page.locator('#search').fill('Fukan');
   await expect(page.locator('#details')).toContainText('Choose a visitor.');
   await page.touchscreen.tap(214, 253);
   await expect(page.locator('#details h2')).toHaveText('Fukang');
   await screenshot(page, 'atlas-mobile');
   expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  });
 });
});
test('atlas search, missing location, filters, independent fireball units, and story return',async({page})=>{
 await ready(page);await page.evaluate(()=>scrollTo({top:innerHeight*8.5,behavior:'instant'}));await page.locator('[data-enter]').first().click();await expect(page.locator('#atlas')).toBeVisible();await expect(page.locator('#counts')).toHaveText('45,716 matching records');
 await page.locator('#search').fill('Black Beauty');await expect(page.locator('#counts')).toHaveText('1 matching records');await expect(page.locator('#map-count')).toHaveText('0 mapped · 1 without usable coordinates');await page.locator('#record-list button').click();await expect(page.locator('#details')).toContainText('Unavailable · not mapped');await page.locator('#record-list button').hover();await expect(page.locator('#space')).toHaveAttribute('data-preview','');await screenshot(page,'black-beauty-unmapped');
 await page.locator('#reset').click();await page.locator('#status').selectOption('Fell');await expect(page.locator('#counts')).not.toHaveText('45,716 matching records');await page.locator('#from').fill('2000');await page.locator('#to').fill('1900');await expect(page.locator('#range-error')).toBeVisible();await expect(page.locator('#counts')).toHaveText('0 matching records');
 await page.locator('#reset').click();await page.locator('#search').fill('not-a-real-meteorite-xyz');await expect(page.locator('#record-list')).toContainText('No matching records');
 await page.locator('[data-layer=fireballs]').click();await expect(page.locator('#meteorite-filters')).toBeHidden();await expect(page.locator('#counts')).toHaveText('1,074 matching records');await expect(page.locator('#size-legend')).toContainText('kt TNT');await page.locator('#record-list button').first().click();await expect(page.locator('#details')).toContainText('Peak brightness (UTC)');await screenshot(page,'fireball-atlas');await page.locator('[data-hero=fukang]').click();await expect(page.locator('[data-layer=meteorites]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#details')).toContainText('Pallasite, PMG');
 await page.locator('[data-layer=meteorites]').click();await page.locator('#search').fill('Fukang');await expect(page.locator('#counts')).toHaveText('1 matching records');await page.locator('#record-list button').click();await expect(page.locator('#details')).toContainText('Pallasite, PMG');await page.waitForTimeout(850);await page.locator('#search').fill('Fukan');await expect(page.locator('#details')).toContainText('Choose a visitor.');await page.mouse.move(729,512);await expect(page.locator('#space')).toHaveAttribute('data-preview','nasa:34491');await page.mouse.click(729,512);await expect(page.locator('#details h2')).toHaveText('Fukang');await page.locator('.surface-toggle').click();await expect(page.locator('#space')).toHaveAttribute('data-cut','false');await page.locator('.surface-toggle').click();await expect(page.locator('#space')).toHaveAttribute('data-cut','true');await page.mouse.move(700,70);await screenshot(page,'meteorite-atlas');
 await page.locator('#search').fill('Fukang');await expect(page.locator('#details')).toContainText('Choose a visitor.');
 await page.mouse.move(720,512);await page.mouse.down();await page.mouse.move(740,512,{steps: 4});await page.mouse.move(720,512,{steps: 4});await page.mouse.up();
 await expect(page.locator('#details')).toContainText('Choose a visitor.');
 await page.locator('#record-list button').click();
 await page.waitForTimeout(650);
 await page.getByRole('button', {name: 'Zoom in'}).click();
 await page.waitForTimeout(650);
 await page.locator('#search').fill('Fukan');await expect(page.locator('#details')).toContainText('Choose a visitor.');
 await page.mouse.click(729,512);await expect(page.locator('#details h2')).toHaveText('Fukang');
 await page.locator('#return-story').click();await expect(page.locator('#atlas')).toBeHidden();expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(1000);
});
test('archive loading failure has a working retry',async({page})=>{
 await page.route('**/data/manifest.json',r=>r.abort());await page.goto('/');await expect(page.locator('#data-error')).toBeVisible();await page.unroute('**/data/manifest.json');await page.locator('#retry').click();await expect(page.locator('body')).toHaveAttribute('data-data','ready');await expect(page.locator('#data-error')).toBeHidden();
});
test('reduced motion and WebGL failure retain readable story and atlas',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type:string,...args:unknown[]){if(type==='webgl'||type==='webgl2'||type==='experimental-webgl')return null;return (original as Function).call(this,type,...args);} as typeof original;});
 await page.goto('/');await expect(page.locator('body')).toHaveClass(/no-webgl/);await expect(page.locator('body')).toHaveAttribute('data-data','ready');await page.evaluate(()=>scrollTo({top:innerHeight*2,behavior:'instant'}));await page.locator('[data-enter]').first().click();await expect(page.locator('#atlas')).toBeVisible();await page.locator('#search').fill('Fukang');await expect(page.locator('#counts')).toHaveText('1 matching records');await screenshot(page,'webgl-fallback');
});

test('reduced motion keeps the fragment and Earth as separate static states', async ({page}) => {
 await page.emulateMedia({ reducedMotion: 'reduce' });
 await ready(page);
 const space = page.locator('#space');
 await expect(space).toHaveAttribute('data-phase', 'fragment');
 await page.evaluate(() => scrollTo({top: innerHeight * .55, behavior: 'instant'}));
 await expect(space).toHaveAttribute('data-phase', 'earth');
 await page.locator('#many').scrollIntoViewIfNeeded();
 await expect(page.getByRole('button', {name: 'Ground record'})).toBeVisible();
 await page.getByRole('button', {name: 'Peak brightness'}).click();
 await expect(page.locator('#arrival-location')).toContainText('23.3 km');
});
