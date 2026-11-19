import fs from 'node:fs';
import assert from 'node:assert/strict';
import {cellToLatLng,latLngToCell} from 'h3-js';
import {Group,Vector3,Matrix4,PerspectiveCamera} from 'three';
import {createLandingDensity} from '../src/landing-density.js';
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
const bins=new Map();
for(const record of located){
  const key=latLngToCell(record.lat,record.lon,4);
  bins.set(key,(bins.get(key)||0)+1);
}
assert.equal(bins.size,3845);
effect.update({time:0,visible:true,pixelRatio:1});
const particles=earth.children[0].children.find(c=>c.name==='Incoming short trails');
const landings=earth.children[0].children.find(c=>c.name==='Landed catalogue points');
const rings=earth.children[0].children.find(c=>c.name==='Mass-scaled landing halos');
let firstFlash=0, firstRing=0, peakFlightSamples=0;
for(let frame=1;frame<=720;frame++){
  effect.update({time:frame*.05,visible:true,pixelRatio:1});
  peakFlightSamples=Math.max(peakFlightSamples,particles.geometry.drawRange.count);
  if(!firstFlash && landings.geometry.attributes.heat.array.some(value=>value>0))firstFlash=frame;
  if(!firstRing && rings.geometry.attributes.alpha.array.some(value=>value>0))firstRing=frame;
}
assert.ok(firstFlash > 0 && firstRing > firstFlash, 'The first landing flashes before its ring expands');
assert.ok(peakFlightSamples > 28*22 && peakFlightSamples <= 28*40, 'The reveal exercises the extended trail buffer without exceeding it');
assert.equal(effect.revealedCount,50951,'Every mapped record must be counted within the reveal');
const columns=earth.children[0].children.find(c=>c.name==='Regional landing counts');
assert.equal(columns.count,bins.size);
assert.ok(columns.geometry.parameters.radiusTop < columns.geometry.parameters.radiusBottom);
const matrix=new Matrix4(),scale=new Vector3(),heights=[],widths=[];
for(let i=0;i<columns.count;i++){
  columns.getMatrixAt(i,matrix);
  scale.setFromMatrixScale(matrix);
  heights.push(scale.y);
  widths.push(scale.x);
}
assert.ok(Math.min(...widths)>0 && Math.max(...widths)<.006);
assert.ok(Math.max(...widths)-Math.min(...widths)>.0005,'Line widths should reflect the varying H3 cell sizes');
const expectedHeights=[...bins.values()].sort((a,b)=>a-b)
  .map(count=>.008+.73*(count/(count+800))**.72);
heights.sort((a,b)=>a-b);
assert.ok(heights.every((height,index)=>Math.abs(height-expectedHeights[index])<.001),
  'Line heights must encode the record counts of the occupied H3 cells');

const pickingGroup=new Group();
const picking=createLandingDensity(pickingGroup,sphere);
const front={lat:0,lon:90,name:'Front record'};
const back={lat:0,lon:-90,name:'Hidden record'};
const pending={lat:24,lon:90,name:'Unrevealed record'};
picking.setRecords([front,back,pending]);
picking.land(0);picking.land(1);picking.update(2);
const camera=new PerspectiveCamera(40,1,.1,30);
camera.position.set(0,0,-5);
camera.lookAt(0,0,0);
camera.updateMatrixWorld();
function pickRecord(record,tolerance=6){
  const [lat,lon]=cellToLatLng(latLngToCell(record.lat,record.lon,4));
  const point=sphere(lat,lon,1.006).project(camera);
  return picking.pick(camera,(point.x+1)*400,(1-point.y)*400,800,800,tolerance);
}
const frontCell=pickRecord(front);
assert.deepEqual(frontCell.records,[front]);
assert.equal(frontCell.count,1);
assert.equal(pickRecord(pending),null,'An unrevealed cell cannot be picked');
camera.position.set(0,0,5);
camera.lookAt(0,0,0);
camera.updateMatrixWorld();
assert.deepEqual(pickRecord(back).records,[back],'Only the front surface can be picked');
const marks=pickingGroup.children.find(child=>child.name==='Regional landing counts');
const glow=pickingGroup.children.find(child=>child.name==='Regional hover glow');
const baseline=new Vector3();
marks.getMatrixAt(0,matrix);baseline.setFromMatrixScale(matrix);
picking.hover(frontCell);
picking.update(0,1,0,true);
marks.getMatrixAt(0,matrix);scale.setFromMatrixScale(matrix);
assert.ok(scale.x>=.0115-1e-6 && Math.abs(scale.y-.17)<1e-6 && scale.y>baseline.y*3,
  'A single-record point grows into a visible line');
assert.equal(glow.visible,true);
assert.equal(glow.geometry.instanceCount,1,'Only the emphasized line has a halo');
const highlighted=scale.clone();
picking.select(frontCell);
picking.hover(null);
picking.update(0,1,0,true);
marks.getMatrixAt(0,matrix);scale.setFromMatrixScale(matrix);
assert.deepEqual(scale,highlighted,'Click keeps the selected line enlarged');
assert.equal(glow.geometry.instanceCount,1,'Selection keeps the halo visible');
picking.select(null);
picking.update(0,1,0,true);
marks.getMatrixAt(0,matrix);scale.setFromMatrixScale(matrix);
assert.deepEqual(scale,baseline);
assert.equal(glow.visible,false,'Closing selection removes the halo');
const before=[...particles.geometry.attributes.position.array];
const ringAlphaBefore=[...rings.geometry.attributes.alpha.array];
effect.update({time:36,visible:true,pixelRatio:1});
assert.deepEqual([...particles.geometry.attributes.position.array],before,'Shared-clock pause must freeze trails');
assert.deepEqual([...rings.geometry.attributes.alpha.array],ringAlphaBefore,'Shared-clock pause must freeze landing rings');
for(let frame=721;frame<=1500;frame++)effect.update({time:frame*.05,visible:true,pixelRatio:1});
assert.equal(effect.revealedCount,50951,'Replay must not double count');
assert.ok(particles.geometry.drawRange.count<=28*40);
effect.setRecords(rows.filter(r=>r.status==='Found'));assert.equal(effect.count,49706,'Found specimens must now participate');
effect.complete();assert.equal(effect.revealedCount,49706,'Complete distribution must include every filtered record');
effect.setRecords([]);effect.update({time:76,visible:true,pixelRatio:1});assert.equal(earth.children[0].visible,false);
console.log({result:'PASS',catalogue:rows.length,mapped:located.length,cells:bins.size,maxCell:Math.max(...bins.values()),checks:'mass units, unique IDs, eligibility, all-record counting, bounded columns/trails, complete reveal, pause, replay, Found filter, empty selection'});
