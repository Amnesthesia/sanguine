# Architecture

Sanguine is an on-device, free cycle tracker: React Native + Expo (SDK 57, dev client), TypeScript 7, pnpm workspaces.
No network calls except the optional encrypted backup upload (Phase 3, P3-7). The prediction engine is a pure function.

## 1. Packages and who may import whom

```mermaid
flowchart LR
  subgraph pure["Pure TypeScript (no React, no platform APIs, no I/O)"]
    engine["@sanguine/engine<br/>predict(history, settings, today)"]
    crypto["@sanguine/crypto<br/>backup v1, recovery words, note layer"]
    tokens["@sanguine/ui-tokens<br/>colours, type, radii, contrast test"]
    health["@sanguine/health-adapter<br/>(Phase 4, empty)"]
  end
  subgraph app["apps/mobile (@sanguine/mobile)"]
    data["src/data<br/>event store, projections, SQLCipher open"]
    services["src/services<br/>secrets, notifications, widgets, backup…"]
    state["src/state<br/>zustand: useApp, useLock"]
    features["src/features + src/app<br/>screens (expo-router)"]
    ui["src/ui, src/theme"]
  end
  tools["tools/<br/>backtest · brand · ci"]
  copy["copy/*.json<br/>all user-facing strings"]
  engine --> data
  engine --> state
  crypto --> services
  tokens --> ui
  data --> state
  services --> state
  state --> features
  ui --> features
  copy --> features
  engine --> tools
  tokens --> tools
```

Rules the tests enforce: the engine has **no runtime dependencies** and no `Date.now()`/randomness (`purity.test.ts`); symptoms
never reach `predict`; `copy/*.json` passes the forbidden-word test; `tools/ci/deny-list.test.ts` fails if an analytics,
crash-reporting, ad or attribution package appears in `apps/mobile/package.json`.

## 2. Data flow: from a tap to a prediction

```mermaid
sequenceDiagram
  participant UI as Screen (e.g. LogSheet)
  participant S as useApp (zustand)
  participant ES as EventStore (data/store.ts)
  participant DB as SQLCipher DB
  participant P as projections (data/project.ts)
  participant E as engine.predict
  UI->>S: action (logFlow, saveTemp…)
  S->>ES: append(event) - append-only, retract instead of UPDATE or DELETE
  ES->>DB: INSERT event (trigger blocks UPDATE/DELETE)
  ES->>P: rebuild projections in full (period runs, daily_log, biomarkers)
  S->>ES: engineInputs()
  ES-->>S: History + EngineSettings
  S->>E: predict(history, settings, today)
  E-->>S: Prediction (ranges + confidence grade, flags)
  S-->>UI: re-render (todayModel, calendarModel, insightsModel)
  S->>S: syncReminders(), syncWidgets()
```

Key invariants: events are immutable (a correction is a retract event plus a new event); `period.start { merge: true }` joins
runs ≤ 7 days apart; every prediction is a **range with a confidence grade** (never one highlighted "fertile day"); symptoms are
stored and shown but never change a prediction.

## 3. Boot sequence

```mermaid
flowchart TD
  A["Native splash<br/>iOS: lock-up image · Android 12+: bare field"] --> B[RootLayout mounts<br/>useFonts, useApp.init]
  B --> B1["ScreenProtection mounted first<br/>(capture block from frame 1)"]
  B --> C{fonts loaded AND<br/>status != loading?}
  C -- no --> B1
  C -- yes --> D[SplashScreen.hideAsync]
  D --> E[ThemeProvider → LockGate → Shell]
  D --> F[BrandSplash overlay<br/>lock-up, rule, tagline, ~3 s, opacity only]
  E --> G{onboarded?}
  G -- no --> H[onboarding]
  G -- yes --> I["(tabs): Today, Calendar, Insights, Settings"]
  subgraph init["useApp.init()"]
    i1["appData(): open DB with Secure Store key<br/>migrate plain→SQLCipher if needed"]
    i2["loadPrefs, launchCount++"]
    i3["refresh(): engineInputs → predict"]
  end
  B -.-> init
  init -. failure KeyMismatchError .-> K["Key-mismatch screen:<br/>'Start again' after confirmation"]
```

