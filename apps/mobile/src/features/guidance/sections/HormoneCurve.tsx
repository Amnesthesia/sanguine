// A typical cycle's estrogen and progesterone, drawn to explain (not the user's levels), with a marker for the phase the day sits in.
// `extras` (D-155) adds LH, FSH and, on the full size, a body-temperature strip, and replaces the in-chart labels with a legend; it is on only while the
// ovulation estimate is shown, because the LH peak and the temperature step give away when ovulation falls (copy under estimates.ovulation.curve.*, outside the teen-audited guidance.*).
// The "ovulation" label (copy under estimates.*, outside the teen-audited guidance.* copy) is drawn only for the ovulatory phase, which phaseOn() emits only when the ovulation estimate is on (teen mode).
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/theme';
import { Text } from '@/ui/Text';
import { useFontScale } from '@/ui/useFontScale';
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
const MAX_SCALE = 2; // the largest text setting that still leaves room for a picture on a phone (same cap as the Insights charts)

/**
 * Sizes for the pictures' SVG text. SVG text does not follow the system text size by itself, so every picture draws its text at
 * `base * scale` and grows its own height and spacing to match; `fit` keeps a label of that size inside the picture's width.
 */
export function useSvgText() {
  const scale = Math.min(Math.max(useFontScale(), 1), MAX_SCALE);
  return {
    scale,
    /** Text size for a label drawn at `base` at normal size. */
    fs: (base: number) => base * scale,
    /** x for a label centred (or anchored) at `x` that stays inside 0..W; its width is estimated from the character count. */
    fit: (x: number, text: string, size: number, anchor: 'start' | 'middle' | 'end' = 'middle') => {
      const w = text.length * size * 0.6;
      const left = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
      return Math.min(Math.max(left, 0), Math.max(0, W - w)) + (anchor === 'middle' ? w / 2 : anchor === 'end' ? w : 0);
    },
  };
}
/** x of the middle of each phase on the 326-wide curve. */
const MARK_X: Record<GuidePhase, number | undefined> = { menstrual: 24, follicular: 85, ovulatory: 146, luteal: 215, premenstrual: 290, general: undefined };

/** `compact` (the day sheet, frame Calendar-3-SheetExpanded): the same drawing two thirds as tall, without the "period" label. */
/** One legend entry: a short sample of the line's stroke, then its name. The stroke pattern differs per line, so the colour is never the only cue. */
function Swatch({ color, dash, label }: { color: string; dash?: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Svg aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" width={26} height={8} viewBox="0 0 26 8">
        <Line x1={1} y1={4} x2={25} y2={4} stroke={color} strokeWidth={2.4} strokeLinecap="round" {...(dash ? { strokeDasharray: dash } : {})} />
      </Svg>
      <Text variant="caption" color="textSecondary">{label}</Text>
    </View>
  );
}

