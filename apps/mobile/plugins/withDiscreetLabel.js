// The discreet launcher alias (expo-alternate-app-icons, icon "Notes") shows the name "Notes" on Android (PLAN.md §8.8, D-048).
// iOS cannot rename an app through an alternate icon, so only the icon changes there.
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withDiscreetLabel(config) {
  return withAndroidManifest(config, (c) => {
    const app = c.modResults.manifest.application?.[0];
    for (const alias of app?.['activity-alias'] ?? []) {
      if (alias.$['android:name'] === '.MainActivityNotes') alias.$['android:label'] = 'Notes';
    }
    return c;
  });
};
