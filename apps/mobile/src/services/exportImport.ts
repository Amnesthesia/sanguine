// Device side of export/import: write the zip, open the share sheet, pick a file to read. Logic lives in data/exportImport.ts.
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { exportBundle, importBundle, importPeriodCsv, type CsvImportResult, type ImportResult } from '@/data/exportImport';
import { ADAPTERS } from '@/data/adapters';
import { ZipWrongPassword, listZip } from '@/data/adapters/zipCrypto';
import { importSanguineData, type SanguineImportResult } from '@/data/format/importSanguineData';
import type { Database } from '@/data/database';
import type { EventStore } from '@/data/store';
import { deviceClock, todayLocal } from './clock';
import { getNoteKey } from './secrets';
import { removeTempFile } from './tempFiles';

export async function shareExport(db: Database, store: EventStore): Promise<{ events: number }> {
  const { zip, eventCount } = await exportBundle(db, store, deviceClock, { noteKey: await getNoteKey() });
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
  | { kind: 'data'; adapter: string; result: SanguineImportResult; problems: string[]; symptoms: string[] }
  | { kind: 'cancelled' };

/** A file this size is not a cycle export; refuse it before any adapter reads it. */
const MAX_PICKED_BYTES = 256 * 1024 * 1024;

/** What the password sheet answers: the text she typed, or undefined when she cancels. `attempt` is 'wrong' after a password that did not open the file. */
export type AskPassword = (attempt: 'first' | 'wrong', fileName?: string) => Promise<string | undefined>;

/** A zip with `events.jsonl` is a Sanguine backup/export bundle (restore path), not a file for an adapter. */
function isSanguineBundle(bytes: Uint8Array): boolean {
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return false;
  try { return listZip(bytes).some((e) => e.name === 'events.jsonl'); } catch { return false; }
}

/** Lets the user pick a Sanguine export, an app's export (Clue zip or measurements.json, Natural Cycles, drip) or a CSV of period start dates.
 *  App files are decoded to the day-based format by their adapter (D-159) and imported by one writer. The password is only ever held in this call. */
export async function pickAndImport(db: Database, store: EventStore, o: { askPassword: AskPassword }): Promise<PickedImport> {
  const picked = await DocumentPicker.getDocumentAsync({ type: ['application/zip', 'application/json', 'text/csv', 'text/comma-separated-values', 'text/plain', '*/*'], copyToCacheDirectory: true, multiple: false });
  const asset = picked.canceled ? undefined : picked.assets[0];
  if (!asset) return { kind: 'cancelled' };
  const file = new File(asset.uri);
  try {
    const bytes = await file.bytes();
    if (bytes.length > MAX_PICKED_BYTES) throw new Error('That file is too large to import.');
    if (isSanguineBundle(bytes)) return { kind: 'sanguine', result: await importBundle(db, store, bytes) };
    const pf = { name: asset.name, bytes };
    for (const adapter of ADAPTERS) {
      const found = adapter.detect(pf);
      if (found === 'no') continue;
      let password: string | undefined;
      for (let attempt: 'first' | 'wrong' = 'first'; ; attempt = 'wrong') {
        if (found === 'needs_password') {
          password = await o.askPassword(attempt, asset.name);
          if (password === undefined) return { kind: 'cancelled' };
        }
        try {
          const { data, problems } = adapter.decode(pf, password === undefined ? {} : { password });
          const result = await importSanguineData(db, store, data, { sourceApp: adapter.id, today: todayLocal(), clock: deviceClock, noteKey: await getNoteKey() });
          return { kind: 'data', adapter: adapter.id, result, problems, symptoms: [...new Set(data.days.flatMap((d) => d.symptoms?.map((s) => s.code) ?? []))] };
        } catch (e) {
          if (!(e instanceof ZipWrongPassword) || found !== 'needs_password') throw e; // ask again; ponytail: no retry cap, she cancels the sheet
        }
      }
    }
    if (/\.zip$/i.test(asset.name) || asset.mimeType === 'application/zip') return { kind: 'sanguine', result: await importBundle(db, store, bytes) };
    return { kind: 'csv', result: await importPeriodCsv(db, store, await file.text(), todayLocal()) };
  } finally {
    removeTempFile(file);
  }
}
