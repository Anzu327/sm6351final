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

export function paintSky(canvas, width, height, passage = false) {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const random = randomGenerator(passage ? 2109 : 152013);
  const unit = Math.min(width, height);
  const light = ctx.createLinearGradient(width * .11, height, width * .86, 0);
  light.addColorStop(0, passage ? '#777d99' : '#879d97');
  light.addColorStop(.44, passage ? '#9499ad' : '#9eafa5');
  light.addColorStop(.76, passage ? '#b4b1b5' : '#bac1ad');
  light.addColorStop(1, passage ? '#d2c3b8' : '#d1cbb7');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, width, height);

  const haze = [
    [.37, .18, .9, '#a8b6a439'], [.75, .49, .60, '#e0b9934c'],
    [.08, .50, .70, '#2a424b66'], [.48, .93, .80, '#2b4b7155'],
    [.86, .9, .60, '#1c354a5c'],
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
    ctx.fillStyle = random() < .33 ? '#faf0cd69' : random() < .55 ? '#26395c80' : '#48679c85';
    ctx.fillRect(x, y, size * 1.18, size);
  }

  ctx.globalAlpha = .44;
  const orbitCenter = passage ? [width * .65, height * .6] : [width * .55, height * .52];
  const orbitScale = Math.max(width, height) * .61;
  const orbitList = [
    [1.08, .164, '#b9c5b45d', 1], [1.04, .145, '#293d646b', 1.25],
    [1.022, .132, '#abc1b475', 1.2], [.99, .105, '#eee3b985', 1.7],
    [.977, .109, '#344d716e', .8], [.75, .198, '#374f7275', .8],
  ];
  for (const [a, b, color, stroke] of orbitList) {
    sketchOrbit(ctx, random, ...orbitCenter, orbitScale * a, orbitScale * b, passage ? -.21 : -.35, color, stroke);
  }

  ctx.globalAlpha = .68;
  if (passage) {
    planet(ctx, random, .14 * width, .29 * height, .039 * unit, '#d7ccb4', '#9e98ba', '#656489', false);
    planet(ctx, random, .90 * width, .29 * height, .042 * unit, '#f2d198', '#ca8f80', '#885978', true);
  } else {
    planet(ctx, random, .858 * width, .245 * height, .048 * unit, '#ffd5a8', '#e49079', '#8e516e', true);
    planet(ctx, random, .235 * width, .76 * height, .029 * unit, '#c6e0df', '#78a5b4', '#456c9b', false);
    planet(ctx, random, .286 * width, .221 * height, .017 * unit, '#c4b3db', '#8c8ab9', '#68628b', false);
    planet(ctx, random, .934 * width, .741 * height, .018 * unit, '#ddcbd7', '#a28abe', '#76648e', false);
  }

  ctx.globalAlpha = .72;
  for (const [x, y, size] of [[.15, .26, 5], [.31, .57, 3], [.52, .20, 9], [.78, .68, 6], [.9, .47, 4], [.08, .74, 4], [.71, .12, 3], [.57, .82, 3]]) {
    star(ctx, width * x, height * y, size, '#f7e9bba8');
  }
}
