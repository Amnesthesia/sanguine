import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '@/theme';

/** The seven row icons of the glass frame (Settings-Root), drawn in the on-accent-soft colour on the round rose-tinted disc SettingsRow draws. */
export function SettingsIcon({ name }: { name: 'life' | 'health' | 'privacy' | 'notifications' | 'appearance' | 'tracking' | 'about' }) {
  const c = useTheme().c.onAccentSoft;
  const line = { stroke: c, strokeWidth: 1.8, fill: 'none' } as const;
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {name === 'life' ? <><Circle cx={12} cy={12} r={8.5} {...line} /><Path d="M12 3.5A8.5 8.5 0 0 1 12 20.5Z" fill={c} /></> : null}
      {name === 'health' ? <Path d="M12 20S3.5 14.6 3.5 8.9A4.4 4.4 0 0 1 12 7A4.4 4.4 0 0 1 20.5 8.9C20.5 14.6 12 20 12 20Z" strokeLinejoin="round" {...line} /> : null}
      {name === 'privacy' ? <><Rect x={5} y={10.5} width={14} height={10} rx={2.5} {...line} /><Path d="M8 10.5V7.5A4 4 0 0 1 16 7.5V10.5" {...line} /></> : null}
      {name === 'notifications' ? <><Path d="M6 16.5V11A6 6 0 0 1 18 11V16.5L19.5 18H4.5Z" strokeLinejoin="round" {...line} /><Path d="M10 20.5A2 2 0 0 0 14 20.5" strokeLinecap="round" {...line} /></> : null}
      {name === 'appearance' ? <><Circle cx={12} cy={12} r={4} {...line} /><Path d="M12 3V5M12 19V21M3 12H5M19 12H21M5.6 5.6L7 7M17 17L18.4 18.4M5.6 18.4L7 17M17 7L18.4 5.6" strokeLinecap="round" {...line} /></> : null}
      {name === 'tracking' ? <><Path d="M9.5 7H20M9.5 12H20M9.5 17H20" strokeLinecap="round" {...line} /><Circle cx={5} cy={7} r={1.4} fill={c} /><Circle cx={5} cy={12} r={1.4} fill={c} /><Circle cx={5} cy={17} r={1.4} fill={c} /></> : null}
      {name === 'about' ? <><Circle cx={12} cy={12} r={8.5} {...line} /><Path d="M12 11V16.5M12 7.6V7.8" strokeLinecap="round" {...line} strokeWidth={2} /></> : null}
    </Svg>
  );
}
