import { Card } from './Card';
import { Text } from './Text';

export function Cite({ n }: { n: number }) {
  return <Text variant="caption" style={{ fontSize: 10, lineHeight: 17, transform: [{ translateY: -4 }] }}>{n}</Text>;
}

export function Sources({ items }: { items: string[] }) {
  return <Card>{items.map((item, i) => <Text key={item} variant="caption">{i + 1}. {item}</Text>)}</Card>;
}
