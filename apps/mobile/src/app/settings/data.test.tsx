// P8-22: the settings data screens (health, privacy, backup, report, calendar export, legal) on the glass kit. Every progress, error and
// result state keeps its copy and shows in a caution panel, a toast or a disabled control; ids used by the Maestro flows stay.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Alert } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { DEFAULT_PREFS, type Prefs } from '@/data/prefs';

const app = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
const toast = vi.hoisted(() => vi.fn());
const svc = vi.hoisted(() => ({
  health: { driver: {} as object | null, request: vi.fn() },
  io: { share: vi.fn(), pick: vi.fn() },
  lock: { has: vi.fn() },
  cloud: { store: null as object | null, disable: vi.fn() },
  consent: { at: '2026-09-05T01:00:00Z' as string | null },
}));
vi.mock('@/state/app', () => ({ useApp: () => app.state }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }), useLocalSearchParams: () => ({}) }));
vi.mock('@/ui/SubScreen', () => ({ SubScreen: ({ children, testID }: { children: ReactNode; testID: string }) => <div data-testid={testID}>{children}</div> }));
vi.mock('@/ui/Toast', () => ({ showToast: toast }));
vi.mock('@/ui/Segmented', () => ({ Segmented: ({ options, onChange }: { options: Array<{ value: string; label: string }>; onChange: (v: string) => void }) => <div>{options.map((o) => <button key={o.value} type="button" onClick={() => onChange(o.value)}>{o.label}</button>)}</div> }));
vi.mock('react-native-svg', () => ({ default: ({ children }: { children?: ReactNode }) => <svg role="presentation"><title>icon</title>{children}</svg>, Path: () => null, Circle: () => null, Rect: () => null }));
vi.mock('@/services/health', () => ({ getHealthDriver: async () => svc.health.driver, healthPlatformName: () => 'Apple Health', requestHealthAccess: (...a: unknown[]) => svc.health.request(...a) }));
vi.mock('@/data/consent', () => ({ getConsent: async () => (svc.consent.at ? { at: svc.consent.at } : null) }));
vi.mock('@/services/exportImport', () => ({ shareExport: (...a: unknown[]) => svc.io.share(...a), pickAndImport: (...a: unknown[]) => svc.io.pick(...a) }));
vi.mock('@/services/lockAuth', () => ({ deviceHasLock: () => svc.lock.has() }));
vi.mock('@/services/discreet', () => ({ discreetIconSupported: () => true, setDiscreetIcon: async (on: boolean) => on }));
vi.mock('@sanguine/crypto', () => ({ BackupError: class extends Error { code = 'auth'; }, openBackup: vi.fn(), recoveryWordsToSecret: vi.fn(), secretToRecoveryWords: () => 'a b c' }));
vi.mock('@/data/backup', () => ({ createBackup: vi.fn(), restoreBackup: vi.fn() }));
vi.mock('@/data/exportImport', () => ({ importBundle: vi.fn() }));
vi.mock('@/data/settings', () => ({ getSetting: async (_db: unknown, _k: string, d: unknown) => d, setSetting: vi.fn() }));
vi.mock('@/services/clock', () => ({ deviceClock: {}, todayLocal: () => '2026-11-18' }));
vi.mock('@/services/secrets', () => ({ getDeviceSecret: vi.fn(), getOrCreateDeviceSecret: vi.fn(), setDeviceSecret: vi.fn() }));
vi.mock('@/services/backup', () => ({ pickBackupBytes: vi.fn() }));
vi.mock('@/services/argon2', () => ({ backupCrypto: () => ({}), nativeArgon2: () => null }));
vi.mock('@/services/shareFile', () => ({ shareFile: vi.fn() }));
vi.mock('@/features/lock/ScreenProtection', () => ({ NoCapture: () => null }));
vi.mock('@/services/cloud', () => ({
  BACKUP_NAME: 'b', BACKUP_PREV: 'p', cloudServiceName: () => 'iCloud Drive', getCloudStore: async () => svc.cloud.store,
  disableAutoBackup: (...a: unknown[]) => svc.cloud.disable(...a), enableAutoBackup: vi.fn(), uploadCloudIfDue: vi.fn(),
}));
vi.mock('@/services/report', () => ({ shareReportPdf: vi.fn() }));
vi.mock('@/features/share/ics', () => ({
  buildIcs: () => 'ics',
  calendarRanges: (_p: unknown, o: { fertile: boolean }) => ({ period: { lo: '2026-11-26', hi: '2026-11-30' }, ...(o.fertile ? { fertile: { lo: '2026-11-06', hi: '2026-11-18' } } : {}) }),
}));
vi.mock('@/services/shareCalendar', () => ({ nextCalendarExport: async () => ({ installId: 'i', sequence: 1 }), shareCalendarFile: vi.fn() }));
import HealthScreen from './health';
import PrivacyScreen from './privacy';
import BackupScreen from './backup';
import ReportScreen from './report';
import CalendarExportScreen from './calendar';
import LegalScreen from './legal';

