// Where an encrypted backup goes (PLAN.md §6.3): the user's own iCloud Drive or Google Drive app folder. The file is already encrypted.
export interface CloudFile { name: string; modifiedAt: string; size: number }
export interface CloudStore {
  name: 'icloud' | 'drive' | 'local';
  available(): Promise<boolean>;
  put(name: string, bytes: Uint8Array): Promise<void>;
  get(name: string): Promise<Uint8Array | null>;
  list(): Promise<CloudFile[]>;
  remove(name: string): Promise<void>;
}
/** One versioned file (§6.3); the previous one is kept beside it as `.1` so a bad upload never leaves the user with nothing. */
export const BACKUP_NAME = 'sanguine-backup.sgb';
export const BACKUP_PREV = 'sanguine-backup.1.sgb';
