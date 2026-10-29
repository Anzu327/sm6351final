import * as THREE from 'three';
function random(seed: number) { return () => { seed|=0; seed=seed+0x6d2b79f5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
export function rock(kind: 'iron'|'basalt'): THREE.Group {
  const rng=random(kind==='iron'?1947:7034);
  const geometry=new THREE.IcosahedronGeometry(1,6);
  const p=geometry.attributes.position;
  const craters=Array.from({length:kind==='iron'?45:18},()=>({direction:new THREE.Vector3(rng()*2-1,rng()*2-1,rng()*2-1).normalize(),width:.015+rng()*.05,depth:.04+rng()*.10}));
  const colors=[]; const v=new THREE.Vector3();
  for(let i=0;i<p.count;i++){
    v.fromBufferAttribute(p,i).normalize(); let radius=1+.095*Math.sin(v.x*5+v.y*3)+.07*Math.cos(v.z*7-v.y*4);
    for(const c of craters){const d=1-v.dot(c.direction); radius-=c.depth*Math.exp(-d/c.width);}
    const rough=Math.sin(v.x*49+Math.sin(v.z*27))*Math.sin(v.y*51+v.z*11);
    radius+=rough*.009;
    const x=v.x,y=v.y,z=v.z;
    p.setXYZ(i,x*radius*1.02,y*radius*1.16,z*radius*.87);
    const shade=kind==='iron'?.24+rough*.055:.075+rough*.023;
    colors.push(shade*(kind==='iron'?1.06:1),shade,shade*.94);
  }
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3)); geometry.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial({vertexColors:true,metalness:kind==='iron'?.88:.13,roughness:kind==='iron'?.48:.92});
  const group=new THREE.Group(); group.add(new THREE.Mesh(geometry,material));
  if(kind==='basalt'){
    const rng2=random(56);
    for(let i=0;i<85;i++){const a=rng2()*Math.PI*2,b=Math.acos(rng2()*2-1),s=.009+rng2()*.028; const stone=new THREE.Mesh(new THREE.IcosahedronGeometry(s,0),new THREE.MeshStandardMaterial({color:i%3?0x60615c:0xa4a399,roughness:.94}));stone.position.set(Math.sin(b)*Math.cos(a)*.92,Math.cos(b)*1.02,Math.sin(b)*Math.sin(a)*.8);group.add(stone);}
  }
  group.rotation.set(.12,-.5,.18); return group;
}
export function pallasite(): {group:THREE.Group;cut:THREE.Group;exterior:THREE.Group} {
  const group=new THREE.Group(),cut=new THREE.Group(),exterior=rock('iron');
  exterior.scale.set(1.1,.87,.28);
  const shape=new THREE.Shape();const points=[[-1.05,-.6],[-.89,.23],[-.47,.93],[.12,.82],[.82,.31],[1.05,-.52],[.48,-.89],[-.42,-.84]];
  points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
  const base=new THREE.ExtrudeGeometry(shape,{depth:.17,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.035,bevelThickness:.025});
  cut.add(new THREE.Mesh(base,new THREE.MeshStandardMaterial({color:0x858885,metalness:.95,roughness:.31})));
  const rng=random(2000);
  const inside=(x:number,y:number)=>{let hit=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
  for(let row=-4;row<=4;row++)for(let col=-5;col<=5;col++){
    const x=col*.19+(rng()-.5)*.07,y=row*.19+(rng()-.5)*.08;
    if(!inside(x,y)||!inside(x+.11,y)||!inside(x-.11,y)||!inside(x,y+.11)||!inside(x,y-.11))continue;
    const s=new THREE.Shape(); const radius=.062+rng()*.044;
    for(let k=0;k<6;k++){const a=k/6*Math.PI*2,r=radius*(.8+rng()*.3),cx=Math.cos(a)*r,cy=Math.sin(a)*r; k?s.lineTo(cx,cy):s.moveTo(cx,cy);}
    s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth:.015,bevelEnabled:true,bevelSize:.008,bevelThickness:.006,bevelSegments:1,steps:1});
    const c=new THREE.Color().setHSL(.115+rng()*.04,.26+rng()*.15,.19+rng()*.16);
    const crystal=new THREE.Mesh(g,new THREE.MeshPhysicalMaterial({color:c,metalness:.17,roughness:.24,clearcoat:.6,clearcoatRoughness:.18}));
    crystal.position.set(x,y,.178);cut.add(crystal);
  }
  group.add(exterior,cut);cut.visible=false; group.rotation.set(.05,-.23,-.14); return {group,cut,exterior};
}
export function setOpacity(object: THREE.Object3D,value:number) {
  object.visible=value>.002;
  object.traverse(o=>{if(o instanceof THREE.Mesh){const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){m.transparent=value<.999;m.opacity=value;m.depthWrite=value>.85;}}});
}
