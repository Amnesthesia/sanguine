// iCloud Drive store: the app's own container (Documents/), visible to the user in Files > iCloud Drive > Sanguine. Native module: modules/icloud-drive.
import { base64ToBytes, bytesToBase64 } from './base64';
import type { CloudStore } from './types';

export function icloudStore(): CloudStore {
  const native = (require('../../../modules/icloud-drive') as { default: import('../../../modules/icloud-drive').IcloudDriveNative }).default;
  return {
    name: 'icloud',
    available: () => native.isAvailable().catch(() => false),
    put: (name, bytes) => native.write(name, bytesToBase64(bytes)),
    async get(name) {
      const b64 = await native.read(name);
      return b64 === null ? null : base64ToBytes(b64);
    },
    list: () => native.list(),
    remove: (name) => native.remove(name),
  };
}