const today = '2026-11-18';
const update = vi.fn();
const adult = { birthDate: '1990-01-01' };
const teen = { birthDate: '2011-06-01' };
const idle = { imported: 0, duplicates: 0, echoed: 0, retracted: 0, written: 0, failed: [] as string[] };
const setup = (prefs: Partial<Prefs> = {}, extra: Record<string, unknown> = {}, profile: Record<string, unknown> = adult) => {
  app.state = {
    db: {}, store: {}, today, prefs: { ...DEFAULT_PREFS, ...prefs }, profile, version: 0, updatePrefs: update, refresh: vi.fn(), deleteEverything: vi.fn(async () => {}),
    syncHealth: vi.fn(), resolveHealthAsk: vi.fn(), health: { asks: [], running: false, last: undefined, lastAt: undefined }, ...extra,
  };
};
/** react-native-web draws a Switch as a role=switch wrapper around the input: take the first match. */
const switchNamed = (name: string) => { const el = screen.queryAllByRole('switch', { name })[0]; return el?.querySelector('input') ?? el; };
const hasCaution = (testID: string) => within(screen.getByTestId(testID)).queryByText('ⓘ') !== null;
beforeEach(() => { update.mockClear(); toast.mockClear(); svc.health.driver = {}; svc.cloud.store = null; svc.consent.at = '2026-09-05T01:00:00Z'; setup(); });
afterEach(cleanup);

