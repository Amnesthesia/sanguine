// Which health types the settings screen offers and how they read (PLAN.md §7.5). Pure, so the teen and sexual-activity rules are tested.
import { HEALTH_TYPES, type HealthType, READ_ONLY_TYPES } from '@sanguine/health-adapter';

export interface HealthRow { type: HealthType; readOnly: boolean; titleKey: string; bodyKey: string }

export function healthRows(o: { teen: boolean; sexLogging: boolean }): HealthRow[] {
  return HEALTH_TYPES.filter((t) => t !== 'sex' || o.sexLogging).map((type) => ({
    type,
    readOnly: READ_ONLY_TYPES.includes(type),
    titleKey: `settings.health.types.${type}.title`,
    bodyKey: `settings.health.types.${type}.${type === 'skin_temp' && o.teen ? 'bodyTeen' : 'body'}`,
  }));
}

export const withType = (types: HealthType[], type: HealthType, on: boolean): HealthType[] => HEALTH_TYPES.filter((t) => (t === type ? on : types.includes(t)));
