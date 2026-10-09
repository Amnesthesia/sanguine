// iCloud Drive store. The driver arrives with the native module and entitlement (backlog P3-7); until then the store is unavailable.
import type { CloudStore } from './types';

export function icloudStore(): CloudStore {
  throw new Error('iCloud Drive is not set up in this build');
}
