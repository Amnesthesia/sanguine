// The system segmented control on iOS: a SwiftUI Picker in the segmented style through @expo/ui, so it is the native control
// (Liquid Glass on iOS 26) rather than a drawn copy. Android: Segmented.android.tsx. The segments announce their own label and
// selected state; Maestro taps them by text, because the native control has one accessibility id for the whole row.
// Labels use a Dynamic Type text style so they follow the text size (I1; UNVERIFIED on a device: a UISegmentedControl may ignore it).
// `inGlass` drops the surface when the control sits in a GlassBar's second row.
import { Host, Picker, Text } from '@expo/ui/swift-ui';
import { font, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { GlassSurface } from './GlassBar';
import { useTheme } from '@/theme';

export function Segmented<T extends string>({ options, value, onChange, testIDPrefix, inGlass }: { inGlass?: boolean; options: Array<{ value: T; label: string }>; value: T; onChange: (v: T) => void; testIDPrefix?: string }) {
  const t = useTheme();
  const control = (
    <Host matchContents={{ vertical: true }} colorScheme={t.scheme} style={{ alignSelf: 'stretch' }}>
      <Picker testID={testIDPrefix} selection={value} onSelectionChange={(v) => onChange(v as T)} modifiers={[pickerStyle('segmented')]}>
        {options.map((o) => <Text key={o.value} modifiers={[tag(o.value), font({ textStyle: 'subheadline' })]}>{o.label}</Text>)}
      </Picker>
    </Host>
  );
  // `inGlass`: already inside a glass toolbar, where a second glass layer would not sample anything; the native control draws its own track
  return inGlass ? control : <GlassSurface flat>{control}</GlassSurface>;
}
