// What an import tells her, shared by Settings > Privacy and the Import from Clue guide (one wording, one place).
import type { PickedImport } from '@/services/exportImport';

export type DoneImport = Exclude<PickedImport, { kind: 'cancelled' }>;
type Tr = (key: string, o?: Record<string, unknown>) => string;

export interface ImportParts {
  /** Paragraphs: the count (with dropped notes), days her own entry was kept, symptoms switched on. */
  paras: string[];
  /** Why some rows were not imported: the first five. */
  problems: string[];
  /** "and N more." when there were more than five, else undefined. */
  more: string | undefined;
}

/** Symptom codes the file used that are not yet switched on in Tracking (imported symptoms must also show in the logging sheet). */
export const newSymptoms = (r: DoneImport, current: string[]): string[] => (r.kind === 'data' ? r.symptoms.filter((c) => !current.includes(c)) : []);

export function importParts(t: Tr, r: DoneImport, switchedOn: string[]): ImportParts {
  const data = r.kind === 'data' ? r : undefined;
  const added = r.kind === 'sanguine' ? r.result.imported : r.result.added;
  const paras = [t('settings.privacy.importDone', { n: added }) + (data && data.result.notesDropped > 0 ? ` ${t('settings.privacy.importNotesDropped', { n: data.result.notesDropped })}` : '')];
  if (data && data.result.kept > 0) paras.push(t('settings.privacy.importKept', { count: data.result.kept, n: data.result.kept }));
  if (switchedOn.length > 0) paras.push(t('settings.privacy.importSymptomsOn', { list: switchedOn.map((c) => t(`symptom.${c}`).toLowerCase()).join(', ') }));
  const problems = data?.problems ?? [];
  return { paras, problems: problems.slice(0, 5), more: problems.length > 5 ? t('settings.privacy.importMore', { n: problems.length - 5 }) : undefined };
}

/** The same parts as one string, for the Privacy panel. */
export function importText(t: Tr, p: ImportParts): string {
  const skipped = p.problems.length > 0 ? [`${t('settings.privacy.importSkipped')} ${p.problems.join('; ')}${p.more ? ` ${p.more}` : ''}`] : [];
  return [...p.paras, ...skipped].join('\n');
}
