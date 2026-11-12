import Globe from 'globe.gl';
import { gsap } from 'gsap';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { rock, pallasite, setOpacity, applyMineralTexture } from './models';
import { hasLocation, isMeteorite, type RecordItem, type Layer } from './types';
import { chapters, heroes } from './story';

const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const smooth=(a:number,b:number,x:number)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
export class SpaceScene {
  globe: InstanceType<typeof Globe>;
  main=rock('chelyabinsk'); companion=pallasite(); hoba=rock('hoba');
  rig=new THREE.Group(); stars: THREE.Points;
  dataPoints: THREE.Points<THREE.BufferGeometry,THREE.ShaderMaterial>;
  plotted: (RecordItem & {lat:number;lng:number})[]=[];
  selected:RecordItem|null=null; mode:'intro'|'story'|'explore'='intro';
  progress=0; dragging=false; lastX=0; lastY=0; downX=0; downY=0; activeModel:THREE.Object3D;
  reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  onSelect:(r:RecordItem)=>void=()=>{};
  onPreview:(r:RecordItem|null)=>void=()=>{};
  private lastPick=0; private previewId='';
  private projected = new THREE.Vector3();
  private viewProjection = new THREE.Matrix4();
  private cameraMove: gsap.core.Tween | null = null;
  private catalogFade: gsap.core.Tween | null = null;
  private sparkStarted = -Infinity;
  private pressedPointer: number | null = null;
  private pointerDragged = false;
  private earthOpacity = 1;
  private resizeObserver:ResizeObserver;
  private animationId=0;
  private marker = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3)),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uRatio: { value: Math.min(devicePixelRatio, 1.7) },
        uOpacity: { value: 1 },
        uSpark: { value: 1 },
        uFireball: { value: false },
        uColor: { value: new THREE.Color('#e3d2ac') },
        uSparkColor: { value: new THREE.Color('#e3d2ac') },
      },
      vertexShader: `
        uniform float uRatio;
        void main() {
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
          gl_PointSize = 48. * uRatio;
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        uniform float uSpark;
        uniform bool uFireball;
        uniform vec3 uColor;
        uniform vec3 uSparkColor;
        void main() {
          vec2 p = (gl_PointCoord - .5) * 48.;
          float r = length(p);
          float shape = uFireball ? (abs(p.x) + abs(p.y)) * .83 : r;
          float core = 1. - smoothstep(3.2, 4.4, shape);
          float ring = 1. - smoothstep(.25, 1.05, abs(shape - 8.5));
          // Six short rays spread from the selected record once.
          float angle = atan(p.y, p.x + .0001);
          float rays = 1. - smoothstep(.035, .095, abs(sin(angle * 3.)));
          float distance = 10. + 10. * (1. - pow(1. - uSpark, 2.));
          float spark = rays * (1. - smoothstep(.6, 3., abs(r - distance))) * (1. - uSpark);
          float alpha = max(max(core, ring * .65), spark);
          gl_FragColor = vec4(mix(uColor, uSparkColor, spark), alpha * uOpacity);
          #include <colorspace_fragment>
        }
      `,
    })
  );
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
      this.setEarthOpacity(this.earthOpacity);
      host.dataset.texture='ready';
    },undefined,()=>{host.dataset.texture='failed';onIssue('Earth texture unavailable. Locations and record lists remain usable.');});
    this.globe.lights([new THREE.AmbientLight(0x9ba9bc,.28),new THREE.DirectionalLight(0xe8edf4,.9)]);
    const camera=(this.globe.camera() as THREE.PerspectiveCamera);this.globe.scene().add(camera);camera.add(this.rig);
    this.rig.add(this.main,this.companion.group,this.hoba);
    const key=new THREE.DirectionalLight(0xcddcf0,1.35);key.position.set(-3,4,2);this.rig.add(key,key.target);
    const fill=new THREE.DirectionalLight(0xd9c0a0,.42);fill.position.set(3,-1,1);this.rig.add(fill,fill.target);
    this.activeModel=this.main;
    Promise.all([
      applyMineralTexture(this.companion.exterior,'assets/iron-albedo.jpg'),
      applyMineralTexture(this.companion.cut,'assets/pallasite-albedo.jpg',true),
      applyMineralTexture(this.hoba,'assets/iron-albedo.jpg')
    ]).then(()=>{host.dataset.materials='ready';}).catch(()=>{host.dataset.materials='failed';onIssue('A mineral texture could not load. Reload to restore the detailed material.');});
    const starGeometry=new THREE.BufferGeometry();const stars=[];let seed=83;
    const rng=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
    for(let i=0;i<1900;i++){const a=rng()*Math.PI*2,z=rng()*2-1,r=1500;stars.push(Math.sqrt(1-z*z)*Math.cos(a)*r,z*r,Math.sqrt(1-z*z)*Math.sin(a)*r);}
    starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));
    this.stars=new THREE.Points(starGeometry,new THREE.PointsMaterial({color:0xa6b0bd,size:.9,sizeAttenuation:false,transparent:true,opacity:.38,depthWrite:false}));
    this.globe.scene().add(this.stars);
    this.dataPoints=new THREE.Points(new THREE.BufferGeometry(),new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,uniforms:{uOpacity:{value:0},uRatio:{value:Math.min(devicePixelRatio,1.7)},uColor:{value:new THREE.Color('#dbd5c6')}},
      vertexShader: `
        attribute float pointSize;
        uniform float uRatio;
        varying float vFacing;
        void main() {
          vec3 point = (modelMatrix * vec4(position, 1.0)).xyz;
          float facing = dot(normalize(position), normalize(cameraPosition - point));
          // The same points project closer together near the edge of the sphere.
          vFacing = smoothstep(-.04, .45, facing);
          gl_Position = projectionMatrix * viewMatrix * vec4(point, 1.0);
          gl_PointSize = pointSize * uRatio * mix(.66, 1.0, vFacing);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vFacing;
        void main() {
          float distanceToCenter = length(gl_PointCoord - .5);
          if (distanceToCenter > .5) discard;
          float alpha = (1.0 - smoothstep(.15, .5, distanceToCenter)) * mix(.18, 1.0, vFacing);
          gl_FragColor = vec4(uColor, alpha * uOpacity);
        }
      `
    }));this.globe.scene().add(this.dataPoints);
    this.marker.visible = false;
    this.marker.frustumCulled = false;
    this.globe.scene().add(this.marker);
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);
    this.host.addEventListener('pointerdown',this.pointerDown);
    this.host.addEventListener('pointermove',this.pointerMove);
    this.host.addEventListener('pointerup',this.pointerUp);
    this.host.addEventListener('pointercancel', this.cancelPointer);
    window.addEventListener('pointerup', this.releaseOutside);
    this.host.addEventListener('pointerleave',()=>{if(this.mode==='explore')this.onPreview(null);});
    renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();onIssue('The 3D context was lost. Reload to restore it; the story and records are still readable.');});
    this.setIntro(0);this.tick();host.dataset.ready='true';
  }
  private resize() {const w=innerWidth,h=innerHeight;this.globe.width(w).height(h);(this.globe.camera() as THREE.PerspectiveCamera).updateProjectionMatrix();this.layout();}
  private layout(){const camera=(this.globe.camera() as THREE.PerspectiveCamera);if (innerWidth < 700) {
      const offset = this.mode === 'explore' ? .2 : this.mode === 'story' ? .24 : .24 * smooth(2.72, 4, this.progress);
      camera.setViewOffset(innerWidth, innerHeight, 0, innerHeight * offset, innerWidth, innerHeight);
    } else camera.clearViewOffset();this.rig.position.set(0,0,-4.7); if(this.mode==='story'){this.rig.position.x=innerWidth<700?0:1.1;this.rig.position.y=innerWidth<700?.78:0;}}
  private pointerDown = (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0) return;
    this.pressedPointer = event.pointerId;
    this.pointerDragged = false;
    this.downX = this.lastX = event.clientX;
    this.downY = this.lastY = event.clientY;
    this.dragging = true;
    if (this.mode !== 'intro') {
      this.cameraMove?.kill();
      if (this.mode === 'explore') this.onPreview(null);
    } else if (event.pointerType === 'mouse') {
      this.host.setPointerCapture(event.pointerId);
    }
  };

  private pick(event: PointerEvent): RecordItem | null {
    const rect = this.globe.renderer().domElement.getBoundingClientRect();
    const camera = this.globe.camera() as THREE.PerspectiveCamera;
    camera.updateMatrixWorld();
    this.viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const { x: cx, y: cy, z: cz } = camera.position;
    const positions = this.dataPoints.geometry.getAttribute('position');
    if (!positions) return null;
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const radius = event.pointerType === 'touch' ? 22 : 10;
    let nearest = radius * radius;
    let record: RecordItem | null = null;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      if (x * (cx - x) + y * (cy - y) + z * (cz - z) <= 0) continue;
      const p = this.projected.set(x, y, z).applyMatrix4(this.viewProjection);
      if (p.z < -1 || p.z > 1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1) continue;
      const dx = (p.x + 1) * rect.width / 2 - pointerX;
      const dy = (1 - p.y) * rect.height / 2 - pointerY;
      const distance = dx * dx + dy * dy;
      if (distance < nearest) {
        nearest = distance;
        record = this.plotted[i] ?? null;
      }
    }
    return record;
  }

  private pointerMove = (event: PointerEvent) => {
    if (this.dragging && event.pointerId === this.pressedPointer) {
      if (Math.hypot(event.clientX - this.downX, event.clientY - this.downY) > 6) this.pointerDragged = true;
      const horizontal = Math.abs(event.clientX - this.downX) > Math.abs(event.clientY - this.downY);
      if (this.mode === 'intro' && this.main.visible && (event.pointerType !== 'touch' || horizontal)) {
        this.main.rotation.y += (event.clientX - this.lastX) * .006;
        this.main.rotation.x += (event.clientY - this.lastY) * .006;
        this.lastX = event.clientX;
        this.lastY = event.clientY;
        this.host.dataset.rotation = this.main.rotation.y.toFixed(3);
      }
      return;
    }
    if (this.mode === 'explore' && event.pointerType === 'mouse' && performance.now() - this.lastPick > 75) {
      this.lastPick = performance.now();
      this.onPreview(this.pick(event));
    }
  };

  private pointerUp = (event: PointerEvent) => {
    if (event.pointerId !== this.pressedPointer) return;
    this.cancelPointer();
    if (this.mode !== 'explore' || this.pointerDragged ||
        Math.hypot(event.clientX - this.downX, event.clientY - this.downY) > 6) return;
    const record = this.pick(event);
    if (!record) return;
    this.onSelect(record);
    this.confirmSelection();
  };

  private cancelPointer = () => {
    this.pressedPointer = null;
    this.dragging = false;
  };

  private releaseOutside = (event: PointerEvent) => {
    if (event.pointerId === this.pressedPointer) this.cancelPointer();
  };

  private controls(explore:boolean) {const c=this.globe.controls();c.enabled=explore||this.mode==='story';c.enableZoom=explore;c.enableRotate=explore||this.mode==='story';c.enablePan=false;c.autoRotate=false;c.minDistance=125;c.maxDistance=700;this.host.dataset.controls=explore?'explore':'story';this.host.style.touchAction=explore?'none':'pan-y';}
  setIntro(progress: number) {
    const p = this.reduced ? (progress < 2.75 ? 0 : 4) : progress;
    this.mode = 'intro';
    this.progress = p;
    this.cameraMove?.kill();
    this.catalogFade?.kill();
    this.controls(false);
    this.layout();
    this.globe.controls().enableRotate = false;
    const approach = smooth(.65, 2.72, p);
    const earth = smooth(2.72, 4, p);
    const mobile = innerWidth < 700;
    this.main.position.set(0, 0, 0);
    this.main.scale.setScalar((mobile ? .73 : 1) * THREE.MathUtils.lerp(1, .022, approach));
    setOpacity(this.main, 1 - smooth(2.55, 2.72, p));
    setOpacity(this.companion.group, 0);
    setOpacity(this.hoba, 0);
    // A camera aimed at the catalog coordinates projects the pin to the fragment's center.
    const reveal = smooth(2.72, 3.12, p);
    this.globe.showGlobe(reveal > 0).showAtmosphere(reveal >= .95);
    this.setEarthOpacity(reveal);
    this.globe.pointOfView({
      lat: heroes.chelyabinsk.lat,
      lng: heroes.chelyabinsk.lng,
      altitude: THREE.MathUtils.lerp(12, mobile ? 5.1 : chapters[0].altitude, earth),
    }, 0);
    this.dataPoints.material.uniforms.uOpacity.value = 0;
    this.highlight(p >= 2.63 ? heroes.chelyabinsk : null, false);
    this.marker.material.uniforms.uOpacity.value = smooth(2.63, 2.78, p);
    this.activeModel = this.main;
    this.host.dataset.intro = p.toFixed(3);
    this.host.dataset.phase = p < 2.63 ? 'fragment' : p < 2.72 ? 'handoff' : 'earth';
    this.host.dataset.preview = '';
  }

  private setEarthOpacity(opacity: number) {
    this.earthOpacity = opacity;
    const material = this.globe.globeMaterial();
    const transparent = opacity < 1;
    if (material.transparent !== transparent) {
      material.transparent = transparent;
      material.needsUpdate = true;
    }
    material.opacity = opacity;
    material.depthWrite = !transparent;
  }

  setChapter(index: number, immediate = false) {
    const previousMode = this.mode;
    this.mode = 'story';
    this.previewId = '__reset';
    this.preview(null);
    this.controls(false);
    this.layout();
    this.globe.showGlobe(true).showAtmosphere(true);
    this.setEarthOpacity(1);
    this.catalogFade?.kill();
    const opacity = this.dataPoints.material.uniforms.uOpacity;
    if (index === 0 || this.reduced || immediate) opacity.value = index === 0 ? 0 : .72;
    else this.catalogFade = gsap.to(opacity, { value: .72, duration: .5, ease: 'power2.out' });
    const chapter = chapters[index] ?? chapters[3];
    const hero = chapter.hero ? heroes[chapter.hero] : null;
    const { lat, lng } = hero ?? { lat: 22, lng: 30 };
    this.moveCamera({ lat, lng, altitude: innerWidth < 700 ? 5.1 : chapter.altitude },
      !immediate && previousMode !== 'intro');
    this.highlight(hero, false);
    this.host.dataset.chapter = String(index);
  }

  private moveCamera(target: { lat: number; lng: number; altitude: number }, animate: boolean) {
    this.cameraMove?.kill();
    if (this.reduced || !animate) {
      this.globe.pointOfView(target, 0);
      return;
    }
    const start = this.globe.pointOfView();
    const longitude = start.lng ?? target.lng;
    const delta = ((target.lng - longitude + 540) % 360) - 180;
    const progress = { value: 0 };
    this.cameraMove = gsap.to(progress, {
      value: 1, duration: .52, ease: 'power2.inOut',
      onUpdate: () => {
        const t = progress.value;
        this.globe.pointOfView({
          lat: THREE.MathUtils.lerp(start.lat ?? target.lat, target.lat, t),
          lng: longitude + delta * t,
          altitude: THREE.MathUtils.lerp(start.altitude ?? target.altitude, target.altitude, t),
        }, 0);
      },
    });
  }
  preview(record:RecordItem|null){if(this.mode==='intro')return;const id=record?.id??'';if(this.previewId===id)return;this.previewId=id;[this.main,this.companion.group,this.hoba].forEach(x=>setOpacity(x,0));this.host.dataset.preview='';
    const object=id===heroes.chelyabinsk.id?this.main:id===heroes.fukang.id?this.companion.group:id===heroes.hoba.id?this.hoba:null;
    if(!object)return;
    this.host.dataset.preview=id;const cam=(this.globe.camera() as THREE.PerspectiveCamera);const distance=4.7;const halfHeight=Math.tan(THREE.MathUtils.degToRad(cam.fov)/2)*distance;
    const mobile=innerWidth<700;const px=mobile?innerWidth*.77:innerWidth-158,py=mobile?innerHeight*(this.mode==='explore'?.42:.22):205;
    this.rig.position.set((px/innerWidth*2-1)*halfHeight*cam.aspect,(1-py/innerHeight*2)*halfHeight,-distance);
    object.position.set(0,0,0);object.scale.setScalar(mobile?.26:.35);setOpacity(object,1);
    if(id===heroes.fukang.id)this.setCut(true);
  }
  setCut(cut:boolean){this.host.dataset.cut=String(cut);this.companion.cut.visible=cut;this.companion.exterior.visible=!cut;}
  explore(){this.mode='explore';this.cameraMove?.kill();this.catalogFade?.kill();this.previewId='__reset';this.preview(null);this.controls(true);this.layout();[this.main,this.companion.group,this.hoba].forEach(x=>setOpacity(x,0));this.globe.showGlobe(true).showAtmosphere(true);this.setEarthOpacity(1);this.dataPoints.material.uniforms.uOpacity.value=.82;this.globe.pointOfView({lat:20,lng:20,altitude:innerWidth<700?4.2:2.3},0);}
  setRecords(records:RecordItem[],layer:Layer){this.plotted=records.filter(hasLocation);const positions=[],sizes=[];
    for(const r of this.plotted){const c=this.globe.getCoords(r.lat,r.lng,.006);positions.push(c.x,c.y,c.z);const value=isMeteorite(r)?r.massG:r.energyKt;sizes.push(value===null?1.4:1.5+Math.min(4,Math.log10(1+value)*.48));}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('pointSize',new THREE.Float32BufferAttribute(sizes,1));this.dataPoints.geometry.dispose();this.dataPoints.geometry=g;
    this.dataPoints.material.uniforms.uColor.value.set(layer==='meteorites'?'#dbd5c6':'#b7c9d5');this.host.dataset.plotted=String(this.plotted.length);
  }
  highlight(record: { lat: number | null; lng: number | null } | null, fly = true, fireball = false) {
    this.sparkStarted = -Infinity;
    this.marker.material.uniforms.uSpark.value = 1;
    this.marker.material.uniforms.uOpacity.value = 1;
    this.marker.material.uniforms.uFireball.value = fireball;
    this.marker.material.uniforms.uColor.value.set(fireball ? '#d0e0ea' : '#e3d2ac');
    this.marker.visible = record !== null && record.lat !== null && record.lng !== null;
    if (!record || record.lat === null || record.lng === null) return;
    const { lat, lng } = record;
    const { x, y, z } = this.globe.getCoords(lat, lng, .009);
    this.marker.position.set(x, y, z);
    if (fly) this.moveCamera({ lat, lng, altitude: innerWidth < 700 ? 4.1 : 1.9 }, true);
  }

  confirmSelection() {
    if (!this.reduced && this.marker.visible) this.sparkStarted = performance.now();
  }
  zoom(factor:number){
    const p = this.globe.pointOfView();
    this.moveCamera({ lat: p.lat ?? 0, lng: p.lng ?? 0,
      altitude: THREE.MathUtils.clamp((p.altitude ?? 2) * factor, .25, 6) }, true);
  }
  private tick = () => {
    if (!this.reduced && !this.dragging && this.mode === 'intro' && this.progress < .65) {
      this.main.rotation.y += .0012;
    }
    if (this.marker.visible) {
      this.marker.material.uniforms.uSpark.value = clamp((performance.now() - this.sparkStarted) / 260);
    }
    this.animationId = requestAnimationFrame(this.tick);
  };

  destroy() {
    cancelAnimationFrame(this.animationId);
    this.cameraMove?.kill();
    this.catalogFade?.kill();
    window.removeEventListener('pointerup', this.releaseOutside);
    this.resizeObserver.disconnect();
    this.marker.geometry.dispose();
    this.marker.material.dispose();
    this.globe.pauseAnimation();
    this.globe.renderer().dispose();
  }
}
