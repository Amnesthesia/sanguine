import { beforeEach, describe, expect, it } from 'vitest';
import { FakeDriver, MemoryLinks, MemorySink } from './fake';
import { contentHash, localIso } from './mapping';
import { syncType } from './sync';
import type { HealthType, RecordValue } from './types';

const BNE = 'Australia/Brisbane';
const NOW = '2026-10-09T08:00:00Z';
const o = { now: NOW, deviceZone: BNE, since: '2024-10-09T00:00:00Z' };
const flowRec = (day: string, level: 'light' | 'medium' | 'heavy' = 'medium', extra: object = {}) => ({
  type: 'period_flow' as const, start: localIso(day, '00:00', BNE), end: localIso(day, '23:59', BNE), zone: BNE, value: { kind: 'flow', level } as RecordValue, ...extra,
});
const flowEv = (day: string, level = 'medium') => ({ day, level, flow_kind: 'period' });

let d: FakeDriver;
let links: MemoryLinks;
let sink: MemorySink;
const run = (t: HealthType = 'period_flow') => syncType(d, links, sink, t, o);
beforeEach(() => { d = new FakeDriver('2026-10-09T07:00:00Z'); links = new MemoryLinks(); sink = new MemorySink(); });

describe('import', () => {
  it('imports a foreign record as an imported event with a read link', async () => {
    const [r] = d.seed([flowRec('2026-10-05')]);
    const rep = await run();
    expect(rep.imported).toBe(1);
    expect(sink.list).toHaveLength(1);
    expect(sink.list[0]).toMatchObject({ kind: 'flow', provenance: 'imported', externalId: r?.externalId, payload: { day: '2026-10-05', level: 'medium', flow_kind: 'period' } });
    expect(await links.byExternalId('healthkit', r?.externalId as string)).toMatchObject({ direction: 'read', eventId: sink.list[0]?.id });
  });
  it('a second sync adds nothing', async () => {
    d.seed([flowRec('2026-10-05')]);
    await run();
    const rep = await run();
    expect(rep.imported).toBe(0);
    expect(sink.list).toHaveLength(1);
  });
  it('imports a wrist temperature on the morning it ends', async () => {
    d.seed([{ type: 'skin_temp', start: '2026-10-08T13:00:00Z', end: '2026-10-08T20:30:00Z', zone: BNE, value: { kind: 'temp', celsius: 35.9 } }]);
    await run('skin_temp');
    expect(sink.list[0]?.payload).toMatchObject({ day: '2026-10-09', type: 'skin_temp', source: 'wrist', value: { valueC: 35.9 } });
  });
  it('passes the stored anchor to the next read', async () => {
    d.seed([flowRec('2026-10-05')]);
    await run();
    const a = await links.anchor('healthkit', 'period_flow');
    expect(a).not.toBeNull();
    await run();
    expect(d.lastAnchor).toBe(a);
  });
  it('a throttled read keeps the old anchor and the next run finishes the rest', async () => {
    d.seed([flowRec('2026-10-05'), flowRec('2026-10-06')]);
    d.throttleNext = true;
    const first = await run();
    expect(first.imported).toBe(1);
    expect(await links.anchor('healthkit', 'period_flow')).toBeNull();
    const second = await run();
    expect(second.imported).toBe(1);
    expect(sink.list).toHaveLength(2);
  });
  it('a record edited by the other app replaces the imported event', async () => {
    const [r] = d.seed([flowRec('2026-10-05', 'light')]);
    await run();
    d.now = '2026-10-09T07:30:00Z';
    d.modify(r?.externalId as string, { value: { kind: 'flow', level: 'heavy' } });
    const rep = await run();
    expect(rep).toMatchObject({ imported: 1, retracted: 1 });
    const live = sink.list.filter((e) => !e.retracted);
    expect(live).toHaveLength(1);
    expect(live[0]?.payload).toMatchObject({ level: 'heavy' });
  });
});

