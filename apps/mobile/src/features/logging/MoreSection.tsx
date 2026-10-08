// Temperature, ovulation test, cervical mucus, cervical position, sex and notes (PLAN.md §8.3 "More").
import type { ISODate } from '@sanguine/engine';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, Switch, TextInput, View } from 'react-native';
import type { Database } from '@/data/database';
import type { Prefs } from '@/data/prefs';
import type { EventStore } from '@/data/store';
import { deviceClock } from '@/services/clock';
import { getNoteKey } from '@/services/secrets';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Chips } from '@/ui/Chips';
import { TextField } from '@/ui/TextField';
import { Text } from '@/ui/Text';
import { fromC, saveCervix, saveLh, saveMucus, saveNote, saveTemperature, setSex, toC, type DayState } from './actions';

type Row = 'temperature' | 'lh' | 'mucus' | 'cervix' | 'sex' | 'note';
const SOURCES = ['oral', 'vaginal', 'wrist', 'finger', 'other'] as const;
const LH = ['negative', 'positive', 'high', 'peak', 'indeterminate'] as const;
const MUCUS = ['dry', 'sticky', 'creamy', 'watery', 'eggwhite'] as const;
const nowTime = () => deviceClock.iso().slice(11, 16);

export interface MoreProps {
  day: ISODate;
  store: EventStore;
  db: Database;
  prefs: Prefs;
  state: DayState;
  summaries: Partial<Record<Row, string>>;
  openRow?: Row | undefined;
  onSaved: () => void;
}

