import { act, cleanup, renderHook } from '@testing-library/react';
import type { ScrollView } from 'react-native';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useDevParams, useDevScroll } from './devParams';

const route = vi.hoisted(() => ({ params: {} as Record<string, string> }));
vi.mock('expo-router', () => ({ useLocalSearchParams: () => route.params }));

beforeEach(() => { vi.useFakeTimers(); Object.assign(globalThis, { __DEV__: true }); });
afterEach(() => { cleanup(); vi.useRealTimers(); route.params = {}; Reflect.deleteProperty(globalThis, '__DEV__'); });

it('keeps well-formed values and drops the rest', () => {
  route.params = { day: '2026-11-02', sheet: 'large', tab: 'charts', scroll: 'estimates' };
  expect(renderHook(() => useDevParams()).result.current).toEqual({ day: '2026-11-02', sheet: 'large', tab: 'charts', scroll: 'estimates' });
  route.params = { day: '2 Nov', sheet: 'huge' };
  expect(renderHook(() => useDevParams()).result.current).toEqual({});
});

it('reads nothing outside a development build', () => {
  Reflect.deleteProperty(globalThis, '__DEV__');
  route.params = { day: '2026-11-02', sheet: 'large', scroll: 'top' };
  expect(renderHook(() => useDevParams()).result.current).toEqual({});
});

it('scrolls the named section to the top, with an offset; `top` leaves the first paint alone', () => {
  const scrollTo = vi.fn();
  route.params = { scroll: 'estimates@-40' };
  const { result, rerender } = renderHook(() => useDevScroll());
  (result.current.scrollRef as { current: unknown }).current = { scrollTo } as unknown as ScrollView;
  const layout = (y: number) => ({ nativeEvent: { layout: { y } } }) as never;
  act(() => { result.current.anchor('footer').onLayout?.(layout(900)); result.current.anchor('estimates').onLayout?.(layout(500)); });
  act(() => { vi.advanceTimersByTime(400); });
  expect(scrollTo).toHaveBeenLastCalledWith({ y: 460, animated: false });
  scrollTo.mockClear();
  route.params = { scroll: 'top' };
  rerender();
  act(() => { vi.advanceTimersByTime(400); });
  // scrollTo(0) would put the title under the status bar (the automatic content inset is not part of the offset): do not scroll at all
  expect(scrollTo).not.toHaveBeenCalled();
});

it('hands out no layout handlers outside a development build', () => {
  Reflect.deleteProperty(globalThis, '__DEV__');
  expect(renderHook(() => useDevScroll()).result.current.anchor('x')).toEqual({});
});
