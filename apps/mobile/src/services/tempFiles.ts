// Export zips, backups and picked import files are written to the cache. They hold health data in the clear (exports) or
// encrypted (backups), so they are removed as soon as they have been used and again on "Delete everything".
import { Directory, File, Paths } from 'expo-file-system';

const OURS = /^sanguine-.*\.(zip|sgb)$/i;

export function removeTempFile(file: File): void {
  try { if (file.exists) file.delete(); } catch { /* best effort: the file may already be gone */ }
}

/** Removes every file this app wrote to the cache, plus copies made by the document picker. */
export function removeAllTempFiles(): void {
  try {
    for (const item of new Directory(Paths.cache).list()) {
      if (item instanceof File) { if (OURS.test(item.name)) removeTempFile(item); }
      else if (/DocumentPicker/i.test(item.name)) { try { item.delete(); } catch { /* ignore */ } }
    }
  } catch { /* the cache may be unavailable; nothing to remove */ }
}
