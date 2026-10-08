import * as LocalAuthentication from 'expo-local-authentication';

/** True when the phone has Face ID, a fingerprint, or at least a passcode / PIN / pattern. */
export async function deviceHasLock(): Promise<boolean> {
  try {
    return (await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

export async function authenticate(reason: string): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: reason, disableDeviceFallback: false, cancelLabel: undefined });
    return r.success;
  } catch {
    return false;
  }
}