describe('health sync', () => {
  it('says "not available" in a caution panel and shows nothing else', async () => {
    svc.health.driver = null;
    render(<HealthScreen />);
    await waitFor(() => expect(screen.getByTestId('health-unavailable')).toBeTruthy());
    expect(hasCaution('health-unavailable')).toBe(true);
    expect(screen.queryByTestId('health-sync-now')).toBeNull();
  });
  it('is a card with the last sync, its result and a Sync now button that stays disabled until a type is on', async () => {
    setup({ healthTypes: [] }, { health: { asks: [], running: false, last: { ...idle, imported: 3 }, lastAt: '2026-11-18T08:12:00Z' } });
    render(<HealthScreen />);
    await waitFor(() => expect(screen.getByTestId('health-sync-now')).toBeTruthy());
    expect(screen.getByTestId('health-result').textContent).toBe('Added 3, matched 0 you already had, removed 0, wrote 0.');
    expect(screen.getByTestId('health-sync-now').getAttribute('aria-disabled')).toBe('true');
    // the status line, the result and the button share one card
    expect(screen.getByTestId('health-sync-card').contains(screen.getByTestId('health-last'))).toBe(true);
    expect(screen.getByTestId('health-sync-card').contains(screen.getByTestId('health-sync-now'))).toBe(true);
  });
  it('shows "Syncing…" on the disabled button while a sync runs', async () => {
    setup({ healthTypes: ['bbt'] }, { health: { asks: [], running: true, last: undefined, lastAt: undefined } });
    render(<HealthScreen />);
    await waitFor(() => expect(screen.getByText('Syncing…')).toBeTruthy());
    expect(screen.getByTestId('health-sync-now').getAttribute('aria-disabled')).toBe('true');
  });
  it('puts "could not be synced" and the empty-result hint in caution panels', async () => {
    setup({ healthTypes: ['bbt'] }, { health: { asks: [], running: false, last: { ...idle, failed: ['a', 'b'] }, lastAt: '2026-11-18T08:12:00Z' } });
    render(<HealthScreen />);
    await waitFor(() => expect(screen.getByTestId('health-failed')).toBeTruthy());
    expect(within(screen.getByTestId('health-failed')).getByText('2 could not be synced.')).toBeTruthy();
    expect(hasCaution('health-failed')).toBe(true);
    cleanup();
    setup({ healthTypes: ['bbt'] }, { health: { asks: [], running: false, last: idle, lastAt: '2026-11-18T08:12:00Z' } });
    render(<HealthScreen />);
    await waitFor(() => expect(screen.getByTestId('health-empty')).toBeTruthy());
    expect(hasCaution('health-empty')).toBe(true);
    expect(screen.getByTestId('health-open-settings')).toBeTruthy();
  });
  it('tells a refused permission in a toast and leaves the type off', async () => {
    svc.health.request.mockRejectedValueOnce(new Error('denied'));
    render(<HealthScreen />);
    await waitFor(() => expect(switchNamed('Period flow')).toBeTruthy());
    fireEvent.click(switchNamed('Period flow') as HTMLElement);
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Sanguine could not ask for access.'));
    expect(update).not.toHaveBeenCalled();
  });
  it('hides sexual activity under 18 and keeps the "Read only" wording on wrist temperature', async () => {
    setup({}, {}, teen);
    render(<HealthScreen />);
    await waitFor(() => expect(screen.getByTestId('health-row-bbt')).toBeTruthy());
    expect(screen.queryByTestId('health-row-sex')).toBeNull();
    expect(screen.getByText(/^Read only\./)).toBeTruthy();
  });
});

