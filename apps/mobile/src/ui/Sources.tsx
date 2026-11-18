import { useTranslation } from 'react-i18next';
import { Card } from './Card';
import { Text } from './Text';

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';

export function Cite({ n }: { n: number }) {
  const { t } = useTranslation();
  // Unicode superscript digits: iOS ignores a transform or baseline offset on a Text nested in a Text, so the glyphs themselves are raised.
  return <Text variant="caption" accessibilityLabel={t('contentKit.source', { n })} style={{ fontSize: 13, lineHeight: 17 }}>{String(n).replace(/\d/g, (d) => SUPERSCRIPT[Number(d)] ?? d)}</Text>;
}

export function Sources({ items }: { items: string[] }) {
  return <Card>{items.map((item, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: two sources can read the same, so the position is part of the identity
    <Text key={`${i}-${item}`} variant="caption">{i + 1}. {item}</Text>
  ))}</Card>;
}
