// Import from Clue (backlog P5-1): a four-step guide, the one button that runs the import, and the result or error at the top.
// Design: docs/design/clue-import (frames, COPY.md). The password sheet and the import run are shared with Settings > Privacy.
import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useImport } from '@/features/import/useImport';
import { useFontScale } from '@/ui/useFontScale';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { SubScreen } from '@/ui/SubScreen';
import { Text } from '@/ui/Text';

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const;

/** Where to tap, as chips. Decoration for the sentence above it: the row is one labelled element and the chips are not interactive. */
function Crumbs({ items }: { items: string[] }) {
  const th = useTheme();
  const { t } = useTranslation();
  const path = items.join(`${t('settings.importClue.crumbsJoin')} `);
  return (
    <View testID="import-clue-crumbs" accessible accessibilityLabel={t('settings.importClue.crumbsA11y', { path })} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
      {items.map((c, i) => (
        <Fragment key={c}>
          {i > 0 ? <Svg width={14} height={14} viewBox="0 0 14 14" {...hidden}><Path d="M5 2.5L9.5 7L5 11.5" stroke={th.c.textSecondary} fill="none" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></Svg> : null}
          <View style={{ minHeight: 32, justifyContent: 'center', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 16, backgroundColor: th.chipBg }}>
            <Text variant="bodySmall" style={{ fontWeight: '500' }}>{c}</Text>
          </View>
        </Fragment>
      ))}
    </View>
  );
}

