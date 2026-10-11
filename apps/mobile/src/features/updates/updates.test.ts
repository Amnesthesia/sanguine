import { beforeEach, describe, expect, it, vi } from 'vitest';
import { migrate } from '@/data/migrate';
import { openTestDb } from '@/data/testDb';

const updates = vi.hoisted(() => ({
  isEnabled: true, updateId: 'store' as string | null, isEmbeddedLaunch: true,
  checkForUpdateAsync: vi.fn(), fetchUpdateAsync: vi.fn(), reloadAsync: vi.fn(),
}));
vi.mock('expo-updates', () => updates);
vi.stubGlobal('__DEV__', false);
const { checkAndApply, isNewUpdate, noteLaunchedUpdate } = await import('./updates');

beforeEach(() => {
  Object.assign(updates, { isEnabled: true, updateId: 'store', isEmbeddedLaunch: true });
  vi.clearAllMocks();
});

describe('isNewUpdate', () => {
  it('counts only a downloaded update not seen before', () => {
    expect(isNewUpdate('a', null, false)).toBe(true);
    expect(isNewUpdate('b', 'a', false)).toBe(true);
    expect(isNewUpdate('a', 'a', false)).toBe(false);
    expect(isNewUpdate('a', null, true)).toBe(false); // the store build's own bundle
    expect(isNewUpdate(null, 'a', false)).toBe(false);
  });
});

describe('noteLaunchedUpdate', () => {
  it('says so once per over-the-air update, never for the store bundle', async () => {
    const db = openTestDb();
    await migrate(db);
    expect(await noteLaunchedUpdate(db)).toBe(false); // first launch of the store build
    Object.assign(updates, { updateId: 'ota-1', isEmbeddedLaunch: false });
    expect(await noteLaunchedUpdate(db)).toBe(true);
    expect(await noteLaunchedUpdate(db)).toBe(false); // the next launch of the same update
    Object.assign(updates, { updateId: 'store', isEmbeddedLaunch: true }); // rolled back to the store bundle
    expect(await noteLaunchedUpdate(db)).toBe(false);
  });
  it('does nothing in a development build', async () => {
    const db = openTestDb();
    await migrate(db);
    vi.stubGlobal('__DEV__', true);
    Object.assign(updates, { updateId: 'ota-1', isEmbeddedLaunch: false });
    expect(await noteLaunchedUpdate(db)).toBe(false);
    expect(await checkAndApply()).toBe('off');
    vi.stubGlobal('__DEV__', false);
  });
  it('does nothing when updates are off (Expo Go)', async () => {
    const db = openTestDb();
    await migrate(db);
    Object.assign(updates, { isEnabled: false, updateId: 'ota-1', isEmbeddedLaunch: false });
    expect(await noteLaunchedUpdate(db)).toBe(false);
  });
});

describe('checkAndApply', () => {
  it('restarts into a newer update', async () => {
    updates.checkForUpdateAsync.mockResolvedValue({ isAvailable: true });
    updates.fetchUpdateAsync.mockResolvedValue({ isNew: true });
    expect(await checkAndApply()).toBe('reloading');
    expect(updates.reloadAsync).toHaveBeenCalledOnce();
  });
  it('reports latest, off and failed without restarting', async () => {
    updates.checkForUpdateAsync.mockResolvedValue({ isAvailable: false });
    expect(await checkAndApply()).toBe('latest');
    updates.checkForUpdateAsync.mockRejectedValue(new Error('offline'));
    expect(await checkAndApply()).toBe('failed');
    updates.isEnabled = false;
    expect(await checkAndApply()).toBe('off');
    expect(updates.reloadAsync).not.toHaveBeenCalled();
  });
});