describe('echo prevention (§7.3)', () => {
  it('drops records from our own source', async () => {
    d.seed([flowRec('2026-10-05', 'medium', { source: d.ownSource })]);
    const rep = await run();
    expect(rep).toMatchObject({ echoed: 1, imported: 0 });
    expect(sink.list).toHaveLength(0);
  });
  it('drops a record whose clientRecordId matches a wrote link', async () => {
    await links.put({ eventId: 'ev-9', platform: 'healthkit', externalId: 'zzz', direction: 'wrote', contentHash: 'h', writtenAt: '2026-10-01T00:00:00Z' });
    d.seed([flowRec('2026-10-05', 'medium', { clientRecordId: 'ev-9' })]);
    expect(await run()).toMatchObject({ echoed: 1, imported: 0 });
  });
  it('drops a copy by content hash within 48 h, even with no ids', async () => {
    const h = contentHash('2026-10-05', 'period_flow', { kind: 'flow', level: 'medium' });
    await links.put({ eventId: 'ev-9', platform: 'healthkit', externalId: 'w1', direction: 'wrote', contentHash: h, writtenAt: '2026-10-08T08:00:00Z' });
    d.seed([flowRec('2026-10-05')]);
    expect(await run()).toMatchObject({ echoed: 1, imported: 0 });
  });
  it('imports it when the write was older than 48 h', async () => {
    const h = contentHash('2026-10-05', 'period_flow', { kind: 'flow', level: 'medium' });
    await links.put({ eventId: 'ev-9', platform: 'healthkit', externalId: 'w1', direction: 'wrote', contentHash: h, writtenAt: '2026-10-01T08:00:00Z' });
    d.seed([flowRec('2026-10-05')]);
    expect(await run()).toMatchObject({ echoed: 0, imported: 1 });
  });
  it('never re-imports what it wrote, across a full push then read', async () => {
    sink.manual('flow', flowEv('2026-10-05'));
    await run();
    const rep = await run();
    expect(rep).toMatchObject({ imported: 0, written: 0 });
    expect(sink.list).toHaveLength(1);
    expect(d.writes).toHaveLength(1);
  });
});

describe('duplicates and conflicts (§7.3)', () => {
  it('same day, type and value from another app links as read without a new event', async () => {
    const mine = sink.manual('flow', flowEv('2026-10-05'));
    const [r] = d.seed([flowRec('2026-10-05')]);
    const rep = await run();
    expect(rep.duplicates).toBe(1);
    expect(sink.list).toHaveLength(1);
    expect(await links.byExternalId('healthkit', r?.externalId as string)).toMatchObject({ direction: 'read', eventId: mine.id });
  });
  it('same day, different value: manual wins and the import is kept as a retracted event', async () => {
    sink.manual('flow', flowEv('2026-10-05', 'heavy'));
    d.seed([flowRec('2026-10-05', 'light')]);
    const rep = await run();
    expect(rep.conflicts).toBe(1);
    expect(sink.list).toHaveLength(2);
    expect(sink.list.find((e) => e.provenance === 'imported')).toMatchObject({ retracted: true, payload: { level: 'light' } });
    expect(sink.list.find((e) => e.provenance === 'manual')?.retracted).toBe(false);
  });
  it('between two imports the later modification time wins', async () => {
    d.seed([flowRec('2026-10-05', 'light', { modifiedAt: '2026-10-09T06:00:00Z' })]);
    await run();
    d.seed([flowRec('2026-10-05', 'heavy', { modifiedAt: '2026-10-09T07:00:00Z' })]);
    expect((await run()).conflicts).toBe(1);
    const live = sink.list.filter((e) => !e.retracted);
    expect(live).toHaveLength(1);
    expect(live[0]?.payload).toMatchObject({ level: 'heavy' });
  });
  it('between two imports an earlier modification time loses', async () => {
    d.seed([flowRec('2026-10-05', 'light', { modifiedAt: '2026-10-09T07:00:00Z' })]);
    await run();
    d.seed([flowRec('2026-10-05', 'heavy', { modifiedAt: '2026-10-09T06:00:00Z' })]);
    await run();
    const live = sink.list.filter((e) => !e.retracted);
    expect(live[0]?.payload).toMatchObject({ level: 'light' });
  });
  it('a period start within one day of ours is agreement: our day is kept', async () => {
    sink.manual('flow', flowEv('2026-10-05'));
    d.seed([flowRec('2026-10-06', 'medium', { value: { kind: 'flow', level: 'medium', cycleStart: true } })]);
    const rep = await run();
    expect(rep).toMatchObject({ duplicates: 1, imported: 0, conflicts: 0 });
    expect(sink.list).toHaveLength(1);
  });
  it('a period start two days from ours is not agreement', async () => {
    sink.manual('flow', flowEv('2026-10-05'));
    d.seed([flowRec('2026-10-07', 'medium', { value: { kind: 'flow', level: 'medium', cycleStart: true } })]);
    expect((await run()).imported).toBe(1);
  });
});

