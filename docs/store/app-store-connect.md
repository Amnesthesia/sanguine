# App Store Connect: every field, in the order the console shows it

For the owner filling in App Store Connect (appstoreconnect.apple.com > Apps > Sanguine). Copy that people read on the store page (name, subtitle, description, keywords, promotional text, What's New, screenshot captions) lives in `listing-en-AU.md`; this file says which field it goes in and gives every other answer. Checked against Apple's help pages on 2026-11-19; the console changes, so read each question before answering.

Fixed facts of this app record:

| Field | Value | Where it comes from |
| --- | --- | --- |
| Apple ID (app) | 6820870832 | `apps/mobile/eas.json` `submit.production.ios.ascAppId` |
| Team ID | R3PC2YD7K4 | same |
| Bundle ID | app.sanguine.mobile | `apps/mobile/app.json` `expo.ios.bundleIdentifier` |
| Widget extension bundle ID | app.sanguine.mobile.widgets | `app.json`, `expo-widgets` plugin |
| App Group | group.app.sanguine.mobile | same |
| iCloud container | iCloud.app.sanguine.mobile | `app.json` entitlements |
| SKU | Already set when the app record was created, and it can never be changed. Read it in App Information. If the record is ever recreated, use `SANGUINE-IOS`. | App Store Connect |
| Version | 1.0.0 (build number set by EAS, `autoIncrement`) | `app.json` `expo.version`, `eas.json` |

## Before the first submission

These block or put the review at risk. Each has an owner or a backlog item.

1. **Screen protection on by default.** `screenProtection` in `DEFAULT_PREFS` (`apps/mobile/src/data/prefs.ts`) is `false` for the beta (D-105). Set it to `true` before the public release (BACKLOG P5-6). The listing says "screen protection", which is true either way, but the plan's privacy default is on.
2. **Age rating questions added in 2025.** Apple added 13+, 16+ and 18+ and new required questions (in-app controls, capabilities, medical or wellness topics, violent themes). Updates are blocked until they are answered. Answers below.
3. **Regulated medical device status.** Required for Health and Fitness apps available in the EU/EEA, UK or US. Answer: No (below).
4. **EU trader status (Digital Services Act).** Required before the app can be offered in the EU. Owner decision (below).
5. **Copyright line.** Needs the legal name of the account holder (owner).
6. **Availability.** D-148: Australia only at 1.0, until the GDPR representative named in `docs/dpia.md` (now "TBD") exists for the EU and UK, and the owner confirms the US. See "Pricing and Availability".
7. **iCloud backup and Guideline 5.1.3(ii).** The guideline says apps "may not store personal health information in iCloud". Sanguine's optional backup goes to the user's own iCloud Drive, encrypted on the phone, and leaves out samples imported from Apple Health (RK-21, `exportBundle` with `forBackup`, `apps/mobile/src/data/healthBackup.test.ts`). The review notes explain this (`review-notes.md`). If App Review rejects it anyway, the fallback is to offer only the local backup file on iOS; that is an owner decision, not a listing change.

## App Information (General > App Information)

| Field | Answer |
| --- | --- |
| Name | `listing-en-AU.md` > Name (Sanguine: Cycle Tracker) |
| Subtitle | `listing-en-AU.md` > Subtitle |
| Primary language | English (Australia) |
| Category, primary | Health & Fitness |
| Category, secondary | Lifestyle (D-148). Not Medical: Sanguine is not a medical device and says so. |
| Content rights | "Does your app contain, show, or access third-party content?" No. The app shows only what the user logs and Sanguine's own text. Imported files (Natural Cycles, drip, CSV) are the user's own data. |
| Age rating | See "Age rating questionnaire" below. |
| License agreement | Apple's standard EULA. The app's source licence (AGPL-3.0, `LICENSE`) is separate and needs no store entry. |

### App Store Regulations and Permits

| Field | Answer |
| --- | --- |
| Regulated medical device (EU/EEA, UK, US) | No. Sanguine is general health and wellness software, not a medical device in any of these markets (PLAN §2.1 to §2.3). No EU SRN, UKCA mark or FDA registration exists or is needed. Only the Account Holder or an Admin can save this. |
| Digital Services Act trader status | Owner decision. A trader's address, phone number and email are shown publicly on the EU store page. Sanguine is free, has no purchases and no ads, and is published as open source; whether the developer acts "for purposes relating to their trade, business, craft or profession" depends on who holds the account (a company or a person). Apple does not give legal advice on this; neither does this file. Until it is answered the app cannot be offered in the EU, which matches D-148. |

## Age rating questionnaire

Apple computes the rating from the answers. Sanguine's own minimum age is 13 (PLAN §2.4, asked at onboarding by date of birth).

| Question group | Answer | Why |
| --- | --- | --- |
| Parental controls (in-app controls) | No | The app has none. |
| Age assurance (in-app controls) | No | Onboarding asks for a date of birth and refuses under 13, but that is the user's own statement, not an age assurance method. |
| Unrestricted web access | No | No browser and no web views of outside sites. |
| User-generated content, messaging or chat, social features | No | Nothing a user writes is seen by anyone else. |
| Advertising | No | No ads, no ad SDKs (CI fails the build if one appears). |
| Medical or treatment information | Infrequent | The health flag text points to a doctor, and the About screen explains the estimates. The app gives no treatment information. |
| Health or wellness topics | Yes | Food, movement and supplement notes by cycle phase (D-107) and the energy log (D-108) are self-care and lifestyle recommendations in Apple's sense. |
| Sexual content or nudity | None | No sexual content is shown. Optional logging of sex (off by default, hidden under 18) is a checkbox and a condom flag, not content. |
| Mature or suggestive themes | None | |
| Violence (cartoon, realistic, prolonged), violent themes | None | |
| Horror or fear themes | None | |
| Profanity or crude humour | None | |
| Alcohol, tobacco or drug use or references | None | Supplement notes are dietary, not drugs. |
| Simulated gambling, gambling, contests, loot boxes | None / No | |
| Made for Kids | No | |

Expected result: 13+ or lower. If App Store Connect computes a rating below 13+, use "Age Rating Override" to raise it to 13+ so the store matches the app's own minimum age (D-148). Never lower it.

## App Privacy (General > App Privacy)

| Field | Answer |
| --- | --- |
| Privacy Policy URL | https://amnesthesia.github.io/sanguine/privacy.html |
| User Privacy Choices URL | Leave empty (no account, nothing to opt out of on a server). |
| Data collection | Yes, one type: Identifiers > Device ID. Purpose: App Functionality. Linked to the user: No. Used for tracking: No. This is the random installation id `expo-updates` sends with the update check (D-069, D-072). |
| Every other type | Not collected: Health and Fitness, Sensitive Info, Contact Info, Usage Data, Diagnostics, Location, Identifiers > User ID, Purchases, Financial Info, Contacts, User Content, Browsing History, Search History, Other. Logged data stays on the phone; the optional iCloud backup is encrypted on the phone with a key the developer never has, so the developer cannot read it. |

The privacy manifest in `app.json` (`expo.ios.privacyManifests`) declares the same, and `tools/ci/store.test.ts` keeps the two in step.

## Accessibility (General > Accessibility)

Accessibility Nutrition Labels are optional; Apple says a feature may be claimed only if every common task can be done with it. Claim only what has been checked. Status from `docs/accessibility.md`:

| Feature (iPhone) | Claim? | Evidence |
| --- | --- | --- |
| Dark Interface | Yes | Every screen has a dark theme, following the system or set in Settings > Appearance. |
| Differentiate Without Color Alone | Yes | Period, estimate and fertile days are shapes (solid, dashed ring, fainter ring) and spoken in words (`calendarModel.test.ts`, `a11y.test.ts`). |
| Sufficient Contrast | Yes | Text at least 4.5:1, non-text at least 3:1 for every colour token, light and dark (`packages/ui-tokens/src/tokens.test.ts`). Text on glass uses `textOnGlass` (D-130). |
| Reduced Motion | Yes | Only three animations exist (the splash, the calendar month swipe, the day sheet), and each reads the Reduce Motion setting: the swipe cross-fades and the sheet settles with a short timing (`apps/mobile/src/a11y.test.ts`); the splash checks `isReduceMotionEnabled` (`features/splash/BrandSplash.tsx`). |
| Larger Text | Not yet | Checked at about 150% (Dynamic Type AX1). Apple's bar is 200%. Claim after a pass at the largest accessibility size. |
| VoiceOver | Not yet | Labels are tested automatically, but no person has walked the VoiceOver script in `docs/accessibility.md`. Claim after that walk. |
| Voice Control | Not yet | Not checked. Every control has a label, so it is likely; check before claiming. |
| Captions, Audio Descriptions | Not applicable | The app has no video or audio. |

## Pricing and Availability

| Field | Answer |
| --- | --- |
| Price | Free (USD 0.00). No in-app purchases, no subscriptions. |
| Availability | D-148: Australia at 1.0. Add the United States when the owner confirms the consumer health data policy (`docs/consumer-health-data-policy.md`, published at /health-data.html) is final. Add the EU/EEA and the UK only when the GDPR representative is named (`docs/dpia.md`) and the DSA trader question is answered. |
| Pre-order | No |
| App distribution methods | Public |
| Apple Silicon Mac and Apple Vision Pro availability | Off. The app is built and tested for iPhone only; a Mac or Vision Pro user would get untested layout and no HealthKit on Mac. |
| Tax category | App Store software (default) |

## Version page (iOS App > 1.0.0)

| Field | Answer |
| --- | --- |
| Screenshots, iPhone 6.9" | `docs/store/graphics/ios/`, in the order listed in `listing-en-AU.md` > Screenshots. 1320 x 2868, no alpha. Smaller sizes are scaled from these. No iPad screenshots: `supportsTablet` is false. |
| App previews (video) | None. |
| Promotional Text | `listing-en-AU.md` > Promotional text |
| Description | `listing-en-AU.md` > Description > App Store |
| Keywords | `listing-en-AU.md` > Keywords |
| Support URL | https://amnesthesia.github.io/sanguine/support.html |
| Marketing URL | https://amnesthesia.github.io/sanguine/ |
| What's New | Not shown for a first version. From 1.0.1 on, one or two plain sentences per release, same word rules. |
| Version | 1.0.0 |
| Copyright | "2026 " followed by the account holder's legal name (owner). |
| Routing App Coverage File | None (not a routing app). |
| Build | The latest production build from `pnpm build:ios:production` and `pnpm submit:ios` (`docs/store/eas.md`). |
| Game Center | Off |
| Sign-in required | No. There is no account. |
| App Review contact | First name, last name, phone (owner). Email: admin@dothings.lol |
| App Review notes | Paste `docs/store/review-notes.md` (under 4000 characters). |
| Attachment | None needed. |
| Version release | Manually release this version. The owner chooses the day. |
| Phased release for automatic updates | On, for every later version (7 days). Not used for 1.0.0. |
| Reset iOS summary rating | Not applicable at 1.0. |

## Other App Store Connect items

| Item | Answer |
| --- | --- |
| Export compliance | Answered in the build: `ITSAppUsesNonExemptEncryption` false in `app.json`. The backup uses standard published algorithms (XChaCha20-Poly1305, Argon2id) to protect the user's own data. Confirm the answer when App Store Connect asks on the first build. |
| HealthKit | Entitlement and usage strings are in `app.json` (`NSHealthShareUsageDescription`, `NSHealthUpdateUsageDescription`). No store form beyond App Privacy. |
| In-App Purchases, Subscriptions, In-App Events, Custom Product Pages, Product Page Optimisation | None. |
| App Clip, iMessage app, Apple Watch app | None (Watch app was a spike only, D-086). |
| Alternate app icon | The discreet "Notes" icon ships in the binary (`expo-alternate-app-icons`); it needs no store entry, and it does not appear in screenshots. |
| TestFlight | Beta App Description: "Sanguine helps you track and understand your menstrual cycle. It is not a contraceptive and is not a medical device." Feedback email: admin@dothings.lol. Beta review needs the same review notes. |
