import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {parseCSV,normalizeMeteorites,normalizeFireballs} from './normalize.mjs';
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const manifest=await json('public/data/manifest.json');
const meteorites=(await Promise.all(manifest.meteoriteShards.map(p=>json('public/'+p)))).flat();const fireballs=await json('public/data/fireballs.json');
const csv=await readFile('data/raw/meteorites.csv','utf8'),rawFire=await readFile('data/raw/fireballs.json','utf8');
assert.equal(createHash('sha1').update('blob '+Buffer.byteLength(csv)+'\0').update(csv).digest('hex'),manifest.meteorites.sourceBlobSha);
assert.deepEqual(meteorites,normalizeMeteorites(parseCSV(csv)));assert.deepEqual(fireballs,normalizeFireballs(JSON.parse(rawFire)));
assert.equal(meteorites.length,manifest.meteorites.total);assert.equal(fireballs.length,manifest.fireballs.total);
for(const rows of [meteorites,fireballs]){assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);for(const r of rows){assert.equal(r.lat===null,r.lng===null);if(r.lat!==null){assert.ok(Math.abs(r.lat)<=90&&Math.abs(r.lng)<=180);assert.ok(!(r.lat===0&&r.lng===0));}if(r.year!==null)assert.ok(Number.isInteger(r.year));}}
assert.equal(meteorites.filter(r=>r.lat!==null).length,manifest.meteorites.mapped);assert.equal(fireballs.filter(r=>r.lat!==null).length,manifest.fireballs.mapped);
const expected={'nasa:23593':'Sikhote-Alin','nasa:34491':'Fukang','nasa:54831':'Northwest Africa 7034'};for(const [id,name] of Object.entries(expected))assert.equal(meteorites.find(r=>r.id===id)?.name,name);
assert.equal(meteorites.find(r=>r.id==='nasa:54831').lat,null);
const flags={};for(const r of meteorites)for(const key of r.issues)flags[key]=(flags[key]??0)+1;assert.deepEqual(flags,manifest.cleaning);
console.log(JSON.stringify({meteorites:meteorites.length,mapped:manifest.meteorites.mapped,fireballs:fireballs.length,cleaning:flags},null,2));
