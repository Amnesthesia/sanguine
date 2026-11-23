// The import run shared by Settings > Privacy and the Import from Clue guide: pick, ask for a password if the file needs one, import,
// switch on the symptoms the file used, and say what happened. One place, so both screens show the same result.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ZipUnsupported } from '@/data/adapters/zipCrypto';
import { pickAndImport } from '@/services/exportImport';
import { useApp } from '@/state/app';
import { importParts, newSymptoms, type ImportParts } from './importMessage';
import { usePasswordPrompt } from './PasswordSheet';

export type ImportOutcome = { kind: 'done'; parts: ImportParts } | { kind: 'failed'; text: string } | { kind: 'cannotOpen' };

export function useImport() {
  const { t } = useTranslation();
  const { db, store, prefs, updatePrefs, refresh } = useApp();
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<ImportOutcome | undefined>();
  const pw = usePasswordPrompt();

  async function start() {
    if (busy || !db || !store) return;
    setBusy(true);
    setOutcome(undefined);
    try {
      const r = await pickAndImport(db, store, { askPassword: pw.ask });
      if (r.kind === 'cancelled') return;
      await refresh();
      const on = newSymptoms(r, prefs.symptoms);
      if (on.length > 0) await updatePrefs({ symptoms: [...new Set([...prefs.symptoms, ...on])] });
      setOutcome({ kind: 'done', parts: importParts(t, r, on) });
    } catch (e) {
      // the message never carries the password: errors come from the zip reader, which does not include it
      setOutcome(e instanceof ZipUnsupported ? { kind: 'cannotOpen' } : { kind: 'failed', text: `${t('settings.privacy.importFailed')} ${(e as Error).message}` });
    } finally {
      pw.close();
      setBusy(false);
    }
  }
  return { start, busy, outcome, reset: () => setOutcome(undefined), sheet: pw.sheet, ready: Boolean(db && store) };
}
