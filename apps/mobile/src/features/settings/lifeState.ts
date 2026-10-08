// Changing the life state (PLAN.md §4.9, §8.2): end the open states, then set the new one. Events only; nothing is edited in place.
import type { ISODate } from '@sanguine/engine';
import type { Database } from '@/data/database';
import type { NewEvent } from '@/data/events';
import type { EventStore } from '@/data/store';
import type { LifeChoice, Method } from '@/features/onboarding/model';

export interface LifeStateRow { id: string; kind: string; detail: Record<string, unknown>; from_day: ISODate; until_day: ISODate | null }

export const KIND_OF: Record<Exclude<LifeChoice, 'none'>, string> = {
  hormonal: 'hormonal_contraception', postHormonal: 'post_contraception', pregnant: 'pregnant', postpartum: 'postpartum', perimenopause: 'perimenopause', irregular: 'known_irregular',
};
export const CHOICE_OF: Record<string, LifeChoice> = Object.fromEntries(Object.entries(KIND_OF).map(([c, k]) => [k, c as LifeChoice]));

export async function lifeStateHistory(db: Database): Promise<LifeStateRow[]> {
  const rows = await db.all<{ id: string; kind: string; detail: string; from_day: string; until_day: string | null }>('SELECT * FROM life_state ORDER BY from_day, id');
  return rows.map((r) => ({ ...r, detail: JSON.parse(r.detail) as Record<string, unknown> }));
}
export const currentLifeStates = (rows: LifeStateRow[], today: ISODate): LifeStateRow[] => rows.filter((r) => r.from_day <= today && (r.until_day === null || r.until_day >= today));

export async function changeLifeState(store: EventStore, db: Database, o: { choice: LifeChoice; day: ISODate; method?: Method; breastfeeding?: boolean }): Promise<void> {
  const open = (await lifeStateHistory(db)).filter((r) => r.until_day === null);
  const events: NewEvent[] = open.map((r) => ({ kind: 'life_state.end', payload: { kind: r.kind, day: o.day } }));
  if (o.choice !== 'none') {
    const detail: Record<string, unknown> =
      o.choice === 'hormonal' || o.choice === 'postHormonal' ? { method: o.method ?? 'combined_pill' } : o.choice === 'postpartum' ? { breastfeeding: Boolean(o.breastfeeding) } : o.choice === 'irregular' ? { reason: 'other' } : {};
    events.push({ kind: 'life_state.set', payload: { kind: KIND_OF[o.choice], detail, day: o.day } });
  }
  if (events.length) await store.appendMany(events);
}
