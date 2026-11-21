import { cellToBoundary, cellToChildren, cellToLatLng, cellToParent, cellsToMultiPolygon, gridDisk, latLngToCell } from 'h3-js';
import {
  Color, CylinderGeometry, DynamicDrawUsage, InstancedBufferAttribute, InstancedBufferGeometry,
  InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, Quaternion,
  ShaderMaterial, Vector2, Vector3,
} from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { radialLineInk } from './earth-palette.js';

// Use the World Population demo's H3 resolution and three-globe's default
// 20% cell margin. Approximate each footprint with a tapered instance.
const cellResolution = 4;
const regionResolution = 2;
const cellFill = .8;
const baseRadius = 1.006;
const minHighlightHeight = .17;
const minHighlightRadius = .0115;
export const landingCellId = (lat, lon) => latLngToCell(lat, lon, cellResolution);
const regionId = cellId => cellToParent(cellId, regionResolution);
export const landingRegionId = (lat, lon) => regionId(landingCellId(lat, lon));

function createRegionalGlow() {
  const plane = new PlaneGeometry(2, 2);
  const geometry = new InstancedBufferGeometry();
  geometry.setIndex(plane.index);
  geometry.setAttribute('position', plane.attributes.position);
  geometry.instanceCount = 0;
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      viewport: { value: new Vector2(1, 1) },
      ink: { value: new Color('#ffb759') },
    },
    vertexShader: `
      uniform vec2 viewport;
      attribute vec3 glowBase, glowTip;
      attribute float glowOpacity;
      varying vec2 pixel;
      varying float span, opacity;
      void main() {
        vec4 base = projectionMatrix * modelViewMatrix * vec4(glowBase, 1.);
        vec4 tip = projectionMatrix * modelViewMatrix * vec4(glowTip, 1.);
        vec3 start = base.xyz / base.w;
        vec3 end = tip.xyz / tip.w;
        vec2 delta = (end.xy - start.xy) * viewport * .5;
        span = length(delta);
        vec2 tangent = span > .01 ? delta / span : vec2(1., 0.);
        vec2 normal = vec2(-tangent.y, tangent.x);
        pixel = vec2(mix(-10., span + 10., position.x * .5 + .5), position.y * 10.);
        vec2 offset = tangent * pixel.x + normal * pixel.y;
        float along = clamp(pixel.x / max(span, .01), 0., 1.);
        opacity = glowOpacity;
        gl_Position = vec4(start.xy + 2. * offset / viewport, mix(start.z, end.z, along), 1.);
      }
    `,
    fragmentShader: `
      uniform vec3 ink;
      varying vec2 pixel;
      varying float span, opacity;
      void main() {
        float distance = length(vec2(pixel.x - clamp(pixel.x, 0., span), pixel.y));
        float halo = 1. - smoothstep(1.5, 10., distance);
        gl_FragColor = vec4(ink, opacity * .72 * halo * halo);
        #include <colorspace_fragment>
      }
    `,
  });
  const glow = new Mesh(geometry, material);
  glow.name = 'Regional hover glow';
  glow.frustumCulled = false;
  glow.renderOrder = -1;
  glow.visible = false;
  return glow;
}

