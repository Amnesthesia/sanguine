// PLAN.md §10 Phase 4 exit criterion: the round trip passes with zero duplicates after 3 simulated cycles.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { FakeDriver, MemoryLinks, MemorySink } from './fake';
import { addDays, localIso } from './mapping';
import { syncType } from './sync';
import type { HealthType } from './types';

const BNE = 'Australia/Brisbane';
const TYPES: HealthType[] = ['period_flow', 'bbt', 'lh'];
const START = '2026-01-05';

async function simulate(order: (cycle: number) => number[]) {
  const d = new FakeDriver('2026-04-01T00:00:00Z');
  const links = new MemoryLinks();
  const sink = new MemorySink();
  const sync = async (now: string) => { for (const t of TYPES) await syncType(d, links, sink, t, { now, deviceZone: BNE, since: '2025-01-01T00:00:00Z' }); };
  for (let c = 0; c < 3; c++) {
    const first = addDays(START, c * 28);
    const steps = [
      async () => { for (let i = 0; i < 5; i++) sink.manual('flow', { day: addDays(first, i), level: 'medium', flow_kind: 'period' }); },
      async () => {
        d.now = `2026-0${c + 2}-01T00:00:00Z`;
        d.seed(Array.from({ length: 28 }, (_, i) => ({ type: 'bbt' as const, start: localIso(addDays(first, i), '06:00', BNE), zone: BNE, value: { kind: 'temp' as const, celsius: 36.3 + (i > 14 ? 0.3 : 0) } })));
        d.seed([{ type: 'lh', start: localIso(addDays(first, 13), '12:00', BNE), zone: BNE, value: { kind: 'lh', result: 'positive' } }]);
      },
    ];
    for (const i of order(c)) await steps[i]?.();
    await sync(`2026-0${c + 2}-02T00:00:00Z`);
    await sync(`2026-0${c + 2}-03T00:00:00Z`); // reads back what we wrote
    await sync(`2026-0${c + 2}-04T00:00:00Z`);
  }
  return { d, links, sink, sync };
}

const live = (s: MemorySink, pred: (e: { kind: string; payload: Record<string, unknown> }) => boolean) => s.list.filter((e) => !e.retracted && pred(e));

describe('round trip over 3 simulated cycles', () => {
  it('has zero duplicates and never re-writes', async () => {
    const { d, sink, links } = await simulate(() => [0, 1]);
    expect(live(sink, (e) => e.kind === 'flow')).toHaveLength(15);
    expect(live(sink, (e) => e.kind === 'flow').every((e) => e.provenance === 'manual')).toBe(true);
    expect(live(sink, (e) => e.kind === 'biomarker' && e.payload.type === 'bbt')).toHaveLength(84);
    expect(live(sink, (e) => e.kind === 'biomarker' && e.payload.type === 'lh')).toHaveLength(3);
    const keys = live(sink, () => true).map((e) => `${e.kind}|${String(e.payload.day)}|${String(e.payload.type ?? '')}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(d.writes).toHaveLength(15);
    expect([...links.rows.values()].filter((l) => l.direction === 'wrote')).toHaveLength(15);
    expect([...links.rows.values()].filter((l) => l.direction === 'read')).toHaveLength(87);
  });
  it('propagates a retract to the platform and a platform deletion back', async () => {
    const { d, sink, links, sync } = await simulate(() => [0, 1]);
    const flow = live(sink, (e) => e.kind === 'flow')[0] as ReturnType<typeof live>[number] & { id: string };
    await sink.retract(flow.id);
    const bbt = [...links.rows.values()].find((l) => l.direction === 'read' && sink.list.find((e) => e.id === l.eventId)?.payload.type === 'bbt');
    d.remoteDelete(bbt?.externalId as string);
    await sync('2026-05-01T00:00:00Z');
    expect(d.deletes).toHaveLength(1);
    expect(live(sink, (e) => e.kind === 'flow')).toHaveLength(14);
    expect(live(sink, (e) => e.kind === 'biomarker' && e.payload.type === 'bbt')).toHaveLength(83);
  });
  it('ends with the same events whatever order the two apps log in', async () => {
    const baseline = (await simulate(() => [0, 1])).sink;
    const key = (s: MemorySink) => live(s, () => true).map((e) => `${e.kind}|${String(e.payload.day)}|${String(e.payload.type ?? '')}|${e.provenance}`).sort();
    await fc.assert(fc.asyncProperty(fc.array(fc.boolean(), { minLength: 3, maxLength: 3 }), async (flips) => {
      const { sink } = await simulate((c) => (flips[c] ? [1, 0] : [0, 1]));
      expect(key(sink)).toEqual(key(baseline));
    }), { numRuns: 8 });
  });
});
