import type { ReactNode } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { useTheme } from '@/theme';
import { Card } from './Card';
import { Text } from './Text';

/** Grouped list container (inset grouped list on iOS, tonal container on Android). */
export function Group({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <View style={{ gap: 6 }}>
      {title ? <Text variant="caption" color="textSecondary" accessibilityRole="header" style={{ marginLeft: 8, textTransform: 'uppercase' }}>{title}</Text> : null}
      <Card style={{ padding: 0, gap: 0 }}>{children}</Card>
    </View>
  );
}

/** Row with a title, optional description and a trailing accessory. The whole row is the target (min 56 pt). */
export function SettingsRow({ title, description, right, onPress, testID, destructive, last, disabled }: {
  title: string; description?: string | undefined; right?: ReactNode; onPress?: () => void; testID?: string; destructive?: boolean; last?: boolean; disabled?: boolean;
}) {
  const t = useTheme();
  const body = (
    <View style={{ minHeight: 56, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.hairline, opacity: disabled ? 0.5 : 1 }}>
      <View style={{ flex: 1 }}>
        <Text style={destructive ? { color: t.c.period } : undefined}>{title}</Text>
        {description ? <Text variant="bodySmall" color="textSecondary">{description}</Text> : null}
      </View>
      {right ?? (onPress ? <Text color="textSecondary" accessibilityElementsHidden>›</Text> : null)}
    </View>
  );
  return onPress ? (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={description ? `${title}. ${description}` : title} aria-disabled={disabled} disabled={disabled} onPress={onPress} style={{ minHeight: 56 }}>{body}</Pressable>
  ) : (
    <View testID={testID}>{body}</View>
  );
}

export function SwitchRow({ title, description, value, onChange, testID, last, disabled }: { title: string; description?: string; value: boolean; onChange: (v: boolean) => void; testID?: string; last?: boolean; disabled?: boolean }) {
  const t = useTheme();
  return (
    <SettingsRow
      title={title} description={description} last={last} disabled={disabled}
      right={<Switch testID={testID} accessibilityLabel={title} value={value} disabled={disabled} onValueChange={onChange} trackColor={{ true: t.c.accent }} thumbColor={t.scheme === 'dark' ? '#F4EEEF' : '#FFFFFF'} />}
    />
  );
}
