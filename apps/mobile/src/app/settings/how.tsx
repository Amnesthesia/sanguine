// How Sanguine estimates (P8-3, roadmap R2-6): fixed reference text, not an article feed (PLAN.md §8.1). Under 18, until the
// fertility tools are unlocked, the sentence about dating ovulation is replaced by one without fertility terms (§8.6), the
// signal chips show only the period start, and the drawing's label and the sources drop the fertility wording. Each section has
// a small drawing with sample numbers (frame Settings-How); every drawing is one image for a screen reader, with a text label.
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import about from '../../../../../copy/about.en-AU.json';
import { effectivePrefs } from '@/data/prefs';
import { useApp } from '@/state/app';
import { useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Meter } from '@/ui/Meter';
import { Cite } from '@/ui/Sources';
import { SubScreen } from '@/ui/SubScreen';
import { Text } from '@/ui/Text';

const HIDDEN = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const;
/** A 6-digit hex colour with an opacity (the range drawings tint the period colour). */
const tint = (hex: string, a: number) => `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}`;
const pct = (n: number) => `${n}%` as const;

/** A static label chip (a drawing of a signal, not a control). */
function Tag({ label, dot }: { label: string; dot?: string }) {
  const t = useTheme();
  return (
    <View style={{ minHeight: 32, paddingHorizontal: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.cardBg }}>
      {dot ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot }} /> : null}
      <Text variant="bodySmall">{label}</Text>
    </View>
  );
}

/** The grey panel a drawing sits on; `label` makes it one image for a screen reader and hides what is drawn inside. */
function Panel({ testID, label, children, note }: { testID?: string; label: string; children: ReactNode; note?: string }) {
  const t = useTheme();
  return (
    <View style={{ borderRadius: 16, backgroundColor: t.chipBg, padding: 12, gap: 8 }}>
      <View testID={testID} accessible accessibilityRole="image" accessibilityLabel={label}>
        <View {...HIDDEN} style={{ gap: 8 }}>{children}</View>
      </View>
      {note ? <Text variant="caption" color="textSecondary">{note}</Text> : null}
    </View>
  );
}

/** One section: a numbered badge and heading, then its drawing and text. */
function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View {...HIDDEN} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: t.c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="bodySmall" color="onAccentSoft" style={{ fontWeight: '700' }}>{n}</Text>
        </View>
        <Text variant="heading" accessibilityRole="header" style={{ flex: 1, fontSize: 17, lineHeight: 22 }}>{title}</Text>
      </View>
      {children}
    </Card>
  );
}

