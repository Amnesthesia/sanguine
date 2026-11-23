// Clue "Download my data" export (P5-1, D-160): the zip is ZipCrypto-encrypted; only `measurements.json` in it is ever read.
// Shapes checked against a real export and cycle-export-visualizer's sample generator; the mapping table with each row's source is in D-160.
// Anything the table does not map is counted and reported, never guessed. Adapter of the day-based format (D-159).
import { strFromU8 } from 'fflate';
import type { ISODate } from '@sanguine/engine';
import { emptyData, type Day, type Mucus } from '../format/sanguineData';
import { celsius } from './naturalCycles';
import type { FormatAdapter, PickedFile } from './types';
import { listZip, readZipEntry } from './zipCrypto';

const FILE = 'measurements.json';
// Every type seen in a real export or in the visualizer's generator (known and mapped, or known and reported by name).
const KNOWN_TYPES = new Set(['period', 'spotting', 'pain', 'feelings', 'energy', 'pms', 'sex_life', 'sleep_duration', 'discharge', 'bbt', 'notes', 'tags', 'digestion', 'skin', 'craving', 'mind', 'sleep_quality', 'tests', 'weight', 'medication', 'birth_control', 'appointments', 'ailments', 'collection_method']);
// The other files of the download (profile, consents, ...). They are never read; naming one only earns a hint.
const SIBLING_KEYS = new Set(['profileData', 'createdAt', 'updatedAt', 'Consents', 'Notifications', 'Balances', 'Transactions', 'Purchases', 'Token', 'email']);

const FLOW = new Map<string, 'light' | 'medium' | 'heavy'>([['light', 'light'], ['medium', 'medium'], ['heavy', 'heavy'], ['very_heavy', 'heavy']]);
const RANK = { light: 1, medium: 2, heavy: 3 } as const;
const SEVERITY = new Map([['mild', 1], ['moderate', 2], ['severe', 3]] as const);
// type -> option -> symptom code. `null`: known option with no Sanguine symptom (counted). Silent options are in SILENT.
const SYMPTOM = new Map<string, Map<string, string | null>>([
  ['pain', new Map([['period_cramps', 'cramps'], ['headache', 'headache'], ['migraine', 'headache'], ['migraine_with_aura', 'headache'], ['breast_tenderness', 'breast_tenderness'], ['lower_back', 'back_pain'], ['ovulation', 'mid_cycle_pain']])],
  ['feelings', new Map<string, string | null>([['happy', 'happy'], ['sad', 'mood_low'], ['sensitive', 'sensitive'], ['mood_swings', 'mood_swings'], ['angry', 'irritability'], ['irritable', 'irritability'], ['anxious', 'anxiety'], ['confident', 'confident'], ['excited', 'excited'], ['not_in_control', 'not_in_control'], ['insecure', 'insecure'], ['grateful', 'grateful'], ['indifferent', 'indifferent'], ['fine', null]])],
  ['energy', new Map<string, string | null>([['exhausted', 'fatigue'], ['tired', 'fatigue'], ['low_energy', 'fatigue'], ['energetic', 'energetic'], ['fully_energized', 'energetic'], ['ok', null]])],
  ['pms', new Map([['yes', 'pms']])],
  ['digestion', new Map([['bloated', 'bloating'], ['nauseous', 'nausea'], ['nauseated', 'nausea'], ['constipated', 'constipation'], ['diarrhea', 'diarrhoea']])],
  ['skin', new Map([['acne', 'acne'], ['oily', 'oily_skin']])],
  ['mind', new Map([['stressed', 'stressed'], ['distracted', 'unfocused'], ['brain_fog', 'unfocused']])],
  ['sleep_quality', new Map([['trouble_falling_asleep', 'insomnia'], ['night_sweats', 'night_sweats']])],
]);
const SEX_LIFE = new Map<string, string | null>([['painful_intercourse', 'painful_sex'], ['high_sex_drive', 'high_libido'], ['low_sex_drive', 'low_libido']]);
const PARTNERED = new Set(['protected', 'unprotected', 'withdrawal']);
const SILENT = new Map([['period', 'none'], ['pain', 'pain_free'], ['sex_life', 'no_sex_today']]); // a negative assertion says nothing
const MUCUS = new Map<string, Mucus>([['egg_white', 'eggwhite'], ['watery', 'watery'], ['creamy', 'creamy'], ['sticky', 'sticky']]);
const MUCUS_ORDER: Mucus[] = ['sticky', 'creamy', 'watery', 'eggwhite'];

