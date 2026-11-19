# Store listing (en-AU): the copy for both stores

This file holds every piece of text a person reads on the store pages. The console forms, field by field, are in `app-store-connect.md` and `play-console.md`; they point back here for the copy so it lives in one place.

Source of truth for wording is PLAN.md §2.3. `tools/ci/store.test.ts` checks the fixed first paragraph, the forbidden-word list and the character limits over everything from "Name" to "Category".

Language: English (Australia), the only language the app has (`apps/mobile/src/i18n/translations.ts` lists no translations). Spelling is Australian.

## Name, subtitle and short text

- Name (both stores, 30 characters): Sanguine: Cycle Tracker
- Subtitle (App Store, 30 characters): Private, on-device cycle log
- Short description (Play, 80 characters): A private cycle tracker that keeps everything on your phone.
- Promotional text (App Store, 170 characters, can change without a review): Your cycle, kept on your phone. Ranges with a confidence grade, never a single promised day. No account, no ads, no tracking. Free.
- What's new (App Store, 4000 characters; Play release notes, 500 characters), version 1.0: First release.

## Taglines

Short lines for the store graphics and the website. None promises a day or names a condition.

- Your cycle, kept on your phone.
- A range, not a promise.
- No account. No ads. No tracking.
- Private by design, free for good.
- Track it. Understand it. Keep it.
- Encrypted on your phone, and nowhere else.
- Know where you are in your cycle at a glance.
- Estimates that tell you how sure they are.

The six splash taglines in `copy/en-AU.json` (`taglines`) are the in-app brand voice (D-049) and stay in the app; they are not store copy.

## Description

Both stores take up to 4000 characters. The two versions differ only where a platform is named: Apple rejects metadata that names another mobile platform (App Review Guideline 2.3.10), so the App Store text never says Android or Health Connect, and the Play text never says iPhone or Apple Health.

Google Drive backup is not offered in current builds: it waits for an OAuth client id in `app.json` (`expo.extra.googleDriveClientId`, `services/cloud/driveApi.ts` `driveEnabled`). Neither description mentions Google Drive until it is set. Then add to the Play text, under "Yours to keep": "• Optional encrypted backup to your own Google Drive, which can also keep your own phones in step. The file is encrypted on your phone before it leaves.", and "or Google Drive" to the App Store backup line.

### App Store

Sanguine helps you track and understand your menstrual cycle. It is not a contraceptive and is not a medical device.

Everything you log stays on your iPhone, encrypted. Sanguine has no account and no server, so we cannot see your data and cannot hand it to anyone.

LOG IN A FEW TAPS
• Period and flow, spotting, symptoms and how strong they are, energy, temperature, ovulation (LH) tests, cervical mucus and cervical position, and notes.
• Remove an entry with one tap, and undo it if you change your mind.

ESTIMATES YOU CAN READ
• Your next period and your ovulation as ranges, with a plain-language confidence grade, never as a single promised day.
• A cycle dial on Today shows where you are in your cycle at a glance.
• The calendar shows logged days, estimated days and the day of your cycle.
• Symptoms never move an estimate. Only your period dates, temperature, ovulation tests, cervical mucus and cervical position do.

UNDERSTAND YOUR CYCLES
• Insights: cycle and period length, how they vary, and how your symptoms and energy tend to follow your cycle.
• Notes on food and movement for each phase of your cycle, each with its reasons, an evidence grade and sources.
• A report for your doctor: a PDF of your logged cycles, made on your phone and shared only if you choose.
• If you are pregnant, Today counts the weeks and shows your due date as a range.

YOURS TO KEEP
• Import your history from Natural Cycles, drip or a CSV file, and export everything whenever you like.
• Optional two-way sync with Apple Health, one data type at a time.
• Optional encrypted backup to your own iCloud Drive, which can also keep your own iPhones in step. The file is encrypted on your iPhone before it leaves.
• Reminders before your next period or ovulation estimate, and a note when your period is later than expected.
• A home-screen widget with the day of your cycle.

PRIVATE BY DESIGN
• App lock with Face ID, Touch ID or your passcode.
• Discreet reminders, a discreet app icon and name, and screen protection.
• For ages 13 to 17, fertility wording is hidden by default.
• No analytics, no advertising, no tracking. Free, with nothing locked away.

Sanguine does not diagnose, screen for or treat any condition. If you are worried about your health, talk to a health professional.

### Google Play

Sanguine helps you track and understand your menstrual cycle. It is not a contraceptive and is not a medical device.

Everything you log stays on your phone, encrypted. Sanguine has no account and no server, so we cannot see your data and cannot hand it to anyone.

LOG IN A FEW TAPS
• Period and flow, spotting, symptoms and how strong they are, energy, temperature, ovulation (LH) tests, cervical mucus and cervical position, and notes.
• Remove an entry with one tap, and undo it if you change your mind.

ESTIMATES YOU CAN READ
• Your next period and your ovulation as ranges, with a plain-language confidence grade, never as a single promised day.
• A cycle dial on Today shows where you are in your cycle at a glance.
• The calendar shows logged days, estimated days and the day of your cycle.
• Symptoms never move an estimate. Only your period dates, temperature, ovulation tests, cervical mucus and cervical position do.

