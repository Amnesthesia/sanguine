// Development only (P8-24, tools/verify-screens): link parameters that put a screen in the state a design frame shows, without a tap.
// `sanguine://calendar?day=2026-11-02&sheet=large`, `sanguine://insights?tab=charts`, `sanguine://today?scroll=estimates`.
// Every value is ignored unless __DEV__ is true, so a release build never reads them. `typeof` because __DEV__ is not defined under vitest.
import type { ISODate } from '@sanguine/engine';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import type { LayoutChangeEvent, ScrollView } from 'react-native';

export type DevSheet = 'closed' | 'small' | 'large';
export interface DevParams { day?: ISODate; sheet?: DevSheet; tab?: string; scroll?: string }

const isDev = () => typeof __DEV__ !== 'undefined' && __DEV__;
const SHEETS: readonly string[] = ['closed', 'small', 'large'];

/** The validated dev parameters of the current route; `{}` outside a development build. */
export function useDevParams(): DevParams {
  // __DEV__ is fixed for a build, so this hook runs on every render or on none
  // biome-ignore lint/correctness/useHookAtTopLevel: __DEV__ is a build-time constant, so the hook runs on every render or on none
  const raw: Partial<Record<'day' | 'sheet' | 'tab' | 'scroll', string>> = isDev() ? useLocalSearchParams<{ day?: string; sheet?: string; tab?: string; scroll?: string }>() : {};
  const { day, sheet, tab, scroll } = raw;
  return {
    ...(day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? { day: day as ISODate } : {}),
    ...(sheet && SHEETS.includes(sheet) ? { sheet: sheet as DevSheet } : {}),
    ...(tab ? { tab } : {}),
    ...(scroll ? { scroll } : {}),
  };
}

/** `?scroll=top` scrolls to the top; `?scroll=<anchor>[@<offset>]` scrolls the named section to the top of the screen (plus the offset in
 *  points, negative to show what precedes it) once it is laid out. Give the screen `scrollRef` and each section a direct child of the scroll content `{...anchor(name)}`. */
export function useDevScroll() {
  const { scroll } = useDevParams();
  const [name = '', offset] = (scroll ?? '').split('@');
  const ref = useRef<ScrollView>(null);
  const ys = useRef(new Map<string, number>());
  const go = useCallback(() => {
    if (name === 'top') return; // the first paint is already at the top (the automatic content inset places the title below the status bar; scrollTo(0) would not)
    const y = ys.current.get(name);
    if (y !== undefined) ref.current?.scrollTo({ y: Math.max(0, y + (Number(offset) || 0)), animated: false });
  }, [name, offset]);
  useEffect(() => { if (name) setTimeout(go, 300); }, [name, go]);
  // positions are kept always, so a link that arrives while the screen is already open can scroll; after a layout the content may not be
  // tall enough yet, so the scroll is repeated a moment later
  const anchor = (section: string) => (isDev() ? { onLayout: (e: LayoutChangeEvent) => { ys.current.set(section, e.nativeEvent.layout.y); if (section === name) setTimeout(go, 300); } } : {});
  return { scrollRef: ref, anchor };
}
