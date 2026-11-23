import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { PasswordSheet, usePasswordPrompt } from './PasswordSheet';

vi.mock('react-native-svg', () => ({ default: ({ children }: { children?: ReactNode }) => <svg role="presentation">{children}</svg>, Path: () => null, Circle: () => null, Rect: () => null }));
afterEach(cleanup);

const base = { open: true, attempt: 'first' as const, submitting: false, onSubmit: vi.fn(), onCancel: vi.fn() };
const input = () => screen.getByTestId('password-input') as HTMLInputElement;
const open = () => screen.getByTestId('password-open');

describe('PasswordSheet', () => {
  it('has Open disabled while the field is empty and a labelled, masked, no-suggestion field', () => {
    render(<PasswordSheet {...base} fileName="ClueDataDownload-1798.zip" />);
    expect(open().getAttribute('aria-disabled')).toBe('true');
    expect(input().getAttribute('type')).toBe('password');
    expect(input().getAttribute('aria-label')).toBe("Clue's password");
    expect(input().getAttribute('autocorrect')).toBe('off');
    expect(input().getAttribute('spellcheck')).toBe('false');
    expect(screen.getByText('ClueDataDownload-1798.zip')).toBeTruthy();
    expect(screen.queryByTestId('password-error')).toBeNull();
    fireEvent.change(input(), { target: { value: 'Tq8m-V2rL' } });
    expect(open().getAttribute('aria-disabled')).not.toBe('true');
  });
  it('submits what was typed and cancels', () => {
    const onSubmit = vi.fn(); const onCancel = vi.fn();
    render(<PasswordSheet {...base} onSubmit={onSubmit} onCancel={onCancel} />);
    fireEvent.change(input(), { target: { value: 'Tq8m-V2rL' } });
    fireEvent.click(open());
    expect(onSubmit).toHaveBeenCalledWith('Tq8m-V2rL');
    fireEvent.click(screen.getByTestId('password-cancel'));
    expect(onCancel).toHaveBeenCalled();
  });
  it('the eye toggle swaps masking and its label', () => {
    render(<PasswordSheet {...base} />);
    const eye = screen.getByTestId('password-toggle');
    expect(eye.getAttribute('aria-label')).toBe('Show password');
    fireEvent.click(eye);
    expect(input().getAttribute('type')).not.toBe('password');
    expect(eye.getAttribute('aria-label')).toBe('Hide password');
  });
  it('after a wrong password it keeps the text, shows it and announces the error', () => {
    const { rerender } = render(<PasswordSheet {...base} />);
    fireEvent.change(input(), { target: { value: 'Tq8m-V2rL' } });
    rerender(<PasswordSheet {...base} attempt="wrong" />);
    expect(input().value).toBe('Tq8m-V2rL');
    expect(input().getAttribute('type')).not.toBe('password');
    expect(screen.getByTestId('password-error').textContent).toContain('capitals count');
    expect(open().getAttribute('aria-disabled')).not.toBe('true');
  });
  it('renders nothing when closed', () => {
    render(<PasswordSheet {...base} open={false} />);
    expect(screen.queryByTestId('password-sheet')).toBeNull();
  });
});

describe('usePasswordPrompt', () => {
  function Host({ onAsk }: { onAsk: (ask: ReturnType<typeof usePasswordPrompt>['ask']) => void }) {
    const p = usePasswordPrompt();
    onAsk(p.ask);
    return <>{p.sheet}</>;
  }
  it('resolves with the typed password, drops it on close, and resolves undefined on Cancel', async () => {
    let ask!: ReturnType<typeof usePasswordPrompt>['ask'];
    render(<Host onAsk={(a) => { ask = a; }} />);
    let got: Promise<string | undefined> = Promise.resolve(undefined);
    act(() => { got = ask('first'); });
    fireEvent.change(input(), { target: { value: 'pw1' } });
    fireEvent.click(open());
    await expect(got).resolves.toBe('pw1');
    act(() => { got = ask('wrong'); });
    expect(input().value).toBe('pw1'); // same sheet, text kept
    fireEvent.click(screen.getByTestId('password-cancel'));
    await expect(got).resolves.toBeUndefined();
    expect(screen.queryByTestId('password-sheet')).toBeNull();
  });
});
