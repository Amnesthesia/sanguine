# Google Play Console: every field, in the order the console shows it

For the owner filling in Play Console (play.google.com/console > Sanguine). Copy that people read on the store page (name, short and full description, release notes, screenshot captions) lives in `listing-en-AU.md`; this file says which field it goes in and gives every other answer. Checked against Google's help pages on 2026-11-19; the console changes, so read each question before answering.

Fixed facts:

| Field | Value | Where it comes from |
| --- | --- | --- |
| Package name | app.sanguine.mobile (permanent) | `apps/mobile/app.json` `expo.android.package` |
| Version name | 1.0.0 | `app.json` `expo.version` |
| Version code | Set by EAS (`appVersionSource: remote`, `autoIncrement`) | `apps/mobile/eas.json` |
| Upload track | internal (`eas submit`), promoted by hand | `eas.json` `submit.production.android.track` |
| Default language | English (Australia), en-AU | |

## Before the first public release

1. **Account type.** Google requires developers of health apps to register as an Organization (with a D-U-N-S number matching the Dun & Bradstreet record). Reproductive and menstrual health is in the scope of the Health apps policy. Check which type the Sanguine developer account is. If it is a personal account, the owner decides whether to convert it before going public.
2. **Closed test.** A personal account created after 13 November 2023 must run a closed test with at least 12 testers opted in for 14 days in a row before it can apply for production access. An organization account does not.
3. **`READ_MEDIA_IMAGES` is blocked (done 2026-11-19).** `expo-screen-capture` declares it for Android 13 (its own manifest, `minSdkVersion` and `maxSdkVersion` 33) for its screenshot listener, which Sanguine never calls. `apps/mobile/app.config.ts` adds `android.permission.READ_MEDIA_IMAGES` to `android.blockedPermissions` (there, not in `app.json`, so the runtime version stays `1.0.0-237a565d6697`: `app.json` is hashed into it, and removing a manifest permission changes nothing the JS can call); `npx expo config --type introspect` shows the `tools:node="remove"` entry, and `tools/ci/store.test.ts` keeps it and fails if `addScreenshotListener` is ever used. Takes effect from the next native build (not over the air). Answer "no" in the photo and video permissions form. Still declared, with `maxSdkVersion` 32 and not covered by Play's photo and video policy: `READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE` (expo-file-system, expo-image, expo-screen-capture). They look unused too (imports go through the document picker), but blocking them needs an import check on Android 12 or older, which this machine cannot run.
4. **Check the merged manifest of the production build** before answering the permission forms: `aapt dump permissions <app>.aab` (or `bundletool dump manifest`). The checked-in `apps/mobile/android/` is a local prebuild and may differ from what EAS builds.
5. **Screen protection on by default** (BACKLOG P5-6, D-105), same as iOS.
6. **Play screenshots come from iOS captures.** `docs/store/graphics/android/` is made from the iPhone captures with the status bar cropped off and no Dynamic Island (the Android app uses the same screens, D-066), because no Android pass has been run since the glass redesign. The tab bar and the system font are the iOS ones. Owner: accept these, or run one Android capture pass (CLAUDE.md) and point `tools/brand/store.ts` at it.
7. **Availability.** D-148: Australia at 1.0, same as the App Store.

## Store presence > Main store listing

| Field | Limit | Answer |
| --- | --- | --- |
| App name | 30 | `listing-en-AU.md` > Name |
| Short description | 80 | `listing-en-AU.md` > Short description |
| Full description | 4000 | `listing-en-AU.md` > Description > Google Play |
| App icon | 512 x 512 PNG, up to 1 MB | `docs/store/graphics/play-icon-512.png` |
| Feature graphic | 1024 x 500 PNG or JPEG, no alpha | `docs/store/graphics/play-feature-graphic.png` |
| Video | YouTube URL, optional | None |
| Phone screenshots | 2 to 8, 9:16, at least 1080 x 1920 to qualify for recommendation | `docs/store/graphics/android/`, order in `listing-en-AU.md` > Screenshots (see "Before the first public release" item 6) |
| 7-inch and 10-inch tablet screenshots | Optional | None. The app is laid out for phones. |
| Chromebook, Android XR, TV, Wear OS, Android Auto | Optional | None. |

## Store presence > Store settings

