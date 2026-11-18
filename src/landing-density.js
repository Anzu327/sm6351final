import { BufferAttribute, Color, CylinderGeometry, InstancedMesh, MeshBasicMaterial, Object3D, Vector3 } from 'three';
import { densityInk } from './earth-palette.js';

// Equal-area cells: 18 equal steps in sin(latitude), 72 longitude bands.
// Hexagonal columns borrow the visual language of globe.gl/world-population.
// Height encodes unique landed records, independently of their mass.
export function createLandingDensity(parent, pointOnSphere) {
  const geometry = new CylinderGeometry(.0125, .0125, 1, 6);
  const normals = geometry.attributes.normal;
  const shades = new Float32Array(normals.count * 3);
  for (let index = 0; index < normals.count; index++) {
    const shade = .52 + Math.abs(normals.getY(index)) * .45 + normals.getX(index) * .17;
    shades.fill(shade, index * 3, index * 3 + 3);
  }
  geometry.setAttribute('color', new BufferAttribute(shades, 3));
  const material = new MeshBasicMaterial({color: '#ffffff', vertexColors: true});
  let columns = new InstancedMesh(geometry, material, 0);
  columns.name = 'Regional landing counts';
  columns.frustumCulled = false;
  parent.add(columns);
  let cells = [];
  let recordCells = [];
  let counted = new Uint8Array(0);
  let landedCount = 0;
  const transform = new Object3D();
  const up = new Vector3(0, 1, 0);
  const ink = densityInk.slice(3).map(hex => new Color(hex));
  const color = new Color();

  function setRecords(records) {
    const bins = new Map();
    recordCells = records.map(record => {
      const row = Math.max(0, Math.min(17, Math.floor((Math.sin(record.lat * Math.PI / 180) + 1) * 9)));
      const column = Math.max(0, Math.min(71, Math.floor(((record.lon + 180) % 360 + 360) % 360 / 5)));
      const key = row * 72 + column;
      if (!bins.has(key)) {
        const lat = Math.asin(-1 + (row + .5) / 9) * 180 / Math.PI;
        const lon = -180 + (column + .5) * 5;
        bins.set(key, {normal: pointOnSphere(lat, lon, 1), count: 0, height: 0});
      }
      return bins.get(key);
    });
    cells = [...bins.values()];
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

  function update(dt, heightFactor = 1) {
    const follow = 1 - Math.exp(-dt * 7);
    cells.forEach((cell, index) => {
      // Fixed log scale keeps Antarctic recovery clusters in view while
      // preserving a strictly increasing height for every additional record.
      cell.height += (.075 * Math.log1p(cell.count) - cell.height) * follow;
      const height = cell.height * heightFactor;
      transform.position.copy(cell.normal).multiplyScalar(1.006 + height / 2);
      transform.quaternion.setFromUnitVectors(up, cell.normal);
      const width = height > .0001 ? 1 : 0;
      transform.scale.set(width, height, width);
      transform.updateMatrix();
      columns.setMatrixAt(index, transform.matrix);
      const rank = (ink.length - 1) * Math.min(1, Math.log1p(cell.count) / Math.log1p(10000));
      const lower = Math.min(ink.length - 2, Math.floor(rank));
      color.copy(ink[lower]).lerp(ink[lower + 1], rank - lower);
      columns.setColorAt(index, color);
    });
    columns.instanceMatrix.needsUpdate = true;
    if (columns.instanceColor) columns.instanceColor.needsUpdate = true;
  }

  return {setRecords, land, update, get landedCount() { return landedCount; }};
}