## 4. Security layers

```mermaid
flowchart LR
  subgraph device["On the phone"]
    SS[("Secure Store<br/>WHEN_UNLOCKED_THIS_DEVICE_ONLY<br/>db key · device secret · note key")]
    DB[("SQLCipher DB<br/>raw 256-bit key, PRAGMA key")]
    N["Notes: second layer (XChaCha20-Poly1305, key released only while unlocked)"]
    L["App lock: Face ID / fingerprint / passcode<br/>60 s auto-lock, cover until decided, fail closed"]
    P["Screen protection: FLAG_SECURE / capture block<br/>app switcher blur; recovery screen always"]
    W[("App Group snapshot<br/>day + ring only; headline only if opted in")]
  end
  B["Optional backup file<br/>Argon2id + device secret → HKDF → XChaCha20-Poly1305 + HMAC<br/>recovery code = 24 BIP-39 words"]
  SS --> DB
  SS --> N
  L --> N
  DB -. export .-> B
  DB -. snapshot .-> W
```

- DB open and migration: `data/cipher.ts` (pure orchestration, tested with a fake file system) and `data/expoDatabase.ts`.
  A crash between removing the plain file and renaming the encrypted one is finished on the next open.
- Android Auto Backup is off and the key is device-bound, so a restored phone has the file but not the key: the app shows
  "Your data on this phone cannot be opened" and offers a confirmed fresh start (the backup + recovery code is the way back).
- "Delete everything" (`data/wipe.ts`): secure_delete, drop, WAL checkpoint, VACUUM, delete secrets, sweep temp files,
  blank the widget, reset the discreet icon.

## 5. Widget and splash flows

```mermaid
flowchart LR
  subgraph app
    R[refresh / prefs change] --> SW[syncWidgets]
    SW --> SNAP["widgetSnapshot()<br/>pure, tested"]
    SNAP --> UP["TodayWidget.updateSnapshot(props)"]
  end
  UP --> AG[("App Group prefs<br/>layout string + timeline")]
  AG --> WK["WidgetKit extension<br/>renders the stringified 'widget' function"]
  WK -- "Log period link" --> DL["sanguine://log?section=period"]
  DL --> app
```

- The widget layout is a function marked `'widget'`; the Babel preset stringifies it, and **only if `expo-widgets` was
  resolvable when Metro started** (restart Metro with `--clear` after installing it). Inside it: no hooks, no module-scope
  references, only `@expo/ui/swift-ui`.
- Lock-screen families show only the app name unless "Show details in widgets" is on (they are readable while locked).
- Android widget: deferred (P3-5b); expo-widgets' Glance renderer is a placeholder in SDK 57.

Splash: tagline = `taglineFor(launchCount)` (six lines in `copy/en-AU.json` `app.taglines`, never the same twice in a
row, none in teen mode). Android 12+ masks the native splash image to a circle, so the native splash there is the bare field
and the JS splash fades the lock-up in.

## 6. Where things are

| Concern | Path |
| --- | --- |
| Engine modules (NIG cycle model, luteal, BBT, LH, mucus, cervix, combine, life-state gates, flags) | `packages/engine/src` |
| Golden fixtures A–I and property tests | `packages/engine/src/fixtures*.ts`, `properties.test.ts` |
| Event store, projections, export/import, backup | `apps/mobile/src/data` |
| Screens (expo-router file routes) | `apps/mobile/src/app` |
| Feature logic and components | `apps/mobile/src/features/<area>` |
| Strings and fixed wording | `copy/en-AU.json`, `copy/legal.en-AU.json`, `copy/glossary.en-AU.json`, `copy/symptoms.json` |
| Dev-only seed route for tests | `apps/mobile/src/app/dev/seed.tsx` (`/dev/seed?scenario=…&theme=…&lock=1&resetSecrets=1&protect=1`) |
| Brand build | `tools/brand/build.ts` (assets), `docs/brand.html` |
| CI-style tests | `tools/ci` (deny-list, SOUP currency, engine hash) |
| Backtest and acceptance | `tools/backtest` |
