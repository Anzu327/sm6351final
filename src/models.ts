import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
function random(seed: number) { return () => { seed|=0; seed=seed+0x6d2b79f5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
export function rock(kind: 'iron'|'basalt'): THREE.Group {
  const rng=random(kind==='iron'?1947:7034);
  const geometry=new THREE.IcosahedronGeometry(1,48);
  const p=geometry.attributes.position;
  const radial=(n:THREE.Vector3)=>1+.095*Math.sin(n.x*5+n.y*3)+.07*Math.cos(n.z*7-n.y*4);
  const craters=Array.from({length:kind==='iron'?64:11},()=>{const direction=new THREE.Vector3(rng()*2-1,rng()*2-1,rng()*2-1).normalize();const pitRadius=.12+rng()*.18,depth=kind==='iron'?.045+rng()*.12:.018+rng()*.025;return {center:direction.multiplyScalar(radial(direction)+pitRadius-depth),radius:pitRadius};});
  const colors=[]; const v=new THREE.Vector3();
  for(let i=0;i<p.count;i++){
    v.fromBufferAttribute(p,i).normalize(); let radius=radial(v);
    for(const c of craters){const dot=v.dot(c.center),discriminant=dot*dot-c.center.lengthSq()+c.radius*c.radius;if(discriminant>0){const near=dot-Math.sqrt(discriminant),far=dot+Math.sqrt(discriminant);if(radius<far&&radius>near)radius=near;}}
    const rough=Math.sin(v.x*49+Math.sin(v.z*27))*Math.sin(v.y*51+v.z*11);
    radius+=rough*.004;
    const x=v.x,y=v.y,z=v.z;
    p.setXYZ(i,x*radius*1.02,y*radius*1.16,z*radius*.87);
    const shade=kind==='iron'?.24+rough*.055:.075+rough*.023;
    colors.push(shade*(kind==='iron'?1.06:1),shade,shade*.94);
  }
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.deleteAttribute('normal');geometry.deleteAttribute('uv');
  const smooth=mergeVertices(geometry,1e-5);smooth.computeVertexNormals();
  const vertex=smooth.attributes.position,uvs=[];
  for(let i=0;i<vertex.count;i++){const x=vertex.getX(i),y=vertex.getY(i),z=vertex.getZ(i),len=Math.hypot(x,y,z);uvs.push(.5+Math.atan2(z,x)/(2*Math.PI),.5+Math.asin(y/len)/Math.PI);}
  smooth.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  const size=512,pixels=new Uint8Array(size*size*4),bumps=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const hash=Math.sin(x*127.1+y*311.7)*43758.5453;const n=hash-Math.floor(hash);
    const broad=(Math.sin(x*.071+Math.sin(y*.043)*3)+Math.cos(y*.051-x*.019))*.5;
    const grain=Math.floor(95+n*62+broad*20);const i=(y*size+x)*4;
    pixels[i]=grain;pixels[i+1]=grain*.94;pixels[i+2]=grain*.85;pixels[i+3]=255;
    const h=Math.floor(100+n*55+broad*18);bumps[i]=bumps[i+1]=bumps[i+2]=h;bumps[i+3]=255;
  }
  const texture=new THREE.DataTexture(pixels,size,size);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
  const bump=new THREE.DataTexture(bumps,size,size);bump.wrapS=bump.wrapT=THREE.RepeatWrapping;bump.magFilter=THREE.LinearFilter;bump.minFilter=THREE.LinearMipmapLinearFilter;bump.generateMipmaps=true;bump.needsUpdate=true;
  const material=new THREE.MeshStandardMaterial({color:kind==='iron'?0xaaa49a:0x393a39,map:texture,bumpMap:bump,bumpScale:kind==='iron'?.065:.04,metalness:kind==='iron'?.88:.12,roughness:kind==='iron'?.56:.91,envMapIntensity:kind==='iron'?.32:.2});
  const group=new THREE.Group(); group.add(new THREE.Mesh(smooth,material));
  group.rotation.set(.12,-.5,.18); return group;
}
export function pallasite(): {group:THREE.Group;cut:THREE.Group;exterior:THREE.Group} {
  const group=new THREE.Group(),cut=new THREE.Group(),exterior=rock('iron');
  exterior.scale.set(1.1,.87,.28);
  const shape=new THREE.Shape();const points=[[-1.05,-.6],[-.89,.23],[-.47,.93],[.12,.82],[.82,.31],[1.05,-.52],[.48,-.89],[-.42,-.84]];
  points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
  const size=512,rng=random(2000),centers=Array.from({length:78},()=>({x:rng(),y:rng(),tone:rng(),metal:rng()<.14}));
  const color=new Uint8Array(size*size*4),metal=new Uint8Array(size*size*4),relief=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size+.006*Math.sin(y*.11),v=y/size+.006*Math.cos(x*.09);let first=100,second=100,idx=0;
    for(let k=0;k<centers.length;k++){const d=(u-centers[k].x)**2+(v-centers[k].y)**2;if(d<first){second=first;first=d;idx=k;}else if(d<second)second=d;}
    const c=centers[idx],edge=Math.sqrt(second)-Math.sqrt(first),isMetal=edge<.008||c.metal;
    const noise=(Math.sin(x*71.3+y*32.8)*12345.6)%1;
    const i=(y*size+x)*4;
    if(isMetal){const tone=112+c.tone*37+noise*10;color[i]=tone;color[i+1]=tone;color[i+2]=tone*.97;metal[i]=metal[i+1]=metal[i+2]=245;}
    else{const facet=1+.2*Math.sin((x+y*.6)*.17+c.tone*5),tone=(.65+c.tone*.65)*facet;color[i]=(88+noise*10)*tone;color[i+1]=(76+noise*9)*tone;color[i+2]=(40+noise*8)*tone;metal[i]=metal[i+1]=metal[i+2]=24;}
    color[i+3]=metal[i+3]=255;relief[i]=relief[i+1]=relief[i+2]=128+noise*18;relief[i+3]=255;
  }
  function tex(bytes:Uint8Array,srgb=false){const t=new THREE.DataTexture(bytes,size,size);t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.offset.set(.5,.5);t.repeat.set(.5,.5);t.needsUpdate=true;return t;}
  const cutMaterial=new THREE.MeshPhysicalMaterial({color:0xd1c9b5,map:tex(color,true),metalness:1,metalnessMap:tex(metal),roughness:.35,envMapIntensity:.32,clearcoat:.3,bumpMap:tex(relief),bumpScale:.015});
  const sideMaterial=new THREE.MeshStandardMaterial({color:0x292b2a,metalness:.75,roughness:.8,envMapIntensity:.25});
  const base=new THREE.ExtrudeGeometry(shape,{depth:.17,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.035,bevelThickness:.025});
  cut.add(new THREE.Mesh(base,[cutMaterial,sideMaterial]));
  group.add(exterior,cut);cut.visible=false; group.rotation.set(.05,-.23,-.14); return {group,cut,exterior};
}
export function setOpacity(object: THREE.Object3D,value:number) {
  object.visible=value>.002;
  object.traverse(o=>{if(o instanceof THREE.Mesh){const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){m.transparent=value<.999;m.opacity=value;m.depthWrite=value>.85;}}});
}

/** Load the project-authored mineral albedo. This improves visual realism; it is not a specimen scan. */
export async function applyMineralTexture(group:THREE.Group,path:string,cut=false){
  const texture=await new THREE.TextureLoader().loadAsync(import.meta.env.BASE_URL+path);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;
  if(cut){texture.offset.set(.5,.5);texture.repeat.set(.5,.5);}
  group.traverse(o=>{if(o instanceof THREE.Mesh){const mats=Array.isArray(o.material)?o.material:[o.material];const material=mats[0] as THREE.MeshStandardMaterial;
    material.color.set(0xffffff);material.map=texture;material.bumpMap=texture;material.bumpScale=cut?.018:.025;material.vertexColors=false;material.metalness=cut?.48:path.includes('breccia')?.08:.9;material.roughness=cut?.33:path.includes('breccia')?.88:.48;material.envMapIntensity=cut?.5:.55;if(cut)material.metalnessMap=null;material.needsUpdate=true;
  }});
}
