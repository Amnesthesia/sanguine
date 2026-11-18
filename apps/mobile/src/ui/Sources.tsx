import { useTranslation } from 'react-i18next';
import { Card } from './Card';
import { Text } from './Text';

export function Cite({ n }: { n: number }) {
  const { t } = useTranslation();
  return <Text variant="caption" accessibilityLabel={t('contentKit.source', { n })} style={{ fontSize: 10, lineHeight: 17, transform: [{ translateY: -4 }] }}>{n}</Text>;
}

export function Sources({ items }: { items: string[] }) {
  return <Card>{items.map((item, i) => <Text key={`${i}-${item}`} variant="caption">{i + 1}. {item}</Text>)}</Card>;
}
