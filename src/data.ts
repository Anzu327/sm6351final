import type { DataBundle, Filters, Manifest, RecordItem } from './types';
import { isMeteorite } from './types';
async function json<T>(path: string): Promise<T> {
  const response = await fetch(import.meta.env.BASE_URL + path);
  if (!response.ok) throw new Error('Could not load ' + path + ' (' + response.status + ')');
  return response.json() as Promise<T>;
}
export async function loadData(): Promise<DataBundle> {
  const manifest = await json<Manifest>('data/manifest.json');
  if (manifest.schemaVersion !== 1) throw new Error('Unsupported data schema');
  const [shards, fireballs] = await Promise.all([
    Promise.all(manifest.meteoriteShards.map(path => json<DataBundle['meteorites']>(path))),
    json<DataBundle['fireballs']>('data/fireballs.json')
  ]);
  const meteorites = shards.flat();
  if (meteorites.length !== manifest.meteorites.total || fireballs.length !== manifest.fireballs.total) throw new Error('Incomplete dataset. Please retry.');
  return { manifest, meteorites, fireballs };
}
export function filterRecords(rows: RecordItem[], f: Filters): RecordItem[] {
  const q=f.query.trim().toLowerCase();
  return rows.filter(r => {
    const match = (r.name + ' ' + r.id + ' ' + (r.id==='nasa:54831'?'Black Beauty':'')).toLowerCase().includes(q);
    const time = r.year === null ? f.includeUndated : (f.from===null || r.year>=f.from) && (f.to===null || r.year<=f.to);
    return match && time && (!isMeteorite(r) || ((!f.status || r.status===f.status) && (!f.classification || r.classification===f.classification)));
  });
}
export function massLabel(g: number|null) { if(g===null)return 'Unknown'; return g>=1e6 ? (g/1e6).toLocaleString('en',{maximumFractionDigits:3})+' t' : g>=1000 ? (g/1000).toLocaleString('en',{maximumFractionDigits:3})+' kg' : g.toLocaleString('en',{maximumFractionDigits:3})+' g'; }