export function HormoneCurve({ day, compact = false, extras = false }: { day: GuideDay; compact?: boolean; extras?: boolean }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const { scale, fs } = useSvgText();
  const x = MARK_X[day.phase];
  const phase = tr(`guidance.phase.${day.phase}`);
  const label = `${tr('guidance.curve.label')}${extras ? ` ${tr('estimates.ovulation.curve.labelExtras')}` : ''} ${x === undefined ? '' : tr(day.expected ? 'guidance.curve.labelExpected' : 'guidance.curve.labelHere', { phase })}`.trim();
  const small = fs(10);
  const mid = fs(11);
  const end = x !== undefined && x > 130;
  // the curves sit below the top labels and above the bottom ones; both rows grow with the text. At large sizes the marker label gets a row of its own.
  const top = mid - 11; // the curves move down by what the top labels grew
  const large = scale > 1.3;
  const k = compact ? 0.66 : 1; // vertical scale of the drawing between y 6 and the axis
  const axis = 6 + 104 * k + top; // the baseline the curves rest on (110 + top at full size)
  const strip = extras && !compact ? 38 : 0; // the body-temperature strip under the hormones (full size only)
  const bottom = axis + strip; // the marker runs down to here
  const row1 = bottom + 6 + small;
  const row2 = large ? row1 + small * 1.2 : row1;
  const H = row2 + small * 0.6 + 2;
  const fill = { fill: t.c.textSecondary } as const;
  return (
    <View testID={compact ? 'hormone-curve-compact' : 'hormone-curve'} style={{ gap: 6 }}>
      <Picture w={W} h={H} label={label}>
        <Rect x={0} y={6} width={48} height={axis - 6} rx={6} fill={t.c.period} fillOpacity={0.1} />
        {compact ? null : <SvgText x={4} y={10 + small} fontSize={small} fill={t.c.period}>{tr('guidance.curve.period')}</SvgText>}
        <Line x1={0} y1={axis} x2={W} y2={axis} stroke={t.c.border} strokeWidth={1} />
        {/* y → top + 6 + (y − 6)·k; the strokes keep their width when squashed */}
        <G transform={`translate(0 ${top + 6 - 6 * k}) scale(1 ${k})`}>
          <Path d="M0,96 C40,96 80,86 110,62 S135,20 146,22 S166,64 186,68 S226,48 242,50 S292,82 326,94" fill="none" stroke={t.c.accent} strokeWidth={2.4} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <Path d="M0,102 L150,102 C176,102 196,42 240,40 S300,84 326,102" fill="none" stroke={t.c.textSecondary} strokeWidth={2.4} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {extras ? (
            <>
              <Path d="M0,98 L122,98 C134,98 140,16 146,10 C152,16 158,98 170,98 L326,98" fill="none" stroke={t.c.ovulation} strokeWidth={2} strokeDasharray="6 3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <Path d="M0,88 C14,70 30,68 46,82 S78,98 104,98 L132,98 C140,90 148,88 156,97 L326,98" fill="none" stroke={t.c.textPrimary} strokeWidth={2} strokeDasharray="1 4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </>
          ) : null}
        </G>
        {strip ? (
          <>
            <Line x1={0} y1={bottom} x2={W} y2={bottom} stroke={t.c.border} strokeWidth={1} />
            <Path d={`M0,${bottom - 10} L148,${bottom - 10} C154,${bottom - 10} 158,${axis + 12} 166,${axis + 12} L${W},${axis + 12}`} fill="none" stroke={t.c.period} strokeWidth={2} strokeLinecap="round" />
          </>
        ) : null}
        {extras ? null : (
          <>
            <SvgText x={118} y={(compact ? 12 : 16) + top} fontSize={mid} fontWeight="600" fill={t.c.accent}>{tr('guidance.curve.estrogen')}</SvgText>
            <SvgText x={large ? W : compact ? 236 : 226} y={(compact ? 22 : 32) + top} textAnchor={large ? 'end' : 'start'} fontSize={mid} fontWeight="600" {...fill}>{tr('guidance.curve.progesterone')}</SvgText>
          </>
        )}
        {x === undefined ? null : (
          <>
            <Line x1={x} y1={6} x2={x} y2={bottom} stroke={t.c.textPrimary} strokeWidth={1.5} strokeDasharray="3 3" />
            <Circle cx={x} cy={bottom} r={4} fill={t.c.textPrimary} />
            <SvgText x={end ? x - 6 : x + 6} y={row2} textAnchor={end ? 'end' : 'start'} fontSize={small} fontWeight="600" fill={t.c.textPrimary}>{tr(day.expected ? 'guidance.curve.hereExpected' : 'guidance.curve.here')}</SvgText>
          </>
        )}
        <SvgText x={0} y={row1} fontSize={small} {...fill}>{tr('guidance.curve.day1')}</SvgText>
        {day.phase === 'ovulatory' ? <SvgText x={152} y={row1} fontSize={small} {...fill}>{tr('estimates.ovulation.curveLabel')}</SvgText> : null}
        <SvgText x={W} y={row1} textAnchor="end" fontSize={small} {...fill}>{tr('guidance.curve.day28')}</SvgText>
      </Picture>
      {extras ? (
        <View testID="hormone-legend" style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4 }}>
          <Swatch color={t.c.accent} label={tr('guidance.curve.estrogen')} />
          <Swatch color={t.c.textSecondary} label={tr('guidance.curve.progesterone')} />
          <Swatch color={t.c.ovulation} dash="6 3" label={tr('estimates.ovulation.curve.lh')} />
          <Swatch color={t.c.textPrimary} dash="1 4" label={tr('estimates.ovulation.curve.fsh')} />
          {strip ? <Swatch color={t.c.period} label={tr('estimates.ovulation.curve.temperature')} /> : null}
        </View>
      ) : null}
      <Text variant="caption" color="textSecondary">{tr('guidance.curve.caption')}</Text>
    </View>
  );
}
