import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/theme';

/** Drop with increasing fill for spotting → heavy (fill 0..1). Outline always drawn, so level is not colour-only. */
export function DropGlyph({ fill, size = 28, color }: { fill: number; size?: number; color?: string }) {
  const t = useTheme();
  const c = color ?? t.c.period;
  const d = 'M12 2.5C12 2.5 5 10 5 15a7 7 0 0 0 14 0C19 10 12 2.5 12 2.5Z';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={d} fill="none" stroke={c} strokeWidth={1.6} />
      {fill > 0 ? <Path d={d} fill={c} fillOpacity={0.25 + 0.75 * fill} /> : null}
    </Svg>
  );
}
