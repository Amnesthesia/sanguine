import { over } from '@sanguine/ui-tokens';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';

// Spec: #3F6F88 on a card, #2F5568 on glass (light). In dark the ovulation colour already reads on glass.
const ON_GLASS_LIGHT = '#2F5568';

/** `onGlass`: the tag sits on a glass surface (a hero card with the material), where the lighter card blue falls short. */
export function EstimateTag({ onGlass }: { onGlass?: boolean | undefined } = {}) {
  const t = useTheme();
  const ink = onGlass && t.scheme === 'light' ? ON_GLASS_LIGHT : t.c.ovulation;
  const { t: tr } = useTranslation();
  return <View style={{ alignSelf: 'flex-start', borderRadius: 9, borderWidth: 1, borderColor: onGlass ? `${ink}73` : over(ink, 0.45, t.cardBg), paddingHorizontal: 7, paddingVertical: 1 }}><Text style={{ fontSize: 11, lineHeight: 17, fontWeight: '600', letterSpacing: 0.3, color: ink }}>{tr('contentKit.estimate')}</Text></View>;
}
