// The one expressive element: a ring of the cycle with period days, the graded fertile band, the predicted-period range and today (PLAN.md §9.5).
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import { useTheme } from '@/theme';
import { Text } from '@/ui/Text';
import { useFontScale } from '@/ui/useFontScale';
import { arcPath } from './arc';
import type { RingModel } from './todayModel';

const SIZE = 220;
const STROKE = 18;
const R = SIZE / 2 - STROKE / 2 - 4;
const C = SIZE / 2;

export function PhaseRing({ ring, dayOfCycle, phase }: { ring: RingModel; dayOfCycle: number | undefined; phase: string | undefined }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const big = useFontScale() > 1.5;
  const label = ring.kind === 'cycle' && dayOfCycle ? tr('a11y.phaseRing', { day: dayOfCycle, phase: phase ? tr(`insights.phases.${phase}`) : '' }) : ring.kind === 'noData' ? tr('today.ring.noData') : '';

  // above 150% text size the ring collapses to a text header (§8.9)
  if (big) {
    return ring.kind === 'cycle' && dayOfCycle ? <Text variant="heading" testID="phase-header">{tr('today.dayOfCycleHeader', { day: dayOfCycle })}</Text> : null;
  }
  const tick = ring.kind === 'cycle' ? ring.today.deg : 0;
  const rad = (tick * Math.PI) / 180;
  return (
    <View testID="phase-ring" accessible accessibilityRole="image" accessibilityLabel={label} style={{ width: SIZE, height: SIZE, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={SIZE} height={SIZE}>
        {ring.kind === 'cycle' ? (
          <G>
            <Circle cx={C} cy={C} r={R} stroke={t.c.border} strokeWidth={STROKE} fill="none" />
            {ring.fertile.map((f) => (
              <Path key={`f${f.from.toFixed(2)}`} d={arcPath(C, C, R, f.from, f.to)} stroke={t.c.fertile} strokeOpacity={f.opacity} strokeWidth={STROKE} fill="none" />
            ))}
            {ring.predicted ? <Path d={arcPath(C, C, R, ring.predicted.from, ring.predicted.to)} stroke={t.c.periodPredicted} strokeWidth={STROKE} strokeDasharray="3 4" fill="none" /> : null}
            <Path d={arcPath(C, C, R, ring.period.from, ring.period.to)} stroke={t.c.period} strokeWidth={STROKE} fill="none" />
            <Line x1={C + (R - STROKE / 2 - 4) * Math.sin(rad)} y1={C - (R - STROKE / 2 - 4) * Math.cos(rad)} x2={C + (R + STROKE / 2 + 3) * Math.sin(rad)} y2={C - (R + STROKE / 2 + 3) * Math.cos(rad)} stroke={t.c.accent} strokeWidth={4} strokeLinecap="round" />
          </G>
        ) : (
          <Circle cx={C} cy={C} r={R} stroke={t.c.border} strokeWidth={STROKE} strokeDasharray="4 8" fill="none" />
        )}
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }} pointerEvents="none">
        {ring.kind === 'cycle' && dayOfCycle ? (<>
          <Text variant="display" tabular style={{ fontSize: 48, lineHeight: 52 }}>{dayOfCycle}</Text>
          <Text variant="caption" color="textSecondary">{tr('common.dayOfCycle')}</Text>
        </>) : (
          <Text variant="bodySmall" color="textSecondary" style={{ textAlign: 'center', maxWidth: 120 }}>{ring.kind === 'noData' ? tr('today.ring.noData') : ''}</Text>
        )}
      </View>
    </View>
  );
}
