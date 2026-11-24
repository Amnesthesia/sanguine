// The user's export in our own day-based format (D-159, docs/FORMAT.md): built from the derived tables, which already leave out
// retracted entries, plus the event log for what the tables do not keep (a pregnancy's outcome, cycle marks).
import { openNote } from '@sanguine/crypto';
import type { Database } from '../database';
import type { FlowKind } from '../events';
import { activeEvents, localTimeOfDay } from '../project';
import type { EventStore } from '../store';
import { FORMAT, VERSION, type CycleMark, type LhResult, type PeriodMark, type Day, type LifeStateSpan, type SanguineData, type Temperature } from './sanguineData';

interface DayRow { day: string; flow: string | null; flow_kind: string | null; clots: number; symptoms: string; sex: string | null; notes_cipher: Uint8Array | null; energy: number | null }
interface BioRow { day: string; type: string; value: string; measured_at: string | null; source: string; disturbed: number }
interface LifeRow { kind: string; detail: string; from_day: string; until_day: string | null }

export async function exportSanguineData(db: Database, store: EventStore, o: { noteKey?: Uint8Array; exportedAt: string }): Promise<{ data: SanguineData; notesDropped: number }> {
  const byDay = new Map<string, Day>();
  const get = (date: string): Day => { let d = byDay.get(date); if (!d) { d = { date } as Day; byDay.set(date, d); } return d; };
  let notesDropped = 0;

  for (const r of await db.all<DayRow>('SELECT * FROM daily_log ORDER BY day')) {
    const d = get(r.day);
    if (r.flow) d.flow = { level: r.flow as 'none' | 'spotting' | 'light' | 'medium' | 'heavy', ...(r.flow_kind ? { kind: r.flow_kind as FlowKind } : {}), ...(r.clots ? { clots: true } : {}) };
    const symptoms = (JSON.parse(r.symptoms) as Array<{ code: string; intensity: 1 | 2 | 3 }>).map((s) => ({ code: s.code, intensity: s.intensity }));
    if (symptoms.length) d.symptoms = symptoms;
    if (r.sex) d.sex = { protected: (JSON.parse(r.sex) as { protected: boolean }).protected };
    if (r.energy) d.energy = r.energy as 1 | 2 | 3 | 4 | 5;
    if (r.notes_cipher) {
      const text = o.noteKey ? openNote(o.noteKey, new TextDecoder().decode(r.notes_cipher)) : null;
      if (text) d.note = text; else notesDropped++;
    }
  }

  for (const b of await db.all<BioRow>('SELECT day, type, value, measured_at, source, disturbed FROM biomarker ORDER BY day, id')) {
    const d = get(b.day);
    const v = JSON.parse(b.value) as Record<string, unknown>;
    switch (b.type) {
      case 'bbt': case 'skin_temp': {
        const time = b.measured_at ? localTimeOfDay(b.measured_at) : undefined;
        const t: Temperature = { valueC: v.valueC as number, type: b.type, ...(time ? { time } : {}), ...((b.type === 'bbt' ? ['oral', 'vaginal', 'other'] : ['wrist', 'finger']).includes(b.source) ? { source: b.source as Temperature['source'] } : {}), ...(b.disturbed ? { disturbed: true } : {}) };
        d.temperatures = [...(d.temperatures ?? []), t];
        break;
      }
      case 'lh': d.lh = v.result as LhResult; break;
      case 'preg_test': d.pregTest = v.result as 'negative' | 'positive'; break;
      case 'mucus': d.mucus = { quality: v.quality as never, ...(v.amount ? { amount: v.amount as never } : {}) }; break;
      case 'cervix': d.cervix = v as never; break;
      default: break; // progesterone: no field in the format
    }
  }

  const active = activeEvents(await store.events());
  const lifeStates: LifeStateSpan[] = [];
  for (const s of await db.all<LifeRow>('SELECT kind, detail, from_day, until_day FROM life_state ORDER BY from_day, id')) {
    const detail = JSON.parse(s.detail) as Record<string, unknown>;
    const end = s.until_day ? active.find((e) => e.kind === 'life_state.end' && e.effective_day === s.until_day && (JSON.parse(e.payload) as { kind?: string }).kind === s.kind) : undefined;
    const outcome = end ? (JSON.parse(end.payload) as { outcome?: string }).outcome : undefined;
    lifeStates.push({
      kind: s.kind as LifeStateSpan['kind'], start: s.from_day,
      ...(s.until_day ? { end: s.until_day } : {}),
      ...(outcome ? { outcome: outcome as never } : {}),
      ...(Object.keys(detail).length ? { detail } : {}),
    });
  }
  const cycleMarks: CycleMark[] = [];
  for (const e of active) {
    if (e.kind !== 'cycle.exclude' && e.kind !== 'cycle.confirm_long') continue;
    cycleMarks.push({ cycleStart: (JSON.parse(e.payload) as { cycle_start: string }).cycle_start as CycleMark['cycleStart'], mark: e.kind === 'cycle.exclude' ? 'exclude' : 'confirm_long' });
  }

  // One mark per day and kind, as the projector reads them: in log order the latest explicit merge answer for a start day wins, and a start without an answer leaves it.
  const periodMarks: PeriodMark[] = [];
  const markAt = new Map<string, PeriodMark>();
  for (const e of active) {
    if (e.kind !== 'period.start' && e.kind !== 'period.end') continue;
    const mark = e.kind === 'period.start' ? 'start' : 'end';
    const key = `${e.effective_day}:${mark}`;
    let m = markAt.get(key);
    if (!m) { m = { day: e.effective_day as PeriodMark['day'], mark }; markAt.set(key, m); periodMarks.push(m); }
    const merge = mark === 'start' ? (JSON.parse(e.payload) as { merge?: unknown }).merge : undefined;
    if (typeof merge === 'boolean') m.merge = merge;
  }

  const days = [...byDay.values()].sort((a, b) => (a.date < b.date ? -1 : 1)).filter((d) => Object.keys(d).length > 1);
  return {
    data: { format: FORMAT, version: VERSION, exportedAt: o.exportedAt, source: { app: 'sanguine' }, days, ...(lifeStates.length ? { lifeStates } : {}), ...(cycleMarks.length ? { cycleMarks } : {}), ...(periodMarks.length ? { periodMarks } : {}) },
    notesDropped,
  };
}
