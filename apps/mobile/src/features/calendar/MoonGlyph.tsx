import Svg, { Circle, Path } from 'react-native-svg';
import type { MoonPhase } from './moon';

/** New moon filled, full moon outlined, quarters half lit. The lit half is on the right for a waxing moon north of the equator and on the
 *  left south of it (D-089). Decorative: the day cell's label says the phase. */
export function MoonGlyph({ phase, southern, size = 9, color }: { phase: MoonPhase; southern: boolean; size?: number; color: string }) {
  const r = size / 2 - 0.75;
  const c = size / 2;
  // which half is lit: first quarter lit right (north), last quarter lit left (north); mirrored in the south
  const litRight = (phase === 'first') !== southern;
  const half = `M ${c} ${c - r} A ${r} ${r} 0 0 ${litRight ? 1 : 0} ${c} ${c + r} Z`;
  return (
    <Svg width={size} height={size} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Circle cx={c} cy={c} r={r} stroke={color} strokeWidth={1} fill={phase === 'new' ? color : 'none'} />
      {phase === 'first' || phase === 'last' ? <Path d={half} fill={color} /> : null}
    </Svg>
  );
}
