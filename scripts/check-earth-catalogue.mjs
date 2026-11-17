import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Group,Vector3,Matrix4} from 'three';
import {createMeteorArrivals} from '../src/meteor-arrivals.js';
const data=JSON.parse(fs.readFileSync(new URL('../src/data/meteorite-catalogue.json', import.meta.url),'utf8'));
const rows=data.rows.map(r=>({id:r[0],name:r[1],year:r[2],value:r[3],type:r[4],status:r[5],lat:r[6],lon:r[7],namingStatus:r[8],layer:'meteorites'}));
assert.equal(rows.length,82854);assert.equal(new Set(rows.map(r=>r.id)).size,82854);
const located=rows.filter(r=>Number.isFinite(r.lat)&&Number.isFinite(r.lon));
assert.equal(located.length,50951);
assert.ok(rows.every(r=>['Official','Provisional','Relict*'].includes(r.namingStatus)));
assert.equal(rows.find(r=>r.name==='Chelyabinsk').value,1000000);
const sphere=(lat,lon,r=1)=>new Vector3(r*Math.cos(lat*Math.PI/180)*Math.cos(lon*Math.PI/180),r*Math.sin(lat*Math.PI/180),-r*Math.cos(lat*Math.PI/180)*Math.sin(lon*Math.PI/180));
const earth=new Group(),effect=createMeteorArrivals(earth,sphere);
effect.setRecords(rows);assert.equal(effect.count,50951);
const bins=new Map();for(const r of located){const y=Math.min(17,Math.floor((Math.sin(r.lat*Math.PI/180)+1)*9));const x=Math.floor(((r.lon+180)%360+360)%360/5);const key=y*72+x;bins.set(key,(bins.get(key)||0)+1);}
effect.update({time:0,visible:true,pixelRatio:1});
const particles=earth.children[0].children.find(c=>c.name==='Incoming short trails');
for(let frame=1;frame<=720;frame++)effect.update({time:frame*.05,visible:true,pixelRatio:1});
assert.equal(effect.revealedCount,50951,'Every mapped record must be counted within the reveal');
const columns=earth.children[0].children.find(c=>c.name==='Regional landing counts');
assert.equal(columns.count,bins.size);
const matrix=new Matrix4(),scale=new Vector3(),recovered=[];
for(let i=0;i<columns.count;i++){columns.getMatrixAt(i,matrix);scale.setFromMatrixScale(matrix);assert.ok(scale.y<1,'Large recovery clusters must stay within one globe radius');recovered.push(Math.expm1(scale.y/.075));}
assert.ok(Math.abs(recovered.reduce((a,b)=>a+b,0)-50951)<1,'Column heights must encode every record with the documented log scale');
const before=[...particles.geometry.attributes.position.array];
effect.update({time:36,visible:true,pixelRatio:1});
assert.deepEqual([...particles.geometry.attributes.position.array],before,'Shared-clock pause must freeze trails');
for(let frame=721;frame<=1500;frame++)effect.update({time:frame*.05,visible:true,pixelRatio:1});
assert.equal(effect.revealedCount,50951,'Replay must not double count');
assert.ok(particles.geometry.drawRange.count<=28*22);
effect.setRecords(rows.filter(r=>r.status==='Found'));assert.equal(effect.count,49706,'Found specimens must now participate');
effect.complete();assert.equal(effect.revealedCount,49706,'Complete distribution must include every filtered record');
effect.setRecords([]);effect.update({time:76,visible:true,pixelRatio:1});assert.equal(earth.children[0].visible,false);
console.log({result:'PASS',catalogue:rows.length,mapped:located.length,cells:bins.size,maxCell:Math.max(...bins.values()),checks:'mass units, unique IDs, eligibility, all-record counting, bounded columns/trails, complete reveal, pause, replay, Found filter, empty selection'});

