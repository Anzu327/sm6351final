import { Raycaster, Sphere, Vector2 } from 'three';
import { mapArchivePanels } from './phone-card-surfaces.js';

const hero = document.querySelector('.hero');
const section = document.querySelector('.scene-phone');
const archive = document.querySelector('#phone-archive-clips');
const clips = [...archive.content.querySelectorAll('[data-video]')].map(item => {
  const poster = new Image();
  poster.src = new URL(item.dataset.poster, document.baseURI).href;
  return {
    poster,
    source: new URL(item.dataset.video, document.baseURI).href,
    title: item.querySelector('h3').textContent.trim(),
    kind: item.firstElementChild.textContent.trim(),
    description: item.lastElementChild,
  };
});

const panel = document.createElement('aside');
panel.className = 'phone-archive-info';
panel.innerHTML = `
  <button type="button" class="phone-archive-exit" aria-label="Close video" autofocus></button>
  <p class="phone-archive-kind"></p>
  <h2 id="phone-archive-title"></h2>
  <p class="phone-archive-description"></p>
  <p class="phone-archive-status" role="status" hidden></p>
`;
const viewer = document.createElement('dialog');
viewer.className = 'phone-archive-viewer';
viewer.setAttribute('aria-labelledby','phone-archive-title');
viewer.setAttribute('data-lenis-prevent','');
const close = panel.querySelector('button');
const player = document.createElement('video');
player.playsInline = true;
player.muted = true;
player.preload = 'none';
player.controls = true;
viewer.append(player,panel);
document.body.append(viewer);
const ray = new Raycaster();
const target = new Vector2();
const tileWidth = 384;
const tileHeight = 256;
const hoverScale = 1.12;
const hoverDuration = 160;
const hoverMotion = matchMedia('(any-hover: hover) and (any-pointer: fine) and (prefers-reduced-motion: no-preference)');
let scene, mesh, mapping, atlas, texture;
let surfaces, panelScales;
let progress = 0;
let leave = 0;
let selected = -1;
let hovered = -1;
let pointer = null;
let hoverFrame = 0;

function paintTile(slot, source) {
  const ctx = atlas.getContext('2d');
  const x = slot*tileWidth;
  ctx.fillStyle = '#223c80';
  ctx.fillRect(x,0,tileWidth,tileHeight);
  const width = source.videoWidth || source.naturalWidth;
  const height = source.videoHeight || source.naturalHeight;
  if (!width || !height) return;
  const scale = Math.min((tileWidth-20)/width,(tileHeight-18)/height);
  const w = width*scale, h = height*scale;
  ctx.drawImage(source,x+(tileWidth-w)/2,(tileHeight-h)/2,w,h);
}
function paintPosters() {
  mapping.panels.forEach((_,i)=>paintTile(i,clips[i%clips.length].poster));
  texture.needsUpdate = true;
}

