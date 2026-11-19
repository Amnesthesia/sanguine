# Notes for the app reviewers (App Store Connect and Play Console)

Paste the text below the line into "Notes" (App Store Connect, App Review Information) and into "Instructions" if Play Console asks under App access. It is under 4000 characters. On Play, leave out the iCloud paragraph.

---

- Sanguine has no account, no sign-in and no server. There is nothing to log in to, and no demo account is needed.
- To see the app with data quickly: complete onboarding with any date of birth that makes the user 18 or older, then tap "Log today" on Today and log a period. Estimates appear after the first period is logged and improve with each cycle.
- All data is stored on the device in an encrypted database (SQLCipher; the key is in the Keychain / Keystore). The app makes no network requests except the check for app updates (no user data) and, only if the user turns it on, the encrypted backup.
- Backup and iCloud (Guideline 5.1.3): the optional backup (Settings > Privacy and data > Encrypted backup) is a single file in the user's own iCloud Drive app folder. It is encrypted on the phone (XChaCha20-Poly1305, key from the user's passphrase via Argon2id combined with a secret generated on the phone, which the user keeps as a recovery code), so neither Apple nor the developer can read it. It holds only what the user logged in Sanguine: records that came only from Apple Health are left out, so no HealthKit data is stored in iCloud.
- Health data: Settings > Health sync. Nothing is requested during onboarding. Each data type is requested when the user switches it on. Data read from or written to Apple Health or Health Connect is used only to show and sync the user's own cycle log. It is never used for advertising, never shared and never sold.
- Age: the minimum age is 13, asked at onboarding by date of birth. Under 18 the app hides fertility wording and sex logging by default.
- Medical claims: the app is not a contraceptive and not a medical device. The wording is fixed in the listing, onboarding and every estimate screen. Every estimate is a range with a confidence grade, never a single day. Symptoms never change an estimate.
- Food and movement notes (Today and the calendar) are general information by cycle phase, each with its reasons, an evidence grade and its sources. They are not personal advice.
- Discreet features: Settings lets the user change the home-screen icon and name to "Notes", hide the text of reminders, lock the app with Face ID or the passcode, and block screenshots.
