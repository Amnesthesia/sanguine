import { describe, expect, it } from 'vitest';
import { createDriveStore, type Fetch, multipartBody } from './driveApi';

interface Call { url: string; method: string; headers: Record<string, string>; body?: unknown }
function fakeFetch(files: Array<{ id: string; name: string }>, status = 200) {
  const calls: Call[] = [];
  const f: Fetch = async (url, init) => {
    calls.push({ url, method: init?.method ?? 'GET', headers: init?.headers ?? {}, body: init?.body });
    const listing = url.includes('spaces=appDataFolder');
    return { ok: status === 200, status, json: async () => ({ files: listing ? files : [] }), arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
  };
  return { f, calls };
}
const store = (files: Array<{ id: string; name: string }>, token: string | null = 'tok', status = 200) => {
  const { f, calls } = fakeFetch(files, status);
  return { s: createDriveStore(f, async () => token, () => 'b'), calls };
};

describe('multipartBody', () => {
  it('has the metadata, the bytes and the closing boundary', () => {
    const text = new TextDecoder().decode(multipartBody({ name: 'a', parents: ['appDataFolder'] }, new Uint8Array([65, 66]), 'X'));
    expect(text).toBe('--X\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{"name":"a","parents":["appDataFolder"]}\r\n--X\r\nContent-Type: application/octet-stream\r\n\r\nAB\r\n--X--');
  });
});

describe('Google Drive app-data store', () => {
  it('creates a new file in the appDataFolder with one multipart upload', async () => {
    const { s, calls } = store([]);
    await s.put('sanguine-backup.sgb', new Uint8Array([1]));
    const up = calls.at(-1) as Call;
    expect(up).toMatchObject({ method: 'POST' });
    expect(up.url).toBe('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart');
    expect(up.headers.Authorization).toBe('Bearer tok');
    expect(up.headers['Content-Type']).toBe('multipart/related; boundary=sanguineb');
    expect(new TextDecoder().decode(up.body as Uint8Array)).toContain('"parents":["appDataFolder"]');
  });
  it('updates an existing file in place', async () => {
    const { s, calls } = store([{ id: 'F1', name: 'sanguine-backup.sgb' }]);
    await s.put('sanguine-backup.sgb', new Uint8Array([1]));
    expect(calls.at(-1)).toMatchObject({ method: 'PATCH', url: 'https://www.googleapis.com/upload/drive/v3/files/F1?uploadType=media' });
  });
  it('searches only the app-data space, by name, and escapes quotes', async () => {
    const { s, calls } = store([]);
    await s.get("it's.sgb");
    expect(calls[0]?.url).toContain('spaces=appDataFolder');
    expect(decodeURIComponent(calls[0]?.url ?? '')).toContain("name = 'it\\'s.sgb'");
  });
  it('downloads the bytes, or null when there is no such file', async () => {
    expect(await store([{ id: 'F1', name: 'a' }]).s.get('a')).toEqual(new Uint8Array([1, 2, 3]));
    expect(await store([]).s.get('a')).toBeNull();
  });
  it('lists and removes', async () => {
    const { s, calls } = store([{ id: 'F1', name: 'a' }]);
    expect(await s.list()).toEqual([{ name: 'a', modifiedAt: '', size: 0 }]);
    await s.remove('a');
    expect(calls.at(-1)).toMatchObject({ method: 'DELETE', url: 'https://www.googleapis.com/drive/v3/files/F1' });
  });
  it('is unavailable without a token and throws on an HTTP error', async () => {
    expect(await store([], null).s.available()).toBe(false);
    await expect(store([], 'tok', 403).s.list()).rejects.toThrow('403');
    await expect(store([], null).s.list()).rejects.toThrow('not signed in');
  });
});
