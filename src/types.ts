export interface Meteorite {
  id: string; sourceId: string; name: string; classification: string; nameType: string;
  status: 'Fell' | 'Found'; year: number | null; rawYear: string | null;
  lat: number | null; lng: number | null; massG: number | null; issues: string[];
}
export interface Fireball {
  id: string; name: string; date: string; year: number; lat: number | null; lng: number | null;
  energyKt: number | null; radiatedEnergyJ: number | null; altitudeKm: number | null;
}
export type RecordItem = Meteorite | Fireball;
export type Layer = 'meteorites' | 'fireballs';
export interface Filters { query: string; from: number | null; to: number | null; status: string; classification: string; includeUndated: boolean; }
export interface DataBundle { meteorites: Meteorite[]; fireballs: Fireball[]; manifest: Manifest; }
export interface Manifest {
  schemaVersion: number; acquiredAt: string; meteoriteShards: string[];
  meteorites: { total: number; mapped: number; source: string; transport: string; sha256?: string };
  fireballs: { total: number; mapped: number; source: string; apiVersion: string };
  cleaning: Record<string, number>;
}
export const isMeteorite = (r: RecordItem): r is Meteorite => 'massG' in r;
export const hasLocation = (r: RecordItem): r is RecordItem & { lat: number; lng: number } => r.lat !== null && r.lng !== null;
