import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { ZipUnsupported } from '@/data/adapters/zipCrypto';
import { DEFAULT_PREFS } from '@/data/prefs';

const app = vi.hoisted(() => ({ updatePrefs: vi.fn(), refresh: vi.fn() }));
const pick = vi.hoisted(() => vi.fn());
vi.mock('@/state/app', () => ({ useApp: () => ({ db: {}, store: {}, prefs: DEFAULT_PREFS, updatePrefs: app.updatePrefs, refresh: app.refresh }) }));
vi.mock('@/ui/SubScreen', () => ({ SubScreen: ({ children, testID }: { children: ReactNode; testID: string }) => <div data-testid={testID}>{children}</div> }));
vi.mock('@/services/exportImport', () => ({ pickAndImport: (...a: unknown[]) => pick(...a) }));
vi.mock('react-native-svg', () => ({ default: ({ children }: { children?: ReactNode }) => <svg role="presentation">{children}</svg>, Path: () => null, Circle: () => null, Rect: () => null }));
import ImportClueScreen from '@/app/settings/import-clue';

beforeEach(() => { app.updatePrefs.mockReset(); app.refresh.mockReset(); pick.mockReset(); });
afterEach(cleanup);
const done = { kind: 'data', adapter: 'clue', result: { added: 12, skipped: 0, duplicates: 0, notesDropped: 0, kept: 2 }, problems: ['Weight x2'], symptoms: ['headache', 'pelvic_pain'] };

describe('Import from Clue guide', () => {
  it('shows four steps, the file name, the choose button and the privacy line', () => {
    render(<ImportClueScreen />);
    for (const n of [1, 2, 3, 4]) expect(screen.getByTestId(`import-clue-step-${n}`)).toBeTruthy();
    expect(screen.getByTestId('import-clue-filename').textContent).toBe('ClueDataDownload');
    expect(screen.getByTestId('import-clue-choose').getAttribute('aria-label')).toBe('Choose the Clue file');
    expect(screen.getByText(/Nothing is sent anywhere/)).toBeTruthy();
    // chips are one labelled element, not interactive
    expect(screen.getAllByTestId('import-clue-crumbs')[0]?.getAttribute('aria-label')).toBe('Where to tap: More, then Settings, then Download my data');
  });
  it('runs the import, passes askPassword, switches on new symptoms and shows the result card', async () => {
    pick.mockResolvedValueOnce(done);
    render(<ImportClueScreen />);
    fireEvent.click(screen.getByTestId('import-clue-choose'));
    await waitFor(() => expect(screen.getByTestId('import-clue-result')).toBeTruthy());
    expect(typeof (pick.mock.calls[0] as [unknown, unknown, { askPassword: unknown }])[2].askPassword).toBe('function');
    const text = screen.getByTestId('import-clue-result').textContent ?? '';
    expect(text).toContain('Imported 12 records.');
    expect(text).toContain('Kept your own entry on 2 days');
    expect(text).toContain('Weight x2');
    expect(app.refresh).toHaveBeenCalled();
    expect(app.updatePrefs).toHaveBeenCalledTimes(1); // headache is on by default: only the new code is added
    expect(text).toContain('pelvic pain');
    expect(text).not.toContain('headache');
  });
  it('asks for the password through the sheet and re-asks after a wrong one', async () => {
    pick.mockImplementationOnce(async (_d: unknown, _s: unknown, o: { askPassword: (a: 'first' | 'wrong') => Promise<string | undefined> }) => {
      expect(await o.askPassword('first')).toBe('bad');
      expect(await o.askPassword('wrong')).toBe('good');
      return done;
    });
    render(<ImportClueScreen />);
    fireEvent.click(screen.getByTestId('import-clue-choose'));
    await waitFor(() => expect(screen.getByTestId('password-sheet')).toBeTruthy());
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'bad' } });
    fireEvent.click(screen.getByTestId('password-open'));
    await waitFor(() => expect(screen.getByTestId('password-error')).toBeTruthy());
    expect((screen.getByTestId('password-input') as HTMLInputElement).value).toBe('bad');
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'good' } });
    await act(async () => { fireEvent.click(screen.getByTestId('password-open')); });
    await waitFor(() => expect(screen.getByTestId('import-clue-result')).toBeTruthy());
    expect(screen.queryByTestId('password-sheet')).toBeNull();
  });
  it('shows the cannot-open panel for an unsupported zip, with a button that picks again', async () => {
    pick.mockRejectedValueOnce(new ZipUnsupported('AES encryption')).mockResolvedValueOnce(done);
    render(<ImportClueScreen />);
    fireEvent.click(screen.getByTestId('import-clue-choose'));
    await waitFor(() => expect(screen.getByTestId('import-clue-cannot-open')).toBeTruthy());
    fireEvent.click(screen.getByTestId('import-clue-retry'));
    await waitFor(() => expect(screen.getByTestId('import-clue-result')).toBeTruthy());
    expect(pick).toHaveBeenCalledTimes(2);
  });
  it('shows other errors with their message and nothing when she cancels', async () => {
    pick.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ kind: 'cancelled' });
    render(<ImportClueScreen />);
    fireEvent.click(screen.getByTestId('import-clue-choose'));
    await waitFor(() => expect(screen.getByTestId('import-clue-error').textContent).toBe('That file could not be read. boom'));
    fireEvent.click(screen.getByTestId('import-clue-choose'));
    await waitFor(() => expect(screen.queryByTestId('import-clue-error')).toBeNull());
    expect(screen.queryByTestId('import-clue-result')).toBeNull();
  });
});
