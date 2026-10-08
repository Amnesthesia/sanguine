import { useLocalSearchParams } from 'expo-router';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

// Placeholder; the logging sheet is P2-9.
export default function Log() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  return <Screen testID="screen-log" title="Log"><Text>{section}</Text></Screen>;
}
