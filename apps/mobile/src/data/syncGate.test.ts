import { describe, expect, it } from 'vitest';
import { SyncGate } from './syncGate';

const defer = () => { let resolve!: () => void; const promise = new Promise<void>((r) => { resolve = r; }); return { promise, resolve }; };

describe('SyncGate', () => {
  it('runs one job at a time and returns null for a second call', async () => {
    const g = new SyncGate();
    const d = defer();
    const first = g.run(async () => { await d.promise; return 'a'; });
    expect(g.running).toBe(true);
    expect(await g.run(async () => 'b')).toBeNull();
    d.resolve();
    expect(await first).toBe('a');
    expect(g.running).toBe(false);
    expect(await g.run(async () => 'c')).toBe('c');
  });
  it('close waits for the running job and refuses new ones until it is opened again', async () => {
    const g = new SyncGate();
    const d = defer();
    let finished = false;
    const job = g.run(async () => { await d.promise; finished = true; });
    const closing = g.close();
    expect(await g.run(async () => 'x')).toBeNull();
    d.resolve();
    await closing;
    expect(finished).toBe(true);
    await job;
    expect(await g.run(async () => 'y')).toBeNull();
    g.open();
    expect(await g.run(async () => 'z')).toBe('z');
  });
  it('a failing job releases the gate and the error reaches the caller', async () => {
    const g = new SyncGate();
    await expect(g.run(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    expect(await g.run(async () => 'ok')).toBe('ok');
    await g.close(); // does not hang
  });
});