/** Published averages on the left, her own pattern on the right, a marker for where two logged cycles puts her (of up to 12). */
function BlendBar() {
  const { t: tr } = useTranslation();
  const t = useTheme();
  const small = { fontSize: 11, lineHeight: 15 } as const;
  return (
    <Panel testID="how-blend" label={tr('settings.how.draw.blendLabel')} note={tr('settings.how.draw.sampleNote')}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Text variant="caption" style={{ fontWeight: '600', flexShrink: 1 }}>{tr('settings.how.draw.blendLeft')}</Text>
        <Text variant="caption" style={{ fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>{tr('settings.how.draw.blendRight')}</Text>
      </View>
      <View style={{ height: 22, justifyContent: 'center' }}>
        <Svg width="100%" height={8}>
          <Defs><LinearGradient id="blend" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor={t.c.border} /><Stop offset="1" stopColor={t.c.period} /></LinearGradient></Defs>
          <Rect x={0} y={0} width="100%" height={8} rx={4} fill="url(#blend)" />
        </Svg>
        <View style={{ position: 'absolute', left: pct(200 / 12), marginLeft: -9, width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: t.c.textPrimary, backgroundColor: t.cardBg }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" color="textSecondary" style={small}>{tr('settings.how.draw.blendZero')}</Text>
        <Text variant="caption" style={{ ...small, fontWeight: '600' }}>{`▲ ${tr('settings.how.draw.blendYou')}`}</Text>
        <Text variant="caption" color="textSecondary" style={small}>{tr('settings.how.draw.blendMax')}</Text>
      </View>
    </Panel>
  );
}

/** A range as a rounded bar: solid for the 80% range, dashed outline for the 95% range. */
function RangeSpan({ left, width, wide }: { left: number; width: number; wide: boolean }) {
  const t = useTheme();
  return <View style={{ position: 'absolute', left: pct(left), width: pct(width), top: 10, height: 18, borderRadius: 9, backgroundColor: tint(t.c.period, wide ? 0.14 : 0.42), borderWidth: wide ? 1 : 0, borderStyle: 'dashed', borderColor: tint(t.c.period, 0.45) }} />;
}

/** The result as a range, never one day: sample 80% and 95% ranges with their end dates. */
function RangeBar() {
  const { t: tr } = useTranslation();
  const t = useTheme();
  const small = { fontSize: 11, lineHeight: 15, position: 'absolute', top: 36 } as const;
  const swatch = (wide: boolean, label: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 14, height: 10, borderRadius: 5, backgroundColor: tint(t.c.period, wide ? 0.14 : 0.42), borderWidth: wide ? 1 : 0, borderStyle: 'dashed', borderColor: tint(t.c.period, 0.45) }} />
      <Text variant="caption">{label}</Text>
    </View>
  );
  return (
    <Panel testID="how-range" label={tr('settings.how.draw.rangeLabel')} note={tr('settings.how.draw.sampleNote')}>
      <Text variant="caption" color="textSecondary" style={{ fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 }}>{tr('settings.how.draw.rangeHeading')}</Text>
      <View style={{ height: 66 }}>
        <View style={{ position: 'absolute', left: 0, right: 0, top: 18, height: 1, backgroundColor: t.c.border }} />
        <RangeSpan left={10} width={80} wide />
        <RangeSpan left={28} width={44} wide={false} />
        <Text variant="caption" color="textSecondary" style={{ ...small, left: pct(4) }}>{tr('settings.how.draw.rangeFrom95')}</Text>
        <Text variant="caption" style={{ ...small, left: pct(25), fontWeight: '600' }}>{tr('settings.how.draw.rangeFrom80')}</Text>
        <Text variant="caption" style={{ ...small, left: pct(68), fontWeight: '600' }}>{tr('settings.how.draw.rangeTo80')}</Text>
        <Text variant="caption" color="textSecondary" style={{ ...small, left: pct(82) }}>{tr('settings.how.draw.rangeTo95')}</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{swatch(false, tr('settings.how.draw.range80'))}{swatch(true, tr('settings.how.draw.range95'))}</View>
    </Panel>
  );
}

/** Three past cycles: the range given at the start (bar), the real start (dot) and whether it fell inside (a check, or a dash: shape, not colour alone). */
function AccuracyChart() {
  const { t: tr } = useTranslation();
  const t = useTheme();
  const rows = [{ left: 20, width: 40, start: 42, inside: true }, { left: 26, width: 36, start: 70, inside: false }, { left: 22, width: 38, start: 36, inside: true }];
  return (
    <Panel testID="how-accuracy" label={tr('settings.how.draw.accuracyLabel')} note={tr('settings.how.draw.sampleNote')}>
      {rows.map((r) => (
        <View key={r.left} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1, height: 16 }}>
            <View style={{ position: 'absolute', left: pct(r.left), width: pct(r.width), top: 3, height: 10, borderRadius: 5, backgroundColor: tint(t.c.period, 0.42) }} />
            <View style={{ position: 'absolute', left: pct(r.start), marginLeft: -6, top: 2, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: t.cardBg, backgroundColor: t.c.period }} />
          </View>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Circle cx={12} cy={12} r={9} fill="none" stroke={r.inside ? t.c.success : t.c.textSecondary} strokeWidth={1.8} />
            <Path d={r.inside ? 'M8 12.3L10.8 15L16 9.5' : 'M8 12H16'} fill="none" stroke={r.inside ? t.c.success : t.c.textSecondary} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
      ))}
    </Panel>
  );
}

/** What narrows the range: the signals logged, and a wide range turning into a narrow one. */
function NarrowDrawing({ signals, label }: { signals: string[]; label: string }) {
  const { t: tr } = useTranslation();
  const t = useTheme();
  return (
    <Panel label={label}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{signals.map((s) => <Tag key={s} label={tr(`settings.how.signals.${s}`)} />)}</View>
      <View style={{ gap: 6 }}>
        <View style={{ height: 14, width: '92%', borderRadius: 7, backgroundColor: tint(t.c.period, 0.14), borderWidth: 1, borderStyle: 'dashed', borderColor: tint(t.c.period, 0.45) }} />
        <Svg width={16} height={14} viewBox="0 0 16 14" style={{ marginLeft: '40%' }}><Path d="M8 1V12M3.5 7.5L8 12L12.5 7.5" fill="none" stroke={t.c.textSecondary} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></Svg>
        <View style={{ height: 14, width: '40%', marginLeft: '24%', borderRadius: 7, backgroundColor: tint(t.c.period, 0.42) }} />
      </View>
    </Panel>
  );
}

/** What does not change the estimates: symptoms, mood and notes go to Insights; the arrow to Estimates is struck through. */
function NotChangeDrawing() {
  const { t: tr } = useTranslation();
  const t = useTheme();
  const arrow = (stroke: string, dashed?: boolean) => <Path d="M1 6H36M31 1.5L36 6L31 10.5" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dashed ? '3 3' : undefined} />;
  return (
    <Panel label={tr('settings.how.draw.notChangeLabel')}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ gap: 6 }}>
          <Tag label={tr('settings.how.notChange.symptoms')} dot={t.c.accent} />
          <Tag label={tr('settings.how.notChange.mood')} dot={t.c.accent} />
          <Tag label={tr('settings.how.notChange.notes')} dot={t.c.textSecondary} />
        </View>
        <View style={{ flex: 1, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Svg width={40} height={12} viewBox="0 0 40 12">{arrow(t.c.success)}</Svg>
            <Text variant="caption" style={{ fontWeight: '600' }}>{tr('settings.how.draw.notChangeInsights')}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Svg width={40} height={12} viewBox="0 0 40 12">{arrow(t.c.textSecondary, true)}<Path d="M14 1L22 11M22 1L14 11" stroke={t.c.period} strokeWidth={1.8} strokeLinecap="round" /></Svg>
            <Text variant="caption" color="textSecondary" style={{ fontWeight: '600', textDecorationLine: 'line-through' }}>{tr('settings.how.draw.notChangeEstimates')}</Text>
          </View>
        </View>
      </View>
    </Panel>
  );
}

