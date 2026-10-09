// Period / Symptoms / Temperature. iOS 26+: Liquid Glass pill with Period as a tinted glass capsule (PLAN.md §9.1, P3-3);
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
import { LARGE, useFontScale } from '@/ui/useFontScale';
import { Text } from '@/ui/Text';

export type LogSection = 'period' | 'symptoms' | 'temperature';

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
  const stacked = useFontScale() > LARGE; // big text: one button per line instead of breaking words
  const reduceTransparency = useReduceTransparency();
  const mode = Platform.OS !== 'ios' ? 'tonal' : reduceTransparency ? 'solid' : LIQUID_GLASS ? 'glass' : 'blur';
  const g = glass[t.scheme === 'dark' ? 'dark' : 'light'];
  const radius = stacked ? 28 : 999;

  const go = (section: LogSection) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/log', params: { section } });
  };
  const item = (section: LogSection, label: string, primary = false) => {
    const size = stacked ? { alignSelf: 'stretch' as const } : { flex: primary ? 1.1 : 1 };
    const tinted = primary && mode === 'glass';
    const button = (
      <Pressable
        key={section} testID={`quick-${section}`} accessibilityRole="button" accessibilityLabel={label} onPress={() => go(section)}
        style={({ pressed }) => ({ ...(tinted ? { flex: 1 } : size), minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, backgroundColor: primary && !tinted ? t.c.accent : 'transparent', borderWidth: primary ? 0 : 1, borderColor: t.hairline, opacity: pressed ? 0.7 : 1 })}>
        <Text variant="heading" style={{ fontSize: 15, lineHeight: 20, color: tinted ? g.onAccent : primary ? (t.scheme === 'dark' ? '#3A0A14' : '#FFFFFF') : t.c.textPrimary }}>{label}</Text>
      </Pressable>
    );
    // the Period action as a tinted glass capsule (glassAccent)
    return tinted ? (
      <GlassView key={section} glassEffectStyle="regular" tintColor={rgba(g.accentBase, g.accentAlpha)} isInteractive style={{ ...size, borderRadius: 999, overflow: 'hidden' }}>{button}</GlassView>
    ) : button;
  };
  const row = (
    <View style={{ flexDirection: stacked ? 'column' : 'row', gap: 4, padding: 4 }}>
      {item('period', tr('today.quick.period'), true)}
      {item('symptoms', tr('today.quick.symptoms'))}
      {item('temperature', tr('today.quick.temperature'))}
    </View>
  );
  const shape = { borderRadius: radius, overflow: 'hidden' as const };
  switch (mode) {
    case 'glass':
      return <GlassView testID="quicklog-glass" glassEffectStyle="regular" tintColor={rgba(g.tintBase, g.tintAlpha)} style={shape}>{row}</GlassView>;
    case 'solid':
      return <View testID="quicklog-solid" style={{ ...shape, backgroundColor: `${t.c.surface}${FALLBACK_ALPHA}`, borderWidth: 1, borderColor: t.hairline }}>{row}</View>;
    case 'blur':
      return <BlurView intensity={40} tint={t.scheme === 'dark' ? 'dark' : 'light'} style={{ ...shape, borderWidth: 1, borderColor: t.hairline }}>{row}</BlurView>;
    default:
      return <View style={{ borderRadius: radius, backgroundColor: t.chipBg, elevation: 3 }}>{row}</View>;
  }
}
