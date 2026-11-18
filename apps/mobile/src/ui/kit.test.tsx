import '@/i18n';
import { contrast, hexToRgb, over } from '@sanguine/ui-tokens';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Appearance } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from './Button';
import { Chips } from './Chips';
import { LoggedChip } from './LoggedChip';
import { Meter, confidenceLevel, evidenceLevel } from './Meter';
import { EstimateTag } from './EstimateTag';
import { CautionPanel } from './CautionPanel';
import { Sources, Cite } from './Sources';
import { SettingsRow, SwitchRow } from './SettingsRow';
import { Card } from './Card';
import { Text } from './Text';
import { ThemeProvider } from '@/theme';
import { buildTheme } from '@/theme';
import { elevation } from '@sanguine/ui-tokens';

afterEach(cleanup);
const t = buildTheme('light', 'ios');
describe('content kit', () => {
  it('removes a labelled logged entry', () => {
    const remove = vi.fn();
    render(<LoggedChip label="Flow: medium" mark="flow" onRemove={remove} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove: Flow: medium' }));
    expect(remove).toHaveBeenCalledOnce();
  });
  it.each([0, 1, 2, 3] as const)('renders %i filled meter bars and the word', (level) => {
    render(<Meter level={level} word="Confidence" />);
    expect(screen.getByLabelText('Confidence')).toBeTruthy();
    expect(screen.getAllByTestId('meter-bar').filter((bar) => bar.style.backgroundColor === 'rgb(31, 26, 28)')).toHaveLength(level);
  });
  it('maps every confidence and evidence grade', () => {
    expect(['none', 'low', 'medium', 'high'].map(c => confidenceLevel(c as Parameters<typeof confidenceLevel>[0]))).toEqual([0, 1, 2, 3]);
    expect(['general', 'early', 'some', 'strong'].map(e => evidenceLevel(e as Parameters<typeof evidenceLevel>[0]))).toEqual([0, 1, 2, 3]);
  });
  it('announces selection without an accent fill', () => {
    render(<Chips options={[{ value: 'a', label: 'A' }]} value="a" onChange={() => {}} />);
    const chip = screen.getByRole('radio', { name: 'A' });
    expect(chip.getAttribute('aria-selected')).toBe('true');
    expect(chip.style.backgroundColor).toBe('rgb(244, 220, 224)');
  });
  it('reserves accent fill for primary buttons and supports an icon', () => {
    render((['primary', 'secondary', 'text', 'destructive'] as const).map(kind => <Button key={kind} kind={kind} label={kind} icon={<Text>+</Text>} />));
    expect(screen.getAllByRole('button').filter(b => b.style.backgroundColor === 'rgb(188, 69, 96)')).toEqual([screen.getByRole('button', { name: 'primary' })]);
    expect(screen.getByRole('button', { name: 'primary' }).textContent).toContain('+');
  });
  it('draws a card with the soft shadow, no border and the 26 pt radius', () => {
    render(<Card testID="card">x</Card>);
    const el = screen.getByTestId('card');
    expect(el.style.boxShadow).toBe(elevation.card.boxShadow);
    expect(['', '0px'].includes(el.style.borderWidth)).toBe(true);
    expect(el.style.borderTopLeftRadius).toBe('26px');
  });
  it('numbers sources, keeps duplicates apart and labels the citation', () => {
    render(<><Sources items={['Same', 'Same']} /><Cite n={2} /></>);
    expect(screen.getAllByText(/Same/)).toHaveLength(2);
    expect(screen.getByLabelText('Source 2')).toBeTruthy();
  });
  it('estimate tag border matches the frame (ovulation at 45% over the card)', () => {
    render(<EstimateTag />);
    const box = screen.getByText('ESTIMATE').parentElement as HTMLElement;
    const [r, g, b] = hexToRgb(over(t.c.ovulation, 0.45, t.cardBg));
    expect(box.style.borderTopColor).toBe(`rgb(${r}, ${g}, ${b})`);
  });
  it('renders estimate, caution and numbered sources', () => {
    render(<><EstimateTag /><CautionPanel>Check dates</CautionPanel><Sources items={['Reference one', 'Reference two']} /><Cite n={2} /></>);
    expect(screen.getByText('ESTIMATE')).toBeTruthy();
    expect(screen.getByText('Check dates')).toBeTruthy();
    expect(screen.getByText('1. Reference one')).toBeTruthy();
    expect(screen.getByText('2. Reference two')).toBeTruthy();
  });
  it('adds a round rose settings icon without changing the action', () => {
    const press = vi.fn();
    render(<SettingsRow title="Tracking" leadingIcon={<Text>♡</Text>} onPress={press} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tracking' }));
    expect(press).toHaveBeenCalledOnce();
    expect(screen.getByText('♡').parentElement?.style.backgroundColor).toBe('rgb(244, 220, 224)');
  });
});

describe('switch thumb', () => {
  it('stays light against the off track in dark', () => {
    (Appearance as unknown as { setColorScheme: () => void }).setColorScheme = () => {};
    render(<ThemeProvider pref="dark"><SwitchRow title="Dark switch" value={false} onChange={() => {}} /></ThemeProvider>);
    const d = buildTheme('dark', 'ios');
    const root = screen.getAllByRole('switch', { name: 'Dark switch' })[0] as HTMLElement;
    const colours = Array.from(root.querySelectorAll('div')).map(e => e.style.backgroundColor).filter(Boolean);
    const hex = (rgb: string) => '#' + (rgb.match(/\d+/g) as string[]).slice(0, 3).map(n => Number(n).toString(16).padStart(2, '0')).join('');
    const [track, thumb] = colours.map(hex) as [string, string];
    expect(track).toBe(d.c.border.toLowerCase());
    expect(contrast(thumb, track)).toBeGreaterThanOrEqual(3);
  });
});

describe('text contrast', () => {
  it.each(['light', 'dark'] as const)('meets 4.5:1 in %s', scheme => {
    const { c, cardBg } = buildTheme(scheme, 'ios');
    for (const [fg, bg] of [
      [c.textPrimary, cardBg], [c.textSecondary, cardBg],
      [c.onAccentSoft, c.accentSoft], [c.ovulation, cardBg],
      [c.period, cardBg], [c.onAccentSoft, cardBg],
      [scheme === 'dark' ? c.bg : c.surface, c.accent],
      [c.cautionText, over(scheme === 'dark' ? c.caution : c.flag, 0.1, cardBg)],
    ] as const) expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});
