// One-line descriptions of logged events for the day detail (PLAN.md §8.3 "everything logged that day").
import type { TFunction } from 'i18next';
import type { DayEvent } from './actions';
import { fromC } from './actions';

export function describeEvent(e: DayEvent, t: TFunction, unit: 'C' | 'F'): string {
  const d = e.data as Record<string, any>;
  switch (e.kind) {
    case 'flow':
      if (d.level === 'none') return t('log.conditionNone');
      return `${t('day.entry.flow', { level: t(`log.flowLevels.${d.level}`) })}${t(`day.entry.flowKind.${d.flow_kind}`)}`;
    case 'symptom':
      return t('day.entry.symptom', { name: t(`symptom.${d.code}`, { defaultValue: d.code }), n: d.intensity });
    case 'biomarker': {
      const v = d.value as Record<string, any>;
      if (d.type === 'bbt' || d.type === 'skin_temp') {
        const shown = fromC(v.valueC as number, unit).toFixed(2);
        const time = typeof d.measured_at === 'string' ? /T(\d\d:\d\d)/.exec(d.measured_at)?.[1] : undefined;
        return `${t('day.entry.temp', { value: shown, unit: `°${unit}` })}${time ? ` · ${time}` : ''} · ${t(`log.temperatureSource.${d.source}`, { defaultValue: d.source })}`;
      }
      if (d.type === 'lh') return t('day.entry.lh', { result: t(`log.lh.${v.result}`) });
      if (d.type === 'mucus') return t('day.entry.mucus', { quality: t(`log.mucusLevels.${v.quality}`) });
      if (d.type === 'cervix')
        return t('day.entry.cervix', { position: t(`log.cervixValues.position.${v.position}`).toLowerCase(), firmness: t(`log.cervixValues.firmness.${v.firmness}`).toLowerCase(), opening: t(`log.cervixValues.opening.${v.opening}`).toLowerCase() });
      return String(d.type);
    }
    case 'sex': return t('day.entry.sex', { condom: d.protected ? t('log.condomYes') : t('log.condomNo') });
    case 'note': return t('day.entry.note');
    case 'period.start': return t('day.entry.periodStart');
    case 'period.end': return t('day.entry.periodEnd');
    default: return e.kind;
  }
}