/** Every code the mapping can emit, for the catalogue test. */
export const CLUE_SYMPTOM_CODES: string[] = [...new Set([...[...SYMPTOM.values()].flatMap((m) => [...m.values()]), ...SEX_LIFE.values()].filter((c): c is string => !!c))];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
type Opt = { option: string; severity?: number };
/** `{option}` or a list of `{option}` as a list; undefined when the value is neither. */
function optionsOf(value: unknown): Opt[] | undefined {
  const one = (v: unknown): Opt | undefined => {
    if (!isObj(v) || typeof v.option !== 'string') return undefined;
    const sev = isObj(v.extent) && typeof v.extent.severity === 'string' ? SEVERITY.get(v.extent.severity as 'mild') : undefined;
    return { option: v.option, ...(sev ? { severity: sev } : {}) };
  };
  if (Array.isArray(value)) {
    const all = value.map(one);
    return all.every((o) => o) ? (all as Opt[]) : undefined;
  }
  const o = one(value);
  return o ? [o] : undefined;
}
const asDate = (v: unknown): ISODate | undefined => {
  if (typeof v !== 'string') return undefined;
  const d = /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(v) ? v.slice(0, 10) : '';
  const t = Date.parse(`${d}T00:00:00Z`);
  return d && !Number.isNaN(t) && new Date(t).toISOString().startsWith(d) ? (d as ISODate) : undefined;
};

interface Acc { period?: number; spotting?: boolean; symptoms: Map<string, number>; partnered: string[]; mucus?: Mucus; temps: NonNullable<Day['temperatures']>; notes: string[]; tags: string[] }

export function parseClue(records: unknown[]): { days: Day[]; problems: string[] } {
  const problems: string[] = [];
  const unmapped = new Map<string, number>();
  const count = (k: string) => unmapped.set(k, (unmapped.get(k) ?? 0) + 1);
  const accs = new Map<ISODate, Acc>();
  records.forEach((rec, i) => {
    const where = `record ${i + 1}`;
    if (!isObj(rec) || typeof rec.type !== 'string') { problems.push(`${where}: not a measurement`); return; }
    const date = asDate(rec.date);
    if (!date) { problems.push(`${where}: date is not YYYY-MM-DD`); return; }
    const type = rec.type;
    const opts = optionsOf(rec.value);
    const bad = (why = 'value not recognised') => problems.push(`${where} (${type}): ${why}`);
    const acc = (): Acc => {
      let x = accs.get(date);
      if (!x) accs.set(date, (x = { symptoms: new Map(), partnered: [], temps: [], notes: [], tags: [] }));
      return x;
    };
    const symptom = (code: string, intensity?: number) => { const m = acc().symptoms; m.set(code, Math.max(m.get(code) ?? 0, intensity ?? 1)); };

    if (type === 'bbt') {
      const v = rec.value;
      const raw = isObj(v) ? (typeof v.celsius === 'number' ? v.celsius : typeof v.fahrenheit === 'number' ? v.fahrenheit : undefined) : undefined;
      if (raw === undefined) return bad();
      const c = celsius(raw);
      if (c === undefined) return bad('temperature is out of range');
      acc().temps.push({ valueC: c, type: 'bbt', source: 'oral', ...(isObj(v) && v.excluded === true ? { disturbed: true } : {}) });
      return;
    }
    if (type === 'notes') {
      if (!isObj(rec.value) || typeof rec.value.text !== 'string') return bad();
      if (rec.value.text.trim() !== '') acc().notes.push(rec.value.text);
      return;
    }
    if (type === 'period' || type === 'spotting' || SYMPTOM.has(type) || type === 'sex_life' || type === 'discharge' || type === 'tags' || type === 'craving') {
      if (!opts) return bad();
      for (const { option, severity } of opts) {
        if (SILENT.get(type) === option) continue;
        if (type === 'period') {
          const l = FLOW.get(option);
          if (l) acc().period = Math.max(acc().period ?? 0, RANK[l]); else count(`period:${option}`);
        } else if (type === 'spotting') acc().spotting = true;
        else if (type === 'craving') symptom('food_cravings');
        else if (type === 'tags') acc().tags.push(option);
        else if (type === 'discharge') {
          const q = MUCUS.get(option);
          if (!q) count(`discharge:${option}`);
          else if (MUCUS_ORDER.indexOf(q) > MUCUS_ORDER.indexOf(acc().mucus ?? 'dry')) acc().mucus = q;
        } else if (type === 'sex_life') {
          if (PARTNERED.has(option)) acc().partnered.push(option);
          else if (SEX_LIFE.get(option)) symptom(SEX_LIFE.get(option)!);
          else count(`sex_life:${option}`);
        } else {
          const code = SYMPTOM.get(type)!.get(option);
          if (code) symptom(code, type === 'pain' ? severity : undefined); else count(`${type}:${option}`);
        }
      }
      return;
    }
    // Known or unknown, but not mapped: reported by name so a later export can pin it.
    if (opts) for (const { option } of opts) count(`${type}:${option}`); else count(type);
  });

  const days: Day[] = [...accs.entries()].sort(([x], [y]) => (x < y ? -1 : 1)).flatMap(([date, a]) => {
    const d: Day = { date };
    const level = a.period ? (['light', 'medium', 'heavy'] as const)[a.period - 1] : a.spotting ? 'spotting' : undefined;
    if (level) d.flow = { level };
    if (a.temps.length) d.temperatures = a.temps;
    if (a.mucus) d.mucus = { quality: a.mucus };
    if (a.partnered.length) d.sex = { protected: a.partnered.every((o) => o === 'protected') }; // withdrawal counts as unprotected (D-078: a condom was used)
    if (a.symptoms.size) d.symptoms = [...a.symptoms].map(([code, n]) => ({ code, ...(n > 1 ? { intensity: n as 2 | 3 } : {}) }));
    const note = [...a.notes, ...(a.tags.length ? [`Tags: ${a.tags.join(', ')}`] : [])].join('\n\n');
    if (note) d.note = note;
    return Object.keys(d).length > 1 ? [d] : [];
  });
  if (unmapped.size > 0) problems.push(`not imported: ${[...unmapped].sort(([x], [y]) => (x < y ? -1 : 1)).map(([k, n]) => `${k} ×${n}`).join(', ')}`);
  return { days, problems };
}