function attach() {
  if (scene || !section.phoneArchiveScene || !clips.length) return;
  scene = section.phoneArchiveScene;
  const faces = [];
  scene.ring?.traverse(node=>{
    if (node.isMesh && node.geometry.index) faces.push(node);
  });
  mesh = faces.sort((a,b)=>b.geometry.index.count-a.geometry.index.count)[0];
  if (!mesh) return;
  mapping = mapArchivePanels(mesh);
  if (!mapping.panels.length) return;
  surfaces = [archiveSurface(mesh, mapping.panels)];
  const outline = faces.find(face=>face.material.name === 'Outline');
  if (outline) {
    const outlinePanels = mapArchivePanels(outline).panels;
    if (outlinePanels.length === mapping.panels.length) {
      // Draco gives each material its own vertex ordering. Pair by local center.
      const ordered = mapping.panels.map(({center})=>outlinePanels.reduce((nearest, panel)=>
        center.distanceToSquared(panel.center) < center.distanceToSquared(nearest.center) ? panel : nearest));
      surfaces.push(archiveSurface(outline, ordered));
    }
  }
  panelScales = mapping.panels.map(()=>({scale:1, from:1, start:0}));

  // Include the full hover range in the raycast and frustum bounds.
  mapping.panels.forEach((_,slot)=>scalePanel(slot,hoverScale));
  for (const {geometry,restBounds} of surfaces) {
    geometry.computeBoundingBox();
    geometry.boundingBox.union(restBounds);
    geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new Sphere());
  }
  mapping.panels.forEach((_,slot)=>scalePanel(slot,1));

  atlas = document.createElement('canvas');
  atlas.width = tileWidth*mapping.panels.length;
  atlas.height = tileHeight;
  texture = scene.createTexture(atlas);
  mesh.geometry.setAttribute('uv',mesh.geometry.getAttribute('archiveUv'));
  const material = mesh.material.clone();
  material.color.set('#ffffff');
  material.map = texture;
  mesh.material = material;
  paintPosters();
  for (const clip of clips) clip.poster.addEventListener('load',()=>{
    if (selected < 0) paintPosters();
  });
  if (pointer && active()) requestHoverUpdate();
}

function active() {
  return atlas && progress > .60 && leave < .1;
}
function hit(event) {
  if (!active() || viewer.open) return -1;
  target.set(event.clientX/innerWidth*2-1,1-event.clientY/innerHeight*2);
  ray.setFromCamera(target,scene.camera);
  const intersection = ray.intersectObject(mesh,false)[0];
  return intersection ? mapping.slotByVertex[intersection.face.a] : -1;
}
function archiveSurface({geometry}, panels) {
  const positions = geometry.getAttribute('position');
  return {geometry, panels, positions, restPositions:positions.clone(), restBounds:geometry.boundingBox.clone()};
}
function scalePanel(slot, scale) {
  const {center} = mapping.panels[slot];
  for (const {panels, positions, restPositions} of surfaces) {
    for (const i of panels[slot].vertices) {
      positions.setXYZ(i,
        center.x+(restPositions.getX(i)-center.x)*scale,
        center.y+(restPositions.getY(i)-center.y)*scale,
        center.z+(restPositions.getZ(i)-center.z)*scale);
    }
    positions.needsUpdate = true;
  }
}
function setHovered(slot, now) {
  if (slot === hovered) return;
  for (const i of [hovered,slot]) {
    if (i < 0) continue;
    const state = panelScales[i];
    state.from = state.scale;
    state.start = now;
  }
  hovered = slot;
  document.body.classList.toggle('phone-card-hover',slot >= 0);
  scene.ring.userData.archivePaused = selected >= 0 || (slot >= 0 && hoverMotion.matches);
}
function updateHover(now) {
  hoverFrame = 0;
  const tracking = pointer && active() && !viewer.open;
  setHovered(tracking ? hit(pointer) : -1,now);
  let animating = false;
  if (panelScales) {
    panelScales.forEach((state,slot)=>{
      const goal = slot === hovered && hoverMotion.matches ? hoverScale : 1;
      if (state.scale === goal) return;
      const elapsed = hoverMotion.matches ? Math.min(1,(now-state.start)/hoverDuration) : 1;
      state.scale = elapsed === 1 ? goal : goal+(state.from-goal)*(1-elapsed)**3;
      scalePanel(slot,state.scale);
      animating ||= elapsed < 1;
    });
  }
  if (tracking || animating) requestHoverUpdate();
}
function requestHoverUpdate() {
  if (!hoverFrame) hoverFrame = requestAnimationFrame(updateHover);
}
function clearPointer() {
  pointer = null;
  requestHoverUpdate();
}
function stop() {
  if (selected < 0) return;
  player.pause();
  player.removeAttribute('src');
  player.load();
  selected = -1;
  if (viewer.open) viewer.close();
  scene.ring.userData.archivePaused = false;
  requestHoverUpdate();
  paintPosters();
}
function play(slot) {
  if (slot === selected) { stop(); return; }
  stop();
  selected = slot;
  scene.ring.userData.archivePaused = true;
  const clip = clips[slot%clips.length];
  panel.querySelector('.phone-archive-kind').textContent = clip.kind;
  panel.querySelector('h2').textContent = clip.title;
  panel.querySelector('.phone-archive-description').replaceChildren(
    ...[...clip.description.childNodes].map(node=>node.cloneNode(true)));
  panel.querySelector('.phone-archive-status').hidden = true;
  player.poster = clip.poster.src;
  player.setAttribute('aria-label',clip.title);
  viewer.showModal();
  clearPointer();
  player.src = clip.source;
  player.play().catch(()=>{
    if (selected !== slot) return;
    const status = panel.querySelector('.phone-archive-status');
    status.textContent = 'Press play to start the clip.';
    status.hidden = false;
  });
}
close.addEventListener('click',stop);
viewer.addEventListener('cancel',event=>{ event.preventDefault(); stop(); });
viewer.addEventListener('close',stop);
viewer.addEventListener('click',event=>{ if (event.target === viewer) stop(); });
document.addEventListener('visibilitychange',()=>{
  if (!document.hidden) return;
  clearPointer();
  stop();
});
document.addEventListener('click',event=>{
  const slot = hit(event);
  if (slot >= 0) play(slot);
});
document.addEventListener('pointermove',event=>{
  pointer = event.pointerType === 'mouse' && !viewer.open
    ? {clientX:event.clientX,clientY:event.clientY}
    : null;
  if (active() || hovered >= 0) requestHoverUpdate();
},{passive:true});
document.addEventListener('pointerout',event=>{ if (!event.relatedTarget) clearPointer(); });
window.addEventListener('blur',clearPointer);
hoverMotion.addEventListener('change',()=>{
  if (scene) scene.ring.userData.archivePaused = selected >= 0 || (hovered >= 0 && hoverMotion.matches);
  requestHoverUpdate();
});
document.addEventListener('visitors-phone-progress',event=>{
  progress = event.detail;
  if (!active()) stop();
  if (pointer || hovered >= 0) requestHoverUpdate();
});
document.addEventListener('visitors-phone-leave',event=>{
  leave = event.detail;
  if (!active()) stop();
  if (pointer || hovered >= 0) requestHoverUpdate();
});
section.addEventListener('phone-archive-ready',attach);
attach();

