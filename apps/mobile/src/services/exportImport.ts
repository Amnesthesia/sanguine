// Device side of export/import: write the zip, open the share sheet, pick a file to read. Logic lives in data/exportImport.ts.
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { exportBundle, importBundle, importPeriodCsv, type CsvImportResult, type ImportResult } from '@/data/exportImport';
import { importDailyRows, type DailyImportResult } from '@/data/importDaily';
import { readDrip } from '@/data/importDrip';
import { readNaturalCycles } from '@/data/importNaturalCycles';
import type { Database } from '@/data/database';
import type { EventStore } from '@/data/store';
import { deviceClock, todayLocal } from './clock';
import { getNoteKey } from './secrets';
import { removeTempFile } from './tempFiles';

export async function shareExport(db: Database, store: EventStore): Promise<{ events: number }> {
  const { zip, eventCount } = await exportBundle(db, store, deviceClock);
  const file = new File(Paths.cache, `sanguine-export-${todayLocal()}.zip`);
  if (file.exists) file.delete();
  file.create();
  file.write(zip);
  try {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/zip', UTI: 'public.zip-archive', dialogTitle: 'Sanguine export' });
  } finally {
    removeTempFile(file);
  }
  return { events: eventCount };
}

export type PickedImport =
  | { kind: 'sanguine'; result: ImportResult }
  | { kind: 'csv'; result: CsvImportResult }
  | { kind: 'natural_cycles' | 'drip'; result: DailyImportResult; problems: string[]; symptoms: string[] }
  | { kind: 'cancelled' };

/** Lets the user pick a Sanguine export (.zip), a Natural Cycles export (.xlsx, or its CSV), a drip export (CSV) or a CSV of period start dates. */
export async function pickAndImport(db: Database, store: EventStore): Promise<PickedImport> {
  const picked = await DocumentPicker.getDocumentAsync({ type: ['application/zip', 'text/csv', 'text/comma-separated-values', 'text/plain', '*/*'], copyToCacheDirectory: true, multiple: false });
  const asset = picked.canceled ? undefined : picked.assets[0];
  if (!asset) return { kind: 'cancelled' };
  const file = new File(asset.uri);
  try {
    const bytes = await file.bytes();
    for (const [kind, read] of [['natural_cycles', readNaturalCycles], ['drip', readDrip]] as const) {
      const parsed = read(bytes);
      if (!parsed) continue;
      const result = await importDailyRows(db, store, parsed.rows, { sourceApp: kind, today: todayLocal(), clock: deviceClock, noteKey: await getNoteKey() });
      return { kind, result, problems: parsed.problems, symptoms: [...new Set(parsed.rows.flatMap((r) => r.symptoms ?? []))] };
    }
    if (/\.zip$/i.test(asset.name) || asset.mimeType === 'application/zip') return { kind: 'sanguine', result: await importBundle(db, store, bytes) };
    return { kind: 'csv', result: await importPeriodCsv(db, store, await file.text(), todayLocal()) };
  } finally {
    removeTempFile(file);
  }
}
