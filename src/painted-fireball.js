// Fireball geometry and materials from the local Chelyabinsk reconstruction.
import {
  Group as a0, BufferGeometry as i0, Float32BufferAttribute as z1,
  ShaderMaterial as D0, DoubleSide as E0, Color as R1, Mesh as b1,
  PlaneGeometry as Z6, Shape as h2, ShapeGeometry as t5,
  MeshBasicMaterial as S0, Line as c6, Vector3 as S, LineBasicMaterial as f6,
  LineSegments as R2, BufferAttribute as m0, Points as tn, PointsMaterial as Sn,
} from 'three';

const E6 = seed => {
  const value = Math.sin(seed*127.1+19.7)*43758.54;
  return value-Math.floor(value);
};
const fn = (start,end,value) => {
  const t = Math.max(0,Math.min(1,(value-start)/(end-start)));
  return t*t*(3-2*t);
};

function es(u){return{split:fn(.34,.68,u),intact:1-fn(.34,.405,u),fragments:fn(.34,.405,u),flash:Math.sin(Math.PI*fn(.34,.46,u))**2,cracks:fn(.27,.34,u)*(1-fn(.36,.41,u)),commonTrail:1-.97*fn(.36,.57,u)}}export function createPaintedFireball(){let u=new a0;u.name="painted-fireball";let n=[["#e59580",.3,.42,8.1],["#f2b381",.18,.72,7.8],["#ffdfab",.073,.95,7.2],["#fff3cc",.018,.98,6.3]],l=[];n.forEach(([D,R,p,j],k)=>{let Q=[],E=[];function M($,V){let G=$/100,X=Math.pow(1-G,1.2),P=Math.sin(G*61+k)*.014+Math.sin(G*127+k)*.005;return[G*j,G*j*.275+V*(R*X+P*X),k*.012]}for(let $=0;$<100;$++){let V=M($,-1),G=M($,1),X=M($+1,1),P=M($+1,-1);for(let[y,_,e1]of[[V,$/100,0],[G,$/100,1],[X,($+1)/100,1],[V,$/100,0],[X,($+1)/100,1],[P,($+1)/100,0]])Q.push(...y),E.push(_,e1)}let I=new i0;I.setAttribute("position",new z1(Q,3)),I.setAttribute("uv",new z1(E,2));let Y=new D0({transparent:!0,depthWrite:!1,side:E0,uniforms:{color:{value:new R1(D)},opacity:{value:p},breakup:{value:0}},vertexShader:"varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",fragmentShader:`varying vec2 vUv;uniform vec3 color;uniform float opacity,breakup;void main(){float grain=fract(sin(dot(floor(vUv*vec2(1400.,80.)),vec2(17.1,29.7)))*43758.54);float edge=smoothstep(0.,.13,vUv.y)*(1.-smoothstep(.87,1.,vUv.y));float fade=pow(1.-vUv.x,.55)*mix(1.,smoothstep(0.,.12,vUv.x),breakup);gl_FragColor=vec4(color+(grain-.5)*.06,opacity*edge*fade*(.8+grain*.2));
#include <colorspace_fragment>
}`}),w=new b1(I,Y);w.renderOrder=k,u.add(w),l.push({material:Y,opacity:p})});let e=new b1(new Z6(.9,.9),new D0({transparent:!0,depthWrite:!1,uniforms:{color:{value:new R1("#ffe1a4")},strength:{value:1}},vertexShader:"varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",fragmentShader:`varying vec2 vUv;uniform vec3 color;uniform float strength;void main(){float d=length((vUv-.5)*vec2(.7,1.));float a=exp(-d*d*30.)*.38*(1.-smoothstep(.3,.5,d));gl_FragColor=vec4(color,a*strength);
#include <colorspace_fragment>
}`}));e.position.set(-.02,0,.065),e.renderOrder=4,u.add(e);let a=new h2;a.moveTo(-.22,-.025),a.bezierCurveTo(-.17,-.16,.12,-.16,.21,.025),a.bezierCurveTo(.1,.15,-.1,.14,-.22,-.025);let o=new b1(new t5(a),new S0({color:"#fff1c7",side:E0,transparent:!0,depthWrite:!1}));o.rotation.z=.275,o.position.z=.08,o.renderOrder=5,u.add(o);let t=new a0;for(let D of[[[-.13,.09],[.01,.015],[-.02,-.11]],[[.01,.015],[.14,.08]],[[.01,.015],[.14,-.07]]]){let R=new c6(new i0().setFromPoints(D.map(([p,j])=>new S(p,j,.095))),new f6({color:"#946c76",transparent:!0,opacity:0,depthWrite:!1}));R.renderOrder=8,t.add(R)}u.add(t);for(let D=0;D<8;D++){let R=[];for(let j=0;j<=100;j++){let k=j/100;R.push(new S(k*8,k*2.2+(D-3.5)*.045*Math.pow(1-k,.7)+Math.sin(k*43+D)*.009,.02))}let p=new c6(new i0().setFromPoints(R),new f6({color:D%2?"#ffe2ae":"#dc957e",transparent:!0,opacity:.45,depthWrite:!1}));u.add(p),l.push({material:p.material,opacity:.45})}let i=new a0;i.name="fireball-fragments",u.add(i);let d=[];function r(D,R,p,j,k){let Q=[],E=[];function M($,V){let G=$/40;return[G*D,V*(R*Math.pow(1-G,1.3)+(Math.sin(G*32+k)*.011+Math.sin(G*83+k)*.004)*(1-G)),0]}for(let $=0;$<40;$++){let V=M($,-1),G=M($,1),X=M($+1,1),P=M($+1,-1);for(let[y,_,e1]of[[V,$/40,0],[G,$/40,1],[X,($+1)/40,1],[V,$/40,0],[X,($+1)/40,1],[P,($+1)/40,0]])Q.push(...y),E.push(_,e1)}let I=new i0;I.setAttribute("position",new z1(Q,3)),I.setAttribute("uv",new z1(E,2));let Y=new D0({transparent:!0,depthWrite:!1,side:E0,uniforms:{color:{value:new R1(p)},opacity:{value:0}},vertexShader:"varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",fragmentShader:`varying vec2 vUv;uniform vec3 color;uniform float opacity;void main(){float n=fract(sin(dot(floor(vUv*vec2(600.,40.)),vec2(17.,31.)))*43758.54);float edge = pow(max(0.,1.-abs(vUv.y-.5)*2.),1.7);
float streak = sin(vUv.x*113.+vUv.y*29.)*.5+.5;
float brush = (.63+.37*n)*(.71+.29*streak);
gl_FragColor=vec4(color+(n-.5)*.028,opacity*pow(1.-vUv.x,.92)*edge*brush);
#include <colorspace_fragment>
}`}),w=new b1(I,Y);return w.renderOrder=6,{mesh:w,material:Y,opacity:j}}for(let D=0;D<30;D++){let R=new a0,p=.275+(E6(D+54)-.5)*.14,j=.9+E6(D+81)*3.9,k=2.5+E6(D+18)*4.5,Q=r(k,.037,"#e85332",.73,D),E=r(k*.9,.011,"#ffbc52",.98,D+7);E.mesh.position.z=.01,R.add(Q.mesh,E.mesh);let M=new h2;[[-.15,-.025],[-.06,.1],[.08,.075],[.13,-.025],[.01,-.1]].forEach(([V,G],X)=>{let P=.8+E6(D*9+X)*.4;X?M.lineTo(V*P,G*P):M.moveTo(V*P,G*P)}),M.closePath();let Y=new b1(new t5(M),new S0({color:["#ffe184","#ffab55","#f87842"][D%3],side:E0,transparent:!0,opacity:0,depthWrite:!1}));Y.position.z=.07,Y.renderOrder=9;
    Y.material.onBeforeCompile = shader => {
      shader.vertexShader = 'varying vec2 vEmber;\n'+shader.vertexShader
        .replace('#include <begin_vertex>','#include <begin_vertex>\nvEmber = position.xy;');
      shader.fragmentShader = 'varying vec2 vEmber;\n'+shader.fragmentShader.replace(
        '#include <opaque_fragment>',`
          vec2 grainCell = floor(vEmber*210.);
          float pigment = fract(sin(dot(grainCell,vec2(41.7,73.1)))*43758.54);
          float brushEdge = length(vEmber/vec2(.162,.107));
          float feather = 1.-smoothstep(.46,1.05,brushEdge+pigment*.13);
          outgoingLight *= .76+pigment*.24;
          diffuseColor.a *= feather;
          #include <opaque_fragment>
        `);
    };let w=(D<7?.43:.17)+E6(D+28)*.16;Y.scale.setScalar(w),R.add(Y);let $=new b1(e.geometry,e.material.clone());$.scale.setScalar(.74),$.position.z=.055,$.renderOrder=7,R.add($),R.rotation.z=p,i.add(R),d.push({part:R,body:Y,glow:$,tail:Q,core:E,angle:p,speed:j,length:k,size:w})}let s=new a0;u.add(s);let F=new b1(e.geometry,e.material.clone());F.position.z=.12,F.renderOrder=10,s.add(F);let L=[];for(let D=0;D<12;D++){let R=D/12*Math.PI*2,p=.48+E6(D+72)*.55;L.push(Math.cos(R)*.15,Math.sin(R)*.1,.1,Math.cos(R)*p,Math.sin(R)*p*.65,.1)}let c=new i0;c.setAttribute("position",new z1(L,3));let m=new R2(c,new f6({color:"#fff0bd",transparent:!0,opacity:0,depthWrite:!1}));m.renderOrder=11,s.add(m);let h=new i0,H=new Float32Array(90*3);h.setAttribute("position",new m0(H,3));let f=new tn(h,new Sn({color:"#ffe1a6",size:.025,transparent:!0,opacity:.85,depthWrite:!1}));f.frustumCulled=!1,u.add(f);function Z(D,R=0){R=.47+R*.58;let p=es(R);u.userData.phase=R<.27?"intact":R<.34?"cracking":R<.46?"breaking":"fragments",u.userData.fragmentCount=30,o.visible=p.intact>.001,o.material.opacity=p.intact,o.scale.setScalar((1+Math.sin(D*3)*.035)*(1+p.flash*.32)),l.forEach(({material:j,opacity:k})=>{j.uniforms?(j.uniforms.opacity.value=k*p.commonTrail,j.uniforms.breakup.value=fn(.05,.45,p.split)):j.opacity=k*p.commonTrail}),e.material.uniforms.strength.value=p.intact+p.flash*.78,e.scale.setScalar(1+p.flash*1.6),t.visible=p.cracks>.001,t.children.forEach(j=>j.material.opacity=p.cracks*.9),i.visible=p.fragments>.001,d.forEach((j,k)=>{
      const delay = E6(k+61)*.105;
      const travel = fn(.335+delay,.94,R);
      const axial = travel*j.speed;
      const lane = (E6(k+37)-.5)*travel*1.4;
      const brightness = fn(.335+delay,.385+delay,R) *
        (1-fn(.65+delay,.94+delay,R)) *
        (0.82+0.18*Math.sin(D*8+k*2.1));
      j.part.position.set(-Math.cos(j.angle)*axial,-Math.sin(j.angle)*axial+lane,.02+k%3*.012);
      j.part.rotation.z = j.angle;
      j.body.material.opacity = brightness;
      j.glow.material.uniforms.strength.value = brightness*(k<7?.85:.38);
      for (const trail of [j.tail,j.core]) trail.material.uniforms.opacity.value = trail.opacity*brightness;
    }),s.visible=p.flash>.001,F.material.uniforms.strength.value=p.flash*1.3,F.scale.setScalar(1.4+p.flash*1.3),m.material.opacity=p.flash*.12,m.scale.setScalar(.65+p.flash*.7);for(let j=0;j<90;j++){let k=(E6(j)+D*.018)%1,Q=k*7.2,E=d[j%d.length],M=k*E.length,I=E.part.position.x+Math.cos(E.angle)*M,Y=E.part.position.y+Math.sin(E.angle)*M+(E6(j+5)-.5)*.18;H[j*3]=Q*(1-p.split)+I*p.split,H[j*3+1]=(Q*.275+(E6(j+5)-.5)*(.22+k*.35))*(1-p.split)+Y*p.split,H[j*3+2]=.04}h.attributes.position.needsUpdate=!0}return{group:u,update:Z,pieces:d}}
