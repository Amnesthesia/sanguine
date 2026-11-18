// Changing the system text size while the app runs must give every Text a fresh native view, so the native text
// is measured again at the new size (device report X6: clipped glyphs after going up, oversized cards after going back).
import { cleanup, render, screen } from '@testing-library/react';
import { Appearance } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/theme';

const font = vi.hoisted(() => ({ scale: 1 }));
vi.mock('@/ui/useFontScale', () => ({ LARGE: 1.3, useFontScale: () => font.scale }));
import { Text } from './Text';

(Appearance as unknown as { setColorScheme: () => void }).setColorScheme = () => {};
afterEach(() => {
  cleanup();
  font.scale = 1;
});

const tree = () => (
  <ThemeProvider pref="light">
    <Text>Today</Text>
    <Text variant="title">Log</Text>
  </ThemeProvider>
);

describe('Text follows a text-size change without a relaunch', () => {
  it('keeps the same native view while the size stays put', () => {
    const { rerender } = render(tree());
    const before = screen.getByText('Today');
    rerender(tree());
    expect(screen.getByText('Today')).toBe(before);
  });

  it.each([1.5, 1.0])('gives every Text a fresh native view when the size changes to %s', (next) => {
    font.scale = next === 1.0 ? 1.5 : 1;
    const { rerender } = render(tree());
    const [today, log] = [screen.getByText('Today'), screen.getByText('Log')];
    font.scale = next;
    rerender(tree());
    expect(screen.getByText('Today')).not.toBe(today);
    expect(screen.getByText('Log')).not.toBe(log);
  });
});
