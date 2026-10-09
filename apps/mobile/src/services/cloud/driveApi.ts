// Google Drive REST calls for the app-data folder (PLAN.md §6.3). The only network code in the app (CI enforces it: tools/ci/network.test.ts).
// The scope drive.appdata gives access to this app's hidden folder only, never to the user's other files.
import type { CloudFile, CloudStore } from './types';

const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

export type Fetch = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: Uint8Array | string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown>; arrayBuffer(): Promise<ArrayBuffer> }>;

const enc = new TextEncoder();
const concat = (...xs: Uint8Array[]) => { const o = new Uint8Array(xs.reduce((n, x) => n + x.length, 0)); let p = 0; for (const x of xs) { o.set(x, p); p += x.length; } return o; };

/** multipart/related body: JSON metadata, then the file bytes. */
export function multipartBody(metadata: Record<string, unknown>, bytes: Uint8Array, boundary: string): Uint8Array {
  return concat(
    enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`),
    bytes, enc.encode(`\r\n--${boundary}--`),
  );
}

interface DriveFile { id: string; name: string; modifiedTime?: string; size?: string }

/** `getToken` returns a valid access token (refreshing it when needed); `random` supplies the multipart boundary. */
export function createDriveStore(f: Fetch, getToken: () => Promise<string | null>, random: () => string): CloudStore {
  const call = async (url: string, init: Parameters<Fetch>[1] = {}) => {
    const token = await getToken();
    if (!token) throw new Error('not signed in to Google Drive');
    const res = await f(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers } });
    if (!res.ok) throw new Error(`Google Drive returned ${res.status}`);
    return res;
  };
  const find = async (name: string): Promise<DriveFile | undefined> => {
    const q = encodeURIComponent(`name = '${name.replace(/'/g, "\\'")}' and trashed = false`);
    const res = await call(`${API}?spaces=appDataFolder&pageSize=10&fields=files(id,name,modifiedTime,size)&q=${q}`);
    return ((await res.json()) as { files: DriveFile[] }).files[0];
  };
  return {
    name: 'drive',
    async available() { return (await getToken().catch(() => null)) !== null; },
    async put(name, bytes) {
      const existing = await find(name);
      if (existing) { await call(`${UPLOAD}/${existing.id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/octet-stream' }, body: bytes }); return; }
      const boundary = `sanguine${random()}`;
      await call(`${UPLOAD}?uploadType=multipart`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body: multipartBody({ name, parents: ['appDataFolder'] }, bytes, boundary) });
    },
    async get(name) {
      const file = await find(name);
      return file ? new Uint8Array(await (await call(`${API}/${file.id}?alt=media`)).arrayBuffer()) : null;
    },
    async list(): Promise<CloudFile[]> {
      const res = await call(`${API}?spaces=appDataFolder&pageSize=100&fields=files(id,name,modifiedTime,size)`);
      return ((await res.json()) as { files: DriveFile[] }).files.map((x) => ({ name: x.name, modifiedAt: x.modifiedTime ?? '', size: Number(x.size ?? 0) }));
    },
    async remove(name) {
      const file = await find(name);
      if (file) await call(`${API}/${file.id}`, { method: 'DELETE' });
    },
  };
}

/** Google Drive backup is offered only once the owner has put an OAuth client id in `app.json` (`expo.extra.googleDriveClientId`). Until then Android has no cloud copy. */
export const driveEnabled = (clientId: string | undefined | null): boolean => typeof clientId === 'string' && /^[\w-]+\.apps\.googleusercontent\.com$/.test(clientId.trim());
