// A typical cycle's estrogen and progesterone, drawn to explain (not the user's levels), with a marker for the phase the day sits in.
// The "ovulation" label (copy under estimates.*, outside the teen-audited guidance.* copy) is drawn only for the ovulatory phase, which phaseOn() emits only when the ovulation estimate is on (teen mode).
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/theme';
import { Text } from '@/ui/Text';
import type { GuideDay, GuidePhase } from '../guidance';

/** A vector drawing that keeps its aspect ratio at any width and is read as one image. */
export function Picture({ w, h, label, children }: { w: number; h: number; label: string; children: ReactNode }) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ aspectRatio: w / h, width: '100%' }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`}>{children}</Svg>
    </View>
  );
}

const W = 326;
const H = 132;
/** x of the middle of each phase on the 326-wide curve. */
const MARK_X: Record<GuidePhase, number | undefined> = { menstrual: 24, follicular: 85, ovulatory: 146, luteal: 215, premenstrual: 290, general: undefined };

export function HormoneCurve({ day }: { day: GuideDay }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const x = MARK_X[day.phase];
  const phase = tr(`guidance.phase.${day.phase}`);
  const label = `${tr('guidance.curve.label')} ${x === undefined ? '' : tr(day.expected ? 'guidance.curve.labelExpected' : 'guidance.curve.labelHere', { phase })}`.trim();
  const small = { fontSize: 10, fill: t.c.textSecondary } as const;
  const end = x !== undefined && x > 130;
  return (
    <View testID="hormone-curve" style={{ gap: 6 }}>
      <Picture w={W} h={H} label={label}>
        <Rect x={0} y={6} width={48} height={104} rx={6} fill={t.c.period} fillOpacity={0.1} />
        <SvgText x={4} y={20} fontSize={10} fill={t.c.period}>{tr('guidance.curve.period')}</SvgText>
        <Line x1={0} y1={110} x2={W} y2={110} stroke={t.c.border} strokeWidth={1} />
        <Path d="M0,96 C40,96 80,86 110,62 S135,20 146,22 S166,64 186,68 S226,48 242,50 S292,82 326,94" fill="none" stroke={t.c.accent} strokeWidth={2.4} strokeLinecap="round" />
        <Path d="M0,102 L150,102 C176,102 196,42 240,40 S300,84 326,102" fill="none" stroke={t.c.textSecondary} strokeWidth={2.4} strokeLinecap="round" />
        <SvgText x={118} y={16} fontSize={11} fontWeight="600" fill={t.c.accent}>{tr('guidance.curve.estrogen')}</SvgText>
        <SvgText x={226} y={32} fontSize={11} fontWeight="600" fill={t.c.textSecondary}>{tr('guidance.curve.progesterone')}</SvgText>
        {x === undefined ? null : (
          <>
            <Line x1={x} y1={6} x2={x} y2={110} stroke={t.c.textPrimary} strokeWidth={1.5} strokeDasharray="3 3" />
            <Circle cx={x} cy={110} r={4} fill={t.c.textPrimary} />
            <SvgText x={end ? x - 6 : x + 6} y={126} textAnchor={end ? 'end' : 'start'} fontSize={10} fontWeight="600" fill={t.c.textPrimary}>{tr(day.expected ? 'guidance.curve.hereExpected' : 'guidance.curve.here')}</SvgText>
          </>
        )}
        <SvgText x={0} y={126} {...small}>{tr('guidance.curve.day1')}</SvgText>
        {day.phase === 'ovulatory' ? <SvgText x={152} y={126} {...small}>{tr('estimates.ovulation.curveLabel')}</SvgText> : null}
        <SvgText x={W} y={126} textAnchor="end" {...small}>{tr('guidance.curve.day28')}</SvgText>
      </Picture>
      <Text variant="caption" color="textSecondary">{tr('guidance.curve.caption')}</Text>
    </View>
  );
}