/** A paragraph with the number of the source it rests on: after `anchor` where the sentence names it, else at the end. The number is the source's place in the list below. */
function CitedBody({ text, anchor, n }: { text: string; anchor?: string; n: number }) {
  const at = anchor ? text.indexOf(anchor) : -1;
  if (n < 1) return <Text variant="bodySmall">{text}</Text>;
  if (at < 0) return <Text variant="bodySmall">{text}<Cite n={n} /></Text>;
  const cut = at + (anchor?.length ?? 0);
  return <Text variant="bodySmall">{text.slice(0, cut)}<Cite n={n} />{text.slice(cut)}</Text>;
}

const LEVELS = [{ key: 'high', level: 3, bar: 30 }, { key: 'medium', level: 2, bar: 48 }, { key: 'low', level: 1, bar: 80 }, { key: 'none', level: 0, bar: 0 }] as const;

export default function HowScreen() {
  const { t } = useTranslation();
  const th = useTheme();
  const { prefs, profile, today } = useApp();
  const { fertilityTools } = effectivePrefs(prefs, profile, today);
  const signals: string[] = fertilityTools ? ['period', 'temperature', 'ovulationTest', 'mucus', 'position'] : ['period'];
  // the sources this page cites are flagged in copy/about.en-AU.json; the one about ovulation tests only when the fertility tools show
  const sources = about.sources.filter((s) => ('how' in s && s.how === 'always') || ('how' in s && s.how === 'fertility' && fertilityTools));
  const numberOf = (cite: string) => sources.findIndex((x) => x.cite.startsWith(cite)) + 1;
  return (
    <SubScreen testID="screen-how" title={t('settings.how.title')}>
      <Section n={1} title={t('settings.how.rangeTitle')}>
        <BlendBar />
        <CitedBody text={t('settings.how.rangeBody')} anchor="(Bull et al. 2019)" n={numberOf('Bull et al. 2019')} />
        <RangeBar />
      </Section>
      <Section n={2} title={t('settings.how.confidenceTitle')}>
        {LEVELS.map((l, i) => (
          <View key={l.key} style={{ gap: 6, paddingTop: i ? 10 : 0, borderTopWidth: i ? 1 : 0, borderTopColor: th.hairline }}>
            <Meter level={l.level} word={t(`settings.how.confidence.${l.key}.word`)} />
            <Text variant="bodySmall">{t(`settings.how.confidence.${l.key}.rule`)}</Text>
            {l.bar ? (
              <View {...HIDDEN} style={{ width: pct(l.bar), height: 8, flexDirection: 'row', borderRadius: 4, overflow: 'hidden' }}>
                <View style={{ flex: l.key === 'low' ? 7 : 1, backgroundColor: tint(th.c.period, 0.42) }} />
                {l.key === 'low' ? <View style={{ flex: 3, backgroundColor: tint(th.c.period, 0.12) }} /> : null}
              </View>
            ) : null}
          </View>
        ))}
      </Section>
      <Section n={3} title={t('settings.how.narrowTitle')}>
        <NarrowDrawing signals={signals} label={t(fertilityTools ? 'settings.how.draw.narrowLabel' : 'settings.how.draw.narrowLabelTeen')} />
        {fertilityTools ? <CitedBody text={t('settings.how.narrowBody')} n={numberOf('Ecochard et al. 2001')} /> : <Text variant="bodySmall">{t('settings.how.narrowBodyTeen')}</Text>}
      </Section>
      <Section n={4} title={t('settings.how.symptomsTitle')}>
        <NotChangeDrawing />
        <Text variant="bodySmall">{t('settings.how.symptomsBody')}</Text>
      </Section>
      <Section n={5} title={t('settings.how.accuracyTitle')}>
        <AccuracyChart />
        <Text variant="bodySmall">{t('settings.how.accuracyBody')}</Text>
      </Section>
      <Card style={{ gap: 8 }}>
        <Text variant="heading" accessibilityRole="header" style={{ fontSize: 17, lineHeight: 22 }}>{t('settings.about.sources')}</Text>
        {sources.map((s, i) => (
          <View key={s.cite} style={{ flexDirection: 'row', gap: 8 }}>
            <Text variant="bodySmall" color="textSecondary" {...HIDDEN}>{i + 1}.</Text>
            <Text variant="bodySmall" style={{ flex: 1 }}><Text variant="bodySmall" style={{ fontWeight: '600' }}>{s.cite}</Text>{`: ${s.use}`}</Text>
          </View>
        ))}
      </Card>
    </SubScreen>
  );
}
