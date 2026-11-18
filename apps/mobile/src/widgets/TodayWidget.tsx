// iOS widgets (PLAN.md §8.3, §8.8, P3-5, D-047): the ring miniature and the day count on the home screen by default, nothing on
// the lock screen; the headline only when
// the user turns widget details on. Rendered by WidgetKit from a snapshot the app writes; the widget never reads the
// database. Inside the 'widget' function only @expo/ui/swift-ui, no hooks, no module-scope references.
import { Gauge, HStack, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, frame, gaugeStyle, minimumScaleFactor, padding, tint } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

/** What the app shares with the widget. `headline`/`detail` are present only when widget details are on. */
export type TodayWidgetProps = {
  /** 1-based day of cycle, or 0 when there is no open cycle. */
  day: number;
  /** Day as a fraction of the estimated cycle length (0..1) for the ring. */
  progress: number;
  /** Shown as the title: the app's name, or the discreet icon's name. */
  appName: string;
  /** The user opted in to details (Settings, Notifications and widgets). Lock-screen widgets show nothing about the cycle without it. */
  details: boolean;
  headline?: string;
  detail?: string;
};

function TodayWidget(props: TodayWidgetProps, env: WidgetEnvironment) {
  'widget';
  const dayText = props.day > 0 ? `Day ${props.day}` : 'No cycle yet';
  // Lock-screen widgets are readable without unlocking the phone, so they carry nothing about the cycle unless the user opted in (PLAN.md §8.8)
  const lockScreen = env.widgetFamily === 'accessoryCircular' || env.widgetFamily === 'accessoryRectangular' || env.widgetFamily === 'accessoryInline';
  if (lockScreen && !props.details) {
    return <Text modifiers={[font({ size: 14, weight: 'semibold' }), minimumScaleFactor(0.5)]}>{props.appName}</Text>;
  }
  if (env.widgetFamily === 'accessoryCircular') {
    return (
      <Gauge value={props.progress} min={0} max={1} modifiers={[gaugeStyle('circular')]} currentValueLabel={<Text modifiers={[font({ size: 18, weight: 'semibold' }), minimumScaleFactor(0.5)]}>{props.day > 0 ? String(props.day) : '–'}</Text>}>
        <Text>{dayText}</Text>
      </Gauge>
    );
  }
  if (env.widgetFamily === 'accessoryRectangular' || env.widgetFamily === 'accessoryInline') {
    return <Text modifiers={[font({ size: 14, weight: 'semibold' })]}>{props.headline ? `${dayText} · ${props.headline}` : dayText}</Text>;
  }
  // Card colours from the glass redesign frame (Widgets-Notifications): surface2 card, ink text, rose link, period-red ring. Literals, not
  // imports: WidgetKit serialises this function. widgets.test.ts keeps them equal to packages/ui-tokens and checks their contrast.
  const c = env.colorScheme === 'dark'
    ? { surface: '#2C2C2E', text: '#F4EEEF', sub: '#B3A8AC', link: '#E8869A', ring: '#D9607A' }
    : { surface: '#F3F3F4', text: '#1F1A1C', sub: '#6B6165', link: '#A3354F', ring: '#B8324A' };
  const ring = (
    <Gauge value={props.progress} min={0} max={1} modifiers={[gaugeStyle('circular'), tint(c.ring)]} currentValueLabel={<Text modifiers={[font({ size: 22, weight: 'semibold' }), foregroundStyle(c.text), minimumScaleFactor(0.5)]}>{props.day > 0 ? String(props.day) : '–'}</Text>}>
      <Text modifiers={[foregroundStyle(c.sub)]}>{dayText}</Text>
    </Gauge>
  );
  if (env.widgetFamily === 'systemSmall') {
    return (
      <VStack spacing={4} modifiers={[padding({ horizontal: 14, vertical: 14 }), containerBackground(c.surface, 'widget')]}>
        {ring}
        <Text modifiers={[font({ size: 14 }), foregroundStyle(c.text)]}>{dayText}</Text>
      </VStack>
    );
  }
  // systemMedium and larger: ring, app name, day or headline, optional detail, and a Period link (44 pt tall) that opens the flow picker
  return (
    <HStack spacing={14} modifiers={[padding({ horizontal: 14, vertical: 14 }), containerBackground(c.surface, 'widget')]}>
      {ring}
      <VStack alignment="leading" spacing={6}>
        <Text modifiers={[font({ size: 13 }), foregroundStyle(c.sub)]}>{props.appName}</Text>
        <Text modifiers={[font({ size: 17, weight: 'semibold' }), foregroundStyle(c.text)]}>{props.headline ?? dayText}</Text>
        {props.detail ? <Text modifiers={[font({ size: 13 }), foregroundStyle(c.sub)]}>{props.detail}</Text> : null}
        <Spacer />
        <Link destination="sanguine://log?section=period" label="Log period" modifiers={[font({ size: 14 }), foregroundStyle(c.link), frame({ minHeight: 44, alignment: 'leading' })]} />
      </VStack>
      <Spacer />
    </HStack>
  );
}

export default createWidget<TodayWidgetProps>('TodayWidget', TodayWidget);