describe('deletions (§7.3)', () => {
  it('a record deleted in the platform retracts its imported event', async () => {
    const [r] = d.seed([flowRec('2026-10-05')]);
    await run();
    d.remoteDelete(r?.externalId as string);
    const rep = await run();
    expect(rep.retracted).toBe(1);
    expect(sink.list[0]?.retracted).toBe(true);
    expect(await links.byExternalId('healthkit', r?.externalId as string)).toBeNull();
  });
  it('a duplicate link on our manual event is dropped without touching the event', async () => {
    sink.manual('flow', flowEv('2026-10-05'));
    const [r] = d.seed([flowRec('2026-10-05')]);
    await run();
    d.remoteDelete(r?.externalId as string);
    const rep = await run();
    expect(rep.retracted).toBe(0);
    expect(sink.list[0]?.retracted).toBe(false);
  });
  it('a record we wrote, deleted in the platform, asks before retracting the manual event', async () => {
    sink.manual('flow', flowEv('2026-10-05'));
    await run();
    const written = d.writes[0];
    d.remoteDelete(written?.externalId as string);
    const rep = await run();
    expect(rep.asks).toEqual([{ eventId: sink.list[0]?.id, externalId: written?.externalId, reason: 'deleted_remote_manual' }]);
    expect(sink.list[0]?.retracted).toBe(false);
    expect(d.writes).toHaveLength(1);
  });
});

describe('writes', () => {
  it('writes an unlinked manual event and stores a wrote link', async () => {
    const mine = sink.manual('flow', flowEv('2026-10-05'));
    const rep = await run();
    expect(rep.written).toBe(1);
    expect(d.writes[0]).toMatchObject({ type: 'period_flow', clientRecordId: mine.id, value: { kind: 'flow', level: 'medium', cycleStart: true } });
    expect(await links.byEventId(mine.id)).toMatchObject([{ direction: 'wrote', externalId: d.writes[0]?.externalId }]);
  });
  it('marks only the first day of a run as the cycle start', async () => {
    sink.manual('flow', flowEv('2026-10-05'));
    sink.manual('flow', flowEv('2026-10-06'));
    await run();
    expect(d.writes.map((w) => (w.value as { cycleStart?: boolean }).cycleStart === true)).toEqual([true, false]);
  });
  it('a retracted event with a wrote link is deleted in the platform and unlinked', async () => {
    const mine = sink.manual('flow', flowEv('2026-10-05'));
    await run();
    await sink.retract(mine.id);
    const rep = await run();
    expect(rep.deletedRemote).toBe(1);
    expect(d.deletes).toEqual([d.writes[0]?.externalId]);
    expect(await links.byEventId(mine.id)).toEqual([]);
  });
  it('a corrected day deletes the old record and writes the new one', async () => {
    const a = sink.manual('flow', flowEv('2026-10-05', 'light'));
    await run();
    await sink.retract(a.id);
    sink.manual('flow', flowEv('2026-10-05', 'heavy'));
    const rep = await run();
    expect(rep).toMatchObject({ deletedRemote: 1, written: 1 });
    expect(d.all().filter((r) => r.source === d.ownSource)).toHaveLength(1);
  });
  it('never writes read-only types, symptoms or post-pregnancy flow', async () => {
    sink.manual('biomarker', { day: '2026-10-05', type: 'skin_temp', value: { valueC: 36 }, source: 'wrist' });
    sink.manual('symptom', { day: '2026-10-05', code: 'cramps', intensity: 1 });
    sink.manual('flow', { day: '2026-10-05', level: 'light', flow_kind: 'post_pregnancy' });
    for (const t of ['skin_temp', 'period_flow'] as const) await run(t);
    expect(d.writes).toHaveLength(0);
  });
  it('a failing write is reported, not thrown, and retried on the next run', async () => {
    sink.manual('flow', flowEv('2026-10-05'));
    d.failWrites = true;
    const bad = await run();
    expect(bad.failed).toHaveLength(1);
    expect(bad.written).toBe(0);
    d.failWrites = false;
    expect((await run()).written).toBe(1);
  });
  it('a failing delete keeps the link so it is retried', async () => {
    const mine = sink.manual('flow', flowEv('2026-10-05'));
    await run();
    await sink.retract(mine.id);
    const del = d.delete.bind(d);
    d.delete = async () => { throw new Error('offline'); };
    const bad = await run();
    expect(bad.failed).toHaveLength(1);
    expect(await links.byEventId(mine.id)).toHaveLength(1);
    d.delete = del;
    expect((await run()).deletedRemote).toBe(1);
  });
});
