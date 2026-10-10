// Log today: one button to the log sheet (D-097). iOS 26+: Liquid Glass pill holding a tinted glass capsule (PLAN.md §9.1, P3-3);
// Reduce Transparency: surface at 94%; older iOS: system blur. Android: tonal capsule (M3 floating toolbar).
import { glass } from '@sanguine/ui-tokens';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Platform, Pressable, View } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from '@/ui/Text';

const LIQUID_GLASS = Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
/** Reduce Transparency fallback: `surface` at 94% (PLAN.md §9.2). */
const FALLBACK_ALPHA = 'F0';

const rgba = (hex: string, a: number) => `rgba(${[1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)).join(',')},${a})`;

function useReduceTransparency(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    void AccessibilityInfo.isReduceTransparencyEnabled().then(setOn).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setOn);
    return () => sub.remove();
  }, []);
  return on;
}

export function QuickLogRow() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const router = useRouter();
  const reduceTransparency = useReduceTransparency();
  const mode = Platform.OS !== 'ios' ? 'tonal' : reduceTransparency ? 'solid' : LIQUID_GLASS ? 'glass' : 'blur';
  const g = glass[t.scheme === 'dark' ? 'dark' : 'light'];
  const label = tr('today.quick.log');

  // one door to the log sheet: every section lives there (D-097)
  const go = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/log');
  };
  const tinted = mode === 'glass';
  const button = (
    <Pressable
      testID="quick-log" accessibilityRole="button" accessibilityLabel={label} onPress={go}
      style={({ pressed }) => ({ minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: tinted ? 'transparent' : t.c.accent, opacity: pressed ? 0.7 : 1 })}>
      <Text variant="heading" style={{ fontSize: 15, lineHeight: 20, textAlign: 'center', color: tinted ? g.onAccent : t.scheme === 'dark' ? '#3A0A14' : '#FFFFFF' }}>{label}</Text>
    </Pressable>
  );
  // the action as a tinted glass capsule (glassAccent) inside the glass pill
  const inner = tinted ? (
    <GlassView glassEffectStyle="regular" tintColor={rgba(g.accentBase, g.accentAlpha)} isInteractive style={{ borderRadius: 999, overflow: 'hidden' }}>{button}</GlassView>
  ) : button;
  const row = <View style={{ padding: 4 }}>{inner}</View>;
  const shape = { borderRadius: 999, overflow: 'hidden' as const };
  switch (mode) {
    case 'glass':
      return <GlassView testID="quicklog-glass" glassEffectStyle="regular" tintColor={rgba(g.tintBase, g.tintAlpha)} style={shape}>{row}</GlassView>;
    case 'solid':
      return <View testID="quicklog-solid" style={{ ...shape, backgroundColor: `${t.c.surface}${FALLBACK_ALPHA}`, borderWidth: 1, borderColor: t.hairline }}>{row}</View>;
    case 'blur':
      return <BlurView intensity={40} tint={t.scheme === 'dark' ? 'dark' : 'light'} style={{ ...shape, borderWidth: 1, borderColor: t.hairline }}>{row}</BlurView>;
    default:
      return <View style={{ borderRadius: 999, backgroundColor: t.chipBg, elevation: 3 }}>{row}</View>;
  }
}