const isZip = (f: PickedFile) => f.bytes[0] === 0x50 && f.bytes[1] === 0x4b;
const measurements = (bytes: Uint8Array) => listZip(bytes).find((e) => e.name.split('/').pop() === FILE);
const json = (f: PickedFile): unknown => { try { return JSON.parse(strFromU8(f.bytes)); } catch { return undefined; } };
const isSibling = (v: unknown) => isObj(v) && Object.keys(v).length > 0 && Object.keys(v).every((k) => SIBLING_KEYS.has(k));
const isMeasurements = (v: unknown) => Array.isArray(v) && v.every(isObj) && v.every((r) => typeof (r as Record<string, unknown>).type === 'string' && typeof (r as Record<string, unknown>).date === 'string' && 'value' in (r as object)) && v.some((r) => KNOWN_TYPES.has((r as Record<string, unknown>).type as string));

export const clue: FormatAdapter = {
  id: 'clue',
  detect(f) {
    if (isZip(f)) {
      try {
        const e = measurements(f.bytes);
        return e ? (e.encrypted ? 'needs_password' : 'yes') : 'no';
      } catch { return 'no'; }
    }
    const v = json(f);
    return isMeasurements(v) || isSibling(v) ? 'yes' : 'no';
  },
  decode(f, { password }) {
    let parsed: unknown;
    if (isZip(f)) {
      const e = measurements(f.bytes);
      if (!e) throw new Error(`no ${FILE} in the zip`);
      parsed = JSON.parse(strFromU8(readZipEntry(f.bytes, e, password))); // only this entry is ever read
    } else {
      parsed = json(f);
      if (isSibling(parsed)) return { data: emptyData('clue'), problems: [`Choose ${FILE} from the Clue folder`] };
    }
    if (!Array.isArray(parsed)) throw new Error('not a Clue measurements file');
    const { days, problems } = parseClue(parsed);
    return { data: { ...emptyData('clue'), days }, problems };
  },
};
