// Food, movement and supplement sections (P8-22, D-120): the designed form of GuidanceCard. Full = "What is changing" with a picture, one card per
// food note and the movement note with an evidence bar and its reason, supplements (when allowed), the evidence key and numbered sources.
// Compact = two tiles with their evidence bars and a Read more button. All wording is existing guidance.* copy except the evidence key (D-120).
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Meter, evidenceLevel } from '@/ui/Meter';
import { Sources } from '@/ui/Sources';
import { Text } from '@/ui/Text';
import { type Evidence, GUIDANCE, type GuideDay } from '../guidance';
import { HormoneCurve } from './HormoneCurve';

const GRADES: readonly Evidence[] = ['strong', 'some', 'early', 'general'];

function EvidenceMeter({ evidence }: { evidence: Evidence }) {
  const { t } = useTranslation();
  return <Meter level={evidenceLevel(evidence)} word={t(`guidance.evidenceKey.${evidence}.word`)} />;
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

export function GuidanceSections({ day, supplements, compact, onMore }: { day: GuideDay; supplements: boolean; compact: boolean; onMore?: () => void }) {
  const { t } = useTranslation();
  const p = day.phase;
  const g = GUIDANCE[p];
  const phase = t(day.expected ? 'guidance.phaseExpected' : 'guidance.phaseLine', { phase: t(`guidance.phase.${p}`) });

  if (compact) {
    return (
      <View testID="guidance-sections-compact" style={{ gap: 12 }}>
        <View style={{ gap: 2 }}>
          <Text variant="heading" accessibilityRole="header">{t('guidance.title')}</Text>
          <Text variant="caption" color="textSecondary" testID={`guidance-phase-${p}`}>{phase}</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Tile label={t('guidance.foodLabel')} text={t(`guidance.summary.${p}.food`)} evidence={best(g.foods.map((f) => f.evidence))} />
          <Tile label={t('guidance.moveLabel')} text={t(`guidance.summary.${p}.move`)} evidence={g.move} />
        </View>
        <Button kind="text" testID="guidance-more" label={t('guidance.readMore')} accessibilityLabel={t('guidance.moreA11y')} onPress={onMore} />
      </View>
    );
  }

  const supps = supplements ? g.supps : [];
  // the per-phase source line is one sentence per reference
  const sources = t(`guidance.${p}.sources`).split(/\.\s+/).map((s) => (s.endsWith('.') ? s : `${s}.`));
  return (
    <View testID="guidance-sections" style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <Text variant="title" accessibilityRole="header">{t('guidance.title')}</Text>
        <Text variant="caption" color="textSecondary" testID={`guidance-phase-${p}`}>{phase}</Text>
      </View>

      <Card testID="guidance-body" style={{ gap: 12 }}>
        <Text variant="heading" accessibilityRole="header">{t('guidance.bodyLabel')}</Text>
        <HormoneCurve day={day} />
        <Text>{t(`guidance.${p}.body`)}</Text>
      </Card>

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

      <View testID="guidance-sources" style={{ gap: 8 }}>
        <Text variant="heading" accessibilityRole="header">{t('guidance.sourcesLabel')}</Text>
        <Sources items={sources} />
        <Text variant="caption" color="textSecondary">{t('guidance.caveat')}</Text>
      </View>
    </View>
  );
}
