// One-line descriptions of logged events for the day detail (PLAN.md §8.3 "everything logged that day").
import type { TFunction } from 'i18next';
import type { DayEvent } from './actions';
import { fromC } from './actions';
import { localTimeOfDay } from '@/data/project';

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
        const time = typeof d.measured_at === 'string' ? localTimeOfDay(d.measured_at) : undefined; // health readings are UTC instants (D-093)
        return `${t('day.entry.temp', { value: shown, unit: `°${unit}` })}${time ? ` · ${time}` : ''} · ${t(`log.temperatureSource.${d.source}`, { defaultValue: d.source })}`;
      }
      if (d.type === 'lh') return t('day.entry.lh', { result: t(`log.lh.${v.result}`) });
      if (d.type === 'mucus') {
        const quality = t(`log.mucusLevels.${v.quality}`);
        return v.amount ? t('day.entry.mucusAmount', { quality, amount: t(`day.entry.mucusAmounts.${v.amount}`) }) : t('day.entry.mucus', { quality });
      }
      if (d.type === 'preg_test') return t('day.entry.pregTest', { result: t(`log.lh.${v.result}`) });
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

/** Short form for the calendar summary: symptom names, "BBT 36.42 °C", and the full text for everything else. */
export function shortDescribe(e: DayEvent, t: TFunction, unit: 'C' | 'F'): string {
  const d = e.data as Record<string, any>;
  if (e.kind === 'symptom') return t(`symptom.${d.code}`, { defaultValue: d.code });
  if (e.kind === 'biomarker' && (d.type === 'bbt' || d.type === 'skin_temp')) return `${d.type === 'bbt' ? 'BBT' : t('log.temperature')} ${fromC((d.value as { valueC: number }).valueC, unit).toFixed(2)} °${unit}`;
  return describeEvent(e, t, unit);
}
