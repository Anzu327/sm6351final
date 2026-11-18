import { accent, cobalt, ink, paper } from './palette.js';

function randomGenerator(seed) {
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function sketchOrbit(ctx, random, x, y, rx, ry, tilt, color, stroke) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.strokeStyle = color;
  ctx.lineWidth = stroke;
  ctx.beginPath();
  for (let step = 0; step <= 220; step++) {
    const angle = step / 220 * 2 * Math.PI;
    const pen = Math.sin(angle * 21) * 1.4 + (random() - .5) * 1.3;
    const px = (rx + pen) * Math.cos(angle);
    const py = (ry + pen) * Math.sin(angle);
    if (step === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function planet(ctx, random, x, y, radius, light, mid, shade, hasRing) {
  const glow = ctx.createRadialGradient(x, y, radius * .65, x, y, radius * 2);
  glow.addColorStop(0, light + '33');
  glow.addColorStop(1, light + '00');
  ctx.fillStyle = glow;
  ctx.fillRect(x - radius * 2, y - radius * 2, radius * 4, radius * 4);

  ctx.beginPath();
  for (let step = 0; step <= 110; step++) {
    const angle = step / 110 * Math.PI * 2;
    const r = radius + (random() - .5) * Math.min(radius * .035, 1.25);
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (step === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  const fill = ctx.createRadialGradient(x - radius * .35, y - radius * .52, 0, x, y, radius * 1.12);
  fill.addColorStop(0, light);
  fill.addColorStop(.55, mid);
  fill.addColorStop(1, shade);
  ctx.fillStyle = fill;
  ctx.strokeStyle = '#1b3444';
  ctx.lineWidth = .9;
  ctx.fill();
  ctx.stroke();

  ctx.save();
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(-.30);
  for (let band = -2; band <= 2; band++) {
    const by = band * radius * .36;
    ctx.beginPath();
    ctx.moveTo(-radius * 1.3, by);
    ctx.bezierCurveTo(-radius * .4, by + radius * .42, radius * .49, by - radius * .24, radius * 1.3, by + radius * .03);
    ctx.lineWidth = radius * (.11 + random() * .17);
    ctx.strokeStyle = band % 2 ? light + '66' : shade + '7a';
    ctx.stroke();
  }
  for (let speck = 0; speck < radius * 9; speck++) {
    ctx.fillStyle = random() < .48 ? '#1e314630' : '#fff1d14e';
    ctx.fillRect((random() * 2 - 1) * radius, (random() * 2 - 1) * radius, .5 + random(), .5 + random());
  }
  ctx.restore();

  if (hasRing) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-.39);
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 1.60, radius * .47, 0, -.46, Math.PI + .45);
    ctx.strokeStyle = '#2e3b48';
    ctx.lineWidth = radius * .14;
    ctx.stroke();
    ctx.strokeStyle = '#efd6a6';
    ctx.lineWidth = radius * .091;
    ctx.stroke();
    ctx.restore();
  }
}

function star(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.quadraticCurveTo(x + size * .12, y - size * .13, x + size, y);
  ctx.quadraticCurveTo(x + size * .13, y + size * .12, x, y + size);
  ctx.quadraticCurveTo(x - size * .1, y + size * .11, x - size, y);
  ctx.quadraticCurveTo(x - size * .13, y - size * .1, x, y - size);
  ctx.fill();
}

function paintStarfield(ctx, width, height) {
  const random = randomGenerator(327);
  ctx.fillStyle = cobalt;
  ctx.fillRect(0, 0, width, height);

  const count = Math.round(Math.min(245, Math.max(48, width * height / 9500)));
  for (let i = 0; i < count; i++) {
    const x = random() * width;
    const y = random() * height;
    const strength = random();
    const bright = strength > .94;
    const radius = bright ? 2 + random() * 1.7 : .52 + random() ** 2 * 1.08;
    if (bright) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 1.15, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffda4738';
      ctx.fill();
      ctx.strokeStyle = '#101950';
      ctx.lineWidth = .75;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = `rgba(255, 218, 65, ${bright ? 1 : .47 + strength * .55})`;
    ctx.fill();
  }
}

export function paintSky(canvas, width, height, passage = false, starfield = false) {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (starfield) {
    paintStarfield(ctx, width, height);
    return;
  }

  const random = randomGenerator(passage ? 2109 : 152013);
  const unit = Math.min(width, height);
  const light = ctx.createLinearGradient(width * .11, height, width * .86, 0);
  light.addColorStop(0, passage ? '#dac998' : '#e1cfa2');
  light.addColorStop(.44, passage ? '#efddb3' : '#f4e2b9');
  light.addColorStop(.76, paper);
  light.addColorStop(1, '#fff5db');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, width, height);

  const haze = [
    [.37, .18, .9, '#fff5db39'], [.75, .49, .60, '#fff5db4c'],
    [.08, .50, .70, '#214ab418'], [.48, .93, .80, '#214ab411'],
    [.86, .9, .60, '#15217d14'],
  ];
  for (const [x, y, scale, color] of haze) {
    const tint = ctx.createRadialGradient(width * x, height * y, 0, width * x, height * y, unit * scale);
    tint.addColorStop(0, color);
    tint.addColorStop(1, color.slice(0, 7) + '00');
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, width, height);
  }

  for (let speck = 0; speck < 740; speck++) {
    const x = random() * width;
    const y = random() * height;
    const size = .24 + random() ** 3 * 1.54;
    ctx.fillStyle = random() < .33 ? '#faf0cd69' : random() < .55 ? ink + '80' : accent + '60';
    ctx.fillRect(x, y, size * 1.18, size);
  }

  ctx.globalAlpha = .44;
  const orbitCenter = passage ? [width * .65, height * .6] : [width * .55, height * .52];
  const orbitScale = Math.max(width, height) * .61;
  const orbitList = [
    [1.08, .164, '#7690c95d', 1], [1.04, .145, ink + '6b', 1.25],
    [1.022, .132, '#899cd275', 1.2], [.99, .105, accent + '85', 1.7],
    [.977, .109, '#5873b86e', .8], [.75, .198, accent + '75', .8],
  ];
  for (const [a, b, color, stroke] of orbitList) {
    sketchOrbit(ctx, random, ...orbitCenter, orbitScale * a, orbitScale * b, passage ? -.21 : -.35, color, stroke);
  }

  const planetInks = ['#fcf0d3', '#93a7de', accent];
  ctx.globalAlpha = .68;
  if (passage) {
    planet(ctx, random, .14 * width, .29 * height, .039 * unit, ...planetInks, false);
    planet(ctx, random, .90 * width, .29 * height, .042 * unit, ...planetInks, true);
  } else {
    planet(ctx, random, .858 * width, .245 * height, .048 * unit, ...planetInks, true);
    planet(ctx, random, .235 * width, .76 * height, .029 * unit, ...planetInks, false);
    planet(ctx, random, .286 * width, .221 * height, .017 * unit, ...planetInks, false);
    planet(ctx, random, .934 * width, .741 * height, .018 * unit, ...planetInks, false);
  }

  ctx.globalAlpha = .72;
  for (const [x, y, size] of [[.15, .26, 5], [.31, .57, 3], [.52, .20, 9], [.78, .68, 6], [.9, .47, 4], [.08, .74, 4], [.71, .12, 3], [.57, .82, 3]]) {
    star(ctx, width * x, height * y, size, '#7593d280');
  }
}