UNDERSTAND YOUR CYCLES
• Insights: cycle and period length, how they vary, and how your symptoms and energy tend to follow your cycle.
• Notes on food and movement for each phase of your cycle, each with its reasons, an evidence grade and sources.
• A report for your doctor: a PDF of your logged cycles, made on your phone and shared only if you choose.
• If you are pregnant, Today counts the weeks and shows your due date as a range.

YOURS TO KEEP
• Import your history from Natural Cycles, drip or a CSV file, and export everything whenever you like.
• Optional two-way sync with Health Connect, one data type at a time.
• Reminders before your next period or ovulation estimate, and a note when your period is later than expected.

PRIVATE BY DESIGN
• App lock with your fingerprint, face or screen lock.
• Discreet reminders, a discreet app icon and name, and screen protection.
• For ages 13 to 17, fertility wording is hidden by default.
• No analytics, no advertising, no tracking. Free, with nothing locked away.

Sanguine does not diagnose, screen for or treat any condition. If you are worried about your health, talk to a health professional.

## Keywords (App Store, 100 characters)

Comma-separated, no spaces. Words already in the name or subtitle (Sanguine, cycle, tracker, private, log) are indexed anyway and are left out. No competitor names (Guideline 2.3.7). "Fertility" and "pregnancy" are left out on purpose: they would bring people trying to get pregnant, and Sanguine has no mode for that (PLAN §11).

period,menstrual,calendar,ovulation,BBT,temperature,PMS,symptoms,offline,encrypted,LH,mucus,women

## Category

Health and Fitness (both stores). App Store secondary category: Lifestyle (D-148).

## Screenshots

Generated by `pnpm --filter @sanguine/brand store` (`tools/brand/store.ts`; one slide: `npx tsx store.ts <name>` in `tools/brand`) from the raw iPhone 17 Pro Max captures in `docs/screenshots/appstore/ios/` (sample data, 9:41 status bar; see the README there), into `docs/store/graphics/`. Each slide is the capture in a phone frame on the blush field (plum for the dark ones), under the emblem, a caption in Cormorant capitals and an italic line. Upload in this order. No alpha channel (both stores reject it).

| # | Caption | Line under it | Capture | App Store (6.9", 1320 x 2868) | Google Play (phone, 1080 x 1920) |
|---|---------|---------------|---------|-------------------------------|----------------------------------|
| 1 | Know where you are in your cycle | A range, not a promise. | 01-today, dark behind light | `ios/01-today.png` | `android/01-today.png` |
| 2 | Your whole cycle at a glance | Logged days solid, estimates dashed. | 02-calendar-light | `ios/02-calendar.png` | `android/02-calendar.png` |
| 3 | Every estimate says how sure it is | Tap any day to read it in words. | 03-calendar-day-light | `ios/03-day.png` | `android/03-day.png` |
| 4 | Log your day in a few taps | Flow, symptoms, energy, temperature and more. | 04-log-light | `ios/04-log.png` | `android/04-log.png` |
| 5 | How each estimate was worked out | Your own cycles, and the research behind them. | 05-insights-cycle-light | `ios/05-insights.png` | `android/05-insights.png` |
| 6 | Stays on your phone | No account. No ads. No tracking. Encrypted on your phone, and nowhere else. | none (typographic, emblem and logotype) | `ios/06-privacy.png` | `android/06-privacy.png` |
| 7 | Light or dark, day or night | Follows your phone, or choose in Settings. | 02-calendar-dark | `ios/07-dark.png` | `android/07-dark.png` |

- App Store: the 6.9" set is the only one required; App Store Connect scales it for smaller iPhones. No iPad set: `supportsTablet` is false.
- Google Play: the phone set is made from the same iOS captures with the status bar cropped off and no Dynamic Island drawn (the Android app uses the same screens, D-066). Replace with Android captures when an Android pass is run. Feature graphic `play-feature-graphic.png` (1024 x 500: emblem, logotype, "A private cycle tracker", the Today screen in a phone), app icon `play-icon-512.png` (512 x 512).
- Not used: 06-insights-charts (only the first cards show), 07-insights-history and 08-settings-appearance (thin on sample data).
- To refresh after a UI change: retake the captures, then rerun the script. Captions follow the same forbidden-word list as the description (PLAN §2.3).

## URLs and contact

The website is an Astro site in `apps/site/`, built by `pnpm site` and published to GitHub Pages by `.github/workflows/pages.yml`. The policy pages render the same generated data the app shows (`policies.generated.ts`, from `docs/privacy-policy.md` and `docs/consumer-health-data-policy.md`), so the published and in-app policies cannot drift.

- Marketing URL (App Store) and website (Play): https://amnesthesia.github.io/sanguine/
- Support URL (App Store): https://amnesthesia.github.io/sanguine/support.html
- Privacy policy URL (both stores): https://amnesthesia.github.io/sanguine/privacy.html
- Consumer health data policy (US state laws; linked from the privacy policy): https://amnesthesia.github.io/sanguine/health-data.html
- Contact email (Play, shown publicly; App Store review contact): admin@dothings.lol
- Copyright (App Store): 2026, followed by the legal name of the developer account holder.
