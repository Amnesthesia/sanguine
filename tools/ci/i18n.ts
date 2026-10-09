// Translation pipeline (PLAN.md §6.4): export the source strings for translators, validate what comes back, write copy/<locale>.json.
// No machine translation: this tool only moves text and checks it.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
export const CSV_PATH = join(ROOT, 'docs', 'i18n', 'strings-for-translation.csv');
/** Rows covered by the regulatory wording table or the health-flag rules: translators may not paraphrase them, and a clinician checks them. */
export const REGULATORY_PREFIXES = ['legal.', 'flags.', 'onboarding.s1.body'];
/** Locales the source tree is translated into with a full file; en-GB and en-US are sparse overrides and need no review rows. */
export const TRANSLATED_LOCALES = ['de', 'fr', 'es', 'pt-BR'] as const;

type Tree = { [k: string]: Tree | string | Tree[] | string[] };
const readJson = (f: string) => JSON.parse(readFileSync(join(ROOT, 'copy', f), 'utf8')) as Tree;

/** The same tree the app loads for en-AU (apps/mobile/src/i18n/index.ts); a test keeps the two equal. */
export function sourceTree(): Tree {
  const symptoms = readJson('symptoms.json') as unknown as { symptoms: Array<{ code: string; label: string }> };
  return { ...readJson('en-AU.json'), legal: readJson('legal.en-AU.json'), flags: readJson('flags.en-AU.json'), symptom: Object.fromEntries(symptoms.symptoms.map((s) => [s.code, s.label])) };
}

export function flatten(node: unknown, path = ''): Array<[string, string]> {
  if (typeof node === 'string') return node === '' ? [] : [[path, node]]; // an empty source string has nothing to translate
  if (Array.isArray(node)) return node.flatMap((v, i) => flatten(v, `${path}.${i}`));
  if (node && typeof node === 'object') return Object.entries(node).flatMap(([k, v]) => (k.startsWith('_') ? [] : flatten(v, path ? `${path}.${k}` : k)));
  return [];
}

export function unflatten(rows: Array<[string, string]>): Tree {
  const root: Record<string, unknown> = {};
  for (const [key, text] of rows) {
    const parts = key.split('.');
    let cur = root;
    parts.forEach((p, i) => {
      if (i === parts.length - 1) cur[p] = text;
      else {
        cur[p] ??= {};
        cur = cur[p] as Record<string, unknown>;
      }
    });
  }
  const arrays = (n: unknown): unknown => {
    if (!n || typeof n !== 'object') return n;
    const entries = Object.entries(n as Record<string, unknown>).map(([k, v]) => [k, arrays(v)] as const);
    return entries.length > 0 && entries.every(([k], i) => k === String(i)) ? entries.map(([, v]) => v) : Object.fromEntries(entries);
  };
  return arrays(root) as Tree;
}

export interface Row { key: string; text: string; regulatory: boolean; context: string }
export const isRegulatory = (key: string) => REGULATORY_PREFIXES.some((p) => key.startsWith(p));
export const extractRows = (): Row[] => flatten(sourceTree()).map(([key, text]) => ({ key, text, regulatory: isRegulatory(key), context: key.split('.')[0] ?? '' }));

const q = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
export const toCsv = (rows: Array<Record<string, string>>, cols: string[]): string => `${[cols, ...rows.map((r) => cols.map((c) => r[c] ?? ''))].map((r) => r.map(q).join(',')).join('\n')}\n`;
export function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  const [head = [], ...body] = rows.filter((r) => r.some((c) => c !== ''));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

export const renderSourceCsv = (): string => toCsv(extractRows().map((r) => ({ key: r.key, en_AU: r.text, regulatory: r.regulatory ? 'yes' : 'no', context: r.context, translation: '' })), ['key', 'en_AU', 'regulatory', 'context', 'translation']);

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
/** Problems with a returned translation (empty list = accepted). */
export function validateTranslation(returned: Array<{ key: string; translation: string }>): string[] {
  const src = new Map(flatten(sourceTree()));
  const errs: string[] = [];
  const seen = new Set<string>();
  for (const { key, translation } of returned) {
    const en = src.get(key);
    if (en === undefined) { errs.push(`${key}: not a key of the source`); continue; }
    seen.add(key);
    if (translation.trim() === '') errs.push(`${key}: empty`);
    else {
      if (placeholders(translation) !== placeholders(en)) errs.push(`${key}: placeholders {${placeholders(translation)}} differ from {${placeholders(en)}}`);
      if (translation.length > en.length * 1.5 + 10) errs.push(`${key}: longer than 150% of the source (${translation.length} vs ${en.length})`);
    }
  }
  for (const k of src.keys()) if (!seen.has(k)) errs.push(`${k}: missing`);
  return errs;
}

if (require.main === module) {
  const [cmd, locale, file] = process.argv.slice(2);
  if (cmd === 'extract') { writeFileSync(CSV_PATH, renderSourceCsv()); console.log(`wrote ${CSV_PATH}`); }
  else if (cmd === 'import' && locale && file) {
    const rows = parseCsv(readFileSync(file, 'utf8')).map((r) => ({ key: r.key ?? '', translation: r.translation ?? '' }));
    const errs = validateTranslation(rows);
    if (errs.length > 0) { console.error(errs.join('\n')); process.exit(1); }
    writeFileSync(join(ROOT, 'copy', `${locale}.json`), `${JSON.stringify(unflatten(rows.map((r) => [r.key, r.translation])), null, 2)}\n`);
    console.log(`wrote copy/${locale}.json`);
  } else { console.error('usage: tsx tools/ci/i18n.ts extract | import <locale> <csv>'); process.exit(2); }
}
