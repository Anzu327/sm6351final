import Globe from 'globe.gl';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { rock, pallasite, setOpacity } from './models';
import { hasLocation, isMeteorite, type RecordItem, type Layer } from './types';
import { heroes } from './story';

const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const smooth=(a:number,b:number,x:number)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
export class SpaceScene {
  globe: InstanceType<typeof Globe>;
  main=rock('iron'); companion=pallasite(); beauty=rock('basalt');
  rig=new THREE.Group(); stars: THREE.Points;
  dataPoints: THREE.Points<THREE.BufferGeometry,THREE.ShaderMaterial>;
  plotted: (RecordItem & {lat:number;lng:number})[]=[];
  selected:RecordItem|null=null; mode:'intro'|'story'|'explore'='intro';
  progress=0; dragging=false; lastX=0; lastY=0; downX=0; downY=0; activeModel:THREE.Object3D;
  reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  onSelect:(r:RecordItem)=>void=()=>{};
  onPreview:(r:RecordItem|null)=>void=()=>{};
  private lastPick=0; private previewId='';
  private ray=new THREE.Raycaster(); private mouse=new THREE.Vector2();
  private resizeObserver:ResizeObserver;
  private animationId=0;
  private frame=0;
  constructor(private host:HTMLElement,private onIssue:(s:string)=>void) {
    this.globe=new Globe(host,{animateIn:false}).backgroundColor('#030509')
      .showAtmosphere(true).atmosphereColor('#6c8295').atmosphereAltitude(.105)
      .showGraticules(false).pointsData([]).enablePointerInteraction(false);
    const renderer=this.globe.renderer();renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.86;
    const environment=new THREE.PMREMGenerator(renderer);this.globe.scene().environment=environment.fromScene(new RoomEnvironment(),.04).texture;environment.dispose();
    this.globe.globeMaterial(new THREE.MeshPhongMaterial({color:0x758a9c,shininess:3,specular:0x151b24}));
    new THREE.TextureLoader().load(import.meta.env.BASE_URL+'assets/earth.jpg',texture=>{
      texture.colorSpace=THREE.SRGBColorSpace;
      const earthMaterial=new THREE.MeshPhongMaterial({map:texture,color:0x98a6b4,shininess:2,specular:0x080c13});
      earthMaterial.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat earthGray=dot(diffuseColor.rgb,vec3(0.2126,0.7152,0.0722));\ndiffuseColor.rgb=mix(vec3(earthGray),diffuseColor.rgb,0.10)*vec3(0.37,0.49,0.65);');};
      this.globe.globeMaterial(earthMaterial);
      host.dataset.texture='ready';
    },undefined,()=>{host.dataset.texture='failed';onIssue('Earth texture unavailable. Locations and record lists remain usable.');});
    this.globe.lights([new THREE.AmbientLight(0x9ba9bc,.28),new THREE.DirectionalLight(0xe8edf4,.9)]);
    const camera=(this.globe.camera() as THREE.PerspectiveCamera);this.globe.scene().add(camera);camera.add(this.rig);
    this.rig.add(this.main,this.companion.group,this.beauty);
    const key=new THREE.DirectionalLight(0xcddcf0,1.35);key.position.set(-3,4,2);this.rig.add(key,key.target);
    const fill=new THREE.DirectionalLight(0xd9c0a0,.42);fill.position.set(3,-1,1);this.rig.add(fill,fill.target);
    this.activeModel=this.main;
    const starGeometry=new THREE.BufferGeometry();const stars=[];let seed=83;
    const rng=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
    for(let i=0;i<1900;i++){const a=rng()*Math.PI*2,z=rng()*2-1,r=1500;stars.push(Math.sqrt(1-z*z)*Math.cos(a)*r,z*r,Math.sqrt(1-z*z)*Math.sin(a)*r);}
    starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));
    this.stars=new THREE.Points(starGeometry,new THREE.PointsMaterial({color:0xa6b0bd,size:.9,sizeAttenuation:false,transparent:true,opacity:.38,depthWrite:false}));
    this.globe.scene().add(this.stars);
    this.dataPoints=new THREE.Points(new THREE.BufferGeometry(),new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,uniforms:{uOpacity:{value:0},uRatio:{value:Math.min(devicePixelRatio,1.7)},uColor:{value:new THREE.Color('#dbd5c6')}},
      vertexShader:'attribute float pointSize; uniform float uRatio; void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_PointSize=pointSize*uRatio;}',
      fragmentShader:'uniform vec3 uColor;uniform float uOpacity;void main(){float d=length(gl_PointCoord-0.5);if(d>0.5)discard;gl_FragColor=vec4(uColor,(1.0-smoothstep(0.15,0.5,d))*uOpacity);}'
    }));this.globe.scene().add(this.dataPoints);
    this.globe.ringColor(()=>()=> '#d3c3a0').ringMaxRadius(.65).ringPropagationSpeed(.4).ringRepeatPeriod(1500);
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);
    this.host.addEventListener('pointerdown',this.pointerDown);
    this.host.addEventListener('pointermove',this.pointerMove);
    this.host.addEventListener('pointerup',this.pointerUp);
    this.host.addEventListener('pointercancel',()=>{this.dragging=false;});
    this.host.addEventListener('pointerleave',()=>{if(this.mode!=='intro')this.onPreview(null);});
    renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();onIssue('The 3D context was lost. Reload to restore it; the story and records are still readable.');});
    this.setIntro(0);this.tick();host.dataset.ready='true';
  }
  private resize() {const w=innerWidth,h=innerHeight;this.globe.width(w).height(h);(this.globe.camera() as THREE.PerspectiveCamera).updateProjectionMatrix();this.layout();}
  private layout(){const camera=(this.globe.camera() as THREE.PerspectiveCamera);if(this.mode==='explore'&&innerWidth<700)camera.setViewOffset(innerWidth,innerHeight,0,innerHeight*.2,innerWidth,innerHeight);else camera.clearViewOffset();this.rig.position.set(0,0,-4.7); if(this.mode==='story'){this.rig.position.x=innerWidth<700?0:1.1;this.rig.position.y=innerWidth<700?.78:0;}}
  private pointerDown=(e:PointerEvent)=>{this.downX=this.lastX=e.clientX;this.downY=this.lastY=e.clientY;if(this.mode!=='intro')return;this.dragging=true;this.host.setPointerCapture(e.pointerId);};
  private pick(e:PointerEvent):RecordItem|null {this.mouse.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);this.ray.setFromCamera(this.mouse,(this.globe.camera() as THREE.PerspectiveCamera));this.ray.params.Points={threshold:1.5};const camera=(this.globe.camera() as THREE.PerspectiveCamera).position;const hit=this.ray.intersectObject(this.dataPoints).find(h=>h.point.dot(camera.clone().sub(h.point))>0);return hit?.index===undefined?null:this.plotted[hit.index]??null;}
  private pointerMove=(e:PointerEvent)=>{if(this.mode!=='intro'){if(performance.now()-this.lastPick>100){this.lastPick=performance.now();this.onPreview(this.pick(e));}return;}if(!this.dragging)return;this.activeModel.rotation.y+=(e.clientX-this.lastX)*.006;this.activeModel.rotation.x+=(e.clientY-this.lastY)*.006;this.lastX=e.clientX;this.lastY=e.clientY;this.host.dataset.rotation=this.activeModel.rotation.y.toFixed(3);};
  private pointerUp=(e:PointerEvent)=>{this.dragging=false;if(this.mode!=='explore'||Math.hypot(e.clientX-this.downX,e.clientY-this.downY)>6)return;
    this.mouse.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);this.ray.setFromCamera(this.mouse,(this.globe.camera() as THREE.PerspectiveCamera));this.ray.params.Points={threshold:1.8};
    const camera=(this.globe.camera() as THREE.PerspectiveCamera).position;
    const hit=this.ray.intersectObject(this.dataPoints).find(h=>{const v=h.point;return v.dot(camera.clone().sub(v))>0;});
    if(hit?.index!==undefined){const r=this.plotted[hit.index];if(r)this.onSelect(r);}
  };
  private controls(explore:boolean) {const c=this.globe.controls();c.enabled=explore||this.mode==='story';c.enableZoom=explore;c.enableRotate=explore||this.mode==='story';c.enablePan=false;c.autoRotate=false;c.minDistance=125;c.maxDistance=700;this.host.dataset.controls=explore?'explore':'story';this.host.style.touchAction=explore?'none':'pan-y';}
  setIntro(p:number){this.mode='intro';this.progress=p;this.controls(false);this.layout();
    const join=smooth(.35,1.45,p),leave=smooth(1.8,2.8,p),handoff=smooth(2.3,2.95,p),earth=smooth(2.95,3.8,p);
    const mobile=innerWidth<700;const unit=mobile?.73:1;
    this.main.scale.setScalar(unit*THREE.MathUtils.lerp(1.0,.002,handoff));this.main.position.set(0,0,0);setOpacity(this.main,1-smooth(2.8,2.95,p));
    const side=mobile?1.08:1.65;
    this.companion.group.position.set(-side*join-(mobile?3:6)*leave,.22*join,-3*(1-join));
    this.beauty.position.set(side*join+(mobile?3:6)*leave,-.05*join,-3*(1-join));
    const sideScale=unit*(.2+.48*join);this.companion.group.scale.setScalar(sideScale);this.beauty.scale.setScalar(sideScale*.83);
    setOpacity(this.companion.group,join*(1-smooth(2.55,2.9,p)));setOpacity(this.beauty,join*(1-smooth(2.55,2.9,p)));
    this.companion.cut.visible=join>.01;this.companion.exterior.visible=false;
    this.globe.showGlobe(earth>.002).showAtmosphere(earth>.01);
    this.globe.pointOfView({lat:heroes.sikhote.lat,lng:heroes.sikhote.lng,altitude:THREE.MathUtils.lerp(12,innerWidth<700?4.1:1.95,earth)},0);
    this.dataPoints.material.uniforms.uOpacity.value=earth*.76;
    this.highlight(earth>.3?heroes.sikhote:null,false);
    this.activeModel=this.main;this.host.dataset.phase=String(Math.min(3,Math.floor(p)));this.host.dataset.intro=p.toFixed(3);
  }
  setChapter(index:number){this.mode='story';this.previewId='__reset';this.preview(null);this.controls(false);this.layout();this.globe.showGlobe(true).showAtmosphere(true);this.dataPoints.material.uniforms.uOpacity.value=.72;
    const views=[{lat:46.16,lng:134.65333,altitude:1.95},{lat:44.43333,lng:87.63333,altitude:1.95},{lat:24,lng:0,altitude:2.1},{lat:22,lng:30,altitude:2.1}];
    const view=views[index]??views[3];this.globe.pointOfView({...view,altitude:innerWidth<700?4.1:view.altitude},0);this.highlight(index===0?heroes.sikhote:index===1?heroes.fukang:null,false);this.host.dataset.chapter=String(index);
  }
  preview(record:RecordItem|null){if(this.mode==='intro')return;const id=record?.id??'';if(this.previewId===id)return;this.previewId=id;[this.main,this.companion.group,this.beauty].forEach(x=>setOpacity(x,0));this.host.dataset.preview='';
    const object=id===heroes.sikhote.id?this.main:id===heroes.fukang.id?this.companion.group:id===heroes.beauty.id?this.beauty:null;
    if(!object)return;
    this.host.dataset.preview=id;const cam=(this.globe.camera() as THREE.PerspectiveCamera);const distance=4.7;const halfHeight=Math.tan(THREE.MathUtils.degToRad(cam.fov)/2)*distance;
    const mobile=innerWidth<700;const px=mobile?innerWidth*.77:innerWidth-158,py=mobile?innerHeight*(this.mode==='explore'?.42:.22):205;
    this.rig.position.set((px/innerWidth*2-1)*halfHeight*cam.aspect,(1-py/innerHeight*2)*halfHeight,-distance);
    object.position.set(0,0,0);object.scale.setScalar(mobile?.26:.35);setOpacity(object,1);
    if(id===heroes.fukang.id)this.setCut(true);
  }
  setCut(cut:boolean){this.companion.cut.visible=cut;this.companion.exterior.visible=!cut;}
  explore(){this.mode='explore';this.previewId='';this.preview(null);this.controls(true);this.layout();[this.main,this.companion.group,this.beauty].forEach(x=>setOpacity(x,0));this.globe.showGlobe(true).showAtmosphere(true);this.dataPoints.material.uniforms.uOpacity.value=.82;this.globe.pointOfView({lat:20,lng:20,altitude:innerWidth<700?4.2:2.3},0);}
  setRecords(records:RecordItem[],layer:Layer){this.plotted=records.filter(hasLocation);const positions=[],sizes=[];
    for(const r of this.plotted){const c=this.globe.getCoords(r.lat,r.lng,.006);positions.push(c.x,c.y,c.z);const value=isMeteorite(r)?r.massG:r.energyKt;sizes.push(value===null?1.4:1.5+Math.min(4,Math.log10(1+value)*.48));}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('pointSize',new THREE.Float32BufferAttribute(sizes,1));this.dataPoints.geometry.dispose();this.dataPoints.geometry=g;
    this.dataPoints.material.uniforms.uColor.value.set(layer==='meteorites'?'#dbd5c6':'#b7c9d5');this.host.dataset.plotted=String(this.plotted.length);
  }
  highlight(r:{lat:number|null;lng:number|null}|null,fly=true){this.globe.ringsData(r&&r.lat!==null&&r.lng!==null?[r]:[]);if(r&&r.lat!==null&&r.lng!==null&&fly)this.globe.pointOfView({lat:r.lat,lng:r.lng,altitude:innerWidth<700?4.1:1.9},this.reduced?0:700);}
  zoom(factor:number){const p=this.globe.pointOfView();this.globe.pointOfView({altitude:THREE.MathUtils.clamp((p.altitude??2)*factor,.25,6)},this.reduced?0:180);}
  private tick=()=>{this.frame++;if(!this.reduced&&!this.dragging&&this.mode==='intro'&&this.progress<.1)this.main.rotation.y+=.0012;
    this.animationId=requestAnimationFrame(this.tick);};
  destroy(){cancelAnimationFrame(this.animationId);this.resizeObserver.disconnect();this.globe.pauseAnimation();this.globe.renderer().dispose();}
}
