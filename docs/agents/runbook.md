# Runbook

Run from the repo root unless stated. pnpm 9 workspaces, `node-linker=hoisted`; TypeScript 7; lint is **Biome** (typescript-eslint
does not support TS 7).

## 1. Checks (no device needed)

| Command | What it runs |
| --- | --- |
| `pnpm -s test` | vitest: engine, data (better-sqlite3), crypto, copy, tokens, components (jsdom + react-native-web), tools/ci, tools/brand |
| `pnpm -s test -- <path>` or `npx vitest run <path>` | one file or folder |
| `pnpm -s typecheck` | `tsc` in every workspace |
| `pnpm lint` | `biome lint .` (7 existing `noExplicitAny` warnings are known; errors must be zero). `ios/` and `android/` are excluded |
| `pnpm -s soup` | regenerates `docs/regulatory/soup.md`; **run it whenever a dependency changes**, a test fails if it is stale |
| `pnpm -s engine-hash` | prints the engine build hash (changes only if engine sources change) |
| `pnpm --filter @sanguine/brand build` (or `cd tools/brand && npx tsx build.ts`) | regenerates `apps/mobile/assets/brand/*` |

Before any commit: test + typecheck + lint green, `soup` current, `docs/DECISIONS.md` updated when you decided something.

## 2. Metro and the dev client

The app is a **prebuilt dev client** (`app.sanguine.mobile`), not Expo Go. JS changes need no native rebuild; **native changes do**
(new native module, `app.json` plugin or splash/icon change, config plugin edit).

```bash
cd apps/mobile
npx expo start --dev-client --port 8090           # Metro; keep it running, one only
npx expo start --dev-client --port 8090 --clear   # after installing a package that has a Babel plugin (expo-widgets) or changing metro.config.js
```

Do **not** start Metro with `CI=1` (it disables file watching and serves stale bundles).

Native rebuild (only when needed):

```bash
cd apps/mobile
npx expo prebuild --platform ios --no-install      # regenerates ios/ (git-ignored); add --platform android for android/
npx expo run:ios --device <simulator-udid> --no-bundler
export JAVA_HOME=/opt/homebrew/Cellar/openjdk@17/17.0.16/libexec/openjdk.jdk/Contents/Home   # JDK 17 only for Gradle
npx expo run:android --no-bundler
```

Simulators in use on the owner's machine: iOS **iPhone 17 Pro Max** `1C4C0CE9-4A7A-441F-8FCA-5EDBD373D757` (iOS 26.4), Android
emulator **Medium_Phone_API_VanillaIceCream** (`emulator-5554`, API 35). The iOS simulator is faster; prefer it. `adb` is at
`~/Library/Android/sdk/platform-tools`. Free memory: shut down what you are not using (`xcrun simctl shutdown <udid>`).

## 3. Maestro (end-to-end)

```bash
cd apps/mobile
CLIENT=dev ITEM=<backlog-id> .maestro/run.sh ios today.yaml logging.yaml     # one or more flows
CLIENT=dev ITEM=<backlog-id> .maestro/suite.sh ios                            # every flow + app-lock script + at-rest check
CLIENT=dev ITEM=<backlog-id> .maestro/suite.sh android
```

- Screenshots land in `docs/screenshots/<ITEM>-devclient/<platform>-<name>.png`. Use a meaningful ITEM; do not overwrite another
  item's folder.
- On failure `run.sh` keeps Maestro's debug output at `/tmp/maestro-debug-<platform>-<time>/` (screenshots, `maestro.log`,
  `device-logcat.txt`). Read the **last screenshot first**; it usually explains the failure.
- `_open.yaml` is the shared start: clear state → connect to Metro → open the deep link → wait out the dev-menu sheet and the
  brand splash (about 3 s). Flows seed data with `${LINKBASE}dev/seed?scenario=typical` (scenarios: `empty`, `typical`,
  `inProgress`, `irregular`, `skippedLog`; params `theme=dark`, `lock=1`, `resetSecrets=1`, `protect=1`).
