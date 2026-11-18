// Log today: one button to the log sheet (D-097), floating above the tab bar (D-099). The shared floating material (GlassSurface: Liquid Glass, Reduce Transparency
// surface, older-iOS blur, opaque elsewhere) holding the kit primary Button, the same solid accent capsule as the Calendar day sheet's Log button. Never a
// tinted glass inside the glass: on a device that drew black (owner, iPhone, 2026-11-18). Android: QuickLogRow.android.tsx.
import type { ISODate } from '@sanguine/engine';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { GlassSurface } from '@/ui/GlassBar';
import { Text } from '@/ui/Text';

// ponytail: the same glyph as the Calendar day sheet's Plus; move both to the kit if a third button needs it
const Plus = ({ color }: { color: string }) => <Svg width={16} height={16} viewBox="0 0 16 16"><Path d="M8 2.5V13.5M2.5 8H13.5" stroke={color} strokeWidth={2.2} strokeLinecap="round" /></Svg>;

/** `title` and `subtitle` (Today: the date and cycle day) sit at the left of the pill, the one action at the right (frames). */
export function QuickLogRow({ day, label: shown, accessibilityLabel, title, subtitle, testID = 'quick-log' }: { day?: ISODate; label?: string; accessibilityLabel?: string; title?: string; subtitle?: string; testID?: string } = {}) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const router = useRouter();
  const label = shown ?? tr('today.quick.log');

  // one door to the log sheet: every section lives there (D-097)
  const go = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(day ? { pathname: '/log', params: { day } } : '/log');
  };
  return (
    <GlassSurface>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, paddingLeft: title ? 16 : 10 }}>
        {title ? (
          <View testID="quick-log-text" style={{ flex: 1, minWidth: 0 }}>
            <Text variant="heading" style={{ fontSize: 15, lineHeight: 20 }}>{title}</Text>
            {subtitle ? <Text variant="caption" color="textOnGlass">{subtitle}</Text> : null}
          </View>
        ) : null}
        <Button testID={testID} label={label} accessibilityLabel={accessibilityLabel ?? label} icon={<Plus color={t.scheme === 'dark' ? t.c.bg : t.c.surface} />} onPress={go} style={{ flexShrink: 0, flexGrow: title ? 0 : 1 }} />
      </View>
    </GlassSurface>
  );
}
