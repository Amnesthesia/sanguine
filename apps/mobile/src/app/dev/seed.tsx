// Development only: load a sample-data scenario and open Today. `exp://<host>/--/dev/seed?scenario=typical`
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Text } from 'react-native';
import { scenario, SCENARIOS, type ScenarioName } from '@/features/dev/scenarios';
import { setSetting } from '@/data/settings';
import { todayLocal } from '@/services/clock';
import { deleteDeviceSecret, deleteNoteKey } from '@/services/secrets';
import { useApp } from '@/state/app';

export default function Seed() {
  const params = useLocalSearchParams<{ scenario?: string; theme?: string; resetSecrets?: string; lock?: string }>();
  const router = useRouter();
  const status = useApp((s) => s.status);
  useEffect(() => {
    if (!__DEV__ || status !== 'ready') return;
    void (async () => {
      const { store, db, refresh, updatePrefs, completeOnboarding } = useApp.getState();
      if (!store || !db) return;
      // Keychain items survive an app-data reset on iOS; tests that need a first-run backup start from none
      if (params.resetSecrets === '1') await Promise.all([deleteDeviceSecret(), deleteNoteKey()]);
      const name = (SCENARIOS.includes(params.scenario as ScenarioName) ? params.scenario : 'typical') as ScenarioName;
      const s = scenario(name, todayLocal());
      await store.setProfile(s.profile);
      if (s.events.length) await store.appendMany(s.events);
      await updatePrefs({ appLock: params.lock === '1', ...(params.theme === 'dark' || params.theme === 'light' ? { theme: params.theme } : {}) });
      await setSetting(db, 'onboarded', true);
      await completeOnboarding();
      await refresh();
      router.replace('/today');
    })();
  }, [status, params.scenario, params.theme, params.resetSecrets, params.lock, router]);
  if (!__DEV__) return <Redirect href="/" />;
  return <Text>Loading sample data…</Text>;
}
