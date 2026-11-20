import { BufferAttribute, BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';

const verticalAxis = new Vector3(0,1,0);

// The GLB stores the blue ribbon faces in one mesh. Group welded vertices
// into its original panels while keeping both the geometry and outline intact.
export function mapArchivePanels(mesh) {
  const geometry = mesh.geometry;
  const positions = geometry.getAttribute('position');
  const indices = geometry.index;
  const parent = Array.from({length:positions.count}, (_,i)=>i);
  function root(i) {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  }
  const join = (a,b) => { parent[root(a)] = root(b); };
  const welded = new Map();
  const position = i => [positions.getX(i),positions.getY(i),positions.getZ(i)];
  for (let i=0; i<positions.count; i++) {
    const key = position(i).map(value=>Math.round(value*10000)).join(',');
    if (welded.has(key)) join(i,welded.get(key));
    else welded.set(key,i);
  }
  for (let i=0; i<indices.count; i+=3) {
    join(indices.getX(i),indices.getX(i+1));
    join(indices.getX(i),indices.getX(i+2));
  }
  const components = new Map();
  for (let i=0; i<positions.count; i++) {
    const id = root(i);
    if (!components.has(id)) components.set(id,[]);
    components.get(id).push(i);
  }
  const uv = new Float32Array(positions.count*2);
  uv.fill(-1);
  const slotByVertex = new Int16Array(positions.count).fill(-1);
  geometry.computeBoundingBox();
  const axis = geometry.boundingBox.getCenter(new Vector3());
  const panels = [...components.values()].filter(vertices=>vertices.length>50).map(vertices=>{
    const center = new Vector3();
    vertices.forEach(i=>center.add(new Vector3(...position(i))));
    return {vertices,center:center.multiplyScalar(1/vertices.length)};
  });
  panels.sort((a,b)=>Math.atan2(a.center.z-axis.z,a.center.x-axis.x)-Math.atan2(b.center.z-axis.z,b.center.x-axis.x));
  panels.forEach(({vertices,center},slot)=>{
    const angle = Math.atan2(center.z-axis.z,center.x-axis.x);
    const coords = vertices.map(i=>{
      const [x,y,z] = position(i);
      let u = Math.atan2(z-axis.z,x-axis.x)-angle;
      u = Math.atan2(Math.sin(u),Math.cos(u));
      return [u,y];
    });
    const minU = Math.min(...coords.map(([u])=>u));
    const maxU = Math.max(...coords.map(([u])=>u));
    const minY = Math.min(...coords.map(([,y])=>y));
    const maxY = Math.max(...coords.map(([,y])=>y));
    vertices.forEach((i,j)=>{
      const [u,y] = coords[j];
      uv[2*i] = (slot+1-(u-minU)/Math.max(.001,maxU-minU))/panels.length;
      uv[2*i+1] = (y-minY)/Math.max(.001,maxY-minY);
      slotByVertex[i] = slot;
    });
  });
  geometry.setAttribute('archiveUv',new Float32BufferAttribute(uv,2));
  return {axis,panels,slotByVertex};
}

export function arrangeArchivePanels(mesh, source, placements, axis, widthScale) {
  const original = mesh.geometry;
  const geometry = new BufferGeometry();
  const attributes = Object.entries(original.attributes);
  const vertexCount = placements.reduce((count,{panel})=>count+source.panels[panel].vertices.length,0);
  for (const [name,attribute] of attributes) {
    const values = new attribute.array.constructor(vertexCount*attribute.itemSize);
    geometry.setAttribute(name,new BufferAttribute(values,attribute.itemSize,attribute.normalized));
  }

  const indices = [];
  const slotByVertex = new Int16Array(vertexCount);
  const destinationByVertex = new Int32Array(original.getAttribute('position').count);
  const point = new Vector3();
  const normal = new Vector3();
  const position = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('archiveUv');
  let destination = 0;
  const panels = placements.map(({panel,angle,target},slot)=>{
    const {vertices,center} = source.panels[panel];
    const arrangedVertices = vertices.map(vertex=>{
      const index = destination++;
      for (const [name,attribute] of attributes) geometry.getAttribute(name).copyAt(index,attribute,vertex);
      point.fromBufferAttribute(position,index).sub(axis);
      const relative = Math.atan2(point.z,point.x)-angle;
      const offset = Math.atan2(Math.sin(relative),Math.cos(relative));
      const rotation = angle-target+offset*(1-widthScale);
      point.applyAxisAngle(verticalAxis,rotation).add(axis);
      position.setXYZ(index,point.x,point.y,point.z);
      if (normals) {
        normal.fromBufferAttribute(normals,index).applyAxisAngle(verticalAxis,rotation);
        normals.setXYZ(index,normal.x,normal.y,normal.z);
      }
      uv.setX(index,(uv.getX(index)*source.panels.length-panel+slot)/placements.length);
      destinationByVertex[vertex] = index;
      slotByVertex[index] = slot;
      return index;
    });
    for (const index of original.index.array) {
      if (source.slotByVertex[index] === panel) indices.push(destinationByVertex[index]);
    }
    const arrangedCenter = center.clone().sub(axis).applyAxisAngle(verticalAxis,angle-target).add(axis);
    return {vertices:arrangedVertices,center:arrangedCenter};
  });
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  mesh.geometry = geometry;
  return {panels,slotByVertex};
}
