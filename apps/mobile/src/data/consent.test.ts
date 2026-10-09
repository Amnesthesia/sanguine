import { describe, expect, it } from 'vitest';
import { consentRequirement, getConsent, recordConsent } from './consent';
import { migrate } from './migrate';
import { openTestDb } from './testDb';

describe('consentRequirement', () => {
  it('asks for explicit consent in the EU, EEA, UK and Switzerland', () => {
    for (const r of ['DE', 'fr', 'GB', 'IE', 'NO', 'CH', 'PT']) expect(consentRequirement(r)).toBe('explicit');
  });
  it('uses the standard consent elsewhere', () => {
    for (const r of ['AU', 'US', 'NZ', 'CA', 'BR']) expect(consentRequirement(r)).toBe('standard');
  });
  it('treats an unknown region as the stricter case', () => {
    expect(consentRequirement(null)).toBe('explicit');
    expect(consentRequirement(undefined)).toBe('explicit');
    expect(consentRequirement('')).toBe('explicit');
  });
});

describe('consent record', () => {
  it('is empty until given, then holds the version, time and basis', async () => {
    const db = openTestDb();
    await migrate(db);
    expect(await getConsent(db)).toBeNull();
    await recordConsent(db, '2026-10-09T09:00:00+10:00', 'art9-explicit');
    expect(await getConsent(db)).toEqual({ version: 1, at: '2026-10-09T09:00:00+10:00', basis: 'art9-explicit' });
  });
});
