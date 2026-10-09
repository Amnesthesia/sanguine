// EAS Update on top of app.json (D-069). Over-the-air updates carry JavaScript fixes only: the runtime version is the native
// fingerprint plus the prediction engine's sources (fingerprint.config.js), so a change to the engine yields a new runtime
// version that no installed build accepts, and engine changes ship only as store builds (PLAN.md §6.6, RK-13).
// Every build, production included, checks for an update on launch (owner's decision, D-069).
import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = (config.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  if (!projectId) throw new Error('app.json extra.eas.projectId is missing');
  return {
    ...(config as ExpoConfig),
    runtimeVersion: { policy: 'fingerprint' },
    updates: {
      url: `https://u.expo.dev/${projectId}`,
      enabled: true,
      checkAutomatically: 'ON_LOAD',
      // never block launch on the network: a downloaded update applies on the next cold start
      fallbackToCacheTimeout: 0,
    },
  };
};
