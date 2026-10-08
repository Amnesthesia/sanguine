// Development only: load a sample-data scenario and open Today. `exp://<host>/--/dev/seed?scenario=typical`
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Text } from 'react-native';
import { scenario, SCENARIOS, type ScenarioName } from '@/features/dev/scenarios';
import { setSetting } from '@/data/settings';
import { todayLocal } from '@/services/clock';
import { useApp } from '@/state/app';

export default function Seed() {
  const params = useLocalSearchParams<{ scenario?: string; theme?: string }>();
  const router = useRouter();
  const status = useApp((s) => s.status);
  useEffect(() => {
    if (!__DEV__ || status !== 'ready') return;
    void (async () => {
      const { store, db, refresh, updatePrefs, completeOnboarding } = useApp.getState();
      if (!store || !db) return;
      const name = (SCENARIOS.includes(params.scenario as ScenarioName) ? params.scenario : 'typical') as ScenarioName;
      const s = scenario(name, todayLocal());
      await store.setProfile(s.profile);
      if (s.events.length) await store.appendMany(s.events);
      await setSetting(db, 'onboarded', true);
      await completeOnboarding();
      if (params.theme === 'dark' || params.theme === 'light') await updatePrefs({ theme: params.theme });
      await refresh();
      router.replace('/today');
    })();
  }, [status, params.scenario, params.theme, router]);
  if (!__DEV__) return <Redirect href="/" />;
  return <Text>Loading sample data…</Text>;
}