describe('privacy and data', () => {
  it('has the rows of the frame in their groups, all with the ids the flows tap', async () => {
    render(<PrivacyScreen />);
    for (const id of ['privacy-export', 'privacy-import', 'privacy-report', 'privacy-calendar', 'privacy-backup', 'privacy-lock', 'privacy-icon', 'privacy-protect', 'privacy-consent', 'privacy-delete']) expect(screen.getByTestId(id), id).toBeTruthy();
    // the discreet icon row carries a picture of the leaf
    expect(screen.getByText('Discreet app icon').parentElement?.parentElement?.querySelector('svg')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Given on 2026-09-05. To withdraw it, delete your data.')).toBeTruthy());
  });
  it('toasts "Export ready." and shows an export failure in a caution panel', async () => {
    svc.io.share.mockResolvedValueOnce(undefined);
    render(<PrivacyScreen />);
    fireEvent.click(screen.getByTestId('privacy-export'));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Export ready.'));
    svc.io.share.mockRejectedValueOnce(new Error('disk full'));
    fireEvent.click(screen.getByTestId('privacy-export'));
    await waitFor(() => expect(screen.getByTestId('privacy-message').textContent).toContain('The export could not be made. disk full'));
    expect(hasCaution('privacy-message')).toBe(true);
  });
  it('shows "Preparing…" and disables the export row while it runs', async () => {
    let done: () => void = () => {};
    svc.io.share.mockReturnValueOnce(new Promise<void>((r) => { done = r; }));
    render(<PrivacyScreen />);
    fireEvent.click(screen.getByTestId('privacy-export'));
    await waitFor(() => expect(screen.getByText('Preparing…')).toBeTruthy());
    expect(screen.getByTestId('privacy-export').getAttribute('aria-disabled')).toBe('true');
    await act(async () => { done(); });
  });
  it('shows the import result, skipped problems and dropped notes in an inline panel, not a toast', async () => {
    svc.io.pick.mockResolvedValueOnce({ kind: 'drip', symptoms: [], problems: ['row 3: bad date'], result: { added: 4, notesDropped: 2 } });
    render(<PrivacyScreen />);
    fireEvent.click(screen.getByTestId('privacy-import'));
    await waitFor(() => expect(screen.getByTestId('privacy-message')).toBeTruthy());
    const text = screen.getByTestId('privacy-message').textContent ?? '';
    expect(text).toContain('Imported 4 records.');
    expect(text).toContain('2 notes were skipped because the file has no notes column.');
    expect(text).toContain('Not everything could be imported: row 3: bad date');
    expect(hasCaution('privacy-message')).toBe(true);
    expect(toast).not.toHaveBeenCalled();
  });
  it('refuses the app lock without a screen lock and says why in the panel', async () => {
    svc.lock.has.mockResolvedValueOnce(false);
    render(<PrivacyScreen />);
    fireEvent.click(switchNamed('App lock') as HTMLElement);
    await waitFor(() => expect(screen.getByTestId('privacy-message').textContent).toContain('Turn on a screen lock on this phone first.'));
    expect(update).not.toHaveBeenCalled();
  });
  it('asks before deleting, with the destructive action last-named in the alert', () => {
    const alert = vi.spyOn(Alert, 'alert').mockImplementation(() => {});
    render(<PrivacyScreen />);
    fireEvent.click(screen.getByTestId('privacy-delete'));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0]?.[0]).toBe('Delete everything?');
    const buttons = alert.mock.calls[0]?.[2] ?? [];
    expect(buttons.map((b) => b.style)).toEqual(['cancel', 'destructive']);
    expect(buttons[1]?.text).toBe('Delete all my data');
    alert.mockRestore();
  });
  it('says so when no consent is recorded', async () => {
    svc.consent.at = null;
    render(<PrivacyScreen />);
    expect(screen.getByText('No consent is recorded on this phone.')).toBeTruthy();
    svc.consent.at = '2026-09-05T01:00:00Z';
  });
});

describe('encrypted backup', () => {
  it('toggles Back up and Restore, and offers the file picker when restoring', () => {
    render(<BackupScreen />);
    expect(screen.getByTestId('backup-create')).toBeTruthy();
    fireEvent.click(screen.getByText('Restore'));
    expect(screen.getByTestId('backup-restore')).toBeTruthy();
    expect(screen.getByTestId('restore-code')).toBeTruthy();
  });
  it('explains a too-short passphrase in a caution panel', () => {
    render(<BackupScreen />);
    fireEvent.change(screen.getByTestId('backup-pass'), { target: { value: 'short' } });
    fireEvent.change(screen.getByTestId('backup-pass2'), { target: { value: 'short' } });
    fireEvent.click(screen.getByTestId('backup-create'));
    expect(screen.getByTestId('backup-message').textContent).toContain('Use at least 8 characters.');
    expect(hasCaution('backup-message')).toBe(true);
  });
  it('explains mismatching passphrases in a caution panel', () => {
    render(<BackupScreen />);
    fireEvent.change(screen.getByTestId('backup-pass'), { target: { value: 'correct horse' } });
    fireEvent.change(screen.getByTestId('backup-pass2'), { target: { value: 'correct hose' } });
    fireEvent.click(screen.getByTestId('backup-create'));
    expect(screen.getByTestId('backup-message').textContent).toContain('The passphrases do not match.');
  });
  it('toasts "Cloud copy is off" when the automatic copy is switched off, naming the service', async () => {
    svc.cloud.store = { get: vi.fn() };
    setup({ cloudBackup: true });
    render(<BackupScreen />);
    await waitFor(() => expect(switchNamed('Keep a copy in iCloud Drive')).toBeTruthy());
    fireEvent.click(switchNamed('Keep a copy in iCloud Drive') as HTMLElement);
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.stringMatching(/^Cloud copy is off\..*iCloud Drive/)));
  });
  it('asks for the passphrase before restoring from the cloud copy', async () => {
    svc.cloud.store = { get: vi.fn() };
    render(<BackupScreen />);
    fireEvent.click(screen.getByText('Restore'));
    await waitFor(() => expect(screen.getByTestId('cloud-restore')).toBeTruthy());
    expect(screen.getByTestId('cloud-restore').getAttribute('aria-disabled')).toBe('true');
  });
});

