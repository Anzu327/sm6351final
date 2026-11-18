import * as THREE from 'three';

const pointCount = 18;
const maxDegree = 3;
const maxLinks = pointCount * maxDegree / 2;
const connectTime = .35;
const halfHeight = 1.5;

function dynamicAttribute(count, size) {
  return new THREE.BufferAttribute(new Float32Array(count * size), size).setUsage(THREE.DynamicDrawUsage);
}

export function createPlexus(radius) {
  const group = new THREE.Group();
  const opacity = { value: 0 };
  const pointsGeometry = new THREE.BufferGeometry();
  const positions = dynamicAttribute(pointCount, 3);
  const strengths = dynamicAttribute(pointCount, 1);
  pointsGeometry.setAttribute('position', positions);
  pointsGeometry.setAttribute('strength', strengths);
  const pointsMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { opacity, dpi: { value: 1 } },
    vertexShader: `
      uniform float dpi;
      attribute float strength;
      varying float amount;
      void main() {
        amount = strength;
        vec4 p = modelViewMatrix * vec4(position,1.);
        gl_PointSize = max(1., 34. * dpi * strength / length(p.xyz));
        gl_Position = projectionMatrix * p;
      }
    `,
    fragmentShader: `
      uniform float opacity;
      varying float amount;
      void main() {
        vec2 p = abs(gl_PointCoord - .5);
        float cross = (1. - smoothstep(.045,.16,min(p.x,p.y))) *
                      (1. - smoothstep(.28,.49,max(p.x,p.y)));
        if (cross * amount < .01) discard;
        gl_FragColor = vec4(.065,.10,.37, cross * amount * opacity * .68);
        #include <colorspace_fragment>
      }
    `,
  });
  const linesGeometry = new THREE.BufferGeometry();
  const lines = dynamicAttribute(maxLinks * 2, 3);
  linesGeometry.setAttribute('position', lines);
  const linesMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { opacity },
    vertexShader: `
      varying vec3 inkPosition;
      void main() {
        inkPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
      }
    `,
    fragmentShader: `
      uniform float opacity;
      varying vec3 inkPosition;
      void main() {
        float gaps = (sin(dot(inkPosition, vec3(12.,9.,-9.))) +
                      sin(dot(inkPosition, vec3(8.,-11.,15.))) +
                      sin(dot(inkPosition, vec3(-17.,7.,8.)))) / 6. + .5;
        float amount = smoothstep(.34,.52,gaps) * smoothstep(.66,1.6,length(inkPosition));
        gl_FragColor = vec4(.065,.10,.37,opacity * amount * .61);
        #include <colorspace_fragment>
      }
    `,
  });
  const linesMesh = new THREE.LineSegments(linesGeometry, linesMaterial);
  const pointMesh = new THREE.Points(pointsGeometry, pointsMaterial);
  linesMesh.frustumCulled = pointMesh.frustumCulled = false;
  group.add(linesMesh, pointMesh);

  let seed = 80329;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const nodes = Array.from({ length: pointCount }, () => ({
    angle: random() * Math.PI * 2, radius: (.8 + .2 * random()) * radius,
    startY: random() * 3, speed: random(), location: new THREE.Vector3(),
    level: 0, neighbors: new Set(), active: false,
  }));
  const edges = [];
  const tip = new THREE.Vector3();
  let previous = 0;

  function update(time, alpha, specimen) {
    const step = Math.min(.05, Math.max(0, time - previous)) / connectTime;
    previous = time;
    opacity.value = alpha;
    group.visible = alpha > .001;
    if (!group.visible) return;
    group.position.copy(specimen.position);
    group.quaternion.copy(specimen.quaternion);
    for (const node of nodes) {
      const angle = node.angle + (node.speed - .5) * .5 * time;
      const y = (node.startY + node.speed * time * .25) % 3 - halfHeight;
      node.active = Math.abs(y) < halfHeight * .75 && Math.abs(y - node.location.y) < halfHeight;
      node.location.set(Math.cos(angle) * node.radius + .1 * Math.sin(time * .5 + node.speed * 2.324),
        y, Math.sin(angle) * node.radius + .1 * Math.sin(time * .5 + node.speed * 9.564));
    }
    for (let i = edges.length - 1; i >= 0; i--) {
      const edge = edges[i];
      edge.retract ||= !edge.a.active || !edge.b.active;
      edge.amount = THREE.MathUtils.clamp(edge.amount + (edge.retract ? -step : step), 0, 1);
      if (edge.retract && edge.amount === 0) {
        edge.a.neighbors.delete(edge.b);
        edge.b.neighbors.delete(edge.a);
        edges.splice(i, 1);
      }
    }
    for (const node of nodes) {
      if (!node.active || node.neighbors.size >= maxDegree) continue;
      const candidates = nodes.filter(other => other !== node && other.active &&
        other.neighbors.size < maxDegree && !node.neighbors.has(other))
        .map(other => ({ other, distance: other.location.distanceTo(node.location) }))
        .filter(candidate => candidate.distance < 3)
        .sort((a, b) => a.distance - b.distance);
      for (const { other } of candidates) {
        if (node.neighbors.size >= maxDegree) break;
        node.neighbors.add(other);
        other.neighbors.add(node);
        edges.push({ a: node, b: other, amount: 0, retract: false });
      }
    }
    edges.forEach(({ a, b, amount }, i) => {
      const head = tip.lerpVectors(a.location, b.location, amount);
      lines.setXYZ(i * 2, a.location.x, a.location.y, a.location.z);
      lines.setXYZ(i * 2 + 1, head.x, head.y, head.z);
    });
    linesGeometry.setDrawRange(0, edges.length * 2);
    nodes.forEach((node, index) => {
      node.level = THREE.MathUtils.clamp(node.level + (node.active && node.neighbors.size ? step : -step), 0, 1);
      positions.setXYZ(index, node.location.x, node.location.y, node.location.z);
      strengths.setX(index, node.level);
    });
    lines.needsUpdate = positions.needsUpdate = strengths.needsUpdate = true;
  }

  return { group, update, setPixelRatio: value => { pointsMaterial.uniforms.dpi.value = value; } };
}
