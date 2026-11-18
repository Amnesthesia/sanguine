// Estimate sections (P8-22, D-120): when this period ends, the next period, and ovulation with the fertile window. Each is a card with a
// confidence bar, a picture, and "How it was worked out" with numbered sources. Pure display of a Prediction: nothing is recomputed here.
import { addDays, type Confidence, diffDays, type ISODate, type PastOvulation, type Prediction } from '@sanguine/engine';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { ovulationDrawable, ovulationUncertain, shownFertileDays, UNCERTAIN_ARM_DAYS } from '@/features/today/fertileShown';
import { useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { CautionPanel } from '@/ui/CautionPanel';
import { fertileAlpha } from '@/ui/fertileAlpha';
import { formatDay, formatRange } from '@/ui/format';
import { Meter, confidenceLevel } from '@/ui/Meter';
import { Cite, Sources } from '@/ui/Sources';
import { Text } from '@/ui/Text';
import { Picture, useSvgText } from './HormoneCurve';

const W = 326;
const dayNum = (d: ISODate) => String(Number(d.slice(8, 10)));

function CardHead({ title, confidence }: { title: string; confidence: Confidence }) {
  const { t } = useTranslation();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <Text variant="heading" accessibilityRole="header" style={{ flexShrink: 1 }}>{title}</Text>
      {confidence === 'none' ? null : <Meter level={confidenceLevel(confidence)} word={t(`estimates.how.confidence.${confidence}`)} />}
    </View>
  );
}

function How({ children }: { children: ReactNode }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  return (
    <View style={{ borderRadius: 16, backgroundColor: t.chipBg, padding: 12, gap: 6 }}>
      <Text variant="caption" color="textSecondary" style={{ fontWeight: '600', letterSpacing: 0.4 }}>{tr('estimates.how.label')}</Text>
      {children}
    </View>
  );
}