describe('report for a doctor', () => {
  const cycles = [{ start: '2026-09-05', length: 28 }, { start: '2026-10-03', length: 28 }];
  const withHistory = (profile: Record<string, unknown> = adult) => setup({}, { history: { cycles, logs: [], temperatures: [] }, prediction: undefined, settings: { lifeStates: [] } }, profile);
  it('headlines "Also include", says how many cycles the PDF covers and what is always in it', () => {
    withHistory();
    render(<ReportScreen />);
    expect(screen.getByText('Also include')).toBeTruthy();
    expect(screen.getByTestId('report-covered').textContent).toBe('2 cycles from 5 Sep 2026 to 30 Oct 2026');
    expect(screen.getByText(/^Always in the PDF:/)).toBeTruthy();
    expect(screen.getByTestId('report-ovulation')).toBeTruthy();
  });
  it('hides the ovulation switch in teen mode', () => {
    withHistory(teen);
    render(<ReportScreen />);
    expect(screen.queryByTestId('report-ovulation')).toBeNull();
  });
  it('says there are no complete cycles when there are none, and keeps the share button', () => {
    setup({}, { history: { cycles: [], logs: [], temperatures: [] }, settings: { lifeStates: [] } });
    render(<ReportScreen />);
    expect(screen.getByTestId('report-covered').textContent).toBe('No complete cycles are logged yet.');
    expect(screen.getByTestId('report-share')).toBeTruthy();
  });
});

describe('add to someone’s calendar', () => {
  const withPrediction = (profile: Record<string, unknown> = adult) => setup({}, { prediction: {} }, profile);
  it('previews the period range as an estimate and adds the fertile range only on request', () => {
    withPrediction();
    render(<CalendarExportScreen />);
    expect(within(screen.getByTestId('calendar-export-preview')).getByText('Period likely 26–30 Nov')).toBeTruthy();
    expect(within(screen.getByTestId('calendar-export-preview')).getAllByText('ESTIMATE').length).toBe(1);
    expect(screen.queryByText(/^Fertile window estimate/)).toBeNull();
    fireEvent.click(switchNamed('Include the fertile window estimate') as HTMLElement);
    expect(screen.getByText('Fertile window estimate 6–18 Nov')).toBeTruthy();
    expect(within(screen.getByTestId('calendar-export-preview')).getAllByText('ESTIMATE').length).toBe(2);
  });
  it('hides the fertile option in teen mode', () => {
    withPrediction(teen);
    render(<CalendarExportScreen />);
    expect(screen.getByTestId('calendar-export-share')).toBeTruthy();
    expect(switchNamed('Include the fertile window estimate')).toBeUndefined();
  });
  it('disables Share and says there is no estimate yet', () => {
    setup({}, { prediction: undefined });
    render(<CalendarExportScreen />);
    expect(screen.getByTestId('calendar-export-none').textContent).toContain('There is no period estimate yet.');
    expect(hasCaution('calendar-export-none')).toBe(true);
    expect(screen.getByTestId('calendar-export-share').getAttribute('aria-disabled')).toBe('true');
  });
});

describe('legal', () => {
  it('shows one policy document with the update date, numbered headings and bullets', () => {
    render(<LegalScreen />);
    expect(screen.getByText('Last updated: October 2026')).toBeTruthy();
    expect(screen.getByText('1. Overview and APP Entity Status')).toBeTruthy();
    expect(screen.getByTestId('screen-legal')).toBeTruthy();
  });
});
