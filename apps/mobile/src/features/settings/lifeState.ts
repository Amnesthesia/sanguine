// Changing the life state (PLAN.md §4.9, §8.2): end the open states, then set the new one. Events only; nothing is edited in place.
import type { ISODate } from '@sanguine/engine';
import type { Database } from '@/data/database';
import type { NewEvent } from '@/data/events';
import type { EventStore } from '@/data/store';
import type { LifeChoice, Method } from '@/features/onboarding/model';

export interface LifeStateRow { id: string; kind: string; detail: Record<string, unknown>; from_day: ISODate; until_day: ISODate | null }

export const KIND_OF: Record<Exclude<LifeChoice, 'none'>, string> = {
  hormonal: 'hormonal_contraception', postHormonal: 'post_contraception', pregnant: 'pregnant', postpartum: 'postpartum', afterLoss: 'postpartum', perimenopause: 'perimenopause', irregular: 'known_irregular',
};
export const CHOICE_OF: Record<string, LifeChoice> = Object.fromEntries(Object.entries(KIND_OF).filter(([c]) => c !== 'afterLoss').map(([c, k]) => [k, c as LifeChoice]));
/** The choice a stored state shows as: a postpartum state after a pregnancy loss is its own choice (D-053). */
export const choiceOf = (r: Pick<LifeStateRow, 'kind' | 'detail'>): LifeChoice => (r.kind === 'postpartum' && r.detail.after === 'loss' ? 'afterLoss' : CHOICE_OF[r.kind] ?? 'none');
const OUTCOME_OF: Partial<Record<LifeChoice, 'birth' | 'loss'>> = { postpartum: 'birth', afterLoss: 'loss' };

export async function lifeStateHistory(db: Database): Promise<LifeStateRow[]> {
  const rows = await db.all<{ id: string; kind: string; detail: string; from_day: string; until_day: string | null }>('SELECT * FROM life_state ORDER BY from_day, id');
  return rows.map((r) => ({ ...r, detail: JSON.parse(r.detail) as Record<string, unknown> }));
}
export const currentLifeStates = (rows: LifeStateRow[], today: ISODate): LifeStateRow[] => rows.filter((r) => r.from_day <= today && (r.until_day === null || r.until_day >= today));

export async function changeLifeState(store: EventStore, db: Database, o: { choice: LifeChoice; day: ISODate; method?: Method; breastfeeding?: boolean }): Promise<void> {
  const open = (await lifeStateHistory(db)).filter((r) => r.until_day === null);
  const outcome = OUTCOME_OF[o.choice];
  const events: NewEvent[] = open.map((r) => ({ kind: 'life_state.end', payload: { kind: r.kind, day: o.day, ...(r.kind === 'pregnant' && outcome ? { outcome } : {}) } }));
  if (o.choice !== 'none') {
    const detail: Record<string, unknown> =
      o.choice === 'hormonal' || o.choice === 'postHormonal' ? { method: o.method ?? 'combined_pill' }
        : o.choice === 'postpartum' ? { breastfeeding: Boolean(o.breastfeeding), after: 'birth' }
          : o.choice === 'afterLoss' ? { breastfeeding: false, after: 'loss' }
            : o.choice === 'irregular' ? { reason: 'other' } : {};
    events.push({ kind: 'life_state.set', payload: { kind: KIND_OF[o.choice], detail, day: o.day } });
  }
  if (events.length) await store.appendMany(events);
}

/** A pregnancy in the past, marked from Insights on a long cycle: pregnant from the cycle's start to the bleed that ended it, then the
 *  postpartum state from that day (D-053). The engine then pauses both cycles (they overlap the pregnancy) and warms up afterwards. */
export async function addPastPregnancy(store: EventStore, o: { from: ISODate; until: ISODate; outcome: 'birth' | 'loss' }): Promise<void> {
  await store.appendMany([
    { kind: 'life_state.set', payload: { kind: 'pregnant', detail: {}, day: o.from } },
    { kind: 'life_state.end', payload: { kind: 'pregnant', day: o.until, outcome: o.outcome } },
    { kind: 'life_state.set', payload: { kind: 'postpartum', detail: { breastfeeding: false, after: o.outcome }, day: o.until } },
  ]);
}
