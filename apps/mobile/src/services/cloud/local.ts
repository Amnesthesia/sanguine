// A folder inside the app's own documents standing in for iCloud Drive or Google Drive. Development builds only: it lets the whole
// upload and restore path run on a simulator that has no iCloud account. It is not a backup: deleting the app deletes it.
import { Directory, File, Paths } from 'expo-file-system';
import type { CloudStore } from './types';

export function localCloudStore(): CloudStore {
  const dir = new Directory(Paths.document, 'cloud-fake');
  const ensure = () => { if (!dir.exists) dir.create({ intermediates: true }); };
  return {
    name: 'local',
    async available() { return true; },
    async put(name, bytes) {
      ensure();
      const f = new File(dir, name);
      if (f.exists) f.delete();
      f.create();
      f.write(bytes);
    },
    async get(name) {
      ensure();
      const f = new File(dir, name);
      return f.exists ? f.bytes() : null;
    },
    async list() {
      ensure();
      return dir.list().filter((x): x is File => x instanceof File).map((f) => ({ name: f.name, modifiedAt: new Date(f.modificationTime ?? 0).toISOString(), size: f.size ?? 0 }));
    },
    async remove(name) {
      const f = new File(dir, name);
      if (f.exists) f.delete();
    },
  };
}