- Flow-writing rules learned the hard way: tap by `id:` (testID), not text, where a testID exists; after a relaunch wait for
  `screen-today` **and** for `brand-splash` to disappear before tapping; an iOS system alert needs
  `extendedWaitUntil: visible: "OK"` before the tap; the logging sheet is closed by `_close-sheet.yaml`; `Back` is `id: back`.
- App-lock on iOS is driven by `lock-ios.sh` (simulated Face ID with `notifyutil`). Android lock through the device-credential
  prompt is **not** tested (setting a PIN locks the emulator).
- Encrypted-at-rest check: `.maestro/at-rest.sh ios|android` (the DB file must not start with the plain SQLite header).

## 4. Taking screenshots by hand

```bash
xcrun simctl io booted screenshot /tmp/x.png          # iOS
adb exec-out screencap -p > /tmp/x.png                # Android
```

With screen protection on, hand screenshots can be blank; the dev seed route turns protection off unless `protect=1`.
Downscale before reading them (`sips -Z 700 in.png --out out.png`).

## 5. Gotchas (symptom → cause → fix)

| Symptom | Cause | Fix |
| --- | --- | --- |
| Stale JS, edits ignored | Metro started with `CI=1`, or a second Metro on another port | one Metro, no `CI=1`, `--clear` |
| Widget crashes: "argument cannot be cast to String" | `'widget'` function not stringified: Metro started before `expo-widgets` was installed | restart Metro with `--clear` |
| Android: tap on a deep link does nothing, app shows launcher | link sent before the launcher or JS was up | `_open.yaml` waits for the launcher, then for it to go; send the link only after the first screen |
| Android: after toggling the discreet icon deep links stop resolving, app closes | the launcher alias replaces `MainActivity`; shell cannot flip it back | reinstall the APK (`adb uninstall` then `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`) |
| Android 12+ splash shows only a clipped emblem and logotype fragments | the native splash image is masked to a ~160 dp circle | native splash is a bare field; the JS splash draws the lock-up |
| `Tap on id: … FAILED` right after a list changes (Android) | tap landed while the list re-laid out | repeat the tap once (`runFlow when: notVisible …`) |
| iOS dev client: floating "Dev tools" button over the sheet's Done | dev-menu FAB | disabled in `Info.plist`/manifest (`EXDevMenu*`, plugin `withDevMenuMetaData`) |
| Android keyboard hides Continue (edge-to-edge) | `adjustResize` no longer lifts content | `KeyboardAvoidingView behavior="padding"` on both platforms |
| `expo-notifications` crashes on import in Expo Go on Android | Expo Go limitation (SDK 53+) | not relevant on the dev client; code still lazy-requires it |
| `File.move({overwrite:true})` leaves nothing after a kill | it is delete-then-rename on both platforms | DB migration removes then renames, and the open recovers the half-done state (`data/cipher.ts`) |
| Argon2id takes tens of seconds | JS Argon2 at 64 MiB in Hermes | settings are 19 MiB × 2 until native libsodium (P3-7) |
| iOS keychain survives an app-data reset | iOS keychain semantics | seed with `resetSecrets=1` for a clean first run |
| `useFonts` text looks synthetic bold on Android | `fontWeight` set on top of a custom family | do not set `fontWeight` with a custom `fontFamily` |
| Gradle needs a different JDK | system JDK is newer | `JAVA_HOME` = JDK 17 for Gradle only |
| Disk almost full during builds | DerivedData, Gradle and package caches | clear `~/.npm`, `~/Library/Caches/{Yarn,CocoaPods,Homebrew}`; never touch the owner's data |
| agy-bridge returns empty or refuses | quota or refusal | follow the owner's rule: retry once with `follow_up`, then do the work natively; stop delegating on `Quota exhausted` |

## 6. Committing

- Stage by path. Message starts with the backlog id or decision id; end with the attribution line given in the session
  (`Co-Authored-By: …`).
- Update `docs/PROGRESS.md` (one line per finished item), `docs/BACKLOG.md` (tick the box), and `docs/DECISIONS.md`.
- The automated commit review may report findings after the commit; treat each as a task: verify, fix, record.