export function MoreSection({ day, store, db, prefs, state, summaries, openRow, onSaved }: MoreProps) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const [open, setOpen] = useState<Row | undefined>(openRow);
  useEffect(() => setOpen(openRow), [openRow]);
  const toggle = (r: Row) => setOpen(open === r ? undefined : r);
  const done = () => { setOpen(undefined); onSaved(); };

  const rows: Array<{ id: Row; label: string; show: boolean }> = [
    { id: 'temperature', label: tr('log.temperature'), show: true },
    { id: 'lh', label: tr('log.ovulationTest'), show: true },
    { id: 'mucus', label: tr('log.mucus'), show: true },
    { id: 'cervix', label: tr('log.cervix'), show: true },
    { id: 'sex', label: tr('log.sex'), show: prefs.sexLogging },
    { id: 'note', label: tr('log.note'), show: true },
  ];
  return (
    <View>
      {rows.filter((r) => r.show).map((r) => (
        <View key={r.id} style={{ borderTopWidth: 1, borderTopColor: t.hairline }}>
          <Pressable testID={`more-${r.id}`} accessibilityRole="button" accessibilityLabel={`${r.label}. ${summaries[r.id] ?? tr('log.add')}`} aria-expanded={open === r.id} onPress={() => toggle(r.id)}
            style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Text>{r.label}</Text>
            <Text variant="bodySmall" color={summaries[r.id] ? 'textPrimary' : 'accent'}>{summaries[r.id] ?? tr('log.add')}</Text>
          </Pressable>
          {open === r.id ? (
            <View style={{ paddingBottom: 12, gap: 12 }}>
              {r.id === 'temperature' ? <TemperatureEditor day={day} store={store} db={db} prefs={prefs} onSaved={done} /> : null}
              {r.id === 'lh' ? <Chips testIDPrefix="lh" value={undefined} onChange={(v) => void saveLh(store, day, v).then(done)} options={LH.map((v) => ({ value: v, label: tr(`log.lh.${v}`) }))} /> : null}
              {r.id === 'mucus' ? <Chips testIDPrefix="mucus" value={undefined} onChange={(v) => void saveMucus(store, day, v).then(done)} options={MUCUS.map((v) => ({ value: v, label: tr(`log.mucusLevels.${v}`) }))} /> : null}
              {r.id === 'cervix' ? <CervixEditor day={day} store={store} onSaved={done} /> : null}
              {r.id === 'sex' ? (
                <Chips testIDPrefix="sex" value={state.sex ? (state.sex.protected ? 'yes' : 'no') : undefined} onChange={(v) => void setSex(store, day, v === 'yes').then(done)}
                  options={[{ value: 'yes', label: tr('log.condomYes') }, { value: 'no', label: tr('log.condomNo') }]} />
              ) : null}
              {r.id === 'note' ? <NoteEditor day={day} store={store} onSaved={done} /> : null}
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function TemperatureEditor({ day, store, db, prefs, onSaved }: { day: ISODate; store: EventStore; db: Database; prefs: Prefs; onSaved: () => void }) {
  const { t: tr } = useTranslation();
  const unit = prefs.tempUnit;
  const [text, setText] = useState('');
  const [time, setTime] = useState(nowTime());
  const [source, setSource] = useState<(typeof SOURCES)[number]>(prefs.tempSource);
  const [disturbed, setDisturbed] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const theme = useTheme();

  // prefill with the last value (PLAN.md §8.4)
  useEffect(() => {
    void db.get<{ value: string }>("SELECT value FROM biomarker WHERE type IN ('bbt') ORDER BY day DESC, id DESC LIMIT 1").then((r) => {
      if (r) setText(fromC((JSON.parse(r.value) as { valueC: number }).valueC, unit).toFixed(2));
    });
  }, [db, unit]);

  const wearable = source === 'wrist' || source === 'finger';
  async function save() {
    const v = Number(text.replace(',', '.'));
    const c = toC(v, unit);
    if (!Number.isFinite(v) || text.trim() === '' || c < 30 || c > 45) return setError(tr('log.tempInvalid'));
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return setError(tr('log.timeInvalid'));
    setError(undefined);
    await saveTemperature(store, day, { valueC: c, time: time || undefined, source, disturbed, wearable });
    onSaved();
  }
  return (
    <View style={{ gap: 12 }}>
      <TextField testID="temp-value" label={`${tr('log.temperature')} (°${unit})`} value={text} onChangeText={setText} keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'decimal-pad'} error={error} onSubmit={() => void save()} />
      <TextField testID="temp-time" label={tr('log.timeLabel')} value={time} onChangeText={setTime} keyboardType="default" maxLength={5} onSubmit={() => void save()} />
      <Chips testIDPrefix="temp-source" value={source} onChange={setSource} options={SOURCES.map((s) => ({ value: s, label: tr(`log.temperatureSource.${s}`) }))} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}>
        <Text style={{ flex: 1 }}>{tr('log.disturbed')}</Text>
        <Switch testID="temp-disturbed" accessibilityLabel={tr('log.disturbed')} value={disturbed} onValueChange={setDisturbed} trackColor={{ true: theme.c.accent }} />
      </View>
      <Button testID="temp-save" label={tr('log.save')} onPress={() => void save()} />
    </View>
  );
}

function CervixEditor({ day, store, onSaved }: { day: ISODate; store: EventStore; onSaved: () => void }) {
  const { t: tr } = useTranslation();
  const [v, setV] = useState({ position: 'mid', firmness: 'medium', opening: 'partial' });
  const group = (key: 'position' | 'firmness' | 'opening', values: string[]) => (
    <Chips testIDPrefix={`cervix-${key}`} value={v[key]} onChange={(x) => setV({ ...v, [key]: x })} options={values.map((x) => ({ value: x, label: tr(`log.cervixValues.${key}.${x}`) }))} />
  );
  return (
    <View style={{ gap: 12 }}>
      {group('position', ['low', 'mid', 'high'])}
      {group('firmness', ['firm', 'medium', 'soft'])}
      {group('opening', ['closed', 'partial', 'open'])}
      <Button testID="cervix-save" label={tr('log.save')} onPress={() => void saveCervix(store, day, v).then(onSaved)} />
    </View>
  );
}

function NoteEditor({ day, store, onSaved }: { day: ISODate; store: EventStore; onSaved: () => void }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const [text, setText] = useState('');
  return (
    <View style={{ gap: 12 }}>
      <TextInput
        testID="note-text" accessibilityLabel={tr('log.note')} accessibilityHint={tr('log.noteLocked')} multiline value={text} onChangeText={setText} placeholder={tr('log.notePlaceholder')} placeholderTextColor={t.c.textSecondary}
        style={{ minHeight: 96, borderRadius: t.radius.tile, padding: 12, fontSize: 16, color: t.c.textPrimary, backgroundColor: t.chipBg, textAlignVertical: 'top' }}
      />
      <Text variant="caption" color="textSecondary">{tr('log.noteLocked')}</Text>
      <Button testID="note-save" label={tr('log.save')} disabled={text.trim() === ''} onPress={() => void (async () => { await saveNote(store, day, text.trim(), await getNoteKey(), deviceClock); onSaved(); })()} />
    </View>
  );
}
