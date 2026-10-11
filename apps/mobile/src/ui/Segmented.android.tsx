// Material 3 single-choice segmented buttons through @expo/ui (the native Android control; iOS: Segmented.tsx). Selected
// segment on the primary container with the check mark M3 draws, colours from the D-066 roles like QuickLogRow.
import { Host, SegmentedButton, SingleChoiceSegmentedButtonRow, Text as M3Text } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, testID } from '@expo/ui/jetpack-compose/modifiers';
import { m3 } from '@sanguine/ui-tokens';
import { useTheme } from '@/theme';

export function Segmented<T extends string>({ options, value, onChange, testIDPrefix }: { options: Array<{ value: T; label: string }>; value: T; onChange: (v: T) => void; testIDPrefix?: string }) {
  const t = useTheme();
  const m = m3[t.scheme === 'dark' ? 'dark' : 'light'];
  return (
    <Host matchContents={{ vertical: true }} seedColor={t.c.accent} colorScheme={t.scheme} style={{ alignSelf: 'stretch' }}>
      <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
        {options.map((o) => (
          <SegmentedButton
            key={o.value} selected={o.value === value} onClick={() => onChange(o.value)}
            colors={{ activeContainerColor: m.primaryContainer, inactiveContainerColor: m.surfaceContainer, activeBorderColor: m.outlineVariant, inactiveBorderColor: m.outlineVariant }}
            modifiers={testIDPrefix ? [testID(`${testIDPrefix}-${o.value}`)] : undefined}>
            <SegmentedButton.Label><M3Text>{o.label}</M3Text></SegmentedButton.Label>
          </SegmentedButton>
        ))}
      </SingleChoiceSegmentedButtonRow>
    </Host>
  );
}