| Field | Answer |
| --- | --- |
| App or game | App |
| Category | Health & Fitness |
| Tags (up to 5, from Google's fixed list) | Health & fitness; Calendar; Privacy & security; Lifestyle. Not chosen: Medical (Sanguine says it is not a medical device), Activity tracker (step and workout trackers), Parenting and Baby care (pregnancy apps; Sanguine has no conception mode). Check the picker when submitting: the list changes. |
| Email address (public) | admin@dothings.lol |
| Phone number (public) | Leave empty. |
| Website | https://amnesthesia.github.io/sanguine/ |
| External marketing | Off. Sanguine does not want its listing in Google's ads outside Play; leaving it on does no harm either, it is a preference. |

## Policy and programs > App content

| Declaration | Answer |
| --- | --- |
| Privacy policy | https://amnesthesia.github.io/sanguine/privacy.html |
| Ads | No, the app does not contain ads. |
| App access | All functionality is available without special access. (No account. On first launch the user answers onboarding with any date of birth that makes them 18 or older to see every feature; say this in the instructions box if Google asks.) |
| Content rating (IARC) | See below. |
| Target audience and content | Age groups: 13–15, 16–17, 18 and over. Not 12 and under (minimum age 13, PLAN §2.4), so the Families policy does not apply. "Could your store listing unintentionally appeal to children?" No. |
| News app | No. |
| Data safety | See below. |
| Government app | No. |
| Financial features | My app doesn't provide any financial features. |
| Health apps | Complete it. Text and categories in `docs/store/play-health-declaration.md`. Category: tracking reproductive or menstrual health, within health and fitness. Not a medical device. |
| Health Connect | Complete the data-type declaration: table and reasons in `docs/store/play-health-declaration.md`. Google reviews this separately and can take several days. |
| Photo and video permissions | No. `READ_MEDIA_IMAGES` is blocked (item 3 above). The fallback text at the end of this file is only for a build made before the block. |
| Advertising ID | No, the app does not use an advertising ID. (No `AD_ID` permission in the manifest; check it in the merged manifest, item 4.) |
| Foreground service, exact alarms, full-screen intent, accessibility API, VPN, background location | None used. Answer only if Play Console lists the form, which it does when the manifest has the permission. |
| Account deletion | Not applicable: users cannot create an account. |
| COVID-19 contact tracing and status | No (if the form still appears). |

### Content rating (IARC questionnaire)

| Question | Answer |
| --- | --- |
| Email for the rating certificate | admin@dothings.lol |
| Category | All other app types (not a game, not social or communication) |
| Violence, fear, blood | No |
| Sexuality, nudity | No. The app shows no sexual content. Optional logging of sex (off by default, hidden under 18) is a checkbox, not content. |
| Language (profanity, crude humour) | No |
| Controlled substances (drugs, alcohol, tobacco) | No |
| Gambling, simulated gambling | No |
| Users can interact or exchange content | No |
| Shares the user's location with other users | No |
| Allows purchase of digital goods | No |
| Unrestricted internet access (web browser, search engine) | No |
| Is the app a web browser or search engine | No |

Expected result: Everyone / PEGI 3 / USK 0 / ACB G, or close. The target audience setting (13 and over) is what keeps it away from children.

### Data safety

| Question | Answer |
| --- | --- |
| Does your app collect or share any of the required user data types? | Yes (one type) |
| Is all of the user data collected by your app encrypted in transit? | Yes (HTTPS) |
| Do you provide a way for users to request that their data is deleted? | Yes: Settings > Privacy and data > Delete everything removes everything Sanguine holds on the phone. The installation id at Expo is not linked to the person and is replaced on reinstall. |
| Data types collected | Device or other IDs. Collected: Yes. Shared: No. Processed ephemerally: No. Required (users cannot turn it off): Yes. Purpose: App functionality. This is the random installation id `expo-updates` sends with the update check (D-069, D-072). |
| Health and fitness | Not collected. It never leaves the phone. (Google Drive backup is not offered in current builds; when it is, it goes to the user's own app-data folder, encrypted on the phone before upload, which Google's form treats as not collected because the developer cannot read it.) |
| Every other type (location, personal info, financial, messages, photos and videos, audio, files and docs, calendar, contacts, app activity, web browsing, app info and performance) | Not collected. "Add to someone's calendar" (D-079) builds a calendar file on the phone and hands it to the share sheet; the app sends nothing. |
| Independent security review | No |
| UPI / Families commitments | Not applicable. |

## Monetise > Products, Pricing

| Field | Answer |
| --- | --- |
| Price | Free. Once an app is published free on Play it cannot become paid. |
| In-app products, subscriptions | None. |

## Reach and devices

| Field | Answer |
| --- | --- |
| Countries and regions | D-148: Australia at 1.0. Add the United States, the EU/EEA and the UK on the same conditions as the App Store (`app-store-connect.md` > Pricing and Availability). |
| Device catalogue | Default. Phones only in practice; no exclusions needed. |

## Test and release > Production (and each testing track)

| Field | Answer |
| --- | --- |
| App bundle | From `pnpm build:android:production`, uploaded by `pnpm submit:android` to internal, then promoted. |
| Release name | `1.0.0 (<version code>)` (Play fills this in from the bundle). |
| Release notes | `<en-AU>` `listing-en-AU.md` > What's new `</en-AU>` (500 characters). |
| Staged rollout | 1.0.0: 100% (nobody has an earlier version). Later versions: start at 20%. |
| Managed publishing | On, so a review approval does not publish by itself; the owner presses Publish. |
| Play App Signing | On (EAS holds the upload key; Google holds the app signing key). |

## Fallback: `READ_MEDIA_IMAGES` declaration text

Use only if the permission cannot be removed.

> Sanguine does not access, read or upload your photos or videos. The permission is declared by a library Sanguine uses to stop screenshots of your health data and to hide the app in the recent-apps view. On Android 13 that library can also detect when a screenshot is taken by checking for new images; Sanguine does not use that feature and never reads the photo library.