const list = (parts: string[], and: string) => (parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} ${and} ${parts[parts.length - 1]}`);

/** Her recent period lengths as dots on a 0 to 10 day bar, shaded up to the typical 8 days. */
function LengthsPicture({ lengths, label }: { lengths: number[]; label: string }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const { fs, fit } = useSvgText();
  const x = (d: number) => 8 + (d / 10) * (W - 16);
  const f = fs(11);
  const cy = f * 0.95 + 8; // the bar sits under the "yours" label and above the 0 / 8 / 10 labels, both of which grow with the text
  const base = cy + 11 + f;
  const yours = tr('estimates.how.periodEndYours');
  return (
    <Picture w={W} h={base + f * 0.55} label={label}>
      <Rect x={x(0)} y={cy - 4} width={x(10) - x(0)} height={8} rx={4} fill={t.c.border} />
      <Rect x={x(0)} y={cy - 4} width={x(8) - x(0)} height={8} rx={4} fill={t.c.period} fillOpacity={0.22} />
      {lengths.map((d, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: period lengths repeat, so the position is the identity
        <Circle key={i} cx={x(Math.min(d, 10))} cy={cy} r={7} fill={t.c.period} stroke={t.cardBg} strokeWidth={2} />
      ))}
      <SvgText x={x(0)} y={base} fontSize={f} fill={t.c.textSecondary}>0</SvgText>
      <SvgText x={x(8)} y={base} fontSize={f} textAnchor="middle" fill={t.c.textSecondary}>{tr('estimates.how.days', { n: 8 })}</SvgText>
      <SvgText x={x(10)} y={base} fontSize={f} textAnchor="end" fill={t.c.textSecondary}>10</SvgText>
      <SvgText x={fit(x(Math.min(lengths[0] ?? 0, 10)), yours, f)} y={f * 0.75} fontSize={f} fontWeight="600" textAnchor="middle" fill={t.c.textPrimary}>{yours}</SvgText>
    </Picture>
  );
}

/** The days of the current period: the days she logged (solid) and the estimated rest (dashed), as on the calendar and the dial. */
function BleedStrip({ start, periodDays, bleed, day, label }: { start: ISODate; periodDays: ReadonlySet<ISODate>; bleed: NonNullable<Prediction['currentBleed']>; day: ISODate; label: string }) {
  const t = useTheme();
  const end = addDays(bleed.i80.hi, 1);
  const n = Math.min(10, diffDays(end, start) + 1);
  const cw = W / n;
  const { fs } = useSvgText();
  const r = Math.min(cw / 2 - 2, 13 * (fs(1))); // the circles grow with the text but stay apart
  const f = Math.min(fs(12), r * 1.5); // two digits still fit inside the circle
  const cy = r + 3;
  return (
    <Picture w={W} h={cy + r + 21} label={label}>
      {Array.from({ length: n }, (_, i) => {
        const d = addDays(start, i);
        const logged = periodDays.has(d);
        const estimated = !logged && d <= bleed.i80.hi;
        const cx = i * cw + cw / 2;
        return (
          <G key={d}>
            <Circle cx={cx} cy={cy} r={r} fill={logged ? t.c.period : 'none'} stroke={estimated ? t.c.period : 'none'} strokeWidth={1.5} strokeDasharray={estimated ? '3 2' : undefined} />
            {d === day ? <Circle cx={cx} cy={cy} r={r + 2.5} fill="none" stroke={t.c.textPrimary} strokeWidth={1.5} /> : null}
            <SvgText x={cx} y={cy + f * 0.35} fontSize={f} textAnchor="middle" fill={logged ? t.c.surface : t.c.textPrimary}>{dayNum(d)}</SvgText>
          </G>
        );
      })}
    </Picture>
  );
}

function PeriodEndCard({ p, day, periodLengths, periodDays }: { p: Prediction; day: ISODate; periodLengths: number[]; periodDays: ReadonlySet<ISODate> }) {
  const { t } = useTranslation();
  const bleed = p.currentBleed;
  if (!bleed) return null;
  const start = p.currentPhase ? addDays(p.asOf, -(p.currentPhase.dayOfCycle - 1)) : undefined;
  const line = t('estimates.periodEnd.line', { range: formatRange(bleed.i80.lo, bleed.i80.hi), point: formatDay(bleed.point) });
  const words = periodLengths.map((n) => t('estimates.how.days', { n }));
  const shown = list(words, t('estimates.how.and'));
  const recent = periodLengths.length > 1 ? t('estimates.how.periodEndLengths', { count: periodLengths.length, list: shown }) : periodLengths.length === 1 ? t('estimates.how.periodEndOne', { list: shown }) : t('estimates.how.periodEndNone');
  return (
    <Card testID="estimate-period-end" style={{ gap: 12 }}>
      <CardHead title={t('estimates.periodEnd.title')} confidence={bleed.confidence} />
      {start ? <BleedStrip start={start} periodDays={periodDays} bleed={bleed} day={day} label={line} /> : null}
      <Text>{line}</Text>
      <How>
        <Text variant="bodySmall">{recent}{periodLengths.length > 0 && periodLengths.length < 4 ? ` ${t('estimates.how.periodEndFew')}` : ''}</Text>
        {periodLengths.length ? (
          <>
            <LengthsPicture lengths={periodLengths} label={t('estimates.how.periodEndPicture', { list: shown })} />
            <Text variant="caption" color="textSecondary">{t('estimates.how.periodEndShaded')}<Cite n={1} /></Text>
          </>
        ) : null}
      </How>
    </Card>
  );
}

/** The 95% range (dashed bar), the 80% range (darker bar) and the most likely day. */
function RangeBar({ next }: { next: NonNullable<Prediction['nextPeriod']> }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const lo = addDays(next.i95.lo, -1);
  const span = diffDays(addDays(next.i95.hi, 1), lo);
  const x = (d: ISODate) => 8 + (diffDays(d, lo) / span) * (W - 16);
  const label = tr('estimates.nextPeriod.a11y', { lo80: formatDay(next.i80.lo), hi80: formatDay(next.i80.hi), lo95: formatDay(next.i95.lo), hi95: formatDay(next.i95.hi) });
  const px = x(next.point) + (x(addDays(next.point, 1)) - x(next.point)) / 2;
  const { fs, fit } = useSvgText();
  const f = fs(11);
  const base = 43 + f; // under the bar, which stays the same size
  const tick = (d: ISODate, text: string, bold: boolean, at: number = x(d)) => (
    <SvgText key={`${d}-${text}`} x={fit(at, text, f)} y={base} fontSize={f} fontWeight={bold ? '600' : '400'} textAnchor="middle" fill={bold ? t.c.textPrimary : t.c.textSecondary}>{text}</SvgText>
  );
  return (
    <Picture w={W} h={base + f * 0.9} label={label}>
      <Line x1={8} y1={22} x2={W - 8} y2={22} stroke={t.c.border} strokeWidth={1} />
      <Rect x={x(next.i95.lo)} y={13} width={x(addDays(next.i95.hi, 1)) - x(next.i95.lo)} height={18} rx={9} fill={t.c.period} fillOpacity={0.14} stroke={t.c.period} strokeOpacity={0.45} strokeDasharray="3 3" />
      <Rect x={x(next.i80.lo)} y={13} width={x(addDays(next.i80.hi, 1)) - x(next.i80.lo)} height={18} rx={9} fill={t.c.period} fillOpacity={0.42} />
      <Rect x={px - 9} y={8} width={18} height={28} rx={9} fill={t.cardBg} stroke={t.c.period} strokeWidth={1.5} />
      {tick(next.i95.lo, formatDay(next.i95.lo), false)}
      {tick(next.i80.lo, dayNum(next.i80.lo), true)}
      {next.point !== next.i80.lo && next.point !== next.i80.hi ? tick(next.point, dayNum(next.point), true, px) : null}
      {tick(next.i80.hi, dayNum(next.i80.hi), true)}
      {tick(next.i95.hi, formatDay(next.i95.hi), false)}
    </Picture>
  );
}

function NextPeriodCard({ p }: { p: Prediction }) {
  const { t } = useTranslation();
  const t2 = useTheme();
  const next = p.nextPeriod;
  if (!next) return null;
  const n = p.cycleLength.nCyclesUsed;
  const key = (fill: string, dashed: boolean) => (
    <View style={{ width: 14, height: 10, borderRadius: 5, marginTop: 3, backgroundColor: fill, borderWidth: dashed ? 1 : 0, borderStyle: 'dashed', borderColor: t2.c.period }} />
  );
  return (
    <Card testID="estimate-next-period" style={{ gap: 12 }}>
      <CardHead title={t('estimates.nextPeriod.title')} confidence={next.confidence} />
      <Text>{t('estimates.nextPeriod.line', { range: formatRange(next.i80.lo, next.i80.hi), point: formatDay(next.point) })}</Text>
      <RangeBar next={next} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 6, flexGrow: 1, flexBasis: 140 }}>
          {key(`${t2.c.period}6B`, false)}
          <Text variant="caption" color="textSecondary" style={{ flex: 1 }}>{t('estimates.nextPeriod.legend80')}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, flexGrow: 1, flexBasis: 140 }}>
          {key(`${t2.c.period}24`, true)}
          <Text variant="caption" color="textSecondary" style={{ flex: 1 }}>{t('estimates.nextPeriod.legend95')}</Text>
        </View>
      </View>
      <How>
        <Text variant="bodySmall">
          {n > 0 ? t('estimates.how.nextPeriod', { count: n, mean: Math.round(p.cycleLength.mean * 10) / 10 }) : t('estimates.how.nextPeriodNone')}
          <Cite n={2} />
          {n > 0 && n < 6 ? ` ${t('estimates.how.nextPeriodFew', { count: n })}` : ''}
        </Text>
      </How>
    </Card>
  );
}

type Ov = { point: ISODate; i80: { lo: ISODate; hi: ISODate }; confidence: Confidence; basis: NonNullable<Prediction['ovulation']>['basis'] };

/** This cycle as a row of days: the period, the graded fertile band, the ovulation range and the next period's range. */
function CycleStrip({ p, start, ov, day, includeUncertain, periodDays }: { p: Prediction; start: ISODate; ov: Ov; day: ISODate; includeUncertain: boolean; periodDays: ReadonlySet<ISODate> }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const next = p.nextPeriod;
  const end = addDays(start, Math.min(44, diffDays(next ? next.i80.hi : addDays(ov.i80.hi, 7), start)));
  const n = diffDays(end, start) + 1;
  const cw = W / n;
  const x = (d: ISODate) => diffDays(d, start) * cw;
  const nr = (d: ISODate) => diffDays(d, start) + 1;
  const fertile = shownFertileDays(p, { includeUncertain });
  const bleed = p.currentBleed && p.currentPhase?.phase === 'menstrual' ? p.currentBleed : undefined;
  const parts = [
    tr('estimates.ovulation.stripStart'),
    tr('estimates.ovulation.stripOvulation', { lo: nr(ov.i80.lo), hi: nr(ov.i80.hi), point: nr(ov.point) }),
    ...(fertile.length ? [tr('estimates.ovulation.stripFertile', { lo: nr(fertile[0]?.date ?? ov.point), hi: nr(fertile[fertile.length - 1]?.date ?? ov.point) })] : []),
    ...(next ? [tr('estimates.ovulation.stripNext', { lo: nr(next.i80.lo), hi: nr(next.i80.hi) })] : []),
  ];
  const within = (d: ISODate) => diffDays(d, start) >= 0 && diffDays(d, start) < n;
  const { fs, fit } = useSvgText();
  const f = fs(10);
  const base = 48 + f; // under the marker, which stays the same size
  const pointText = String(nr(ov.point));
  return (
    <Picture w={W} h={base + 6 + (f - 10) * 0.3} label={parts.join('; ')}>
      {Array.from({ length: n }, (_, i) => <Rect key={`c${addDays(start, i)}`} x={i * cw + 0.5} y={8} width={cw - 1} height={18} rx={2} fill={t.c.border} />)}
      {bleed ? Array.from({ length: Math.max(0, diffDays(bleed.i80.hi, start) + 1) }, (_, i) => {
        const d = addDays(start, i);
        const logged = periodDays.has(d);
        return <Rect key={`p${d}`} x={x(d) + 0.5} y={8} width={cw - 1} height={18} rx={2} fill={logged ? t.c.period : 'none'} stroke={t.c.period} strokeWidth={logged ? 0 : 1} strokeDasharray="2 2" />;
      }) : null}
      {fertile.filter((f) => within(f.date)).map((f) => <Rect key={`f${f.date}`} x={x(f.date) + 0.5} y={8} width={cw - 1} height={18} rx={2} fill={t.c.fertile} fillOpacity={fertileAlpha(f.pInWindow)} />)}
      {next ? <Rect x={x(next.i80.lo)} y={8} width={Math.min(W - x(next.i80.lo), (diffDays(next.i80.hi, next.i80.lo) + 1) * cw)} height={18} rx={2} fill="none" stroke={t.c.period} strokeWidth={1.5} strokeDasharray="3 2" /> : null}
      {within(day) ? <Rect x={x(day)} y={6} width={cw} height={22} rx={3} fill="none" stroke={t.c.textPrimary} strokeWidth={1.5} /> : null}
      <Rect x={Math.max(0, x(ov.i80.lo))} y={31} width={Math.min(W, (diffDays(ov.i80.hi, ov.i80.lo) + 1) * cw)} height={5} rx={2.5} fill={t.c.ovulation} fillOpacity={0.35} />
      <Path d={`M${x(ov.point) + cw / 2},37 l-4,7 h8 Z`} fill={t.c.ovulation} />
      <SvgText x={0} y={base} fontSize={f} fill={t.c.textSecondary}>{tr('guidance.curve.day1')}</SvgText>
      <SvgText x={fit(x(ov.point) + cw / 2, pointText, f)} y={base} fontSize={f} fontWeight="600" textAnchor="middle" fill={t.c.textPrimary}>{pointText}</SvgText>
    </Picture>
  );
}

/** A past cycle's 80% range wider than the uncertain rule allows (the same width rule as ovulationUncertain and the calendar). */
const wideRow = (r: { i80: { lo: ISODate; hi: ISODate } }) => diffDays(r.i80.hi, r.i80.lo) > 2 * UNCERTAIN_ARM_DAYS;

/**
 * One rule with the calendar grid (D-098, D-106, D-115): a wide range is drawn (strip, fertile band, point) only when she turned on uncertain
 * estimates; otherwise the card says so in words and nothing else, with no point date and no fertile wording.
 */
function OvulationCard({ p, day, past, includeUncertain, periodDays }: { p: Prediction; day: ISODate; past: PastOvulation | undefined; includeUncertain: boolean; periodDays: ReadonlySet<ISODate> }) {
  const { t } = useTranslation();
  const live = p.ovulation;
  const ov: Ov | undefined = past ? { ...past, basis: past.basis === 'wearable' ? 'bbt' : past.basis === 'cervix' ? 'combined' : past.basis } : live;
  if (!ov) return null;
  const start = past ? past.cycleStart : p.currentPhase ? addDays(p.asOf, -(p.currentPhase.dayOfCycle - 1)) : undefined;
  const wordsOnly = !past && !ovulationDrawable(p, includeUncertain);
  const uncertain = past ? wideRow(ov) : ovulationUncertain(p);
  const range = formatRange(ov.i80.lo, ov.i80.hi);
  const point = formatDay(ov.point);
  const line = past
    ? uncertain ? t('day.estimates.ovulationPastUncertain', { range, basis: t(`day.estimates.basis.${ov.basis}`) }) : t('estimates.ovulation.linePast', { range, point })
    : uncertain ? t('day.estimates.ovulationUncertain', { range }) : t('estimates.ovulation.line', { range, point });
  return (
    <Card testID="estimate-ovulation" style={{ gap: 12 }}>
      <CardHead title={t(wordsOnly ? 'estimates.ovulation.titleWords' : 'estimates.ovulation.title')} confidence={ov.confidence} />
      {ov.basis === 'calendar' && !past ? <CautionPanel>{t('estimates.how.calendarOnly')}</CautionPanel> : null}
      <Text>{line}</Text>
      {start && !past && !wordsOnly ? <CycleStrip p={p} start={start} ov={ov} day={day} includeUncertain={includeUncertain} periodDays={periodDays} /> : null}
      <How>
        {ov.basis === 'calendar' ? (
          <Text variant="bodySmall">{past ? t('estimates.how.ovulationPast') : `${t('estimates.how.ovulationCalendar')} `}{past ? null : <Cite n={2} />}{past ? null : ` ${t('estimates.how.ovulationCalendarWide')}`}</Text>
        ) : <Text variant="bodySmall">{t(`today.estimateBasis.${ov.basis}`)}</Text>}
        {past || wordsOnly ? null : <Text variant="bodySmall">{t('estimates.how.fertile')}<Cite n={3} />{uncertain ? ` ${t('estimates.how.fertileWide')}` : ''}</Text>}
      </How>
      {wordsOnly
        ? <Text variant="bodySmall" color="textSecondary" testID="estimate-footer">{t('legal.footer')}</Text>
        : <Text variant="bodySmall" color="textSecondary" testID="estimate-legal">{t('legal.estimateCard', { point, lo: formatDay(ov.i80.lo), hi: formatDay(ov.i80.hi) })}</Text>}
    </Card>
  );
}

/** The estimate row of the closed cycle a day before the open cycle belongs to (D-112), only that cycle's own: the engine gives none for an
 *  IUD, excluded or invalid cycle, and an earlier cycle's row must not stand in for it. */
const pastFor = (day: ISODate, cycleStarts: readonly ISODate[], pastOv: readonly PastOvulation[]): PastOvulation | undefined => {
  const start = cycleStarts.filter((s) => s <= day).sort().at(-1);
  return start ? pastOv.find((o) => o.cycleStart === start) : undefined;
};

export function EstimateSections({ prediction, day, pastOv, cycleStarts, periodDays, showEstimate, includeUncertain, periodLengths = [] }: {
  prediction: Prediction;
  /** The day the sheet or screen is about. */
  day: ISODate;
  pastOv: PastOvulation[];
  /** Every logged cycle start (history), to find the cycle a past day belongs to. */
  cycleStarts: readonly ISODate[];
  /** Her logged period days (usePeriodDays): only these are drawn solid, every other day of the period is a dashed estimate. */
  periodDays: ReadonlySet<ISODate>;
  /** Effective ovulation-estimate preference (teen mode folded in). Off: no ovulation or fertile card, picture or wording. */
  showEstimate: boolean;
  /** The effective show-uncertain-estimates preference (effectivePrefs): off, a wide ovulation range is words only and a wide past one is not shown. */
  includeUncertain: boolean;
  /** Days of her recent closed periods, oldest first, for the period-end card. */
  periodLengths?: number[];
}) {
  const { t } = useTranslation();
  const t2 = useTheme();
  if (prediction.suspended) return null;
  // a day before the open cycle belongs to an earlier cycle: its own ovulation estimate if it has one, never the open cycle's live cards
  const openStart = prediction.currentPhase ? addDays(prediction.asOf, -(prediction.currentPhase.dayOfCycle - 1)) : undefined;
  const before = openStart !== undefined && day < openStart;
  const past = before ? pastFor(day, cycleStarts, pastOv) : undefined;
  const periodEnd = !before && Boolean(prediction.currentBleed);
  const nextPeriod = !before && Boolean(prediction.nextPeriod);
  const ovulation = showEstimate && (before ? past !== undefined && (includeUncertain || !wideRow(past)) : Boolean(prediction.ovulation));
  if (!periodEnd && !nextPeriod && !ovulation) return null;
  const fertileCited = ovulation && !before && ovulationDrawable(prediction, includeUncertain);
  return (
    <View testID="estimate-sections" style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <Text variant="title" accessibilityRole="header">{t('estimates.title')}</Text>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t2.c.period }} />
            <Text variant="caption" color="textSecondary">{t('estimates.legendLogged')}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t2.c.period }} />
            <Text variant="caption" color="textSecondary">{t('estimates.legendEstimate')}</Text>
          </View>
        </View>
      </View>
      {periodEnd ? <PeriodEndCard p={prediction} day={day} periodLengths={periodLengths} periodDays={periodDays} /> : null}
      {nextPeriod ? <NextPeriodCard p={prediction} /> : null}
      {ovulation ? <OvulationCard p={prediction} day={day} past={past} includeUncertain={includeUncertain} periodDays={periodDays} /> : null}
      <View style={{ gap: 8 }}>
        <Text variant="heading" accessibilityRole="header">{t('estimates.how.sources')}</Text>
        <Sources items={[t('estimates.how.src1'), t('estimates.how.src2'), ...(fertileCited ? [t('estimates.how.src3')] : [])]} />
        <Text variant="caption" color="textSecondary">{t('day.estimates.note')}</Text>
      </View>
    </View>
  );
}