export function createLandingDensity(parent, pointOnSphere) {
  const geometry = new CylinderGeometry(.72, 1, 1, 6, 1, true);
  const material = new MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false });
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying float lineProgress;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nlineProgress = position.y + .5;',
    );
    shader.fragmentShader = 'varying float lineProgress;\n' + shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      'diffuseColor.a *= 1. - .38 * smoothstep(.55, 1., lineProgress);\n#include <opaque_fragment>',
    );
  };
  let columns = new InstancedMesh(geometry, material, 0);
  columns.name = 'Regional landing counts';
  columns.frustumCulled = false;
  parent.add(columns);
  const glow = createRegionalGlow();
  parent.add(glow);
  const outline = new LineSegments2(new LineSegmentsGeometry(), new LineMaterial({ color: '#ffe5f1', linewidth: 2 }));
  outline.name = 'Selected meteorite region';
  outline.visible = false;
  parent.add(outline);
  let cells = [];
  let recordCells = [];
  let regionRecords = new Map();
  let counted = new Uint8Array(0);
  let landedCount = 0;
  const transform = new Object3D();
  const up = new Vector3(0, 1, 0);
  const ink = radialLineInk.map(hex => new Color(hex));
  const highlightInk = new Color('#fff3c6');
  const color = new Color();
  const projection = new Matrix4();
  const eye = new Vector3();
  const start = new Vector3();
  const end = new Vector3();
  const surfacePoint = new Vector3();
  const sightline = new Vector3();
  let hovered = null;
  let selected = null;

  function setRecords(records) {
    const bins = new Map();
    regionRecords = new Map();
    recordCells = records.map(record => {
      const key = landingCellId(record.lat, record.lon);
      let cell = bins.get(key);
      if (!cell) {
        const [lat, lon] = cellToLatLng(key);
        const normal = pointOnSphere(lat, lon, 1);
        const boundary = cellToBoundary(key);
        const sumRadius = boundary.reduce((sum, [edgeLat, edgeLon]) =>
          sum + normal.distanceTo(pointOnSphere(edgeLat, edgeLon, 1)), 0);
        const radius = cellFill * sumRadius / boundary.length;
        const rotation = new Quaternion().setFromUnitVectors(up, normal);
        const regionKey = regionId(key);
        cell = { key, regionKey, lat, lon, normal, rotation, radius, count: 0, height: 0, drawnHeight: 0, emphasis: 0, records: [] };
        bins.set(key, cell);
      }
      cell.records.push(record);
      let regional = regionRecords.get(cell.regionKey);
      if (!regional) regionRecords.set(cell.regionKey, regional = []);
      regional.push(record);
      return cell;
    });
    hovered = selected = null;
    outline.visible = false;
    cells = [...bins.values()];
    glow.geometry.instanceCount = 0;
    glow.visible = false;
    counted = new Uint8Array(records.length);
    landedCount = 0;
    parent.remove(columns);
    columns.dispose();
    columns = new InstancedMesh(geometry, material, cells.length);
    columns.name = 'Regional landing counts';
    columns.frustumCulled = false;
    parent.add(columns);
    update(0);
  }

  function land(index) {
    // Replaying a meteor must not add another catalogue observation.
    if (!counted[index] && recordCells[index]) {
      counted[index] = 1;
      recordCells[index].count++;
      landedCount++;
    }
  }

  function regionForCell(cell) {
    const keys = new Set(gridDisk(cell.regionKey, 1));
    const [lat, lon] = cellToLatLng(cell.regionKey);
    const records = [...keys].flatMap(key => regionRecords.get(key) ?? []);
    return { keys, lat, lon, records };
  }

  function select(cell, region) {
    selected = cell;
    outline.visible = Boolean(region);
    if (!region) return;

    // Trace the union of the same fine cells used to assign catalogue records.
    const children = [...region.keys].flatMap(key => cellToChildren(key, cellResolution));
    const points = [];
    const alongEdge = new Vector3();
    for (const polygon of cellsToMultiPolygon(children)) {
      for (const ring of polygon) {
        const vertices = ring.map(([lat, lon]) => pointOnSphere(lat, lon, 1));
        for (let index = 0; index < vertices.length; index++) {
          const start = vertices[index];
          const end = vertices[(index + 1) % vertices.length];
          for (let step = 0; step <= 2; step++) {
            alongEdge.lerpVectors(start, end, step / 2).normalize().multiplyScalar(1.015);
            points.push(alongEdge.x, alongEdge.y, alongEdge.z);
            if (step === 1) points.push(alongEdge.x, alongEdge.y, alongEdge.z);
          }
        }
      }
    }
    outline.geometry.dispose();
    outline.geometry = new LineSegmentsGeometry().setPositions(points);
  }

  function pick(camera, x, y, width, height, tolerance) {
    if (!parent.visible) return null;
    parent.updateWorldMatrix(true, false);
    camera.updateWorldMatrix(true, false);
    projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(parent.matrixWorld);
    parent.worldToLocal(camera.getWorldPosition(eye));
    const clip = projection.elements;
    const threshold = tolerance ** 2;
    let closest = null;
    let bestDistance = threshold;
    let bestDepth = Infinity;
    for (const cell of cells) {
      if (cell.drawnHeight <= .0001) continue;
      start.copy(cell.normal).multiplyScalar(baseRadius).applyMatrix4(projection);
      end.copy(cell.normal).multiplyScalar(baseRadius + cell.drawnHeight).applyMatrix4(projection);
      const ax = (start.x + 1) * width / 2;
      const ay = (1 - start.y) * height / 2;
      const dx = (end.x - start.x) * width / 2;
      const dy = (start.y - end.y) * height / 2;
      const span = dx * dx + dy * dy;
      const fraction = span ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / span)) : 0;
      const distance = (x - ax - dx * fraction) ** 2 + (y - ay - dy * fraction) ** 2;
      const depth = start.z + (end.z - start.z) * fraction;
      if (distance > threshold || depth < -1 || depth > 1) continue;
      if (closest && (distance > bestDistance + 1 || (Math.abs(distance - bestDistance) <= 1 && depth >= bestDepth))) continue;

      // Convert the projected interpolation back to a distance along the 3D line.
      const radialDepth = clip[3] * cell.normal.x + clip[7] * cell.normal.y + clip[11] * cell.normal.z;
      const startDepth = clip[15] + radialDepth * baseRadius;
      const endDepth = startDepth + radialDepth * cell.drawnHeight;
      const localFraction = fraction * startDepth / ((1 - fraction) * endDepth + fraction * startDepth);
      surfacePoint.copy(cell.normal).multiplyScalar(baseRadius + cell.drawnHeight * localFraction);
      sightline.subVectors(surfacePoint, eye);
      const nearest = Math.max(0, Math.min(1, -eye.dot(sightline) / sightline.lengthSq()));
      if (surfacePoint.copy(eye).addScaledVector(sightline, nearest).lengthSq() < 1.004 ** 2) continue;
      closest = cell;
      bestDistance = distance;
      bestDepth = depth;
    }
    return closest;
  }

  function update(dt, heightFactor = 1, interactionDt = dt, reducedMotion = false) {
    const follow = 1 - Math.exp(-dt * 7);
    const emphasisFollow = reducedMotion ? 1 : 1 - Math.exp(-interactionDt * 18);
    const highlights = [];
    cells.forEach((cell, index) => {
      // Keep isolated records close to the surface and give large clusters
      // progressively longer lines, with a fixed upper bound across filters.
      const targetHeight = cell.count ? .008 + .73 * (cell.count / (cell.count + 800)) ** .72 : 0;
      cell.height += (targetHeight - cell.height) * follow;
      const targetEmphasis = Number(cell === hovered || cell === selected);
      cell.emphasis += (targetEmphasis - cell.emphasis) * emphasisFollow;
      const highlightHeight = Math.max(minHighlightHeight, cell.height * 1.35);
      const height = (cell.height + (highlightHeight - cell.height) * cell.emphasis) * heightFactor;
      cell.drawnHeight = height;
      transform.position.copy(cell.normal).multiplyScalar(baseRadius + height / 2);
      transform.quaternion.copy(cell.rotation);
      const highlightRadius = Math.max(minHighlightRadius, cell.radius * 1.7);
      const width = height > .0001 ? cell.radius + (highlightRadius - cell.radius) * cell.emphasis : 0;
      transform.scale.set(width, height, width);
      transform.updateMatrix();
      columns.setMatrixAt(index, transform.matrix);
      const rank = (ink.length - 1) * Math.min(1, Math.log1p(cell.count) / Math.log1p(5500));
      const lower = Math.min(ink.length - 2, Math.floor(rank));
      color.copy(ink[lower]).lerp(ink[lower + 1], rank - lower);
      color.lerp(highlightInk, .83 * cell.emphasis);
      columns.setColorAt(index, color);
      if (cell.emphasis > .01 && height > .0001) highlights.push(cell);
    });
    columns.instanceMatrix.needsUpdate = true;
    if (columns.instanceColor) columns.instanceColor.needsUpdate = true;
    updateGlow(highlights, heightFactor);
  }

  function updateGlow(highlights, visibility) {
    const geometry = glow.geometry;
    const count = highlights.length;
    glow.visible = count > 0;
    geometry.instanceCount = count;
    if (!count) return;
    if (!geometry.attributes.glowOpacity || geometry.attributes.glowOpacity.count < count) {
      geometry.dispose();
      const capacity = Math.max(8, count * 2);
      for (const [name, size] of [['glowBase', 3], ['glowTip', 3], ['glowOpacity', 1]]) {
        geometry.setAttribute(name, new InstancedBufferAttribute(new Float32Array(capacity * size), size)
          .setUsage(DynamicDrawUsage));
      }
    }
    const { glowBase, glowTip, glowOpacity } = geometry.attributes;
    highlights.forEach((cell, index) => {
      start.copy(cell.normal).multiplyScalar(baseRadius);
      end.copy(cell.normal).multiplyScalar(baseRadius + cell.drawnHeight);
      glowBase.setXYZ(index, start.x, start.y, start.z);
      glowTip.setXYZ(index, end.x, end.y, end.z);
      glowOpacity.setX(index, visibility * cell.emphasis);
    });
    for (const attribute of [glowBase, glowTip, glowOpacity]) {
      attribute.addUpdateRange(0, count * attribute.itemSize);
      attribute.needsUpdate = true;
    }
  }

  return {
    setRecords, land, update, pick, regionForCell, select,
    setViewport(width, height) { glow.material.uniforms.viewport.value.set(width, height); },
    hover(cell) { hovered = cell; },
    get landedCount() { return landedCount; },
  };
}
