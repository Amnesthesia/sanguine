// The system segmented control on iOS: a SwiftUI Picker in the segmented style through @expo/ui, so it is the native control
// (Liquid Glass on iOS 26) rather than a drawn copy. Android: Segmented.android.tsx. The segments announce their own label and
// selected state; Maestro taps them by text, because the native control has one accessibility id for the whole row.
import { Host, Picker, Text } from '@expo/ui/swift-ui';
import { pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { useTheme } from '@/theme';

export function Segmented<T extends string>({ options, value, onChange, testIDPrefix }: { options: Array<{ value: T; label: string }>; value: T; onChange: (v: T) => void; testIDPrefix?: string }) {
  const t = useTheme();
  return (
    <Host matchContents={{ vertical: true }} colorScheme={t.scheme} style={{ alignSelf: 'stretch' }}>
      <Picker testID={testIDPrefix} selection={value} onSelectionChange={(v) => onChange(v as T)} modifiers={[pickerStyle('segmented')]}>
        {options.map((o) => <Text key={o.value} modifiers={[tag(o.value)]}>{o.label}</Text>)}
      </Picker>
    </Host>
  );
}
