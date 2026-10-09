// Device side of the calendar export (P8-2, D-079): a stable per-install id and a rising sequence, the .ics file through the share sheet.
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Database } from '@/data/database';
import { getSetting, setSetting } from '@/data/settings';
import { deviceClock } from './clock';
import { removeTempFile } from './tempFiles';

/** The UID part stays the same for this install, so a resend replaces the event in calendars that honour UID; the sequence rises. */
export async function nextCalendarExport(db: Database): Promise<{ installId: string; sequence: number }> {
  const saved = await getSetting<{ installId?: string; sequence?: number }>(db, 'calendarExport', {});
  const installId = saved.installId ?? [...deviceClock.randomBytes(8)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const sequence = (saved.sequence ?? 0) + 1;
  await setSetting(db, 'calendarExport', { installId, sequence });
  return { installId, sequence };
}

export async function shareCalendarFile(ics: string): Promise<void> {
  const file = new File(Paths.cache, 'sanguine.ics');
  if (file.exists) file.delete();
  file.create();
  file.write(ics);
  try {
    await Sharing.shareAsync(file.uri, { mimeType: 'text/calendar', UTI: 'com.apple.ical.ics', dialogTitle: 'Calendar' });
  } finally {
    removeTempFile(file);
  }
}
