// Development only (simulator): seed or clear HealthKit samples, then sync. `sanguine://dev/health-seed?action=seed`
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { todayLocal } from '@/services/clock';
import { useApp } from '@/state/app';

export default function HealthSeed() {
  const { action } = useLocalSearchParams<{ action?: string }>();
  const router = useRouter();
  const status = useApp((s) => s.status);
  const [msg, setMsg] = useState('Working…');
  useEffect(() => {
    if (!__DEV__ || status !== 'ready') return;
    void (async () => {
      try {
        const { devSeedHealthKit } = require('@/services/health/healthkit') as typeof import('@/services/health/healthkit');
        setMsg(await devSeedHealthKit(action === 'clear' ? 'clear' : 'seed', todayLocal()));
      } catch (e) {
        setMsg(`failed: ${(e as Error).message}`);
        return;
      }
      if (action !== 'seed-stay') router.replace('/settings/health');
    })();
  }, [status, action, router]);
  return <Text testID="health-seed-status">{msg}</Text>;
}
