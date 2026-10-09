// Google Drive store with sign-in (PLAN.md §6.3). Needs an OAuth client id from the owner: `expo.extra.googleDriveClientId` in app.json
// (an Android client for the package name and signing key). Without it the store is unavailable and the app offers no Drive copy.
import Constants from 'expo-constants';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import { deviceClock } from '../clock';
import { createDriveStore, DRIVE_SCOPE, driveEnabled } from './driveApi';
import type { CloudStore } from './types';

const KEY = 'sanguine.drive.tokens';
const OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const DISCOVERY = { authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth', tokenEndpoint: 'https://oauth2.googleapis.com/token', revocationEndpoint: 'https://oauth2.googleapis.com/revoke' };
interface Tokens { access: string; refresh?: string; expiresAt: number }

const clientId = () => (Constants.expoConfig?.extra as { googleDriveClientId?: string } | undefined)?.googleDriveClientId ?? '';
const redirectUri = () => AuthSession.makeRedirectUri({ native: `com.googleusercontent.apps.${clientId().split('.')[0]}:/oauthredirect` });

async function load(): Promise<Tokens | null> {
  const raw = await SecureStore.getItemAsync(KEY, OPTS);
  return raw ? (JSON.parse(raw) as Tokens) : null;
}
const save = (t: Tokens) => SecureStore.setItemAsync(KEY, JSON.stringify(t), OPTS);

/** A valid access token, refreshed when it is about to expire; null when the user has not signed in. */
async function token(): Promise<string | null> {
  const t = await load();
  if (!t) return null;
  if (t.expiresAt - deviceClock.nowMs() > 60_000) return t.access;
  if (!t.refresh) return null;
  const r = await AuthSession.refreshAsync({ clientId: clientId(), refreshToken: t.refresh }, DISCOVERY);
  const next: Tokens = { access: r.accessToken, refresh: r.refreshToken ?? t.refresh, expiresAt: deviceClock.nowMs() + (r.expiresIn ?? 3600) * 1000 };
  await save(next);
  return next.access;
}

/** Opens the Google consent screen (scope: this app's hidden folder only). Returns true when the user signed in. */
export async function signInToDrive(): Promise<boolean> {
  if (!clientId()) return false;
  const req = new AuthSession.AuthRequest({ clientId: clientId(), scopes: [DRIVE_SCOPE], redirectUri: redirectUri(), usePKCE: true, extraParams: { access_type: 'offline' } });
  const res = await req.promptAsync(DISCOVERY);
  if (res.type !== 'success') return false;
  const out = await AuthSession.exchangeCodeAsync({ clientId: clientId(), code: res.params.code ?? '', redirectUri: redirectUri(), extraParams: { code_verifier: req.codeVerifier ?? '' } }, DISCOVERY);
  await save({ access: out.accessToken, ...(out.refreshToken ? { refresh: out.refreshToken } : {}), expiresAt: deviceClock.nowMs() + (out.expiresIn ?? 3600) * 1000 });
  return true;
}
export async function signOutOfDrive(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY, OPTS);
}

export const driveConfigured = (): boolean => driveEnabled(clientId());

export function driveStore(): CloudStore {
  if (!driveConfigured()) throw new Error('Google Drive is not configured');
  return createDriveStore((url, init) => fetch(url, init as RequestInit), token, () => String(deviceClock.nowMs()));
}
