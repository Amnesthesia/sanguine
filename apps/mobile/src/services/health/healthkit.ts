// iOS HealthKit driver (PLAN.md §7.2, §7.4). Native: only loaded where the module exists (see index.ts); the mapping is in healthkitMapping.ts.
import * as HealthKit from '@kingstinct/react-native-healthkit';
import { type HealthType, type NewRecord, type PlatformDriver, type ReadResult, READ_ONLY_TYPES } from '@sanguine/health-adapter';
import { deviceClock } from '../clock';
import { HK_TYPES, type HkSample, recordToSave, sampleToRecord } from './healthkitMapping';

/** The part of the library this driver calls, typed loosely: the library's identifier unions are generated and very large. */
interface HkApi {
  isHealthDataAvailable(): boolean;
  requestAuthorization(a: { toShare?: string[]; toRead?: string[] }): Promise<boolean>;
  queryCategorySamplesWithAnchor(id: string, o: { anchor?: string; limit: number; filter?: { date?: { startDate?: Date } } }): Promise<Anchored>;
  queryQuantitySamplesWithAnchor(id: string, o: { anchor?: string; limit: number; unit?: string; filter?: { date?: { startDate?: Date } } }): Promise<Anchored>;
  saveCategorySample(id: string, value: number, start: Date, end: Date, metadata?: Record<string, unknown>): Promise<{ uuid: string } | undefined>;
  saveQuantitySample(id: string, unit: string, value: number, start: Date, end: Date, metadata?: Record<string, unknown>): Promise<{ uuid: string } | undefined>;
  deleteObjects(id: string, filter: { uuid: string } | { sources: unknown[] }): Promise<number>;
  currentAppSource(): unknown;
}
interface Anchored { samples: readonly HkSample[]; deletedSamples: ReadonlyArray<{ uuid: string }>; newAnchor: string }
const hk = HealthKit as unknown as HkApi;

export function healthKitAvailable(): boolean {
  try { return hk.isHealthDataAvailable(); } catch { return false; }
}

export function createHealthKitDriver(): PlatformDriver {
  return {
    platform: 'healthkit',
    ownSource: 'app.sanguine.mobile',

    async requestPermission(types: HealthType[]) {
      await hk.requestAuthorization({
        toRead: types.map((t) => HK_TYPES[t].id),
        toShare: types.filter((t) => !READ_ONLY_TYPES.includes(t)).map((t) => HK_TYPES[t].id),
      });
    },

    async read(type, anchor, since): Promise<ReadResult> {
      const t = HK_TYPES[type];
      const opts = { limit: 0, filter: { date: { startDate: new Date(since) } }, ...(anchor ? { anchor } : {}) };
      const res = t.kind === 'category' ? await hk.queryCategorySamplesWithAnchor(t.id, opts) : await hk.queryQuantitySamplesWithAnchor(t.id, { ...opts, unit: 'degC' });
      const modifiedAt = deviceClock.iso(); // HealthKit samples carry no modification time: the import time orders later edits after earlier ones
      const records = [];
      const skipped = [];
      for (const s of res.samples) {
        const r = sampleToRecord(type, s, modifiedAt, __DEV__);
        if (r === null) continue;
        if ('skipped' in r) skipped.push({ externalId: s.uuid, reason: r.skipped });
        else records.push(r);
      }
      return { records, deleted: res.deletedSamples.map((d) => d.uuid), anchor: res.newAnchor, skipped };
    },

    async write(rec: NewRecord) {
      const save = recordToSave(rec);
      if (!save) throw new Error(`${rec.type} is read-only`);
      const out = save.kind === 'category'
        ? await hk.saveCategorySample(save.id, save.value, save.start, save.end, save.metadata)
        : await hk.saveQuantitySample(save.id, save.unit, save.value, save.start, save.end, save.metadata);
      if (!out?.uuid) throw new Error('HealthKit did not return the saved sample');
      return out.uuid;
    },

    async delete(type, externalId) {
      await hk.deleteObjects(HK_TYPES[type].id, { uuid: externalId });
    },
  };
}

/** Background delivery (PLAN.md §7.2): immediate for category types, hourly for quantity types; the callback runs the anchored fetch. Returns an unsubscribe. */
export function watchHealthKit(types: HealthType[], onChange: () => void): () => void {
  const subs: Array<{ remove: () => boolean }> = [];
  const api = HealthKit as unknown as {
    subscribeToChanges(id: string, cb: (a: { errorMessage?: string }) => void): { remove: () => boolean };
    enableBackgroundDelivery(id: string, f: number): Promise<boolean>;
    UpdateFrequency: { immediate: number; hourly: number };
  };
  for (const t of types) {
    const { id, kind } = HK_TYPES[t];
    subs.push(api.subscribeToChanges(id, (a) => { if (!a.errorMessage) onChange(); }));
    void api.enableBackgroundDelivery(id, kind === 'category' ? api.UpdateFrequency.immediate : api.UpdateFrequency.hourly).catch(() => {});
  }
  return () => { for (const s of subs) s.remove(); };
}

/** Development only (simulator): fills HealthKit with foreign-looking history so the import path can be driven end to end, or removes what this app wrote. */
export async function devSeedHealthKit(action: 'seed' | 'clear', today: string): Promise<string> {
  const types: HealthType[] = ['period_flow', 'bbt'];
  if (action === 'clear') {
    for (const t of types) await hk.deleteObjects(HK_TYPES[t].id, { sources: [hk.currentAppSource()] });
    return 'cleared';
  }
  await hk.requestAuthorization({ toRead: types.map((t) => HK_TYPES[t].id), toShare: types.map((t) => HK_TYPES[t].id) });
  for (const t of types) await hk.deleteObjects(HK_TYPES[t].id, { sources: [hk.currentAppSource()] }); // start from a known state
  const day = (offset: number, hour = 0) => { const d = new Date(`${today}T00:00:00`); d.setDate(d.getDate() + offset); d.setHours(hour); return d; };
  let n = 0;
  for (const startOffset of [-38, -66, -94]) {
    for (let i = 0; i < 5; i++) {
      const start = day(startOffset + i);
      const md = { 'com.sanguine.seed': true, HKMenstrualCycleStart: i === 0 };
      await hk.saveCategorySample(HK_TYPES.period_flow.id, i === 0 || i === 1 ? 4 : 3, start, new Date(start.getTime() + 86_399_000), md);
      n++;
    }
  }
  for (let o = -40; o <= -1; o++) { await hk.saveQuantitySample(HK_TYPES.bbt.id, 'degC', o % 28 < 14 ? 36.3 : 36.6, day(o, 6), day(o, 6), { 'com.sanguine.seed': true }); n++; }
  return `seeded ${n}`;
}
