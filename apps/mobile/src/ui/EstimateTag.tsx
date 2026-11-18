import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';

export function EstimateTag() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  return <View style={{ alignSelf: 'flex-start', borderRadius: 9, borderWidth: 1, borderColor: t.c.ovulation, paddingHorizontal: 7, paddingVertical: 1 }}><Text style={{ fontSize: 11, lineHeight: 17, fontWeight: '600', letterSpacing: 0.3, color: t.c.ovulation }}>{tr('contentKit.estimate')}</Text></View>;
}