function Inset({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  const th = useTheme();
  return (
    <View accessible accessibilityLabel={`${label}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, backgroundColor: th.chipBg, paddingVertical: 10, paddingHorizontal: 12 }}>
      <View {...hidden}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text variant="caption" color="textSecondary">{label}</Text>
        {children}
      </View>
    </View>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  const th = useTheme();
  const { t } = useTranslation();
  const size = 30 * Math.min(useFontScale(), 1.5);
  return (
    <Card testID={`import-clue-step-${n}`} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <View {...hidden} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: th.c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="bodySmall" color="onAccentSoft" style={{ fontWeight: '700' }}>{n}</Text>
      </View>
      <View style={{ flex: 1, gap: 8 }}>
        <Text variant="heading" accessibilityRole="header" accessibilityLabel={`${t('settings.importClue.stepA11y', { n })} ${title}`}>{title}</Text>
        {children}
      </View>
    </Card>
  );
}

export default function ImportClueScreen() {
  const { t } = useTranslation();
  const th = useTheme();
  const imp = useImport();
  const android = Platform.OS === 'android';
  const o = imp.outcome;
  const line = { fill: 'none', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  const choose = () => void imp.start();
  return (
    <SubScreen testID="screen-import-clue" title={t('settings.importClue.title')}>
      {o?.kind === 'done' ? (
        // The design system has no result card: this is a Card with a green tick (the frames' Result), not the amber caution panel.
        <Card testID="import-clue-result" accessibilityLiveRegion="polite" style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Svg width={28} height={28} viewBox="0 0 28 28" {...hidden}><Circle cx={14} cy={14} r={12} stroke={th.c.success} {...line} /><Path d="M8.5 14.5L12.5 18.5L19.5 10" stroke={th.c.success} {...line} /></Svg>
            <Text variant="heading" accessibilityRole="header" style={{ flex: 1 }}>{o.parts.paras[0]}</Text>
          </View>
          {o.parts.paras.slice(1).map((p) => <Text key={p}>{p}</Text>)}
          {o.parts.problems.length > 0 ? (
            <View testID="import-clue-not-imported" style={{ gap: 6, borderTopWidth: 1, borderTopColor: th.hairline, paddingTop: 12 }}>
              <Text variant="caption" color="textSecondary" accessibilityRole="header" style={{ fontWeight: '600', textTransform: 'uppercase' }}>{t('settings.importClue.result.notImported')}</Text>
              {o.parts.problems.map((p) => <Text key={p}>{p}</Text>)}
              {o.parts.more ? <Text>{o.parts.more}</Text> : null}
              <Text variant="bodySmall" color="textSecondary">{t('settings.importClue.result.notImportedNote')}</Text>
            </View>
          ) : null}
        </Card>
      ) : null}
      {o?.kind === 'failed' ? <View testID="import-clue-error" accessibilityLiveRegion="polite" style={{ borderRadius: 16, padding: 12, backgroundColor: th.c.cautionBg }}><Text variant="caption" style={{ color: th.c.cautionText }}>{o.text}</Text></View> : null}
      {o?.kind === 'cannotOpen' ? (
        <View testID="import-clue-cannot-open" accessibilityLiveRegion="polite" style={{ borderRadius: 16, padding: 14, gap: 8, backgroundColor: th.c.cautionBg }}>
          <Text variant="heading" accessibilityRole="header" style={{ color: th.c.cautionText }}>{t('settings.importClue.cannotOpen.title')}</Text>
          <Text variant="bodySmall" style={{ color: th.c.cautionText }}>{t('settings.importClue.cannotOpen.body')}</Text>
          <Button testID="import-clue-retry" kind="secondary" label={t('settings.importClue.cannotOpen.button')} disabled={imp.busy} onPress={choose} />
        </View>
      ) : null}

      <Text variant="bodySmall" color="textSecondary" style={{ marginHorizontal: 4 }}>{t('settings.importClue.intro')}</Text>

      <Step n={1} title={t('settings.importClue.step1.title')}>
        <Text>{t('settings.importClue.step1.body')}</Text>
        <Crumbs items={[t('settings.importClue.step1.crumbs.more'), t('settings.importClue.step1.crumbs.settings'), t('settings.importClue.step1.crumbs.download')]} />
      </Step>
      <Step n={2} title={t('settings.importClue.step2.title')}>
        <Text>{t('settings.importClue.step2.body')}</Text>
        <Inset label={t('settings.importClue.step2.drawing')} icon={<Svg width={22} height={22} viewBox="0 0 22 22"><Circle cx={6.5} cy={11} r={3.5} stroke={th.c.textSecondary} {...line} /><Path d="M10 11H19M16 11V14M19 11V13.5" stroke={th.c.textSecondary} {...line} /></Svg>}>
          <Text style={{ letterSpacing: 2 }}>{'••••  ••••  ••••'}</Text>
        </Inset>
      </Step>
      <Step n={3} title={t('settings.importClue.step3.title')}>
        <Text>{t(android ? 'settings.importClue.step3.bodyAndroid' : 'settings.importClue.step3.body')}</Text>
        <Crumbs items={[t('settings.importClue.step3.crumbs.email'), t('settings.importClue.step3.crumbs.link'), t(android ? 'settings.importClue.step3.crumbs.saveAndroid' : 'settings.importClue.step3.crumbs.save')]} />
        <Inset label={t('settings.importClue.step3.fileLabel')} icon={<Svg width={22} height={22} viewBox="0 0 22 22"><Path d="M5 2.5H13L17 6.5V19.5H5Z" stroke={th.c.textSecondary} {...line} /></Svg>}>
          <Text testID="import-clue-filename">{t('settings.importClue.step3.fileName')}</Text>
        </Inset>
      </Step>
      <Step n={4} title={t('settings.importClue.step4.title')}>
        <Text>{t('settings.importClue.step4.body')}</Text>
        <Button testID="import-clue-choose" label={t('settings.importClue.step4.button')} disabled={imp.busy || !imp.ready} onPress={choose} />
        <Text variant="bodySmall" color="textSecondary">{t('settings.importClue.step4.ownEntries')}</Text>
      </Step>

      <Text variant="bodySmall" color="textSecondary" style={{ marginHorizontal: 4 }}>{t('settings.importClue.unzipped')}</Text>
      <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Svg width={22} height={22} viewBox="0 0 22 22" {...hidden}><Rect x={4} y={9.5} width={14} height={10} rx={3} stroke={th.c.accent} {...line} /><Path d="M7.5 9.5V7A3.5 3.5 0 0 1 14.5 7V9.5" stroke={th.c.accent} {...line} /></Svg>
        <Text style={{ flex: 1 }}>{t('settings.importClue.privacy')}</Text>
      </Card>
      {imp.sheet}
    </SubScreen>
  );
}
