// Bottom sheet that asks for the password of a Clue zip. The typed text lives only in SheetBody's state: the body is unmounted when the
// sheet closes, so nothing is kept, persisted or logged. Wrong password: the sheet stays, keeps the text and shows it.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { AskPassword } from '@/services/exportImport';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Text } from '@/ui/Text';

interface SheetProps { attempt: 'first' | 'wrong'; fileName?: string | undefined; submitting: boolean; onSubmit: (password: string) => void; onCancel: () => void }

function Eye({ off, color }: { off: boolean; color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M2 11C4 7 7.3 5 11 5s7 2 9 6c-2 4-5.3 6-9 6s-7-2-9-6Z" stroke={color} fill="none" strokeWidth={1.7} strokeLinejoin="round" />
      <Path d="M11 8.5A2.5 2.5 0 1 0 11 13.5 2.5 2.5 0 0 0 11 8.5Z" stroke={color} fill="none" strokeWidth={1.7} />
      {off ? <Path d="M3.5 3.5L18.5 18.5" stroke={color} strokeWidth={1.7} strokeLinecap="round" /> : null}
    </Svg>
  );
}

function SheetBody({ attempt, fileName, submitting, onSubmit, onCancel }: SheetProps) {
  const th = useTheme();
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [show, setShow] = useState(false);
  // after a wrong password she can compare what she typed with Clue's screen
  useEffect(() => { if (attempt === 'wrong') setShow(true); }, [attempt]);
  const wrong = attempt === 'wrong' && !submitting;
  const canOpen = text !== '' && !submitting;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
      <View testID="password-sheet" accessibilityViewIsModal aria-modal style={{ maxHeight: '92%', backgroundColor: th.cardBg, borderTopLeftRadius: th.radius.sheet, borderTopRightRadius: th.radius.sheet }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingTop: 12, gap: 14 }}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: th.hairline }} />
          <Text variant="heading" accessibilityRole="header" style={{ textAlign: 'center' }}>{t('settings.importClue.sheet.title')}</Text>
          {fileName ? (
            <View testID="password-sheet-file" style={{ borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: th.chipBg }}>
              <Text variant="bodySmall" color="textSecondary">{fileName}</Text>
            </View>
          ) : null}
          <Text variant="bodySmall" color="textSecondary">{t('settings.importClue.sheet.body')}</Text>
          <View style={{ gap: 6 }}>
            <Text variant="bodySmall" color="textSecondary" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{t('settings.importClue.sheet.label')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, borderRadius: th.radius.tile, backgroundColor: th.chipBg, borderWidth: 1.5, borderColor: wrong ? th.c.period : 'transparent', paddingLeft: 16 }}>
              <TextInput
                testID="password-input"
                accessibilityLabel={t('settings.importClue.sheet.a11yLabel')}
                value={text}
                onChangeText={setText}
                placeholder={t('settings.importClue.sheet.placeholder')}
                placeholderTextColor={th.c.textSecondary}
                secureTextEntry={!show}
                autoCorrect={false}
                autoCapitalize="none"
                spellCheck={false}
                textContentType="none"
                importantForAutofill="no"
                returnKeyType="done"
                onSubmitEditing={() => { if (canOpen) onSubmit(text); }}
                style={{ flex: 1, minHeight: 52, fontSize: 17, color: th.c.textPrimary }}
              />
              <Pressable testID="password-toggle" accessibilityRole="button" accessibilityLabel={show ? t('settings.importClue.sheet.hide') : t('settings.importClue.sheet.show')} onPress={() => setShow((s) => !s)} style={{ width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
                <Eye off={show} color={th.c.textSecondary} />
              </Pressable>
            </View>
          </View>
          <View accessibilityLiveRegion="polite">
            {wrong ? <Text testID="password-error" variant="bodySmall" accessibilityRole="alert" style={{ color: th.c.period }}>{t('settings.importClue.sheet.wrong')}</Text> : null}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Button testID="password-cancel" kind="secondary" label={t('common.cancel')} onPress={onCancel} style={{ flex: 1, minWidth: 120 }} />
            <Button testID="password-open" label={t('settings.importClue.sheet.open')} disabled={!canOpen} onPress={() => onSubmit(text)} style={{ flex: 1, minWidth: 120 }} />
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

export function PasswordSheet({ open, ...p }: SheetProps & { open: boolean }) {
  // not mounted while closed, so the typed password is dropped with the component
  return open ? <Modal transparent animationType="slide" visible onRequestClose={p.onCancel}><SheetBody {...p} /></Modal> : null;
}

/** `ask` is the `askPassword` of pickAndImport: it opens the sheet and resolves with the text, or undefined on Cancel. Render `sheet` once; call `close` when the flow ends. */
export function usePasswordPrompt() {
  const [st, setSt] = useState<{ open: boolean; attempt: 'first' | 'wrong'; fileName?: string | undefined; submitting: boolean }>({ open: false, attempt: 'first', submitting: false });
  const mounted = useRef(false);
  const resolver = useRef<((v: string | undefined) => void) | null>(null);
  const settle = useCallback((v: string | undefined) => { const r = resolver.current; resolver.current = null; r?.(v); }, []);
  const ask = useCallback((attempt: 'first' | 'wrong', fileName?: string): Promise<string | undefined> => new Promise((res) => {
    if (!mounted.current) { res(undefined); return; } // the host is gone: nothing could ever answer
    resolver.current?.(undefined); // a second ask never strands the first
    resolver.current = res;
    setSt({ open: true, attempt, fileName, submitting: false });
  }), []) as AskPassword & ((attempt: 'first' | 'wrong', fileName?: string) => Promise<string | undefined>);
  const close = useCallback(() => { settle(undefined); setSt((s) => ({ ...s, open: false, submitting: false })); }, [settle]);
  // the host screen going away must not leave pickAndImport waiting: its cleanup (removing the picked file) runs after the prompt settles
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; settle(undefined); }; }, [settle]);
  const sheet = (
    <PasswordSheet
      open={st.open} attempt={st.attempt} fileName={st.fileName} submitting={st.submitting}
      onSubmit={(pw) => { setSt((s) => ({ ...s, submitting: true })); settle(pw); }}
      onCancel={close} />
  );
  return { ask, close, sheet };
}
