// Food, movement and supplement sections (P8-22, D-120): the designed form of GuidanceCard. Full (Insights > This cycle, D-134) = "What is changing"
// with a picture, one card per food note and the movement note with an evidence bar and its reason, supplements (when allowed) and the evidence key;
// the numbered sources and the caveat close the This cycle page, after the estimate sources. Compact = two tiles with their evidence bars and,
// on Today, a Read more button. All wording is existing guidance.* copy except the evidence key (D-120).
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Meter, evidenceLevel } from '@/ui/Meter';
import { Text } from '@/ui/Text';
import { type Evidence, GUIDANCE, type GuideDay } from '../guidance';
import { HormoneCurve } from './HormoneCurve';

const GRADES: readonly Evidence[] = ['strong', 'some', 'early', 'general'];

function EvidenceMeter({ evidence }: { evidence: Evidence }) {
  const { t } = useTranslation();
  // the visible word stays short; the screen reader gets the phrase ("Some evidence"), not a bare "Some"
  return <View accessible accessibilityLabel={t(`guidance.evidence.${evidence}`)}><Meter level={evidenceLevel(evidence)} word={t(`guidance.evidenceKey.${evidence}.word`)} /></View>;
}

/** The reason in a tinted panel, under the note's tip. */
function Panel({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <View style={{ borderRadius: 16, backgroundColor: t.chipBg, padding: 12 }}>{children}</View>;
}

function NoteCard({ testID, title, evidence, tip, why }: { testID: string; title?: string; evidence: Evidence; tip: string; why: string }) {
  return (
    <Card testID={testID} style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {title ? <Text variant="heading" accessibilityRole="header" style={{ flexShrink: 1 }}>{title}</Text> : null}
        <EvidenceMeter evidence={evidence} />
      </View>
      <Text>{tip}</Text>
      <Panel><Text variant="bodySmall">{why}</Text></Panel>
    </Card>
  );
}

function Tile({ label, text, evidence }: { label: string; text: string; evidence: Evidence }) {
  const t = useTheme();
  return (
    <View testID="guidance-tile" style={{ flexGrow: 1, flexBasis: 150, gap: 6, borderRadius: t.radius.tile, backgroundColor: t.chipBg, padding: 12 }}>
      <Text variant="bodySmall" style={{ fontWeight: '600' }}>{label}</Text>
      <Text variant="bodySmall">{text}</Text>
      <EvidenceMeter evidence={evidence} />
    </View>
  );
}

const best = (grades: readonly Evidence[]): Evidence => grades.reduce((a, b) => (evidenceLevel(b) > evidenceLevel(a) ? b : a), 'general' as Evidence);

/** The per-phase source line is one sentence per reference; sections.test.tsx pins the count for every phase so an abbreviation ("Int. J.") cannot split one silently. */
export const splitSources = (line: string): string[] => line.split(/\.\s+/).map((s) => (s.endsWith('.') ? s : `${s}.`));

/** The phase's first sentence: the sheet's short phase line under the compact curve. */
const firstSentence = (s: string): string => s.match(/^.*?\.(?=\s|$)/)?.[0] ?? s;

/** "What is changing": the hormone curve and the phase's body copy. `compact` (the day sheet): the short curve, the phase on the right and one sentence. */
export function BodyCard({ day, compact = false, extras = false }: { day: GuideDay; compact?: boolean; extras?: boolean }) {
  const { t } = useTranslation();
  const p = day.phase;
  const body = t(`guidance.${p}.body`);
  return (
    <Card testID={compact ? 'guidance-body-compact' : 'guidance-body'} style={{ gap: compact ? 8 : 12 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <Text variant="heading" accessibilityRole="header">{t('guidance.bodyLabel')}</Text>
        {compact ? <Text variant="caption" color="textSecondary">{t(day.expected ? 'guidance.phaseExpected' : 'guidance.phaseLine', { phase: t(`guidance.phase.${p}`) })}</Text> : null}
      </View>
      <HormoneCurve day={day} compact={compact} extras={extras} />
      <Text variant={compact ? 'bodySmall' : 'body'}>{compact ? firstSentence(body) : body}</Text>
    </Card>
  );
}

/** Compact is a summary; its Read more button (Today) must say where it goes. Without `onMore` the caller places its own link (the day screen). */
/** `extras`: draw LH, FSH and temperature on the curve (only while the ovulation estimate is shown, D-155). */
type Props = { day: GuideDay; supplements: boolean; extras?: boolean } & ({ compact: true; onMore?: () => void } | { compact: false; onMore?: never });

export function GuidanceSections({ day, supplements, extras = false, compact, onMore }: Props) {
  const { t } = useTranslation();
  const p = day.phase;
  const g = GUIDANCE[p];
  const phase = t(day.expected ? 'guidance.phaseExpected' : 'guidance.phaseLine', { phase: t(`guidance.phase.${p}`) });

  if (compact) {
    return (
      <View testID="guidance-sections-compact" style={{ gap: 12 }}>
        <Card style={{ gap: 12 }}>
          <View style={{ gap: 2 }}>
            <Text variant="heading" accessibilityRole="header">{t('guidance.title')}</Text>
            <Text variant="caption" color="textSecondary" testID={`guidance-phase-${p}`}>{phase}</Text>
          </View>
          <HormoneCurve day={day} compact extras={extras} />
        </Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Tile label={t('guidance.foodLabel')} text={t(`guidance.summary.${p}.food`)} evidence={best(g.foods.map((f) => f.evidence))} />
          <Tile label={t('guidance.moveLabel')} text={t(`guidance.summary.${p}.move`)} evidence={g.move} />
        </View>
        {onMore ? <Button kind="text" testID="guidance-more" label={t('guidance.readMore')} accessibilityLabel={t('guidance.moreA11y')} onPress={onMore} /> : null}
      </View>
    );
  }

  const supps = supplements ? g.supps : [];
  return (
    <View testID="guidance-sections" style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <Text variant="title" accessibilityRole="header">{t('guidance.title')}</Text>
        <Text variant="caption" color="textSecondary" testID={`guidance-phase-${p}`}>{phase}</Text>
      </View>

      <BodyCard day={day} extras={extras} />

      {g.foods.map((f) => <NoteCard key={f.id} testID={`guidance-food-${f.id}`} title={t(`guidance.foodName.${f.id}`)} evidence={f.evidence} tip={t(`guidance.food.${f.id}.tip`)} why={t(`guidance.food.${f.id}.why`)} />)}
      <NoteCard testID="guidance-move-note" title={t('guidance.moveLabel')} evidence={g.move} tip={t(`guidance.${p}.move.tip`)} why={t(`guidance.${p}.move.why`)} />

      {supps.length ? (
        <Card testID="guidance-supps" style={{ gap: 12 }}>
          <Text variant="heading" accessibilityRole="header">{t('guidance.suppLabel')}</Text>
          {supps.map((s) => (
            <View key={s.id} testID={`guidance-supp-${s.id}`} style={{ gap: 6 }}>
              <Text style={{ fontWeight: '600' }}>{t(`guidance.supp.${s.id}.tip`)}</Text>
              <EvidenceMeter evidence={s.evidence} />
              <Text variant="bodySmall" color="textSecondary">{t(`guidance.supp.${s.id}.why`)}</Text>
            </View>
          ))}
          <Text variant="caption" color="textSecondary">{t('guidance.suppCaveat')}</Text>
        </Card>
      ) : null}

      <Card testID="guidance-evidence-key" style={{ gap: 10 }}>
        <Text variant="heading" accessibilityRole="header">{t('guidance.evidenceKey.title')}</Text>
        {GRADES.map((e) => (
          <View key={e} testID={`evidence-key-${e}`} style={{ gap: 4 }}>
            <EvidenceMeter evidence={e} />
            <Text variant="bodySmall">{t(`guidance.evidenceKey.${e}.def`)}</Text>
          </View>
        ))}
        <Text variant="caption" color="textSecondary">{t('guidance.evidenceKey.note')}</Text>
      </Card>
    </View>
  );
}
