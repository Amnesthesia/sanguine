# Store listing (en-AU), draft for both stores

Source of truth for wording is PLAN.md §2.3; `tools/ci/store.test.ts` checks the first paragraph and the forbidden-word list.

## Name and subtitle

- Name: Sanguine: Cycle Tracker
- Subtitle (App Store, 30 characters): Private, on-device cycle log
- Short description (Play, 80 characters): A private cycle tracker that keeps everything on your phone.

## Description

Sanguine helps you track and understand your menstrual cycle. It is not a contraceptive and is not a medical device.

Everything you log stays on your phone, encrypted. Sanguine has no account and no server, so we cannot see your data and cannot hand it to anyone.

- Log your period, flow, symptoms, temperature, ovulation tests and cervical mucus in two taps.
- See your next period and your ovulation as ranges, with a plain-language confidence grade, never as a single promised day.
- Understand your history: cycle length, period length and how they vary.
- Import your history from Natural Cycles, Flo, Clue or a CSV, and export everything whenever you like.
- Optional two-way sync with Apple Health and Health Connect, one data type at a time.
- Optional encrypted backup to your own iCloud Drive or Google Drive. The file is encrypted on your phone before it leaves.
- App lock, discreet notifications, a discreet app icon and name, and screenshot protection.
- No analytics, no advertising, no tracking. Free, with nothing locked away.

Sanguine does not diagnose, screen for or treat any condition. If you are worried about your health, talk to a health professional.

## Keywords (App Store, 100 characters)

period tracker,cycle,menstrual,calendar,private,offline,temperature,ovulation estimate,BBT

## Category

Health and Fitness (both stores).

## Age rating answers (owner submits; proposed)

- Minimum age in the app is 13 (PLAN §2.4); target rating 13+ on the App Store and Teen on Google Play.
- Medical or health information: yes, tracking and educational estimates. Sexual content: none shown; the app has optional logging of sexual activity (off by default, hidden in teen mode), which the questionnaires ask about under "sexual content" or "health and sexual wellness". Answer it truthfully; it is the reason for 13+.
- No user-generated content, no chat, no web access, no purchases, no gambling, no location.

## Privacy answers

- App Store "App Privacy": Data Not Collected. Nothing leaves the device. The optional backup goes to the user's own iCloud Drive in a file encrypted on the phone, and Apple Health data is read and written only on the device.
- Google Play "Data safety": no data collected, no data shared; data encrypted at rest; users can request deletion (Settings, Delete all data); the optional Google Drive backup is to the user's own app-data folder and is encrypted before upload.
- Privacy policy URL: owner supplies where `docs/privacy-policy.md` is published.
- Health declarations: Apple usage strings are in `app.json`; the Google Play health apps declaration and the Health Connect data-type declaration text is in `docs/store/play-health-declaration.md`.

## Screenshots

Take them from `docs/screenshots/` (Today, Calendar, Insights, logging sheet, onboarding; light and dark) on the largest iPhone and a Pixel-class phone. No screenshot may show a contraception or conception claim.
