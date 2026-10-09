import { describe, expect, it } from 'vitest';
import { serial } from './serial';

describe('serial', () => {
  it('two overlapping read-modify-write calls both land (the updatePrefs race)', async () => {
    let saved = { a: false, b: false };
    const update = serial(async (patch: Partial<typeof saved>) => {
      const next = { ...saved, ...patch }; // read
      await new Promise((r) => setTimeout(r, 5)); // the save awaits
      saved = next; // write
    });
    await Promise.all([update({ a: true }), update({ b: true })]);
    expect(saved).toEqual({ a: true, b: true });
  });
  it('a failure reaches its caller and does not block the next call', async () => {
    const f = serial(async (x: number) => { if (x === 1) throw new Error('boom'); return x; });
    await expect(f(1)).rejects.toThrow('boom');
    await expect(f(2)).resolves.toBe(2);
  });
});
