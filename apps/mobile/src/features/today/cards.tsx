import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, View, type ViewProps } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, RadialGradient, Stop } from 'react-native-svg';
import type { Confidence, FlagCode } from '@sanguine/engine';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EstimateTag } from '@/ui/EstimateTag';
import { GlassSurface } from '@/ui/GlassBar';
import { Meter, confidenceLevel } from '@/ui/Meter';
import { GUTTER } from '@/ui/Screen';
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

/** Hero cards (the dial's estimates) are glass over a faint colour wash on iOS light; elsewhere (dark, Android) opaque, as the frames show. */
export function useHeroGlass(): boolean {
  const t = useTheme();
  return t.isIOS && t.scheme === 'light';
}

const WASH_W = 390;
const WASH_H = 1000;

/** Faint rose, blue and green wash behind the hero, so the glass over it has something to blur (owner exception, D-122). Decorative. */
export function HeroWash() {
  const t = useTheme();
  const blob = (id: string, colour: string, alpha: number, cx: number, cy: number, rx: number, ry: number) => (
    <G key={id}>
      <Defs>
        <RadialGradient id={id}>
          <Stop offset="0" stopColor={colour} stopOpacity={alpha} />
          <Stop offset="0.7" stopColor={colour} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${id})`} />
    </G>
  );
  return (
    <View testID="hero-wash" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', top: 0, left: -GUTTER, right: -GUTTER, height: WASH_H }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${WASH_W} ${WASH_H}`} preserveAspectRatio="none">
        {blob('washRose', t.c.accent, 0.18, 0.12 * WASH_W, 0.1 * WASH_H, 0.7 * WASH_W, 0.3 * WASH_H)}
        {blob('washBlue', t.c.ovulation, 0.12, WASH_W, 0.32 * WASH_H, 0.55 * WASH_W, 0.26 * WASH_H)}
        {blob('washGreen', t.c.fertile, 0.13, 0.2 * WASH_W, 0.62 * WASH_H, 0.7 * WASH_W, 0.28 * WASH_H)}
      </Svg>
    </View>
  );
}

/** A card of the hero: glass where there is a wash behind it, otherwise the opaque Card (ring and two shadows, no border: the same as every other card on the screen). Content on it uses textOnGlass for secondary text. */
export function HeroCard({ children, ...rest }: ViewProps & { children: ReactNode }) {
  const glass = useHeroGlass();
  if (glass) return <GlassSurface flat {...rest}><View style={{ padding: 16, gap: 10 }}>{children}</View></GlassSurface>;
  return <Card {...rest} style={{ gap: 10 }}>{children}</Card>;
}

/** A pill-shaped quiet button for use on glass: label in textOnGlass (accent text fails contrast on glass). */
function GlassLink({ label, accessibilityLabel, expanded, onPress, testID }: { label: string; accessibilityLabel: string; expanded: boolean; onPress: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel} aria-expanded={expanded} onPress={onPress} style={{ minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingRight: 12 }}>
      <Text variant="bodySmall" color="textOnGlass" style={{ fontWeight: '600', textDecorationLine: 'underline' }}>{label}{expanded ? ' ⌃' : ' ⌄'}</Text>
    </Pressable>
  );
}

function ConfidenceMeter({ confidence }: { confidence: Confidence }) {
  const { t } = useTranslation();
  if (confidence === 'none') return null;
  return <Meter level={confidenceLevel(confidence)} word={t(`confidence.${confidence}`)} />;
}

export function HeadlineCard({ headline, subtitle }: { headline: string; subtitle?: string }) {
  return (
    <Card testID="headline-card" accessibilityRole="summary">
      <Text variant="heading" accessibilityRole="header">{headline}</Text>
      {subtitle ? <Text variant="bodySmall" color="textSecondary">{subtitle}</Text> : null}
    </Card>
  );
}

/** One estimate as a hero card: the tag, what it is, the range, and how sure (a meter with its word). */
export function RangeCard({ testID, title, line, confidence }: { testID: string; title: string; line?: string; confidence: Confidence }) {
  const glass = useHeroGlass();
  return (
    <HeroCard testID={testID} accessibilityRole="summary">
      <EstimateTag onGlass={glass} />
      <Text variant="heading" accessibilityRole="header">{title}</Text>
      {line ? <Text variant="bodySmall" color="textOnGlass">{line}</Text> : null}
      <ConfidenceMeter confidence={confidence} />
    </HeroCard>
  );
}

/** Ovulation estimate card. The fixed §2.3 sentence is always visible; the basis expands on tap. */
export function EstimateCard({ m }: { m: EstimateModel }) {
  const { t } = useTranslation();
  const msg = useMsg();
  const glass = useHeroGlass();
  const [open, setOpen] = useState(m.expanded);
  const title = msg(m.title);
  return (
    <HeroCard testID="estimate-card">
      <EstimateTag onGlass={glass} />
      <Text variant="heading" accessibilityRole="header">{title}</Text>
      <ConfidenceMeter confidence={m.confidence} />
      <Text variant="bodySmall" color="textOnGlass" testID="estimate-legal">{msg(m.legal)}</Text>
      {open ? <Text variant="bodySmall" color="textOnGlass">{t(m.basisKey)}</Text> : null}
      <GlassLink testID="estimate-details" label={t(open ? 'today.collapseEstimate' : 'today.expandEstimate')} accessibilityLabel={`${title}. ${t(open ? 'today.collapseEstimate' : 'today.expandEstimate')}`} expanded={open} onPress={() => setOpen(!open)} />
    </HeroCard>
  );
}

/** The paused state's picture: a dashed, empty ring. Decorative; the card under it says why. */
export function PausedRing() {
  const t = useTheme();
  return (
    <View testID="paused-ring" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ alignSelf: 'center' }}>
      <Svg width={220} height={220}><Circle cx={110} cy={110} r={97} stroke={t.c.border} strokeWidth={18} strokeDasharray="4 8" fill="none" /></Svg>
    </View>
  );
}

/** The full food and movement sections in a native page sheet (iOS) or full-screen modal, opened by Read more on Today. */
export function SectionsSheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView testID="guidance-sheet" style={{ flex: 1, backgroundColor: t.screenBg }} contentContainerStyle={{ padding: GUTTER, paddingBottom: 48, gap: 16 }}>
        <View style={{ alignItems: 'flex-end' }}>
          <Button testID="guidance-sheet-close" kind="secondary" label={tr('common.close')} accessibilityLabel={tr('today.closeSheet')} onPress={onClose} />
        </View>
        {children}
      </ScrollView>
    </Modal>
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