// Copy the rendered homepage before the phone begins its pullback.
let lastCapture = -Infinity;
window.captureVisitorsHero = (source,gl) => {
  const screen = window.visitorsPhoneScreen;
  if (!screen || !source.width || !source.height ||
      hero.getBoundingClientRect().top < -4 ||
      performance.now()-lastCapture < 800) return;
  const surface = screen.texture.image;
  const scale = Math.min(1, 1024/source.width);
  const width = Math.round(source.width*scale);
  const height = Math.round(source.height*scale);
  if (surface.width !== width || surface.height !== height) {
    surface.width = width;
    surface.height = height;
  }
  const context = surface.getContext('2d');
  // Read the current framebuffer before WebGL presents it. Canvas-to-canvas
  // copies can return a cleared frame on a non-preserved WebGL canvas.
  const pixels = new Uint8Array(source.width*source.height*4);
  gl.readPixels(0,0,source.width,source.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  const stride = source.width*4;
  const rows = new Uint8ClampedArray(pixels.length);
  for (let y=0;y<source.height;y++) {
    rows.set(pixels.subarray(y*stride,(y+1)*stride),(source.height-y-1)*stride);
  }
  const frame = document.createElement('canvas');
  frame.width = source.width;
  frame.height = source.height;
  frame.getContext('2d').putImageData(new ImageData(rows,source.width,source.height),0,0);
  context.drawImage(frame,0,0,width,height);
  screen.texture.needsUpdate = true;
  screen.ready.value = 1;
  lastCapture = performance.now();
};
