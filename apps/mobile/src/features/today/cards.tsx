import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import type { FlagCode } from '@sanguine/engine';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Text } from '@/ui/Text';
import type { EstimateModel, FlagCardModel, Msg } from './todayModel';

/** Translates a Msg; `stateKey` params are themselves copy keys (life-state names). */
export function useMsg() {
  const { t } = useTranslation();
  return (m: Msg | undefined): string => {
    if (!m) return '';
    const params = { ...(m.params ?? {}) } as Record<string, string | number>;
    if (typeof params.stateKey === 'string') { params.state = t(params.stateKey); delete params.stateKey; }
    if (m.key === 'today.periodLogged' && typeof params.flow === 'string') params.flow = t(`log.flowLevels.${params.flow}`).toLowerCase();
    return t(m.key, params);
  };
}

export function ConfidenceBadge({ word }: { word: string }) {
  const t = useTheme();
  if (!word) return null;
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: t.chipBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, marginTop: 4 }}>
      <Text variant="caption" color="textSecondary">{word}</Text>
    </View>
  );
}

export function HeadlineCard({ headline, subtitle, confidenceWord }: { headline: string; subtitle?: string; confidenceWord?: string }) {
  return (
    <Card testID="headline-card" accessibilityRole="summary">
      <Text variant="heading" accessibilityRole="header">{headline}</Text>
      {subtitle ? <Text variant="bodySmall" color="textSecondary">{subtitle}</Text> : null}
      {confidenceWord ? <ConfidenceBadge word={confidenceWord} /> : null}
    </Card>
  );
}

/** Ovulation estimate card. The fixed §2.3 sentence is always visible; details expand on tap. */
export function EstimateCard({ m }: { m: EstimateModel }) {
  const { t } = useTranslation();
  const msg = useMsg();
  const [open, setOpen] = useState(m.expanded);
  return (
    <Card testID="estimate-card">
      <Pressable accessibilityRole="button" accessibilityLabel={`${msg(m.title)}. ${open ? t('today.collapseEstimate') : t('today.expandEstimate')}`} aria-expanded={open} onPress={() => setOpen(!open)} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text variant="bodySmall">{msg(m.title)}</Text>
      </Pressable>
      <Text variant="bodySmall" color="textSecondary" testID="estimate-legal">{msg(m.legal)}</Text>
      {open ? (<>
        <Text variant="bodySmall" color="textSecondary">{t(m.basisKey)}</Text>
        <Text variant="caption" color="textSecondary">{t('today.legendFertile')}</Text>
      </>) : null}
    </Card>
  );
}

export function FlagCard({ f, onMute }: { f: FlagCardModel; onMute: (code: FlagCode) => void }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const msg = useMsg();
  const [more, setMore] = useState(false);
  return (
    <Card testID={`flag-${f.code}`} edge={t.c.flag}>
      <Text variant="heading">{tr(f.titleKey)}</Text>
      <Text variant="bodySmall">{msg(f.body)}</Text>
      {f.extraKey ? <Text variant="bodySmall">{tr(f.extraKey)}</Text> : null}
      {more ? <Text variant="bodySmall" color="textSecondary">{`${tr('legal.aboutDisclaimer')} ${tr('flags.doctorLine')}`}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
        <Button kind="text" label={tr('flags.actions.learnMore')} onPress={() => setMore(!more)} testID={`flag-${f.code}-learn`} />
        {f.insightOnly ? null : <Button kind="text" label={tr('flags.actions.mute')} onPress={() => onMute(f.code as FlagCode)} testID={`flag-${f.code}-mute`} />}
      </View>
    </Card>
  );
}
