// Period / Symptoms / Temperature. iOS: blurred capsule (expo-blur stands in for glass until P3-3); Android: tonal capsule (M3 floating toolbar).
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, View } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from '@/ui/Text';

export type LogSection = 'period' | 'symptoms' | 'temperature';

export function QuickLogRow() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const router = useRouter();
  const go = (section: LogSection) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/log', params: { section } });
  };
  const item = (section: LogSection, label: string, primary = false) => (
    <Pressable
      key={section} testID={`quick-${section}`} accessibilityRole="button" accessibilityLabel={label} onPress={() => go(section)}
      style={({ pressed }) => ({ flex: primary ? 1.1 : 1, minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, backgroundColor: primary ? t.c.accent : 'transparent', opacity: pressed ? 0.7 : 1 })}>
      <Text variant="heading" style={{ fontSize: 15, lineHeight: 20, color: primary ? (t.scheme === 'dark' ? '#3A0A14' : '#FFFFFF') : t.c.textPrimary }}>{label}</Text>
    </Pressable>
  );
  const row = (
    <View style={{ flexDirection: 'row', gap: 4, padding: 4 }}>
      {item('period', tr('today.quick.period'), true)}
      {item('symptoms', tr('today.quick.symptoms'))}
      {item('temperature', tr('today.quick.temperature'))}
    </View>
  );
  return Platform.OS === 'ios' ? (
    <BlurView intensity={40} tint={t.scheme === 'dark' ? 'dark' : 'light'} style={{ borderRadius: 999, overflow: 'hidden', borderWidth: 1, borderColor: t.hairline }}>{row}</BlurView>
  ) : (
    <View style={{ borderRadius: 999, backgroundColor: t.chipBg, elevation: 3 }}>{row}</View>
  );
}
