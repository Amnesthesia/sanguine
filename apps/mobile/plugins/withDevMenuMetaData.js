// Debug builds only: turn off expo-dev-menu's first-run sheet, launch-time menu and floating tools button on Android,
// the same switches app.json sets in the iOS Info.plist (D-041). Release builds have no dev menu, so this is inert there.
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

const META = {
  EXDevMenuShowFloatingActionButton: 'false',
  EXDevMenuShowsAtLaunch: 'false',
  EXDevMenuIsOnboardingFinished: 'true',
};

module.exports = function withDevMenuMetaData(config) {
  return withAndroidManifest(config, (c) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(c.modResults);
    for (const [name, value] of Object.entries(META)) AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, name, value);
    return c;
  });
};
