import { BufferAttribute, Color, CylinderGeometry, InstancedMesh, MeshBasicMaterial, Object3D, Vector3 } from 'three';

// Equal-area cells: 18 equal steps in sin(latitude), 72 longitude bands.
// Hexagonal columns borrow the visual language of globe.gl/world-population.
// Height encodes unique landed records, independently of their mass.
export function createLandingDensity(parent, pointOnSphere) {
  const geometry = new CylinderGeometry(.0125, .0125, 1, 6);
  const normals = geometry.attributes.normal;
  const shades = new Float32Array(normals.count * 3);
  for (let index = 0; index < normals.count; index++) {
    const shade = .64 + Math.abs(normals.getY(index)) * .3 + normals.getX(index) * .06;
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
  const transform = new Object3D();
  const up = new Vector3(0, 1, 0);
  const low = new Color('#ffe3a0');
  const high = new Color('#d95132');
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
    }
  }

  function update(dt) {
    const follow = 1 - Math.exp(-dt * 7);
    cells.forEach((cell, index) => {
      // A fixed, linear scale: 10 falls = .16 globe radii, 20 = .32.
      cell.height += (cell.count * .016 - cell.height) * follow;
      transform.position.copy(cell.normal).multiplyScalar(1.006 + cell.height / 2);
      transform.quaternion.setFromUnitVectors(up, cell.normal);
      transform.scale.set(cell.count ? 1 : 0, cell.height, cell.count ? 1 : 0);
      transform.updateMatrix();
      columns.setMatrixAt(index, transform.matrix);
      color.copy(low).lerp(high, Math.min(1, cell.count / 41));
      columns.setColorAt(index, color);
    });
    columns.instanceMatrix.needsUpdate = true;
    if (columns.instanceColor) columns.instanceColor.needsUpdate = true;
  }

  return {setRecords, land, update};
}
