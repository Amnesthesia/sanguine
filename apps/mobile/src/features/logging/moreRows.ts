// Which rows the logging sheet's "More" section offers (PLAN.md §8.3, §8.6). Pure, so the under-18 rule is tested.
export type MoreRowId = 'temperature' | 'lh' | 'mucus' | 'cervix' | 'sex' | 'note';

export function moreRows(e: { fertilityTools: boolean; sexLogging: boolean }): Array<{ id: MoreRowId }> {
  const all: Array<{ id: MoreRowId; show: boolean }> = [
    { id: 'temperature', show: true },
    { id: 'lh', show: e.fertilityTools },
    { id: 'mucus', show: e.fertilityTools },
    { id: 'cervix', show: e.fertilityTools },
    { id: 'sex', show: e.sexLogging },
    { id: 'note', show: true },
  ];
  return all.filter((r) => r.show).map(({ id }) => ({ id }));
}
