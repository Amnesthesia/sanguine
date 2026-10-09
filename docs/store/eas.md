# Building on Expo's servers (EAS) from your own machine

No `EXPO_TOKEN` is needed: you log in once and EAS uses your Expo account. Run these in `apps/mobile` (they use `npx eas-cli` via the scripts below).

```sh
npx eas-cli login          # once, with your Expo account
npx eas-cli init           # once: creates the EAS project and writes its id into app.json
pnpm build:android:preview # installable .apk for your own phone or emulator (internal distribution)
pnpm build:android:production   # .aab for Google Play (closed testing track)
pnpm build:ios:preview     # internal iOS build (needs an Apple Developer account; EAS asks to sign in)
pnpm build:ios:production  # for TestFlight
pnpm submit:android        # sends the latest production build to the Play internal track
pnpm submit:ios            # sends the latest production build to TestFlight
```

First Android build: EAS offers to generate the upload keystore. Say yes and let Expo hold it. First iOS build: EAS asks for your Apple ID and creates the certificates. The iCloud container `iCloud.app.sanguine.mobile` is created by EAS when the capability is registered; check it in the Apple Developer portal after the first build.

The GitHub release workflow (`.github/workflows/release.yml`) is optional and only needs an `EXPO_TOKEN` secret if you want CI to build on a tag; local builds do not.

Google Drive backup is off in builds until a Google OAuth client id is set (`expo.extra.googleDriveClientId` in `app.json`); iCloud and the local copy are unaffected.
