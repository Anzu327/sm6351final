// Keep the live tunnel geometry and its scroll reveal; replace only its sky map.
export function prepareStarryScene(model, CanvasTexture) {
  for (const name of ['Dress', 'Legs', 'Hair']) {
    const person = model.getObjectByName(name);
    person?.removeFromParent();
  }
  const sky = model.getObjectByName('Cylinder');
  if (!sky?.material.map) return;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 2048;
  const ctx = canvas.getContext('2d');
  let seed = 327;
  const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  ctx.fillStyle = '#101b82';
  ctx.fillRect(0, 0, 2048, 2048);
  // Fine pencil marks give the sky the same paper texture as the ground.
  for (let i = 0; i < 100000; i++) {
    const x = random() * 2048, y = random() * 2048;
    ctx.strokeStyle = random() > .5 ? '#4063bd20' : '#060f5525';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 2, y - 5);
    ctx.stroke();
  }
  // A soft, winding field of tiny stars, with no large leaf-like brush dabs.
  for (let i = 0; i < 7000; i++) {
    const x = random() * 2048;
    const y = i < 2500
      ? (1024 + 400 * Math.sin(x / 2048 * Math.PI * 2) + (random() - .5) * 480)
      : random() * 2048;
    const r = 1.1 + random() * 2.1;
    ctx.fillStyle = `rgba(255,237,182,${.2 + random() * .65})`;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * .7, -.5, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 110; i++) {
    const x = random() * 2048, y = random() * 2048, r = 5 + random() * 7;
    ctx.fillStyle = '#fff0bf';
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r * .23, y - r * .23);
    ctx.lineTo(x + r * .75, y); ctx.lineTo(x + r * .23, y + r * .23);
    ctx.lineTo(x, y + r); ctx.lineTo(x - r * .23, y + r * .23);
    ctx.lineTo(x - r * .75, y); ctx.lineTo(x - r * .23, y - r * .23);
    ctx.closePath(); ctx.fill();
  }
  const original = sky.material.map;
  const texture = new CanvasTexture(canvas);
  texture.flipY = original.flipY;
  texture.colorSpace = original.colorSpace;
  texture.wrapS = original.wrapS;
  texture.wrapT = original.wrapT;
  texture.repeat.copy(original.repeat);
  texture.offset.copy(original.offset);
  sky.material = sky.material.clone();
  sky.material.map = texture;
  sky.material.emissive.set('#ffffff');
  sky.material.emissiveMap = texture;
  sky.material.emissiveIntensity = .65;
  sky.material.needsUpdate = true;
}
